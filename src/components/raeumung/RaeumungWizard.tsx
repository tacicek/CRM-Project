// RaeumungWizard — Combined Räumung & Entsorgung wizard (redesigned, dynamic flow)
import { useState, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sendCustomerConfirmation } from "@/lib/sendCustomerConfirmation";
import { triggerLeadQualityValidation } from "@/lib/triggerLeadQualityValidation";
import { validateEmail, isEmailAcceptable } from "@/lib/emailValidation";
import { EmailHint } from "@/components/ui/email-hint";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { de } from "date-fns/locale";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { verifyRecaptchaToken } from "@/lib/recaptchaVerify";
import { floorLabelToInt } from "@/lib/floorUtils";
import { AddrCard } from "@/components/shared/AddrCard";
import { type PlzEntry } from "@/data/swissPlz";
import { lookupPlz } from "@/lib/plzLookup";


const STOCK_OPTS = [
  "UG","EG","HP","1. OG","2. OG","3. OG","4. OG","5. OG",
  "6. OG","7. OG","8. OG","9. OG","10. OG","11–15. OG","15.+ OG",
];

type SvcType = "raeumung" | "entsorgung" | "beides";
type StepId  = "entry" | "r1" | "r2" | "r3" | "e1" | "e2" | "last";

const getFlow = (svc: SvcType | null): StepId[] => {
  if (!svc)                return ["entry"];
  if (svc === "raeumung")  return ["entry", "r1", "r2", "r3", "last"];
  if (svc === "entsorgung") return ["entry", "e1", "e2", "last"];
  return ["entry", "r1", "r2", "r3", "e1", "last"]; // beides — use Räumung address for both
};

const SVC_CONFIG: Record<SvcType, { label: string; color: string }> = {
  raeumung:   { label: "Räumung",             color: "bg-sky-50 text-sky-700 border-sky-200"       },
  entsorgung: { label: "Entsorgung",          color: "bg-amber-50 text-amber-700 border-amber-200"  },
  beides:     { label: "Räumung & Entsorgung", color: "bg-blue-50 text-blue-700 border-blue-200"     },
};

export interface RaeumungWizardProps {
  onComplete?: () => void;
  maxCompanies?: number;
  initialType?: SvcType;
  formId?: string;
}

export function RaeumungWizard({ onComplete, maxCompanies = 3, initialType, formId }: RaeumungWizardProps) {
  const { toast }  = useToast();
  const navigate   = useNavigate();
  const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();

  const [svcType, setSvcType] = useState<SvcType | null>(initialType ?? null);
  const [stepIdx, setStepIdx] = useState(initialType ? 1 : 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const wizardTopRef = useRef<HTMLDivElement>(null);

  // R1 — Räumungsart
  const [rart, setRart] = useState<string | null>(null);

  // R2 — Grösse + Adresse
  const [m2,    setM2]    = useState(60);
  const [str,   setStr]   = useState("");
  const [nr,    setNr]    = useState("");
  const [plz,   setPlz]   = useState("");
  const [ort,   setOrt]   = useState("");
  const [stock, setStock] = useState<number | null>(null);
  const [lift,  setLift]  = useState(false);
  const [acOpen, setAcOpen] = useState(false);
  const [acList, setAcList] = useState<PlzEntry[]>([]);

  // R3 — Umfang + Details
  const [vol,          setVol]          = useState<string | null>(null);
  const [dring,        setDring]        = useState("normal");
  const [schwer,       setSchwer]       = useState(false);
  const [schwerItems,  setSchwerItems]  = useState<Set<string>>(new Set());
  const [zustand,      setZustand]      = useState(false);
  const [zustandText,  setZustandText]  = useState("");
  const [zus,          setZus]          = useState<Set<string>>(new Set());

  // E1 — Entsorgung Kategorien + Menge
  const [entCats, setEntCats] = useState<Set<string>>(new Set(["moebel"]));
  const [menge,   setMenge]   = useState<string | null>(null);

  // E2 — Entsorgung Adresse (entsorgung-only flow)
  const [eDring,  setEDring]  = useState("normal");
  const [eStr,    setEStr]    = useState("");
  const [eNr,     setENr]     = useState("");
  const [ePlz,    setEPlz]    = useState("");
  const [eOrt,    setEOrt]    = useState("");
  const [eStock,  setEStock]  = useState<number | null>(null);
  const [eAcOpen, setEAcOpen] = useState(false);
  const [eAcList, setEAcList] = useState<PlzEntry[]>([]);

  // Last step
  const [date,       setDate]       = useState<Date | undefined>(undefined);
  const [dateUnk,    setDateUnk]    = useState(false);
  const [flex,       setFlex]       = useState("fix");
  const [offerten,   setOfferten]   = useState<3 | 4 | 5>(3);
  const [anrede,     setAnrede]     = useState<"Herr" | "Frau" | "Divers">("Herr");
  const [vorname,    setVorname]    = useState("");
  const [nachname,   setNachname]   = useState("");
  const [email,      setEmail]      = useState("");
  const [tel,        setTel]        = useState("");
  const [zeit,       setZeit]       = useState("any");
  const [bemerkungen,setBemerkungen]= useState("");

  const flow        = getFlow(svcType);
  const currentStep = flow[stepIdx];
  const TOTAL_STEPS = flow.length - 1;
  const _progressPct = TOTAL_STEPS > 0 ? Math.round((stepIdx / TOTAL_STEPS) * 100) : 0;

  const emailResult = validateEmail(email);
  const emailOk = isEmailAcceptable(email);
  const telOk   = /^[0-9\s+\-()]{8,16}$/.test(tel.trim());

  // ─── Validation ─────────────────────────────────────────────────────────────

  const canProceed = (): boolean => {
    switch (currentStep) {
      case "entry": return !!svcType;
      case "r1":    return !!rart;
      case "r2":    return !!(str.trim() && plz.length >= 4 && stock !== null);
      case "r3":    return !!vol;
      case "e1":    return !!(entCats.size > 0 && menge);
      case "e2":    return !!(eStr.trim() && ePlz.length >= 4 && eStock !== null);
      case "last":  return !!(
        vorname.trim().length >= 2 &&
        nachname.trim().length >= 2 &&
        emailOk && telOk &&
        (!!date || dateUnk)
      );
      default: return false;
    }
  };

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const handleNext = () => {
    if (stepIdx < flow.length - 1) {
      setStepIdx(s => s + 1);
    }
  };

  const handleBack = () => {
    if (stepIdx > 0) {
      setStepIdx(s => s - 1);
    }
  };

  // Always show step title + Fortschritt first (Layout has fixed Header + pt-24/28 on main).
  useLayoutEffect(() => {
    wizardTopRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [stepIdx]);

  const handleSvcType = (type: SvcType) => {
    setSvcType(type);
    if (type === "beides") {
      setZus(prev => new Set([...prev, "entsorgung"]));
    }
  };

  // ─── PLZ autocomplete ────────────────────────────────────────────────────────

  const handlePlz = async (val: string, side: "r" | "e") => {
    const v = val.replace(/\D/g, "").slice(0, 4);
    if (side === "r") {
      setPlz(v);
      if (v.length >= 2) {
        const m = await lookupPlz(v);
        setAcList(m.slice(0, 6));
        setAcOpen(m.length > 0);
      } else {
        setAcOpen(false);
        setOrt("");
      }
    } else {
      setEPlz(v);
      if (v.length >= 2) {
        const m = await lookupPlz(v);
        setEAcList(m.slice(0, 6));
        setEAcOpen(m.length > 0);
      } else {
        setEAcOpen(false);
        setEOrt("");
      }
    }
  };

  const pickPlz = (entry: PlzEntry, side: "r" | "e") => {
    if (side === "r") {
      setPlz(entry.p); setOrt(entry.o); setAcOpen(false);
    } else {
      setEPlz(entry.p); setEOrt(entry.o); setEAcOpen(false);
    }
  };

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!canProceed() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (recaptchaEnabled) {
        const token = await executeRecaptcha("raeumung_anfrage");
        if (token) {
          const ok = await verifyRecaptchaToken(token, "raeumung_anfrage");
          if (!ok) throw new Error("reCAPTCHA fehlgeschlagen. Bitte versuchen Sie es erneut.");
        }
      }

      const isEntsorgungOnly = svcType === "entsorgung";
      const addrPlz  = isEntsorgungOnly ? ePlz   : plz;
      const addrCity = isEntsorgungOnly ? eOrt   : ort;
      const addrStr  = isEntsorgungOnly ? eStr   : str;
      const addrNr   = isEntsorgungOnly ? eNr    : nr;
      const addrStk  = isEntsorgungOnly ? eStock : stock;

      const leadData = {
        service_type:       isEntsorgungOnly ? "entsorgung" : "raeumung",
        from_plz:           addrPlz,
        from_city:          addrCity,
        from_street:        addrStr,
        from_house_number:  addrNr,
        from_floor:         addrStk !== null ? floorLabelToInt(STOCK_OPTS[addrStk]) : null,
        from_has_lift:      isEntsorgungOnly ? false : lift,
        property_type:      isEntsorgungOnly ? "sonstiges" : (rart ?? "wohnung"),
        preferred_date:     date ? date.toISOString().split("T")[0] : null,
        is_flexible_date:   dateUnk || flex !== "fix",
        moving_flexibility: flex,
        description:        bemerkungen || null,
        customer_salutation:  anrede,
        customer_first_name:  vorname.trim(),
        customer_last_name:   nachname.trim(),
        customer_email:       email.trim(),
        customer_phone:       tel.startsWith("+") ? tel.trim() : `+41${tel.replace(/\s/g, "")}`,
        customer_contact_time: zeit === "any" ? null : zeit,
        status:       "pending_verification",
        max_companies: maxCompanies,
        form_version:  2,
        source_form_id: formId || null,
        detailed_form_data: {
          svcType,
          // Räumung
          rart, m2, str, nr, plz, ort,
          stock:      stock !== null ? STOCK_OPTS[stock] : null,
          lift, vol, dring, schwer,
          schwerItems:  [...schwerItems],
          zustand,      zustandText,
          zus:          [...zus],
          // Entsorgung
          entCats:  [...entCats],
          menge,    eDring,
          eStr, eNr, ePlz, eOrt,
          eStock:   eStock !== null ? STOCK_OPTS[eStock] : null,
          // Termin
          flex, offerten,
        },
      };

      const { data: newLeadId, error } = await supabase.rpc("submit_lead_json", { lead_data: leadData });
      if (error) throw error;

      triggerLeadQualityValidation(newLeadId as string | null);

      sendCustomerConfirmation({
        firstName: vorname,
        lastName: nachname,
        email,
        serviceType: svcType ?? "raeumung",
        fromCity: addrCity,
        maxCompanies: offerten,
      });

      if (onComplete) {
        setSubmitted(true);
        onComplete();
      } else {
        navigate("/anfrage/erfolg", { state: { anfrage_nummer: newLeadId, service_type: svcType ?? "raeumung" } });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler beim Absenden. Bitte versuchen Sie es erneut.";
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Success screen (nur für Embedded-Modus) ─────────────────────────────────

  if (submitted) {
    const titles: Record<string, string> = {
      raeumung:   "Räumungsanfrage gesendet!",
      entsorgung: "Entsorgungsanfrage gesendet!",
      beides:     "Anfrage gesendet!",
    };
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center text-4xl mb-6">
          🎉
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-3 text-gray-900 dark:text-gray-100">
          {titles[svcType ?? "raeumung"]}
        </h2>
        <p className="text-base text-gray-500 max-w-sm leading-relaxed mb-6">
          Ihre Anfrage wurde an geprüfte Firmen weitergeleitet. Sie erhalten Offerten innerhalb von 24 Stunden.
        </p>
        <a href="https://offerio.ch" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          Zur Startseite
        </a>
      </div>
    );
  }

  // ─── Shared sub-components ───────────────────────────────────────────────────

  const ChkSvg = () => (
    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
      <path d="M1 3L3 5L7 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const YNToggle = ({ on }: { on: boolean }) => (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-full p-0.5 flex-shrink-0">
      <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all", !on ? "bg-white text-gray-700 shadow-sm" : "text-gray-400")}>Nein</span>
      <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all",  on ? "bg-green-500 text-white" : "text-gray-400")}>Ja</span>
    </div>
  );

  const inputCls = "w-full h-10 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3 text-sm text-gray-900 outline-none transition-all hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-gray-300";

  const StockGrid = ({ value, onChange }: { value: number | null; onChange: (v: number) => void }) => (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
      {STOCK_OPTS.map((s, i) => (
        <button key={i} type="button" onClick={() => onChange(i)}
          className={cn(
            "h-9 rounded-lg text-[11px] font-medium border-[1.5px] transition-all leading-tight px-1",
            value === i
              ? "bg-blue-600 border-blue-600 text-white shadow-sm"
              : "bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
          )}>
          {s}
        </button>
      ))}
    </div>
  );

  // ─── Step renderers ──────────────────────────────────────────────────────────

  const renderEntry = () => {
    const desc: Record<SvcType, string> = {
      raeumung:   "Wohnung, Haus, Keller, Büro räumen lassen",
      entsorgung: "Möbel, Sperrmüll, Elektro entsorgen lassen",
      beides:     "Räumen und gleichzeitig entsorgen",
    };
    const _selColors: Record<SvcType, string> = {
      raeumung:   "border-sky-500 bg-sky-50/70 shadow-[0_0_0_3px_rgba(14,165,233,0.1)]",
      entsorgung: "border-amber-500 bg-amber-50/70 shadow-[0_0_0_3px_rgba(245,158,11,0.1)]",
      beides:     "border-blue-500 bg-blue-50/70 shadow-[0_0_0_3px_rgba(59,130,246,0.1)]",
    };
    const hoverColors: Record<SvcType, string> = {
      raeumung:   "hover:border-sky-400",
      entsorgung: "hover:border-amber-400",
      beides:     "hover:border-blue-400",
    };
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Kostenlose Anfrage</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">Was brauchen Sie?</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Wählen Sie die passende Leistung — wir verbinden Sie mit geprüften Firmen in Ihrer Nähe.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {(["raeumung", "entsorgung", "beides"] as SvcType[]).map(type => {
            const cfg = SVC_CONFIG[type];
            const selected = svcType === type;
            return (
              <button key={type} type="button" onClick={() => handleSvcType(type)}
                className={cn(
                  "flex-1 px-4 py-3 rounded-xl border-[1.5px] text-left transition-all select-none",
                  selected
                    ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                    : cn("bg-white border-gray-200", hoverColors[type])
                )}>
                <div className={cn("text-[13px] font-semibold", selected ? "text-white" : "text-gray-900")}>{cfg.label}</div>
                <div className={cn("text-[11px] mt-0.5", selected ? "text-blue-100" : "text-gray-400")}>{desc[type]}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderR1 = () => {
    const arts = [
      { v: "wohnung",   name: "Wohnungsräumung",  desc: "Wohnung, WG-Zimmer"           },
      { v: "haus",      name: "Hausräumung",       desc: "Einfamilienhaus, Villa"         },
      { v: "keller",    name: "Kellerräumung",     desc: "Keller, Lagerraum, Estrich"    },
      { v: "dachboden", name: "Dachbodenräumung",  desc: "Estrich, Dachboden"            },
      { v: "buero",     name: "Büroräumung",       desc: "Büro, Praxis, Gewerberaum"     },
      { v: "lager",     name: "Lager / Sonstiges", desc: "Lagerraum, Garage, Sonstiges"  },
    ];
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">
            Räumung{svcType === "beides" ? " + Entsorgung" : ""} · Schritt 1
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
            Was soll geräumt werden?
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">Wählen Sie die passende Räumungsart.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {arts.map(a => (
            <button key={a.v} type="button" onClick={() => setRart(a.v)}
              className={cn(
                "px-4 py-2.5 rounded-xl border-[1.5px] text-left transition-all select-none",
                rart === a.v
                  ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600"
              )}>
              <div className={cn("text-[13px] font-semibold", rart === a.v ? "text-white" : "text-gray-900")}>{a.name}</div>
              <div className={cn("text-[11px] mt-0.5", rart === a.v ? "text-blue-100" : "text-gray-400")}>{a.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderR2 = () => (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Räumung · Schritt 2</p>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">Grösse & Standort</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">Ungefähre Fläche und Adresse des zu räumenden Objekts.</p>
      </div>

      {/* m² */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Fläche <span className="normal-case font-normal text-[10px]">(ungefähre Angabe)</span>
        </p>
        <select
          value={m2 || ""}
          onChange={e => setM2(parseInt(e.target.value) || 0)}
          className={cn(
            "w-full h-10 rounded-lg border-[1.5px] px-3 text-sm outline-none transition-all appearance-none cursor-pointer",
            m2
              ? "border-blue-500 bg-white text-gray-900 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
              : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
          )}>
          <option value="">Fläche wählen</option>
          {[10,20,30,40,50,60,70,80,100,120,150,200,250,300,400,500].map(v => (
            <option key={v} value={v}>{v} m²</option>
          ))}
          <option value="700">500+ m²</option>
        </select>
      </div>

      {/* Adresse */}
      <AddrCard
        label="Wo befindet sich das Objekt?"
        icon=""
        strVal={str} nrVal={nr} plzVal={plz} ortVal={ort}
        onStr={setStr} onNr={setNr}
        onPlzChange={v => handlePlz(v, "r")}
        onOrt={setOrt}
        acOpenVal={acOpen} acListVal={acList}
        onPickPlz={e => pickPlz(e, "r")}
        filled={!!(str && plz)}
      />

      {/* Stockwerk */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Stockwerk</p>
        <StockGrid value={stock} onChange={setStock} />
      </div>

      {/* Lift */}
      <button type="button" onClick={() => setLift(v => !v)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 rounded-xl border-[1.5px] transition-all",
          lift ? "border-blue-500 bg-blue-600" : "border-gray-200 bg-white hover:border-gray-300"
        )}>
        <span className={cn("text-[13px] font-medium", lift ? "text-white" : "text-gray-700")}>
          {lift ? "Lift vorhanden" : "Kein Lift"}
        </span>
        <div className={cn("flex items-center gap-1 px-1 py-1 rounded-full text-[12px] font-semibold flex-shrink-0",
          lift ? "bg-white/20" : "bg-gray-100")}>
          <span className={cn("px-2 py-0.5 rounded-full transition-all", !lift && "bg-white text-gray-600 shadow-sm", lift && "text-white/70")}>Nein</span>
          <span className={cn("px-2 py-0.5 rounded-full transition-all", lift && "bg-white text-blue-700 shadow-sm", !lift && "text-gray-400")}>Ja</span>
        </div>
      </button>
    </div>
  );

  const renderR3 = () => {
    const vols = [
      { v: "teil",     bars: [[9,10],[9,16],[9,12]],                        label: "Teilräumung",      desc: "Nur bestimmte Gegenstände"    },
      { v: "mittel",   bars: [[9,13],[9,22],[9,18],[9,14]],                  label: "Teilweise",        desc: "Grössere Möbel & Sperrmüll"   },
      { v: "gross",    bars: [[8,16],[8,26],[8,22],[8,18],[8,13]],            label: "Grosse Räumung",   desc: "Fast alles muss weg"           },
      { v: "komplett", bars: [[7,14],[7,22],[7,28],[7,22],[7,18],[7,13]],    label: "Komplettråumung",  desc: "Alles wird geräumt"            },
    ];
    const dringOpts = [
      { v: "normal",   label: "Normal"       },
      { v: "dringend", label: "Dringend"     },
      { v: "sehr",     label: "Sehr dringend"},
    ];
    const zusCards = [
      { v: "endreinigung",  name: "Endreinigung",           desc: "Besenreine Übergabe nach der Räumung"              },
      { v: "entsorgung",    name: "Entsorgung inbegriffen",  desc: "Fachgerechte Entsorgung aller Gegenstände"         },
      { v: "wiederverkauf", name: "Wiederverkauf / Spende",  desc: "Verwertbare Gegenstände werden weiterverkauft"     },
    ];
    const schwerChips = ["Klavier","Tresor","Aquarium","Motorrad","Badewanne","Kunstwerk"];

    const toggleZus    = (v: string) => setZus(prev => { const n = new Set(prev); if (n.has(v)) { n.delete(v); } else { n.add(v); } return n; });
    const toggleSchwer = (chip: string) => setSchwerItems(prev => { const n = new Set(prev); if (n.has(chip)) { n.delete(chip); } else { n.add(chip); } return n; });

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Räumung · Schritt 3</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">Umfang & Details</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">Wie viel soll geräumt werden und gibt es Besonderheiten?</p>
        </div>

        {/* Umfang */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Umfang der Räumung</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {vols.map(v => (
              <button key={v.v} type="button" onClick={() => setVol(v.v)}
                className={cn(
                  "relative overflow-hidden bg-white border-[1.5px] rounded-xl p-3 transition-all flex flex-col items-center gap-2 text-center",
                  vol === v.v
                    ? "border-blue-500 bg-blue-50/60 shadow-[0_0_0_3px_rgba(59,130,246,0.1)] -translate-y-0.5"
                    : "border-gray-200 hover:border-blue-300 hover:-translate-y-0.5"
                )}>
                <div className="flex items-end justify-center gap-[2px] h-7 w-full">
                  {v.bars.map(([w, h], i) => (
                    <div key={i} style={{ width: w, height: h }}
                      className={cn("rounded-sm flex-shrink-0 transition-colors", vol === v.v ? "bg-blue-400" : "bg-gray-200")} />
                  ))}
                </div>
                <div className="text-[13px] font-semibold text-gray-900">{v.label}</div>
                <div className="text-[11px] text-gray-400 leading-snug">{v.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Dringlichkeit */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Dringlichkeit</p>
          <div className="flex gap-2">
            {dringOpts.map(d => (
              <button key={d.v} type="button" onClick={() => setDring(d.v)}
                className={cn(
                  "flex-1 py-2.5 px-2 rounded-xl border-[1.5px] text-[13px] font-medium transition-all",
                  dring === d.v
                    ? d.v === "sehr" ? "bg-red-600 border-red-600 text-white" : "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                )}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Schwere Gegenstände */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Schwere Gegenstände</p>
          <button type="button" onClick={() => setSchwer(v => !v)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-xl border-[1.5px] transition-all",
              schwer ? "border-blue-300 bg-blue-50/60" : "border-gray-200 bg-white hover:border-gray-300"
            )}>
            <div className="text-left">
              <div className="text-[14px] font-medium text-gray-900">Schwere oder sperrige Gegenstände?</div>
              <div className="text-[12px] text-gray-400 mt-0.5">Klavier, Tresor, Aquarium, Motorrad…</div>
            </div>
            <YNToggle on={schwer} />
          </button>
          {schwer && (
            <div className="flex flex-wrap gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              {schwerChips.map(chip => (
                <button key={chip} type="button" onClick={() => toggleSchwer(chip)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border-[1.5px] text-[12px] font-medium transition-all",
                    schwerItems.has(chip) ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-500 hover:border-blue-300"
                  )}>
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Besondere Umstände */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Besondere Umstände{" "}
            <span className="normal-case font-normal text-gray-300 text-[10px]">(optional)</span>
          </p>
          <button type="button" onClick={() => setZustand(v => !v)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-xl border-[1.5px] transition-all",
              zustand ? "border-amber-300 bg-amber-50/40" : "border-gray-200 bg-white hover:border-gray-300"
            )}>
            <div className="text-left">
              <div className="text-[14px] font-medium text-gray-900">Besondere Umstände vorhanden?</div>
              <div className="text-[12px] text-gray-400 mt-0.5">Starke Verschmutzung, Geruch, Schimmel o.ä.</div>
            </div>
            <YNToggle on={zustand} />
          </button>
          {zustand && (
            <textarea value={zustandText} onChange={e => setZustandText(e.target.value)} rows={3}
              placeholder="Kurze Beschreibung — z.B. Wohnung seit 5 Jahren nicht bewohnt, starker Geruch…"
              className="w-full p-3 bg-gray-50 border-[1.5px] border-gray-200 rounded-xl text-sm text-gray-900 outline-none resize-none transition-all focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-gray-300 leading-relaxed" />
          )}
        </div>

        {/* Zusatzleistungen */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Zusatzleistungen{" "}
            <span className="normal-case font-normal text-gray-300 text-[10px]">(optional)</span>
          </p>
          <div className="space-y-2">
            {zusCards.map(card => (
              <button key={card.v} type="button" onClick={() => toggleZus(card.v)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl border-[1.5px] transition-all",
                  zus.has(card.v) ? "border-blue-500 bg-blue-600" : "border-gray-200 bg-white hover:border-gray-300"
                )}>
                <div className="text-left">
                  <div className={cn("text-[13px] font-semibold", zus.has(card.v) ? "text-white" : "text-gray-900")}>{card.name}</div>
                  <div className={cn("text-[11px] mt-0.5", zus.has(card.v) ? "text-blue-100" : "text-gray-400")}>{card.desc}</div>
                </div>
                <div className={cn(
                  "w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all",
                  zus.has(card.v) ? "bg-white border-white" : "bg-white border-gray-300"
                )}>
                  {zus.has(card.v) && <ChkSvg />}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderE1 = () => {
    const cats = [
      { v: "moebel",    label: "Möbel"               },
      { v: "elektro",   label: "Elektrogeräte"       },
      { v: "sperr",     label: "Sperrmüll"           },
      { v: "bau",       label: "Bauschutt"           },
      { v: "haushalt",  label: "Haushaltsgeräte"     },
      { v: "kleidung",  label: "Kleidung & Textilien"},
      { v: "gemischt",  label: "Gemischt / Alles"    },
    ];
    const menges = [
      { v: "klein",  label: "Klein",  desc: "Passt in einen Kombi oder kleinen Transporter" },
      { v: "mittel", label: "Mittel", desc: "1–2 Zimmer, ein grösserer Transporter"         },
      { v: "gross",  label: "Gross",  desc: "Mehrere Zimmer oder eine LKW-Ladung"           },
    ];
    const toggleCat = (v: string) => setEntCats(prev => { const n = new Set(prev); if (n.has(v)) { n.delete(v); } else { n.add(v); } return n; });
    const eyebrow = svcType === "beides" ? "Entsorgung · Schritt 4" : "Entsorgung · Schritt 1";

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">{eyebrow}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">Was soll entsorgt werden?</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">Wählen Sie die Kategorien — mehrere sind möglich.</p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Kategorien{" "}
            <span className="normal-case font-normal text-gray-300 text-[10px]">(mehrere möglich)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {cats.map(c => (
              <button key={c.v} type="button" onClick={() => toggleCat(c.v)}
                className={cn(
                  "px-3.5 py-2 rounded-full border-[1.5px] text-[13px] font-medium transition-all",
                  entCats.has(c.v)
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
                )}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ungefähre Menge</p>
          <div className="grid grid-cols-3 gap-2.5">
            {menges.map(m => (
              <button key={m.v} type="button" onClick={() => setMenge(m.v)}
                className={cn(
                  "flex-1 px-4 py-3 rounded-xl border-[1.5px] text-left transition-all",
                  menge === m.v
                    ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                    : "border-gray-200 bg-white hover:border-blue-300"
                )}>
                <div className={cn("text-[13px] font-semibold", menge === m.v ? "text-white" : "text-gray-900")}>{m.label}</div>
                <div className={cn("text-[11px] mt-0.5 leading-snug", menge === m.v ? "text-blue-100" : "text-gray-400")}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderE2 = () => {
    const dringOpts = [
      { v: "normal",   label: "Normal"        },
      { v: "dringend", label: "Dringend"      },
      { v: "sehr",     label: "Sehr dringend" },
    ];
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Entsorgung · Schritt 2</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">Standort & Dringlichkeit</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">Wo werden die Gegenstände abgeholt?</p>
        </div>

        <AddrCard
          label="Wo soll abgeholt werden?"
          icon=""
          strVal={eStr} nrVal={eNr} plzVal={ePlz} ortVal={eOrt}
          onStr={setEStr} onNr={setENr}
          onPlzChange={v => handlePlz(v, "e")}
          onOrt={setEOrt}
          acOpenVal={eAcOpen} acListVal={eAcList}
          onPickPlz={e => pickPlz(e, "e")}
          filled={!!(eStr && ePlz)}
        />

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Stockwerk</p>
          <StockGrid value={eStock} onChange={setEStock} />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Dringlichkeit</p>
          <div className="flex gap-2">
            {dringOpts.map(d => (
              <button key={d.v} type="button" onClick={() => setEDring(d.v)}
                className={cn(
                  "flex-1 py-2.5 px-2 rounded-xl border-[1.5px] text-[13px] font-medium transition-all",
                  eDring === d.v
                    ? d.v === "sehr" ? "bg-red-600 border-red-600 text-white" : "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                )}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderLast = () => {
    const stepNum = svcType === "entsorgung" ? 3 : svcType === "beides" ? 5 : 4;
    const flexOpts = [
      { v: "fix", label: "Festes Datum" },
      { v: "3",   label: "± 3 Tage"     },
      { v: "7",   label: "± 1 Woche"    },
      { v: "14",  label: "± 2 Wochen"   },
    ];
    const zeitOpts = [
      { v: "any",       label: "Jederzeit"                },
      { v: "morning",   label: "Vormittags (08–12 Uhr)"  },
      { v: "afternoon", label: "Nachmittags (12–17 Uhr)" },
      { v: "evening",   label: "Abends (17–20 Uhr)"      },
    ];
    const monthsShort = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt {stepNum}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">Termin & Kontakt</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">Wann soll es stattfinden und wie erreichen wir Sie?</p>
        </div>

        {/* Kalender */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Wunschdatum
            {date && (
              <span className="ml-2 text-blue-600 font-mono normal-case tracking-normal font-medium">
                · {date.getDate()}. {monthsShort[date.getMonth()]}
              </span>
            )}
          </p>
          <div className={cn("bg-white border-[1.5px] border-gray-200 rounded-xl w-full transition-all", dateUnk && "opacity-40 pointer-events-none")}>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={de}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </div>
          {date && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[13px] text-blue-700 font-medium">
              <span>{new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date)}</span>
              <button type="button" onClick={() => setDate(undefined)} className="ml-auto text-[11px] text-blue-400 hover:text-blue-600">Ändern</button>
            </div>
          )}
          <button type="button" onClick={() => setDateUnk(v => !v)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-xl border-[1.5px] transition-all mt-2",
              dateUnk ? "border-blue-300 bg-blue-50/60" : "border-gray-200 bg-white hover:border-gray-300"
            )}>
            <div className="text-left">
              <div className="text-[13px] font-medium text-gray-900">Datum noch nicht bekannt</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Firma bespricht Termin direkt mit Ihnen</div>
            </div>
            <YNToggle on={dateUnk} />
          </button>
          {!dateUnk && (
            <div className="flex flex-wrap gap-2 mt-1">
              {flexOpts.map(f => (
                <button key={f.v} type="button" onClick={() => setFlex(f.v)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full border-[1.5px] text-[13px] font-medium transition-all",
                    flex === f.v ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-500 hover:border-blue-300"
                  )}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Offerten */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Anzahl Offerten</p>
          <div className="flex gap-2">
            {([3, 4, 5] as const).map(n => (
              <button key={n} type="button" onClick={() => setOfferten(n)}
                className={cn(
                  "relative flex-1 py-3 rounded-xl border-[1.5px] text-center transition-all",
                  offerten === n
                    ? "border-blue-500 bg-blue-50/60 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]"
                    : "border-gray-200 bg-white hover:border-blue-300"
                )}>
                {n === 3 && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                    Empfohlen
                  </div>
                )}
                <div className={cn("text-2xl font-semibold tracking-tight", offerten === n ? "text-blue-600" : "text-gray-800")}>{n}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Offerten</div>
              </button>
            ))}
          </div>
        </div>

        {/* Kontaktdaten */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ihre Kontaktdaten</p>
          <div className="bg-white border-[1.5px] border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 space-y-3">
              {/* Anrede */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">Anrede</label>
                <div className="flex gap-2">
                  {(["Herr","Frau","Divers"] as const).map(a => (
                    <button key={a} type="button" onClick={() => setAnrede(a)}
                      className={cn(
                        "flex-1 h-9 rounded-lg border-[1.5px] text-[13px] font-medium transition-all",
                        anrede === a ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300"
                      )}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              {/* Name */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Vorname</label>
                  <input type="text" value={vorname} onChange={e => setVorname(e.target.value)} placeholder="Max" className={inputCls} autoComplete="given-name" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Nachname</label>
                  <input type="text" value={nachname} onChange={e => setNachname(e.target.value)} placeholder="Muster" className={inputCls} autoComplete="family-name" />
                </div>
              </div>
              {/* E-Mail */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">E-Mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="max@beispiel.ch"
                  className={cn(
                    inputCls,
                    email.length > 2 && emailResult.severity === "error" && "border-red-300",
                    email.length > 2 && emailResult.severity === "warning" && "border-amber-300",
                  )}
                  autoComplete="email" />
                <EmailHint email={email} result={emailResult} onAcceptSuggestion={setEmail} />
              </div>
              {/* Telefon */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Telefon</label>
                <div className="relative">
                  <input type="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="+41 79 123 45 67"
                    className={cn(inputCls, tel.length > 2 && !telOk && "border-red-300")} autoComplete="tel" />
                </div>
                {tel.length > 2 && !telOk && <p className="text-[11px] text-red-500 mt-1">Bitte gültige Nummer eingeben</p>}
              </div>
              {/* Kontaktzeit */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Bevorzugte Kontaktzeit</label>
                <select value={zeit} onChange={e => setZeit(e.target.value)}
                  className="w-full h-10 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3 pr-8 text-sm text-gray-900 outline-none appearance-none cursor-pointer transition-all focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%239DA3B0%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_11px_center]">
                  {zeitOpts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
              {/* Bemerkungen */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                  Bemerkungen{" "}
                  <span className="normal-case font-normal text-gray-300 text-[10px]">(optional)</span>
                </label>
                <textarea value={bemerkungen} onChange={e => setBemerkungen(e.target.value)} rows={3}
                  placeholder="Zusätzliche Hinweise für die Firmen…"
                  className="w-full p-3 bg-gray-50 border-[1.5px] border-gray-200 rounded-xl text-sm text-gray-900 outline-none resize-none transition-all focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-gray-300 leading-relaxed" />
              </div>
            </div>
          </div>
        </div>

        {/* Trust line — navigation buttons live in fixed footer (same as other steps) */}
        <div className="flex items-center justify-center gap-4 pt-2 pb-1 flex-wrap">
          {["Geprüfte Firmen", "Daten geschützt", "Antwort in 24h", "Kostenlos"].map(item => (
            <span key={item} className="text-[11px] text-gray-400">· {item}</span>
          ))}
        </div>
      </div>
    );
  };

  // ─── Service pill ────────────────────────────────────────────────────────────
  const _svcPill = svcType ? SVC_CONFIG[svcType] : null;

  // ─── Main render ─────────────────────────────────────────────────────────────
  return (
    <div
      ref={wizardTopRef}
      className="max-w-2xl mx-auto px-4 scroll-mt-24 md:scroll-mt-28"
    >
      {/* Compact step indicator — always visible */}
      <div className="mb-5">
        <div className="flex items-center gap-1 mb-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s, i) => (
            <div key={s} className={cn("flex items-center", i < TOTAL_STEPS - 1 && "flex-1")}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 transition-all",
                s < stepIdx   ? "bg-green-500 text-white" :
                s === stepIdx ? "bg-blue-600 text-white ring-2 ring-blue-200" :
                                 "bg-gray-100 text-gray-400"
              )}>
                {s < stepIdx ? <Check className="w-3 h-3" /> : s}
              </div>
              {i < TOTAL_STEPS - 1 && (
                <div className={cn("flex-1 h-[2px] mx-1 rounded transition-colors",
                  s < stepIdx ? "bg-green-400" : "bg-gray-200")} />
              )}
            </div>
          ))}
        </div>
        <div className="h-[3px] bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all duration-400"
            style={{ width: `${(stepIdx / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {/* Active step */}
      <div className="pb-28 sm:pb-32">
        {currentStep === "entry" && renderEntry()}
        {currentStep === "r1"    && renderR1()}
        {currentStep === "r2"    && renderR2()}
        {currentStep === "r3"    && renderR3()}
        {currentStep === "e1"    && renderE1()}
        {currentStep === "e2"    && renderE2()}
        {currentStep === "last"  && renderLast()}
      </div>

      {/* Fixed footer — same position on every step (incl. last) so Nutzer:innen nicht nach unten suchen müssen */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 sm:px-5 py-3 sm:py-3.5 z-50 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          <button type="button"
            style={{ visibility: stepIdx > 0 ? "visible" : "hidden" }}
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3 sm:px-4 h-11 sm:h-10 shrink-0 border-[1.5px] border-gray-200 rounded-xl text-[13px] sm:text-[14px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all">
            ← Zurück
          </button>
          {currentStep === "last" ? (
            <button type="button"
              disabled={!canProceed() || isSubmitting}
              onClick={handleSubmit}
              className="flex-1 min-w-0 h-11 sm:h-10 px-3 sm:px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-[13px] sm:text-[14px] font-semibold transition-all hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(37,99,235,0.3)] disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2">
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6.5" stroke="rgba(255,255,255,.3)" strokeWidth="1.5" />
                    <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="truncate">Wird gesendet…</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 hidden sm:inline">
                    <path d="M3 8h10M8.5 4L13 8l-4.5 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-center leading-tight sm:whitespace-nowrap">Anfrage kostenlos absenden</span>
                </>
              )}
            </button>
          ) : (
            <button type="button"
              disabled={!canProceed()}
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 sm:px-6 h-11 sm:h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-[14px] font-semibold transition-all hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(37,99,235,0.3)] disabled:transform-none disabled:shadow-none">
              Weiter →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
