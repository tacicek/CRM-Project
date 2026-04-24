// MalerarbeitWizard.tsx - Compact wizard for painting requests

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sendCustomerConfirmation } from "@/lib/sendCustomerConfirmation";
import { triggerLeadQualityValidation } from "@/lib/triggerLeadQualityValidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailField } from "@/components/ui/email-field";
import { isEmailAcceptable } from "@/lib/emailValidation";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { verifyRecaptchaToken } from "@/lib/recaptchaVerify";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Send, Loader2, Check, Building2, PaintBucket, Brush, Palette, Droplets, Square, Sun } from "lucide-react";

const STORAGE_KEY = "malerarbeit_wizard_data";
const TOTAL_STEPS = 6;

type MalerarbeitArt = "innen_streichen" | "aussen_streichen" | "tapezieren" | "lackieren" | "fassade" | "spachteln" | "dekorativ";

const malerTypes: { type: MalerarbeitArt; label: string; icon: React.ElementType; color: string }[] = [
  { type: "innen_streichen", label: "Innenanstrich", icon: PaintBucket, color: "bg-blue-500" },
  { type: "aussen_streichen", label: "Aussenanstrich", icon: Sun, color: "bg-amber-500" },
  { type: "tapezieren", label: "Tapezieren", icon: Square, color: "bg-purple-500" },
  { type: "lackieren", label: "Lackieren", icon: Brush, color: "bg-green-500" },
  { type: "fassade", label: "Fassade", icon: Building2, color: "bg-gray-500" },
  { type: "spachteln", label: "Spachteln", icon: Droplets, color: "bg-cyan-500" },
  { type: "dekorativ", label: "Dekorativ", icon: Palette, color: "bg-pink-500" },
];

interface FormData {
  malerarbeit_art?: MalerarbeitArt;
  property: { type: "wohnung" | "haus" | "gewerbe"; flaeche_m2?: number; zimmer_anzahl?: number };
  adresse: { strasse: string; hausnummer: string; plz: string; ort: string };
  umfang: { beschreibung: string; farbe_vorhanden: boolean };
  termin: { wunschdatum: string; flexibilitaet: "fixed" | "flexible" | "very_flexible" };
  anfragender: { anrede: "herr" | "frau" | "firma"; vorname: string; nachname: string; email: string; telefon: string };
  bemerkungen?: string;
  agb_akzeptiert: boolean;
  korrekte_angaben_bestaetigt: boolean;
  max_companies: 1 | 3 | 5;
}

const createEmpty = (): FormData => ({
  malerarbeit_art: undefined,
  property: { type: "wohnung", flaeche_m2: undefined, zimmer_anzahl: undefined },
  adresse: { strasse: "", hausnummer: "", plz: "", ort: "" },
  umfang: { beschreibung: "", farbe_vorhanden: false },
  termin: { wunschdatum: "", flexibilitaet: "flexible" },
  anfragender: { anrede: "herr", vorname: "", nachname: "", email: "", telefon: "" },
  bemerkungen: "",
  agb_akzeptiert: false,
  korrekte_angaben_bestaetigt: false,
  max_companies: 3,
});

export interface MalerarbeitWizardProps {
  formId?: string;
  onComplete?: () => void;
}

export const MalerarbeitWizard = ({ formId, onComplete }: MalerarbeitWizardProps = {}) => {
  const navigate = useNavigate();
  const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>(createEmpty());

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { setFormData(JSON.parse(saved)); } catch (e) { console.error(e); } }
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(formData)); }, [formData]);

  const progress = ((currentStep - 1) / (TOTAL_STEPS - 1)) * 100;

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS && validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => { if (currentStep > 1) { setCurrentStep(currentStep - 1); window.scrollTo({ top: 0, behavior: "smooth" }); } };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: if (!formData.malerarbeit_art) { toast.error("Bitte wählen Sie eine Malerarbeit"); return false; } break;
      case 2: if (!formData.property?.type || !formData.property?.flaeche_m2) { toast.error("Bitte füllen Sie die Objektdetails aus"); return false; } break;
      case 3: if (!formData.adresse?.strasse || !formData.adresse?.plz || !formData.adresse?.ort) { toast.error("Bitte geben Sie die vollständige Adresse an"); return false; } break;
      case 4: if (!formData.termin?.wunschdatum) { toast.error("Bitte geben Sie ein Wunschdatum an"); return false; } break;
      case 5:
        if (!formData.anfragender?.vorname || !formData.anfragender?.nachname || !formData.anfragender?.email || !formData.anfragender?.telefon) { toast.error("Bitte füllen Sie alle Kontaktfelder aus"); return false; }
        if (!isEmailAcceptable(formData.anfragender.email)) { toast.error("Bitte geben Sie eine gültige E-Mail-Adresse ein"); return false; }
        break;
      case 6: if (!formData.agb_akzeptiert || !formData.korrekte_angaben_bestaetigt) { toast.error("Bitte akzeptieren Sie die erforderlichen Bestätigungen"); return false; } break;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep(TOTAL_STEPS)) return;
    setIsSubmitting(true);
    
    // reCAPTCHA verification
    if (recaptchaEnabled) {
      const token = await executeRecaptcha("submit_malerarbeit_form");
      const verifyResult = await verifyRecaptchaToken(token, "submit_malerarbeit_form");
      
      if (!verifyResult.success) {
        toast.error("Sicherheitsüberprüfung fehlgeschlagen. Bitte versuchen Sie es erneut.");
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const leadData = {
        service_type: "malerarbeit",
        property_type: formData.property?.type,
        from_living_space_m2: formData.property?.flaeche_m2,
        from_rooms: formData.property?.zimmer_anzahl,
        from_plz: formData.adresse?.plz,
        from_city: formData.adresse?.ort,
        from_street: formData.adresse?.strasse,
        from_house_number: formData.adresse?.hausnummer,
        preferred_date: formData.termin?.wunschdatum,
        is_flexible_date: formData.termin?.flexibilitaet !== "fixed",
        description: formData.bemerkungen || formData.umfang?.beschreibung,
        customer_first_name: formData.anfragender?.vorname,
        customer_last_name: formData.anfragender?.nachname,
        customer_email: formData.anfragender?.email,
        customer_phone: (() => { const t = formData.anfragender?.telefon ?? ""; return t.startsWith("+") ? t : `+41${t.replace(/\s/g, "")}`; })(),
        customer_salutation: formData.anfragender?.anrede,
        status: "pending_verification",
        form_version: 2,
        detailed_form_data: formData as unknown as Record<string, unknown>,
        max_companies: formData.max_companies || 3,
        source_form_id: formId || null,
      };

      const { data: newLeadId, error } = await supabase.rpc("submit_lead_json", { lead_data: leadData });
      if (error) throw error;

      triggerLeadQualityValidation(newLeadId as string | null);

      sendCustomerConfirmation({
        firstName: formData.anfragender?.vorname ?? "",
        lastName: formData.anfragender?.nachname ?? "",
        email: formData.anfragender?.email ?? "",
        serviceType: "malerarbeit",
        fromCity: formData.adresse?.ort ?? "",
        maxCompanies: formData.max_companies || 3,
      });

      localStorage.removeItem(STORAGE_KEY);
      onComplete?.();
      toast.success("Ihre Anfrage wurde erfolgreich übermittelt!");
      navigate(`/anfrage/erfolg`, { state: { anfrage_nummer: newLeadId, service_type: "malerarbeit" } });
    } catch (error: unknown) {
      toast.error(`Fehler: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center"><h2 className="text-2xl font-bold">Welche Malerarbeit benötigen Sie?</h2><p className="mt-2 text-gray-600">Wählen Sie die Art der gewünschten Arbeit</p></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {malerTypes.map(({ type, label, icon: Icon, color }) => (
                <button key={type} type="button" onClick={() => setFormData({ ...formData, malerarbeit_art: type })}
                  className={cn("relative flex flex-col items-center p-4 rounded-xl border-2 transition-all hover:shadow-lg", formData.malerarbeit_art === type ? "border-primary bg-primary/5 shadow-md" : "border-gray-200 hover:border-gray-300")}>
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mb-2", formData.malerarbeit_art === type ? color : "bg-gray-100")}>
                    <Icon className={cn("w-6 h-6", formData.malerarbeit_art === type ? "text-white" : "text-gray-500")} />
                  </div>
                  <span className="font-medium text-center text-sm">{label}</span>
                  {formData.malerarbeit_art === type && <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center"><h2 className="text-2xl font-bold">Objektdetails</h2></div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Objekttyp *</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[{ v: "wohnung", l: "Wohnung" }, { v: "haus", l: "Haus" }, { v: "gewerbe", l: "Gewerbe" }].map((t) => (
                    <button key={t.v} type="button" onClick={() => setFormData({ ...formData, property: { ...formData.property, type: t.v as "wohnung" | "haus" | "gewerbe" } })}
                      className={cn("p-3 rounded-lg border-2 transition-all", formData.property?.type === t.v ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300")}>{t.l}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Fläche (m²) *</Label><Input type="number" placeholder="z.B. 80" value={formData.property?.flaeche_m2 || ""} onChange={(e) => setFormData({ ...formData, property: { ...formData.property, flaeche_m2: parseFloat(e.target.value) || undefined } })} /></div>
                <div className="space-y-2"><Label>Zimmeranzahl</Label><Input type="number" placeholder="z.B. 4" value={formData.property?.zimmer_anzahl || ""} onChange={(e) => setFormData({ ...formData, property: { ...formData.property, zimmer_anzahl: parseFloat(e.target.value) || undefined } })} /></div>
              </div>
              <div className="space-y-2"><Label>Beschreibung</Label><Textarea placeholder="Beschreiben Sie die gewünschten Arbeiten..." value={formData.umfang?.beschreibung || ""} onChange={(e) => setFormData({ ...formData, umfang: { ...formData.umfang, beschreibung: e.target.value } })} rows={4} /></div>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border">
                <Checkbox checked={formData.umfang?.farbe_vorhanden || false} onCheckedChange={(c) => setFormData({ ...formData, umfang: { ...formData.umfang, farbe_vorhanden: c === true } })} />
                <span>Farbe/Material bereits vorhanden</span>
              </label>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center"><h2 className="text-2xl font-bold">Adresse</h2></div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2"><Label>Strasse *</Label><Input value={formData.adresse?.strasse || ""} onChange={(e) => setFormData({ ...formData, adresse: { ...formData.adresse, strasse: e.target.value } })} /></div>
                <div className="space-y-2"><Label>Nr.</Label><Input value={formData.adresse?.hausnummer || ""} onChange={(e) => setFormData({ ...formData, adresse: { ...formData.adresse, hausnummer: e.target.value } })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>PLZ *</Label><Input maxLength={4} value={formData.adresse?.plz || ""} onChange={(e) => setFormData({ ...formData, adresse: { ...formData.adresse, plz: e.target.value.replace(/\D/g, "").slice(0, 4) } })} /></div>
                <div className="col-span-2 space-y-2"><Label>Ort *</Label><Input value={formData.adresse?.ort || ""} onChange={(e) => setFormData({ ...formData, adresse: { ...formData.adresse, ort: e.target.value } })} /></div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center"><h2 className="text-2xl font-bold">Zeitplanung</h2></div>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Wunschdatum *</Label><Input type="date" min={new Date(Date.now() + 86400000).toISOString().split("T")[0]} value={formData.termin?.wunschdatum || ""} onChange={(e) => setFormData({ ...formData, termin: { ...formData.termin, wunschdatum: e.target.value } })} className="max-w-xs" /></div>
              <div className="space-y-2">
                <Label>Flexibilität</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[{ v: "fixed", l: "Fester Termin" }, { v: "flexible", l: "Flexibel" }, { v: "very_flexible", l: "Sehr flexibel" }].map((t) => (
                    <button key={t.v} type="button" onClick={() => setFormData({ ...formData, termin: { ...formData.termin, flexibilitaet: t.v as "fixed" | "flexible" | "very_flexible" } })}
                      className={cn("p-3 rounded-lg border-2 text-sm transition-all", formData.termin?.flexibilitaet === t.v ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300")}>{t.l}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center"><h2 className="text-2xl font-bold">Kontaktdaten</h2></div>
            <div className="space-y-4">
              <div className="flex gap-3">
                {[{ v: "herr", l: "Herr" }, { v: "frau", l: "Frau" }, { v: "firma", l: "Firma" }].map((s) => (
                  <button key={s.v} type="button" onClick={() => setFormData({ ...formData, anfragender: { ...formData.anfragender, anrede: s.v as "herr" | "frau" | "firma" } })}
                    className={cn("px-4 py-2 rounded-lg border-2 transition-all", formData.anfragender?.anrede === s.v ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300")}>{s.l}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Vorname *</Label><Input value={formData.anfragender?.vorname || ""} onChange={(e) => setFormData({ ...formData, anfragender: { ...formData.anfragender, vorname: e.target.value } })} /></div>
                <div className="space-y-2"><Label>Nachname *</Label><Input value={formData.anfragender?.nachname || ""} onChange={(e) => setFormData({ ...formData, anfragender: { ...formData.anfragender, nachname: e.target.value } })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <EmailField label="E-Mail" required value={formData.anfragender?.email || ""} onChange={(v) => setFormData({ ...formData, anfragender: { ...formData.anfragender, email: v } })} />
                <div className="space-y-2"><Label>Telefon *</Label><Input type="tel" value={formData.anfragender?.telefon || ""} onChange={(e) => setFormData({ ...formData, anfragender: { ...formData.anfragender, telefon: e.target.value } })} /></div>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center"><h2 className="text-2xl font-bold">Zusammenfassung</h2></div>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-4"><strong>Art:</strong> {malerTypes.find(m => m.type === formData.malerarbeit_art)?.label || "-"}</div>
              <div className="bg-gray-50 rounded-lg p-4"><strong>Objekt:</strong> {formData.property?.type}, {formData.property?.flaeche_m2} m²</div>
              <div className="bg-gray-50 rounded-lg p-4"><strong>Adresse:</strong> {formData.adresse?.strasse} {formData.adresse?.hausnummer}, {formData.adresse?.plz} {formData.adresse?.ort}</div>
              <div className="bg-gray-50 rounded-lg p-4"><strong>Termin:</strong> {formData.termin?.wunschdatum}</div>
              <div className="bg-gray-50 rounded-lg p-4"><strong>Kontakt:</strong> {formData.anfragender?.vorname} {formData.anfragender?.nachname}</div>
            </div>
            <div className="space-y-2"><Label>Bemerkungen</Label><Textarea value={formData.bemerkungen || ""} onChange={(e) => setFormData({ ...formData, bemerkungen: e.target.value })} rows={3} /></div>
            <div className="space-y-3">
              <Label>Anzahl Offerten</Label>
              <div className="grid grid-cols-3 gap-3">
                {[{ v: 1, l: "1 (Exklusiv)" }, { v: 3, l: "3 (Empfohlen)" }, { v: 5, l: "5 (Maximum)" }].map((o) => (
                  <button key={o.v} type="button" onClick={() => setFormData({ ...formData, max_companies: o.v as 1 | 3 | 5 })}
                    className={cn("p-3 rounded-lg border-2 transition-all", formData.max_companies === o.v ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300")}>{o.l}</button>
                ))}
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t">
              <label className="flex items-start gap-3 cursor-pointer"><Checkbox checked={formData.agb_akzeptiert} onCheckedChange={(c) => setFormData({ ...formData, agb_akzeptiert: c === true })} className="mt-1" /><span className="text-sm">Ich akzeptiere die <a href="/agb" target="_blank" className="text-primary underline">AGB</a>. *</span></label>
              <label className="flex items-start gap-3 cursor-pointer"><Checkbox checked={formData.korrekte_angaben_bestaetigt} onCheckedChange={(c) => setFormData({ ...formData, korrekte_angaben_bestaetigt: c === true })} className="mt-1" /><span className="text-sm">Alle Angaben sind korrekt. *</span></label>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium">Schritt {currentStep} von {TOTAL_STEPS}</span><span className="text-sm text-gray-500">{Math.round(progress)}%</span></div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300" style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-6">{renderStep()}</div>
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}><ArrowLeft className="w-4 h-4 mr-2" />Zurück</Button>
        {currentStep === TOTAL_STEPS ? (
          <Button onClick={handleSubmit} disabled={isSubmitting || !formData.agb_akzeptiert || !formData.korrekte_angaben_bestaetigt} className="bg-green-600 hover:bg-green-700">
            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Senden...</> : <><Send className="w-4 h-4 mr-2" />Absenden</>}
          </Button>
        ) : (
          <Button onClick={handleNext}>Weiter<ArrowRight className="w-4 h-4 ml-2" /></Button>
        )}
      </div>
    </div>
  );
};

export default MalerarbeitWizard;

