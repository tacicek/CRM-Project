#!/usr/bin/env python3
"""Inspect actual react-pdf output. Uses Poppler text/bounding boxes, no live data."""
from pathlib import Path
import json
import re
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
checks = []
details = {}

def check(fixture, label, passed, detail=None):
    checks.append({"fixture": fixture, "check": label, "passed": bool(passed), **({"detail": detail} if detail is not None else {})})

def normalize(text):
    return re.sub(r"\s+", " ", re.sub(r"-\s*\n\s*", "", text)).strip()

for pdf in sorted(ROOT.glob("*.pdf")):
    if pdf.name.startswith("baseline"):
        continue
    name = pdf.stem
    text = subprocess.check_output(["pdftotext", "-layout", str(pdf), "-"]).decode()
    pdf.with_suffix(".txt").write_text(text)
    pages = text.rstrip("\x0c\n").split("\x0c")
    bbox = ET.fromstring(subprocess.check_output(["pdftotext", "-bbox", str(pdf), "-"]))
    geometry = []
    collisions = []
    out_of_bounds = []
    footer_locations = []
    for index, page in enumerate(bbox.findall(".//{*}page"), 1):
        width, height = float(page.attrib['width']), float(page.attrib['height'])
        words = [{"text": "".join(w.itertext()), **{k: float(v) for k, v in w.attrib.items()}} for w in page.findall("{*}word")]
        geometry.append({"page": index, "width": width, "height": height, "words": len(words)})
        for word in words:
            if word['xMin'] < 40 or word['xMax'] > width - 40 or word['yMin'] < 20 or word['yMax'] > height - 20:
                out_of_bounds.append({"page": index, **word})
        for i, left in enumerate(words):
            for right in words[i + 1:]:
                x = min(left['xMax'], right['xMax']) - max(left['xMin'], right['xMin'])
                y = min(left['yMax'], right['yMax']) - max(left['yMin'], right['yMin'])
                if x > 1.5 and y > 2.5:
                    collisions.append({"page": index, "left": left['text'], "right": right['text'], "intersection": [round(x, 2), round(y, 2)]})
        footers = [w for w in words if w['text'] == 'QU-2026-0126' and w['yMin'] > 790]
        footer_locations.extend({"page": index, "yMin": w['yMin'], "yMax": w['yMax']} for w in footers)
        check(name, f"page {index}: A4 size", abs(width - 595.28) < .2 and abs(height - 841.89) < .2)
        check(name, f"page {index}: footer receipt number inside print area", len(footers) == 1)
        page_label = {'fr': f'Page {index} sur {len(pages)}', 'en': f'Page {index} of {len(pages)}'}.get(name[:2], f'Seite {index} von {len(pages)}')
        check(name, f"page {index}: correct page x/y", page_label in normalize(pages[index - 1]))
        headings = [w for w in words if w['text'] in ('Beschreibung', 'Description')]
        payment_labels = [w for w in words if w['text'] in ('Zahlungsstand', 'Statut', 'Payment') and w['xMin'] < 50]
        if headings:
            table_top = max(w['yMax'] for w in headings)
            table_bottom = min((w['yMin'] for w in payment_labels if w['yMin'] > table_top), default=790)
            right_edges = [w['xMax'] for w in words if table_top < w['yMin'] < table_bottom and w['xMin'] > 470 and 540 < w['xMax'] < 550 and re.match(r"^[0-9][0-9'’.,]*$", w['text'])]
            if right_edges:
                check(name, f"page {index}: row monetary amounts align right at 545.28pt", all(abs(x - 545.28) < .2 for x in right_edges), [round(x, 2) for x in right_edges])
    details[name] = {"pages": len(pages), "geometry": geometry, "collisions": collisions, "out_of_bounds": out_of_bounds, "footers": footer_locations}
    check(name, "no overlapping word boxes", not collisions, collisions)
    check(name, "all text inside 20pt vertical / 40pt horizontal print margins", not out_of_bounds, out_of_bounds)
    plain = normalize(text)
    check(name, "issuer street and separate house number", "Bahnhofstrasse 5" in plain)
    check(name, "customer street and separate house number", "Alte Landstrasse 12a" in plain)
    check(name, "destination street and house number", "Rue du Lac 8B" in plain)
    check(name, "Unicode customer name preserved", "Işıl Çiçek" in plain)
    check(name, "internal note omitted", "INTERNAL-NOTE-MUST-NOT-PRINT" not in plain)
    if name not in ('de-signed', 'de-worksheet'):
        check(name, "unsigned final has no empty signature fields", not any(s in plain for s in ['Unterschrift', 'Signature du', 'Customer signature', 'Team leader signature']))
    if name == 'de-offer-address-pipeline':
        check(name, "frozen source address pipeline beats later lead", "Alte Landstrasse 12a, 8706 Meilen" in plain and 'CURRENT-LEAD-NOT-TO-PRINT' not in plain and 'CURRENT-DESTINATION-NOT-TO-PRINT' not in plain)
    elif name == 'de-worksheet':
        check(name, "worksheet signature fields and handwriting totals", "Datum / Unterschrift Kunde" in plain and "Datum / Unterschrift Teamchef" in plain and '918.85' not in plain)
        check(name, "ordinary worksheet with three handwriting rows fits one A4 page", len(pages) == 1)
    elif name == 'de-signed':
        check(name, "two signatures with Zurich times", '26.10.2026, 10:29 MEZ' in plain and '26.10.2026, 10:30 MEZ' in plain)
        check(name, "ordinary signed receipt fits one A4 page", len(pages) == 1)
    elif name == 'de-multipage':
        for row in range(1, 46):
            matching = [p for p in pages if f'Leistung {row:02d}:' in p and f'RATE-{row:02d}' in p]
            check(name, f"row {row:02d}: description and rate remain together exactly once", len(matching) == 1)
        for index, page in enumerate(pages, 1):
            if re.search(r'Leistung \d\d:', page):
                check(name, f"page {index}: item page has table headings exactly once", all(normalize(page).count(s) == 1 for s in ['Beschreibung', 'Satz / Bemerkung', 'Betrag CHF']))
            else:
                check(name, f"page {index}: summary-only page has no phantom table headings", not any(s in normalize(page) for s in ['Beschreibung', 'Satz / Bemerkung', 'Betrag CHF']))
    elif name == 'de-long-metadata':
        check(name, "all 130 long-description repetitions preserved", plain.count('Schutztransport.') == 130, plain.count('Schutztransport.'))
        check(name, "full multiline address preserved", all(s in plain for s in ['Postfach 318', 'Haus C, 3. Obergeschoss, Eingang im Innenhof', '8706 Meilen', 'Schweiz']))
    if name in ('de-standard', 'de-without-logo', 'fr-partial-invoice', 'en-open-invoice'):
        check(name, "ordinary unsigned receipt fits one A4 page", len(pages) == 1)
    if name == 'fr-partial-invoice':
        check(name, "French partial invoice payment and balance", all(s in plain for s in ['Reçu', 'Partiellement payé', '300.00 CHF', '618.85 CHF', '918.85 CHF']))
    elif name == 'en-open-invoice':
        check(name, "English unpaid invoice payment and balance", all(s in plain for s in ['Receipt', 'CHF 918.85', 'No payment']))

result = {"passed": sum(c['passed'] for c in checks), "total": len(checks), "checks": checks, "fixtures": details}
(ROOT / 'layout-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f"{result['passed']}/{result['total']} checks passed")
for item in checks:
    if not item['passed']:
        print(json.dumps(item, ensure_ascii=False))
raise SystemExit(0 if result['passed'] == result['total'] else 1)
