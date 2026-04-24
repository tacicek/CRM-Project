// ReinigungWizard — Redesigned: 8 Schritte → 4 Schritte
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { Loader2, Check } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { verifyRecaptchaToken } from "@/lib/recaptchaVerify";
import { supabase } from "@/integrations/supabase/client";
import type { ReinigungServiceType } from "@/types/reinigung";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { sendCustomerConfirmation } from "@/lib/sendCustomerConfirmation";
import { triggerLeadQualityValidation } from "@/lib/triggerLeadQualityValidation";
import { validateEmail, isEmailAcceptable } from "@/lib/emailValidation";
import { EmailHint } from "@/components/ui/email-hint";

const ZIMMER_OPTS = ["1","1.5","2","2.5","3","3.5","4","4.5","5","5.5","6+"];
const TOTAL_STEPS = 4;

// ─── Types ────────────────────────────────────────────────────
interface ReinigungWizardProps {
  initialServiceType?: ReinigungServiceType;
  onComplete?: () => void;
  maxCompanies?: 3 | 5;
  formId?: string;
}

type PlzEntry = {p:string; o:string; k:string};

// ─── Component ───────────────────────────────────────────────
export function ReinigungWizard({
  initialServiceType = "uebergabereinigung",
  onComplete,
  maxCompanies: _maxCompanies = 3,
  formId,
}: ReinigungWizardProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();

  const [step, setStep]               = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1
  const [unterkunft, setUnterkunft]   = useState<string|null>(null);
  const [m2, setM2]                   = useState(0);
  const [zimmer, setZimmer]           = useState<string|null>(null);

  // Step 2
  const [bad, setBad]                 = useState(1);
  const [wc, setWc]                   = useState(0);
  const [rooms, setRooms]             = useState<Set<string>>(new Set());
  const [balkon, setBalkon]           = useState(false);
  const [balkonM2, setBalkonM2]       = useState(0);
  const [bes, setBes]                 = useState<Set<string>>(new Set());

  // Step 3
  const [fenNormal, setFenNormal]     = useState(4);
  const [fenGross, setFenGross]       = useState(0);
  const [fenTuer, setFenTuer]         = useState(0);
  const [storen, setStoren]           = useState(false);
  const [storenCount, setStorenCount] = useState(4);
  const [zus, setZus]                 = useState<Set<string>>(new Set());

  // Step 4 — date
  const [date, setDate]               = useState<Date|undefined>(undefined);
  const [flex, setFlex]               = useState("fix");

  // Step 4 — address
  const [str, setStr]                 = useState("");
  const [nr, setNr]                   = useState("");
  const [plz, setPlz]                 = useState("");
  const [ort, setOrt]                 = useState("");
  const [acOpen, setAcOpen]           = useState(false);
  const [acList, setAcList]           = useState<PlzEntry[]>([]);

  // Step 4 — contact
  const [offerten, setOfferten]       = useState<3|4|5>(_maxCompanies === 5 ? 5 : 3);
  const [anrede, setAnrede]           = useState<"Herr"|"Frau"|"Divers">("Herr");
  const [vorname, setVorname]         = useState("");
  const [nachname, setNachname]       = useState("");
  const [email, setEmail]             = useState("");
  const [tel, setTel]                 = useState("");
  const [zeit, setZeit]               = useState("any");
  const [bemerkungen, setBemerkungen] = useState("");

  // ─── Helpers ─────────────────────────────────────────────
  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, v: string) => {
    setter(prev => { const n = new Set(prev); if (n.has(v)) { n.delete(v); } else { n.add(v); } return n; });
  };

  const handlePlz = async (val: string) => {
    const v = val.replace(/\D/g,"").slice(0,4);
    setPlz(v);
    if (v.length >= 2) {
      const m = await lookupPlz(v);
      setAcList(m);
      setAcOpen(m.length > 0);
    } else {
      setAcOpen(false);
      if (v.length === 0) setOrt("");
    }
  };

  const pickPlz = (item: PlzEntry) => {
    setPlz(item.p);
    setOrt(item.o);
    setAcOpen(false);
  };

  const emailResult = validateEmail(email);
  const emailOk  = isEmailAcceptable(email);
  const telOk    = /^\+?[\d\s\-()]{7,20}$/.test(tel.trim());

  const showRoomCount = ["wohnung","haus","wg"].includes(unterkunft ?? "");

  const canProceed = () => {
    if (step === 1) return !!unterkunft && (!showRoomCount || !!zimmer);
    if (step === 2 || step === 3) return true;
    if (step === 4) return !!(vorname.trim().length >= 2 && nachname.trim().length >= 2 && emailOk && telOk && str.trim() && plz.length === 4);
    return false;
  };

  // ─── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canProceed() || isSubmitting) return;
    setIsSubmitting(true);
    try {
    if (recaptchaEnabled) {
      const token = await executeRecaptcha("submit_reinigung_form");
        const r     = await verifyRecaptchaToken(token, "submit_reinigung_form");
        if (!r.success) {
          toast({ title: "Sicherheitsüberprüfung fehlgeschlagen", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
    }

      const svcType  =
        initialServiceType === "grundreinigung"    ? "reinigung_grund"    :
        initialServiceType === "unterhaltsreinigung" ? "reinigung_unterhalts" :
        "reinigung_end";
      const dateStr  = date ? format(date, "yyyy-MM-dd") : null;
      const roomsArr = Array.from(rooms);
      const besArr   = Array.from(bes);
      const zusArr   = Array.from(zus);

      const detailedData = {
        service_type: initialServiceType, unterkunft, m2, zimmer,
        bad, wc, rooms: roomsArr, balkon, balkon_m2: balkonM2,
        besonderheiten: besArr,
        fen_normal: fenNormal, fen_gross: fenGross, fen_tuer: fenTuer,
        storen, storen_count: storenCount,
        zusatzleistungen: zusArr,
        date: dateStr, flex, str, nr, plz, ort, offerten,
        anrede, vorname, nachname, email, tel, zeit, bemerkungen,
      };

      const descParts = [
        `${unterkunft}, ${m2}m²`,
        zimmer ? `${zimmer} Zi` : null,
        `${bad} Bad, ${wc} WC`,
        fenNormal + fenGross + fenTuer > 0 ? `${fenNormal+fenGross+fenTuer} Fenster` : null,
        zusArr.length > 0 ? `Extras: ${zusArr.join(", ")}` : null,
        bemerkungen || null,
      ].filter(Boolean).join(" | ");

      const leadData = {
        service_type:         svcType,
        from_plz:             plz,
        from_city:            ort,
        from_street:          str,
        from_house_number:    nr || null,
        from_rooms:           zimmer ? parseFloat(zimmer.replace("+","")) : null,
        from_living_space_m2: m2 || null,
        property_type:        unterkunft,
        bathroom_count:       bad + wc,
        has_balcony:          balkon,
        has_garage:           roomsArr.includes("garage"),
        has_basement:         roomsArr.includes("keller"),
        has_attic:            roomsArr.includes("dachboden"),
        cleaning_windows:     fenNormal > 0 || fenGross > 0 || fenTuer > 0,
        customer_first_name:  vorname,
        customer_last_name:   nachname,
        customer_email:       email,
        customer_phone:       tel.startsWith("+") ? tel : `+41${tel.replace(/\s/g,"")}`,
        customer_salutation:  anrede,
        customer_contact_time: zeit,
        preferred_date:       dateStr,
        description:          descParts,
        max_companies:        offerten,
        detailed_form_data:   detailedData,
        form_version:         2,
        status:               "pending_verification",
        source_form_id:       formId || null,
      };

      const { data: newLeadId, error } = await supabase.rpc("submit_lead_json", { lead_data: leadData });
      if (error) throw error;

      triggerLeadQualityValidation(newLeadId as string | null);

      sendCustomerConfirmation({
        firstName: vorname,
        lastName: nachname,
        email,
        serviceType: svcType,
        fromCity: ort,
        maxCompanies: offerten,
      });

      onComplete?.();
      navigate("/anfrage/erfolg", { state: { anfrage_nummer: newLeadId, service_type: svcType } });
    } catch(error) {
      console.error(error);
      toast({ title: "Fehler beim Senden", description: "Bitte versuchen Sie es erneut.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Service type config ──────────────────────────────────
  const svcConfig: Record<ReinigungServiceType, {emoji:string; label:string; color:string}> = {
    uebergabereinigung:  { emoji:"🧹", label:"Übergabereinigung",  color:"bg-blue-50 text-blue-800 border-blue-200" },
    grundreinigung:      { emoji:"🏠", label:"Grundreinigung",      color:"bg-green-50 text-green-800 border-green-200" },
    unterhaltsreinigung: { emoji:"🔄", label:"Unterhaltsreinigung", color:"bg-amber-50 text-amber-800 border-amber-200" },
  };
  const svc = svcConfig[initialServiceType];

  // ─── Reusable sub-components ─────────────────────────────
  const inputCls = "w-full h-10 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3 text-[14px] text-gray-900 outline-none transition-all hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.10)]";

  const CounterRow = ({ label, value, min=0, max=20, onChange }: {
    icon?:string; label:string; value:number; min?:number; max?:number; onChange:(n:number)=>void;
  }) => (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-[1.5px] border-gray-200 rounded-xl">
      <span className="text-[13px] text-gray-700 font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(Math.max(min, value-1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg border-[1.5px] border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50 text-lg font-light transition-colors">−</button>
        <span className="min-w-[2.5rem] text-center font-mono text-[15px] font-semibold text-gray-900">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value+1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg border-[1.5px] border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50 text-lg font-light transition-colors">+</button>
      </div>
    </div>
  );

  const ToggleCard = ({ label, selected, onClick, className }: {
    icon?:string; label:string; selected:boolean; onClick:()=>void; className?:string;
  }) => (
    <button type="button" onClick={onClick} className={cn(
      "w-full flex items-center justify-between px-4 py-3 border-[1.5px] rounded-xl cursor-pointer select-none transition-all text-left",
      selected ? "border-blue-500 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-blue-300",
      className
    )}>
      <span className="text-[13px] font-medium">{label}</span>
      <div className={cn(
        "w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all",
        selected ? "bg-white border-white" : "bg-white border-gray-300"
      )}>
        {selected && <Check className="w-2.5 h-2.5 text-blue-600" />}
      </div>
    </button>
  );

  // ─── Step 1: Unterkunft + m² + Zimmer ────────────────────
  const renderStep1 = () => (
    <div>
      <div className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 1 von 4</div>
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Was soll gereinigt werden?</h2>
      <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Art und Grösse der Unterkunft helfen den Firmen bei der Kalkulation.</p>

      {/* Unterkunftsart */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Art der Unterkunft</div>
        <div className="flex flex-wrap gap-2">
          {[
            {v:"wohnung", label:"Wohnung"},
            {v:"haus",    label:"Haus"},
            {v:"wg",      label:"WG-Zimmer"},
            {v:"buro",    label:"Büro"},
            {v:"gewerbe", label:"Gewerbe"},
          ].map(o => (
            <button key={o.v} type="button" onClick={() => setUnterkunft(o.v)} className={cn(
              "px-4 py-2 rounded-lg border-[1.5px] text-[13px] font-medium transition-all select-none",
              unterkunft === o.v
                ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600"
            )}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zimmer + m² — side-by-side dropdowns */}
      {showRoomCount ? (
        <div className="grid grid-cols-2 gap-3">
          {/* Anzahl Zimmer — required */}
          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Anzahl Zimmer <span className="text-red-400">*</span>
            </div>
            <select
              value={zimmer ?? ""}
              onChange={e => setZimmer(e.target.value || null)}
              className={cn(
                "w-full h-10 bg-gray-50 border-[1.5px] rounded-lg px-3 text-[14px] text-gray-900 outline-none appearance-none cursor-pointer transition-all hover:border-gray-300 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.10)]",
                zimmer ? "border-blue-300" : "border-gray-200"
              )}
            >
              <option value="">Zimmer wählen</option>
              {ZIMMER_OPTS.map(z => (
                <option key={z} value={z}>{z} Zimmer</option>
              ))}
            </select>
          </div>

          {/* Wohnfläche — optional */}
          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Wohnfläche <span className="normal-case font-normal text-[10px]">(optional)</span>
            </div>
            <select
              value={m2 || ""}
              onChange={e => setM2(parseInt(e.target.value) || 0)}
              className={cn(
                "w-full h-10 bg-gray-50 border-[1.5px] rounded-lg px-3 text-[14px] text-gray-900 outline-none appearance-none cursor-pointer transition-all hover:border-gray-300 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.10)]",
                m2 > 0 ? "border-blue-300" : "border-gray-200"
              )}
            >
              <option value="">m² wählen</option>
              {[20,30,40,50,60,70,80,90,100,120,140,160,180,200,250,300].map(s => (
                <option key={s} value={s}>{s} m²</option>
              ))}
              <option value="350">300+ m²</option>
            </select>
          </div>
        </div>
      ) : (
        /* Wohnfläche only (no zimmer for Büro/Gewerbe) */
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Fläche <span className="normal-case font-normal text-[10px]">(optional)</span>
          </div>
          <select
            value={m2 || ""}
            onChange={e => setM2(parseInt(e.target.value) || 0)}
            className={cn(
              "w-full h-10 bg-gray-50 border-[1.5px] rounded-lg px-3 text-[14px] text-gray-900 outline-none appearance-none cursor-pointer transition-all hover:border-gray-300 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.10)]",
              m2 > 0 ? "border-blue-300" : "border-gray-200"
            )}
          >
            <option value="">m² wählen</option>
            {[20,30,40,50,60,70,80,90,100,120,140,160,180,200,250,300].map(s => (
              <option key={s} value={s}>{s} m²</option>
            ))}
            <option value="350">300+ m²</option>
          </select>
        </div>
      )}
    </div>
  );

  // ─── Step 2: Räume & Details ──────────────────────────────
  const renderStep2 = () => (
    <div>
      <div className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 2 von 4</div>
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Räume & Details</h2>
      <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Welche Räume gibt es und besondere Eigenschaften der Unterkunft.</p>

      {/* Badezimmer */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Badezimmer</div>
        <div className="space-y-2">
          <CounterRow label="Badezimmer / Duschen" value={bad} onChange={setBad} min={0} />
          <CounterRow label="Toiletten (separat)" value={wc} onChange={setWc} min={0} />
        </div>
      </div>

      {/* Zusatzräume */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Zusatzräume</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            {v:"keller",       label:"Keller"},
            {v:"dachboden",    label:"Dachboden"},
            {v:"garage",       label:"Garage"},
            {v:"wintergarten", label:"Wintergarten"},
          ].map(r => (
            <ToggleCard key={r.v} label={r.label}
              selected={rooms.has(r.v)} onClick={() => toggleSet(setRooms, r.v)} />
          ))}
        </div>
        {/* Balkon */}
        <div className="mt-2">
          <ToggleCard label="Balkon / Terrasse" selected={balkon} onClick={() => setBalkon(!balkon)} />
          {balkon && (
            <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3 text-[13px] text-gray-700 font-medium animate-in slide-in-from-top-2 duration-200">
              <span>Fläche ca.</span>
              <input type="number" value={balkonM2 || ""} min={1} max={200} placeholder="—"
                onChange={e => setBalkonM2(parseInt(e.target.value)||0)}
                className="w-16 h-8 bg-white border-[1.5px] border-gray-200 rounded-lg text-center font-mono text-sm text-gray-900 outline-none focus:border-blue-500" />
              <span>m²</span>
            </div>
          )}
        </div>
      </div>

      {/* Besonderheiten */}
      <div>
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
          Besonderheiten <span className="normal-case font-normal text-[10px]">(optional)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            {v:"einbauschraenke", label:"Einbauschränke"},
            {v:"kueche_stark",    label:"Stark verschmutzte Küche"},
            {v:"waschturm",       label:"Waschturm"},
            {v:"haustiere",       label:"Haustiere"},
            {v:"moebliert",       label:"Möbliert"},
          ].map(c => (
            <button key={c.v} type="button" onClick={() => toggleSet(setBes, c.v)} className={cn(
              "px-3.5 py-2 rounded-lg border-[1.5px] text-[13px] font-medium cursor-pointer select-none transition-all",
              bes.has(c.v)
                ? "bg-blue-600 border-blue-600 text-white"
                : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
            )}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── Step 3: Fenster & Extras ─────────────────────────────
  const renderStep3 = () => (
    <div>
      <div className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 3 von 4</div>
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Fenster & Extras</h2>
      <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Fensteranzahl und optionale Zusatzleistungen.</p>

      {/* Fenster */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Fenster</div>
        <div className="bg-white border-[1.5px] border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50/70 border-b border-gray-100">
            <span className="text-[13px] font-semibold text-gray-700">Anzahl Fenster & Türen</span>
          </div>
          <div className="p-4 space-y-2">
            <CounterRow label="Normale Fenster"            value={fenNormal} onChange={setFenNormal} />
            <CounterRow label="Glasfronten / Fensterwände" value={fenGross}  onChange={setFenGross} />
            <CounterRow label="Fenstertüren"               value={fenTuer}   onChange={setFenTuer} />
          </div>
        </div>
      </div>

      {/* Storen */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Storen & Rollläden</div>
        <button type="button" onClick={() => setStoren(!storen)} className={cn(
          "w-full flex items-center justify-between px-4 py-3.5 bg-white border-[1.5px] rounded-xl cursor-pointer transition-all text-left",
          storen ? "border-blue-500 bg-blue-600" : "border-gray-200 hover:border-gray-300"
        )}>
          <div>
            <div className={cn("text-[14px] font-medium", storen ? "text-white" : "text-gray-900")}>
              Storen oder Rollläden vorhanden?
            </div>
            <div className={cn("text-[12px] mt-0.5", storen ? "text-blue-100" : "text-gray-400")}>
              Jalousien, Lamellen, Rollläden, Fensterläden
            </div>
          </div>
          <div className={cn(
            "flex items-center gap-1 px-1 py-1 rounded-full transition-colors text-[12px] font-semibold flex-shrink-0",
            storen ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
          )}>
            <span className={cn("px-2 py-0.5 rounded-full transition-all", !storen && "bg-white text-gray-600 shadow-sm")}>Nein</span>
            <span className={cn("px-2 py-0.5 rounded-full transition-all", storen  && "bg-white text-blue-700 shadow-sm")}>Ja</span>
          </div>
        </button>
        {storen && (
          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl animate-in slide-in-from-top-2 duration-200">
            <CounterRow label="Ungefähre Anzahl" value={storenCount} onChange={setStorenCount} max={50} />
          </div>
        )}
      </div>

      {/* Zusatzleistungen */}
      <div>
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
          Zusatzleistungen <span className="normal-case font-normal text-[10px]">(optional)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            {v:"hochdruck", label:"Hochdruckreinigung",  desc:"Terrassen, Einfahrten, Fassaden"},
            {v:"kamin",     label:"Kaminreinigung",      desc:"Innen- und Aussenreinigung"},
            {v:"teppich",   label:"Teppichreinigung",    desc:"Teppich- und Polsterreinigung"},
            {v:"fugen",     label:"Fugenreinigung",      desc:"Bad, Küche, Bodenfugen"},
          ].map(z => (
            <button key={z.v} type="button" onClick={() => toggleSet(setZus, z.v)} className={cn(
              "px-3.5 py-2 rounded-lg border-[1.5px] text-left transition-all select-none",
              zus.has(z.v) ? "border-blue-500 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600"
            )}>
              <div className="text-[13px] font-semibold">{z.label}</div>
              <div className={cn("text-[11px] mt-0.5", zus.has(z.v) ? "text-blue-100" : "text-gray-400")}>{z.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── Step 4: Termin & Kontakt ─────────────────────────────
  const renderStep4 = () => (
    <div>
      <div className="text-xs font-mono font-medium text-blue-600 uppercase tracking-wider mb-1.5">Schritt 4 von 4</div>
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Termin & Kontakt</h2>
      <p className="text-[15px] text-gray-500 leading-relaxed mb-7">Wann soll gereinigt werden und wie können die Firmen Sie erreichen?</p>

      {/* Calendar */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
          Wunschdatum
          {date && (
            <span className="ml-2 text-blue-600 normal-case text-[11px] font-mono font-medium tracking-normal">
              · {format(date, "dd. MMM", { locale: de })}
            </span>
          )}
        </div>
        <div className="bg-white border-[1.5px] border-gray-200 rounded-xl w-full">
          <Calendar
            mode="single"
            selected={date}
            onSelect={d => setDate(d ?? undefined)}
            disabled={d => d < addDays(new Date(), 1) || d > addDays(new Date(), 365)}
            locale={de}
          />
        </div>
        {date && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[13px] text-blue-700 font-medium">
            <span>{format(date, "EEEE, d. MMMM yyyy", { locale: de })}</span>
            <button type="button" onClick={() => setDate(undefined)}
              className="ml-auto text-[11px] text-blue-400 hover:text-blue-600 transition-colors">Ändern</button>
          </div>
        )}
        <div className="mt-3">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Flexibilität</div>
          <div className="flex flex-wrap gap-2">
            {[
              {v:"fix", label:"Festes Datum"},
              {v:"3",   label:"± 3 Tage"},
              {v:"7",   label:"± 1 Woche"},
              {v:"14",  label:"± 2 Wochen"},
            ].map(f => (
              <button key={f.v} type="button" onClick={() => setFlex(f.v)} className={cn(
                "px-3.5 py-1.5 rounded-full border-[1.5px] text-[13px] font-medium transition-all",
                flex === f.v
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
              )}>{f.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Reinigungsadresse</div>
        <div className={cn(
          "bg-white border-[1.5px] rounded-xl transition-all",
          str && plz.length === 4 ? "border-green-300" : "border-gray-200"
        )}>
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50/70 border-b border-gray-100 rounded-t-xl">
            <span className="text-[13px] font-semibold text-gray-700">Wo soll gereinigt werden?</span>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Strasse & Nr.</label>
              <div className="grid grid-cols-[1fr_72px] gap-2">
                <input type="text" value={str} onChange={e => setStr(e.target.value)}
                  placeholder="Musterstrasse" autoComplete="street-address" className={inputCls} />
                <input type="text" value={nr} onChange={e => setNr(e.target.value)}
                  placeholder="12a" autoComplete="off" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">PLZ / Ort</label>
              <div className="relative">
                <div className="grid grid-cols-[88px_1fr] gap-2">
                  <div className="relative">
                              <input type="text" value={plz} maxLength={4}
                      onChange={e => handlePlz(e.target.value)} placeholder="8001"
                      autoComplete="postal-code"
                      className={cn(
                        "w-full h-10 bg-gray-50 border-[1.5px] rounded-lg px-3 text-[14px] font-mono text-gray-900 outline-none transition-all hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.10)]",
                        plz.length === 4 && ort ? "border-green-300" : "border-gray-200"
                      )} />
                  </div>
                  <input type="text" value={ort} onChange={e => setOrt(e.target.value)} placeholder="Zürich"
                    className="h-10 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3 text-[14px] text-gray-900 outline-none transition-all hover:border-gray-300 focus:border-blue-500 focus:bg-white" />
                </div>
                {acOpen && acList.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-[1.5px] border-blue-200 rounded-xl shadow-xl z-[500] max-h-48 overflow-y-auto" onMouseDown={e => e.preventDefault()}>
                    {acList.map((item, i) => (
                      <div key={i} onMouseDown={() => pickPlz(item)}
                        className="flex items-center gap-2 px-3 py-2.5 text-[13px] cursor-pointer hover:bg-blue-50 border-b last:border-0 border-gray-100">
                        <span className="font-mono text-[11px] text-gray-400 w-10 flex-shrink-0">{item.p}</span>
                        <span className="font-medium text-gray-800">{item.o}</span>
                        <span className="text-[11px] text-gray-400 ml-auto">{item.k}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Offerten */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Anzahl Offerten</div>
        <div className="grid grid-cols-3 gap-2">
          {([3,4,5] as const).map(n => (
            <div key={n} onClick={() => setOfferten(n)} className={cn(
              "relative flex flex-col items-center py-3.5 border-[1.5px] rounded-xl cursor-pointer select-none transition-all",
              offerten === n
                ? "border-blue-500 bg-blue-50 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]"
                : "border-gray-200 bg-white hover:border-blue-300"
            )}>
              {n === 3 && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">Empfohlen</span>
              )}
              <span className={cn("text-[22px] font-semibold tracking-tight", offerten === n ? "text-blue-600" : "text-gray-800")}>{n}</span>
              <span className="text-[11px] text-gray-400 mt-0.5">Offerten</span>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div>
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Ihre Kontaktdaten</div>
        <div className="bg-white border-[1.5px] border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 space-y-3.5">
            {/* Anrede */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">Anrede</label>
              <div className="flex gap-2">
                {(["Herr","Frau","Divers"] as const).map(a => (
                  <button key={a} type="button" onClick={() => setAnrede(a)} className={cn(
                    "flex-1 h-9 rounded-lg border-[1.5px] text-[13px] font-medium transition-all",
                    anrede === a
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
                  )}>{a}</button>
                ))}
              </div>
            </div>
            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Vorname</label>
                <input type="text" value={vorname} onChange={e => setVorname(e.target.value)}
                  placeholder="Max" autoComplete="given-name" className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Nachname</label>
                <input type="text" value={nachname} onChange={e => setNachname(e.target.value)}
                  placeholder="Muster" autoComplete="family-name" className={inputCls} />
              </div>
            </div>
            {/* Email */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">E-Mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="max@beispiel.ch" autoComplete="email"
                className={cn(
                  "w-full h-10 bg-gray-50 border-[1.5px] rounded-lg px-3 text-[14px] text-gray-900 outline-none transition-all hover:border-gray-300 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.10)]",
                  email.length > 2
                    ? emailResult.severity === "error" ? "border-red-300 focus:border-red-400"
                      : emailResult.severity === "warning" ? "border-amber-300 focus:border-amber-400"
                      : emailOk ? "border-green-300 focus:border-green-400" : "border-gray-200 focus:border-blue-500"
                    : "border-gray-200 focus:border-blue-500"
                )} />
              <EmailHint email={email} result={emailResult} onAcceptSuggestion={setEmail} />
            </div>
            {/* Tel */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Telefon</label>
              <div className="relative">
                <input type="tel" value={tel} onChange={e => setTel(e.target.value)}
                  placeholder="+41 79 123 45 67" autoComplete="tel"
                  className={cn(
                    "w-full h-10 bg-gray-50 border-[1.5px] rounded-lg px-3 text-[14px] text-gray-900 outline-none transition-all hover:border-gray-300 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.10)]",
                    tel.length > 2
                      ? telOk ? "border-green-300 focus:border-green-400" : "border-red-300 focus:border-red-400"
                      : "border-gray-200 focus:border-blue-500"
                  )} />
              </div>
              {tel.length > 2 && !telOk && (
                <div className="text-[11px] text-red-500 mt-1">Bitte gültige Nummer eingeben</div>
              )}
            </div>
            {/* Kontaktzeit */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Bevorzugte Kontaktzeit</label>
              <select value={zeit} onChange={e => setZeit(e.target.value)}
                className="w-full h-10 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3 text-[14px] text-gray-900 outline-none appearance-none cursor-pointer transition-all hover:border-gray-300 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.10)]">
                <option value="any">Jederzeit</option>
                <option value="vm">Vormittags (08–12 Uhr)</option>
                <option value="nm">Nachmittags (12–17 Uhr)</option>
                <option value="ab">Abends (17–20 Uhr)</option>
              </select>
            </div>
            {/* Bemerkungen */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                Bemerkungen <span className="normal-case font-normal text-[10px]">(optional)</span>
              </label>
              <textarea value={bemerkungen} onChange={e => setBemerkungen(e.target.value)}
                placeholder="z.B. Wohnungsübergabe am 15. April, Schlüssel beim Hausmeister…"
                className="w-full p-3 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg text-[14px] text-gray-900 outline-none resize-none min-h-[76px] leading-relaxed transition-all hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.10)]" />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button type="button" onClick={handleSubmit} disabled={!canProceed() || isSubmitting}
          className="w-full mt-4 h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-[15px] font-semibold transition-all hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(37,99,235,0.35)] disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2">
          {isSubmitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird gesendet…</>
            : <>Anfrage kostenlos absenden →</>}
        </button>

        {/* Trust row */}
        <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
          {["Geprüfte Firmen","Daten geschützt","Antwort in 24h","Kostenlos"].map(item => (
            <span key={item} className="text-[11px] text-gray-400">· {item}</span>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── Main render ─────────────────────────────────────────
  const progressPct = (step / TOTAL_STEPS) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Service type pill */}
      <div className="mb-4 flex justify-center">
        <span className={cn(
          "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-semibold border",
          svc.color
        )}>
          {svc.emoji} {svc.label}
        </span>
      </div>

      {/* Progress bar + step dots */}
      <div className="mb-5">
        <div className="flex items-center gap-1 mb-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s, i) => (
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
          <div className="h-full bg-blue-600 rounded-full transition-all duration-400" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Active step */}
      <div className="pb-24">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* Footer navigation (steps 1–3 only; step 4 has inline submit) */}
      {step < 4 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 px-5 py-3.5 z-50">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button type="button"
              style={{ visibility: step > 1 ? "visible" : "hidden" }}
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 h-10 border-[1.5px] border-gray-200 rounded-xl text-[14px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all">
              ← Zurück
            </button>
            <button type="button"
              disabled={!canProceed()}
              onClick={() => { if (canProceed()) setStep(s => s + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="flex items-center gap-1.5 px-6 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-[14px] font-semibold transition-all hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(37,99,235,0.3)] disabled:transform-none disabled:shadow-none">
              Weiter →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
