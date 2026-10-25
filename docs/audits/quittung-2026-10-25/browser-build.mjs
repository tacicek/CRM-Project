import { build } from 'esbuild';
import fs from 'node:fs';
const root=process.cwd();
const mocks={
 '@/integrations/supabase/client':`export const supabase=window.auditSupabase;`,
 '@/hooks/useCompanyRecord':`const company={id:'company-fixture',company_name:'Audit GmbH',email:'audit@example.invalid',default_language:'de'}; export const useCompanyRecord=()=>({company,companyId:company.id});`,
 '@/hooks/use-toast':`const toast=(v)=>window.auditToasts.push(v); export const useToast=()=>({toast});`,
 '@/i18n/useI18n':`import {documentI18nFor} from '@/i18n/documentLocale'; export const useI18n=()=>({...documentI18nFor('de'),locale:'de'});`,
 '@/lib/logoToBase64':`export const logoToBase64=async()=>null;`,
 '@/components/firma/KundeLink':`export const KundeLink=()=>null;`,
 '@/components/quittung/QuittungPDFPreview':`export const QuittungPDFPreview=()=>null;`,
 '@/components/quittung/QuittungPDF':`export const QuittungPDF=()=>null;`,
 '@react-pdf/renderer':`import React from 'react';export const PDFDownloadLink=({children,document})=>{window.auditDownload=document.props.quittung; return children({loading:false})}; export const pdf=(element)=>({toBlob:async()=>{window.auditEmailPDF=element.props.quittung;return new Blob(['mock-pdf'],{type:'application/pdf'})}});`
};
await build({stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {HelmetProvider} from 'react-helmet-async';import QuittungDetail from '@/pages/firma/QuittungDetail';createRoot(document.getElementById('root')).render(<HelmetProvider><MemoryRouter initialEntries={[window.auditEntry||'/firma/quittungen/neu']}><Routes><Route path='/firma/quittungen/:id' element={<QuittungDetail/>}/><Route path='/firma/quittungen' element={<div>List</div>}/></Routes></MemoryRouter></HelmetProvider>);`,loader:'tsx',resolveDir:root},bundle:true,format:'iife',outfile:'/tmp/quittung-audit/app.js',jsx:'automatic',plugins:[{name:'audit-mocks',setup(b){b.onResolve({filter:/.*/},a=>{if(mocks[a.path])return {path:a.path,namespace:'audit'};if(a.path.startsWith('@/'))return {path:root+'/src/'+a.path.slice(2)+(['.tsx','.ts','/index.ts'].find(ext=>fs.existsSync(root+'/src/'+a.path.slice(2)+ext))||'')};});b.onLoad({filter:/.*/,namespace:'audit'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
