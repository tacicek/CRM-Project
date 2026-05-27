// KlaviertransportWizard — 5-step wizard (Instrument → Von → Nach → Extras → Kontakt)
import { useState } from "react";
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
import { AddrCard } from "@/components/shared/AddrCard";
import { floorLabelToInt } from "@/lib/floorUtils";
import { type PlzEntry } from "@/data/swissPlz";
import { lookupPlz } from "@/lib/plzLookup";



const STOCK_OPTS = [
  "UG","EG","HP","1. OG","2. OG","3. OG","4. OG","5. OG",
  "6. OG","7. OG","8. OG","9. OG","10. OG","11–15. OG","15.+ OG",
];

type InstType = "klavier" | "flügel-klein" | "flügel-gross" | "sonstiges";

// Flow is always: Instrument → Von-Adresse → Nach-Adresse → Extras → Kontakt
type StepId = "s1" | "s2" | "s2b" | "s3" | "s4";
const FLOW: StepId[] = ["s1", "s2", "s2b", "s3", "s4"];

export interface KlaviertransportWizardProps {
  onComplete?: () => void;
  maxCompanies?: number;
  formId?: string;
}

export function KlaviertransportWizard({ onComplete, maxCompanies = 3, formId }: KlaviertransportWizardProps) {
  const { toast }  = useToast();
  const navigate   = useNavigate();
  const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();

  const [stepIdx,      setStepIdx]      = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted,    setSubmitted]    = useState(false);

  // Step 1 — Instrument
  const [inst, setInst] = useState<InstType | null>(null);

  // Step 2 — Von address
  const [vonStr,    setVonStr]    = useState("");
  const [vonNr,     setVonNr]     = useState("");
  const [vonPlz,    setVonPlz]    = useState("");
  const [vonOrt,    setVonOrt]    = useState("");
  const [vonStock,  setVonStock]  = useState<number | null>(null);
  const [vonLift,   setVonLift]   = useState(false);
  const [vonAcOpen, setVonAcOpen] = useState(false);
  const [vonAcList, setVonAcList] = useState<PlzEntry[]>([]);

  // Step 2b — Nach address
  const [nachStr,    setNachStr]    = useState("");
  const [nachNr,     setNachNr]     = useState("");
  const [nachPlz,    setNachPlz]    = useState("");
  const [nachOrt,    setNachOrt]    = useState("");
  const [nachStock,  setNachStock]  = useState<number | null>(null);
  const [nachLift,   setNachLift]   = useState(false);
  const [nachAcOpen, setNachAcOpen] = useState(false);
  const [nachAcList, setNachAcList] = useState<PlzEntry[]>([]);

  // Step 3 — Extras
  const [zus,         setZus]         = useState<Set<string>>(new Set());
  const [bemerkungen, setBemerkungen] = useState("");

  // Step 4 — Termin & Kontakt
  const [date,     setDate]     = useState<Date | undefined>(undefined);
  const [dateUnk,  setDateUnk]  = useState(false);
  const [flex,     setFlex]     = useState("fix");
  const [offerten, setOfferten] = useState<3 | 4 | 5>(3);
  const [anrede,   setAnrede]   = useState<"Herr" | "Frau" | "Divers">("Herr");
  const [vorname,  setVorname]  = useState("");
  const [nachname, setNachname] = useState("");
  const [email,    setEmail]    = useState("");
  const [tel,      setTel]      = useState("");
  const [zeit,     setZeit]     = useState("any");

  const currentStep = FLOW[stepIdx];
  const TOTAL_STEPS = FLOW.length - 1;
  const _progressPct = TOTAL_STEPS > 0 ? Math.round((stepIdx / TOTAL_STEPS) * 100) : 0;

  const emailResult = validateEmail(email);
  const emailOk = isEmailAcceptable(email);
  const telOk   = /^[0-9\s+\-()]{8,16}$/.test(tel.trim());

  // ─── Validation ──────────────────────────────────────────────────────────────

  const canProceed = (): boolean => {
    switch (currentStep) {
      case "s1":  return !!inst;
      case "s2":  return !!(vonStr.trim() && vonPlz.length >= 4 && vonStock !== null);
      case "s2b": return !!(nachStr.trim() && nachPlz.length >= 4 && nachStock !== null);
      case "s3":  return true;
      case "s4":  return !!(
        vorname.trim().length >= 2 && nachname.trim().length >= 2 &&
        emailOk && telOk && (!!date || dateUnk)
      );
      default: return false;
    }
  };

  // ─── Navigation ──────────────────────────────────────────────────────────────

  const handleNext = () => {
    if (stepIdx < FLOW.length - 1) {
      setStepIdx(s => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (stepIdx > 0) {
      setStepIdx(s => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // ─── PLZ autocomplete ────────────────────────────────────────────────────────

  type PlzSide = "von" | "nach";

  const handlePlzInput = async (val: string, side: PlzSide) => {
    const v = val.replace(/\D/g, "").slice(0, 4);
    const matches = await lookupPlz(v);
    if (side === "von") {
      setVonPlz(v);
      setVonAcList(matches);
      setVonAcOpen(matches.length > 0);
      if (v.length < 2) setVonOrt("");
    } else {
      setNachPlz(v);
      setNachAcList(matches);
      setNachAcOpen(matches.length > 0);
      if (v.length < 2) setNachOrt("");
    }
  };

  const pickPlz = (entry: PlzEntry, side: PlzSide) => {
    if (side === "von")  { setVonPlz(entry.p);  setVonOrt(entry.o);  setVonAcOpen(false); }
    if (side === "nach") { setNachPlz(entry.p); setNachOrt(entry.o); setNachAcOpen(false); }
  };

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!canProceed() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (recaptchaEnabled) {
        const token = await executeRecaptcha("klaviertransport_anfrage");
        if (token) {
          const ok = await verifyRecaptchaToken(token, "klaviertransport_anfrage");
          if (!ok) throw new Error("reCAPTCHA fehlgeschlagen. Bitte versuchen Sie es erneut.");
        }
      }

      const leadData = {
        service_type:       "klaviertransport",
        from_plz:           vonPlz,
        from_city:          vonOrt,
        from_street:        vonStr,
        from_house_number:  vonNr,
        from_floor:         vonStock !== null ? floorLabelToInt(STOCK_OPTS[vonStock]) : null,
        from_has_lift:      vonLift,
        to_plz:             nachPlz,
        to_city:            nachOrt,
        to_street:          nachStr,
        to_house_number:    nachNr,
        to_floor:           nachStock !== null ? floorLabelToInt(STOCK_OPTS[nachStock]) : null,
        to_has_lift:        nachLift,
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
        status:        "pending_verification",
        max_companies: maxCompanies,
        form_version:  2,
        source_form_id: formId || null,
        detailed_form_data: {
          inst,
          vonStr, vonNr, vonPlz, vonOrt,
          vonStock:  vonStock !== null ? STOCK_OPTS[vonStock] : null,
          vonLift,
          nachStr, nachNr, nachPlz, nachOrt,
          nachStock: nachStock !== null ? STOCK_OPTS[nachStock] : null,
          nachLift,
          zus: [...zus],
          bemerkungen,
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
        serviceType: "klaviertransport",
        fromCity: vonOrt,
        toCity: nachOrt || undefined,
        maxCompanies,
      });

      if (onComplete) {
        setSubmitted(true);
        onComplete();
      } else {
        navigate("/anfrage/erfolg", { state: { anfrage_nummer: newLeadId, service_type: "klaviertransport" } });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler beim Absenden. Bitte versuchen Sie es erneut.";
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Success (nur für Embedded-Modus) ────────────────────────────────────────

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center text-4xl mb-6">
          🎹
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-3 text-gray-900">
          Anfrage gesendet!
        </h2>
        <p className="text-base text-gray-500 max-w-sm leading-relaxed mb-6">
          Ihre Klaviertransport-Anfrage wurde an geprüfte Spezialisten weitergeleitet. Sie erhalten Offerten innerhalb von 24 Stunden.
        </p>
        <a href="https://offerio.ch" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          Zur Startseite
        </a>
      </div>
    );
  }

  // ─── Shared UI helpers ───────────────────────────────────────────────────────

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

  const LiftToggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button type="button" onClick={onToggle}
      className={cn(
        "w-full flex items-center justify-between px-4 py-3 rounded-xl border-[1.5px] transition-all",
        on ? "border-blue-500 bg-blue-600" : "border-gray-200 bg-white hover:border-gray-300"
      )}>
      <span className={cn("text-[13px] font-medium", on ? "text-white" : "text-gray-700")}>
        {on ? "Lift vorhanden" : "Kein Lift"}
      </span>
      <YNToggle on={on} />
    </button>
  );

  // ─── Step renderers ──────────────────────────────────────────────────────────

  const renderS1 = () => {
    const insts: { v: InstType; name: string; desc: string }[] = [
      { v: "klavier",      name: "Klavier",        desc: "Aufrechtes Klavier / Piano"     },
      { v: "flügel-klein", name: "Flügel (klein)",  desc: "Baby-Flügel, Stutzflügel"       },
      { v: "flügel-gross", name: "Flügel (gross)",  desc: "Konzertflügel, grosser Flügel"  },
      { v: "sonstiges",    name: "Sonstiges",       desc: "Orgel, Keyboard, Digitalpiano…" },
    ];

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 1 von {TOTAL_STEPS}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Welches Instrument?</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Wählen Sie das Instrument aus, das transportiert werden soll.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {insts.map(i => (
            <button key={i.v} type="button" onClick={() => setInst(i.v)}
              className={cn(
                "px-4 py-2.5 rounded-xl border-[1.5px] text-left transition-all select-none",
                inst === i.v
                  ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                  : "border-gray-200 bg-white hover:border-blue-300"
              )}>
              <div className={cn("text-[13px] font-semibold", inst === i.v ? "text-white" : "text-gray-900")}>{i.name}</div>
              <div className={cn("text-[11px] mt-0.5", inst === i.v ? "text-blue-100" : "text-gray-400")}>{i.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderS2 = () => (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 2 von {TOTAL_STEPS} · Abholung</p>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Abholadresse</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">Wo befindet sich das Instrument momentan?</p>
      </div>

      <AddrCard
        label="Aktueller Standort" icon=""
        strVal={vonStr} nrVal={vonNr} plzVal={vonPlz} ortVal={vonOrt}
        onStr={setVonStr} onNr={setVonNr}
        onPlzChange={v => handlePlzInput(v, "von")}
        acOpenVal={vonAcOpen} acListVal={vonAcList}
        onPickPlz={e => pickPlz(e, "von")}
        filled={!!(vonStr && vonPlz)}
      />

      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Stockwerk & Zugang</p>
        <StockGrid value={vonStock} onChange={setVonStock} />
        <LiftToggle on={vonLift} onToggle={() => setVonLift(v => !v)} />
      </div>
    </div>
  );

  const renderS2b = () => {
    const distLabel = vonOrt && nachOrt
      ? `${vonOrt} → ${nachOrt}`
      : null;

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 3 von {TOTAL_STEPS} · Lieferung</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Lieferadresse</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">Wohin soll das Instrument geliefert werden?</p>
        </div>

        {distLabel && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-[13px] text-green-800 font-medium">
            <span>{distLabel}</span>
          </div>
        )}

        <AddrCard
          label="Lieferadresse" icon=""
          strVal={nachStr} nrVal={nachNr} plzVal={nachPlz} ortVal={nachOrt}
          onStr={setNachStr} onNr={setNachNr}
          onPlzChange={v => handlePlzInput(v, "nach")}
          acOpenVal={nachAcOpen} acListVal={nachAcList}
          onPickPlz={e => pickPlz(e, "nach")}
          filled={!!(nachStr && nachPlz)}
        />

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Stockwerk & Zugang</p>
          <StockGrid value={nachStock} onChange={setNachStock} />
          <LiftToggle on={nachLift} onToggle={() => setNachLift(v => !v)} />
        </div>
      </div>
    );
  };

  const renderS3 = () => {
    const zusCards = [
      { v: "stimmung",     name: "Stimmung nach Transport",  desc: "Professionelle Stimmung am Zielort"           },
      { v: "lagerung",     name: "Temporäre Lagerung",       desc: "Zwischenlagerung für Wochen oder Monate"      },
      { v: "versicherung", name: "Transportversicherung",    desc: "Vollkaskoversicherung für den Transport"      },
      { v: "montage",      name: "Montage / Demontage",      desc: "Beine, Pedale, Deckel ab- und aufbauen"       },
    ];
    const stepNum = 4;
    const toggleZus = (v: string) => setZus(prev => { const n = new Set(prev); if (n.has(v)) { n.delete(v); } else { n.add(v); } return n; });

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt {stepNum} von {TOTAL_STEPS}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Extras & Hinweise</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">Optionale Zusatzleistungen und besondere Anforderungen.</p>
        </div>

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

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Besondere Hinweise{" "}
            <span className="normal-case font-normal text-gray-300 text-[10px]">(optional)</span>
          </p>
          <textarea value={bemerkungen} onChange={e => setBemerkungen(e.target.value)} rows={4}
            placeholder="z.B. Klavier steht im 2. Stock, kein Lift vorhanden. Treppenhaus ist eng. Schlüssel beim Hauswart abholen…"
            className="w-full p-3 bg-gray-50 border-[1.5px] border-gray-200 rounded-xl text-sm text-gray-900 outline-none resize-none transition-all focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-gray-300 leading-relaxed" />
          <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="5" stroke="#9DA3B0" strokeWidth="1"/><path d="M5.5 5v2.5M5.5 3.8h.01" stroke="#9DA3B0" strokeLinecap="round"/></svg>
            Alles Wichtige hier — Treppenhaus, Zugangscode, Parkmöglichkeiten, Besonderheiten des Instruments
          </p>
        </div>
      </div>
    );
  };

  const renderS4 = () => {
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
    const canSubmit = vorname.trim().length >= 2 && nachname.trim().length >= 2 && emailOk && telOk && (!!date || dateUnk);

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt {TOTAL_STEPS} von {TOTAL_STEPS}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Termin & Kontakt</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">Wann soll transportiert werden und wie erreichen wir Sie?</p>
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
          <div className={cn("bg-white border-[1.5px] border-gray-200 rounded-xl w-full", dateUnk && "opacity-40 pointer-events-none")}>
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
                <select value={zeit} onChange={e => setZeit(e.target.value)}
                  className="w-full h-10 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3 pr-8 text-sm text-gray-900 outline-none appearance-none cursor-pointer transition-all focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%239DA3B0%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_11px_center]">
                  {zeitOpts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
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
          {["Geprüfte Firmen", "Daten geschützt", "Antwort in 24h", "Kostenlos"].map(item => (
            <span key={item} className="text-[11px] text-gray-400">· {item}</span>
          ))}
        </div>
      </div>
    );
  };

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4">
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

      {/* Step content */}
      <div className="pb-24">
        {currentStep === "s1"  && renderS1()}
        {currentStep === "s2"  && renderS2()}
        {currentStep === "s2b" && renderS2b()}
        {currentStep === "s3"  && renderS3()}
        {currentStep === "s4"  && renderS4()}
      </div>

      {/* Footer navigation (last step has inline submit) */}
      {currentStep !== "s4" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 px-5 py-3.5 z-50">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button type="button"
              style={{ visibility: stepIdx > 0 ? "visible" : "hidden" }}
              onClick={handleBack}
              className="flex items-center gap-1.5 px-4 h-10 border-[1.5px] border-gray-200 rounded-xl text-[14px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all">
              ← Zurück
            </button>
            <button type="button"
              disabled={!canProceed()}
              onClick={handleNext}
              className="flex items-center gap-1.5 px-6 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-[14px] font-semibold transition-all hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(37,99,235,0.3)] disabled:transform-none disabled:shadow-none">
              Weiter →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
