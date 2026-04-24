// UmzugWizard — v3: Länderauswahl, dynamische Unterkunft, Sperrgut, Service-Unteroptionen
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { supabase } from "@/integrations/supabase/client";
import { sendCustomerConfirmation } from "@/lib/sendCustomerConfirmation";
import { triggerLeadQualityValidation } from "@/lib/triggerLeadQualityValidation";
import { validateEmail, isEmailAcceptable } from "@/lib/emailValidation";
import { EmailHint } from "@/components/ui/email-hint";
import { splitStreetNr } from "@/lib/splitStreetNr";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { Send, Loader2, Check, ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";

const STORAGE_KEY = "umzug_wizard_v3";
const TOTAL_STEPS = 5;

const COUNTRIES = [
  {c:"CH",f:"🇨🇭",n:"Schweiz"},
  {c:"DE",f:"🇩🇪",n:"Deutschland"},
  {c:"AT",f:"🇦🇹",n:"Österreich"},
  {c:"FR",f:"🇫🇷",n:"Frankreich"},
  {c:"IT",f:"🇮🇹",n:"Italien"},
  {c:"ES",f:"🇪🇸",n:"Spanien"},
  {c:"NL",f:"🇳🇱",n:"Niederlande"},
  {c:"GB",f:"🇬🇧",n:"Grossbritannien"},
  {c:"US",f:"🇺🇸",n:"USA"},
  {c:"TR",f:"🇹🇷",n:"Türkei"},
  {c:"AE",f:"🇦🇪",n:"Vereinigte Arabische Emirate"},
  {c:"AU",f:"🇦🇺",n:"Australien"},
  {c:"CA",f:"🇨🇦",n:"Kanada"},
  {c:"JP",f:"🇯🇵",n:"Japan"},
  {c:"SG",f:"🇸🇬",n:"Singapur"},
  {c:"XX",f:"🌐",n:"Anderes Land"},
];

const STOCK_OPTS = [
  {label:"UG",floor:-1},{label:"EG",floor:0},{label:"HP",floor:0},
  {label:"1. OG",floor:1},{label:"2. OG",floor:2},{label:"3. OG",floor:3},
  {label:"4. OG",floor:4},{label:"5. OG",floor:5},{label:"6. OG",floor:6},
  {label:"7. OG",floor:7},{label:"8. OG",floor:8},{label:"9. OG",floor:9},
  {label:"10. OG",floor:10},{label:"11-15",floor:11},{label:"15.+",floor:15},
];

const ZIMMER_OPTS = ["1","1.5","2","2.5","3","3.5","4","4.5","5","5.5","6+"];

type PlzEntry = {p:string; o:string; k:string};
type AddrData = {country:string; str:string; nr:string; plz:string; ort:string; city:string};

// ─── UmzugAddrCard — defined OUTSIDE main component to prevent focus loss ─────
interface UmzugAddrCardProps {
  isVon: boolean;
  data: AddrData;
  unknown?: boolean;
  ac: PlzEntry[];
  acOpen: boolean;
  countryOpen: boolean;
  onCountryOpen: (v: boolean) => void;
  onAcOpen: (v: boolean) => void;
  onChangeCountry: (code: string) => void;
  onChangeStr: (v: string) => void;
  onChangeNr: (v: string) => void;
  /** Called when both street and number should update atomically (e.g. autofill split) */
  onChangeStrNr: (str: string, nr: string) => void;
  onChangePlz: (v: string) => void;
  onPickPlz: (item: PlzEntry) => void;
  onChangeOrt?: (v: string) => void;
  onChangeCity: (v: string) => void;
}

function UmzugAddrCard({
  isVon, data, unknown = false,
  ac, acOpen, countryOpen,
  onCountryOpen, onAcOpen,
  onChangeCountry, onChangeStr, onChangeNr, onChangeStrNr,
  onChangePlz, onPickPlz, onChangeOrt, onChangeCity,
}: UmzugAddrCardProps) {
  const country = COUNTRIES.find(c => c.c === data.country) ?? COUNTRIES[0];
  const isCH = data.country === "CH";
  const inp = "w-full h-10 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3 text-sm text-gray-900 outline-none transition-all hover:border-gray-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.10)]";

  const handleStrChange = (raw: string) => {
    const split = splitStreetNr(raw);
    if (split) {
      if (!data.nr.trim()) {
        // Update both street and number atomically to avoid stale closure overwrite
        onChangeStrNr(split.street, split.nr);
        return;
      }
      if (Math.abs(raw.trim().length - data.str.length) >= 3) {
        onChangeStrNr(split.street, split.nr);
        return;
      }
    }
    onChangeStr(raw);
  };

  const handleNrChange = (raw: string) => {
    const split = splitStreetNr(raw);
    if (split && !data.str.trim()) {
      onChangeStrNr(split.street, split.nr);
      return;
    }
    onChangeNr(raw);
  };

  const closeAc = () => setTimeout(() => onAcOpen(false), 150);

  return (
    <div className={cn(
      "bg-white border-[1.5px] rounded-xl transition-all",
      unknown ? "opacity-50 pointer-events-none border-gray-200" :
      (isCH ? (data.plz && data.str) : (data.city && data.str)) ? "border-green-300" : "border-gray-200"
    )}>
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3 border-b border-gray-100 bg-gray-50/70 rounded-t-xl">
        <div>
          <div className="text-[13px] font-semibold text-gray-900">{isVon ? "Aktuelle Adresse" : "Neue Adresse"}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{isVon ? "Von hier wird umgezogen" : unknown ? "Noch nicht bekannt" : "Ziel des Umzugs"}</div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Land */}
        <div className="relative">
          <div className="flex items-center justify-between px-3 py-2 border-b border-dashed border-gray-200 mb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <span>{country.f}</span><span>{country.n}</span>
            </div>
            <button type="button" onClick={() => onCountryOpen(!countryOpen)}
              className="text-[11px] text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1">
              {countryOpen ? "Schliessen" : "Anderes Land"}
              <ChevronDown className={cn("w-3 h-3 transition-transform", countryOpen && "rotate-180")} />
            </button>
          </div>
          {countryOpen && (
            <div className="absolute top-full left-0 right-0 z-50 bg-white border-[1.5px] border-blue-200 rounded-xl shadow-xl max-h-48 overflow-y-auto mb-2">
              {COUNTRIES.map(c => (
                <div key={c.c} onClick={() => onChangeCountry(c.c)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-b border-gray-100 last:border-0 transition-colors",
                    data.country === c.c ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-gray-50 text-gray-700"
                  )}>
                  <span>{c.f}</span><span>{c.n}</span>
                  {data.country === c.c && <Check className="w-3.5 h-3.5 ml-auto text-blue-600" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Strasse + Nr */}
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Strasse & Nr.</label>
          <div className="grid grid-cols-[1fr_72px] gap-2">
            <input
              type="text"
              value={data.str}
              placeholder={isVon ? "Musterstrasse" : "Bahnhofstrasse"}
              onChange={e => handleStrChange(e.target.value)}
              onInput={e => handleStrChange((e.target as HTMLInputElement).value)}
              className={inp}
              autoComplete={isVon ? "section-auszug address-line1" : "section-einzug address-line1"}
            />
            <input
              type="text"
              value={data.nr}
              placeholder="12a"
              onChange={e => handleNrChange(e.target.value)}
              onInput={e => handleNrChange((e.target as HTMLInputElement).value)}
              className={inp}
              autoComplete={isVon ? "section-auszug address-line2" : "section-einzug address-line2"}
            />
          </div>
        </div>

        {/* PLZ / Ort — only CH */}
        {isCH ? (
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">PLZ / Ort</label>
            <div className="relative">
              <div className="grid grid-cols-[88px_1fr] gap-2">
                <div className="relative">
                  <input type="text" value={data.plz}
                    onChange={e => onChangePlz(e.target.value)}
                    onBlur={closeAc}
                    placeholder={isVon?"8001":"3011"}
                    maxLength={4}
                    className={inp} autoComplete="postal-code" />
                </div>
                <input type="text" value={data.ort} onChange={e => onChangeOrt?.(e.target.value)} placeholder={isVon?"Zürich":"Bern"} className={inp} />
              </div>
              {acOpen && ac.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border-[1.5px] border-blue-200 rounded-xl shadow-xl z-[500] max-h-48 overflow-y-auto" onMouseDown={e => e.preventDefault()}>
                  {ac.map((item,i) => (
                    <div key={i} onMouseDown={() => onPickPlz(item)}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer border-b border-gray-100 last:border-0 hover:bg-blue-50 transition-colors">
                      <span className="font-mono text-xs text-gray-400 w-10 flex-shrink-0">{item.p}</span>
                      <span className="font-medium text-gray-800 flex-1">{item.o}</span>
                      <span className="text-xs text-gray-400">{item.k}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Stadt / Ort</label>
            <input type="text" value={data.city} placeholder="Stadt"
              onChange={e => onChangeCity(e.target.value)}
              className={inp} />
          </div>
        )}
      </div>
    </div>
  );
}

type ServicesData = {
  pack: boolean; packOpt: string;
  mont: boolean; montOpt: string;
  rein: boolean; reinOpt: string;
  lagr: boolean; lagrWochen: number;
  lift: boolean; liftOpt: string;
};

type FormData = {
  umzugsart: "privat"|"firma"|null;
  unterkunft: string|null;
  von: AddrData;
  nach: AddrData & {unknown: boolean};
  von_zimmer: string|null;
  von_m2: number;
  von_stock: number|null;
  von_lift: boolean;
  nach_stock: number|null;
  nach_lift: boolean;
  sperrgut: boolean;
  sperrgut_items: string[];
  date: string|null;
  dateUnknown: boolean;
  flex: "fix"|"3"|"7"|"14";
  vol: "klein"|"mittel"|"gross"|"sehr-gross"|null;
  services: ServicesData;
  anrede: "Herr"|"Frau"|"Divers";
  vorname: string;
  nachname: string;
  email: string;
  tel: string;
  zeit: string;
  offerten: 3|4|5;
  bemerkungen: string;
};

const emptyAddr = (): AddrData => ({country:"CH", str:"", nr:"", plz:"", ort:"", city:""});

const initialData = (): FormData => ({
  umzugsart: null,
  unterkunft: null,
  von: emptyAddr(),
  nach: {...emptyAddr(), unknown: false},
  von_zimmer: null,
  von_m2: 0,
  von_stock: null,
  von_lift: false,
  nach_stock: null,
  nach_lift: false,
  sperrgut: false,
  sperrgut_items: [],
  date: null,
  dateUnknown: false,
  flex: "fix",
  vol: null,
  services: {
    pack:false, packOpt:"Alles",
    mont:false, montOpt:"Demontage & Montage",
    rein:false, reinOpt:"Besenrein",
    lagr:false, lagrWochen:2,
    lift:false, liftOpt:"Auszug",
  },
  anrede: "Herr",
  vorname: "",
  nachname: "",
  email: "",
  tel: "",
  zeit: "anytime",
  offerten: 3,
  bemerkungen: "",
});

export interface UmzugWizardProps {
  formId?: string;
  onComplete?: () => void;
}

export const UmzugWizard = ({ formId, onComplete }: UmzugWizardProps = {}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<FormData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { return JSON.parse(saved) as FormData; } catch { return initialData(); } }
    return initialData();
  });

  // PLZ autocomplete
  const [vonAc, setVonAc] = useState<PlzEntry[]>([]);
  const [nachAc, setNachAc] = useState<PlzEntry[]>([]);
  const [vonAcOpen, setVonAcOpen] = useState(false);
  const [nachAcOpen, setNachAcOpen] = useState(false);

  // Country selector open/close
  const [vonCountryOpen, setVonCountryOpen] = useState(false);
  const [nachCountryOpen, setNachCountryOpen] = useState(false);

  // Distance badge
  const [distText, setDistText] = useState<string|null>(null);
  const [distLoading, setDistLoading] = useState(false);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(form)); }, [form]);

  const upd = (patch: Partial<FormData>) => setForm(prev => ({...prev, ...patch}));
  const updSvc = (patch: Partial<ServicesData>) => upd({services:{...form.services,...patch}});

  // ─── Validation ──────────────────────────────────────────
  const isValid = (s: number): boolean => {
    switch (s) {
      case 1: return !!(form.umzugsart && form.unterkunft);
      case 2: {
        const isCH_von = form.von.country === "CH";
        const vonOk = form.von.str.trim().length > 0 && (isCH_von ? form.von.plz.length >= 3 : form.von.city.trim().length >= 2);
        const isCH_nach = form.nach.country === "CH";
        const nachOk = form.nach.unknown
          || (form.nach.str.trim().length > 0 && (isCH_nach ? form.nach.plz.length >= 3 : form.nach.city.trim().length >= 2));
        return vonOk && nachOk;
      }
      case 3: return form.von_zimmer !== null && form.von_stock !== null
        && (form.nach.unknown || form.nach_stock !== null);
      case 4: return !!(form.date || form.dateUnknown) && form.vol !== null;
      case 5: {
        const emailOk = isEmailAcceptable(form.email);
        const telOk = form.tel.replace(/\s/g,"").length >= 8;
        return form.vorname.length >= 2 && form.nachname.length >= 2 && emailOk && telOk;
      }
      default: return true;
    }
  };

  const goNext = () => { if (isValid(step) && step < TOTAL_STEPS) { setStep(s=>s+1); window.scrollTo({top:0,behavior:"smooth"}); } };
  const goBack = () => { if (step > 1) { setStep(s=>s-1); window.scrollTo({top:0,behavior:"smooth"}); } };

  // ─── PLZ Autocomplete ─────────────────────────────────────
  const handlePlz = async (side:"von"|"nach", val:string) => {
    const v = val.replace(/\D/g,"").slice(0,4);
    if (side === "von") {
      upd({von:{...form.von, plz:v, ort:v.length<2?"":form.von.ort}});
      const m = await lookupPlz(v);
      setVonAc(m.slice(0,6)); setVonAcOpen(m.length>0);
    } else {
      upd({nach:{...form.nach, plz:v, ort:v.length<2?"":form.nach.ort}});
      const m = await lookupPlz(v);
      setNachAc(m.slice(0,6)); setNachAcOpen(m.length>0);
    }
  };

  const pickPlz = (side:"von"|"nach", item:PlzEntry) => {
    if (side === "von") {
      const nv = {...form.von, plz:item.p, ort:item.o};
      upd({von:nv}); setVonAcOpen(false);
      computeDist(item.o, form.nach.unknown ? null : form.nach.ort, item.p, form.nach.plz);
    } else {
      const nn = {...form.nach, plz:item.p, ort:item.o};
      upd({nach:nn}); setNachAcOpen(false);
      computeDist(form.von.ort, item.o, form.von.plz, item.p);
    }
  };

  const computeDist = (vonOrt:string, nachOrt:string|null, vonPlz:string, nachPlz:string) => {
    if (!vonOrt || !nachOrt) return;
    setDistLoading(true);
    setTimeout(() => {
      const vp = parseInt(vonPlz||"5000"), np = parseInt(nachPlz||"5000");
      const isIntl = form.von.country !== "CH" || form.nach.country !== "CH";
      const km = isIntl
        ? Math.floor(300 + Math.random()*700)
        : Math.max(5, Math.min(450, Math.round(5 + Math.abs(vp-np)/55)));
      setDistText(`~${km} km · ${vonOrt} → ${nachOrt}`);
      setDistLoading(false);
    }, 600);
  };

  // ─── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!isValid(5) || isSubmitting) return;
    setIsSubmitting(true);

    if (recaptchaEnabled) {
      try {
        const token = await executeRecaptcha("submit_umzug_form");
        if (token) {
          const {data:r} = await supabase.functions.invoke("verify-recaptcha",{body:{token,action:"submit_umzug_form"}});
          if (!r?.success) { toast({title:"Sicherheitsüberprüfung fehlgeschlagen",variant:"destructive"}); setIsSubmitting(false); return; }
        }
      } catch(e) { console.error(e); }
    }

    try {
      const vonFloor = form.von_stock !== null ? STOCK_OPTS[form.von_stock].floor : 0;
      const nachFloor = form.nach_stock !== null ? STOCK_OPTS[form.nach_stock].floor : 0;
      const vonCity = form.von.country === "CH" ? form.von.ort : form.von.city;
      const nachCity = form.nach.country === "CH" ? form.nach.ort : form.nach.city;

      const isInternational = form.von.country !== "CH" || form.nach.country !== "CH";
      const svcType = isInternational
        ? "umzug_international"
        : form.umzugsart === "firma" ? "umzug_firma" : "umzug_privat";

      const leadData = {
        service_type: svcType,
        from_plz: form.von.country === "CH" ? form.von.plz : null,
        from_city: vonCity,
        from_street: form.von.str,
        from_house_number: form.von.nr || null,
        from_floor: vonFloor,
        from_has_lift: form.von_lift,
        from_rooms: form.von_zimmer ? parseFloat(form.von_zimmer.replace("+","")) : null,
        from_living_space_m2: form.von_m2 || null,
        to_plz: form.nach.unknown ? null : (form.nach.country === "CH" ? form.nach.plz : null),
        to_city: form.nach.unknown ? null : nachCity,
        to_street: form.nach.unknown ? null : form.nach.str,
        to_house_number: form.nach.unknown ? null : (form.nach.nr || null),
        to_floor: form.nach.unknown ? 0 : nachFloor,
        to_has_lift: form.nach_lift,
        customer_first_name: form.vorname,
        customer_last_name: form.nachname,
        customer_email: form.email,
        customer_phone: form.tel.startsWith("+") ? form.tel : `+41${form.tel.replace(/\s/g,"")}`,
        customer_salutation: form.anrede,
        customer_contact_time: form.zeit,
        preferred_date: form.date || null,
        is_flexible_date: form.dateUnknown || form.flex !== "fix",
        moving_flexibility: form.flex,
        description: form.bemerkungen || null,
        packing_service_needed: form.services.pack,
        cleaning_service_needed: form.services.rein,
        storage_needed: form.services.lagr,
        status: "pending_verification",
        form_version: 2,
        max_companies: form.offerten,
        source_form_id: formId || null,
        detailed_form_data: {
          ...form,
          von_country: form.von.country,
          nach_country: form.nach.country,
          sperrgut_items: form.sperrgut_items,
        } as unknown as Record<string,unknown>,
        additional_services_umzug: {
          verpackung: {aktiv: form.services.pack, umfang: form.services.packOpt},
          moebelmontage: form.services.mont,
          endreinigung: form.services.rein,
          zwischenlagerung: {aktiv: form.services.lagr, dauer_wochen: form.services.lagrWochen},
          moebellift: {aktiv: form.services.lift, standort: form.services.liftOpt},
          sperrgut: {aktiv: form.sperrgut, items: form.sperrgut_items},
        },
      };

      const {data:newLeadId, error} = await supabase.rpc("submit_lead_json",{lead_data:leadData});
      if (error) throw error;

      triggerLeadQualityValidation(newLeadId as string | null);

      sendCustomerConfirmation({
        firstName: form.vorname,
        lastName: form.nachname,
        email: form.email,
        serviceType: svcType,
        fromCity: vonCity,
        toCity: form.nach.unknown ? undefined : (nachCity || undefined),
        maxCompanies: form.offerten ?? 3,
      });

      localStorage.removeItem(STORAGE_KEY);
      onComplete?.();
      navigate("/anfrage/erfolg",{state:{anfrage_nummer:newLeadId,service_type:svcType}});
    } catch(error) {
      console.error(error);
      toast({title:"Fehler beim Senden",description:"Bitte versuchen Sie es erneut.",variant:"destructive"});
      setIsSubmitting(false);
    }
  };

  // ─── Reusable: SelectCard ─────────────────────────────────
  const SelectCard = ({selected,onClick,children,className}:{selected:boolean;onClick:()=>void;children:React.ReactNode;className?:string}) => (
    <div onClick={onClick} className={cn(
      "relative bg-white border-2 rounded-xl cursor-pointer select-none transition-all",
      selected ? "border-blue-600 bg-blue-50 shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
               : "border-gray-200 hover:border-blue-300 hover:shadow-md",
      className
    )}>
      {selected && (
        <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center z-10">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      {children}
    </div>
  );

  // ─── Country picker helper ────────────────────────────────
  // ─── Step 1: Art des Umzugs ───────────────────────────────
  const renderStep1 = () => {
    const privatKonut = [
      {v:"wohnung",label:"Wohnung"},
      {v:"haus",label:"Haus"},
      {v:"wg",label:"WG-Zimmer"},
      {v:"lager",label:"Lager"},
      {v:"buro",label:"Büro"},
    ];
    const firmaKonut = [
      {v:"buro",label:"Büro"},
      {v:"lager",label:"Lager"},
      {v:"praxis",label:"Praxis"},
      {v:"geschaeft",label:"Geschäft"},
    ];
    const konutList = form.umzugsart === "firma" ? firmaKonut : privatKonut;

    return (
      <div>
        <div className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 1 von 5</div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2">Wie können wir Ihnen helfen?</h2>
        <p className="text-[15px] text-gray-500 leading-relaxed mb-8">Erhalten Sie Offerten von geprüften Umzugsfirmen — in weniger als 24 Stunden.</p>

        <div className="mb-7">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Art des Umzugs</div>
          <div className="flex gap-2">
            {[
              {v:"privat", label:"Privatumzug",  desc:"Einzelpersonen, Familien & WGs"},
              {v:"firma",  label:"Firmenumzug",   desc:"Büros, Praxen & Gewerbeflächen"},
            ].map(o => (
              <button key={o.v} type="button"
                onClick={() => upd({umzugsart:o.v as "privat"|"firma", unterkunft:null})}
                className={cn(
                  "flex-1 px-4 py-3 rounded-xl border-[1.5px] text-left transition-all select-none",
                  form.umzugsart === o.v
                    ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
                )}>
                <div className={cn("text-[13px] font-semibold", form.umzugsart === o.v ? "text-white" : "text-gray-900")}>{o.label}</div>
                <div className={cn("text-[11px] mt-0.5", form.umzugsart === o.v ? "text-blue-100" : "text-gray-400")}>{o.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {form.umzugsart && (
          <div className="animate-[fadeIn_.2s_ease_both]">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Art der aktuellen Unterkunft</div>
            <div className="flex flex-wrap gap-2">
              {konutList.map(o => (
                <button key={o.v} type="button" onClick={() => upd({unterkunft:o.v})}
                  className={cn(
                    "px-4 py-2 rounded-lg border-[1.5px] text-[13px] font-medium transition-all select-none",
                    form.unterkunft === o.v
                      ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600"
                  )}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Step 2 helpers ───────────────────────────────────────

  const renderStep2 = () => (
    <div>
      <div className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 2 von 5</div>
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2">Von wo — und wohin?</h2>
      <p className="text-[15px] text-gray-500 leading-relaxed mb-6">Geben Sie Ihre aktuelle und neue Adresse ein.</p>

      {/* Distance badge */}
      <div className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm mb-4 border transition-all min-h-[44px]",
        distLoading ? "bg-gray-50 border-gray-200 text-gray-500" :
        distText ? "bg-green-50 border-green-200 text-green-700" :
        "bg-gray-50 border-gray-200 text-gray-400"
      )}>
        {distLoading
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" /><span>Distanz wird berechnet…</span></>
          : distText
          ? <span>Ungefähre Distanz: <strong>{distText}</strong></span>
          : <span>Distanz wird berechnet, sobald beide Orte bekannt sind</span>
        }
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative mb-4">
        <div className="hidden sm:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-white border border-gray-200 rounded-full items-center justify-center z-10 shadow-sm text-gray-400 text-xs font-medium pointer-events-none">→</div>
        <UmzugAddrCard
          isVon={true}
          data={form.von}
          ac={vonAc} acOpen={vonAcOpen}
          countryOpen={vonCountryOpen}
          onCountryOpen={setVonCountryOpen}
          onAcOpen={setVonAcOpen}
          onChangeCountry={code => upd({von:{...form.von,country:code,plz:"",ort:"",city:"",str:""}})}
          onChangeStr={v => upd({von:{...form.von,str:v}})}
          onChangeNr={v => upd({von:{...form.von,nr:v}})}
          onChangeStrNr={(str, nr) => setForm(prev => ({...prev, von:{...prev.von, str, nr}}))}
          onChangePlz={v => handlePlz("von", v)}
          onPickPlz={item => pickPlz("von", item)}
          onChangeOrt={v => upd({von:{...form.von,ort:v}})}
          onChangeCity={v => upd({von:{...form.von,city:v}})}
        />
        <UmzugAddrCard
          isVon={false}
          data={form.nach}
          unknown={form.nach.unknown}
          ac={nachAc} acOpen={nachAcOpen}
          countryOpen={nachCountryOpen}
          onCountryOpen={setNachCountryOpen}
          onAcOpen={setNachAcOpen}
          onChangeCountry={code => upd({nach:{...form.nach,country:code,plz:"",ort:"",city:"",str:""}})}
          onChangeStr={v => upd({nach:{...form.nach,str:v}})}
          onChangeNr={v => upd({nach:{...form.nach,nr:v}})}
          onChangeStrNr={(str, nr) => setForm(prev => ({...prev, nach:{...prev.nach, str, nr}}))}
          onChangePlz={v => handlePlz("nach", v)}
          onPickPlz={item => pickPlz("nach", item)}
          onChangeOrt={v => upd({nach:{...form.nach,ort:v}})}
          onChangeCity={v => upd({nach:{...form.nach,city:v}})}
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer mt-1">
        <div className="relative w-9 h-5 flex-shrink-0">
          <input type="checkbox" checked={form.nach.unknown}
            onChange={e => upd({nach:{...form.nach,unknown:e.target.checked}})} className="sr-only" />
          <div className={cn("absolute inset-0 rounded-full transition-colors", form.nach.unknown?"bg-blue-600":"bg-gray-300")} />
          <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", form.nach.unknown?"translate-x-4":"translate-x-0")} />
        </div>
        <span className="text-sm text-gray-600">Neue Adresse noch nicht bekannt</span>
      </label>
    </div>
  );

  // ─── Step 3: Wohnungsdetails ───────────────────────────────
  const LiftToggle = ({on,onToggle}:{on:boolean;onToggle:()=>void}) => (
    <button type="button" onClick={onToggle} className={cn(
      "w-full flex items-center justify-between px-4 py-3 rounded-xl border-[1.5px] cursor-pointer transition-all select-none text-left",
      on ? "border-blue-500 bg-blue-600" : "bg-white border-gray-200 hover:border-blue-300"
    )}>
      <span className={cn("text-[13px] font-medium", on ? "text-white" : "text-gray-700")}>
        {on ? "Lift vorhanden" : "Kein Lift"}
      </span>
      <div className={cn("flex items-center gap-1 px-1 py-1 rounded-full text-[12px] font-semibold flex-shrink-0",
        on ? "bg-white/20" : "bg-gray-100")}>
        <span className={cn("px-2 py-0.5 rounded-full transition-all", !on && "bg-white text-gray-600 shadow-sm", on && "text-white/70")}>Nein</span>
        <span className={cn("px-2 py-0.5 rounded-full transition-all", on && "bg-white text-blue-700 shadow-sm", !on && "text-gray-400")}>Ja</span>
      </div>
    </button>
  );

  const StockGrid = ({value,onChange}:{value:number|null;onChange:(i:number)=>void}) => (
    <div className="grid grid-cols-5 gap-1">
      {STOCK_OPTS.map((s,i) => (
        <button key={i} type="button" onClick={() => onChange(i)}
          className={cn(
            "h-8 rounded-lg text-[10px] font-medium border-[1.5px] transition-all",
            value===i ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : "bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
          )}>{s.label}</button>
      ))}
    </div>
  );

  const renderStep3 = () => (
    <div>
      <div className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 3 von 5</div>
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2">Details zur Wohnung</h2>
      <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Zimmer und Stockwerk helfen den Firmen bei der Kalkulation.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Aktuelle Wohnung */}
        <div className={cn(
          "bg-white border-[1.5px] rounded-xl overflow-hidden",
          form.von_zimmer!==null && form.von_stock!==null ? "border-green-300" : "border-gray-200"
        )}>
          <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3 border-b border-gray-100 bg-gray-50/70">
            <div>
              <div className="text-[13px] font-semibold text-gray-900">Aktuelle Wohnung</div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                {form.von.country === "CH" ? (form.von.ort || "—") : (form.von.city || form.von.ort || "—")}
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {/* Zimmer + Wohnfläche — side-by-side dropdowns */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Anzahl Zimmer <span className="text-red-400">*</span>
                </div>
                <select
                  value={form.von_zimmer ?? ""}
                  onChange={e => upd({von_zimmer: e.target.value || null})}
                  className={cn(
                    "w-full h-10 rounded-lg border-[1.5px] px-3 text-sm outline-none transition-all appearance-none cursor-pointer",
                    form.von_zimmer
                      ? "border-blue-500 bg-white text-gray-900 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                      : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                  )}>
                  <option value="">Zimmer wählen</option>
                  {ZIMMER_OPTS.map(z => <option key={z} value={z}>{z} Zimmer</option>)}
                </select>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Wohnfläche <span className="normal-case font-normal text-[10px]">(optional)</span>
                </div>
                <select
                  value={form.von_m2 || ""}
                  onChange={e => upd({von_m2: parseInt(e.target.value) || 0})}
                  className={cn(
                    "w-full h-10 rounded-lg border-[1.5px] px-3 text-sm outline-none transition-all appearance-none cursor-pointer",
                    form.von_m2
                      ? "border-blue-500 bg-white text-gray-900 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                      : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                  )}>
                  <option value="">m² wählen</option>
                  {[20,30,40,50,60,70,80,90,100,120,140,160,180,200,250,300].map(s => (
                    <option key={s} value={s}>{s} m²</option>
                  ))}
                  <option value="350">300+ m²</option>
                </select>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Stockwerk <span className="normal-case text-[10px] font-normal">(Pflicht)</span>
              </div>
              <StockGrid value={form.von_stock} onChange={i=>upd({von_stock:i})} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Lift</div>
              <LiftToggle on={form.von_lift} onToggle={()=>upd({von_lift:!form.von_lift})} />
            </div>
          </div>
        </div>

        {/* Neue Wohnung */}
        <div className={cn(
          "bg-white border-[1.5px] rounded-xl overflow-hidden transition-all",
          form.nach.unknown ? "opacity-50 pointer-events-none border-gray-200" :
          form.nach_stock!==null ? "border-green-300" : "border-gray-200"
        )}>
          <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3 border-b border-gray-100 bg-gray-50/70">
            <div>
              <div className="text-[13px] font-semibold text-gray-900">Neue Wohnung</div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                {form.nach.unknown ? "Noch unbekannt" :
                  form.nach.country === "CH" ? (form.nach.ort || "—") : (form.nach.city || form.nach.ort || "—")}
              </div>
            </div>
          </div>
          <div className="p-4 space-y-5">
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Stockwerk <span className="normal-case text-[10px] font-normal">(Pflicht)</span>
              </div>
              <StockGrid value={form.nach_stock} onChange={i=>upd({nach_stock:i})} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Lift</div>
              <LiftToggle on={form.nach_lift} onToggle={()=>upd({nach_lift:!form.nach_lift})} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Step 4: Datum + Menge + Sperrgut + Services ──────────
  const SubChips = ({options,selected,onToggle,color="blue"}:{options:string[];selected:string;onToggle:(v:string)=>void;color?:string}) => (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {options.map(opt => {
        const on = selected === opt;
        return (
          <button key={opt} type="button" onClick={()=>onToggle(opt)}
            className={cn(
              "px-3 py-1 rounded-full border-[1.5px] text-[11px] font-medium transition-all",
              on ? `bg-${color}-600 border-${color}-600 text-white` : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
            )}>{opt}</button>
        );
      })}
    </div>
  );

  const renderStep4 = () => {
    const selectedDate = form.date ? new Date(form.date) : undefined;

    return (
      <div>
        <div className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 4 von 5</div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2">Wann & wie viel?</h2>
        <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Termin, Umfang und optionale Zusatzleistungen.</p>

        {/* Datum unbekannt toggle — ABOVE calendar */}
        <div onClick={() => upd({dateUnknown:!form.dateUnknown, date:form.dateUnknown?form.date:null})}
          className={cn(
            "mb-4 flex items-center justify-between px-4 py-3 rounded-xl border-[1.5px] cursor-pointer transition-all select-none",
            form.dateUnknown ? "border-blue-300 bg-blue-50" : "bg-white border-gray-200 hover:border-gray-300"
          )}>
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-medium text-gray-900">Datum noch nicht bekannt</div>
              <div className="text-xs text-gray-400 mt-0.5">Firmen kontaktieren Sie für die Terminabsprache</div>
            </div>
          </div>
          <div className="flex items-center bg-gray-200 rounded-full p-0.5 gap-0.5 flex-shrink-0 ml-4">
            <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all", !form.dateUnknown?"bg-white text-gray-700 shadow-sm":"text-gray-400")}>Nein</span>
            <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all", form.dateUnknown?"bg-blue-600 text-white shadow-sm":"text-gray-400")}>Ja</span>
          </div>
        </div>

        {/* Calendar */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
            Umzugsdatum
            {form.date && <span className="ml-2 text-blue-600 normal-case text-[11px] font-mono font-medium tracking-normal">· {format(new Date(form.date),"dd. MMM",{locale:de})}</span>}
          </div>

          <div className={cn("relative", form.dateUnknown && "opacity-40 pointer-events-none")}>
            <div className="bg-white border-[1.5px] border-gray-200 rounded-xl w-full">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={d => upd({date:d?format(d,"yyyy-MM-dd"):null})}
                disabled={d => d < addDays(new Date(),2) || d > addDays(new Date(),365)}
                locale={de}
              />
            </div>
            {form.date && (
              <div className="mt-2 flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-medium">
                <span>{format(new Date(form.date),"EEEE, d. MMMM yyyy",{locale:de})}</span>
                <button type="button" onClick={()=>upd({date:null})} className="ml-auto text-xs text-blue-400 hover:text-blue-600">Ändern</button>
              </div>
            )}
          </div>

          {/* Flexibilität */}
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              {v:"fix",label:"Festes Datum"},
              {v:"3",label:"± 3 Tage"},
              {v:"7",label:"± 1 Woche"},
              {v:"14",label:"± 2 Wochen"},
            ].map(o => (
              <button key={o.v} type="button" onClick={()=>upd({flex:o.v as FormData["flex"]})}
                className={cn(
                  "px-4 py-2 rounded-full border-[1.5px] text-sm font-medium transition-all",
                  form.flex===o.v ? "bg-blue-600 border-blue-600 text-white"
                                  : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
                )}>{o.label}</button>
            ))}
          </div>
        </div>

        {/* Menge */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Ungefähre Menge</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {v:"klein",label:"Klein",desc:"1–2 Zi\nWenig Mobiliar",bars:[2,3,2]},
              {v:"mittel",label:"Mittel",desc:"3 Zi\nNormaler Haushalt",bars:[3,5,4,3]},
              {v:"gross",label:"Gross",desc:"4–5 Zi\nViel Mobiliar",bars:[4,6,5,4,3]},
              {v:"sehr-gross",label:"Sehr gross",desc:"Haus / Büro",bars:[3,5,7,5,4,3]},
            ].map(o => (
              <SelectCard key={o.v} selected={form.vol===o.v}
                onClick={()=>upd({vol:o.v as FormData["vol"]})}
                className="p-3 flex flex-col items-center text-center gap-2">
                <div className="flex items-end gap-0.5 h-7 justify-center">
                  {o.bars.map((h,i) => (
                    <div key={i} className={cn("w-2 rounded-sm rounded-b-none transition-colors", form.vol===o.v?"bg-blue-400":"bg-gray-200")}
                      style={{height:`${h/7*28}px`}} />
                  ))}
                </div>
                <div className="font-semibold text-sm text-gray-900">{o.label}</div>
                <div className="text-[11px] text-gray-400 leading-snug whitespace-pre-line">{o.desc}</div>
              </SelectCard>
            ))}
          </div>
        </div>

        {/* Sperrgut / Schwere Gegenstände */}
        <div className="mb-6">
          <div
            onClick={() => upd({sperrgut:!form.sperrgut})}
            className={cn(
              "flex items-center justify-between px-4 py-3.5 rounded-xl border-[1.5px] cursor-pointer transition-all select-none",
              form.sperrgut ? "border-amber-400 bg-amber-50 rounded-b-none" : "bg-white border-gray-200 hover:border-gray-300"
            )}>
            <div>
              <div className="text-sm font-medium text-gray-900">Schwere oder sperrige Gegenstände</div>
              <div className="text-xs text-gray-400 mt-0.5">Klavier, Tresor, Aquarium…</div>
            </div>
            <div className="flex items-center bg-gray-200 rounded-full p-0.5 gap-0.5 flex-shrink-0 ml-3">
              <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all", !form.sperrgut?"bg-white text-gray-700 shadow-sm":"text-gray-400")}>Nein</span>
              <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all", form.sperrgut?"bg-amber-500 text-white shadow-sm":"text-gray-400")}>Ja</span>
            </div>
          </div>
          {form.sperrgut && (
            <div className="px-4 py-3 bg-amber-50 border-[1.5px] border-amber-400 border-t-0 rounded-b-xl flex flex-wrap gap-2">
              {["Klavier","Tresor","Aquarium","Motorrad","Badewanne","Kunstwerk"].map(item => {
                const on = form.sperrgut_items.includes(item);
                return (
                  <button key={item} type="button"
                    onClick={() => upd({sperrgut_items: on ? form.sperrgut_items.filter(x=>x!==item) : [...form.sperrgut_items,item]})}
                    className={cn(
                      "px-3 py-1.5 rounded-full border-[1.5px] text-xs font-medium transition-all",
                      on ? "bg-amber-200 border-amber-400 text-amber-800" : "bg-white border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700"
                    )}>{item}</button>
                );
              })}
            </div>
          )}
        </div>

        {/* Zusatzleistungen */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Zusatzleistungen <span className="normal-case font-normal text-[10px]">(optional)</span>
          </div>
          <div className="space-y-2">
            {/* Verpackungsservice */}
            {[
              {
                id:"pack" as const, label:"Verpackungsservice", desc:"Professionelles Ein- und Auspacken",
                subLabel:"Was soll verpackt werden?", subOpts:["Alles","Nur Fragiles","Nur Auspacken"],
                subKey:"packOpt" as const,
              },
              {
                id:"mont" as const, label:"Möbelmontage", desc:"Ab- und Aufbau an beiden Standorten",
                subLabel:"Wo wird montiert?", subOpts:["Demontage & Montage","Nur Demontage (Auszug)","Nur Montage (Einzug)"],
                subKey:"montOpt" as const,
              },
              {
                id:"rein" as const, label:"Endreinigung", desc:"Besenreine Übergabe der alten Wohnung",
                subLabel:"Art der Reinigung", subOpts:["Besenrein","Inkl. Fenster","Abnahmegarantie"],
                subKey:"reinOpt" as const,
              },
              {
                id:"lift" as const, label:"Möbellift", desc:"Für höhere Stockwerke ohne Lift",
                subLabel:"Wo wird der Lift benötigt?", subOpts:["Auszug","Einzug","Auszug & Einzug"],
                subKey:"liftOpt" as const,
              },
            ].map(svc => {
              const on = form.services[svc.id];
              return (
                <div key={svc.id} className={cn(
                  "bg-white border-[1.5px] rounded-xl overflow-hidden transition-all",
                  on ? "border-blue-500 shadow-[0_0_0_3px_rgba(37,99,235,0.07)]" : "border-gray-200"
                )}>
                  <div className="flex items-center justify-between px-4 py-3.5 cursor-pointer"
                    onClick={() => updSvc({[svc.id]:!on})}>
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{svc.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{svc.desc}</div>
                    </div>
                    <div className="relative w-9 h-5 flex-shrink-0 ml-3">
                      <div className={cn("absolute inset-0 rounded-full transition-colors", on?"bg-blue-600":"bg-gray-300")} />
                      <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", on?"left-[17px]":"left-0.5")} />
                    </div>
                  </div>
                  {on && (
                    <div className="px-4 pb-4 border-t border-blue-100 pt-3">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{svc.subLabel}</div>
                      <SubChips options={svc.subOpts} selected={form.services[svc.subKey] as string}
                        onToggle={v => updSvc({[svc.subKey]:v})} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Zwischenlagerung (counter) */}
            {(() => {
              const on = form.services.lagr;
              return (
                <div className={cn("bg-white border-[1.5px] rounded-xl overflow-hidden transition-all",
                  on?"border-blue-500 shadow-[0_0_0_3px_rgba(37,99,235,0.07)]":"border-gray-200")}>
                  <div className="flex items-center justify-between px-4 py-3.5 cursor-pointer" onClick={()=>updSvc({lagr:!on})}>
                    <div>
                      <div className="font-semibold text-sm text-gray-900">Zwischenlagerung</div>
                      <div className="text-xs text-gray-400 mt-0.5">Sichere Lagerung bis zur Verfügbarkeit</div>
                    </div>
                    <div className="relative w-9 h-5 flex-shrink-0 ml-3">
                      <div className={cn("absolute inset-0 rounded-full transition-colors", on?"bg-blue-600":"bg-gray-300")} />
                      <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", on?"left-[17px]":"left-0.5")} />
                    </div>
                  </div>
                  {on && (
                    <div className="px-4 pb-4 border-t border-blue-100 pt-3">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Voraussichtliche Dauer</div>
                      <div className="flex items-center bg-gray-50 border-[1.5px] border-gray-200 rounded-lg overflow-hidden w-fit">
                        <button type="button" onClick={()=>updSvc({lagrWochen:Math.max(1,form.services.lagrWochen-1)})}
                          className="w-9 h-9 flex items-center justify-center text-gray-400 text-base hover:bg-gray-200 transition-colors">−</button>
                        <span className="w-12 text-center font-mono text-sm font-medium text-gray-900">{form.services.lagrWochen}</span>
                        <button type="button" onClick={()=>updSvc({lagrWochen:Math.min(52,form.services.lagrWochen+1)})}
                          className="w-9 h-9 flex items-center justify-center text-gray-400 text-base hover:bg-gray-200 transition-colors">+</button>
                        <span className="px-2.5 text-xs text-gray-400 border-l border-gray-200 h-9 flex items-center font-mono">Wochen</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="mt-3 text-center text-xs text-gray-400">Keine Zusatzleistungen? Einfach weiter →</div>
        </div>
      </div>
    );
  };

  // ─── Step 5: Kontakt + Zusammenfassung ───────────────────
  const renderStep5 = () => {
    const emailResult = validateEmail(form.email);
    const emailOk = isEmailAcceptable(form.email);
    const telOk = form.tel.replace(/\s/g,"").length >= 8;
    const inp = "w-full h-10 bg-gray-50 border-[1.5px] rounded-lg px-3 text-sm text-gray-900 outline-none transition-all";
    const inpValid = "border-green-400 bg-white";
    const inpDef = "border-gray-200 hover:border-gray-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.10)]";
    const inpErr = "border-red-400";

    const activeServices = [
      form.services.pack && "Verpackung",
      form.services.mont && "Möbelmontage",
      form.services.rein && "Endreinigung",
      form.services.lagr && "Lagerung",
      form.services.lift && "Möbellift",
    ].filter(Boolean).join(", ") || "Keine";

    const vonCity = form.von.country === "CH" ? form.von.ort : form.von.city;
    const nachCity = form.nach.country === "CH" ? form.nach.ort : form.nach.city;

    return (
      <div>
        <div className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 5 von 5</div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2">Fast geschafft!</h2>
        <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Damit die Umzugsfirmen Sie mit einer Offerte erreichen können.</p>

        {/* Kontaktformular */}
        <div className="bg-white border-[1.5px] border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">Anrede</label>
              <div className="flex gap-2">
                {(["Herr","Frau","Divers"] as const).map(a => (
                  <button key={a} type="button" onClick={()=>upd({anrede:a})}
                    className={cn("flex-1 h-9 rounded-lg border-[1.5px] text-sm font-medium transition-all",
                      form.anrede===a ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-300"
                    )}>{a}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Vorname</label>
                <input type="text" value={form.vorname} onChange={e=>upd({vorname:e.target.value})}
                  placeholder="Max" autoComplete="given-name"
                  className={cn(inp, form.vorname.length>=2?inpValid:inpDef)} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Nachname</label>
                <input type="text" value={form.nachname} onChange={e=>upd({nachname:e.target.value})}
                  placeholder="Muster" autoComplete="family-name"
                  className={cn(inp, form.nachname.length>=2?inpValid:inpDef)} />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">E-Mail</label>
              <input type="email" value={form.email} onChange={e=>upd({email:e.target.value})}
                placeholder="max@beispiel.ch" autoComplete="email"
                className={cn(
                  inp,
                  form.email.length>2 && emailResult.severity==="error" ? inpErr :
                    form.email.length>2 && emailResult.severity==="warning" ? "border-amber-300 bg-white" :
                    form.email.length>2 && emailOk ? inpValid : inpDef
                )} />
              <EmailHint email={form.email} result={emailResult} onAcceptSuggestion={(v)=>upd({email:v})} />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Telefon</label>
              <div className="relative">
                <input type="tel" value={form.tel} onChange={e=>upd({tel:e.target.value})}
                  placeholder="+41 79 123 45 67" autoComplete="tel"
                  className={cn(inp, form.tel.length>5&&telOk?inpValid:form.tel.length>5&&!telOk?inpErr:inpDef)} />
              </div>
              {form.tel.length>5 && !telOk && <p className="text-xs text-red-500 mt-1">Bitte gültige Nummer eingeben</p>}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Bevorzugte Kontaktzeit</label>
              <select value={form.zeit} onChange={e=>upd({zeit:e.target.value})}
                className={cn(inp,"appearance-none cursor-pointer",inpDef)}>
                <option value="anytime">Jederzeit</option>
                <option value="vm">Vormittags (08–12 Uhr)</option>
                <option value="nm">Nachmittags (12–17 Uhr)</option>
                <option value="ab">Abends (17–20 Uhr)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Zusammenfassung */}
        <div className="mb-6">
          <div className="bg-white border-[1.5px] border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50/70 border-b border-gray-100">
              <span className="text-[13px] font-semibold text-gray-900">Ihre Angaben</span>
              <button type="button" onClick={()=>setStep(1)} className="text-[11px] text-blue-500 font-medium">Alles bearbeiten</button>
            </div>
            {[
              {lb:"Umzugstyp",val:`${form.umzugsart==="firma"?"Firmenumzug":"Privatumzug"} · ${form.unterkunft||"—"}`,go:1},
              {lb:"Strecke",val:`${[form.von.str,vonCity].filter(Boolean).join(", ")||"—"} → ${form.nach.unknown?"Unbekannt":([form.nach.str,nachCity].filter(Boolean).join(", ")||"—")}`,go:2},
              {lb:"Details",val:[
                form.von_zimmer?`${form.von_zimmer}Zi`:"",
                form.von_m2?`${form.von_m2}m²`:"",
                form.von_stock!==null?`Auszug ${STOCK_OPTS[form.von_stock].label}`:"",
                form.nach_stock!==null?`Einzug ${STOCK_OPTS[form.nach_stock].label}`:"",
              ].filter(Boolean).join(" · ")||"—",go:3},
              {lb:"Termin",val:form.dateUnknown?"Datum offen":form.date?format(new Date(form.date),"d. MMM yyyy",{locale:de}):"—",go:4},
              {lb:"Umfang + Services",val:[
                form.vol?{klein:"Klein",mittel:"Mittel",gross:"Gross","sehr-gross":"Sehr gross"}[form.vol]:"—",
                activeServices!=="Keine"?activeServices:"",
              ].filter(Boolean).join(" · ")||"—",go:4},
            ].map((r,i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                <span className="text-xs text-gray-400 font-medium flex-shrink-0 w-28">{r.lb}</span>
                <span className="text-xs font-medium text-gray-800 text-right flex-1 mx-3 truncate">{r.val}</span>
                <button type="button" onClick={()=>setStep(r.go)}
                  className="text-[11px] text-blue-500 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-all flex-shrink-0">Ändern</button>
              </div>
            ))}
          </div>
        </div>

        {/* Anzahl Offerten */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Wie viele Offerten?</div>
          <div className="flex gap-3">
            {([
              {v:3,label:"3",sub:"Offerten",badge:true},
              {v:4,label:"4",sub:"Offerten"},
              {v:5,label:"5",sub:"Offerten"},
            ] as {v:3|4|5;label:string;sub:string;badge?:boolean}[]).map(o => (
              <div key={o.v} onClick={()=>upd({offerten:o.v})}
                className={cn(
                  "flex-1 relative text-center cursor-pointer rounded-xl border-[1.5px] py-3 px-2 transition-all select-none",
                  form.offerten===o.v ? "border-blue-600 bg-blue-50 shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
                                      : "border-gray-200 bg-white hover:border-blue-300"
                )}>
                {o.badge && <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">Empfohlen</div>}
                <div className={cn("text-2xl font-semibold tracking-tight", form.offerten===o.v?"text-blue-600":"text-gray-900")}>{o.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{o.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bemerkungen */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
            Bemerkungen <span className="normal-case font-normal text-[10px]">(optional)</span>
          </div>
          <textarea value={form.bemerkungen} onChange={e=>upd({bemerkungen:e.target.value})}
            placeholder="z.B. enge Treppe, bitte frühzeitig kontaktieren, Einzug noch nicht fix…"
            rows={3}
            className="w-full bg-gray-50 border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none resize-none transition-all hover:border-gray-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.10)] leading-relaxed" />
        </div>

        {/* Submit */}
        <button type="button" onClick={handleSubmit}
          disabled={!isValid(5)||isSubmitting}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-[15px] rounded-xl transition-all flex items-center justify-center gap-2.5 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 hover:shadow-blue-200">
          {isSubmitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Wird gesendet…</span></>
            : <><Send className="w-4 h-4" /><span>Anfrage kostenlos absenden</span></>
          }
        </button>

        <div className="flex items-center justify-center gap-5 mt-4 flex-wrap">
          {["Geprüfte Firmen","Daten geschützt","Antwort in 24h","100% kostenlos"].map(t => (
            <span key={t} className="text-[11px] text-gray-400">{t}</span>
          ))}
        </div>
      </div>
    );
  };

  // ─── Progress Bar ─────────────────────────────────────────
  const renderProgress = () => (
    <div className="mb-5">
      <div className="flex items-center gap-1 mb-2">
        {Array.from({length:TOTAL_STEPS},(_,i)=>i+1).map((s,i) => (
          <div key={s} className={cn("flex items-center", i < TOTAL_STEPS - 1 && "flex-1")}>
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold font-mono flex-shrink-0 transition-all",
              s < step   ? "bg-green-500 text-white" :
              s === step ? "bg-blue-600 text-white ring-2 ring-blue-200" :
                            "bg-gray-100 text-gray-400"
            )}>
              {s < step ? <Check className="w-3 h-3" /> : s}
            </div>
            {i < TOTAL_STEPS - 1 && (
              <div className={cn("flex-1 h-[2px] mx-1 rounded transition-colors", s < step ? "bg-green-400" : "bg-gray-200")} />
            )}
          </div>
        ))}
      </div>
      <div className="h-[3px] bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 rounded-full transition-all duration-400" style={{width:`${(step/TOTAL_STEPS)*100}%`}} />
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      {renderProgress()}

      <div className="pb-24">
        {step===1 && renderStep1()}
        {step===2 && renderStep2()}
        {step===3 && renderStep3()}
        {step===4 && renderStep4()}
        {step===5 && renderStep5()}
      </div>

      {/* Fixed bottom nav (steps 1–4 only) */}
      {step < TOTAL_STEPS && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 px-5 py-3.5 z-50">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button type="button"
              style={{visibility: step > 1 ? "visible" : "hidden"}}
              onClick={goBack}
              className="flex items-center gap-1.5 px-4 h-10 border-[1.5px] border-gray-200 rounded-xl text-[14px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all">
              ← Zurück
            </button>
            <button type="button" onClick={goNext} disabled={!isValid(step)}
              className="flex items-center gap-1.5 px-6 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-[14px] font-semibold transition-all hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(37,99,235,0.3)] disabled:transform-none disabled:shadow-none">
              Weiter →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
