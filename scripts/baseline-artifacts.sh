#!/usr/bin/env bash
# Gemeinsame Regeln fuer die erzeugten Baseline-Dateien.
#
# Drei Dinge stehen hier, weil sie sonst zwischen test-db.sh und wiki-db.sh
# auseinanderlaufen wuerden:
#
#   1. die REIHENFOLGE, in der die Rechte-Schnappschuesse eingespielt werden,
#   2. die PRUEFUNG, dass alle eingespielten Dateien aus DERSELBEN Auffrischung
#      stammen,
#   3. die Sperre, die (2) waehrend des Einspielens haelt.
#
# Zu (2): jede Datei traegt fuer sich einen ACL-Fingerprint und prueft ihn nach
# dem Einspielen selbst. Das faengt aber nur ab, ob eine Datei zur DATENBANK
# passt — nicht, ob die Dateien ZUEINANDER passen. Ein halb abgebrochenes
# Veroeffentlichen (neues schema.sql, altes function-grants.sql) bliebe
# unbemerkt. Deshalb schreibt refresh-test-baseline.sh die SHA-256 aller
# Artefakte samt einer daraus abgeleiteten `generation` ins Manifest, und hier
# wird gegengeprueft.

# Die Menge, die eine vollstaendige Generation ausmacht. Weder mehr noch
# weniger: eine fehlende Datei ist ein Abbruch, eine zusaetzliche auch. Sonst
# koennte ein Manifest mit drei statt vier Eintraegen als "vollstaendig
# geprueft" durchgehen.
BASELINE_ARTIFACTS="schema.sql table-grants.sql sequence-grants.sql function-grants.sql"

# Anwendungsreihenfolge. Nicht beliebig: grants.sql legt die statischen
# Voraussetzungen, danach setzt jeder Schnappschuss sein eigenes Feld zuerst
# zurueck (REVOKE) und baut es neu auf. Deshalb ist jede Datei fuer sich
# wiederholbar, und die Gruppe ist es auch.
baseline_privilege_files() {
  local base="$1"
  printf '%s\n' \
    "$base/grants.sql" \
    "$base/table-grants.sql" \
    "$base/sequence-grants.sql" \
    "$base/function-grants.sql"
}

# Gemeinsame Sperre mit refresh-test-baseline.sh. Der Leser haelt sie GETEILT
# (mehrere Testlaeufe stoeren einander nicht), das Auffrischen EXKLUSIV. Ohne
# das koennte mitten im Einspielen veroeffentlicht werden — die Hashes waeren
# dann bereits geprueft, die Dateien darunter aber ausgetauscht.
#
# Der Deskriptor bleibt absichtlich offen: die Sperre soll bis zum Ende des
# aufrufenden Skripts halten, nicht nur bis zum Ende dieser Funktion.
baseline_read_lock() {
  local base="$1"
  exec 8>"$base/.baseline.lock"
  if ! flock -w 120 -s 8; then
    echo "REFUSING (baseline-lock): Auffrischung laeuft seit ueber 120s." >&2
    return 1
  fi
}

# Prueft die Generation. Fehlende Hashes gelten NICHT als Erfolg: das Manifest
# muss den Uebergangszustand dann ausdruecklich erklaeren
# (`artifact_verification: "pending-first-refresh"`), und selbst dann wird
# laut gewarnt. Ein stilles rc=0 waere genau die Pruefung, die besteht, weil
# sie nichts prueft.
verify_baseline_artifacts() {
  local base="$1"
  local manifest="$base/parity-manifest.json"

  if [ ! -f "$manifest" ]; then
    echo "REFUSING (baseline-generation): $manifest fehlt." >&2
    return 1
  fi

  BASELINE_ARTIFACTS="$BASELINE_ARTIFACTS" python3 - "$base" "$manifest" <<'PY'
import hashlib, json, os, sys

base, manifest_pfad = sys.argv[1], sys.argv[2]
erwartete = set(os.environ["BASELINE_ARTIFACTS"].split())

try:
    manifest = json.load(open(manifest_pfad))
except (ValueError, OSError) as fehler:
    raise SystemExit(f"REFUSING (baseline-generation): Manifest unlesbar: {fehler}")

artefakte = manifest.get("artifacts")
uebergang = False

if not artefakte:
    # UEBERGANG. Auch hier wird geprueft, nur gegen eine andere, ebenfalls
    # festgeschriebene Menge: die drei Dateien des Laufs vor der
    # Hash-Veroeffentlichung. Ein Zustand ohne jede Pruefung gibt es nicht.
    if manifest.get("artifact_verification") != "pending-first-refresh":
        raise SystemExit(
            "REFUSING (baseline-generation): Manifest fuehrt keine "
            "Artefakt-Hashes und erklaert den Zustand auch nicht "
            "(artifact_verification != 'pending-first-refresh').")
    artefakte = manifest.get("legacy_artifacts")
    if not artefakte:
        raise SystemExit(
            "REFUSING (baseline-generation): Uebergangszustand ohne "
            "legacy_artifacts — es gaebe nichts zu pruefen.")
    # Im Uebergang gibt es sequence-grants.sql noch nicht. Genau diese eine
    # Ausnahme ist erlaubt, und sie ist belegt: die Datei darf dann auch NICHT
    # da sein.
    erwartete = erwartete - {"sequence-grants.sql"}
    if os.path.exists(os.path.join(base, "sequence-grants.sql")):
        raise SystemExit(
            "REFUSING (baseline-generation): sequence-grants.sql existiert, "
            "aber das Manifest steht noch auf pending-first-refresh.")
    uebergang = True

if not isinstance(artefakte, dict):
    raise SystemExit("REFUSING (baseline-generation): artifacts ist kein Objekt.")

gefunden = set(artefakte)
fehlt, zuviel = erwartete - gefunden, gefunden - erwartete
if fehlt or zuviel:
    teile = []
    if fehlt:
        teile.append("fehlt: " + ", ".join(sorted(fehlt)))
    if zuviel:
        teile.append("unerwartet: " + ", ".join(sorted(zuviel)))
    raise SystemExit(
        "REFUSING (baseline-generation): Artefaktmenge stimmt nicht — "
        + "; ".join(teile))

fehler = []
for name in sorted(artefakte):
    # Ein Artefaktname ist ein Dateiname, kein Pfad. Sonst zeigte das Manifest
    # auf etwas ausserhalb von baseline/.
    if name != os.path.basename(name) or name in (".", ".."):
        fehler.append(f"{name}: unzulaessiger Artefaktname (Pfadanteil)")
        continue
    erwartet = artefakte[name]
    if not isinstance(erwartet, str) or len(erwartet) != 64:
        fehler.append(f"{name}: Hash ist kein SHA-256")
        continue
    pfad = os.path.join(base, name)
    if not os.path.exists(pfad):
        fehler.append(f"{name}: im Manifest gefuehrt, aber nicht vorhanden")
        continue
    with open(pfad, "rb") as fh:
        ist = hashlib.sha256(fh.read()).hexdigest()
    if ist != erwartet:
        fehler.append(f"{name}: SHA-256 {ist[:12]}… erwartet {erwartet[:12]}…")

if fehler:
    raise SystemExit(
        "REFUSING (baseline-generation): Artefakte stammen nicht aus einer "
        "Auffrischung:\n  - " + "\n  - ".join(fehler))

# Die `generation` wird nicht geglaubt, sondern nachgerechnet. Sonst waere sie
# eine Beschriftung statt eines Belegs.
soll = hashlib.sha256(
    "".join(artefakte[k] for k in sorted(artefakte)).encode()).hexdigest()[:16]
schluessel = "legacy_generation" if uebergang else "generation"
ist_gen = manifest.get(schluessel)
if ist_gen != soll:
    raise SystemExit(
        f"REFUSING (baseline-generation): {schluessel} '{ist_gen}' passt nicht "
        f"zu den Hashes (erwartet '{soll}').")

if uebergang:
    print(f"    ⚠ UEBERGANGSZUSTAND (legacy generation {soll}): "
          f"{len(artefakte)} Artefakt(e) geprueft, aber sequence-grants.sql")
    print("      fehlt noch — Sequenzrechte kommen pauschal aus grants.sql und")
    print("      koennen grosszuegiger sein als die Produktion. Der erste Lauf")
    print("      von scripts/refresh-test-baseline.sh hebt das auf.")
else:
    print(f"    Generation {soll}: {len(artefakte)} Artefakt(e) unveraendert.")
PY
}

# Prueft supabase-test/baseline/grants.sql gegen eine LITERALE Erlaubnisliste —
# und beantwortet dabei die Frage, an der die beiden Aufrufer haengen: vergibt
# diese Datei Sequenzrechte scope-weit?
#
# ── Warum weder Lexer noch Muster ───────────────────────────────────────────
#
# Diese Pruefung war schon dreimal etwas anderes, und dreimal gab es einen
# Beleg, dass sie danebenlag:
#
#   A.4.2 — `grep` ueber den ganzen Dateiinhalt. Ein ZITAT im Kommentar zaehlte
#     wie Code und blockierte das Tor. Zweimal passiert.
#   A.4.3 — ein von Hand geschriebener PostgreSQL-Lexer. Er kannte `$é$` nicht
#     als gueltigen Dollar-Tag (PostgreSQL erlaubt Nicht-ASCII in Bezeichnern);
#     ein echter `GRANT … ON ALL SEQUENCES` zwischen zwei solchen Literalen
#     verschwand in dem, was der Lexer fuer einen Kommentar hielt.
#   A.4.3.2 — eine enge Grammatik, aber mit Normalisierung und Mustern. Zwei
#     Loecher, beide nachgewiesen:
#       - Pythons `\s`, `strip()` und `splitlines()` kennen Unicode-Leerraum,
#         PostgreSQLs SQL-Lexer nicht. Ein NBSP mitten in der kanonischen Zeile
#         wurde wegnormalisiert und die Datei galt als sauberer Endzustand,
#         obwohl PostgreSQL an dieser Zeile mit einem Syntaxfehler abbraeche.
#       - `^grant\b.*\bon all sequences\b.*;$` nahm auch Unsinn an:
#         `grant nonsense on all sequences nonsense;` galt als belegter
#         Uebergang. Vier weitere kaputte Fassungen ebenso.
#
# Das Muster hinter allen dreien ist dasselbe: eine ANNAEHERUNG an PostgreSQL
# wird als Wahrheit genommen. Deshalb wird hier nicht mehr angenaehert. Die
# Datei ist eingefroren; also wird auf GLEICHHEIT geprueft, Zeichen fuer
# Zeichen, ohne Normalisierung, ohne Kleinschreibung, ohne Muster.
#
# ── Die Erlaubnisliste ──────────────────────────────────────────────────────
#
# Eine physische Zeile (getrennt an LF; ein CR gilt als Steuerzeichen und damit
# als Fehler) darf genau eines von vier Dingen sein:
#
#   1. leer — nur ASCII-Leerzeichen und Tabulatoren
#   2. eine GANZE Kommentarzeile: nach ASCII-Leerzeichen/Tabulatoren beginnt
#      `--`. Der Text DAHINTER darf Unicode enthalten (die Erklaerungen in
#      grants.sql brauchen ihn), aber keine Steuerzeichen.
#   3. buchstabengetreu, genau einmal:
#        grant usage on schema public to anon, authenticated, service_role;
#   4. buchstabengetreu, hoechstens einmal, die historische Uebergangszeile:
#        grant all privileges on all sequences in schema public to authenticated, service_role, anon;
#
# Zu 3 und 4 sind nur ASCII-Leerzeichen/Tabulatoren davor und dahinter
# erlaubt — sonst NICHTS. Kein `\s`, kein `strip()` ohne Argument, keine
# Kleinschreibung, keine Kommaglaettung: jede dieser Bequemlichkeiten war schon
# einmal das Loch. Eine Grossschreibung, eine andere Rollenreihenfolge oder ein
# zusaetzliches Leerzeichen ergeben rc=2 — nicht weil sie gefaehrlich waeren,
# sondern weil diese Datei eingefroren ist und jede Abweichung eine bewusste
# Entscheidung sein muss.
#
# ── Rueckgabe ───────────────────────────────────────────────────────────────
#
#   0  die historische Uebergangszeile ist da (belegter Uebergangszustand)
#   1  die Datei ist exakt der saubere Endzustand — kein Sequenz-GRANT
#   2  alles andere
#
# rc=2 heisst NICHT "es gibt sicher einen scope-weiten GRANT". Es heisst: diese
# eingefrorene Rechtedatei ist nicht mehr die, fuer die sie gehalten wird — und
# darueber, was sie stattdessen tut, wird nichts behauptet.
#
# Die beiden Aufrufer behandeln rc=2 UNTERSCHIEDLICH, und das ist Absicht:
#   - baseline_check_sequence_transition (test-db.sh, wiki-db.sh) VERWEIGERT.
#     Dort steht ein `DROP SCHEMA` dahinter; Unklarheit darf nicht starten.
#   - refresh-test-baseline.sh laeuft am Ende weiter (Exit 0) und WARNT laut.
#     Die Aufnahme ist an der Stelle bereits veroeffentlicht und gueltig; sie
#     nachtraeglich als gescheitert zu melden waere falsch. Das Tor zieht
#     ohnehin beim naechsten Start des Teststapels.
#
# Bauform: der Auswerter meldet sein Urteil als WORT auf stdout und endet mit 0.
# Meldete er es ueber den Exit-Code, saehe ein abgestuerzter Python-Lauf
# (Exit 1) aus wie "kein Fund" — ein Auswertungsfehler waere dann seine eigene
# Unbedenklichkeitsbescheinigung. So faellt alles Unerwartete auf 2.
baseline_has_blanket_sequence_grant() {
  local datei="${1:-}" urteil

  if [ -z "$datei" ] || [ ! -f "$datei" ] || [ ! -r "$datei" ]; then
    echo "REFUSING (grants-grammar): '$datei' fehlt oder ist unlesbar." >&2
    return 2
  fi

  urteil="$(python3 - "$datei" <<'PY'
import sys

# Die beiden einzigen ausfuehrbaren Zeilen, die diese Datei haben darf.
# Buchstabengetreu — sie werden verglichen, nicht ausgedeutet.
KANONISCH = "grant usage on schema public to anon, authenticated, service_role;"
UEBERGANG = ("grant all privileges on all sequences in schema public "
             "to authenticated, service_role, anon;")

# Der einzige Leerraum, den PostgreSQL und diese Pruefung gleichermassen als
# Leerraum lesen. Alles andere — NBSP, EM SPACE, NARROW NBSP, OGHAM SPACE,
# IDEOGRAPHIC SPACE — ist fuer PostgreSQL ein gewoehnliches Zeichen und fuehrt
# dort zum Syntaxfehler. Python wuerde es ohne diese Einschraenkung wegputzen.
LEERRAUM = " \t"

def urteil(wort, grund=None):
    if grund:
        print("grants-grammar: " + grund, file=sys.stderr)
    print(wort)
    raise SystemExit(0)

def ausserhalb(grund):
    urteil("UNENTSCHEIDBAR", grund)

pfad = sys.argv[1]
try:
    with open(pfad, "rb") as fh:
        roh = fh.read()
except OSError as fehler:
    ausserhalb("%s nicht lesbar: %s" % (pfad, fehler))

try:
    quelle = roh.decode("utf-8")
except UnicodeDecodeError as fehler:
    ausserhalb("kein gueltiges UTF-8 (Byte %d)." % fehler.start)

# Steuerzeichen zuerst, ueber die GANZE Datei. Zweck: alles ausschliessen, was
# eine Zeilengrenze verschieben oder Inhalt verbergen koennte, bevor ueberhaupt
# in Zeilen zerlegt wird. NUL steht hier mit drin, ebenso CR (also CRLF), NEL
# und die Unicode-Zeilentrenner U+2028/U+2029 — Pythons `splitlines()` wuerde
# an denen trennen, `split("\n")` nicht, und genau aus solchen Unterschieden
# entsteht eine Zeile, die der Pruefer anders sieht als der Server.
for stelle, zeichen in enumerate(quelle):
    nummer = ord(zeichen)
    if zeichen in ("\t", "\n"):
        continue
    if nummer < 0x20 or nummer == 0x7F:
        ausserhalb("Steuerzeichen U+%04X an Position %d." % (nummer, stelle))
    if 0x80 <= nummer <= 0x9F:
        ausserhalb("C1-Steuerzeichen U+%04X an Position %d." % (nummer, stelle))
    if nummer in (0x2028, 0x2029):
        ausserhalb("Unicode-Zeilentrenner U+%04X an Position %d." % (nummer, stelle))

kanonisch = uebergang = 0

for nr, zeile in enumerate(quelle.split("\n"), 1):
    rein = zeile.strip(LEERRAUM)     # NUR ASCII-Leerzeichen und Tabulatoren
    if rein == "":
        continue
    if rein.startswith("--"):        # ganze Kommentarzeile, Text frei
        continue
    if rein == KANONISCH:
        kanonisch += 1
        continue
    if rein == UEBERGANG:
        uebergang += 1
        continue

    fremd = sorted({"U+%04X" % ord(z) for z in rein if ord(z) > 0x7F})
    hinweis = ""
    if fremd:
        hinweis = (" Sie enthaelt Nicht-ASCII-Zeichen (%s); auf einer "
                   "ausfuehrbaren Zeile ist ausschliesslich ASCII zugelassen."
                   % ", ".join(fremd[:4]))
    ausserhalb("Zeile %d ist keine der beiden erlaubten Anweisungen und auch "
               "keine ganze Kommentarzeile.%s" % (nr, hinweis))

if kanonisch == 0:
    ausserhalb("die kanonische schema-USAGE-Anweisung fehlt (buchstabengetreu "
               "erwartet). Ohne sie erreicht keine Rolle die Tabellen, und die "
               "Datei ist nicht die, fuer die sie gehalten wird.")
if kanonisch > 1:
    ausserhalb("die kanonische schema-USAGE-Anweisung steht %d mal." % kanonisch)
if uebergang > 1:
    ausserhalb("%d Uebergangszeilen — es darf hoechstens eine geben." % uebergang)

urteil("PAUSCHAL" if uebergang else "KEIN-PAUSCHAL")
PY
)" || {
    echo "REFUSING (grants-grammar): $datei liess sich nicht auswerten." >&2
    return 2
  }

  case "$urteil" in
    PAUSCHAL)      return 0 ;;
    KEIN-PAUSCHAL) return 1 ;;
    UNENTSCHEIDBAR)
       echo "REFUSING (grants-grammar): $datei liegt ausserhalb der erlaubten" >&2
       echo "  Grammatik (Grund oben). Ob dort scope-weite Sequenzrechte" >&2
       echo "  vergeben werden, bleibt damit offen." >&2
       return 2 ;;
    *) echo "REFUSING (grants-grammar): unerwartetes Urteil zu $datei." >&2
       return 2 ;;
  esac
}

# Der Uebergang bei den Sequenzrechten hat genau EINEN Ausgang: sobald der
# Schnappschuss existiert, muss der pauschale GRANT aus grants.sql weg. Beides
# gleichzeitig hiesse, Sequenzrechte erst exakt zu setzen und danach wieder
# pauschal aufzureissen — die Reihenfolge in baseline_privilege_files macht
# grants.sql zwar zum ersten, aber darauf soll sich niemand verlassen muessen.
baseline_check_sequence_transition() {
  local base="$1"
  local grants="$base/grants.sql"
  local hat_pauschal scan_rc=0

  # Geprueft wird mit der gemeinsamen Funktion, nicht mit einem eigenen Muster:
  # ein zweiter Sucher an einer zweiten Stelle ist genau die Bauform, aus der
  # die bisherigen Fehlurteile entstanden sind. rc=2 heisst "die Datei liegt
  # ausserhalb der erlaubten Grammatik" — hier wird das zur Absage, denn
  # dahinter steht ein `DROP SCHEMA`. Unklarheit darf nicht starten.
  baseline_has_blanket_sequence_grant "$grants" || scan_rc=$?
  case "$scan_rc" in
    0) hat_pauschal=1 ;;
    1) hat_pauschal=0 ;;
    *) echo "REFUSING (sequence-transition): $grants liegt ausserhalb der" >&2
       echo "  erlaubten Grammatik einer statischen Rechtedatei — ob dort" >&2
       echo "  Sequenzrechte scope-weit vergeben werden, bleibt offen." >&2
       return 1 ;;
  esac

  if [ -f "$base/sequence-grants.sql" ]; then
    if [ "$hat_pauschal" = "1" ]; then
      echo "REFUSING (sequence-transition): sequence-grants.sql existiert, aber" >&2
      echo "  grants.sql vergibt Sequenzrechte weiterhin pauschal. Beide zugleich" >&2
      echo "  sind widerspruechlich: der Schnappschuss setzt Sequenzrechte selbst" >&2
      echo "  zurueck und neu, der Pauschal-GRANT behauptet daneben etwas anderes." >&2
      echo "  Welche Zeile am Ende gilt, haengt dann allein an der Anwendungs-" >&2
      echo "  reihenfolge — und darauf soll sich niemand verlassen muessen." >&2
      echo "  Die Zeile in grants.sql muss geloescht werden." >&2
      return 1
    fi
  else
    if [ "$hat_pauschal" = "0" ]; then
      echo "REFUSING (sequence-transition): weder sequence-grants.sql noch der" >&2
      echo "  pauschale Sequenz-GRANT in grants.sql — Sequenzrechte waeren gar" >&2
      echo "  nicht gesetzt." >&2
      return 1
    fi
  fi
}

# Ist das Manifest im BELEGTEN Uebergangszustand? Nur dann darf
# sequence-grants.sql fehlen. Die Antwort kommt aus dem Manifest, nicht aus dem
# Dateisystem: "Datei ist nicht da" ist keine Begruendung dafuer, dass sie nicht
# da sein darf.
baseline_is_documented_legacy() {
  local base="$1"
  python3 - "$base/parity-manifest.json" <<'PY'
import json, sys
try:
    m = json.load(open(sys.argv[1]))
except Exception:
    raise SystemExit(1)
raise SystemExit(0 if (m.get("artifact_verification") == "pending-first-refresh"
                       and m.get("legacy_artifacts")
                       and m.get("legacy_generation")) else 1)
PY
}

# Wendet die Rechte-Dateien in der festgelegten Reihenfolge an. Fehlt eine, ist
# das ein Abbruch — mit genau einer Ausnahme: `sequence-grants.sql`, und auch
# die nur, wenn das Manifest den Uebergangszustand BELEGT. Ein pauschales
# `[ -f ] || continue` wuerde dagegen jede fehlende Datei hinnehmen, und ein
# blosses "die Datei ist halt nicht da" waere seine eigene Rechtfertigung.
baseline_apply_privileges() {
  local base="$1"; shift
  local datei
  while IFS= read -r datei; do
    if [ ! -r "$datei" ]; then
      case "$datei" in
        */sequence-grants.sql)
          if baseline_is_documented_legacy "$base"; then
            echo "    (sequence-grants.sql fehlt — belegter Uebergangszustand)"
            continue
          fi
          echo "REFUSING (baseline-apply): sequence-grants.sql fehlt, und das" >&2
          echo "  Manifest belegt keinen Uebergangszustand." >&2
          return 1 ;;
        *)
          echo "REFUSING (baseline-apply): $datei fehlt oder ist unlesbar." >&2
          return 1 ;;
      esac
    fi
    "$@" "$datei" || return 1
  done < <(baseline_privilege_files "$base")
}

# Reihenfolge der Veroeffentlichung, als Daten statt als Ablauf — damit der Test
# sie nicht abschreiben muss, sondern dieselbe Quelle liest.
#
# Manifest ZUERST: bricht der Lauf zwischen zwei Renames ab, nennt das
# veroeffentlichte Manifest Hashes, die auf der Platte niemand hat, und die
# Pruefung verweigert. Andersherum gaebe es ein Fenster — nach der letzten
# Datei, vor dem Manifest —, in dem ein altes Manifest mit alten Hashes auf vier
# bereits neuen Dateien liegt und wie ein gueltiger aelterer Stand aussieht.
# Fingerprint eines pg_dump-Laufs, um zwei Aufnahmen zu vergleichen.
#
# Der Dump IST die Drift-Sonde fuers Schema. Ein Fingerprint aus Spalten-,
# Policy- und Funktionsnamen reicht dafuer nicht: Funktionsrumpf, SECURITY
# DEFINER, search_path, policy USING/WITH CHECK, Sichten, Trigger, Constraints,
# Indizes, Enum-Werte und RLS-Schalter stehen dort gar nicht drin.
#
# Normalisiert wird NUR das nachweislich Nichtdeterministische: die beiden
# Versionszeilen im Kopf. Alles andere muss bei gleichem Schema gleich sein —
# und wenn nicht, ist das ein Fund und kein Rauschen.
baseline_dump_fingerprint() {  # $1 = Dumpdatei → SHA-256 auf stdout
  grep -v -E '^-- Dumped (from database|by pg_dump) version ' "$1" \
    | sha256sum | cut -d' ' -f1
}

baseline_publish_order() {
  local stage="$1" base="$2" name
  printf '%s\t%s\n' "$stage/parity-manifest.json" "$base/parity-manifest.json"
  for name in $BASELINE_ARTIFACTS; do
    printf '%s\t%s\n' "$stage/$name" "$base/$name"
  done
}

# Veroeffentlicht die Buehne. Die Rechte werden VOR dem ersten Rename gesetzt:
# `umask 077` schuetzt den unsanitisierten Zwischenstand, aber veroeffentlicht
# wird in ein Repository, das CI und Container lesen. Erst umbenennen und dann
# `chmod` liesse ein Fenster offen, in dem eine veroeffentlichte Generation 0600
# ist — und ein Lesefehler sieht aus wie ein fehlendes Artefakt.
baseline_publish() {
  local stage="$1" base="$2" quelle ziel
  while IFS="$(printf '\t')" read -r quelle ziel; do
    [ -f "$quelle" ] || { echo "REFUSING (baseline-publish): $quelle fehlt." >&2; return 1; }
    chmod 0644 "$quelle" || return 1
  done < <(baseline_publish_order "$stage" "$base")

  while IFS="$(printf '\t')" read -r quelle ziel; do
    mv -f "$quelle" "$ziel" || return 1
  done < <(baseline_publish_order "$stage" "$base")
}
