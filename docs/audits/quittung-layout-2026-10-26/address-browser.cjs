// Real React form + signature_pad + payment dialog, in-memory Supabase and document adapters.
// Run from repository root: node docs/audits/quittung-layout-2026-10-26/browser-flow.cjs
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(path.join(process.cwd(), 'package.json'));
const { build } = req('esbuild');
const { chromium } = req('playwright-core');
const root = process.cwd();
const artifacts = path.join(root, 'docs/audits/quittung-layout-2026-10-26');
const mocks = {
  '@/integrations/supabase/client': `export const supabase=window.auditSupabase;`,
  '@/hooks/useCompanyRecord': `const company={id:'company-fixture',company_name:'Test GmbH',email:'test@example.invalid',default_language:'de'};export const useCompanyRecord=()=>({company,companyId:company.id});`,
  '@/hooks/use-toast': `const toast=v=>window.auditToasts.push(v);export const useToast=()=>({toast});`,
  '@/i18n/useI18n': `import{createTranslator}from'@/i18n/translator';import{getDateFnsLocale}from'@/i18n/format';const value={t:createTranslator('de'),locale:'de',dateLocale:getDateFnsLocale('de'),companyLocale:'de'};export const useI18n=()=>value;export const useT=()=>value.t;`,
  '@/components/firma/KundeLink': `export const KundeLink=()=>null;`,
  '@/components/quittung/QuittungPDFPreview': `export const QuittungPDFPreview=({quittung})=><div data-testid='preview'>{quittung.quittung_nr}</div>;`,
  '@/lib/quittungDocuments': `export const resolveQuittungCompany=(q,live)=>q.company_snapshot??live;export const downloadQuittungDocument=async q=>window.auditDownloads.push(q);export const sendQuittungDocument=async q=>{window.auditSent.push(q);};export const generateQuittungBlob=async()=>new Blob(['synthetic']);`,
};
async function main() {
  await build({stdin:{contents:`import React,{useEffect}from'react';import{createRoot}from'react-dom/client';import{MemoryRouter,Routes,Route,useLocation}from'react-router-dom';import{HelmetProvider}from'react-helmet-async';import QuittungDetail from'@/pages/firma/QuittungDetail';function Probe(){const l=useLocation();useEffect(()=>{window.auditPath=l.pathname+l.search},[l]);return null;}createRoot(document.getElementById('root')).render(<HelmetProvider><MemoryRouter initialEntries={[window.auditEntry]}><Probe/><Routes><Route path='/firma/quittungen/:id' element={<QuittungDetail/>}/><Route path='/firma/quittungen' element={<div>List</div>}/></Routes></MemoryRouter></HelmetProvider>);`,loader:'tsx',resolveDir:root},bundle:true,format:'iife',jsx:'automatic',outfile:'/tmp/quittung-address-app.js',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/.*/},a=>{if(a.path==='@/pages/firma/QuittungDetail'&&process.env.QUITTUNG_ADDRESS_BEFORE==='1')return{path:'/tmp/QuittungDetail-before-address.tsx',namespace:'before-source'};if(mocks[a.path])return{path:a.path,namespace:'fixture'};if(a.path.startsWith('@/')){const base=path.join(root,'src',a.path.slice(2));return{path:base+(['.tsx','.ts','/index.ts'].find(ext=>fs.existsSync(base+ext))??'')}}});b.onLoad({filter:/.*/,namespace:'before-source'},a=>({contents:fs.readFileSync(a.path,'utf8'),loader:'tsx',resolveDir:root}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
  const browser=await chromium.launch({headless:true});
  const results=[];
  async function boot(entry='/firma/quittungen/neu?auftrag=job') {
    const page=await browser.newPage({viewport:{width:1100,height:1000}});page.setDefaultTimeout(10000);
    page.on('pageerror',e=>{console.error('BROWSER',e.message);results.push({scenario:'browser-error',message:e.message});});
    await page.setContent(`<style>body{font:14px sans-serif}input,button{min-height:25px}section{margin:10px}canvas{width:360px!important;height:145px!important}.relative:has(canvas),.relative:has(img){height:145px;width:360px;position:relative}img{height:145px;width:360px;object-fit:contain}.pointer-events-none{pointer-events:none}.absolute{position:absolute}.inset-0{top:0}button{margin:3px}</style><div id='root'></div>`);
    await page.evaluate(entry=>{
      window.auditEntry=entry;window.auditToasts=[];window.auditWrites=[];window.auditRpcs=[];window.auditSent=[];window.auditDownloads=[];window.auditRows=[];window.auditRejectSave=false;window.auditListeners=[];
      const item=(id,description,total,type='pauschale')=>({id,description,quantity:1,unit:'Pauschal',unit_price:total,total,price_type:type,position:1});
      window.auditOrders=[{id:'job',company_id:'company-fixture',offer_id:'offer-a',customer_id:'customer-a',customer_name:'Işıl Çiçek',customer_email:'a@example.invalid',customer_phone:'123',from_address:'Çiğdem Sokak 5/2\nc/o Işıl Çiçek, Haus C\n8000 Zürich',to_address:'Rue du Lac 8B\n1007 Lausanne',language:'fr',vat_rate:0,subtotal:900,pricing_type:'fixed',items:[item('main','Déménagement',1000),item('optional','Emballage',300,'optional')],extra_services:[]}];
      window.auditOffers=[{id:'offer-a',company_id:'company-fixture',offer_number:1,customer_id:'customer-a',customer_first_name:'Işıl',customer_last_name:'Çiçek',customer_email:'a@example.invalid',customer_phone:'123',language:'fr',vat_rate:0,subtotal:900,leads:{from_street:'Address A',from_house_number:null,from_plz:null,from_city:null,to_street:'Destination A',to_house_number:null,to_plz:null,to_city:null}},{id:'offer-b',company_id:'company-fixture',offer_number:2,customer_id:'customer-b',customer_first_name:'Customer',customer_last_name:'B',customer_email:null,customer_phone:null,language:'en',vat_rate:0,subtotal:200,leads:null}];
      window.auditInvoices=[{id:'invoice-a',company_id:'company-fixture',customer_id:'customer-a',customer_name:'Işıl Çiçek',rechnung_nr:'RE-1',status:'versendet',open_amount:900,paid_total:0}];
      const notify=()=>window.auditListeners.forEach(fn=>fn());
      const tableRows=table=>table==='quittungen'?window.auditRows:table==='offers'?window.auditOffers:table==='rechnungen'?window.auditInvoices:table==='auftraege'?window.auditOrders:table==='company_offer_settings'?[{company_id:'company-fixture',default_vat_rate:8.1}]:table==='offer_items'?[{...item('b','Service B',200),offer_id:'offer-b'}]:[];
      window.auditSupabase={
        from(table){const q={filters:[],mode:'read',payload:null,select(){return q},eq(k,v){q.filters.push([k,v]);return q},order(){return q},limit(){return q},update(payload){q.mode='update';q.payload=payload;return q},insert(payload){q.mode='insert';q.payload=payload;return q},single(){return q.execute(true)},maybeSingle(){return q.execute(true)},then(resolve,reject){return q.execute(false).then(resolve,reject)},async execute(single){
          if(q.mode!=='read'&&window.auditRejectSave)return{data:null,error:{message:'fixture-save-rejected'}};
          let rows=tableRows(table).filter(row=>q.filters.every(([k,v])=>row[k]===v));
          if(q.mode==='insert'){const row={...q.payload,id:'saved-'+(window.auditRows.length+1),quittung_nr:'QU-2026-0042',created_at:'2026-10-26T00:00:00Z',updated_at:'2026-10-26T00:00:00Z',customer_id:q.payload.customer_id??'customer-a',version:1,payment_id:null,payment_status:'open',paid_amount:0,payment_date:null,payment_method:null,payment_reference:null,issued_at:null,sent_at:null,company_snapshot:null,pdf_url:null};window.auditRows.push(row);rows=[row];window.auditWrites.push({mode:q.mode,payload:q.payload});}
          if(q.mode==='update'){rows=rows.map(row=>{Object.assign(row,q.payload,{version:row.version+1});return row});window.auditWrites.push({mode:q.mode,payload:q.payload});}
          return{data:single?(rows[0]?structuredClone(rows[0]):null):structuredClone(rows),error:null};
        }};return q;},
        channel(){const channel={on(_event,_filter,cb){window.auditListeners.push(cb);return channel},subscribe(){return channel}};return channel},removeChannel(){return Promise.resolve()},
        async rpc(name,args){window.auditRpcs.push({name,args});const q=window.auditRows.find(q=>q.id===args.p_quittung_id);
          if(name==='finalize_quittung'){if(q.version!==args.p_expected_version)return{data:null,error:{message:'version conflict'}};if(!q.issued_at){Object.assign(q,{kunde_unterschrift:args.p_kunde_unterschrift??null,teamchef_unterschrift:args.p_teamchef_unterschrift??null,kunde_signed_at:args.p_kunde_signed_at??null,teamchef_signed_at:args.p_teamchef_signed_at??null,status:args.p_kunde_unterschrift||args.p_teamchef_unterschrift?'signed':'issued',issued_at:'2026-10-26T00:00:00Z',company_snapshot:{company_name:'Test GmbH',email:'test@example.invalid'},version:q.version+1})}return{data:structuredClone(q),error:null};}
          if(name==='record_quittung_payment'){Object.assign(q,{payment_id:'payment-1',payment_status:'paid',paid_amount:q.gesamttotal,payment_method:args.p_method,payment_date:args.p_payment_date,betrag_noch_offen:false,version:q.version+1});notify();return{data:{payment_id:'payment-1'},error:null};}
          if(name==='record_payment'){const invoice=window.auditInvoices.find(i=>i.id===args.p_allocations[0].rechnung_id);Object.assign(invoice,{status:'bezahlt',open_amount:0,paid_total:args.p_amount});window.auditRows.filter(r=>r.rechnung_id===invoice.id).forEach(r=>Object.assign(r,{payment_status:'paid',paid_amount:args.p_amount,betrag_noch_offen:false,version:r.version+1}));notify();return{data:{payment_id:'invoice-payment'},error:null};}
          return{data:null,error:{message:'Unexpected RPC '+name}};
        },
      };
    },entry);
    await page.addScriptTag({path:'/tmp/quittung-address-app.js'});
    await page.locator('#customer_name').waitFor();
    return page;
  }
  const assert=(condition,message)=>{if(!condition)throw new Error(message)};
  let page=await boot('/firma/quittungen/neu');
  await page.evaluate(()=>Object.assign(window.auditOffers[0],{
    frozen_from_street:'Alte Landstrasse',frozen_from_house_number:'12a',frozen_from_plz:'8706',frozen_from_city:'Meilen',
    frozen_to_street:'Rue du Lac',frozen_to_house_number:'8B',frozen_to_plz:'1007',frozen_to_city:'Lausanne',
    leads:{from_street:'Changed lead street',from_house_number:null,from_plz:'8000',from_city:'Zürich',to_street:null,to_house_number:null,to_plz:null,to_city:null},
  }));
  await page.getByRole('combobox').first().click();
  await page.getByRole('option').filter({hasText:'Işıl Çiçek'}).click();
  assert(await page.locator('#customer_address').inputValue()==='Alte Landstrasse 12a, 8706 Meilen','Frozen origin address/house number missing');
  assert(await page.locator('#customer_destination').inputValue()==='Rue du Lac 8B, 1007 Lausanne','Frozen destination address/house number missing');
  await page.getByRole('button',{name:'Entwurf speichern',exact:true}).click();
  await page.waitForFunction(()=>window.auditRows.length===1);
  const savedOffer=await page.evaluate(()=>window.auditRows[0]);
  assert(savedOffer.customer_address==='Alte Landstrasse 12a, 8706 Meilen'&&savedOffer.customer_destination==='Rue du Lac 8B, 1007 Lausanne','Saved offer address differs from form');
  assert(savedOffer.customer_name==='Işıl Çiçek','Customer name rewritten');
  results.push({scenario:'offer-frozen-addresses-through-real-form-and-save',address:savedOffer.customer_address,destination:savedOffer.customer_destination,name:savedOffer.customer_name});
  await page.close();
  page=await boot();
  await page.getByRole('button',{name:'Entwurf speichern',exact:true}).click();
  await page.waitForFunction(()=>window.auditRows.length===1);
  const order=await page.evaluate(()=>({source:window.auditOrders[0],saved:window.auditRows[0]}));
  assert(order.saved.customer_address===order.source.from_address&&order.saved.customer_destination===order.source.to_address,'Authored order address was rewritten');
  results.push({scenario:'order-address-house-number-and-c-o-preserved-through-save',address:order.saved.customer_address,destination:order.saved.customer_destination});
  await page.close();
  fs.writeFileSync(path.join(artifacts,'address-browser-results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));await browser.close();
  if(results.some(r=>r.scenario==='browser-error'))throw new Error('Browser errors');
}
main().catch(error=>{console.error(error);process.exit(1)});
