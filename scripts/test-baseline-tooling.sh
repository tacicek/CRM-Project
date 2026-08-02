#!/usr/bin/env bash
# Tests fuer das Baseline-Werkzeug (refresh-test-baseline.sh, baseline-artifacts.sh,
# baseline-sanitize.py, baseline-manifest.py).
#
# Warum es diese Datei gibt: die Schutzmassnahmen dieses Werkzeugs sind alle
# Fehlerpfade — falsche Instanz, halb veroeffentlichte Generation, unvollstaendige
# Sanitisierung. Genau die laufen im Normalbetrieb nie, und was nie laeuft,
# verrottet.
#
# KEINE Verbindung nach aussen: `ssh` wird durch eine Attrappe ersetzt, die die
# Aufrufe protokolliert. Keine Datenbank noetig.
#
#   bash scripts/test-baseline-tooling.sh
#   npm run test:baseline

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
. scripts/baseline-artifacts.sh

ARBEIT="$(mktemp -d)"
trap 'chmod -R u+rwX "$ARBEIT" 2>/dev/null; rm -rf "$ARBEIT"' EXIT

BESTANDEN=0
GESCHEITERT=0

ok()   { BESTANDEN=$((BESTANDEN+1)); printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() { GESCHEITERT=$((GESCHEITERT+1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; [ -n "${2:-}" ] && printf '       %s\n' "$2"; return 0; }

erwartet_rc() {  # <soll-rc> <beschreibung> <kommando...>
  local soll="$1" was="$2"; shift 2
  local ausgabe ist
  ausgabe="$("$@" 2>&1)"; ist=$?
  if [ "$ist" = "$soll" ]; then ok "$was"
  else fail "$was" "rc=$ist (erwartet $soll): $(printf '%s' "$ausgabe" | head -1)"; fi
}

gleich() {  # <soll> <ist> <beschreibung>
  if [ "$1" = "$2" ]; then ok "$3"; else fail "$3" "ist '$2', erwartet '$1'"; fi
}

# ── Attrappen-Baseline ──────────────────────────────────────────────────────
attrappe() {  # $1 = Verzeichnis, $2 = "voll" | "legacy"
  local d="$1" art="$2"
  mkdir -p "$d"
  echo 'grant usage on schema public to anon, authenticated, service_role;' > "$d/grants.sql"
  local namen="schema.sql table-grants.sql function-grants.sql"
  [ "$art" = "voll" ] && namen="$namen sequence-grants.sql"
  [ "$art" = "legacy" ] && \
    echo 'grant all privileges on all sequences in schema public to authenticated, service_role, anon;' >> "$d/grants.sql"
  local n; for n in $namen; do echo "inhalt-$n" > "$d/$n"; done
  ART="$art" NAMEN="$namen" python3 - "$d" <<'PY'
import hashlib, json, os, sys
d = sys.argv[1]
namen = os.environ["NAMEN"].split()
a = {n: hashlib.sha256(open(os.path.join(d, n), "rb").read()).hexdigest() for n in namen}
gen = hashlib.sha256("".join(a[k] for k in sorted(a)).encode()).hexdigest()[:16]
m = ({"artifacts": a, "generation": gen} if os.environ["ART"] == "voll" else
     {"artifact_verification": "pending-first-refresh",
      "legacy_artifacts": a, "legacy_generation": gen})
json.dump(m, open(os.path.join(d, "parity-manifest.json"), "w"), indent=2)
PY
}

manifest_patch() {  # $1 = Verzeichnis, $2 = python-Ausdruck auf `m`
  python3 - "$1/parity-manifest.json" "$2" <<'PY'
import json, sys
p = sys.argv[1]; m = json.load(open(p)); exec(sys.argv[2])
json.dump(m, open(p, "w"), indent=2)
PY
}

echo
echo "── Artefakt-Generation ────────────────────────────────────────────────"

attrappe "$ARBEIT/voll" voll
erwartet_rc 0 "vollstaendige Generation wird angenommen" verify_baseline_artifacts "$ARBEIT/voll"

attrappe "$ARBEIT/gen" voll
manifest_patch "$ARBEIT/gen" "m['generation']='deadbeefdeadbeef'"
erwartet_rc 1 "falsche generation wird abgelehnt" verify_baseline_artifacts "$ARBEIT/gen"

attrappe "$ARBEIT/hash" voll
echo "manipuliert" > "$ARBEIT/hash/schema.sql"
erwartet_rc 1 "veraenderte Datei wird abgelehnt" verify_baseline_artifacts "$ARBEIT/hash"

attrappe "$ARBEIT/fehlt" voll
manifest_patch "$ARBEIT/fehlt" "del m['artifacts']['sequence-grants.sql']"
erwartet_rc 1 "fehlendes Artefakt im Manifest wird abgelehnt" verify_baseline_artifacts "$ARBEIT/fehlt"

attrappe "$ARBEIT/zuviel" voll
manifest_patch "$ARBEIT/zuviel" "m['artifacts']['fremd.sql']='0'*64"
erwartet_rc 1 "zusaetzliches Artefakt wird abgelehnt" verify_baseline_artifacts "$ARBEIT/zuviel"

attrappe "$ARBEIT/pfad" voll
manifest_patch "$ARBEIT/pfad" "m['artifacts']['../schema.sql']=m['artifacts'].pop('schema.sql')"
erwartet_rc 1 "Artefaktname mit Pfadanteil wird abgelehnt" verify_baseline_artifacts "$ARBEIT/pfad"

attrappe "$ARBEIT/weg" voll
rm "$ARBEIT/weg/function-grants.sql"
erwartet_rc 1 "im Manifest gefuehrte, fehlende Datei wird abgelehnt" verify_baseline_artifacts "$ARBEIT/weg"

attrappe "$ARBEIT/kaputt" voll
echo 'kein json' > "$ARBEIT/kaputt/parity-manifest.json"
erwartet_rc 1 "unlesbares Manifest wird abgelehnt" verify_baseline_artifacts "$ARBEIT/kaputt"

echo
echo "── Uebergangszustand (legacy) ─────────────────────────────────────────"

attrappe "$ARBEIT/leg" legacy
erwartet_rc 0 "belegter Uebergang wird angenommen" verify_baseline_artifacts "$ARBEIT/leg"

attrappe "$ARBEIT/leg_nohash" legacy
manifest_patch "$ARBEIT/leg_nohash" "del m['legacy_artifacts']"
erwartet_rc 1 "Uebergang ohne legacy_artifacts wird abgelehnt" verify_baseline_artifacts "$ARBEIT/leg_nohash"

attrappe "$ARBEIT/leg_gen" legacy
manifest_patch "$ARBEIT/leg_gen" "m['legacy_generation']='0000000000000000'"
erwartet_rc 1 "falsche legacy_generation wird abgelehnt" verify_baseline_artifacts "$ARBEIT/leg_gen"

attrappe "$ARBEIT/leg_manip" legacy
echo "manipuliert" > "$ARBEIT/leg_manip/schema.sql"
erwartet_rc 1 "veraenderte Datei im Uebergang wird abgelehnt" verify_baseline_artifacts "$ARBEIT/leg_manip"

attrappe "$ARBEIT/leg_seq" legacy
echo "da" > "$ARBEIT/leg_seq/sequence-grants.sql"
erwartet_rc 1 "sequence-grants.sql trotz pending wird abgelehnt" verify_baseline_artifacts "$ARBEIT/leg_seq"

attrappe "$ARBEIT/leg_kein_marker" legacy
manifest_patch "$ARBEIT/leg_kein_marker" "del m['artifact_verification']"
erwartet_rc 1 "fehlende Hashes ohne Erklaerung werden abgelehnt" verify_baseline_artifacts "$ARBEIT/leg_kein_marker"

echo
echo "── Veroeffentlichung (echter baseline_publish) ────────────────────────"

# Erfolgsfall: die Funktion aus dem Produktionspfad, nicht nachgebaut.
P="$ARBEIT/pub"; attrappe "$P" legacy
mkdir -p "$P/.stage"
for n in $BASELINE_ARTIFACTS; do echo "NEU-$n" > "$P/.stage/$n"; chmod 0600 "$P/.stage/$n"; done
python3 - "$P" <<'PY'
import hashlib, json, os, sys
p = sys.argv[1]; st = os.path.join(p, ".stage")
namen = os.environ.get("BASELINE_ARTIFACTS", "").split() or [
    "schema.sql", "table-grants.sql", "sequence-grants.sql", "function-grants.sql"]
a = {n: hashlib.sha256(open(os.path.join(st, n), "rb").read()).hexdigest() for n in namen}
json.dump({"artifacts": a,
           "generation": hashlib.sha256("".join(a[k] for k in sorted(a)).encode()).hexdigest()[:16]},
          open(os.path.join(st, "parity-manifest.json"), "w"), indent=2)
PY
chmod 0600 "$P/.stage/parity-manifest.json"
erwartet_rc 0 "baseline_publish veroeffentlicht" baseline_publish "$P/.stage" "$P"
erwartet_rc 0 "veroeffentlichte Generation ist gueltig" verify_baseline_artifacts "$P"
modi="$(stat -c '%a' "$P/parity-manifest.json" "$P"/*.sql | sort -u | tr '\n' ' ')"
gleich "644 " "$modi" "alle veroeffentlichten Dateien sind 0644"

# Abbruch an jedem Rename-Punkt — die Reihenfolge kommt aus
# baseline_publish_order, wird also NICHT abgeschrieben.
anzahl="$(baseline_publish_order x y | wc -l)"
for schnitt in $(seq 0 "$anzahl"); do
  Z="$ARBEIT/pub$schnitt"; attrappe "$Z" legacy
  mkdir -p "$Z/.stage"
  for n in $BASELINE_ARTIFACTS; do echo "NEU-$n" > "$Z/.stage/$n"; done
  python3 - "$Z" "$BASELINE_ARTIFACTS" <<'PY'
import hashlib, json, os, sys
z, namen = sys.argv[1], sys.argv[2].split()
st = os.path.join(z, ".stage")
a = {n: hashlib.sha256(open(os.path.join(st, n), "rb").read()).hexdigest() for n in namen}
json.dump({"artifacts": a,
           "generation": hashlib.sha256("".join(a[k] for k in sorted(a)).encode()).hexdigest()[:16]},
          open(os.path.join(st, "parity-manifest.json"), "w"), indent=2)
PY
  schritt=0
  while IFS="$(printf '\t')" read -r quelle ziel; do
    [ $schritt -lt $schnitt ] || break
    mv -f "$quelle" "$ziel"; schritt=$((schritt+1))
  done < <(baseline_publish_order "$Z/.stage" "$Z")
  if [ "$schnitt" = "0" ] || [ "$schnitt" = "$anzahl" ]; then
    erwartet_rc 0 "Abbruch nach $schnitt/$anzahl Rename(s): gueltiger Zustand" verify_baseline_artifacts "$Z"
  else
    erwartet_rc 1 "Abbruch nach $schnitt/$anzahl Rename(s): gemischt → abgelehnt" verify_baseline_artifacts "$Z"
  fi
done

echo
echo "── grants.sql: literale Erlaubnisliste ────────────────────────────────"

# Diese Pruefung war dreimal etwas anderes und dreimal nachweislich falsch:
# `grep` (ein Zitat im Kommentar zaehlte wie Code), ein handgeschriebener
# SQL-Lexer (ein Nicht-ASCII-Dollar-Tag war ihm unbekannt, und ein echter GRANT
# verschwand zwischen zwei solchen Literalen), und zuletzt eine Grammatik mit
# Normalisierung — die Pythons Unicode-Begriff von Leerraum benutzte, den
# PostgreSQL nicht teilt, und deren Muster auch
# `grant nonsense on all sequences nonsense;` als belegten Uebergang durchwinkte.
#
# Jetzt wird verglichen statt ausgedeutet: zwei Zeilen sind buchstabengetreu
# erlaubt, sonst nur Leerzeilen und ganze Kommentarzeilen.
G="$ARBEIT/grammatik"; mkdir -p "$G"
KANON='grant usage on schema public to anon, authenticated, service_role;'
LEGACY='grant all privileges on all sequences in schema public to authenticated, service_role, anon;'

# Die Faelle entstehen aus PYTHON-Ausdruecken mit ESCAPE-Sequenzen, nicht aus
# wortwoertlichen Zeichen. Grund: ein NBSP sieht im Editor aus wie ein
# Leerzeichen. Stuende er hier als Zeichen, koennte ein Editor, ein
# Copy-Paste oder eine Autoformatierung ihn stillschweigend in ein
# ASCII-Leerzeichen verwandeln — der Test bestuende weiter und pruefte nichts
# mehr. Als \u00a0 im Ausdruck ist er dagegen immun.
grammatik_schreiben() {  # $1 = Zieldatei, $2 = Ausdruck ueber K und L
  python3 - "$1" "$2" <<'PY'
import sys
ziel, ausdruck = sys.argv[1], sys.argv[2]
K = "grant usage on schema public to anon, authenticated, service_role;"
L = ("grant all privileges on all sequences in schema public "
     "to authenticated, service_role, anon;")
wert = eval(ausdruck, {"__builtins__": {"bytes": bytes}, "K": K, "L": L})
with open(ziel, "wb") as fh:
    fh.write(wert if isinstance(wert, bytes) else wert.encode("utf-8"))
PY
}

grammatik_fall() {  # <soll-rc> <beschreibung> <python-Ausdruck>
  grammatik_schreiben "$G/grants.sql" "$3" || { fail "$2" "Fixture nicht erzeugt"; return 0; }
  erwartet_rc "$1" "$2" baseline_has_blanket_sequence_grant "$G/grants.sql"
}

# ── sauberer Endzustand (rc=1) ─────────────────────────────────────────────
grammatik_fall 1 "kanonische Anweisung allein" 'K'
grammatik_fall 1 "ASCII-Einrueckung um die Anweisung" '"  \t" + K + " \t"'
grammatik_fall 1 "Leerzeilen aus Leerzeichen und Tabulatoren" '"\n \t \n" + K + "\n\n"'
grammatik_fall 1 "ganze Kommentarzeilen" '"-- Statische Rechtegrundlage.\n--\n" + K'

# Der Kern der ganzen Reihe: die Datei ERKLAERT die entfernte Zeile.
grammatik_fall 1 "alte Anweisung im Kommentar zitiert" \
  '"-- Bis 2026-08-01 stand hier:\n--   " + L + "\n-- Die Zeile ist weg.\n" + K'

# Unicode im Kommentartext bleibt erlaubt — die echten Erklaerungen in
# grants.sql brauchen ihn (U+26A0, U+2026).
grammatik_fall 1 "Unicode NUR im Kommentartext" \
  '"-- \u26a0 Hinweis \u2026 mit Unicode\n" + K'

# ── belegter Uebergang (rc=0) ──────────────────────────────────────────────
grammatik_fall 0 "exakte historische Uebergangszeile" 'K + "\n" + L'
grammatik_fall 0 "Uebergangszeile mit ASCII-Einrueckung" 'K + "\n   " + L + "  "'

# ── Unicode-Leerraum: PostgreSQL liest ihn NICHT als Leerraum ──────────────
# Python schon — `\s`, `strip()` und `splitlines()` kennen ihn. Genau diese
# Diskrepanz liess bis A.4.3.2 eine Datei als sauberen Endzustand gelten, an
# der PostgreSQL mit einem Syntaxfehler abbraeche.
grammatik_fall 2 "NBSP U+00A0 in der Anweisung"      'K.replace(" schema ", "\u00a0schema ")'
grammatik_fall 2 "EM SPACE U+2003 in der Anweisung"  'K.replace(" public ", "\u2003public ")'
grammatik_fall 2 "NARROW NBSP U+202F"                'K.replace(" to ", "\u202fto ")'
grammatik_fall 2 "OGHAM SPACE U+1680"                'K.replace(" usage ", "\u1680usage ")'
grammatik_fall 2 "IDEOGRAPHIC SPACE U+3000"          'K.replace(" on ", "\u3000on ")'
grammatik_fall 2 "Unicode-Leerraum am Zeilenanfang"  '"\u00a0" + K'
grammatik_fall 2 "Unicode-Leerraum am Zeilenende"    'K + "\u00a0"'
grammatik_fall 2 "Unicode-Leerraum um das Komma"     'K.replace(", authenticated", ",\u00a0authenticated")'
grammatik_fall 2 "NBSP-eingerueckte Kommentarzeile"  '"\u00a0-- Notiz\n" + K'

# ── kaputte Uebergangszeilen: frueher als "belegt" durchgewunken ───────────
# Das alte Muster nahm jede dieser Zeilen an. Keine davon ist gueltiges SQL
# oder die historische Zeile.
grammatik_fall 2 "malformed: grant nonsense … nonsense;" \
  'K + "\ngrant nonsense on all sequences nonsense;"'
grammatik_fall 2 "malformed: ohne TO-Klausel" \
  'K + "\ngrant usage on all sequences in schema public;"'
grammatik_fall 2 "malformed: Tippfehler ot statt to" \
  'K + "\ngrant usage on all sequences in schema public ot anon;"'
grammatik_fall 2 "malformed: ohne IN SCHEMA" \
  'K + "\ngrant usage on all sequences to anon;"'
grammatik_fall 2 "malformed: Muell hinter der Anweisung" \
  'K + "\ngrant usage on all sequences in schema public to anon with grant option garbage;"'

# Auch die abgewandelte, syntaktisch gueltige Fassung ist nicht die historische
# Zeile — sie zu erlauben hiesse, wieder zu raten.
grammatik_fall 2 "Uebergangszeile mit anderer Rollenliste" \
  'K + "\ngrant usage on all sequences in schema public to anon;"'
grammatik_fall 2 "Uebergangszeile in Grossschreibung" 'K + "\n" + L.upper()'

# ── Steuerzeichen und Zeilentrenner ────────────────────────────────────────
# U+2028, U+0085 und CR sind fuer `splitlines()` Zeilenenden, fuer
# `split("\n")` nicht. Aus solchen Unterschieden entsteht eine Zeile, die der
# Pruefer anders sieht als der Server — deshalb alle als Fehler.
grammatik_fall 2 "NUL in einer Kommentarzeile"     '"-- Notiz\x00\n" + K'
grammatik_fall 2 "NUL auf der ausfuehrbaren Zeile" 'K[:-1] + "\x00;"'
grammatik_fall 2 "CR (CRLF-Datei)"                 'K + "\r\n"'
grammatik_fall 2 "U+2028 Zeilentrenner" \
  'K + "\u2028grant usage on all sequences in schema public to anon;"'
grammatik_fall 2 "U+0085 NEL"                      'K + "\u0085x"'
grammatik_fall 2 "ungueltiges UTF-8"               'bytes([0xff, 0xfe])'

# ── uebrige Anweisungen: nicht in der Liste, also draussen ─────────────────
grammatik_fall 2 "mehrzeilige Anweisung" \
  'K + "\ngrant usage\n  on all sequences in schema public to anon;"'
grammatik_fall 2 "GRANT auf eine benannte Sequenz" \
  'K + "\ngrant usage on sequence public.some_sequence to anon;"'
grammatik_fall 2 "GRANT EXECUTE ON FUNCTION" \
  'K + "\ngrant execute on function public.f() to anon;"'
grammatik_fall 2 "GRANT auf Tabellen" \
  'K + "\ngrant select on all tables in schema public to anon;"'
grammatik_fall 2 "Funktionsaufruf" 'K + "\nselect public.apply_privileges();"'
grammatik_fall 2 "Nicht-ASCII-Dollar-Tag um einen echten GRANT" \
  'K + "\nselect $\u00e9$/*$\u00e9$;\ngrant usage on all sequences in schema public to anon;\nselect $\u00e9$*/$\u00e9$;"'
grammatik_fall 2 "psql-Variableninterpolation :name" 'K + "\n:privilege_sql"'
grammatik_fall 2 "psql-Variableninterpolation, einfache Anfuehrungszeichen" \
  'K + "\nselect :\x27privilege_sql\x27;"'
grammatik_fall 2 "psql-Variableninterpolation, doppelte Anfuehrungszeichen" \
  'K + "\ngrant usage on schema :\x22public\x22 to anon;"'
grammatik_fall 2 "Blockkommentar"        'K + "\n/* Notiz */"'
grammatik_fall 2 "Kommentar hinter Code" 'K + " -- Notiz"'
grammatik_fall 2 "Zeichenkette auf ausfuehrbarer Zeile" \
  'K + "\ncomment on schema public is \x27grant all on all sequences\x27;"'
grammatik_fall 2 "zwei Anweisungen auf einer Zeile" 'K + " " + L'
grammatik_fall 2 "psql-Meta-Befehl \\gexec"   'K + "\n\\gexec"'
grammatik_fall 2 "psql-Meta-Befehl \\i"       'K + "\n\\i weitere-rechte.sql"'
grammatik_fall 2 "psql-Meta-Befehl \\ir"      'K + "\n\\ir weitere-rechte.sql"'
grammatik_fall 2 "psql-Meta-Befehl \\include" 'K + "\n\\include weitere-rechte.sql"'
grammatik_fall 2 "psql-Meta-Befehl \\copy"    'K + "\n\\copy x from stdin"'

# ── Zaehlung: die kanonische Zeile ist Pflicht und einmalig ────────────────
grammatik_fall 2 "kanonische Anweisung fehlt"   '"-- nur ein Kommentar"'
grammatik_fall 2 "leere Datei"                  '""'
grammatik_fall 2 "kanonische Anweisung doppelt" 'K + "\n" + K'
grammatik_fall 2 "zwei Uebergangszeilen"        'K + "\n" + L + "\n" + L'

# rc=2 heisst UNBEKANNT und ist von rc=1 verschieden. Waeren sie dasselbe,
# wuerde ein Lesefehler zur Unbedenklichkeitsbescheinigung.
erwartet_rc 2 "fehlende Datei → Fehler statt 'sauberer Endzustand'" \
  baseline_has_blanket_sequence_grant "$G/gibt-es-nicht.sql"
erwartet_rc 2 "leeres Argument → Fehler" baseline_has_blanket_sequence_grant ""

printf '%s\n' "$KANON" > "$G/grants.sql"; chmod 000 "$G/grants.sql"
if [ "$(id -u)" = "0" ]; then ok "unlesbare Datei → uebersprungen (root)"
else erwartet_rc 2 "unlesbare Datei → Fehler" \
  baseline_has_blanket_sequence_grant "$G/grants.sql"; fi
chmod 644 "$G/grants.sql"

# Gegenprobe zur Fixture-Bauweise selbst: enthaelt eine so erzeugte Datei
# wirklich den gemeinten Codepunkt? Ohne diese Zusicherung koennte die ganze
# Unicode-Reihe oben stillschweigend ASCII pruefen.
grammatik_schreiben "$G/probe.sql" 'K.replace(" schema ", "\u00a0schema ")'
gleich "U+00A0" "$(python3 -c 'import sys
s = open(sys.argv[1], encoding="utf-8").read()
print(", ".join(sorted({"U+%04X" % ord(z) for z in s if ord(z) > 0x7F})) or "keine")' "$G/probe.sql")" \
  "Fixture-Bau traegt den gemeinten Codepunkt (nicht ASCII)"

echo
echo "── Sequenz-Uebergang ──────────────────────────────────────────────────"

S="$ARBEIT/seq"; mkdir -p "$S"
seq_grants() { printf '%s\n' "$@" > "$S/grants.sql"; }

seq_grants "$KANON" "$LEGACY"
erwartet_rc 0 "kein Schnappschuss + Uebergangszeile → gueltig" baseline_check_sequence_transition "$S"
echo "da" > "$S/sequence-grants.sql"
erwartet_rc 1 "Schnappschuss + Uebergangszeile → abgelehnt" baseline_check_sequence_transition "$S"
seq_grants "$KANON"
erwartet_rc 0 "Schnappschuss ohne Uebergangszeile → gueltig" baseline_check_sequence_transition "$S"
rm "$S/sequence-grants.sql"
erwartet_rc 1 "weder Schnappschuss noch Uebergangszeile → abgelehnt" baseline_check_sequence_transition "$S"
rm "$S/grants.sql"
erwartet_rc 1 "fehlende grants.sql → abgelehnt" baseline_check_sequence_transition "$S"
seq_grants "$KANON"; chmod 000 "$S/grants.sql"
if [ "$(id -u)" = "0" ]; then ok "unlesbare grants.sql → uebersprungen (root)"
else erwartet_rc 1 "unlesbare grants.sql → abgelehnt" baseline_check_sequence_transition "$S"; fi
chmod 644 "$S/grants.sql"

# Dieselben Zustaende mit einem grants.sql, das die entfernte Zeile ERKLAERT —
# genau so sieht die echte Datei aus.
KOM="$ARBEIT/seq_kommentar"; mkdir -p "$KOM"
printf '%s\n' '-- Hier stand bis 2026-08-01:' "--   $LEGACY" \
  '-- Die Zeile ist weg; sequence-grants.sql setzt die Rechte jetzt exakt.' \
  "$KANON" > "$KOM/grants.sql"

rm -f "$KOM/sequence-grants.sql"
erwartet_rc 1 "kein Schnappschuss + Zeile nur im Kommentar → abgelehnt" \
  baseline_check_sequence_transition "$KOM"
echo "da" > "$KOM/sequence-grants.sql"
erwartet_rc 0 "Schnappschuss + Zeile nur im Kommentar → gueltig" \
  baseline_check_sequence_transition "$KOM"

# Jede rc=2-Lage muss beim Tor zur Absage werden — dahinter steht ein
# `DROP SCHEMA`, Unklarheit darf nicht starten.
transition_fall() {  # <soll-rc> <beschreibung> <python-Ausdruck>
  grammatik_schreiben "$KOM/grants.sql" "$3" || { fail "$2" "Fixture nicht erzeugt"; return 0; }
  erwartet_rc "$1" "$2" baseline_check_sequence_transition "$KOM"
}

rm -f "$KOM/sequence-grants.sql"
transition_fall 0 "kein Schnappschuss + exakte Uebergangszeile → gueltig" 'K + "\n" + L'

echo "da" > "$KOM/sequence-grants.sql"
transition_fall 1 "Schnappschuss + exakte Uebergangszeile → abgelehnt" 'K + "\n" + L'
transition_fall 1 "Schnappschuss + NBSP in der kanonischen Zeile → abgelehnt" \
  'K.replace(" schema ", "\u00a0schema ")'
transition_fall 1 "Schnappschuss + malformed Uebergangszeile → abgelehnt" \
  'K + "\ngrant nonsense on all sequences nonsense;"'
transition_fall 1 "Schnappschuss + USAGE-Variante → abgelehnt" \
  'K + "\ngrant usage on all sequences in schema public to anon;"'
transition_fall 1 "Schnappschuss + mehrzeilige Anweisung → abgelehnt" \
  'K + "\ngrant usage\n  on all sequences in schema public to anon;"'
transition_fall 1 "Schnappschuss + Funktionsaufruf → abgelehnt" \
  'K + "\nselect public.apply_privileges();"'
transition_fall 1 "Schnappschuss + CR im Dateiende → abgelehnt" 'K + "\r\n"'
transition_fall 1 "Schnappschuss + fehlende kanonische Zeile → abgelehnt" \
  '"-- leer bis auf diesen Kommentar"'
echo
echo "── Anwendungsschleife ─────────────────────────────────────────────────"

A="$ARBEIT/apply_voll"; attrappe "$A" voll
zaehler=0; zaehl() { zaehler=$((zaehler+1)); }
baseline_apply_privileges "$A" zaehl >/dev/null 2>&1
gleich 4 "$zaehler" "vollstaendige Generation: alle vier Dateien angewandt"

# Kernpunkt: ohne belegten Uebergang ist ein fehlendes sequence-grants.sql ein
# Abbruch — nicht "die Datei ist halt nicht da".
rm "$A/sequence-grants.sql"
erwartet_rc 1 "volles Manifest + fehlendes sequence-grants.sql → abgelehnt" \
  baseline_apply_privileges "$A" zaehl

B="$ARBEIT/apply_legacy"; attrappe "$B" legacy
zaehler=0
baseline_apply_privileges "$B" zaehl >/dev/null 2>&1
gleich 3 "$zaehler" "belegter Uebergang: fehlendes sequence-grants.sql erlaubt"

rm "$B/table-grants.sql"
erwartet_rc 1 "sonst fehlende Datei bricht die Anwendung ab" baseline_apply_privileges "$B" zaehl

echo
echo "── Sanitisierung (echte scripts/baseline-sanitize.py) ─────────────────"

cat > "$ARBEIT/sauber.txt" <<'EOF'
-- run daily via cron. legitime Prosa, kein Schemabezug
COMMENT ON FUNCTION public.f() IS 'nightly, run daily via cron.';
SELECT 'https://test.invalid'; SELECT 'test@test.invalid'; SELECT '127.0.0.1';
SELECT 'Bearer test-placeholder';
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) TO anon;
EOF
erwartet_rc 0 "sauberer Koerper: keine Fehlalarme" \
  python3 scripts/baseline-sanitize.py "$ARBEIT/sauber.txt"

# Jede Zeile hier hat eine frueher bestandene Pruefung ausgenutzt.
while IFS='|' read -r name inhalt; do
  [ -z "$name" ] && continue
  printf '%s\n' "$inhalt" > "$ARBEIT/schmutz.txt"
  erwartet_rc 1 "Umgehung erkannt: $name" \
    python3 scripts/baseline-sanitize.py "$ARBEIT/schmutz.txt"
done <<'EOF'
URL userinfo|SELECT 'https://test.invalid@evil.example/x';
URL userinfo prozentkodiert|SELECT 'https://test.invalid%40evil.example/x';
URL Klammer vor userinfo|SELECT 'https://test.invalid)@evil.example/path';
URL mit Pfad|SELECT 'https://test.invalid/secret-path';
URL Host-Verlaengerung|SELECT 'https://test.invalid.evil/x';
URL mit Port|SELECT 'https://test.invalid:8443';
URL mit Query|SELECT 'https://test.invalid?token=geheim';
URL mit Fragment|SELECT 'https://test.invalid#geheim';
URL escapte Schraegstriche|SELECT 'https:\/\/evil.example/path';
URL unicode-escapte Schraegstriche|SELECT 'https://evil.example/path';
URL prozent-escapte Schraegstriche|SELECT 'https:%2f%2fevil.example/path';
Bearer Punkt-Trenner|SELECT 'Bearer test-placeholder.real-secret';
Bearer Tilde-Trenner|SELECT 'Bearer test-placeholder~real-secret';
Bearer Prozent-Trenner|SELECT 'Bearer test-placeholder%real-secret';
Bearer Doppelpunkt-Trenner|SELECT 'Bearer test-placeholder:real-secret';
Bearer Fragezeichen-Trenner|SELECT 'Bearer test-placeholder?real-secret';
Bearer At-Trenner|SELECT 'Bearer test-placeholder@real-secret';
Bearer Slash-Anfang|SELECT 'Bearer /real-secret';
Bearer Plus-Anfang|SELECT 'Bearer +real-secret';
Bearer klein mit Prefix|SELECT 'bearer test-placeholder@geheim';
Bearer gross mit Prefix|SELECT 'BEARER test-placeholder.geheim';
Bearer gemischt|SELECT 'BeArEr echtes-geheimnis-hier';
E-Mail Host-Verlaengerung|SELECT 'test@test.invalid.evil';
IP-Verlaengerung|SELECT '127.0.0.100';
IP mit vierter Gruppe|SELECT '127.0.0.1.99';
IP fremd|SELECT '198.51.100.7';
OpenAI mit Unterstrich|SELECT 'sk-proj_ABCDEFGHIJKLMNOPQRSTUVWX';
Resend mit Bindestrich|SELECT 're_abcd-efgh-ijkl-mnop-qrst';
cron ausserhalb der drei|SELECT * FROM cron.job_run_details;
DSN mit Passwort|SELECT 'postgresql://u:geheim@db.example.com:5432/p';
JWT|SELECT 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc';
vault|SELECT * FROM vault.decrypted_secrets;
EOF

echo
echo "── Keine Geheimnisse in der Ausgabe ───────────────────────────────────"
# Der Fund darf nicht im Terminal landen: von dort geht er ins CI-Protokoll und
# von dort in ein Ticket.
cat > "$ARBEIT/geheim.txt" <<'EOF'
SELECT 'sk-ant-api03-KANARIENVOGEL1';
SELECT 'Bearer test-placeholder.KANARIENVOGEL2';
SELECT 'https://KANARIENVOGEL3.example/x';
SELECT 'postgresql://nutzer:KANARIENVOGEL4@db.example.com:5432/p';
SELECT 'KANARIENVOGEL5@example.com';
SELECT '198.51.100.77';
EOF
ausgabe="$(python3 scripts/baseline-sanitize.py "$ARBEIT/geheim.txt" 2>&1)"
lecks=""
for kanarie in KANARIENVOGEL1 KANARIENVOGEL2 KANARIENVOGEL3 KANARIENVOGEL4 KANARIENVOGEL5 198.51.100.77; do
  case "$ausgabe" in *"$kanarie"*) lecks="$lecks $kanarie" ;; esac
done
[ -z "$lecks" ] && ok "Sanitizer-Ausgabe enthaelt keinen Fundwert" \
  || fail "Sanitizer-Ausgabe enthaelt keinen Fundwert" "geleakt:$lecks"
case "$ausgabe" in *"Kennung "*) ok "stattdessen nur Kategorie, Anzahl und Kennung" ;;
  *) fail "stattdessen nur Kategorie, Anzahl und Kennung" ;; esac

echo
echo "── Manifest-Generator (echte scripts/baseline-manifest.py) ────────────"

G="$ARBEIT/gener"; mkdir -p "$G/stage"
for n in $BASELINE_ARTIFACTS; do echo "inhalt-$n" > "$G/stage/$n"; done
printf 'enums|1\ntables|2\nviews|0\nmatviews|0\nsequences|3\nindexes|4\npolicies|5\ntriggers|6\nfunctions|7\nforeign_keys|8\ncheck_constraints|9\nrls_enabled_tables|2\ncolumn_fingerprint_md5|%032d\npolicy_fingerprint_md5|%032d\nfunction_fingerprint_md5|%032d\n' 1 2 3 > "$G/werte.txt"
echo '{}' > "$G/enums.json"
echo '[{"migration":"20260802110000_x","kind":"undo table observed in production","object":"public.undo_20260802110000"}]' > "$G/evidenz.json"
cat > "$G/alt.json" <<'EOF'
{
  "artifact_verification": "pending-first-refresh",
  "artifact_verification_note": "alter Erklaertext",
  "legacy_artifacts": {"schema.sql": "x"},
  "legacy_generation": "abc",
  "migration_checkpoint": {"declared_through": "2026...", "evidence": [], "evidence_source": "HANDGESCHRIEBEN"},
  "deliberate_test_differences": {"grants": "…", "sequence_grants_pending": "noch offen"}
}
EOF
python3 scripts/baseline-manifest.py \
  --werte "$G/werte.txt" --enums "$G/enums.json" --evidenz "$G/evidenz.json" \
  --alt "$G/alt.json" --ziel "$G/neu.json" --stage "$G/stage" \
  --artefakte "$BASELINE_ARTIFACTS" \
  --table-acl aa --sequence-acl bb --function-acl cc \
  --quell-db postgres --server-version 15.8 \
  --ziel-fingerprint feedface --heute 2026-08-01 >/dev/null 2>&1
erwartet_rc 0 "Generator raeumt alle Uebergangsfelder ab" python3 - "$G/neu.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))
uebrig = [k for k in ("artifact_verification", "artifact_verification_note",
                      "legacy_artifacts", "legacy_generation") if k in m]
if uebrig: sys.exit("uebrig: %s" % uebrig)
if "sequence_grants_pending" in m.get("deliberate_test_differences", {}):
    sys.exit("verschachteltes sequence_grants_pending steht noch")
if m["migration_checkpoint"]["evidence_source"].startswith("HANDGESCHRIEBEN"):
    sys.exit("evidence_source nicht ersetzt")
if m["migration_checkpoint"]["evidence"][0].get("observed_at") != "2026-08-01":
    sys.exit("observed_at fehlt")
if m.get("source_identity_fingerprint_sha256") != "feedface":
    sys.exit("Ziel-Fingerprint nicht in der Provenance")
if "15.8" not in m["generated_from"] or m["counts"]["tables"] != 2:
    sys.exit("gemessene Werte fehlen")
PY

echo
echo "── Produktionszugang (Attrappen-ssh, kein Netzverkehr) ────────────────"

# Der Lauf zeigt auf eine KOPIE des Repos, nicht auf das Repo selbst: ein
# Attrappenlauf, der weit genug kommt, wuerde sonst die echte Baseline
# ueberschreiben.
SANDKASTEN="$ARBEIT/repo"
mkdir -p "$SANDKASTEN/scripts" "$SANDKASTEN/supabase-test/baseline"
cp scripts/refresh-test-baseline.sh scripts/baseline-artifacts.sh \
   scripts/baseline-sanitize.py scripts/baseline-manifest.py "$SANDKASTEN/scripts/"
attrappe "$SANDKASTEN/supabase-test/baseline" legacy

mkdir -p "$ARBEIT/bin"
# ARGV und STDIN getrennt protokollieren. Die Antworten sind so vollstaendig,
# dass der Lauf bis zur zweiten Aufnahme und zur Schlusspruefung kommt — nur so
# lassen sich Drift und Identitaetswechsel ueberhaupt testen.
cat > "$ARBEIT/bin/ssh" <<'STUBEOF'
#!/usr/bin/env bash
eingabe="$(cat)"
{ echo "--- AUFRUF ---"
  for a in "$@"; do echo "ARG: $a"; done
  echo "--- STDIN ---"; printf '%s\n' "$eingabe"; } >> "$SSH_LOG"

zdatei="${SSH_LOG}.zaehler"; : > "${zdatei}.lock"
runde() { local k="$1" n; n=$(( $(grep -c "^$k\$" "$zdatei" 2>/dev/null) + 1 )); echo "$k" >> "$zdatei"; echo "$n"; }

kunst_dump() {
  printf -- '--\n-- PostgreSQL database dump\n--\n-- Dumped from database version 15.8\n-- Dumped by pg_dump version 15.8\n\n'
  for sig in "invoke_edge_function(p_fn text) RETURNS void" \
             "trigger_notify_admin_high_spam() RETURNS trigger" \
             "trigger_subscription_manager() RETURNS void" \
             "trigger_team_reminder_for_appointment(p_appointment_id uuid) RETURNS boolean"; do
    printf 'CREATE FUNCTION public.%s\n    LANGUAGE plpgsql\n    AS $$ BEGIN RETURN; END; $$;\n\n' "$sig"
  done
  printf 'CREATE TABLE public.companies (id uuid NOT NULL);\n'
  if [ "${STUB_DUMP_DRIFT:-}" = "1" ] && [ "$(runde dump)" -ge 2 ]; then
    printf "CREATE TABLE public.spaeter (id uuid, geheim text DEFAULT 'sk-ant-api03-DRIFTKANARIE');\n"
  fi
}

case "$*" in *pg_dump*) kunst_dump; exit 0 ;; esac

case "$eingabe" in
  *concat_ws*)
      if [ "${STUB_ACL_DRIFT:-}" = "1" ] && [ "$(runde acl)" -ge 2 ]; then
        echo "ffffffffffffffffffffffffffffffff"
      else echo "0123456789abcdef0123456789abcdef"; fi ;;
  *pg_control_system*)
      if [ "$(runde sysid)" -ge 2 ] && [ -n "${STUB_SYSID2:-}" ]; then
        echo "$STUB_SYSID2"; else echo "${STUB_SYSID:-1}"; fi ;;
  *current_database*)
      if [ "$(runde gestalt)" -ge 2 ] && [ -n "${STUB_GESTALT2:-}" ]; then
        echo "$STUB_GESTALT2"; else echo "postgres|15.8|7"; fi ;;
  *"grantor <> eigner"*)          echo "0" ;;
  *"count(*) FROM pg_attribute"*) echo "0" ;;
  *"count(*) FROM pg_roles"*)     echo "3" ;;
  *json_agg*)  echo "[]" ;;
  *json_object_agg*) echo "{}" ;;
  *"union all select 'tables'"*)
      printf 'enums|1\ntables|2\nviews|0\nmatviews|0\nsequences|1\nindexes|1\npolicies|1\ntriggers|0\nfunctions|4\nforeign_keys|0\ncheck_constraints|0\nrls_enabled_tables|1\n'
      printf 'column_fingerprint_md5|%032d\npolicy_fingerprint_md5|%032d\nfunction_fingerprint_md5|%032d\n' 1 2 3 ;;
  *"ON FUNCTION"*) for i in $(seq 1 120); do echo "GRANT EXECUTE ON FUNCTION public.f$i() TO anon;"; done ;;
  *"ON SEQUENCE"*) echo "GRANT USAGE ON SEQUENCE public.s1 TO anon;" ;;
  *"ON TABLE"*)    echo "GRANT SELECT ON TABLE public.companies TO anon;" ;;
  *md5*)           echo "0123456789abcdef0123456789abcdef" ;;
  *) echo "0" ;;
esac
exit 0
STUBEOF
chmod +x "$ARBEIT/bin/ssh"

ZIEL_FP="$(printf '%s|%s|%s' root@example.test db-attrappe 1234567890123456789 | sha256sum | cut -d' ' -f1)"
FREEZE_FP="$(printf 'change-freeze|%s' "$ZIEL_FP" | sha256sum | cut -d' ' -f1)"

baseline_zustand() {  # Fingerprint des Sandkasten-Baselines
  # Nur die veroeffentlichten Dateien: die Sperrdatei und Buehnen-Reste sind
  # Laufzeitspuren und wuerden jeden Vergleich verrauschen.
  local b="$SANDKASTEN/supabase-test/baseline" f
  for f in parity-manifest.json grants.sql $BASELINE_ARTIFACTS; do
    [ -f "$b/$f" ] && sha256sum "$b/$f" || echo "fehlt $f"
  done | sha256sum | cut -d' ' -f1
}

LETZTE_AUSGABE=""
LETZTER_RC=""
# Setzt LETZTE_AUSGABE und LETZTER_RC — und gibt NICHTS aus.
#
# Frueher lieferte diese Funktion den rc per `echo`, und die Aufrufer schrieben
# `rc="$(refresh_mit …)"`. Eine Kommandosubstitution laeuft aber in einer
# Subshell: LETZTE_AUSGABE kam beim Aufrufer nie an und blieb leer. Jede
# Pruefung der Form "… kommt in der Meldung NICHT vor" bestand damit, weil es
# gar keine Meldung zu pruefen gab — bestandene Tests ohne Pruefgegenstand.
refresh_mit() {
  : > "$ARBEIT/ssh.log"; : > "$ARBEIT/ssh.log.zaehler"
  LETZTE_AUSGABE="$(env PATH="$ARBEIT/bin:$PATH" SSH_LOG="$ARBEIT/ssh.log" \
      CRM_PROD_SSH=root@example.test \
      CRM_PROD_DB_CONTAINER=db-attrappe \
      CRM_PROD_SYSTEM_IDENTIFIER=1234567890123456789 \
      CRM_PROD_READ_CONFIRM="$ZIEL_FP" \
      CRM_PROD_CHANGE_FREEZE_CONFIRM="$FREEZE_FP" \
      "$@" bash "$SANDKASTEN/scripts/refresh-test-baseline.sh" 2>&1)"
  LETZTER_RC=$?
}

keine_verbindung() {  # $1 = Beschreibung, Rest = env-Ueberschreibungen
  local was="$1"; shift
  local rc; refresh_mit "$@"; rc="$LETZTER_RC"
  if [ "$rc" = "0" ]; then fail "$was" "rc=0, aber Abbruch erwartet"
  elif [ -s "$ARBEIT/ssh.log" ]; then fail "$was" "$(grep -c '^--- AUFRUF ---' "$ARBEIT/ssh.log") ssh-Aufrufe"
  else ok "$was (rc=$rc, 0 ssh-Aufrufe)"; fi
}

keine_verbindung "falsche Bestaetigung: kein Verbindungsaufbau" CRM_PROD_READ_CONFIRM=falsch
keine_verbindung "Bestaetigung fuer fremdes Ziel: kein Verbindungsaufbau" \
  CRM_PROD_READ_CONFIRM="$(printf '%s|%s|%s' root@anders.test db-attrappe 1234567890123456789 | sha256sum | cut -d' ' -f1)"
keine_verbindung "fehlende Freeze-Zusicherung: kein Verbindungsaufbau" CRM_PROD_CHANGE_FREEZE_CONFIRM=nein
keine_verbindung "Freeze-Wert = Ziel-Wert (Verwechslung): abgelehnt" CRM_PROD_CHANGE_FREEZE_CONFIRM="$ZIEL_FP"
keine_verbindung "Host mit fuehrendem Bindestrich" CRM_PROD_SSH=-oProxyCommand=id
keine_verbindung "Container mit fuehrendem Bindestrich" CRM_PROD_DB_CONTAINER=-v/:/x
keine_verbindung "nicht-numerische Cluster-Kennung" CRM_PROD_SYSTEM_IDENTIFIER=abc

# Fundstellen zeigen, ohne den Wert zu wiederholen: eine Fehlermeldung, die die
# Kennung ausschreibt, waere derselbe Fehler wie der, den sie meldet.
kennung_fundstellen() {
  printf '%s\n' "$LETZTE_AUSGABE" | grep -n -e '[0-9]\{15,\}' \
    | sed 's/[0-9]\{15,\}/<Kennung>/g' | head -3
}

# Falsche Kennung: genau eine Abfrage, dann Schluss — und die Kennung darf in
# der Meldung NICHT vorkommen, sonst verraet die Pruefung genau das, was sie
# schuetzen soll.
vorher_zustand="$(baseline_zustand)"
refresh_mit STUB_SYSID=999888777666555444; rc="$LETZTER_RC"
[ "$rc" != "0" ] && ok "falsche Cluster-Kennung: Abbruch (rc=$rc)" || fail "falsche Cluster-Kennung: Abbruch"
gleich 1 "$(grep -c '^--- AUFRUF ---' "$ARBEIT/ssh.log")" "falsche Kennung: genau eine Abfrage"
case "$LETZTE_AUSGABE" in
  *999888777666555444*|*1234567890123456789*)
    fail "Kennung erscheint nicht in der Meldung" "$(kennung_fundstellen)" ;;
  *) ok "Kennung erscheint nicht in der Meldung" ;;
esac
gleich "$vorher_zustand" "$(baseline_zustand)" "falsche Kennung: nichts veroeffentlicht"

# Vollstaendiger Attrappenlauf: kommt bis zur Veroeffentlichung.
vorher_zustand="$(baseline_zustand)"
refresh_mit STUB_SYSID=1234567890123456789; rc="$LETZTER_RC"
gleich 0 "$rc" "vollstaendiger Attrappenlauf laeuft durch"
aufrufe="$(grep -c '^--- AUFRUF ---' "$ARBEIT/ssh.log")"
[ "$aufrufe" -ge 12 ] && ok "mehrstufiger Lauf: $aufrufe Fernaufrufe" || fail "mehrstufiger Lauf" "$aufrufe"
gleich 2 "$(grep -c '^ARG: .*pg_dump' "$ARBEIT/ssh.log")" "der Dump wird zweimal geholt (Drift-Vergleich)"
gleich 0 "$(grep '^ARG: docker exec' "$ARBEIT/ssh.log" | grep -vc "PGOPTIONS='-c default_transaction_read_only=on'")" \
  "JEDER Fernbefehl traegt read-only PGOPTIONS"
grep -q "^ARG: .*pg_dump .*--no-privileges" "$ARBEIT/ssh.log" \
  && ok "pg_dump laeuft ueber denselben read-only Praefix" || fail "pg_dump read-only"
grep -q "^ARG: .*psql .*-f -$" "$ARBEIT/ssh.log" \
  && ok "SQL kommt ueber stdin, nicht in der Kommandozeile" || fail "SQL ueber stdin"
grep -q "pg_control_system" "$ARBEIT/ssh.log" \
  && ok "Cluster-Kennung ist die erste Abfrage" || fail "Cluster-Kennung zuerst"
grep '^ARG: ' "$ARBEIT/ssh.log" | grep -qE "\\\$'" \
  && fail "keine bash-spezifische Zitierung im Fernkommando" \
  || ok "keine bash-spezifische Zitierung im Fernkommando"
if [ "$(baseline_zustand)" != "$vorher_zustand" ]; then ok "erfolgreicher Lauf veroeffentlicht"
else fail "erfolgreicher Lauf veroeffentlicht" "Baseline unveraendert"; fi
erwartet_rc 0 "veroeffentlichte Generation ist gueltig" \
  verify_baseline_artifacts "$SANDKASTEN/supabase-test/baseline"

echo
echo "── Drift und Identitaetswechsel waehrend der Aufnahme ─────────────────"

sandkasten_zuruecksetzen() { attrappe "$SANDKASTEN/supabase-test/baseline" legacy; }

sandkasten_zuruecksetzen; vorher_zustand="$(baseline_zustand)"
refresh_mit STUB_SYSID=1234567890123456789 STUB_DUMP_DRIFT=1; rc="$LETZTER_RC"
[ "$rc" != "0" ] && ok "Schema-Drift → Abbruch (rc=$rc)" || fail "Schema-Drift → Abbruch"
gleich "$vorher_zustand" "$(baseline_zustand)" "Schema-Drift: nichts veroeffentlicht"
case "$LETZTE_AUSGABE" in
  *DRIFTKANARIE*|*"CREATE TABLE public.spaeter"*) fail "Drift-Meldung zeigt keine Dump-Zeile" ;;
  *) ok "Drift-Meldung zeigt keine Dump-Zeile" ;;
esac

sandkasten_zuruecksetzen; vorher_zustand="$(baseline_zustand)"
refresh_mit STUB_SYSID=1234567890123456789 STUB_ACL_DRIFT=1; rc="$LETZTER_RC"
[ "$rc" != "0" ] && ok "Rechte-Drift → Abbruch (rc=$rc)" || fail "Rechte-Drift → Abbruch"
gleich "$vorher_zustand" "$(baseline_zustand)" "Rechte-Drift: nichts veroeffentlicht"

sandkasten_zuruecksetzen; vorher_zustand="$(baseline_zustand)"
refresh_mit STUB_SYSID=1234567890123456789 STUB_SYSID2=555444333222111000; rc="$LETZTER_RC"
[ "$rc" != "0" ] && ok "Kennungswechsel am Ende → Abbruch (rc=$rc)" || fail "Kennungswechsel am Ende → Abbruch"
gleich "$vorher_zustand" "$(baseline_zustand)" "Kennungswechsel: nichts veroeffentlicht"
case "$LETZTE_AUSGABE" in
  *555444333222111000*|*1234567890123456789*)
    fail "Schlusspruefung zeigt keine Kennung" "$(kennung_fundstellen)" ;;
  *) ok "Schlusspruefung zeigt keine Kennung" ;;
esac

sandkasten_zuruecksetzen; vorher_zustand="$(baseline_zustand)"
refresh_mit STUB_SYSID=1234567890123456789 STUB_GESTALT2='andere_db|15.8|7'; rc="$LETZTER_RC"
[ "$rc" != "0" ] && ok "Datenbankwechsel am Ende → Abbruch (rc=$rc)" || fail "Datenbankwechsel am Ende → Abbruch"
gleich "$vorher_zustand" "$(baseline_zustand)" "Datenbankwechsel: nichts veroeffentlicht"

echo
echo "── Schlusshinweis der Auffrischung (alle drei Zweige) ─────────────────"

# Nach dem Veroeffentlichen prueft die Auffrischung, ob grants.sql noch
# scope-weite Sequenzrechte vergibt. Alle drei Ausgaenge laufen hier durch das
# ECHTE Skript, statt nachgebildet zu werden: dieser Hinweis ist die einzige
# Stelle, an der ein Mensch von der offenen Aufgabe erfaehrt — und die einzige,
# an der "nicht entscheidbar" versehentlich wie "nichts gefunden" aussehen
# koennte.
sandkasten_grants() { printf '%s\n' "$1" > "$SANDKASTEN/supabase-test/baseline/grants.sql"; }

sandkasten_zuruecksetzen                    # legacy: der scope-weite GRANT steht drin
refresh_mit STUB_SYSID=1234567890123456789; rc="$LETZTER_RC"
gleich 0 "$rc" "Schlusshinweis (Fund): Lauf bleibt erfolgreich"
case "$LETZTE_AUSGABE" in
  *"NAECHSTER SCHRITT"*) ok "Fund → die offene Aufgabe wird genannt" ;;
  *) fail "Fund → die offene Aufgabe wird genannt" "kein Hinweis in der Ausgabe" ;;
esac

sandkasten_zuruecksetzen
sandkasten_grants 'grant usage on schema public to anon, authenticated, service_role;'
refresh_mit STUB_SYSID=1234567890123456789; rc="$LETZTER_RC"
gleich 0 "$rc" "Schlusshinweis (kein Fund): Lauf bleibt erfolgreich"
case "$LETZTE_AUSGABE" in
  *"NAECHSTER SCHRITT"*|*UNBEKANNT*)
    fail "kein Fund → kein Hinweis" "es stand trotzdem einer da" ;;
  *) ok "kein Fund → kein Hinweis" ;;
esac

sandkasten_zuruecksetzen
sandkasten_grants '\gexec'
refresh_mit STUB_SYSID=1234567890123456789; rc="$LETZTER_RC"
gleich 0 "$rc" "Schlusshinweis (unentscheidbar): Lauf bleibt erfolgreich"
case "$LETZTE_AUSGABE" in
  *UNBEKANNT*) ok "unentscheidbar → laute Warnung statt Schweigen" ;;
  *) fail "unentscheidbar → laute Warnung statt Schweigen" "keine Warnung in der Ausgabe" ;;
esac

echo
echo "── Eigentuemer in der Drift-Sonde (strukturell) ───────────────────────"
# Ein Eigentuemerwechsel faellt aus dem Dump-Vergleich heraus (--no-owner). Ob
# die Sonde ihn sieht, laesst sich ohne Datenbank nicht ausfuehren — geprueft
# wird deshalb, dass die Abfrage die Eigentuemer ueberhaupt liest.
for feld in "pg_get_userbyid(c.relowner)" "pg_get_userbyid(p.proowner)" \
            "pg_get_userbyid(t.typowner)" "pg_get_userbyid(n.nspowner)" \
            "pg_get_userbyid(d.defaclrole)"; do
  grep -qF "$feld" scripts/refresh-test-baseline.sh \
    && ok "Drift-Sonde liest $feld" || fail "Drift-Sonde liest $feld"
done

echo
echo "── Manifest im Repository ─────────────────────────────────────────────"

# Am 2026-08-01 lief eine vollstaendige Produktionsaufnahme durch und brach
# EINEN Schritt vor der Veroeffentlichung ab: der Sanitizer beanstandete das
# Manifest. Nicht wegen der Produktion — deren Dateien waren sauber —, sondern
# wegen eines von Hand geschriebenen Erklaertextes, der die verbotene Syntax als
# BEISPIEL enthielt. Der Text im Manifest wird seit A.2.1 mitgeprueft; wer ihn
# bearbeitet, merkt das sonst erst am Ende der naechsten Aufnahme.
erwartet_rc 0 "Repo-Manifest besteht den Sanitizer (Beschreibungstexte inbegriffen)" \
  python3 scripts/baseline-sanitize.py supabase-test/baseline/parity-manifest.json

# Der Uebergang ist seit der ersten Produktionsaufnahme abgeschlossen. Die
# beiden Zusicherungen stehen hier dauerhaft: das echte grants.sql darf die
# Zeile nur noch BESCHREIBEN, nie wieder ausfuehren.
erwartet_rc 1 "Repo-grants.sql: in der Grammatik, ohne Sequenz-GRANT" \
  baseline_has_blanket_sequence_grant supabase-test/baseline/grants.sql

erwartet_rc 0 "Repo-Baseline: Sequenz-Uebergang ist geschlossen" \
  baseline_check_sequence_transition supabase-test/baseline

erwartet_rc 0 "Uebergangsfelder sind zum Zustand konsistent" python3 - <<'PY'
import json, sys
m = json.load(open("supabase-test/baseline/parity-manifest.json"))
pending = m.get("artifact_verification") == "pending-first-refresh"
legacy = {"legacy_artifacts", "legacy_generation", "artifact_verification_note"}
vorhanden = legacy & set(m)
if pending:
    fehlend = legacy - vorhanden
    if fehlend: sys.exit(f"pending, aber es fehlen: {sorted(fehlend)}")
elif vorhanden or "artifact_verification" in m:
    sys.exit(f"nicht pending, aber Uebergangsfelder stehen noch: {sorted(vorhanden)}")
PY

echo
printf 'bestanden %d, gescheitert %d\n' "$BESTANDEN" "$GESCHEITERT"
[ "$GESCHEITERT" = "0" ] || exit 1
