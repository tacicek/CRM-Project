import subprocess,json
from pathlib import Path
root=Path('/tmp/quittung-pdf-audit')
texts={}
for p in sorted(root.glob('*.pdf')):
 text=subprocess.check_output(['pdftotext','-layout',str(p),'-']).decode()
 p.with_suffix('.pdf.txt').write_text(text)
 texts[p.stem]=text
summary=[]
for n in ['draft','signed','sent','paid']:
 t=texts[n]
 summary.append({'case':n,'pages':t.count('\f'),'has_total_1081':"CHF 1'081.00" in t,'has_discount_50':'-CHF 50.00' in t})
long=texts['long'].split('\f')
summary.extend([
 {'case':'turkish','source_name_preserved':'Işıl Çiçek Şahin Güneş Ğğ İı' in texts['turkish'],'observed':'I_1l Çiçek ^ahin Güne_ 01'},
 {'case':'pagination','page1_has_rate_for_position13':'13 Std.' in long[0],'page1_has_description13':'Position 13:' in long[0],'page2_has_description13':'Position 13:' in long[1],'page2_has_table_header':'BESCHREIBUNG' in long[1],'page2_has_receipt_number':'QU-2026-0042' in long[1]},
 {'case':'timezone','stored_date':'2026-10-25','LA_output_is_previous_day':'Datum: 24.10.2026' in texts['signed-image-la'],'zurich_sign_time':'10:30','bangkok_sign_time':'16:30','LA_sign_time':'02:30'}
])
root.joinpath('checks.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print(json.dumps(summary,ensure_ascii=False,indent=2))
