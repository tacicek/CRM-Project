import{r as e}from"./vendor-react-BGKb2mo_.js";import{s as a}from"./index-A_Ol3obB.js";import"./vendor-qr-Cat9Pybo.js";import"./vendor-supabase-C6YMG9od.js";import"./vendor-pdf-zgGboKZO.js";import"./vendor-ui-B0Prgq4E.js";import"./vendor-icons-Bb6Bx1mG.js";import"./vendor-query-xEFYXQG3.js";import"./vendor-router-BzWVLfdi.js";import"./vendor-form-B4-aDMoP.js";const n=`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /firma/
Disallow: /auth
Disallow: /embed/
Sitemap: https://offerio.ch/sitemap.xml`;function h(){const[o,i]=e.useState(n);return e.useEffect(()=>{(async()=>{try{const{data:t,error:s}=await a.from("website_settings").select("setting_value").eq("is_active",!0).eq("setting_key","seo_global").single();if(s)throw s;if(t?.setting_value){const r=t.setting_value;r.robots_txt&&i(r.robots_txt)}}catch(t){console.error("Error fetching robots.txt:",t)}})()},[]),e.useEffect(()=>{document.body.innerHTML=`<pre style="white-space: pre-wrap; font-family: monospace;">${o}</pre>`,document.title="robots.txt"},[o]),null}export{h as default};
