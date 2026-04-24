// SpezialTransportWizard — 3-step wizard for special transports
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { sendCustomerConfirmation } from "@/lib/sendCustomerConfirmation";
import { triggerLeadQualityValidation } from "@/lib/triggerLeadQualityValidation";
import { validateEmail, isEmailAcceptable } from "@/lib/emailValidation";
import { EmailHint } from "@/components/ui/email-hint";
import { Check, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { de } from "date-fns/locale";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { verifyRecaptchaToken } from "@/lib/recaptchaVerify";
import { floorLabelToInt } from "@/lib/floorUtils";
import { type PlzEntry } from "@/data/swissPlz";
import { lookupPlz } from "@/lib/plzLookup";



const STOCK_OPTS = ["EG","1. OG","2. OG","3. OG","4. OG","5. OG","6. OG","6.+ OG"];

type KatType =
  | "tresor" | "kunst" | "motorrad" | "billard" | "aquarium"
  | "whirlpool" | "usm" | "wasserbett" | "wein" | "fitness"
  | "standuhr" | "spielautomat";

interface ChipOpt  { v: string; label: string; detail?: string; }
interface DetailChips  { type: "chips";   label: string; opts: ChipOpt[]; }
interface DetailCounter { type: "counter"; label: string; min: number; max: number; default: number; }
type DetailConfig = DetailChips | DetailCounter;

const KAT_META: Record<KatType, { ico: string; name: string; detail?: DetailConfig }> = {
  tresor:      { ico:"🔒", name:"Tresor",                   detail:{ type:"chips",   label:"Ungefähres Gewicht",      opts:[{v:"klein",l:"Klein",detail:"bis 100 kg"},{v:"mittel",l:"Mittel",detail:"100–300 kg"},{v:"gross",l:"Gross",detail:"über 300 kg"},{v:"weiss",l:"Weiss nicht"}] } },
  kunst:       { ico:"🖼️", name:"Kunst & Antiquitäten",    detail:{ type:"chips",   label:"Was genau?",              opts:[{v:"gemaelde",l:"Gemälde / Bild"},{v:"skulptur",l:"Skulptur"},{v:"moebel",l:"Antike Möbel"},{v:"sonstiges",l:"Sonstiges"}] } },
  motorrad:    { ico:"🏍️", name:"Motorrad / Roller",       detail:{ type:"chips",   label:"Fahrzeugtyp",             opts:[{v:"motorrad",l:"Motorrad / Töff"},{v:"roller",l:"Roller / Scooter"},{v:"quad",l:"Quad / Trike"}] } },
  billard:     { ico:"🎱", name:"Billardtisch" },
  aquarium:    { ico:"🐠", name:"Aquarium / Terrarium",    detail:{ type:"chips",   label:"Grösse des Aquariums",    opts:[{v:"klein",l:"Klein",detail:"bis 200 Liter"},{v:"mittel",l:"Mittel",detail:"200–500 Liter"},{v:"gross",l:"Gross",detail:"über 500 Liter"}] } },
  whirlpool:   { ico:"🛁", name:"Whirlpool / Jacuzzi" },
  usm:         { ico:"🗄️", name:"USM Schrank",             detail:{ type:"counter", label:"Anzahl Elemente (ungefähr)", min:1, max:30, default:4 } },
  wasserbett:  { ico:"💧", name:"Wasserbett" },
  wein:        { ico:"🍷", name:"Weinkühlschrank / Weinregal" },
  fitness:     { ico:"🏋️", name:"Fitnessgeräte",           detail:{ type:"chips",   label:"Was genau?",              opts:[{v:"laufband",l:"Laufband"},{v:"ruder",l:"Rudergerät"},{v:"rack",l:"Kraftstation / Rack"},{v:"sonstiges",l:"Sonstiges"}] } },
  standuhr:    { ico:"🕰️", name:"Standuhr / Antike Möbel" },
  spielautomat:{ ico:"🎰", name:"Spielautomat / Flipper" },
};

const KAT_CARDS: { v: KatType; desc: string }[] = [
  { v:"tresor",       desc:"Haus- oder Bürotresor"              },
  { v:"kunst",        desc:"Gemälde, Skulpturen, antike Möbel"  },
  { v:"motorrad",     desc:"Töff, Quad, Scooter"                },
  { v:"billard",      desc:"Schwerer Spieltisch"                },
  { v:"aquarium",     desc:"Gross, mit oder ohne Tiere"         },
  { v:"whirlpool",    desc:"Schwer, Spezialaufbau"              },
  { v:"usm",          desc:"Hochwertige Modularmöbel"           },
  { v:"wasserbett",   desc:"Entleeren, transportieren, befüllen"},
  { v:"wein",         desc:"Erschütterungsempfindlich"          },
  { v:"fitness",      desc:"Laufband, Rack, Rudergerät"         },
  { v:"standuhr",     desc:"Sehr empfindlich, wertvoll"         },
  { v:"spielautomat", desc:"Schwer, elektronisch"               },
];

export interface SpezialTransportWizardProps {
  onComplete?: () => void;
  maxCompanies?: number;
  formId?: string;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function AddrInput({
  title, prefix,
  str, nr, plz, ort, stock, lift,
  onStr, onNr, onPlz, onOrt, onStock, onLift,
}: {
  title: string; prefix: string;
  str: string; nr: string; plz: string; ort: string;
  stock: number | null; lift: boolean;
  onStr:(v:string)=>void; onNr:(v:string)=>void;
  onPlz:(v:string)=>void; onOrt:(v:string)=>void;
  onStock:(i:number)=>void; onLift:(v:boolean)=>void;
}) {
  const [acOpen, setAcOpen] = useState(false);
  const [acList, setAcList] = useState<PlzEntry[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const handlePlzInput = async (val: string) => {
    const v = val.replace(/\D/g, "").slice(0, 4);
    onPlz(v);
    if (v.length >= 2) {
      const m = await lookupPlz(v);
      setAcList(m);
      setAcOpen(m.length > 0);
    } else {
      setAcOpen(false);
      onOrt("");
    }
  };

  const pickPlz = (e: PlzEntry) => {
    onPlz(e.p);
    onOrt(e.o);
    setAcOpen(false);
  };

  const inputCls = "w-full h-10 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3 text-sm text-gray-900 outline-none transition-all hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-gray-300";
  const filled = !!(str.trim() && plz.length >= 4);

  const handleStrChange = (raw: string) => {
    const isLikelyAutoFill = raw.length - str.length > 3;
    if (isLikelyAutoFill || !nr) {
      const m = raw.trim().match(/^(.+?)\s+(\d+[a-zA-Z\-/]*)$/);
      if (m) { onStr(m[1].trim()); onNr(m[2].trim()); return; }
    }
    onStr(raw);
  };

  return (
    <div className={cn("bg-white border-[1.5px] rounded-xl transition-all", filled ? "border-green-400" : "border-gray-200")}>
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-3 border-b border-gray-100 bg-gray-50/70 rounded-t-xl">
        <span className="text-[13px] font-semibold text-gray-700">{title}</span>
      </div>
      <div className="p-4 space-y-3">
        {/* Strasse + Nr */}
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Strasse & Hausnummer</label>
          <div className="grid grid-cols-[1fr_72px] gap-2">
            <input type="text" value={str} placeholder="Musterstrasse" onChange={e => handleStrChange(e.target.value)} className={inputCls} autoComplete="address-line1" />
            <input type="text" value={nr}  placeholder="12a"           onChange={e => onNr(e.target.value)}  className={inputCls} autoComplete="off" />
          </div>
        </div>
        {/* PLZ / Ort */}
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">PLZ / Ort</label>
          <div className="relative" ref={wrapRef}>
            <div className="grid grid-cols-[88px_1fr] gap-2">
              <div className="relative">
                <input type="text" value={plz} placeholder="8001" maxLength={4}
                  onChange={e => handlePlzInput(e.target.value)}
                  className={inputCls} autoComplete="postal-code" />
              </div>
              <input type="text" value={ort} onChange={e => onOrt(e.target.value)} placeholder="Zürich" className={inputCls} />
            </div>
            {acOpen && acList.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border-[1.5px] border-blue-200 rounded-xl shadow-xl z-[500] max-h-48 overflow-y-auto" onMouseDown={e => e.preventDefault()}>
                {acList.map(e => (
                  <div key={e.p} onMouseDown={() => pickPlz(e)}
                    className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-0 text-sm">
                    <span className="font-mono text-[11px] text-gray-400 w-9 flex-shrink-0">{e.p}</span>
                    <span className="font-medium text-gray-800">{e.o}</span>
                    <span className="ml-auto text-[11px] text-gray-400">{e.k}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stockwerk */}
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
            Stockwerk ({prefix === "von" ? "Abholung" : "Lieferung"})
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {STOCK_OPTS.map((s, i) => (
              <button key={i} type="button" onClick={() => onStock(i)}
                className={cn(
                  "h-9 rounded-lg text-[11px] font-medium border-[1.5px] transition-all leading-tight px-1",
                  stock === i ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
                )}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Lift */}
        <button type="button" onClick={() => onLift(!lift)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 rounded-xl border-[1.5px] transition-all",
            lift ? "border-blue-500 bg-blue-600" : "border-gray-200 bg-white hover:border-gray-300"
          )}>
          <span className={cn("text-[13px] font-medium", lift ? "text-white" : "text-gray-700")}>
            {lift ? "Lift vorhanden" : "Kein Lift vorhanden"}
          </span>
          <div className={cn("flex items-center gap-1 px-1 py-1 rounded-full text-[12px] font-semibold flex-shrink-0",
            lift ? "bg-white/20" : "bg-gray-100")}>
            <span className={cn("px-2 py-0.5 rounded-full transition-all", !lift && "bg-white text-gray-600 shadow-sm", lift && "text-white/70")}>Nein</span>
            <span className={cn("px-2 py-0.5 rounded-full transition-all", lift && "bg-white text-blue-700 shadow-sm", !lift && "text-gray-400")}>Ja</span>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Main wizard ─────────────────────────────────────────────────────────────

export function SpezialTransportWizard({ onComplete, maxCompanies = 3, formId }: SpezialTransportWizardProps) {
  const { toast }  = useToast();
  const navigate   = useNavigate();
  const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();

  const [step,         setStep]         = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted,    setSubmitted]    = useState(false);

  // Step 1
  const [kat, setKat] = useState<KatType | null>(null);

  // Step 2 — detail answer
  const [detailChip,    setDetailChip]    = useState<string | null>(null);
  const [detailCounter, setDetailCounter] = useState<number>(4);

  // Step 2 — Von address
  const [vonStr,   setVonStr]   = useState("");
  const [vonNr,    setVonNr]    = useState("");
  const [vonPlz,   setVonPlz]   = useState("");
  const [vonOrt,   setVonOrt]   = useState("");
  const [vonStock, setVonStock] = useState<number | null>(null);
  const [vonLift,  setVonLift]  = useState(false);

  // Step 2 — Nach address
  const [nachStr,   setNachStr]   = useState("");
  const [nachNr,    setNachNr]    = useState("");
  const [nachPlz,   setNachPlz]   = useState("");
  const [nachOrt,   setNachOrt]   = useState("");
  const [nachStock, setNachStock] = useState<number | null>(null);
  const [nachLift,  setNachLift]  = useState(false);

  // Step 3
  const [date,        setDate]        = useState<Date | undefined>(undefined);
  const [dateUnk,     setDateUnk]     = useState(false);
  const [flex,        setFlex]        = useState("fix");
  const [offerten,    setOfferten]    = useState<3 | 4 | 5>(3);
  const [anrede,      setAnrede]      = useState<"Herr" | "Frau" | "Divers">("Herr");
  const [vorname,     setVorname]     = useState("");
  const [nachname,    setNachname]    = useState("");
  const [email,       setEmail]       = useState("");
  const [tel,         setTel]         = useState("");
  const [zeit,        setZeit]        = useState("any");
  const [bemerkungen, setBemerkungen] = useState("");

  const TOTAL_STEPS = 3;
  const _progressPct = Math.round((step / TOTAL_STEPS) * 100);

  const emailResult = validateEmail(email);
  const emailOk = isEmailAcceptable(email);
  const telOk   = /^[0-9\s+\-()]{8,16}$/.test(tel.trim());

  const meta = kat ? KAT_META[kat] : null;

  // Reset detail when kat changes
  useEffect(() => {
    if (meta?.detail?.type === "counter") {
      setDetailCounter(meta.detail.default);
    }
    setDetailChip(null);
  }, [kat, meta?.detail?.default, meta?.detail?.type]);

  // ─── Validation ──────────────────────────────────────────────────────────

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return !!kat;
      case 2: {
        const cfg = meta?.detail;
        const detailOk = !cfg || cfg.type === "counter" || !!detailChip;
        return !!(vonStr.trim() && vonPlz.length >= 4 && vonStock !== null &&
                  nachStr.trim() && nachPlz.length >= 4 && nachStock !== null &&
                  detailOk);
      }
      case 3: return !!(vorname.trim().length >= 2 && nachname.trim().length >= 2 && emailOk && telOk && (date || dateUnk));
      default: return false;
    }
  };

  // ─── Navigation ──────────────────────────────────────────────────────────

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(s => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Auto-advance from step 1 after category selection
  const selectKat = (v: KatType) => {
    setKat(v);
    setTimeout(() => {
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 220);
  };

  // ─── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!canProceed() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (recaptchaEnabled) {
        const token = await executeRecaptcha("spezialtransport_anfrage");
        if (token) {
          const ok = await verifyRecaptchaToken(token, "spezialtransport_anfrage");
          if (!ok) throw new Error("reCAPTCHA fehlgeschlagen. Bitte versuchen Sie es erneut.");
        }
      }

      const cfg = meta?.detail;
      const detailAnswer = cfg?.type === "counter" ? detailCounter : detailChip;

      const leadData = {
        service_type:      "spezialtransport",
        from_plz:          vonPlz,
        from_city:         vonOrt,
        from_street:       vonStr,
        from_house_number: vonNr,
        from_floor:        vonStock !== null ? floorLabelToInt(STOCK_OPTS[vonStock]) : null,
        from_has_lift:     vonLift,
        to_plz:            nachPlz,
        to_city:           nachOrt,
        to_street:         nachStr,
        to_house_number:   nachNr,
        to_floor:          nachStock !== null ? floorLabelToInt(STOCK_OPTS[nachStock]) : null,
        to_has_lift:       nachLift,
        preferred_date:    date ? date.toISOString().split("T")[0] : null,
        is_flexible_date:  dateUnk || flex !== "fix",
        moving_flexibility: flex,
        description:       bemerkungen || null,
        customer_salutation:  anrede,
        customer_first_name:  vorname.trim(),
        customer_last_name:   nachname.trim(),
        customer_email:       email.trim(),
        customer_phone:       tel.startsWith("+") ? tel.trim() : `+41${tel.replace(/\s/g, "")}`,
        customer_contact_time: zeit === "any" ? null : zeit,
        status:        "pending_verification",
        max_companies: maxCompanies,
        form_version:  2,
        source_form_id: formId || null,
        detailed_form_data: {
          kat,
          detailAnswer,
          vonStr, vonNr, vonPlz, vonOrt,
          vonStock:  vonStock  !== null ? STOCK_OPTS[vonStock]  : null,
          vonLift,
          nachStr, nachNr, nachPlz, nachOrt,
          nachStock: nachStock !== null ? STOCK_OPTS[nachStock] : null,
          nachLift,
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
        serviceType: "spezialtransport",
        fromCity: vonOrt,
        toCity: nachOrt || undefined,
        maxCompanies,
      });

      if (onComplete) {
        setSubmitted(true);
        onComplete();
      } else {
        navigate("/anfrage/erfolg", { state: { anfrage_nummer: newLeadId, service_type: "spezialtransport" } });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler beim Absenden. Bitte versuchen Sie es erneut.";
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Success (nur für Embedded-Modus) ────────────────────────────────────

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center text-4xl mb-6">
          {meta?.ico ?? "📦"}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-3 text-gray-900 dark:text-gray-100">
          Anfrage gesendet!
        </h2>
        <p className="text-base text-gray-500 max-w-sm leading-relaxed mb-6">
          Ihre Spezialtransport-Anfrage wurde an geprüfte Fachfirmen weitergeleitet. Sie erhalten Offerten innerhalb von 24 Stunden.
        </p>
        <a href="https://offerio.ch" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          Zur Startseite
        </a>
      </div>
    );
  }

  // ─── Shared helpers ───────────────────────────────────────────────────────

  const inputCls = "w-full h-10 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3 text-sm text-gray-900 outline-none transition-all hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-gray-300";

  // ─── Step renderers ───────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 1 von 3</p>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">Was soll transportiert werden?</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">Wählen Sie einfach das Passende — wir finden die richtige Fachfirma.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {KAT_CARDS.map(card => {
          const m = KAT_META[card.v];
          const selected = kat === card.v;
          return (
            <button key={card.v} type="button" onClick={() => selectKat(card.v)}
              className={cn(
                "px-4 py-2.5 rounded-xl border-[1.5px] text-left transition-all select-none",
                selected
                  ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                  : "border-gray-200 bg-white hover:border-blue-300"
              )}>
              <div className={cn("text-[13px] font-semibold", selected ? "text-white" : "text-gray-900")}>{m.name}</div>
              <div className={cn("text-[11px] mt-0.5", selected ? "text-blue-100" : "text-gray-400")}>{card.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderStep2 = () => {
    const cfg = meta?.detail;

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 2 von 3</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
            {meta?.name} transportieren
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">Kurze Angaben zum Objekt und wo es sich befindet.</p>
        </div>

        {/* Detail block — chips */}
        {cfg?.type === "chips" && (
          <div className="bg-white border-[1.5px] border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50/70 border-b border-gray-100">
              <span className="text-[14px] font-semibold text-gray-700">{cfg.label}</span>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {cfg.opts.map(opt => (
                  <button key={opt.v} type="button" onClick={() => setDetailChip(opt.v)}
                    className={cn(
                      "px-4 py-2.5 rounded-full border-[1.5px] text-[13px] font-medium transition-all",
                      detailChip === opt.v
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
                    )}>
                    {opt.label}{opt.detail ? ` (${opt.detail})` : ""}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Detail block — counter */}
        {cfg?.type === "counter" && (
          <div className="bg-white border-[1.5px] border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50/70 border-b border-gray-100">
              <span className="text-[14px] font-semibold text-gray-700">{cfg.label}</span>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-gray-50 border-[1.5px] border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all">
                  <button type="button" onClick={() => setDetailCounter(v => Math.max(cfg.min, v - 1))}
                    className="w-12 h-12 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-14 text-center font-mono text-[18px] font-semibold text-gray-900">{detailCounter}</span>
                  <button type="button" onClick={() => setDetailCounter(v => Math.min(cfg.max, v + 1))}
                    className="w-12 h-12 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[13px] text-gray-400">Elemente (ungefähr)</span>
              </div>
            </div>
          </div>
        )}

        {/* Von address */}
        <AddrInput
          title="Aktueller Standort des Objekts" prefix="von"
          str={vonStr} nr={vonNr} plz={vonPlz} ort={vonOrt} stock={vonStock} lift={vonLift}
          onStr={setVonStr} onNr={setVonNr} onPlz={setVonPlz} onOrt={setVonOrt}
          onStock={setVonStock} onLift={setVonLift}
        />

        {/* Nach address */}
        <AddrInput
          title="Wohin soll es geliefert werden?" prefix="nach"
          str={nachStr} nr={nachNr} plz={nachPlz} ort={nachOrt} stock={nachStock} lift={nachLift}
          onStr={setNachStr} onNr={setNachNr} onPlz={setNachPlz} onOrt={setNachOrt}
          onStock={setNachStock} onLift={setNachLift}
        />
      </div>
    );
  };

  const renderStep3 = () => {
    const monthsShort = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
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
    const canSubmit = vorname.trim().length >= 2 && nachname.trim().length >= 2 && emailOk && telOk && (!!date || dateUnk);

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 3 von 3</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">Termin & Kontakt</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">Wann soll der Transport stattfinden — und wie erreichen wir Sie?</p>
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
            {dateUnk && <span className="ml-2 text-blue-600 font-mono normal-case tracking-normal font-medium">· Noch unbekannt</span>}
          </p>
          <div className={cn("bg-white border-[1.5px] border-gray-200 rounded-xl w-full transition-all", dateUnk && "opacity-40 pointer-events-none")}>
            <Calendar
              mode="single" selected={date} onSelect={setDate} locale={de}
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
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-full p-0.5 flex-shrink-0">
              <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all", !dateUnk ? "bg-white text-gray-700 shadow-sm" : "text-gray-400")}>Nein</span>
              <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all", dateUnk ? "bg-blue-600 text-white" : "text-gray-400")}>Ja</span>
            </div>
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
                  offerten === n ? "border-blue-500 bg-blue-50/60 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]" : "border-gray-200 bg-white hover:border-blue-300"
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
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ihre Kontaktdaten</p>
          <div className="bg-white border-[1.5px] border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 space-y-3">
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
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Telefon</label>
                <div className="relative">
                    <input type="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="+41 79 123 45 67"
                    className={cn(inputCls, tel.length > 2 && !telOk && "border-red-300")} autoComplete="tel" />
                </div>
                {tel.length > 2 && !telOk && <p className="text-[11px] text-red-500 mt-1">Bitte gültige Nummer eingeben</p>}
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Bevorzugte Kontaktzeit</label>
                <div className="relative">
                  <select value={zeit} onChange={e => setZeit(e.target.value)}
                    className="w-full h-10 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3 pr-8 text-sm text-gray-900 outline-none appearance-none cursor-pointer transition-all focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]">
                    {zeitOpts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                  Bemerkungen{" "}
                  <span className="normal-case font-normal text-gray-300 text-[10px]">(optional)</span>
                </label>
                <textarea value={bemerkungen} onChange={e => setBemerkungen(e.target.value)} rows={3}
                  placeholder="Weitere Hinweise — z.B. Treppenhaus-Situation, Zugangscode, besondere Umstände…"
                  className="w-full p-3 bg-gray-50 border-[1.5px] border-gray-200 rounded-xl text-sm text-gray-900 outline-none resize-none transition-all focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-gray-300 leading-relaxed" />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 mt-2">
          <button type="button" onClick={handleBack}
            className="flex items-center gap-1.5 px-5 h-12 border-[1.5px] border-gray-200 rounded-xl text-[14px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all flex-shrink-0">
            ← Zurück
          </button>
          <button type="button" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}
            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-[15px] font-semibold transition-all hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(37,99,235,0.35)] disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2.5">
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="rgba(255,255,255,.3)" strokeWidth="1.5" />
                  <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Wird gesendet…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M8.5 4L13 8l-4.5 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Anfrage kostenlos absenden
              </>
            )}
          </button>
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
          {["Geprüfte Firmen","Daten geschützt","Antwort in 24h","Kostenlos"].map(item => (
            <span key={item} className="text-[11px] text-gray-400">· {item}</span>
          ))}
        </div>
      </div>
    );
  };

  // ─── Main render ─────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4">
      {/* Compact step indicator — always visible */}
      <div className="mb-5">
        <div className="flex items-center gap-1 mb-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s, i) => (
            <div key={s} className={cn("flex items-center", i < TOTAL_STEPS - 1 && "flex-1")}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 transition-all",
                s < step   ? "bg-green-500 text-white" :
                s === step ? "bg-blue-600 text-white ring-2 ring-blue-200" :
                              "bg-gray-100 text-gray-400"
              )}>
                {s < step ? <Check className="w-3 h-3" /> : s}
              </div>
              {i < TOTAL_STEPS - 1 && (
                <div className={cn("flex-1 h-[2px] mx-1 rounded transition-colors",
                  s < step ? "bg-green-400" : "bg-gray-200")} />
              )}
            </div>
          ))}
        </div>
        <div className="h-[3px] bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all duration-400"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {/* Step content */}
      <div className="pb-24">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>

      {/* Footer nav — hidden on step 3 (inline submit) and step 1 (auto-advance) */}
      {step === 2 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-200 px-5 py-3.5 z-50">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button type="button" onClick={handleBack}
              className="flex items-center gap-1.5 px-4 h-10 border-[1.5px] border-gray-200 rounded-xl text-[14px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all">
              ← Zurück
            </button>
            <button type="button" disabled={!canProceed()} onClick={handleNext}
              className="flex items-center gap-1.5 px-6 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-[14px] font-semibold transition-all hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(37,99,235,0.3)] disabled:transform-none disabled:shadow-none">
              Weiter →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
