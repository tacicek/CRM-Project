// LagerungWizard — Redesigned 3-step wizard
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendCustomerConfirmation } from "@/lib/sendCustomerConfirmation";
import { triggerLeadQualityValidation } from "@/lib/triggerLeadQualityValidation";
import { validateEmail, isEmailAcceptable } from "@/lib/emailValidation";
import { EmailHint } from "@/components/ui/email-hint";
import { AddrCard } from "@/components/shared/AddrCard";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { verifyRecaptchaToken } from "@/lib/recaptchaVerify";
import { format, addDays } from "date-fns";
import { type PlzEntry } from "@/data/swissPlz";
import { lookupPlz } from "@/lib/plzLookup";



type LartType = "moebel" | "umzug" | "business" | "archiv" | "self" | "sonstiges";

interface GrosseItem { v: string; ico: string; name: string; m3: string; desc: string; }

const GROSSE_OPTIONS: Record<LartType, GrosseItem[]> = {
  moebel: [
    {v:"wenig",  ico:"📦", name:"Wenig",        m3:"ca. 2–5 m³",   desc:"Kartons, kleine Möbel"},
    {v:"1zi",    ico:"🛏️", name:"1 Zimmer",     m3:"ca. 5–10 m³",  desc:"Inhalt eines Zimmers"},
    {v:"2-3zi",  ico:"🏠", name:"2–3 Zimmer",   m3:"ca. 15–25 m³", desc:"Komplette Wohnung"},
    {v:"4zi",    ico:"🏡", name:"4+ Zimmer",    m3:"ca. 30–50 m³", desc:"Grosses Haus"},
    {v:"weiss",  ico:"🤷", name:"Weiss nicht",  m3:"Firma berät",  desc:"Vor Ort einschätzen"},
  ],
  umzug: [
    {v:"wenig",  ico:"📦", name:"Wenig",        m3:"ca. 2–5 m³",   desc:"Kartons, kleine Möbel"},
    {v:"1zi",    ico:"🛏️", name:"1 Zimmer",     m3:"ca. 5–10 m³",  desc:"Inhalt eines Zimmers"},
    {v:"2-3zi",  ico:"🏠", name:"2–3 Zimmer",   m3:"ca. 15–25 m³", desc:"Komplette Wohnung"},
    {v:"4zi",    ico:"🏡", name:"4+ Zimmer",    m3:"ca. 30–50 m³", desc:"Grosses Haus"},
    {v:"weiss",  ico:"🤷", name:"Weiss nicht",  m3:"Firma berät",  desc:"Vor Ort einschätzen"},
  ],
  business: [
    {v:"klein",  ico:"🗄️", name:"Klein",        m3:"bis 20 m³",    desc:"Kleines Büro"},
    {v:"mittel", ico:"💼", name:"Mittel",        m3:"20–50 m³",     desc:"Mittleres Büro"},
    {v:"gross",  ico:"🏢", name:"Gross",         m3:"50–100 m³",    desc:"Grosses Büro / Waren"},
    {v:"sehr",   ico:"🏭", name:"Sehr gross",    m3:"100+ m³",      desc:"Lager, Gewerbe"},
    {v:"weiss",  ico:"🤷", name:"Weiss nicht",   m3:"Firma berät",  desc:"Vor Ort einschätzen"},
  ],
  archiv: [
    {v:"wenig",  ico:"📁", name:"Wenige Kartons",  m3:"bis 5 Kartons",  desc:"Kleine Ablage"},
    {v:"mittel", ico:"🗂️", name:"Mehrere Kartons", m3:"5–20 Kartons",   desc:"Mittleres Archiv"},
    {v:"viele",  ico:"🗃️", name:"Viele Kartons",   m3:"20–50 Kartons",  desc:"Grosses Archiv"},
    {v:"sehr",   ico:"📦", name:"Sehr viele",       m3:"50+ Kartons",    desc:"Firmenarchiv"},
    {v:"weiss",  ico:"🤷", name:"Weiss nicht",      m3:"Firma berät",    desc:"Vor Ort einschätzen"},
  ],
  self: [
    {v:"xs",     ico:"🔑", name:"Klein",         m3:"1–5 m²",         desc:"Box, kleine Einheit"},
    {v:"s",      ico:"🏠", name:"Mittel",         m3:"5–10 m²",        desc:"Zimmergrosse Einheit"},
    {v:"m",      ico:"🏢", name:"Gross",          m3:"10–20 m²",       desc:"Garagen-Grösse"},
    {v:"l",      ico:"🏭", name:"Sehr gross",     m3:"20+ m²",         desc:"Lager-Einheit"},
    {v:"weiss",  ico:"🤷", name:"Weiss nicht",    m3:"Beraten lassen", desc:""},
  ],
  sonstiges: [
    {v:"wenig",  ico:"📦", name:"Wenig",          m3:"klein",          desc:""},
    {v:"mittel", ico:"🏠", name:"Mittel",          m3:"mittelgross",    desc:""},
    {v:"viel",   ico:"🏡", name:"Viel",            m3:"gross",          desc:""},
    {v:"weiss",  ico:"🤷", name:"Weiss nicht",     m3:"Firma berät",    desc:""},
  ],
};

const LART_LABELS: Record<LartType, string> = {
  moebel:   "Möbeleinlagerung",
  umzug:    "Umzugslager",
  business: "Geschäftslager",
  archiv:   "Archivlager",
  self:     "Self-Storage",
  sonstiges:"Sonstiges",
};

const GROSSE_LABEL_OVERRIDE: Partial<Record<LartType, string>> = {
  self:     "Gewünschte Einheitsgrösse",
  archiv:   "Ungefähres Volumen",
  business: "Ungefähres Volumen",
};

const DAUER_OPTS = [
  { v: "1m",  label: "Bis 1 Monat"         },
  { v: "3m",  label: "1–3 Monate"          },
  { v: "6m",  label: "3–6 Monate"          },
  { v: "12m", label: "6–12 Monate"         },
  { v: "1y",  label: "Langfristig (1+ Jahr)"},
];

const DAUER_LABELS: Record<string, string> = Object.fromEntries(DAUER_OPTS.map(d => [d.v, d.label]));

export interface LagerungWizardProps {
  onComplete?: () => void;
  maxCompanies?: number;
  formId?: string;
}

export function LagerungWizard({ onComplete, maxCompanies = 3, formId }: LagerungWizardProps) {
  const { toast }  = useToast();
  const navigate   = useNavigate();
  const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();

  const [step,         setStep]         = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted,    setSubmitted]    = useState(false);

  // Step 1
  const [lart,       setLart]       = useState<LartType | null>(null);
  const [grosse,     setGrosse]     = useState<string | null>(null);
  const [dauer,      setDauer]      = useState<string | null>(null);
  const [startMode,  setStartMode]  = useState<"sofort" | "datum">("sofort");
  const [startDate,  setStartDate]  = useState<string>("");

  // Step 2
  const [abholung,    setAbholung]    = useState(false);
  const [pStr,        setPStr]        = useState("");
  const [pNr,         setPNr]         = useState("");
  const [pPlz,        setPPlz]        = useState("");
  const [pOrt,        setPOrt]        = useState("");
  const [pAcOpen,     setPAcOpen]     = useState(false);
  const [pAcList,     setPAcList]     = useState<PlzEntry[]>([]);
  const [wasText,     setWasText]     = useState("");
  const [versicherung, setVersicherung] = useState(false);
  const [ruecklieferung, setRuecklieferung] = useState(false);

  // Step 3
  const [offerten,    setOfferten]    = useState<3 | 4 | 5>(3);
  const [anrede,      setAnrede]      = useState<"Herr" | "Frau" | "Firma">("Herr");
  const [vorname,     setVorname]     = useState("");
  const [nachname,    setNachname]    = useState("");
  const [email,       setEmail]       = useState("");
  const [tel,         setTel]         = useState("");
  const [zeit,        setZeit]        = useState("any");
  const [bemerkungen, setBemerkungen] = useState("");

  const TOTAL_STEPS = 3;

  const emailResult = validateEmail(email);
  const emailOk = isEmailAcceptable(email);
  const telOk   = /^[0-9\s+\-()]{8,16}$/.test(tel.trim());

  // Current Grösse items
  const grosseItems = lart ? GROSSE_OPTIONS[lart] : [];

  // Formatted start date label
  const startLabel = (() => {
    if (startMode === "sofort") return "So bald wie möglich";
    if (!startDate) return "—";
    try {
      const d = new Date(startDate);
      const months = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
      return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return startDate; }
  })();

  // Min date for date input (tomorrow)
  const minDateStr = format(addDays(new Date(), 1), "yyyy-MM-dd");

  // ─── Validation ──────────────────────────────────────────────────────────────

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return !!(lart && grosse && dauer && (startMode === "sofort" || startDate));
      case 2: return true; // all optional
      case 3: return !!(vorname.trim().length >= 2 && nachname.trim().length >= 2 && emailOk && telOk);
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
    setPPlz(v);
    if (v.length >= 2) {
      const m = await lookupPlz(v);
      setPAcList(m);
      setPAcOpen(m.length > 0);
    } else {
      setPAcOpen(false);
      setPOrt("");
    }
  };

  const pickPlz = (entry: PlzEntry) => {
    setPPlz(entry.p);
    setPOrt(entry.o);
    setPAcOpen(false);
  };

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!canProceed() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (recaptchaEnabled) {
        const token = await executeRecaptcha("lagerung_anfrage");
        if (token) {
          const ok = await verifyRecaptchaToken(token, "lagerung_anfrage");
          if (!ok) throw new Error("reCAPTCHA fehlgeschlagen. Bitte versuchen Sie es erneut.");
        }
      }

      const leadData = {
        service_type:      "lagerung",
        from_plz:          abholung ? pPlz : null,
        from_city:         abholung ? pOrt : null,
        from_street:       abholung ? pStr : null,
        from_house_number: abholung ? pNr  : null,
        preferred_date:    startMode === "datum" && startDate ? startDate : null,
        is_flexible_date:  startMode === "sofort",
        description:       [wasText, bemerkungen].filter(Boolean).join(" | ") || null,
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
          lart, grosse, dauer,
          startMode, startDate,
          abholung,
          pStr, pNr, pPlz, pOrt,
          wasText,
          versicherung,
          ruecklieferung,
          offerten,
        },
      };

      const { data: newLeadId, error } = await supabase.rpc("submit_lead_json", { lead_data: leadData });
      if (error) throw error;

      triggerLeadQualityValidation(newLeadId as string | null);

      sendCustomerConfirmation({
        firstName: vorname,
        lastName: nachname,
        email,
        serviceType: "lagerung",
        fromCity: pOrt || "",
        maxCompanies: offerten,
      });

      if (onComplete) {
        setSubmitted(true);
        onComplete();
      } else {
        navigate("/anfrage/erfolg", { state: { anfrage_nummer: newLeadId, service_type: "lagerung" } });
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
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-3 text-gray-900">
          Anfrage gesendet!
        </h2>
        <p className="text-[15px] text-gray-500 max-w-sm leading-relaxed mb-6">
          Ihre Lagerungsanfrage wurde an geprüfte Firmen weitergeleitet. Sie erhalten Offerten innerhalb von 24 Stunden.
        </p>
        <a href="https://offerio.ch" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          Zur Startseite
        </a>
      </div>
    );
  }

  // ─── Shared UI helpers ───────────────────────────────────────────────────────

  const _ChkSvg = () => (
    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
      <path d="M1 3L3 5L7 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const YNToggle = ({ on }: { on: boolean }) => (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-full p-0.5 flex-shrink-0">
      <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all", !on ? "bg-white text-gray-700 shadow-sm" : "text-gray-400")}>Nein</span>
      <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all",  on ? "bg-blue-600 text-white" : "text-gray-400")}>Ja</span>
    </div>
  );

  const inputCls = "w-full h-10 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3 text-sm text-gray-900 outline-none transition-all hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-gray-300";

  // ─── Step renderers ──────────────────────────────────────────────────────────

  const renderStep1 = () => {
    const lartCards: { v: LartType; label: string; desc: string }[] = [
      { v: "moebel",    label: "Möbeleinlagerung",  desc: "Möbel, Hausrat"               },
      { v: "umzug",     label: "Umzugslager",       desc: "Zwischenlagerung beim Umzug"  },
      { v: "business",  label: "Geschäftslager",    desc: "Büromöbel, Waren"             },
      { v: "archiv",    label: "Archivlager",       desc: "Dokumente, Akten"             },
      { v: "self",      label: "Self-Storage",      desc: "Eigener Zugang jederzeit"     },
      { v: "sonstiges", label: "Sonstiges",         desc: "Anderes Lagergut"             },
    ];

    const handleLartChange = (v: LartType) => {
      setLart(v);
      setGrosse(null);
    };

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 1 von 3</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Was soll gelagert werden?</h2>
          <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Art, Grösse und wie lange — alles in einem Schritt.</p>
        </div>

        {/* Art der Lagerung */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Art der Lagerung</p>
          <div className="flex flex-wrap gap-2">
            {lartCards.map(c => (
              <button key={c.v} type="button" onClick={() => handleLartChange(c.v)}
                className={cn(
                  "px-4 py-2 rounded-lg border-[1.5px] text-[13px] font-medium transition-all select-none",
                  lart === c.v
                    ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600"
                )}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grösse — dynamic section */}
        {lart && grosseItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              {(lart && GROSSE_LABEL_OVERRIDE[lart]) ?? "Ungefähre Grösse"}
            </p>
            <div className="flex flex-wrap gap-2">
              {grosseItems.map(item => (
                <button key={item.v} type="button" onClick={() => setGrosse(item.v)}
                  className={cn(
                    "px-4 py-2.5 rounded-xl border-[1.5px] text-left transition-all select-none",
                    grosse === item.v
                      ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                      : "border-gray-200 bg-white hover:border-blue-300"
                  )}>
                  <div className={cn("text-[13px] font-semibold", grosse === item.v ? "text-white" : "text-gray-900")}>{item.name}</div>
                  {item.m3 && <div className={cn("text-[11px] font-mono mt-0.5", grosse === item.v ? "text-blue-100" : "text-gray-400")}>{item.m3}</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lagerdauer */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Lagerdauer</p>
          <div className="flex flex-wrap gap-2">
            {DAUER_OPTS.map(d => (
              <button key={d.v} type="button" onClick={() => setDauer(d.v)}
                className={cn(
                  "px-4 py-2 rounded-lg border-[1.5px] text-[13px] font-medium transition-all select-none",
                  dauer === d.v
                    ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600"
                )}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Startdatum */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Startdatum
            {(startMode === "sofort" || startDate) && (
              <span className="ml-2 text-blue-600 font-mono normal-case tracking-normal font-medium">
                · {startLabel}
              </span>
            )}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button"
              onClick={() => { setStartMode("sofort"); setStartDate(""); }}
              className={cn(
                "px-4 py-2 rounded-lg border-[1.5px] text-[13px] font-medium transition-all whitespace-nowrap select-none",
                startMode === "sofort"
                  ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600"
              )}>
              So bald wie möglich
            </button>
            <span className="text-[12px] text-gray-300 flex-shrink-0">oder</span>
            <input
              type="date" value={startDate} min={minDateStr}
              onChange={e => {
                setStartDate(e.target.value);
                if (e.target.value) setStartMode("datum");
              }}
              className={cn(
                "h-10 flex-1 min-w-[140px] bg-gray-50 border-[1.5px] rounded-lg px-3 text-sm text-gray-900 outline-none transition-all cursor-pointer",
                startMode === "datum" && startDate ? "border-green-400" : "border-gray-200 hover:border-gray-300",
                "focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
              )}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderStep2 = () => {
    const optionCards = [
      { key: "versicherung",   name: "Versicherung gewünscht",  desc: "Einlagerungsgut vollkaskoversichert",              val: versicherung,   set: setVersicherung   },
      { key: "ruecklieferung", name: "Rücklieferung gewünscht", desc: "Gegenstände werden zurückgeliefert wenn benötigt", val: ruecklieferung, set: setRuecklieferung },
    ];

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 2 von 3</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Abholung & Details</h2>
          <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Sollen die Gegenstände abgeholt werden — und gibt es besondere Wünsche?</p>
        </div>

        {/* Abholung toggle */}
        <div className="space-y-2">
          <button type="button" onClick={() => setAbholung(v => !v)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-xl border-[1.5px] transition-all",
              abholung ? "border-blue-500 bg-blue-50/60" : "border-gray-200 bg-white hover:border-gray-300"
            )}>
            <div className="text-left">
              <div className="text-[13px] font-medium text-gray-900">Abholung gewünscht</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Firma holt die Gegenstände bei Ihnen ab</div>
            </div>
            <YNToggle on={abholung} />
          </button>

          {/* Adresse expandable */}
          {abholung && (
            <AddrCard
              label="Abholadresse"
              icon=""
              strVal={pStr} nrVal={pNr} plzVal={pPlz} ortVal={pOrt}
              onStr={setPStr} onNr={setPNr}
              onPlzChange={handlePlzInput}
              acOpenVal={pAcOpen} acListVal={pAcList}
              onPickPlz={pickPlz}
              filled={!!(pStr && pPlz)}
              className="mt-2"
            />
          )}
        </div>

        {/* Was einlagern */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Was soll eingelagert werden?{" "}
            <span className="normal-case font-normal text-gray-300 text-[10px]">(optional)</span>
          </p>
          <textarea value={wasText} onChange={e => setWasText(e.target.value)} rows={3}
            placeholder="z.B. Wohnzimmermöbel, Sofa, Kartons mit Büchern, Kühlschrank…"
            className="w-full p-3 bg-gray-50 border-[1.5px] border-gray-200 rounded-xl text-sm text-gray-900 outline-none resize-none transition-all focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-gray-300 leading-relaxed" />
        </div>

        {/* Optionen */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Optionen{" "}
            <span className="normal-case font-normal text-gray-300 text-[10px]">(optional)</span>
          </p>
          <div className="space-y-2">
            {optionCards.map(card => (
              <button key={card.key} type="button" onClick={() => card.set(v => !v)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl border-[1.5px] transition-all text-left",
                  card.val ? "border-blue-500 bg-blue-600" : "border-gray-200 bg-white hover:border-gray-300"
                )}>
                <div>
                  <div className={cn("text-[13px] font-medium", card.val ? "text-white" : "text-gray-900")}>{card.name}</div>
                  <div className={cn("text-[11px] mt-0.5", card.val ? "text-blue-100" : "text-gray-400")}>{card.desc}</div>
                </div>
                <div className={cn("w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0", card.val ? "bg-white border-white" : "bg-white border-gray-300")}>
                  {card.val && <Check className="w-2.5 h-2.5 text-blue-600" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    // Summary rows
    const grosseItem = lart ? GROSSE_OPTIONS[lart]?.find(g => g.v === grosse) : undefined;
    const grosseLabel = grosseItem ? `${grosseItem.name}${grosseItem.m3 ? ` (${grosseItem.m3})` : ""}` : "—";

    const summaryRows = [
      { label: "Lagerungsart", val: lart ? LART_LABELS[lart] : "—", toStep: 1 },
      { label: "Grösse",       val: grosseLabel,                     toStep: 1 },
      { label: "Dauer",        val: dauer ? DAUER_LABELS[dauer] : "—", toStep: 1 },
      { label: "Start",        val: startLabel,                      toStep: 1 },
      { label: "Abholung",     val: abholung ? (pOrt ? `Ja · ${pOrt}` : "Ja") : "Nein (selbst bringen)", toStep: 2 },
    ];

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
          <p className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 3 von 3</p>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Fast geschafft!</h2>
          <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Kurze Übersicht und Ihre Kontaktdaten.</p>
        </div>

        {/* Summary card */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ihre Angaben</p>
          <div className="bg-white border-[1.5px] border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100">
              <span className="text-[13px] font-semibold text-gray-700">Übersicht</span>
            </div>
            {summaryRows.map((row, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 gap-3">
                <span className="text-[12px] text-gray-400 font-medium flex-shrink-0">{row.label}</span>
                <span className="text-[12px] font-medium text-gray-700 text-right flex-1 min-w-0 truncate">{row.val}</span>
                <button type="button" onClick={() => { setStep(row.toStep); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="text-[11px] text-blue-400 hover:text-blue-600 font-medium px-2 py-0.5 rounded hover:bg-blue-50 transition-all flex-shrink-0">
                  Ändern
                </button>
              </div>
            ))}
          </div>
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
        <div className="space-y-2">
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
                  placeholder="Besondere Hinweise zur Einlagerung…"
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
      </div>

      {/* Footer navigation (step 3 has inline submit) */}
      {step < 3 && (
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
