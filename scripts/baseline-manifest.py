#!/usr/bin/env python3
"""Schreibt das parity-manifest.json einer Auffrischung in die Buehne.

    python3 scripts/baseline-manifest.py \
        --werte werte.txt --enums enums.json --evidenz evidenz.json \
        --alt supabase-test/baseline/parity-manifest.json \
        --ziel <stage>/parity-manifest.json --stage <stage> \
        --artefakte "schema.sql table-grants.sql ..." \
        --table-acl <md5> --sequence-acl <md5> --function-acl <md5> \
        --quell-db postgres --server-version 15.8 \
        --ziel-fingerprint <sha256> --heute 2026-08-01

Eigene Datei, damit der Test den ECHTEN Generator auf einem Fixture laufen
lassen kann. Vorher lag er als Here-Document im Refresh-Skript und war nur
ueber die Produktion erreichbar — also nie geprueft.
"""

import argparse
import hashlib
import json
import os

# Felder, die den Uebergangszustand beschreiben. Sobald es echte Hashes gibt,
# ist jedes davon nicht nur ueberfluessig, sondern FALSCH: sie erklaeren, warum
# keine Hashes da sind.
UEBERGANGSFELDER = (
    "artifact_verification",
    "artifact_verification_note",
    "legacy_artifacts",
    "legacy_generation",
)

ZAHLEN = ["enums", "tables", "views", "matviews", "sequences", "indexes",
          "policies", "triggers", "functions", "foreign_keys",
          "check_constraints", "rls_enabled_tables"]


def baue(alt, werte, enums, evidenz, artefakte, args):
    alt["generated_at"] = args.heute
    alt["generated_from"] = (
        f"read-only prod --schema-only --schema=public dump "
        f"(database {args.quell_db}, PostgreSQL {args.server_version}), "
        f"sanitized (siehe README)")
    alt["source_identity_fingerprint_sha256"] = args.ziel_fingerprint
    alt["counts"] = {k: int(werte[k]) for k in ZAHLEN}
    alt["enums"] = enums
    alt["table_acl_fingerprint_md5"] = args.table_acl
    alt["sequence_acl_fingerprint_md5"] = args.sequence_acl
    alt["function_acl_fingerprint_md5"] = args.function_acl
    for feld in ("column_fingerprint_md5", "policy_fingerprint_md5",
                 "function_fingerprint_md5"):
        alt[feld] = werte[feld]

    pruefstand = alt.setdefault("migration_checkpoint", {})
    for eintrag in evidenz:
        eintrag["observed_at"] = args.heute
    pruefstand["evidence"] = evidenz
    pruefstand["evidence_observed_at"] = args.heute
    pruefstand["evidence_source"] = (
        "GEMESSEN von scripts/refresh-test-baseline.sh: Aufzaehlung der Tabellen "
        "public.undo_<14 Ziffern> in der Produktion. Was dort fehlt, faellt hier "
        "heraus.")
    pruefstand["evidence_limits"] = (
        f"Die {len(evidenz)} aufgefuehrten undo-Tabellen belegen GENAU die "
        "Migrationen, die sie nennen, und sonst keine. Ueber die uebrigen "
        "Migrationen der Kette sagen sie nichts — 'declared_through' ist "
        "deshalb KEIN Beleg fuer eine lueckenlose Kette. Der Beleg ist ausserdem "
        "verhaenglich: laeuft ein ROLLBACK-Skript, verschwindet die Tabelle und "
        "mit ihr der Eintrag.")

    for veraltet in UEBERGANGSFELDER:
        alt.pop(veraltet, None)
    unterschiede = alt.get("deliberate_test_differences")
    if isinstance(unterschiede, dict):
        unterschiede.pop("sequence_grants_pending", None)

    alt["artifacts"] = artefakte
    alt["generation"] = hashlib.sha256(
        "".join(artefakte[k] for k in sorted(artefakte)).encode()).hexdigest()[:16]
    return alt


def main():
    p = argparse.ArgumentParser()
    for name in ("werte", "enums", "evidenz", "alt", "ziel", "stage",
                 "artefakte", "table-acl", "sequence-acl", "function-acl",
                 "quell-db", "server-version", "ziel-fingerprint", "heute"):
        p.add_argument("--" + name, required=True)
    args = p.parse_args()

    werte = dict(
        zeile.split("|", 1)
        for zeile in open(args.werte).read().strip().split("\n")
        if "|" in zeile)
    enums = json.loads(open(args.enums).read().strip())
    evidenz = json.loads(open(args.evidenz).read().strip())
    alt = json.load(open(args.alt))

    artefakte = {}
    for name in sorted(args.artefakte.split()):
        with open(os.path.join(args.stage, name), "rb") as fh:
            artefakte[name] = hashlib.sha256(fh.read()).hexdigest()

    neu = baue(alt, werte, enums, evidenz, artefakte, args)
    json.dump(neu, open(args.ziel, "w"), indent=2, ensure_ascii=False)
    print("counts:", neu["counts"])
    print("generation:", neu["generation"])
    print("evidence:", [e["object"] for e in evidenz])


if __name__ == "__main__":
    main()
