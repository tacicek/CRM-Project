// Baseline: node docs/audits/quittung-download-2026-10-26/frontend-download.cjs
// Fixed regression: node docs/audits/quittung-download-2026-10-26/frontend-download.cjs --fixed
// Real detail/list -> row mapper -> document helper -> installed Supabase SDK ->
// browser fetch/download. Only backend data and transport are fixtures. No live access.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createHash } = require('node:crypto');
const fixed = process.argv.includes('--fixed');
const { build } = require('esbuild');
const { chromium } = require('playwright-core');
const root = process.cwd();
const out = __dirname;
const buildDir = '/tmp/quittung-download-browser';
const mocks = {
  '@/integrations/supabase/client': `export const supabase=window.auditSupabase;`,
  '@/hooks/useCompanyRecord': `const company={id:'10000000-0000-4000-8000-000000000001',company_name:'Fixture GmbH',email:'fixture@example.invalid',default_language:'de'};export const useCompanyRecord=()=>({company,companyId:company.id});`,
  '@/hooks/use-toast': `const toast=v=>window.auditToasts.push(v);export const useToast=()=>({toast});`,
  '@/i18n/useI18n': `import{createTranslator}from'@/i18n/translator';import{getDateFnsLocale}from'@/i18n/format';const value={t:createTranslator('de'),locale:'de',dateLocale:getDateFnsLocale('de'),companyLocale:'de'};export const useI18n=()=>value;export const useT=()=>value.t;`,
  '@/components/firma/KundeLink': `export const KundeLink=()=>null;`,
  '@/hooks/useQuittungen': `export const useQuittungen=()=>({quittungen:[window.auditRow],loading:false,error:null,count:1,stats:{total:1,issued:1,paid:1,open:0},pageSize:25,fetchQuittungen:async()=>{},deleteQuittung:async()=>false});`,
};
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter,Routes,Route}from'react-router-dom';import{HelmetProvider}from'react-helmet-async';import{createClient}from'@supabase/supabase-js';import Detail from'@/pages/firma/QuittungDetail';import List from'@/pages/firma/Quittungen';import{publicReceiptPdfUrl}from'./supabase/functions/send-quittung/document.ts';
const transport=async(input,init)=>{const u=new URL(typeof input==='string'?input:input.url);window.auditSdk.push({host:u.host,path:u.pathname,method:init?.method??'GET'});if(u.pathname.includes('/object/upload/sign/')&&init?.method==='PUT'){const file=init.body.get('');window.auditUploadedBytes=Array.from(new Uint8Array(await file.arrayBuffer()));return new Response(JSON.stringify({Key:'document-pdfs/fixture.pdf'}),{status:200,headers:{'content-type':'application/json'}})}if(u.pathname.includes('/object/sign/'))return new Response(JSON.stringify({signedURL:'/object/sign/document-pdfs/fixture.pdf?token=fixture'}),{status:200,headers:{'content-type':'application/json'}});throw new Error('Unexpected SDK request '+u.pathname)};
const signedClient=createClient(window.auditOrigin,'fixture-public-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transport}});
window.auditSupabase.storage=createClient('https://fixture-storage.invalid','fixture-public-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transport}}).storage;window.auditSupabase.functions={invoke:async(_name,{body})=>{window.auditActions.push(body);if(body.action==='lookup'&&window.auditNewArchive)return{data:{document:null},error:null};if(body.action==='prepare')return{data:{path:'fixture.pdf',token:'fixture-token'},error:null};const signed=await signedClient.storage.from('document-pdfs').createSignedUrl('fixture.pdf',300);return{data:{document:{id:'30000000-0000-4000-8000-000000000003',version:window.auditRow.version,sha256:'fixture'},url:window.auditFixed?publicReceiptPdfUrl(signed.data.signedUrl,window.auditPublicOrigin,'https://fixture-crm.invalid'):signed.data.signedUrl},error:null}}};
createRoot(document.getElementById('root')).render(<HelmetProvider><MemoryRouter initialEntries={[window.auditEntry]}><Routes><Route path='/firma/quittungen/:id' element={<Detail/>}/><Route path='/firma/quittungen' element={<List/>}/></Routes></MemoryRouter></HelmetProvider>);`;

async function main() {
  fs.mkdirSync(buildDir,{recursive:true});
  await build({stdin:{contents:entry,loader:'tsx',resolveDir:root},bundle:true,format:'iife',jsx:'automatic',outfile:path.join(buildDir,'app.js'),loader:{'.ttf':'file'},plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/.*/},a=>{if(mocks[a.path])return{path:a.path,namespace:'fixture'};if(a.path.startsWith('@/')){const base=path.join(root,'src',a.path.slice(2));return{path:fs.existsSync(base)&&fs.statSync(base).isFile()?base:base+(['.tsx','.ts','/index.ts'].find(ext=>fs.existsSync(base+ext))??'')}}});b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
  const server=http.createServer((req,res)=>{const file=path.join(buildDir,new URL(req.url,'http://localhost').pathname);if(fs.existsSync(file)&&fs.statSync(file).isFile()){res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':'application/octet-stream'});res.end(fs.readFileSync(file));}else{res.writeHead(200,{'Content-Type':'text/html'});res.end('<style>canvas{width:360px;height:145px}button{margin:5px}</style><div id="root"></div>');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  const results=[];
  try {
    for(const scenario of (fixed ? [
      {name:'fixed-paid-detail-existing-public-storage',view:'detail',state:'paid',origin:'http://kong:8000',publicOrigin:'https://fixture-storage.invalid',expectedDownload:true},
      {name:'fixed-paid-list-existing-crm-proxy',view:'list',state:'paid',origin:'http://kong:8000',publicOrigin:'http://public-storage.invalid:8000',expectedDownload:true},
      {name:'fixed-paid-detail-first-archive-crm-proxy',view:'detail',state:'paid',origin:'http://kong:8000',publicOrigin:'http://public-storage.invalid:8000',newArchive:true,expectedDownload:true},
      {name:'fixed-paid-list-first-archive-public-storage',view:'list',state:'paid',origin:'http://kong:8000',publicOrigin:'https://fixture-storage.invalid',newArchive:true,expectedDownload:true},
      {name:'fixed-paid-preview-existing-crm-proxy',view:'detail',state:'paid',origin:'http://kong:8000',publicOrigin:'http://public-storage.invalid:8000',preview:true,expectedDownload:true},
      {name:'fixed-paid-preview-first-archive-crm-proxy',view:'detail',state:'paid',origin:'http://kong:8000',publicOrigin:'http://public-storage.invalid:8000',preview:true,newArchive:true,expectedDownload:true},
    ] : [
      {name:'paid-detail-internal-signed-url',view:'detail',state:'paid',origin:'http://kong:8000',expectedDownload:false},
      {name:'paid-list-internal-signed-url',view:'list',state:'paid',origin:'http://kong:8000',expectedDownload:false},
      {name:'paid-detail-public-signed-url',view:'detail',state:'paid',origin:'https://fixture-storage.invalid',expectedDownload:true},
      {name:'paid-list-public-signed-url',view:'list',state:'paid',origin:'https://fixture-storage.invalid',expectedDownload:true},
      {name:'paid-detail-new-archive-internal-signed-url',view:'detail',state:'paid',origin:'http://kong:8000',newArchive:true,expectedDownload:false},
      {name:'paid-detail-new-archive-public-signed-url',view:'detail',state:'paid',origin:'https://fixture-storage.invalid',newArchive:true,expectedDownload:true},
      {name:'draft-detail-local-render',view:'detail',state:'draft',origin:'http://kong:8000',expectedDownload:true},
    ])) {
      const page=await browser.newPage();
      const downloads=[],downloadFiles=[],failures=[],errors=[],publicFetches=[];
      page.on('download',d=>{downloads.push(d.suggestedFilename());downloadFiles.push(d.path());void page.evaluate(()=>window.__downloadObserved=true).catch(()=>{});});
      page.on('requestfailed',r=>failures.push({protocol:new URL(r.url()).protocol,host:new URL(r.url()).host,path:new URL(r.url()).pathname,error:r.failure()?.errorText}));
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('http://kong:8000/**',r=>r.abort('namenotresolved'));
      await page.route(/^https:\/\/fixture-(?:storage|crm)\.invalid\//,async r=>{const url=new URL(r.request().url());publicFetches.push({protocol:url.protocol,host:url.host,path:url.pathname});const uploaded=await page.evaluate(()=>window.auditUploadedBytes);return r.fulfill({status:200,contentType:'application/pdf',headers:{'Access-Control-Allow-Origin':'*'},body:uploaded?Buffer.from(uploaded):'%PDF-1.4\nfixture archived immutable bytes\n%%EOF'});});
      await page.goto(base);
      await page.evaluate(s=>{
        window.auditToasts=[];window.auditWrites=[];window.auditActions=[];window.auditSdk=[];window.auditOrigin=s.origin;window.auditFixed=s.fixed;window.auditPublicOrigin=s.publicOrigin;window.auditNewArchive=s.newArchive??false;
        window.auditEntry=s.view==='list'?'/firma/quittungen':'/firma/quittungen/20000000-0000-4000-8000-000000000002';
        const frozen=s.state!=='draft';
        window.auditRow={id:'20000000-0000-4000-8000-000000000002',company_id:'10000000-0000-4000-8000-000000000001',status:s.state,quittung_nr:'QU-FIXTURE',datum:'2026-10-26',language:'de',customer_name:'Fixture Customer',customer_email:'customer@example.invalid',positionen:[{id:'p1',beschreibung:'Fixture service',satz:'',betrag:100,checked:true,is_custom:false}],zwischensumme:100,rabatt:0,total:100,mwst_satz:0,mwst_betrag:0,gesamttotal:100,issued_at:frozen?'2026-10-26T00:00:00Z':null,company_snapshot:frozen?{company_name:'Frozen GmbH',email:'frozen@example.invalid'}:null,version:4,payment_status:frozen?'paid':'open',paid_amount:frozen?100:0,payment_open_amount:frozen?0:100,payment_date:frozen?'2026-10-26':null,payment_method:frozen?'cash':null,betrag_noch_offen:!frozen,rechnung_id:null,sent_at:null};
        window.auditSupabase={from(table){const q={mode:'read',select(){return q},eq(){return q},order(){return q},update(payload){q.mode='update';q.payload=payload;return q},single(){return q.exec(true)},maybeSingle(){return q.exec(true)},then(resolve,reject){return q.exec(false).then(resolve,reject)},async exec(single){if(q.mode==='update'){window.auditWrites.push(q.payload);Object.assign(window.auditRow,q.payload,{version:window.auditRow.version+1});}const rows=table==='quittungen'?[window.auditRow]:table==='company_offer_settings'?[{default_vat_rate:0}]:[];return{data:single?rows[0]??null:structuredClone(rows),error:null}}};return q},channel(){const c={on(){return c},subscribe(){return c}};return c},removeChannel(){return Promise.resolve()}};
      },{...scenario,fixed});
      await page.addScriptTag({url:base+'/app.js'});
      if(scenario.preview){await page.getByRole('button',{name:'PDF-Vorschau',exact:true}).click();await page.locator('iframe[title="PDF-Vorschau"]').waitFor({state:'attached',timeout:20000});await page.getByRole('link',{name:'PDF herunterladen',exact:true}).click();}
      else await page.getByRole('button',{name:'PDF herunterladen',exact:true}).first().click();
      await page.waitForFunction(()=>window.auditToasts.length>0||window.__downloadObserved===true,null,{timeout:20000}).catch(()=>{});
      // Download events originate outside the page; bridge observed event once ready.
      if(!downloads.length&&!await page.evaluate(()=>window.auditToasts.length))throw new Error('No download or visible error for '+scenario.name);
      const state=await page.evaluate(()=>({toasts:window.auditToasts,writes:window.auditWrites,actions:window.auditActions,sdk:window.auditSdk,uploadedPdfBytes:window.auditUploadedBytes?.length??0,previewBlobUrl:document.querySelector('iframe[title="PDF-Vorschau"]')?.getAttribute('src')?.startsWith('blob:')??false}));
      const storedBytes=await page.evaluate(()=>window.auditUploadedBytes);
      const expectedBytes=storedBytes?Buffer.from(storedBytes):Buffer.from('%PDF-1.4\nfixture archived immutable bytes\n%%EOF');
      const receivedFiles=await Promise.all(downloadFiles);
      const namedDownload=downloads.indexOf('Quittung-QU-FIXTURE.pdf');
      const downloadedBytes=namedDownload>=0?fs.readFileSync(receivedFiles[namedDownload]):null;
      state.explicitNamedDownload=namedDownload>=0;
      state.publicFetches=publicFetches;
      state.headlessPdfViewerDownload=failures.some(f=>f.protocol==='blob:'&&f.error==='net::ERR_ABORTED');
      state.archivedBytesMatch=scenario.state==='draft'?null:downloadedBytes?downloadedBytes.equals(expectedBytes):null;
      if(downloadedBytes)state.downloadSha256=createHash('sha256').update(downloadedBytes).digest('hex');
      const actualDownload=downloads.length>0;
      const verdict=actualDownload===scenario.expectedDownload&&errors.length===0&&(scenario.state==='draft'||state.writes.length===0)&&(!fixed||(state.archivedBytesMatch===true&&state.explicitNamedDownload&&failures.every(f=>f.protocol==='blob:'&&f.error==='net::ERR_ABORTED')&&(!scenario.preview||state.previewBlobUrl)));
      results.push({...scenario,actualDownload,downloads,...state,failures,pageErrors:errors,passed:verdict});
      await page.close();
      if(!verdict)throw new Error('Unexpected result '+scenario.name);
    }
  } finally {
    await browser.close();await new Promise(resolve=>server.close(resolve));
    fs.writeFileSync(path.join(out,fixed?'frontend-download-after.json':'frontend-download-results.json'),JSON.stringify(results,null,2)+'\n');
    process.stdout.write(JSON.stringify(results,null,2)+'\n');
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});
