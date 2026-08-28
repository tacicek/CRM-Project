/**
 * Darf diese Offerte an diesen Kunden hinausgehen?
 *
 * EIN VERTRAG, ZWEI LAUFZEITEN
 *
 * Diese Datei liegt unter `supabase/functions/_shared/`, wird aber von BEIDEN
 * Seiten benutzt: die Edge Function `send-offer` importiert sie mit
 * `../_shared/offerSendReadiness.ts`, das Frontend mit einem relativen Pfad
 * (`allowImportingTsExtensions` ist gesetzt, Vite loest ihn auf).
 *
 * Das ist Absicht und keine Bequemlichkeit. Eine Pruefung, die nur am Knopf
 * haengt, ist keine Pruefung: ein veralteter Browser-Bundle, ein direkter
 * Funktionsaufruf, ein Wiederholungsversuch oder die naechste Integration gehen
 * daran vorbei. Zwei Kopien derselben Regel waeren genauso schlimm — die zweite
 * ist immer die, die niemand pflegt.
 *
 * Deshalb: keine Abhaengigkeiten. Kein Deno, kein React, kein i18n-Katalog. Die
 * Meldungen sind SCHLUESSEL, keine Saetze; uebersetzt werden sie dort, wo sie
 * jemand liest.
 *
 * WAS SIE PRUEFT
 *
 * Nicht, ob Text vorhanden ist — sondern WOHER er kommt. `localizedField` faellt
 * bei fehlender Uebersetzung auf die deutsche Basisspalte zurueck. Fuer die
 * Vorschau ist das richtig (eine Leerstelle im Dokument waere schlimmer), beim
 * SENDEN ist es der Fehler selbst: der franzoesische Kunde bekommt deutschen
 * Text, und niemand erfaehrt davon.
 *
 * Die Auskunft `source` trennt genau das. Ein `base-fallback` in einer
 * fr/en-Offerte ist ein Blocker, kein Achselzucken.
 */

export const READINESS_LOCALES = ["de", "fr", "en"] as const;
export type ReadinessLocale = (typeof READINESS_LOCALES)[number];

export const isReadinessLocale = (v: unknown): v is ReadinessLocale =>
  typeof v === "string" && (READINESS_LOCALES as readonly string[]).includes(v);

/** Woher ein aufgeloester Wert stammt — deckungsgleich mit `resolveLocalizedField`. */
export type SlotSource = "translation" | "base" | "base-fallback" | "absent";

export type ReadinessEntity =
  | "offer"
  | "offer_item"
  | "company"
  | "agb_section"
  | "checklist_template"
  | "leistungsuebersicht"
  | "email"
  | "pdf"
  | "public_view"
  | "attachment";

export type ReadinessCode =
  /** Gar keine Sprache mitgeliefert — veralteter Client. Faellt NICHT auf Deutsch zurueck. */
  | "MISSING_LOCALE"
  /** Sprache mitgeliefert, aber nicht de/fr/en. */
  | "UNSUPPORTED_LOCALE"
  /** Pflichtinhalt hat in der Zielsprache keine Uebersetzung — es kaeme Deutsch heraus. */
  | "GERMAN_FALLBACK"
  /** Pflichtinhalt fehlt in JEDER Sprache. */
  | "EMPTY_REQUIRED"
  /** Ein Glied der Kette traegt eine andere Sprache als die Offerte. */
  | "LOCALE_MISMATCH";

export interface ReadinessFinding {
  code: ReadinessCode;
  entity: ReadinessEntity;
  entityId: string | null;
  field: string;
  requestedLocale: string;
  /** Die Sprache, aus der stattdessen geliefert wuerde — `null`, wenn es gar nichts gibt. */
  fallbackLocale: string | null;
  /** Schluessel fuer den Bedienertext. Kein Satz: uebersetzt wird dort, wo gelesen wird. */
  messageKey: string;
  /** Wohin die Oberflaeche springen soll, wenn sie es kann. */
  focus: string | null;
}

/** Ein kundengerichteter Inhalt und wie er in der angeforderten Sprache aufgeloest wurde. */
export interface ContentSlot {
  entity: ReadinessEntity;
  entityId?: string | null;
  field: string;
  /**
   * Pflicht heisst: ohne diesen Inhalt in der richtigen Sprache geht nichts
   * hinaus. Optionale Inhalte duerfen fehlen — aber NICHT still auf Deutsch
   * umschlagen; dafuer gibt es die Warnung.
   */
  required: boolean;
  value: string | null;
  source: SlotSource;
  focus?: string | null;
}

/** Ein Glied der Kette, das seine eigene Sprache traegt. */
export interface LocaleClaim {
  entity: ReadinessEntity;
  entityId?: string | null;
  field: string;
  locale: unknown;
}

export interface ReadinessInput {
  /** Ungeprueft: kann fehlen (alter Client) oder Unsinn sein. */
  requestedLocale: unknown;
  slots: ReadonlyArray<ContentSlot>;
  /** PDF-, E-Mail-, Public-View- und Rechtschreibpruefungs-Sprache. */
  localeClaims?: ReadonlyArray<LocaleClaim>;
}

export interface ReadinessResult {
  /** `true` nur, wenn kein Blocker uebrig ist. */
  ok: boolean;
  /** Die geprueft angenommene Sprache — `null`, wenn schon sie nicht stimmte. */
  locale: ReadinessLocale | null;
  /** Verhindert den Versand. */
  blockers: ReadinessFinding[];
  /** Darf in der Vorschau markiert werden, verhindert nichts. */
  warnings: ReadinessFinding[];
}

const befund = (
  code: ReadinessCode,
  slot: Pick<ContentSlot, "entity" | "entityId" | "field" | "focus">,
  requestedLocale: string,
  fallbackLocale: string | null,
): ReadinessFinding => ({
  code,
  entity: slot.entity,
  entityId: slot.entityId ?? null,
  field: slot.field,
  requestedLocale,
  fallbackLocale,
  messageKey: `offer.send.blocked.${code}`,
  focus: slot.focus ?? null,
});

const leer = (v: string | null | undefined): boolean => (v ?? "").trim() === "";

/**
 * Die eine Stelle, die entscheidet, ob eine Offerte hinausgehen darf.
 *
 * Rein: keine Datenbank, kein Netz, kein Datum, keine Mutation. Zweimal
 * aufgerufen liefert sie zweimal dasselbe — der Aufrufer darf sie also fuer die
 * Anzeige UND fuer die Durchsetzung benutzen, ohne dass die beiden auseinander
 * laufen koennen.
 */
export const evaluateOfferSendReadiness = (eingabe: ReadinessInput): ReadinessResult => {
  const roh = eingabe.requestedLocale;

  // 1. Ohne Sprache wird nicht gesendet. Ein alter Client, der `locale`
  //    weglaesst, bekommt einen Fehler — nicht stillschweigend Deutsch.
  if (roh === undefined || roh === null || roh === "") {
    return {
      ok: false,
      locale: null,
      blockers: [
        befund("MISSING_LOCALE", { entity: "offer", entityId: null, field: "language", focus: null }, "", null),
      ],
      warnings: [],
    };
  }

  if (!isReadinessLocale(roh)) {
    return {
      ok: false,
      locale: null,
      blockers: [
        befund("UNSUPPORTED_LOCALE", { entity: "offer", entityId: null, field: "language", focus: null }, String(roh), null),
      ],
      warnings: [],
    };
  }

  const locale: ReadinessLocale = roh;
  const blockers: ReadinessFinding[] = [];
  const warnings: ReadinessFinding[] = [];

  // 2. Jede Kette muss dieselbe Sprache tragen. PDF, E-Mail, oeffentliche
  //    Ansicht und Rechtschreibpruefung duerfen nicht auseinanderlaufen.
  for (const anspruch of eingabe.localeClaims ?? []) {
    if (anspruch.locale !== locale) {
      blockers.push(
        befund(
          "LOCALE_MISMATCH",
          { entity: anspruch.entity, entityId: anspruch.entityId ?? null, field: anspruch.field, focus: null },
          locale,
          anspruch.locale === undefined || anspruch.locale === null ? null : String(anspruch.locale),
        ),
      );
    }
  }

  // 3. Inhalte.
  for (const slot of eingabe.slots) {
    // Nichts da, in keiner Sprache.
    if (slot.source === "absent" || leer(slot.value)) {
      if (slot.required) blockers.push(befund("EMPTY_REQUIRED", slot, locale, null));
      continue;
    }

    // Deutsch angefordert: die Basisspalte IST die richtige Quelle.
    if (locale === "de") {
      // `base-fallback` kann fuer `de` nicht entstehen; entstuende es doch,
      // waere es dieselbe deutsche Basis. Kein Blocker.
      continue;
    }

    // fr/en: alles, was nicht aus einer Uebersetzung kommt, ist deutscher Text.
    if (slot.source !== "translation") {
      const b = befund("GERMAN_FALLBACK", slot, locale, "de");
      if (slot.required) blockers.push(b);
      else warnings.push(b);
    }
  }

  return { ok: blockers.length === 0, locale, blockers, warnings };
};

/**
 * Kurzfassung fuer Protokoll und Fehlerantwort — ohne Kundeninhalt.
 *
 * Die Werte selbst gehen NICHT ins Protokoll: das sind Kundentexte aus
 * Offerten. Was gebraucht wird, ist welches Feld welcher Zeile in welcher
 * Sprache fehlt.
 */
export const summariseReadiness = (r: ReadinessResult): string =>
  r.blockers
    .map((b) => `${b.code}:${b.entity}${b.entityId ? `#${b.entityId}` : ""}.${b.field}@${b.requestedLocale}`)
    .join(", ");

// ---------------------------------------------------------------------------
// Zusammenbau
// ---------------------------------------------------------------------------

/**
 * Die Rohdaten, aus denen der Sendeweg seine Bereitschaftsprüfung baut.
 *
 * WARUM DAS EINE EIGENE FUNKTION IST
 *
 * Bis zur Durchsicht am 2026-08-28 stand dieser Zusammenbau inline in
 * `send-offer/index.ts`, und ein Quelltext-Tor prüfte per Textsuche, dass er
 * dort steht. Die Durchsicht hat das Tor mit einer Zuweisung EINE ZEILE über
 * dem `if` ausgehebelt — jedes gesuchte Literal blieb stehen, die Prüfung war
 * trotzdem tot.
 *
 * Eine Textsuche kann Anwesenheit und Reihenfolge belegen, nicht Wirkung. Also
 * wandert die Wirkung hierher, wo sie sich mit Eingabe und Ausgabe prüfen
 * lässt. Das Quelltext-Tor bleibt als Stolperdraht („der Handler ruft es noch
 * auf"), nicht als Beweis.
 */
export interface OfferSendReadinessRohdaten {
  /** `offers.language` — ungeprüft. */
  offerLanguage: unknown;
  /** Aufgelöste Zahlungskondition und ob sie aus der OFFERTE selbst stammt. */
  paymentTerms: string | null;
  paymentTermsFromOfferRow: boolean;
  companyId: string | null;
  agbSections: ReadonlyArray<{ id?: string | null; translations?: unknown } & Record<string, unknown>>;
  /**
   * Die Sprache, in der der Aufrufer die Anhänge GERENDERT hat.
   *
   * Nicht aus der Zeile abgeleitet — sonst verglichen wir einen Wert mit sich
   * selbst. Fehlt sie, ist der Aufrufer ein veralteter Bundle: dann gibt es
   * keine Zusicherung über die mitgeschickten PDF-Bytes, und das ist ein
   * Blocker, keine Nachlässigkeit.
   */
  declaredAttachmentLocale: unknown;
  /** Wurden überhaupt Anhänge mitgeschickt? Ohne sie gibt es nichts zu behaupten. */
  hasAttachments: boolean;
}

/** Wie eine Zeile mit `translations` in einer Sprache aufgelöst wird. */
export type LocalizedRowResolver = (
  row: Record<string, unknown>,
  field: string,
  locale: string,
) => { value: string | null; source: SlotSource };

export const buildOfferSendReadiness = (
  roh: OfferSendReadinessRohdaten,
  resolve: LocalizedRowResolver,
): ReadinessResult => {
  const locale = isReadinessLocale(roh.offerLanguage) ? roh.offerLanguage : null;
  const slots: ContentSlot[] = [];
  const claims: LocaleClaim[] = [];

  if (locale) {
    // Zahlungskondition: stammt sie aus der Offerte selbst, ist sie beim Anlegen
    // in der Kundensprache eingefroren worden. Stammt sie aus Firma oder
    // Vorlage, ist sie die deutsche Basisspalte — ohne Übersetzungssuche.
    if (roh.paymentTerms && !roh.paymentTermsFromOfferRow) {
      slots.push({
        entity: "company",
        entityId: roh.companyId,
        field: "default_payment_terms",
        required: true,
        value: roh.paymentTerms,
        source: locale === "de" ? "base" : "base-fallback",
        focus: "einstellungen#zahlungskonditionen",
      });
    }

    for (const abschnitt of roh.agbSections) {
      for (const feld of ["title", "content"]) {
        const aufgeloest = resolve(abschnitt, feld, locale);
        slots.push({
          entity: "agb_section",
          entityId: (abschnitt.id as string | null | undefined) ?? null,
          field: feld,
          required: true,
          value: aufgeloest.value,
          source: aufgeloest.source,
          focus: "einstellungen#agb",
        });
      }
    }

    // Die Anhänge behaupten ihre eigene Sprache. Fehlt die Angabe, obwohl
    // Anhänge da sind, ist das ein veralteter Aufrufer — und über die Bytes ist
    // dann nichts bekannt.
    if (roh.hasAttachments) {
      claims.push({
        entity: "pdf",
        field: "attachment_locale",
        locale: roh.declaredAttachmentLocale,
      });
    }
  }

  return evaluateOfferSendReadiness({
    requestedLocale: roh.offerLanguage,
    slots,
    localeClaims: claims,
  });
};
