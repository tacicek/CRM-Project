/**
 * Einen HTTP-Koerper begrenzt einlesen.
 *
 * ── Warum das eine eigene Datei ist ─────────────────────────────────────────
 *
 * Diese Grenze ist entstanden, als die oeffentliche Absage abgesichert wurde,
 * und stand deshalb im Guard jener Funktion. Sie hat mit dem Absagen aber
 * nichts zu tun: sie beantwortet die Frage "wie liest man einen Koerper, ohne
 * dass ein Fremder damit Speicher belegen kann". Der Bestaetigungs-Endpunkt
 * braucht dieselbe Antwort. Sie von dort zu importieren hiesse, zwei
 * Funktionen fachlich aneinanderzubinden, die einander nichts angehen — und
 * sie zu kopieren hiesse, zwei Fassungen derselben Sicherheitsgrenze zu
 * pflegen, die auseinanderlaufen werden.
 *
 * Der Inhalt ist Zeile fuer Zeile derselbe wie vorher. Wer wissen will, warum
 * er so aussieht, findet die Begruendung an den einzelnen Stellen.
 *
 * Kein Deno, kein `https://`-Import: das laesst sich ausfuehren.
 */

/** Der Vorgabewert. Aufrufer duerfen ihn ausdruecklich uebergeben. */
export const MAX_BODY_BYTES = 8 * 1024;

/** Groesse in BYTES, nicht in Zeichen — ein Emoji ist vier Bytes und ein Zeichen. */
export const bodyByteLength = (text: string): number =>
  new TextEncoder().encode(text).length;

// ── Begrenzter Koerperleser ─────────────────────────────────────────────────

export type BoundedBodyResult =
  | { ok: true; text: string; bytes: number; reason?: undefined }
  | { ok: false; reason: "too_large" | "invalid_encoding" | "read_error"; text?: undefined };

export interface BodySource {
  /** Der Kopf `Content-Length`, so wie er ankam. Roh, ungeprueft. */
  contentLength: string | null;
  stream: ReadableStream<Uint8Array> | null;
}

/**
 * Liest hoechstens `maxBytes` Bytes und entschluesselt sie als UTF-8.
 *
 * Warum nicht `req.text()`: das liest den GANZEN Koerper in den Speicher und
 * gibt ihn erst danach heraus. Eine Groessenpruefung, die danach kommt, ist
 * keine Eingangsbegrenzung, sondern nur eine Parsebegrenzung — der Speicher ist
 * zu diesem Zeitpunkt bereits belegt. Bei einem oeffentlichen Endpunkt ohne
 * Anmeldung ist das der billigste Hebel, den ein Angreifer hat.
 *
 * `Content-Length` wird NICHT geglaubt. Er darf nur eines: frueh ABLEHNEN.
 * Ein zu kleiner oder fehlender Wert aendert nichts, weil waehrend des Lesens
 * ohnehin mitgezaehlt wird. Umgekehrt spart ein glaubhaft zu grosser Wert das
 * Anfassen des Datenstroms ganz.
 *
 * Entschluesselt wird erst am Ende und ueber den gesamten Puffer: ein
 * mehrbyte-Zeichen kann ueber eine Stueckgrenze laufen, und stueckweises
 * Dekodieren wuerde es zerreissen. `fatal: true`, weil ungueltiges UTF-8 eine
 * kaputte Anfrage ist und kein Anlass, stillschweigend Ersatzzeichen
 * einzusetzen.
 */
export const readBoundedUtf8 = async (
  quelle: BodySource,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<BoundedBodyResult> => {
  if (istAngekuendigtZuGross(quelle.contentLength, maxBytes)) {
    // Der Datenstrom wird gar nicht erst angefasst.
    return { ok: false, reason: "too_large" };
  }

  if (!quelle.stream) return { ok: true, text: "", bytes: 0 };

  const reader = quelle.stream.getReader();
  try {
    // EIN Puffer, fest auf die erlaubte Groesse. Vorher wurden die Stuecke
    // gesammelt und anschliessend in einen zweiten Puffer kopiert — doppelter
    // Speicher fuer dieselben Bytes, und zwar genau bei der Anfrage, die
    // moeglichst wenig kosten soll.
    const puffer = new Uint8Array(maxBytes);
    let gesamt = 0;

    for (;;) {
      let stueck: ReadableStreamReadResult<Uint8Array>;
      try {
        stueck = await reader.read();
      } catch {
        // Ohne den Fehler: er kann Teile des Koerpers enthalten.
        await stilleAbbestellung(reader);
        return { ok: false, reason: "read_error" };
      }

      if (stueck.done) break;
      const wert = stueck.value;
      if (!wert || wert.byteLength === 0) continue;

      if (gesamt + wert.byteLength > maxBytes) {
        // Das ueberzaehlige Stueck wird ausdruecklich NICHT in den Puffer
        // kopiert, und gelesen wird auch nicht weiter.
        await stilleAbbestellung(reader);
        return { ok: false, reason: "too_large" };
      }

      puffer.set(wert, gesamt);
      gesamt += wert.byteLength;
    }

    try {
      // Entschluesselt wird nur der gefuellte Teil, und erst am Ende: ein
      // Mehrbyte-Zeichen kann ueber eine Stueckgrenze laufen, stueckweises
      // Dekodieren wuerde es zerreissen.
      const text = new TextDecoder("utf-8", { fatal: true }).decode(puffer.subarray(0, gesamt));
      return { ok: true, text, bytes: gesamt };
    } catch {
      return { ok: false, reason: "invalid_encoding" };
    }
  } finally {
    // Auf JEDEM Ausgang — erfolgreich, zu gross, Lesefehler, kaputte Kodierung
    // und auch dann, wenn das Abbestellen selbst geworfen hat. Ein Strom, der
    // gesperrt zurueckbleibt, ist von aussen nicht mehr zu gebrauchen; das
    // Freigeben darf aber umgekehrt kein Ergebnis umdrehen, deshalb steht es
    // im `finally` und sein eigener Fehler wird verschluckt.
    try {
      reader.releaseLock();
    } catch {
      /* der Aufrufer hat sein Ergebnis bereits */
    }
  }
};

/** Abbestellen ist bestes Bemuehen: manche Quellen werfen dabei. */
const stilleAbbestellung = async (reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> => {
  try {
    await reader.cancel();
  } catch {
    /* egal — der Aufrufer hat bereits entschieden */
  }
};

/**
 * Ist die ANGEKUENDIGTE Laenge sicher zu gross?
 *
 * Ohne `Number()`, und das ist der Punkt. `9007199254740993` besteht nur aus
 * Ziffern und ist offensichtlich groesser als 8192 — aber die Zahl liegt
 * jenseits von `Number.MAX_SAFE_INTEGER`, `Number.isSafeInteger` sagt `false`,
 * und die Angabe galt damit als unbrauchbar. Ergebnis: der Strom wurde
 * angefasst, obwohl der Absender selbst ankuendigt, ein Vielfaches der Grenze
 * zu schicken.
 *
 * Verglichen wird deshalb als Zeichenkette: fuehrende Nullen weg, dann erst
 * die Laenge, bei Gleichstand lexikografisch. Fuer reine Ziffernfolgen ist das
 * dieselbe Ordnung wie der Zahlenvergleich — nur ohne obere Schranke.
 *
 * Alles, was nicht ausschliesslich aus Ziffern besteht (leer, Vorzeichen,
 * Exponent, Buchstaben), gilt als nicht vorhanden. Dann misst der Leser selbst;
 * geschenkt wird dadurch nichts.
 */
const istAngekuendigtZuGross = (contentLength: string | null, maxBytes: number): boolean => {
  if (contentLength === null) return false;
  const ziffern = contentLength.trim();
  if (!/^\d+$/.test(ziffern)) return false;

  const ohneFuehrendeNullen = ziffern.replace(/^0+(?=\d)/, "");
  const grenze = String(maxBytes);
  if (ohneFuehrendeNullen.length !== grenze.length) {
    return ohneFuehrendeNullen.length > grenze.length;
  }
  return ohneFuehrendeNullen > grenze;
};
