import{r as a,j as e}from"./vendor-react-BGKb2mo_.js";import{s as N,k as x,H as Ze,B as d,e as m,I as A,T as _,q as Xe,C as Qe,h as Ye,i as er,j as rr,a as sr}from"./index-A_Ol3obB.js";import{A as ar}from"./AdminLayout-ChyWQ9M0.js";import{S as Ne}from"./switch-BiWPgmdu.js";import{B as v}from"./badge-DhhMK6_D.js";import{D as I,f as tr,a as B,b as W,c as M}from"./dialog-CnBvyQs3.js";import{A as lr,a as ir,b as nr,c as or,d as cr,e as dr,f as mr,g as hr}from"./alert-dialog--sxaRizY.js";import{T as _e,a as Ce,b as K,c as p,d as we,e as g}from"./table-C9xJNrTs.js";import{S as ur,g as xr}from"./serviceLabels-DGMYw5Z1.js";import{ax as pr,n as ee,bb as Se,aF as re,b2 as E,bc as Fe,U as ke,aD as gr,ad as fr,z as Le,K as jr,b9 as vr}from"./vendor-icons-Bb6Bx1mG.js";import{f as br,d as yr}from"./vendor-date-CGb8uUyu.js";import"./vendor-qr-Cat9Pybo.js";import"./vendor-supabase-C6YMG9od.js";import"./vendor-pdf-zgGboKZO.js";import"./vendor-ui-B0Prgq4E.js";import"./vendor-query-xEFYXQG3.js";import"./vendor-router-BzWVLfdi.js";import"./vendor-form-B4-aDMoP.js";import"./theme-toggle-CgB1u5Ak.js";import"./separator-C0dUQFBF.js";import"./skeleton-BklgIoxd.js";const C=10,Nr=/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,_r=/^[a-z0-9]+(-[a-z0-9]+)*$/,Cr=["admin","api","auth","embed","static","assets","public","private"],T=i=>Nr.test(i),V=(i,n="#6366f1")=>{if(!i)return n;const h=i.trim();return T(h)?h:n},se=i=>{if(!i||i.trim().length===0)return{valid:!1,error:"Slug ist erforderlich"};const n=i.trim().toLowerCase();return n.length<3?{valid:!1,error:"Slug muss mindestens 3 Zeichen lang sein"}:n.length>50?{valid:!1,error:"Slug darf maximal 50 Zeichen lang sein"}:_r.test(n)?Cr.includes(n)?{valid:!1,error:"Dieser Slug ist reserviert und kann nicht verwendet werden"}:{valid:!0}:{valid:!1,error:"Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten"}},De=i=>{const n={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};return i.replace(/[&<>"']/g,h=>n[h]||h)},Ee=(i,n="dd.MM.yyyy")=>{if(!i)return"-";try{const h=new Date(i);return isNaN(h.getTime())?"-":br(h,n,{locale:yr})}catch{return"-"}},wr=i=>Ee(i,"dd.MM.yyyy HH:mm"),Sr=async i=>{if(navigator.clipboard&&window.isSecureContext)try{return await navigator.clipboard.writeText(i),!0}catch{}try{const n=document.createElement("textarea");n.value=i,n.style.position="fixed",n.style.left="-999999px",n.style.top="-999999px",document.body.appendChild(n),n.focus(),n.select();const h=document.execCommand("copy");return document.body.removeChild(n),h}catch{return!1}},Te=ur,Ae=i=>Te.find(n=>n.services.some(h=>h.id===i)),Gr=()=>{const[i,n]=a.useState([]),[h,He]=a.useState(!0),[q,ae]=a.useState(!1),[ze,R]=a.useState(!1),[Re,te]=a.useState(!1),[$e,le]=a.useState(!1),[Ue,ie]=a.useState(!1),[t,H]=a.useState(null),[ne,z]=a.useState([]),[G,oe]=a.useState(!1),[o,f]=a.useState({name:"",slug:"",description:"",service_types:[],primary_color:"#6366f1",show_header:!0,header_title:"",header_subtitle:"",is_active:!0}),[Oe,J]=a.useState(!1),[w,ce]=a.useState(null),[Z,de]=a.useState(!1),[b,me]=a.useState(1),[y,X]=a.useState(0),[S,F]=a.useState(null),Pe=a.useRef(null),Q=a.useRef(null),$=a.useRef(!1),he=typeof window<"u"?window.location.origin:"",k=a.useCallback(async r=>{try{const{data:s,error:l}=await N.from("lead_forms").select("*").order("created_at",{ascending:!1});if(r?.aborted)return;if(l)throw l;const j={};if(Array.isArray(s)&&s.length>0){const D=await Promise.all(s.map(async c=>{if(r?.aborted)return null;const O=c.service_types??[];if(O.length===0)return{id:c.id,count:0};const{count:P}=await N.from("leads").select("id",{head:!0,count:"exact"}).in("service_type",O);return{id:c.id,count:P??0}}));if(r?.aborted)return;D.forEach(c=>{c&&(j[c.id]=c.count)})}if(Array.isArray(s)){const D=s.map(c=>({id:c.id,name:c.name,slug:c.slug,description:c.description,service_types:c.service_types,primary_color:c.primary_color,show_header:c.show_header,header_title:c.header_title,header_subtitle:c.header_subtitle,is_active:c.is_active,created_at:c.created_at,updated_at:c.updated_at,lead_count:j[c.id]||0}));n(D)}else n([])}catch(s){if(r?.aborted)return;console.error("Error fetching forms:",s),x.error("Fehler beim Laden der Formulare")}finally{r?.aborted||He(!1)}},[]);a.useEffect(()=>{const r=new AbortController;return Pe.current=r,k(r.signal),()=>{r.abort()}},[k]);const U=a.useCallback(async(r,s=1)=>{Q.current&&Q.current.abort();const l=new AbortController;Q.current=l,oe(!0);try{if(r.length===0){X(0),z([]);return}const{count:j,error:D}=await N.from("leads").select("*",{count:"exact",head:!0}).in("service_type",r);if(l.signal.aborted)return;if(D)throw D;X(j||0);const c=(s-1)*C,O=c+C-1,{data:P,error:ye}=await N.from("leads").select("id, customer_first_name, customer_last_name, customer_email, customer_phone, service_type, from_city, from_plz, status, created_at").in("service_type",r).order("created_at",{ascending:!1}).range(c,O);if(l.signal.aborted)return;if(ye)throw ye;Array.isArray(P)?z(P):z([])}catch(j){if(l.signal.aborted)return;console.error("Error fetching form leads:",j),x.error("Fehler beim Laden der Leads"),z([])}finally{l.signal.aborted||oe(!1)}},[]),Ie=a.useCallback(r=>{H(r),z([]),me(1),X(0),le(!0),U(r.service_types??[],1)},[U]),ue=a.useCallback(r=>{t&&(me(r),U(t.service_types??[],r))},[t,U]),xe=a.useCallback(r=>r.toLowerCase().replace(/[äöüß]/g,s=>({ä:"ae",ö:"oe",ü:"ue",ß:"ss"})[s]||s).replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").substring(0,50),[]),Be=a.useCallback(r=>{f(s=>{if($.current)return{...s,name:r};const l=xe(r),j=se(l);return F(j.valid?null:j.error||null),{...s,name:r,slug:l}})},[xe]),We=a.useCallback(r=>{const s=r.toLowerCase().replace(/[^a-z0-9-]/g,"");$.current=s.length>0;const l=se(s);F(l.valid?null:l.error||null),f(j=>({...j,slug:s}))},[]),pe=a.useCallback((r,s=!1)=>{f(s?l=>({...l,primary_color:V(r)}):l=>({...l,primary_color:r}))},[]),Y=a.useCallback(()=>{f({name:"",slug:"",description:"",service_types:[],primary_color:"#6366f1",show_header:!0,header_title:"",header_subtitle:"",is_active:!0}),H(null),F(null),$.current=!1},[]),Me=a.useCallback(r=>{H(r),F(null),$.current=!0,f({name:r.name,slug:r.slug,description:r.description||"",service_types:r.service_types||[],primary_color:V(r.primary_color),show_header:r.show_header??!0,header_title:r.header_title||"",header_subtitle:r.header_subtitle||"",is_active:r.is_active??!0}),R(!0)},[]),Ke=a.useCallback(r=>{H(r),te(!0)},[]),Ve=a.useCallback(r=>{H(r),ie(!0)},[]),qe=a.useCallback(async()=>{if(!o.name.trim()){x.error("Name ist erforderlich");return}const r=se(o.slug);if(!r.valid){F(r.error||"Ungültiger Slug"),x.error(r.error||"Ungültiger Slug");return}if(!T(o.primary_color)){x.error("Ungültige Farbe. Bitte verwenden Sie ein gültiges Hex-Format (z.B. #6366f1)");return}ae(!0);try{const s={...o,slug:o.slug.toLowerCase().trim(),primary_color:V(o.primary_color),name:o.name.trim(),description:o.description.trim()||null,header_title:o.header_title.trim()||null,header_subtitle:o.header_subtitle.trim()||null};if(t){const{error:l}=await N.from("lead_forms").update(s).eq("id",t.id);if(l)throw l;x.success("Formular aktualisiert")}else{const{error:l}=await N.from("lead_forms").insert(s);if(l)throw l;x.success("Formular erstellt")}R(!1),Y(),k()}catch(s){console.error("Error saving form:",s),s instanceof Error&&"code"in s&&s.code==="23505"?(F("Ein Formular mit diesem Slug existiert bereits"),x.error("Ein Formular mit diesem Slug existiert bereits")):x.error("Fehler beim Speichern")}finally{ae(!1)}},[o,t,Y,k]),Ge=a.useCallback(r=>{ce(r),J(!0)},[]),Je=a.useCallback(async()=>{if(w){de(!0);try{const{error:r}=await N.from("lead_forms").delete().eq("id",w.id);if(r)throw r;x.success("Formular gelöscht"),J(!1),ce(null),k()}catch(r){console.error("Error deleting form:",r),x.error("Fehler beim Löschen. Möglicherweise sind noch Leads mit diesem Formular verknüpft.")}finally{de(!1)}}},[w,k]),L=a.useCallback(async(r,s)=>{await Sr(r)?x.success(`${s} kopiert`):x.error("Kopieren fehlgeschlagen. Bitte manuell kopieren.")},[]),u=a.useCallback(r=>{const s=encodeURIComponent(r.slug);return`${he}/embed/${s}`},[he]),ge=a.useCallback(r=>{const s=u(r),l=De(s);return`<iframe src="${l}" width="100%" height="800" frameborder="0" style="border: none; border-radius: 8px;"></iframe>

<!-- URL Parameter Options:
  ?color=ff6600     - Custom primary color (hex without #)
  ?lang=de|en|fr|it - Language (de=German, en=English, fr=French, it=Italian)
  ?hideHeader=true  - Hide form header
  
  Example: ${l}?color=ff6600&lang=en
-->`},[u]),fe=a.useCallback(r=>`// React/Next.js Component
import React from 'react';

interface LeadFormProps {
  color?: string;      // Hex color without # (e.g., "ff6600")
  lang?: 'de' | 'en' | 'fr' | 'it';
  hideHeader?: boolean;
}

const LeadForm = ({ color, lang = 'de', hideHeader = false }: LeadFormProps) => {
  const params = new URLSearchParams();
  if (color) params.set('color', color);
  if (lang !== 'de') params.set('lang', lang);
  if (hideHeader) params.set('hideHeader', 'true');
  
  const queryString = params.toString();
  const src = "${u(r)}" + (queryString ? "?" + queryString : "");

  return (
    <iframe
      src={src}
      width="100%"
      height="800"
      frameBorder="0"
      style={{ border: 'none', borderRadius: '8px' }}
      title="Anfrage Formular"
    />
  );
};

export default LeadForm;

// Usage:
// <LeadForm />
// <LeadForm color="ff6600" lang="en" />
// <LeadForm hideHeader />`,[u]),je=a.useCallback(r=>`<!-- WordPress / Django / CMS - JavaScript Widget -->
<div id="leadform-container" 
     data-color=""
     data-lang="de"
     data-hide-header="false">
</div>
<script>
(function() {
  var container = document.getElementById('leadform-container');
  var baseUrl = '${u(r).replace(/'/g,"\\'")}';
  
  // Read configuration from data attributes
  var color = container.getAttribute('data-color');
  var lang = container.getAttribute('data-lang') || 'de';
  var hideHeader = container.getAttribute('data-hide-header') === 'true';
  
  // Build URL with parameters
  var params = [];
  if (color) params.push('color=' + encodeURIComponent(color));
  if (lang !== 'de') params.push('lang=' + encodeURIComponent(lang));
  if (hideHeader) params.push('hideHeader=true');
  
  var src = baseUrl + (params.length ? '?' + params.join('&') : '');
  
  var iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.width = '100%';
  iframe.height = '800';
  iframe.frameBorder = '0';
  iframe.style.cssText = 'border: none; border-radius: 8px; min-height: 800px;';
  iframe.title = 'Anfrage Formular';
  
  // Auto-resize based on content
  window.addEventListener('message', function(e) {
    if (e.data && (e.data.type === 'leadform-resize' || e.data.type === 'offerio-resize')) {
      iframe.style.height = e.data.height + 'px';
    }

    if (e.data && e.data.type === 'leadform-step-change') {
      iframe.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  
  container.appendChild(iframe);
})();
<\/script>

<!-- Configuration Options:
  data-color="ff6600"      - Custom primary color (hex without #)
  data-lang="de|en|fr|it"  - Language
  data-hide-header="true"  - Hide form header
-->`,[u]),ve=a.useCallback(r=>`<!-- WordPress Shortcode (add to functions.php) -->
// In functions.php:
function leadform_shortcode($atts) {
  $atts = shortcode_atts(array(
    'color' => '',
    'lang' => 'de',
    'hideheader' => 'false'
  ), $atts, 'leadform');
  
  $base_url = '${u(r).replace(/'/g,"\\'")}';
  $params = array();
  
  if (!empty($atts['color'])) {
    $params[] = 'color=' . esc_attr($atts['color']);
  }
  if ($atts['lang'] !== 'de') {
    $params[] = 'lang=' . esc_attr($atts['lang']);
  }
  if ($atts['hideheader'] === 'true') {
    $params[] = 'hideHeader=true';
  }
  
  $url = $base_url . (!empty($params) ? '?' . implode('&', $params) : '');
  
  return '<iframe 
    src="' . esc_url($url) . '" 
    width="100%" 
    height="800" 
    frameborder="0" 
    style="border: none; border-radius: 8px;">
  </iframe>';
}
add_shortcode('leadform', 'leadform_shortcode');

// Usage in WordPress pages/posts:
[leadform]
[leadform color="ff6600" lang="en"]
[leadform hideheader="true"]`,[u]),be=a.useCallback(r=>{const s=u(r),l=s.replace(/'/g,"\\'");return`<!-- Django Template -->
{% load static %}

<div class="leadform-wrapper">
  <iframe 
    src="${De(s)}?lang=de"
    width="100%" 
    height="800" 
    frameborder="0"
    style="border: none; border-radius: 8px;"
    title="Anfrage Formular">
  </iframe>
</div>

<!-- Or as a Django template tag in templatetags/leadform.py: -->
from django import template
from django.utils.safestring import mark_safe
from django.utils.html import escape
from urllib.parse import urlencode

register = template.Library()

@register.simple_tag
def leadform(color=None, lang='de', hide_header=False):
    base_url = '${l}'
    params = {}
    if color:
        params['color'] = color
    if lang != 'de':
        params['lang'] = lang
    if hide_header:
        params['hideHeader'] = 'true'
    
    url = base_url + ('?' + urlencode(params) if params else '')
    
    return mark_safe(f'''
        <iframe 
            src="{escape(url)}"
            width="100%" 
            height="800" 
            frameborder="0"
            style="border: none; border-radius: 8px;">
        </iframe>
    ''')

<!-- Usage: 
  {% load leadform %} 
  {% leadform %}
  {% leadform color="ff6600" lang="en" %}
  {% leadform hide_header=True %}
-->`},[u]);return e.jsxs(e.Fragment,{children:[e.jsx(Ze,{children:e.jsx("title",{children:"Formulare | LeadFlow Admin"})}),e.jsx(ar,{children:e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl font-bold",children:"Anfrage-Formulare"}),e.jsx("p",{className:"text-muted-foreground",children:"Erstellen und verwalten Sie einbettbare Formulare"})]}),e.jsxs(I,{open:ze,onOpenChange:r=>{R(r),r||Y()},children:[e.jsx(tr,{asChild:!0,children:e.jsxs(d,{children:[e.jsx(pr,{className:"w-4 h-4 mr-2"}),"Neues Formular"]})}),e.jsxs(B,{className:"max-w-2xl max-h-[90vh] overflow-y-auto",children:[e.jsx(W,{children:e.jsx(M,{children:t?"Formular bearbeiten":"Neues Formular erstellen"})}),e.jsxs("div",{className:"space-y-4 py-4",children:[e.jsxs("div",{className:"grid grid-cols-2 gap-4",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsx(m,{htmlFor:"name",children:"Name *"}),e.jsx(A,{id:"name",placeholder:"z.B. Homepage Formular",value:o.name,onChange:r=>Be(r.target.value)})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(m,{htmlFor:"slug",children:"Slug (URL) *"}),e.jsx(A,{id:"slug",placeholder:"z.B. homepage-formular",value:o.slug,onChange:r=>We(r.target.value),className:S?"border-destructive":"","aria-describedby":S?"slug-error":void 0,"aria-invalid":!!S}),S&&e.jsx("p",{id:"slug-error",className:"text-sm text-destructive",children:S})]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(m,{htmlFor:"description",children:"Beschreibung"}),e.jsx(_,{id:"description",placeholder:"Interne Notizen zum Formular...",value:o.description,onChange:r=>f(s=>({...s,description:r.target.value}))})]}),e.jsxs("div",{className:"space-y-4",children:[e.jsx(m,{children:"Service-Kategorie"}),e.jsx("p",{className:"text-sm text-muted-foreground",children:"Wählen Sie eine Kategorie. Im Formular kann der Kunde den genauen Service-Typ auswählen."}),e.jsx("div",{className:"grid grid-cols-2 md:grid-cols-3 gap-3",children:Te.map(r=>e.jsxs("div",{onClick:()=>{f(s=>({...s,service_types:r.services.map(l=>l.id)}))},className:`p-4 rounded-lg border-2 cursor-pointer transition-all hover:border-primary/50 ${r.services.every(s=>o.service_types.includes(s.id))&&o.service_types.length===r.services.length?"border-primary bg-primary/10":"border-border bg-card"}`,children:[e.jsx("div",{className:"font-medium",children:r.label}),e.jsx("div",{className:"text-xs text-muted-foreground mt-1",children:r.description}),e.jsx("div",{className:"text-xs text-muted-foreground mt-2",children:r.services.map(s=>s.label).join(", ")})]},r.id))})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-4",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsx(m,{htmlFor:"primary_color",children:"Primärfarbe"}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx(A,{id:"primary_color",type:"color",value:T(o.primary_color)?o.primary_color:"#6366f1",onChange:r=>pe(r.target.value,!0),className:"w-12 h-10 p-1","aria-label":"Farbwähler"}),e.jsx(A,{value:o.primary_color,onChange:r=>pe(r.target.value,!1),className:`flex-1 ${T(o.primary_color)?"":"border-destructive"}`,placeholder:"#6366f1",pattern:"^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$","aria-label":"Hex-Farbwert"})]}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"Format: #RRGGBB (z.B. #6366f1)"})]}),e.jsx("div",{className:"space-y-2 flex flex-col justify-end",children:e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Ne,{id:"show_header",checked:o.show_header,onCheckedChange:r=>f(s=>({...s,show_header:r}))}),e.jsx(m,{htmlFor:"show_header",children:"Header anzeigen"})]})})]}),o.show_header&&e.jsxs("div",{className:"space-y-4 p-4 bg-muted/50 rounded-lg",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsx(m,{htmlFor:"header_title",children:"Header Titel"}),e.jsx(A,{id:"header_title",placeholder:"Offerte anfragen",value:o.header_title,onChange:r=>f(s=>({...s,header_title:r.target.value}))})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(m,{htmlFor:"header_subtitle",children:"Header Untertitel"}),e.jsx(_,{id:"header_subtitle",placeholder:"Füllen Sie das Formular aus...",value:o.header_subtitle,onChange:r=>f(s=>({...s,header_subtitle:r.target.value}))})]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Ne,{id:"is_active",checked:o.is_active,onCheckedChange:r=>f(s=>({...s,is_active:r}))}),e.jsx(m,{htmlFor:"is_active",children:"Formular aktiv"})]}),e.jsxs("div",{className:"flex justify-end gap-2 pt-4",children:[e.jsx(d,{variant:"outline",onClick:()=>R(!1),disabled:q,children:"Abbrechen"}),e.jsx(d,{onClick:qe,disabled:q||!!S,children:q?e.jsxs(e.Fragment,{children:[e.jsx(ee,{className:"w-4 h-4 mr-2 animate-spin"}),"Speichern..."]}):t?"Speichern":"Erstellen"})]})]})]})]})]}),e.jsx(I,{open:Re,onOpenChange:te,children:e.jsxs(B,{className:"max-w-3xl max-h-[90vh] overflow-y-auto",children:[e.jsx(W,{children:e.jsxs(M,{children:[e.jsx(Se,{className:"w-5 h-5 inline mr-2"}),"Embed-Code: ",t?.name]})}),t&&e.jsxs("div",{className:"space-y-6 py-4",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsxs(m,{className:"flex items-center gap-2",children:[e.jsx(re,{className:"w-4 h-4"}),"Direkt-Link"]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx(A,{readOnly:!0,value:u(t),className:"font-mono text-sm"}),e.jsx(d,{variant:"outline",size:"icon",onClick:()=>L(u(t),"Link"),children:e.jsx(E,{className:"w-4 h-4"})}),e.jsx(d,{variant:"outline",size:"icon",onClick:()=>window.open(u(t),"_blank"),children:e.jsx(re,{className:"w-4 h-4"})})]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsxs(m,{className:"flex items-center gap-2",children:[e.jsx(v,{variant:"secondary",className:"text-xs",children:"HTML"}),"iFrame-Code (Universal)"]}),e.jsxs("div",{className:"relative",children:[e.jsx(_,{readOnly:!0,value:ge(t),className:"font-mono text-xs min-h-[80px]"}),e.jsxs(d,{variant:"secondary",size:"sm",className:"absolute top-2 right-2",onClick:()=>L(ge(t),"iFrame-Code"),children:[e.jsx(E,{className:"w-4 h-4 mr-2"}),"Kopieren"]})]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsxs(m,{className:"flex items-center gap-2",children:[e.jsx(v,{variant:"outline",className:"text-xs bg-blue-500/10 text-blue-600 border-blue-500/30",children:"React"}),"React / Next.js Component"]}),e.jsxs("div",{className:"relative",children:[e.jsx(_,{readOnly:!0,value:fe(t),className:"font-mono text-xs min-h-[180px]"}),e.jsxs(d,{variant:"secondary",size:"sm",className:"absolute top-2 right-2",onClick:()=>L(fe(t),"React-Code"),children:[e.jsx(E,{className:"w-4 h-4 mr-2"}),"Kopieren"]})]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsxs(m,{className:"flex items-center gap-2",children:[e.jsx(v,{variant:"outline",className:"text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30",children:"JS"}),"JavaScript Widget (CMS / WordPress)"]}),e.jsxs("div",{className:"relative",children:[e.jsx(_,{readOnly:!0,value:je(t),className:"font-mono text-xs min-h-[200px]"}),e.jsxs(d,{variant:"secondary",size:"sm",className:"absolute top-2 right-2",onClick:()=>L(je(t),"JS-Widget-Code"),children:[e.jsx(E,{className:"w-4 h-4 mr-2"}),"Kopieren"]})]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsxs(m,{className:"flex items-center gap-2",children:[e.jsx(v,{variant:"outline",className:"text-xs bg-[#21759b]/10 text-[#21759b] border-[#21759b]/30",children:"WordPress"}),"WordPress Shortcode"]}),e.jsxs("div",{className:"relative",children:[e.jsx(_,{readOnly:!0,value:ve(t),className:"font-mono text-xs min-h-[180px]"}),e.jsxs(d,{variant:"secondary",size:"sm",className:"absolute top-2 right-2",onClick:()=>L(ve(t),"WordPress-Code"),children:[e.jsx(E,{className:"w-4 h-4 mr-2"}),"Kopieren"]})]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsxs(m,{className:"flex items-center gap-2",children:[e.jsx(v,{variant:"outline",className:"text-xs bg-green-500/10 text-green-600 border-green-500/30",children:"Django"}),"Django Template"]}),e.jsxs("div",{className:"relative",children:[e.jsx(_,{readOnly:!0,value:be(t),className:"font-mono text-xs min-h-[200px]"}),e.jsxs(d,{variant:"secondary",size:"sm",className:"absolute top-2 right-2",onClick:()=>L(be(t),"Django-Code"),children:[e.jsx(E,{className:"w-4 h-4 mr-2"}),"Kopieren"]})]})]}),e.jsxs("div",{className:"p-4 bg-muted/50 rounded-lg text-sm",children:[e.jsx("p",{className:"font-medium mb-2",children:"Verwendung:"}),e.jsxs("ul",{className:"list-disc list-inside space-y-1 text-muted-foreground",children:[e.jsxs("li",{children:[e.jsx("strong",{children:"HTML/iFrame:"})," Für statische Websites"]}),e.jsxs("li",{children:[e.jsx("strong",{children:"React:"})," Für React/Next.js Projekte"]}),e.jsxs("li",{children:[e.jsx("strong",{children:"JS Widget:"})," Für WordPress, Wix, Squarespace, etc."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"WordPress:"})," Shortcode für einfache Integration"]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Django:"})," Template-Tag für Python-Projekte"]})]})]})]})]})}),e.jsx(I,{open:Ue,onOpenChange:ie,children:e.jsxs(B,{className:"max-w-4xl max-h-[90vh] overflow-y-auto",children:[e.jsx(W,{children:e.jsxs(M,{className:"flex items-center gap-2",children:[e.jsx(Fe,{className:"w-5 h-5"}),"Formular-Vorschau: ",t?.name]})}),t&&e.jsxs("div",{className:"py-4",children:[e.jsxs("div",{className:"mb-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between",children:[e.jsxs("div",{className:"text-sm text-muted-foreground",children:[e.jsx("span",{className:"font-medium",children:"Kategorie:"})," ",Ae(t.service_types?.[0]||"")?.label||"Alle Services"]}),e.jsxs(v,{variant:"outline",children:[t.service_types?.length||0," Service(s)"]})]}),t.show_header&&e.jsxs("div",{className:"mb-6 p-6 rounded-xl text-center",style:{backgroundColor:T(t.primary_color||"")?`${t.primary_color}15`:"#6366f115"},children:[e.jsx("h2",{className:"text-2xl font-bold mb-2",style:{color:T(t.primary_color||"")?t.primary_color||void 0:"#6366f1"},children:t.header_title||"Offerte anfragen"}),t.header_subtitle&&e.jsx("p",{className:"text-muted-foreground",children:t.header_subtitle})]}),e.jsx("div",{className:"border rounded-xl p-4",style:{"--form-primary":V(t.primary_color)},children:e.jsx(Xe,{allowedServices:t.service_types||[],formId:t.id,formSlug:t.slug})}),e.jsx("div",{className:"mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg",children:e.jsxs("p",{className:"text-sm text-amber-700 dark:text-amber-400",children:[e.jsx("strong",{children:"Hinweis:"})," Dies ist eine Vorschau. Eingereichte Anfragen werden als Test-Daten gespeichert."]})})]})]})}),e.jsx(I,{open:$e,onOpenChange:le,children:e.jsxs(B,{className:"max-w-4xl max-h-[80vh] overflow-y-auto",children:[e.jsx(W,{children:e.jsxs(M,{className:"flex items-center gap-2",children:[e.jsx(ke,{className:"w-5 h-5"}),"Leads: ",t?.name]})}),t&&e.jsxs("div",{className:"space-y-4 py-4",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("p",{className:"text-sm text-muted-foreground",children:[y," Lead",y!==1?"s":""," über dieses Formular"]}),e.jsxs(v,{variant:"outline",children:["Slug: ",t.slug]})]}),G?e.jsxs("div",{className:"flex items-center justify-center py-8",children:[e.jsx(ee,{className:"w-6 h-6 animate-spin text-muted-foreground"}),e.jsx("span",{className:"ml-2 text-muted-foreground",children:"Lade Leads..."})]}):ne.length===0?e.jsx("div",{className:"text-center py-8 text-muted-foreground",children:"Noch keine Leads über dieses Formular eingegangen."}):e.jsxs(_e,{children:[e.jsx(Ce,{children:e.jsxs(K,{children:[e.jsx(p,{children:"Datum"}),e.jsx(p,{children:"Name"}),e.jsx(p,{children:"Kontakt"}),e.jsx(p,{children:"Service"}),e.jsx(p,{children:"Standort"}),e.jsx(p,{children:"Status"})]})}),e.jsx(we,{children:ne.map(r=>e.jsxs(K,{children:[e.jsx(g,{className:"text-sm text-muted-foreground",children:wr(r.created_at)}),e.jsx(g,{className:"font-medium",children:[r.customer_first_name,r.customer_last_name].filter(Boolean).join(" ")||"-"}),e.jsx(g,{children:e.jsxs("div",{className:"text-sm",children:[e.jsx("div",{children:r.customer_email||"-"}),e.jsx("div",{className:"text-muted-foreground",children:r.customer_phone||"-"})]})}),e.jsx(g,{children:e.jsx(v,{variant:"secondary",className:"text-xs",children:xr(r.service_type)})}),e.jsx(g,{className:"text-sm",children:[r.from_plz,r.from_city].filter(Boolean).join(" ")||"-"}),e.jsx(g,{children:e.jsx(v,{variant:r.status==="matched"?"default":"outline",children:r.status||"pending"})})]},r.id))})]}),y>C&&e.jsxs("div",{className:"flex items-center justify-between mt-4 pt-4 border-t",children:[e.jsxs("span",{className:"text-sm text-muted-foreground",children:[(b-1)*C+1,"-",Math.min(b*C,y)," von ",y]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(d,{variant:"outline",size:"sm",onClick:()=>ue(b-1),disabled:b===1||G,"aria-label":"Vorherige Seite",children:e.jsx(gr,{className:"w-4 h-4"})}),e.jsxs("span",{className:"text-sm",children:["Seite ",b," von ",Math.ceil(y/C)]}),e.jsx(d,{variant:"outline",size:"sm",onClick:()=>ue(b+1),disabled:b>=Math.ceil(y/C)||G,"aria-label":"Nächste Seite",children:e.jsx(fr,{className:"w-4 h-4"})})]})]})]})]})}),e.jsx(lr,{open:Oe,onOpenChange:J,children:e.jsxs(ir,{children:[e.jsxs(nr,{children:[e.jsx(or,{children:"Formular löschen?"}),e.jsxs(cr,{children:["Möchten Sie das Formular ",e.jsxs("strong",{children:['"',w?.name,'"']})," wirklich löschen?",e.jsx("br",{}),e.jsx("br",{}),"Diese Aktion kann nicht rückgängig gemacht werden.",(w?.lead_count||0)>0&&e.jsxs("span",{className:"block mt-2 text-amber-600",children:["Hinweis: ",w?.lead_count," Lead(s) sind mit diesem Formular verknüpft."]})]})]}),e.jsxs(dr,{children:[e.jsx(mr,{disabled:Z,children:"Abbrechen"}),e.jsx(hr,{onClick:Je,disabled:Z,className:"bg-destructive text-destructive-foreground hover:bg-destructive/90",children:Z?e.jsxs(e.Fragment,{children:[e.jsx(ee,{className:"w-4 h-4 mr-2 animate-spin"}),"Löschen..."]}):e.jsxs(e.Fragment,{children:[e.jsx(Le,{className:"w-4 h-4 mr-2"}),"Löschen"]})})]})]})}),e.jsxs(Qe,{children:[e.jsxs(Ye,{children:[e.jsxs(er,{className:"text-lg flex items-center gap-2",children:[e.jsx(jr,{className:"w-5 h-5"}),"Alle Formulare"]}),e.jsxs(rr,{children:[i.length," Formular",i.length!==1?"e":""," erstellt"]})]}),e.jsx(sr,{children:h?e.jsx("div",{className:"text-center py-8 text-muted-foreground",children:"Lade Formulare..."}):i.length===0?e.jsx("div",{className:"text-center py-8 text-muted-foreground",children:'Noch keine Formulare erstellt. Klicken Sie auf "Neues Formular" um zu beginnen.'}):e.jsxs(_e,{children:[e.jsx(Ce,{children:e.jsxs(K,{children:[e.jsx(p,{children:"Name"}),e.jsx(p,{children:"Slug"}),e.jsx(p,{children:"Status"}),e.jsx(p,{children:"Leads"}),e.jsx(p,{children:"Services"}),e.jsx(p,{children:"Erstellt"}),e.jsx(p,{className:"text-right",children:"Aktionen"})]})}),e.jsx(we,{children:i.map(r=>e.jsxs(K,{children:[e.jsx(g,{className:"font-medium",children:r.name}),e.jsx(g,{children:e.jsx("code",{className:"text-sm bg-muted px-2 py-1 rounded",children:r.slug})}),e.jsx(g,{children:e.jsx(v,{variant:r.is_active?"default":"secondary",children:r.is_active?"Aktiv":"Inaktiv"})}),e.jsx(g,{children:e.jsxs(d,{variant:"ghost",size:"sm",className:"font-mono h-auto py-1 px-2",onClick:()=>Ie(r),disabled:!r.lead_count,children:[e.jsx(ke,{className:"w-3 h-3 mr-1"}),r.lead_count||0]})}),e.jsx(g,{children:r.service_types&&r.service_types.length>0?e.jsx(v,{variant:"outline",children:Ae(r.service_types[0])?.label||r.service_types.length+" Services"}):e.jsx("span",{className:"text-sm text-muted-foreground",children:"Alle"})}),e.jsx(g,{className:"text-sm text-muted-foreground",children:Ee(r.created_at)}),e.jsx(g,{className:"text-right",children:e.jsxs("div",{className:"flex justify-end gap-1",children:[e.jsx(d,{variant:"ghost",size:"icon",onClick:()=>Ve(r),title:"Vorschau im Admin",children:e.jsx(Fe,{className:"w-4 h-4"})}),e.jsx(d,{variant:"ghost",size:"icon",onClick:()=>window.open(u(r),"_blank"),title:"In neuem Tab öffnen",children:e.jsx(re,{className:"w-4 h-4"})}),e.jsx(d,{variant:"ghost",size:"icon",onClick:()=>Ke(r),title:"Embed-Code",children:e.jsx(Se,{className:"w-4 h-4"})}),e.jsx(d,{variant:"ghost",size:"icon",onClick:()=>Me(r),title:"Bearbeiten",children:e.jsx(vr,{className:"w-4 h-4"})}),e.jsx(d,{variant:"ghost",size:"icon",onClick:()=>Ge(r),title:"Löschen",className:"text-destructive hover:text-destructive","aria-label":`Formular ${r.name} löschen`,children:e.jsx(Le,{className:"w-4 h-4"})})]})})]},r.id))})]})})]})]})})]})};export{Gr as default};
