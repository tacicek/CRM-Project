const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
const source = fs.readFileSync(process.cwd() + '/supabase/functions/send-quittung/index.ts','utf8').replace(/^import[\s\S]*?;\n/gm,'');
const js = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
async function run(name, overrides={}, failUpdate=false, attempts=1, attachment='JVBERi0xLjQK') {
  let handler; const sent=[]; const updates=[];
  const q={id:'q1',quittung_nr:'QU-2026-0001',datum:'2026-10-25',customer_name:'Test Müşteri',customer_email:'test@example.invalid',gesamttotal:108.1,mwst_satz:8.1,mwst_betrag:8.1,rabatt:0,zwischensumme:100,status:'signed',betrag_noch_offen:true,language:'de',positionen:[{beschreibung:'Test',satz:'1',betrag:100,checked:true,is_custom:false}],companies:{id:'c1',company_name:'Test GmbH',email:'firma@example.invalid',default_language:'de'},...overrides};
  const db={auth:{getUser:async()=>({data:{user:{id:'u1'}},error:null})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:q,error:null})})}),update:(payload)=>({eq:async()=>{updates.push(payload);if(!failUpdate)Object.assign(q,payload);return {error:failUpdate?{message:'Injected DB write failure'}:null};}})})};
  const sandbox={Request,Response,console,JSON,Date,serve:fn=>handler=fn,Deno:{env:{get:()=> 'test-no-secret'}},createClient:()=>db,verifyCompanyMembership:async()=>true,loadCompanySecrets:async()=>({}),Resend:class{emails={send:async(payload)=>{sent.push(payload);return{data:{id:'e'+sent.length},error:null};}}},logEmail:async()=>{},getSenderEmail:()=> 'noreply@example.invalid',toLocale:x=>x,createTranslator:()=> key=>key,buildInvoiceEmailSubject:()=> 'Test receipt',buildInvoiceEmailHtml:()=> '<p>Test</p>',wrapEmailDocument:html=>html,EMAIL_FONT_STACK:'sans-serif',fmtDate:x=>x,fmtChf:x=>x};
  vm.runInNewContext(js,sandbox,{filename:'send-quittung.transpiled.js'});
  let response;
  for(let n=0;n<attempts;n++){response=await handler(new Request('https://example.invalid/send',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({quittungId:'q1',...(attachment===null?{}:{quittungPdfBase64:attachment})})}));}
  return {name,http:response.status,result:await response.json(),finalStatus:q.status,updates,emailCount:sent.length,hasAttachment:!!sent[0]?.attachments?.length,internalClaimsSigned:sent[1]?.html?.includes('wurde unterzeichnet'),internalHtmlContainsRawTag:sent[1]?.html?.includes('<a href="https://example.invalid">Injected</a>')};
}
(async()=>{
const cases=[];
cases.push(await run('Paid receipt resent',{status:'paid'}));
cases.push(await run('DB update fails but response succeeds',{},true));
cases.push(await run('Same request retried twice',{},false,2));
cases.push(await run('Unsigned draft and missing PDF',{status:'draft'},false,1,null));
cases.push(await run('Unescaped customer-name markup',{customer_name:'<a href="https://example.invalid">Injected</a>'}));
for(const c of cases)console.log(JSON.stringify(c));
})();
