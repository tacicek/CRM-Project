// Run: node docs/audits/quittung-house-number-2026-10-26/order-source-browser.cjs
// Actual AuftragModal save payload + pure receipt draft/payload. Synthetic data; no network/backend writes.
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require('playwright-core');
const root = process.cwd();
const mocks = {
  '@/integrations/supabase/client': `export const supabase=window.fixtureDb;`,
  '@/hooks/use-toast': `const toast=v=>window.toasts.push(v);export const useToast=()=>({toast});`,
  '@/i18n/useI18n': `import{createTranslator}from'@/i18n/translator';import{getDateFnsLocale}from'@/i18n/format';const value={t:createTranslator('de'),locale:'de',dateLocale:getDateFnsLocale('de')};export const useI18n=()=>value;export const useT=()=>value.t;`,
};
async function main() {
  await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import{AuftragModal}from'@/components/firma/AuftragModal';import{createReceiptDraftFromOrder,buildQuittungDraftPayload,getReceiptOfferAddresses}from'@/lib/quittungDraft';window.toReceipt=addresses=>buildQuittungDraftPayload(createReceiptDraftFromOrder({id:'order',offer_id:'offer',customer_id:null,customer_name:'Fixture Customer',customer_email:'fixture@example.invalid',customer_phone:null,language:'de',vat_rate:0,subtotal:100,pricing_type:'fixed',items:[{id:'item',description:'Moving',quantity:1,unit:'Pauschal',unit_price:100,total:100}],extra_services:[],...addresses},'2026-10-26',0),'company');window.directOfferAddresses=()=>getReceiptOfferAddresses({...window.fixtureOffer,leads:window.fixtureLead});createRoot(document.getElementById('root')).render(<AuftragModal isOpen companyId='company' offerId='offer' auftrag={window.fixtureOrder} onClose={()=>{}} onSuccess={()=>{}}/>);`,loader:'tsx',resolveDir:root},bundle:true,format:'iife',jsx:'automatic',outfile:'/tmp/quittung-order-source.js',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/.*/},a=>{if(mocks[a.path])return{path:a.path,namespace:'fixture'};if(a.path.startsWith('@/')){const base=path.join(root,'src',a.path.slice(2));return{path:base+(['.tsx','.ts','/index.ts'].find(ext=>fs.existsSync(base+ext))??'')}}});b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
  const browser=await chromium.launch({headless:true});
  const results=[];
  try {
    for(const scenario of ['frozen-offer-lead-number-removed','frozen-offer-lead-missing','frozen-offer-lead-unlinked','existing-authored-order','existing-numberless-order']) {
      const page=await browser.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.setContent('<div id="root"></div>');
      await page.evaluate(scenario=>{
        window.toasts=[];window.reads=[];window.writes=[];
        window.fixtureOffer={id:'offer',title:'Moving fixture',customer_first_name:'Fixture',customer_last_name:'Customer',customer_email:'fixture@example.invalid',customer_phone:null,lead_id:'lead',service_date:'2099-10-26',subtotal:100,vat_rate:0,vat_amount:0,total:100,status:'accepted',language:'de',frozen_from_street:'Alte Landstrasse',frozen_from_house_number:'12a',frozen_from_plz:'8706',frozen_from_city:'Meilen',frozen_from_floor:0,frozen_from_has_lift:false,frozen_to_street:'Rue du Lac',frozen_to_house_number:'8B',frozen_to_plz:'1007',frozen_to_city:'Lausanne',frozen_to_floor:1,frozen_to_has_lift:true};
        window.fixtureLead=scenario==='frozen-offer-lead-missing'?null:{id:'lead',service_type:'umzug',language:'de',from_street:'Alte Landstrasse',from_house_number:null,from_plz:'8706',from_city:'Meilen',from_floor:9,from_has_lift:true,to_street:'Rue du Lac',to_house_number:null,to_plz:'1007',to_city:'Lausanne',to_floor:8,to_has_lift:false,piano_type:null,piano_weight_kg:null,estimated_duration_minutes:120,from_rooms:null,from_living_space_m2:null,property_type:null,distance_km:null,packing_service_needed:null,cleaning_service_needed:null,storage_needed:null};
        if(scenario==='frozen-offer-lead-unlinked'){window.fixtureLead=null;window.fixtureOffer.lead_id=null;}
        if(scenario.startsWith('existing-'))window.fixtureOrder={id:'order',auftrag_nummer:'A-FIXTURE',offer_id:'offer',lead_id:'lead',title:'Existing order',customer_name:'Fixture Customer',customer_first_name:'Fixture',customer_last_name:'Customer',customer_email:'fixture@example.invalid',from_address:scenario==='existing-authored-order'?'Operator Street 99\nc/o Customer\n8000 Zürich':'Alte Landstrasse\n8706 Meilen',to_address:scenario==='existing-authored-order'?'Custom destination 88C\n1007 Lausanne':'Rue du Lac\n1007 Lausanne',scheduled_date:'2099-10-26',service_type:'umzug',vat_rate:0,subtotal:100,total:100,vat_amount:0,status:'geplant',assigned_team_members:[],items:[],extra_services:[],service_details:{}};
        window.fixtureDb={from(table){const q={mode:'read',select(){return q},eq(){return q},order(){return q},limit(){return q},insert(payload){q.mode='insert';q.payload=payload;return q},update(payload){q.mode='update';q.payload=payload;return q},single(){return q.exec(true)},maybeSingle(){return q.exec(true,true)},then(resolve,reject){return q.exec(false).then(resolve,reject)},async exec(single,optional=false){window.reads.push(table);if(q.mode!=='read'){window.writes.push({table,mode:q.mode,payload:q.payload});if(table==='auftraege')window.savedOrder={...window.fixtureOrder,...q.payload,id:'saved-order',customer_id:null};return{data:single?{id:'saved-id'}:null,error:null};}const rows=table==='offers'?[window.fixtureOffer]:table==='leads'?(window.fixtureLead?[window.fixtureLead]:[]):table==='appointments'?[{id:'existing-appointment'}]:table==='offer_items'?[{id:'item',position:1,description:'Moving',quantity:1,unit:'Pauschal',unit_price:100,total:100}]:[];return{data:single?rows[0]??null:rows,error:single&&!optional&&!rows.length?{message:'Fixture missing lead'}:null}}};return q}};
      },scenario);
      await page.addScriptTag({path:'/tmp/quittung-order-source.js'});
      const fields=page.getByPlaceholder('Strasse Nr.\nPLZ Ort\nStock (Lift)',{exact:true});
      await fields.first().waitFor({state:'visible',timeout:10000});
      await page.waitForFunction(()=>window.reads.includes('team_members'));
      await page.waitForTimeout(100);
      const addresses={from_address:await fields.nth(0).inputValue(),to_address:await fields.nth(1).inputValue()};
      await page.getByRole('button',{name:scenario.startsWith('existing-')?'Speichern':'Auftrag erstellen',exact:true}).click();
      await page.waitForFunction(()=>window.savedOrder||window.toasts.some(t=>t.variant==='destructive'),null,{timeout:10000});
      const pipeline=await page.evaluate(()=>({directOffer:window.directOfferAddresses(),receiptPayload:window.savedOrder?window.toReceipt(window.savedOrder):null,toasts:window.toasts,originalOrder:window.fixtureOrder,savedOrder:window.savedOrder,writes:window.writes}));
      if(!pipeline.savedOrder)throw new Error('Order save failed '+JSON.stringify(pipeline.toasts));
      const preserved=scenario.startsWith('existing-')?addresses.from_address===pipeline.originalOrder.from_address&&addresses.to_address===pipeline.originalOrder.to_address:addresses.from_address.includes('12a')&&addresses.to_address.includes('8B');
      const accessConsistent=scenario!=='frozen-offer-lead-number-removed'||(pipeline.savedOrder.service_details.from_floor===0&&pipeline.savedOrder.service_details.from_has_lift===false&&pipeline.savedOrder.service_details.to_floor===1&&pipeline.savedOrder.service_details.to_has_lift===true);
      const passed=preserved&&accessConsistent&&errors.length===0&&pipeline.savedOrder.vat_rate===0&&pipeline.savedOrder.service_type===(scenario==='frozen-offer-lead-missing'||scenario==='frozen-offer-lead-unlinked'?null:'umzug')&&pipeline.receiptPayload.customer_address===addresses.from_address&&pipeline.receiptPayload.customer_destination===addresses.to_address;
      results.push({scenario,offerFrozen:{from_number:'12a',to_number:'8B'},orderForm:addresses,savedOrder:{from_address:pipeline.savedOrder.from_address,to_address:pipeline.savedOrder.to_address,service_type:pipeline.savedOrder.service_type,vat_rate:pipeline.savedOrder.vat_rate,service_details:pipeline.savedOrder.service_details},receiptCustomerAddress:pipeline.receiptPayload.customer_address,receiptDestination:pipeline.receiptPayload.customer_destination,directOfferPath:pipeline.directOffer,toasts:pipeline.toasts,pageErrors:errors,passed});
      await page.close();
    }
  } finally {
    await browser.close();fs.writeFileSync(path.join(__dirname,'order-source-results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
  }
  if(results.some(r=>!r.passed))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
