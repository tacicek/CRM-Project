// MoebelliftWizard — Redesigned 4-step wizard
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



// Möbellift-specific floors (no UG/HP)
const STOCK_OPTS = ["EG","1. OG","2. OG","3. OG","4. OG","5. OG","6. OG","6.+ OG"];

type ZweckType = "umzug" | "einzelstueck" | "baumaterial" | "handwerker" | "entsorgung" | "sonstiges";
type DlType    = "mit-person" | "mit-trage" | "nur-lift";


// Price estimate logic
const PRICE_BASE: Record<DlType, number> = { "mit-person": 180, "mit-trage": 250, "nur-lift": 120 };
const PRICE_MULT = [1, 1.1, 1.2, 1.35, 1.5, 1.65, 1.8, 2.0];

export interface MoebelliftWizardProps {
  onComplete?: () => void;
  maxCompanies?: number;
  formId?: string;
}

export function MoebelliftWizard({ onComplete, maxCompanies = 3, formId }: MoebelliftWizardProps) {
  const { toast }   = useToast();
  const navigate    = useNavigate();
  const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();

  const [step,         setStep]         = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted,    setSubmitted]    = useState(false);

  // Step 1
  const [zweck,    setZweck]    = useState<ZweckType | null>(null);
  const [dl,       setDl]       = useState<DlType>("mit-person");
  const [richtung, setRichtung] = useState("hoch");

  // Step 2
  const [str,     setStr]     = useState("");
  const [nr,      setNr]      = useState("");
  const [plz,     setPlz]     = useState("");
  const [ort,     setOrt]     = useState("");
  const [stock,   setStock]   = useState<number | null>(null);
  const [zugang,  setZugang]  = useState("strasse");
  const [acOpen,  setAcOpen]  = useState(false);
  const [acList,  setAcList]  = useState<PlzEntry[]>([]);

  // Step 3
  const [date,    setDate]    = useState<Date | undefined>(undefined);
  const [dateUnk, setDateUnk] = useState(false);
  const [flex,    setFlex]    = useState("fix");
  const [dauer,   setDauer]   = useState<string | null>(null);
  const [zus,     setZus]     = useState<Set<string>>(new Set());

  // Step 4
  const [offerten,    setOfferten]    = useState<3 | 4 | 5>(3);
  const [anrede,      setAnrede]      = useState<"Herr" | "Frau" | "Firma">("Herr");
  const [vorname,     setVorname]     = useState("");
  const [nachname,    setNachname]    = useState("");
  const [email,       setEmail]       = useState("");
  const [tel,         setTel]         = useState("");
  const [zeit,        setZeit]        = useState("any");
  const [bemerkungen, setBemerkungen] = useState("");

  const TOTAL_STEPS = 4;

  const emailResult = validateEmail(email);
  const emailOk = isEmailAcceptable(email);
  const telOk   = /^[0-9\s+\-()]{8,16}$/.test(tel.trim());

  // Price estimate
  const priceEst = stock !== null
    ? Math.round(PRICE_BASE[dl] * (PRICE_MULT[stock] ?? 1) / 10) * 10
    : null;

  // ─── Validation ──────────────────────────────────────────────────────────────

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return !!(zweck && dl && richtung);
      case 2: return !!(str.trim() && plz.length >= 4 && stock !== null);
      case 3: return !!((date || dateUnk) && dauer);
      case 4: return !!(vorname.trim().length >= 2 && nachname.trim().length >= 2 && emailOk && telOk);
      default: return false;
    }
  };

  // ─── Navigation ──────────────────────────────────────────────────────────────

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

  // ─── PLZ autocomplete ────────────────────────────────────────────────────────

  const handlePlzInput = async (val: string) => {
    const v = val.replace(/\D/g, "").slice(0, 4);
    setPlz(v);
    if (v.length >= 2) {
      const m = await lookupPlz(v);
      setAcList(m);
      setAcOpen(m.length > 0);
    } else {
      setAcOpen(false);
      setOrt("");
    }
  };

  const pickPlz = (entry: PlzEntry) => {
    setPlz(entry.p);
    setOrt(entry.o);
    setAcOpen(false);
  };

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!canProceed() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (recaptchaEnabled) {
        const token = await executeRecaptcha("moebellift_anfrage");
        if (token) {
          const ok = await verifyRecaptchaToken(token, "moebellift_anfrage");
          if (!ok) throw new Error("reCAPTCHA fehlgeschlagen. Bitte versuchen Sie es erneut.");
        }
      }

      const leadData = {
        service_type:      "moebellift",
        from_plz:          plz,
        from_city:         ort,
        from_street:       str,
        from_house_number: nr,
        from_floor:        stock !== null ? floorLabelToInt(STOCK_OPTS[stock]) : null,
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
          zweck, dl, richtung,
          str, nr, plz, ort,
          stock: stock !== null ? STOCK_OPTS[stock] : null,
          zugang,
          dauer,
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
        serviceType: "moebellift",
        fromCity: ort,
        maxCompanies,
      });

      if (onComplete) {
        setSubmitted(true);
        onComplete();
      } else {
        navigate("/anfrage/erfolg", { state: { anfrage_nummer: newLeadId, service_type: "moebellift" } });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler beim Absenden. Bitte versuchen Sie es erneut.";
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Success ─────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-3 text-gray-900">
          Anfrage gesendet!
        </h2>
        <p className="text-[15px] text-gray-500 max-w-sm leading-relaxed mb-6">
          Ihre Möbellift-Anfrage wurde an geprüfte Firmen weitergeleitet. Sie erhalten Offerten innerhalb von 24 Stunden.
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

  // ─── Step renderers ──────────────────────────────────────────────────────────

  const renderStep1 = () => {
    const zwecke: { v: ZweckType; label: string; desc: string }[] = [
      { v: "umzug",        label: "Umzug",          desc: "Wohnungsumzug"                },
      { v: "einzelstueck", label: "Einzelstück",    desc: "Grosses Möbelstück"           },
      { v: "baumaterial",  label: "Baumaterial",    desc: "Lieferung auf Stockwerk"      },
      { v: "handwerker",   label: "Handwerker",     desc: "Werkzeug, Maschinen"          },
      { v: "entsorgung",   label: "Entsorgung",     desc: "Sperrmüll, Möbel"             },
      { v: "sonstiges",    label: "Sonstiges",      desc: "Anderer Zweck"                },
    ];
    const services: { v: DlType; name: string; desc: string }[] = [
      { v: "mit-person", name: "Mit Bedienungsperson", desc: "Fachkraft bedient den Lift"   },
      { v: "mit-trage",  name: "Mit Trageservice",    desc: "Tragen + Lift inklusive"      },
      { v: "nur-lift",   name: "Nur Lift mieten",     desc: "Selbst bedienen"              },
    ];
    const richtungen = [
      { v: "hoch",   label: "Hochheben" },
      { v: "runter", label: "Absenken"  },
      { v: "beides", label: "Beides"    },
    ];

    const handleZweckChange = (v: ZweckType) => setZweck(v);

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 1 von 4</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Was benötigen Sie?</h2>
          <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Zweck und Serviceart des Möbellifts.</p>
        </div>

        {/* Zweck */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Wofür wird der Möbellift benötigt?</p>
          <div className="flex flex-wrap gap-2">
            {zwecke.map(z => (
              <button key={z.v} type="button" onClick={() => handleZweckChange(z.v)}
                className={cn(
                  "px-4 py-2.5 rounded-xl border-[1.5px] text-left transition-all select-none",
                  zweck === z.v
                    ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                    : "border-gray-200 bg-white hover:border-blue-300"
                )}>
                <div className={cn("text-[13px] font-semibold", zweck === z.v ? "text-white" : "text-gray-900")}>{z.label}</div>
                <div className={cn("text-[11px] mt-0.5", zweck === z.v ? "text-blue-100" : "text-gray-400")}>{z.desc}</div>
              </button>
            ))}
          </div>
        </div>


        {/* Service */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Service</p>
          <div className="flex flex-col sm:flex-row gap-2">
            {services.map(s => (
              <button key={s.v} type="button" onClick={() => setDl(s.v)}
                className={cn(
                  "flex-1 px-4 py-3 rounded-xl border-[1.5px] text-left transition-all",
                  dl === s.v
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-200 text-gray-500 hover:border-blue-300"
                )}>
                <div className={cn("text-[13px] font-semibold", dl === s.v ? "text-white" : "text-gray-900")}>{s.name}</div>
                <div className={cn("text-[11px] mt-0.5 leading-snug", dl === s.v ? "text-blue-100" : "text-gray-400")}>{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Richtung */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Richtung</p>
          <div className="flex gap-2">
            {richtungen.map(r => (
              <button key={r.v} type="button" onClick={() => setRichtung(r.v)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl border-[1.5px] text-[13px] font-medium transition-all",
                  richtung === r.v
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-200 text-gray-500 hover:border-blue-300"
                )}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderStep2 = () => {
    const zugangOpts = [
      { v: "strasse", label: "Strasse direkt" },
      { v: "hof",     label: "Hof / Innenhof" },
      { v: "garage",  label: "Tiefgarage"     },
      { v: "sonst",   label: "Sonstiges"      },
    ];
    const dlLabels: Record<DlType, string> = {
      "mit-person": "Mit Bedienungsperson",
      "mit-trage":  "Mit Trageservice",
      "nur-lift":   "Selbstbedienung",
    };

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 2 von 4</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Einsatzort</h2>
          <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Wo wird der Möbellift benötigt?</p>
        </div>

        {/* Adresse */}
        <AddrCard
          label="Adresse des Einsatzorts"
          icon=""
          strVal={str} nrVal={nr} plzVal={plz} ortVal={ort}
          onStr={setStr} onNr={setNr}
          onPlzChange={handlePlzInput}
          onOrt={setOrt}
          acOpenVal={acOpen} acListVal={acList}
          onPickPlz={pickPlz}
          filled={!!(str && plz)}
        />

        {/* Stockwerk */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Stockwerk</p>
          <div className="grid grid-cols-4 gap-1.5">
            {STOCK_OPTS.map((s, i) => (
              <button key={i} type="button" onClick={() => setStock(i)}
                className={cn(
                  "h-9 rounded-lg text-[11px] font-medium border-[1.5px] transition-all leading-tight px-1",
                  stock === i
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                    : "bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
                )}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Zugang */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Zugang zum Gebäude</p>
          <div className="flex flex-wrap gap-2">
            {zugangOpts.map(z => (
              <button key={z.v} type="button" onClick={() => setZugang(z.v)}
                className={cn(
                  "px-3.5 py-2 rounded-full border-[1.5px] text-[13px] font-medium transition-all",
                  zugang === z.v
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
                )}>
                {z.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price estimate */}
        {priceEst !== null && (
          <div className="p-4 bg-green-50 border-[1.5px] border-green-300 rounded-xl transition-all">
            <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wider mb-0.5">Unverbindliche Schätzung</p>
            <p className="text-[20px] font-semibold text-green-900 font-mono tracking-tight">
              CHF {priceEst}–{priceEst + 80}
            </p>
            <p className="text-[11px] text-green-700 mt-0.5">
              {STOCK_OPTS[stock ?? 0]} · {dlLabels[dl]}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderStep3 = () => {
    const dauerCards = [
      { v: "2h",    label: "Bis 2h",      desc: "Einzelstück"   },
      { v: "4h",    label: "2–4h",        desc: "Halber Tag"    },
      { v: "8h",    label: "4–8h",        desc: "Ganzer Tag"    },
      { v: "multi", label: "Mehrere Tage", desc: "Grosse Projekte"},
    ];
    const flexOpts = [
      { v: "fix", label: "Festes Datum" },
      { v: "3",   label: "± 3 Tage"     },
      { v: "7",   label: "± 1 Woche"    },
      { v: "14",  label: "± 2 Wochen"   },
    ];
    const zusCards = [
      { v: "halteverbot",   name: "Halteverbotsschild beantragen", desc: "Offizielles Halteverbot für den Einsatztag" },
      { v: "treppenschutz", name: "Treppenschutz / Bodenbelag",    desc: "Schutz für Treppenhaus und Böden" },
    ];
    const monthsShort = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
    const toggleZus = (v: string) => setZus(prev => { const n = new Set(prev); if (n.has(v)) { n.delete(v); } else { n.add(v); } return n; });

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 3 von 4</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Termin & Extras</h2>
          <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Wann und wie lange wird der Möbellift benötigt?</p>
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
              <div className="text-[11px] text-gray-400 mt-0.5">Firma bespricht Termin direkt</div>
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

        {/* Dauer */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Geschätzte Dauer</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {dauerCards.map(d => (
              <button key={d.v} type="button" onClick={() => setDauer(d.v)}
                className={cn(
                  "flex-1 px-3 py-2.5 rounded-xl border-[1.5px] transition-all text-center",
                  dauer === d.v
                    ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                    : "border-gray-200 bg-white hover:border-blue-300"
                )}>
                <div className={cn("text-[13px] font-semibold leading-tight", dauer === d.v ? "text-white" : "text-gray-900")}>{d.label}</div>
                <div className={cn("text-[10px] mt-0.5", dauer === d.v ? "text-blue-100" : "text-gray-400")}>{d.desc}</div>
              </button>
            ))}
          </div>
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
                <div className={cn("w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all", zus.has(card.v) ? "bg-white border-white" : "bg-white border-gray-300")}>
                  {zus.has(card.v) && <ChkSvg />}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderStep4 = () => {
    const zeitOpts = [
      { v: "any",       label: "Jederzeit"                },
      { v: "morning",   label: "Vormittags (08–12 Uhr)"  },
      { v: "afternoon", label: "Nachmittags (12–17 Uhr)" },
      { v: "evening",   label: "Abends (17–20 Uhr)"      },
    ];
    const canSubmit = vorname.trim().length >= 2 && nachname.trim().length >= 2 && emailOk && telOk;

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 4 von 4</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Fast geschafft!</h2>
          <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Ihre Kontaktdaten — damit die Firmen Ihnen eine Offerte senden können.</p>
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
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Kontaktdaten</p>
          <div className="bg-white border-[1.5px] border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">Anrede</label>
                <div className="flex gap-2">
                  {(["Herr","Frau","Firma"] as const).map(a => (
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
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                  Bemerkungen{" "}
                  <span className="normal-case font-normal text-gray-300 text-[10px]">(optional)</span>
                </label>
                <textarea value={bemerkungen} onChange={e => setBemerkungen(e.target.value)} rows={3}
                  placeholder="z.B. Einfahrt durch Hinterhof, Schlüssel beim Hauswart, sehr enge Kurve…"
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
        {step === 4 && renderStep4()}
      </div>

      {/* Footer navigation (step 4 has inline submit) */}
      {step < 4 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 px-5 py-3.5 z-50">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button type="button"
              style={{ visibility: step > 1 ? "visible" : "hidden" }}
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
