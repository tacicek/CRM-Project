import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1000,height:1000}});
page.on('pageerror',e=>console.log('BROWSER ERROR',e.message));
const results=[];
async function boot(existing=null){
 await page.goto('about:blank');
 await page.setContent(`<html><style>canvas {width:360px!important;height:140px!important} canvas:parent{height:140px} .hidden{display:none} button {min-height:25px} input {min-height:20px}</style><div id="root"></div></html>`);
 await page.evaluate((row)=>{
 window.auditEntry=row?'/firma/quittungen/'+row.id:'/firma/quittungen/neu';window.auditToasts=[];window.auditWrites=[];window.auditCalls=[];window.auditRow=row;window.auditFailSave=false;
 window.auditSupabase={
 from(table){const q={mode:'read',payload:null,select(){return q},eq(){return q},order(){return q},limit(){return Promise.resolve({data:[{id:'offer-B',offer_number:2,customer_first_name:'Customer',customer_last_name:'B',customer_email:null,customer_phone:null,leads:null}]})},maybeSingle(){return Promise.resolve({data:window.auditRow})},update(payload){q.mode='update';q.payload=payload;return q},insert(payload){q.mode='insert';q.payload=payload;return q},single(){return q.then(v=>({...v,data:{id:'saved-id',quittung_nr:'Q-2026-0042'}}))},then(resolve){if(q.mode!=='read')window.auditWrites.push({mode:q.mode,payload:q.payload});return Promise.resolve({error:window.auditFailSave?{message:'fixture-save-rejected'}:null}).then(resolve)}};return q;},
 auth:{getSession:async()=>({data:{session:{access_token:'fixture-token'}}})},functions:{invoke:async(name,args)=>{window.auditCalls.push({name,args});return {error:null}}}};
 },existing);
 await page.addScriptTag({path:'/tmp/quittung-audit/app.js'});
 await page.getByPlaceholder('Vor- und Nachname').waitFor();
}
const snapshot=(overrides={})=>({id:'existing-id',company_id:'company-fixture',quittung_nr:'Q-2026-0041',datum:'2026-10-25',customer_name:'Audit Customer',customer_email:'audit@example.invalid',language:'de',status:'draft',positionen:[{id:'p1',beschreibung:'Service',satz:'',betrag:100,checked:true,is_custom:true}],mwst_satz:8.1,rabatt:0,zwischensumme:100,total:100,mwst_betrag:8.1,gesamttotal:108.1,betrag_noch_offen:false,...overrides});
await boot();
await page.getByPlaceholder('Vor- und Nachname').fill('Audit Customer');
await page.getByPlaceholder('kunde@email.ch').fill('audit@example.invalid');
await page.getByRole('button',{name:'Per E-Mail versenden'}).click();
await page.waitForFunction(()=>window.auditCalls.length===1);
results.push({scenario:'first-save-email',...await page.evaluate(()=>({dbNumber:'Q-2026-0042',emailPDFNumber:window.auditEmailPDF.quittung_nr,emailPDFId:window.auditEmailPDF.id,uiPDFNumber:window.auditDownload.quittung_nr}))});
await boot(snapshot());
results.push({scenario:'discount-draft',visibleCount:await page.getByText('Rabatt:',{exact:true}).count()});
await boot(snapshot({status:'signed',kunde_unterschrift:null}));
const discount=page.locator('input[type=number]').last();
results.push({scenario:'discount-signed',visibleCount:await page.getByText('Rabatt:',{exact:true}).count(),disabled:await discount.isDisabled()});
await page.getByRole('button',{name:'Entwurf speichern'}).click();
results.push({scenario:'signed-save-draft',...await page.evaluate(()=>({writtenStatus:window.auditWrites.at(-1).payload.status,mockUiStatusAfter:window.auditDownload.status,scopeNote:'Real SQL guard rejects this regression; this checks UI payload only.'}))});
await boot(snapshot({offer_id:'offer-A'}));
await page.getByTitle('Verknüpfung aufheben').click();
await page.getByRole('button',{name:'Entwurf speichern'}).click();
results.push({scenario:'unlink-offer',...await page.evaluate(()=>({hasOfferId:JSON.stringify(window.auditWrites.at(-1).payload).includes('offer_id'),sentPayload:JSON.parse(JSON.stringify(window.auditWrites.at(-1).payload)).offer_id??'omitted'}))});
await boot();
await page.getByRole('button',{name:'Entwurf speichern'}).click();
results.push({scenario:'blank-form-save',...await page.evaluate(()=>({writes:window.auditWrites.length,name:window.auditWrites[0].payload.customer_name,total:window.auditWrites[0].payload.gesamttotal}))});
await boot();
await page.evaluate(()=>window.auditFailSave=true);
await page.getByRole('button',{name:'PDF-Vorschau'}).click();
results.push({scenario:'preview-after-save-failure',formButtonVisible:await page.getByRole('button',{name:'Formular',exact:true}).isVisible(),...await page.evaluate(()=>({errors:window.auditToasts}))});
await boot(snapshot());
const canvases=page.locator('canvas');
async function draw(index){const b=await canvases.nth(index).boundingBox();await page.mouse.move(b.x+20,b.y+30);await page.mouse.down();await page.mouse.move(b.x+80,b.y+60,{steps:10});await page.mouse.move(b.x+160,b.y+25,{steps:10});await page.mouse.up();}
await draw(0);
await page.getByRole('button',{name:'Bestätigen',exact:true}).first().click();
await draw(1);
await page.getByRole('button',{name:'Unterschriften bestätigen',exact:true}).click();
results.push({scenario:'customer-confirmed-team-only-drawn',...await page.evaluate(()=>({payloadCustomer:!!window.auditWrites.at(-1).payload.kunde_unterschrift,payloadTeam:!!window.auditWrites.at(-1).payload.teamchef_unterschrift,uiTeam:!!window.auditDownload.teamchef_unterschrift,toast:window.auditToasts.at(-1)}))});
await boot(snapshot({status:'signed',kunde_unterschrift:'data:image/png;base64,'+fs.readFileSync(new URL('./signature.png',import.meta.url)).toString('base64')}));
await page.getByPlaceholder('Vor- und Nachname').fill('Changed Customer');
await page.getByRole('button',{name:'Per E-Mail versenden'}).click();
await page.waitForFunction(()=>window.auditCalls.length===1);
results.push({scenario:'signed-change-customer-and-send',...await page.evaluate(()=>({name:window.auditWrites.at(-1).payload.customer_name,status:window.auditWrites.at(-1).payload.status,signatureRetained:!!window.auditWrites.at(-1).payload.kunde_unterschrift}))});
await boot(snapshot({offer_id:'offer-A',customer_name:'Customer A',customer_email:'a@example.invalid',customer_address:'Address A'}));
await page.getByRole('combobox').first().click();
await page.getByRole('option').filter({hasText:'Customer B'}).click();
await page.getByRole('button',{name:'Entwurf speichern'}).click();
results.push({scenario:'switch-offer-to-customer-with-missing-contact',...await page.evaluate(()=>({name:window.auditWrites.at(-1).payload.customer_name,email:window.auditWrites.at(-1).payload.customer_email,address:window.auditWrites.at(-1).payload.customer_address,offer:window.auditWrites.at(-1).payload.offer_id}))});
console.log(JSON.stringify(results,null,2));
fs.writeFileSync('/tmp/quittung-audit/results.json',JSON.stringify(results,null,2));
await browser.close();
