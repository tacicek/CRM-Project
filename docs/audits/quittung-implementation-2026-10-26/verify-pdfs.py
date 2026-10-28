from pathlib import Path
import subprocess,json,xml.etree.ElementTree as ET
root=Path(__file__).parent
texts={}
for p in sorted(root.glob('*.pdf')):
 t=subprocess.check_output(['pdftotext','-layout',str(p),'-']).decode()
 p.with_suffix('.pdf.txt').write_text(t)
 texts[p.stem]=t
checks=[]
def check(name,ok):
 checks.append({'check':name,'passed':bool(ok)})
for name in ['draft','signed','sent','paid']:
 check(name+' actual total and discount',"CHF 1'081.00" in texts[name] and '-CHF 50.00' in texts[name])
check('worksheet explicitly blank','Arbeitsformular' in texts['worksheet'] and "CHF 1'081.00" not in texts['worksheet'])
check('Unicode name exact','Işıl Çiçek Şahin Güneş Ğğ İı' in texts['turkish'])
check('Destination arrow preserved','→ Zielweg' in texts['turkish'])
check('Included label without original rate','Included' in texts['included'] and '10 ×' not in texts['included'])
for name in ['long','long-fields']:
 pages=[p for p in texts[name].split('\f') if p.strip()]
 check(name+' every page identified and numbered',all('QU-2026-0042' in p and f'Seite {i+1} von {len(pages)}' in p for i,p in enumerate(pages)))
 check(name+' continued table headers',all('Beschreibung' in p and 'Satz / Bemerkung' in p for p in pages))
for number in range(1,51):
 pages=texts['long'].split('\f')
 check(f'row {number} description and price together',any(f'Position {number}:' in p and f'{number} Std.' in p for p in pages))
check('invoice partial exact balance','781.00 CHF' in texts['partial-invoice'] and 'Partiellement payé' in texts['partial-invoice'])
check('invoice credits use actual invoice balance','CHF 40.00' in texts['invoice-credit-closure'] and 'CHF 0.00' in texts['invoice-credit-closure'] and 'Invoice balance:' in texts['invoice-credit-closure'])
check('receipt date independent of timezone',all('25.10.2026' in texts[n] and '24.10.2026' not in texts[n] and '10:30 MEZ' in texts[n] for n in ['signed-image','signed-image-zurich','signed-image-la']))
for name in ['paid','turkish','long','long-fields','fr','en']:
 raw=subprocess.check_output(['pdftotext','-bbox',str(root/(name+'.pdf')),'-'])
 tree=ET.fromstring(raw)
 words=tree.findall('.//{http://www.w3.org/1999/xhtml}word')
 check(name+' text inside page',all(float(w.attrib['xMin'])>=0 and float(w.attrib['yMin'])>=0 and float(w.attrib['xMax'])<=596 and float(w.attrib['yMax'])<=842 for w in words))
root.joinpath('pdf-verification.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
print(json.dumps({'passed':sum(c['passed'] for c in checks),'total':len(checks),'failures':[c for c in checks if not c['passed']]},ensure_ascii=False))
if not all(c['passed'] for c in checks):raise SystemExit(1)
