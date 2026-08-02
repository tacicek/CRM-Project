#!/usr/bin/env python3
"""Prueft produktionsnahe Dateien darauf, dass nichts nach draussen zeigt.

    python3 scripts/baseline-sanitize.py datei [datei ...]

Rueckgabe 0 = sauber, 1 = Fund.

WARUM DIE AUSGABE NICHTS ZEIGT
Diese Pruefung findet Geheimnisse. Wuerde sie ein Beispiel mitdrucken, stuende
das gefundene Geheimnis anschliessend im Terminal, im CI-Log und in der
Fehlermeldung, die jemand in ein Ticket kopiert. Gemeldet werden deshalb nur
Datei, Kategorie, Anzahl und eine kurze, nicht umkehrbare Kennung (SHA-256 ueber
die Fundmenge) — genug, um zwei Laeufe zu vergleichen, zu wenig, um irgendetwas
zu rekonstruieren.

WARUM PLATZHALTER NICHT PER LOOKAHEAD FREIGESTELLT WERDEN
Der erste Anlauf hat den Platzhalter im Muster selbst ausgenommen
(`https?://(?!test\\.invalid...)`). Das ist genau falsch herum: die Ausnahme
muss den GANZEN Fund betreffen, nicht seinen Anfang. Sonst reicht es, hinter dem
Platzhalter weiterzuschreiben. Auch eine Alternative wie `(token|\\S+)` hilft
nicht — der regulaere Ausdruck nimmt den ersten passenden Zweig und sieht den
Rest des Wertes nie.

Deshalb gilt hier durchgehend: erst den VOLLSTAENDIGEN Kandidaten abgrenzen
(bis zum naechsten Zeichen, das in dem Wert nicht mehr vorkommen kann), dann auf
Gleichheit mit dem erwarteten Platzhalter pruefen. Ein Kandidat, der laenger ist
als der Platzhalter, ist per Definition kein Platzhalter.
"""

import hashlib
import re
import sys

ERLAUBTE_URL = "https://test.invalid"
ERLAUBTES_BEARER_TOKEN = "test-placeholder"
ERLAUBTE_MAIL = "test@test.invalid"
ERLAUBTE_IP = "127.0.0.1"

# Ein Kandidat endet erst an Leerraum, Anfuehrungszeichen oder spitzer Klammer.
# `)` gehoert BEWUSST NICHT dazu: `https://test.invalid)@evil.example/x` waere
# sonst nach der Klammer abgeschnitten und saehe wie der Platzhalter aus.
URL_KANDIDAT = re.compile(r"(?<![A-Za-z0-9])[a-zA-Z][a-zA-Z0-9+.-]*://[^\s'\"<>]*")

# Der ganze Wert hinter `Bearer`, nicht nur sein gueltiger Anfang.
BEARER_KANDIDAT = re.compile(r"\bbearer\s+([^\s'\"]+)", re.IGNORECASE)

MAIL_KANDIDAT = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z][A-Za-z0-9.-]*")

# Vier oder mehr Zahlengruppen: `127.0.0.1` ist erlaubt, `127.0.0.1.99` ist ein
# anderer Wert und faellt auf. Drei Gruppen (`15.8`, `1.2.3`) sind
# Versionsangaben und keine Adressen — die bleiben aussen vor.
IP_KANDIDAT = re.compile(r"(?<![\d.])\d{1,3}(?:\.\d{1,3}){3,}(?![\d.])")

# Escapte Schraegstriche zurueckdrehen, BEVOR nach URLs gesucht wird. Sonst
# enthaelt `https:\/\/evil.example` gar kein `://` und faellt durchs Raster.
ESCAPES = (
    (re.compile(r"\\/"), "/"),
    (re.compile(r"\\u002[fF]"), "/"),
    (re.compile(r"\\x2[fF]"), "/"),
    (re.compile(r"%2[fF]"), "/"),
)

# Muster, bei denen es keinen erlaubten Fall gibt: jeder Treffer ist ein Fund.
# `cron.` als blosses Wort steht bewusst NICHT hier — legitime Kommentare sagen
# "run daily via cron."; gemeint ist der Schemabezug `cron.<name>`.
VERBOTEN = {
    "Zugangsdaten in DSN": r"://[^\s'\"/]+:[^\s'\"/@]+@",
    "vault-Zugriff": r"\bvault\.",
    "HTTP-Erweiterung": r"\bnet\.http",
    "cron-Schema": r"\bcron\.[A-Za-z_]\w*",
    "JWT-aehnlicher Wert": r"\beyJ[A-Za-z0-9_-]{10,}\.",
    "Anthropic-Schluessel": r"\bsk-ant-[A-Za-z0-9_-]{8,}",
    "OpenAI-Schluessel": r"\bsk-[A-Za-z0-9_-]{20,}",
    "Google-API-Schluessel": r"\bAIza[0-9A-Za-z_-]{20,}",
    "Resend-Schluessel": r"\bre_[A-Za-z0-9_-]{16,}",
    "Webhook-Secret": r"\bwhsec_[A-Za-z0-9+/=_-]{16,}",
    "AWS-Zugriffsschluessel": r"\bAKIA[0-9A-Z]{16}\b",
}


def kennung(funde):
    """Kurze, nicht umkehrbare Kennung ueber die Fundmenge."""
    roh = "\n".join(sorted(set(funde))).encode("utf-8", "replace")
    return hashlib.sha256(roh).hexdigest()[:12]


def pruefe(text):
    """Gibt [(Kategorie, Anzahl, Kennung)] zurueck — nie den Fund selbst."""
    funde = []

    for name, muster in VERBOTEN.items():
        treffer = re.findall(muster, text)
        if treffer:
            funde.append((name, len(treffer), kennung(treffer)))

    entschaerft = text
    for muster, ersatz in ESCAPES:
        entschaerft = muster.sub(ersatz, entschaerft)

    for name, kandidaten, erlaubt in (
        ("externe URL", URL_KANDIDAT.findall(entschaerft), ERLAUBTE_URL),
        ("Bearer-Wert", BEARER_KANDIDAT.findall(text), ERLAUBTES_BEARER_TOKEN),
        ("E-Mail-Adresse", MAIL_KANDIDAT.findall(text), ERLAUBTE_MAIL),
        ("IPv4-Adresse", IP_KANDIDAT.findall(text), ERLAUBTE_IP),
    ):
        fremd = [k for k in kandidaten if k != erlaubt]
        if fremd:
            funde.append((name, len(fremd), kennung(fremd)))

    return funde


def main(pfade):
    if not pfade:
        raise SystemExit("Aufruf: baseline-sanitize.py datei [datei ...]")

    fehler = []
    for pfad in pfade:
        with open(pfad, encoding="utf-8", errors="replace") as fh:
            text = fh.read()
        kurz = pfad.rsplit("/", 1)[-1]
        for name, anzahl, kurzkennung in pruefe(text):
            fehler.append(f"{kurz}: {name} — {anzahl} Fund(e), Kennung {kurzkennung}")

    if fehler:
        # Bewusst ohne Beispielwerte: siehe Modulkommentar.
        raise SystemExit("Sanitisierung unvollstaendig:\n  - " + "\n  - ".join(fehler))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
