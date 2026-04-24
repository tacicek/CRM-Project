// EntsorgungWizard.tsx - Main wizard container for Entsorgung (Waste Disposal) form

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sendCustomerConfirmation } from "@/lib/sendCustomerConfirmation";
import { triggerLeadQualityValidation } from "@/lib/triggerLeadQualityValidation";
import { isEmailAcceptable } from "@/lib/emailValidation";
import { Button } from "@/components/ui/button";
import { EntsorgungProgressBar } from "./EntsorgungProgressBar";
import {
  Step1WasteType,
  Step2Items,
  Step3Address,
  Step4Access,
  Step5Services,
  Step6Timing,
  Step7Contact,
  Step8Summary,
} from "./steps";
import { EntsorgungAnfrage, createEmptyEntsorgungAnfrage } from "@/types/entsorgung";
import { supabase } from "@/integrations/supabase/client";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { verifyRecaptchaToken } from "@/lib/recaptchaVerify";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Send, Loader2 } from "lucide-react";

const STORAGE_KEY = "entsorgung_wizard_data";
const TOTAL_STEPS = 8;

interface EntsorgungWizardProps {
  formId?: string;
  onComplete?: () => void;
}

export const EntsorgungWizard = ({ formId, onComplete }: EntsorgungWizardProps = {}) => {
  const navigate = useNavigate();
  const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<EntsorgungAnfrage>>(
    createEmptyEntsorgungAnfrage()
  );

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(parsed);
      } catch (e) {
        console.error("Failed to parse saved form data:", e);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      if (!validateStep(currentStep)) {
        return;
      }
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleGoToStep = (step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setCurrentStep(step);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: // Waste Type
        if (!formData.entsorgungs_art) {
          toast.error("Bitte wählen Sie eine Abfallart");
          return false;
        }
        break;
      case 2: // Items & Quantity
        if (!formData.menge?.container_groesse && !formData.menge?.volumen_m3) {
          toast.error("Bitte geben Sie das Volumen oder die Containergrösse an");
          return false;
        }
        break;
      case 3: // Address
        if (
          !formData.adresse?.strasse ||
          !formData.adresse?.plz ||
          !formData.adresse?.ort
        ) {
          toast.error("Bitte geben Sie die vollständige Adresse an");
          return false;
        }
        break;
      case 4: // Access
        if (!formData.zugang?.stockwerk) {
          toast.error("Bitte wählen Sie das Stockwerk");
          return false;
        }
        break;
      case 5: // Services - Optional
        break;
      case 6: // Timing
        if (!formData.termin?.wunschdatum) {
          toast.error("Bitte geben Sie ein Wunschdatum an");
          return false;
        }
        break;
      case 7: // Contact
        if (
          !formData.anfragender?.vorname ||
          !formData.anfragender?.nachname ||
          !formData.anfragender?.email ||
          !formData.anfragender?.telefon
        ) {
          toast.error("Bitte füllen Sie alle Kontaktfelder aus");
          return false;
        }
        if (!isEmailAcceptable(formData.anfragender.email)) {
          toast.error("Bitte geben Sie eine gültige E-Mail-Adresse ein");
          return false;
        }
        break;
      case 8: // Summary
        if (!formData.agb_akzeptiert || !formData.korrekte_angaben_bestaetigt) {
          toast.error("Bitte akzeptieren Sie die erforderlichen Bestätigungen");
          return false;
        }
        break;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep(TOTAL_STEPS)) {
      return;
    }

    setIsSubmitting(true);
    
    // reCAPTCHA verification
    if (recaptchaEnabled) {
      const token = await executeRecaptcha("submit_entsorgung_form");
      const verifyResult = await verifyRecaptchaToken(token, "submit_entsorgung_form");
      
      if (!verifyResult.success) {
        toast.error("Sicherheitsüberprüfung fehlgeschlagen. Bitte versuchen Sie es erneut.");
        setIsSubmitting(false);
        return;
      }
    }

    try {
      // Convert floor level string to number
      const floorToNumber = (floor?: string): number => {
        if (!floor) return 0;
        if (floor === "basement") return -1;
        if (floor === "ground_floor") return 0;
        const match = floor.match(/floor_(\d+)/);
        if (match) return parseInt(match[1]);
        return 0;
      };

      const leadData = {
        service_type: "entsorgung",
        from_plz: formData.adresse?.plz,
        from_city: formData.adresse?.ort,
        from_street: formData.adresse?.strasse,
        from_house_number: formData.adresse?.hausnummer,
        from_floor: floorToNumber(formData.zugang?.stockwerk),
        from_has_lift: formData.zugang?.lift_vorhanden || false,
        preferred_date: formData.termin?.wunschdatum,
        is_flexible_date: formData.termin?.flexibilitaet !== "fixed",
        description: formData.bemerkungen,
        customer_first_name: formData.anfragender?.vorname,
        customer_last_name: formData.anfragender?.nachname,
        customer_email: formData.anfragender?.email,
        customer_phone: (() => { const t = formData.anfragender?.telefon ?? ""; return t.startsWith("+") ? t : `+41${t.replace(/\s/g, "")}`; })(),
        customer_salutation: formData.anfragender?.anrede,
        customer_contact_time: formData.anfragender?.kontaktzeit,
        status: "pending_verification",
        form_version: 2,
        detailed_form_data: formData as unknown as Record<string, unknown>,
        max_companies: formData.max_companies || 3,
        source_form_id: formId || null,
      };

      // Insert via RPC function
      const { data: newLeadId, error } = await supabase.rpc("submit_lead_json", {
        lead_data: leadData,
      });

      if (error) throw error;

      triggerLeadQualityValidation(newLeadId as string | null);

      sendCustomerConfirmation({
        firstName: formData.anfragender?.vorname ?? "",
        lastName: formData.anfragender?.nachname ?? "",
        email: formData.anfragender?.email ?? "",
        serviceType: "entsorgung",
        fromCity: formData.adresse?.ort ?? "",
        maxCompanies: formData.max_companies || 3,
      });

      // Clear localStorage
      localStorage.removeItem(STORAGE_KEY);
      onComplete?.();

      // Success notification
      toast.success("Ihre Anfrage wurde erfolgreich übermittelt!");

      // Navigate to success page
      navigate(`/anfrage/erfolg`, {
        state: {
          anfrage_nummer: newLeadId,
          service_type: "entsorgung",
        },
      });
    } catch (error: unknown) {
      console.error("Error submitting form:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Ein Fehler ist aufgetreten";
      toast.error(`Fehler beim Übermitteln: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1WasteType
            value={formData.entsorgungs_art}
            onChange={(value) => setFormData({ ...formData, entsorgungs_art: value })}
          />
        );
      case 2:
        return (
          <Step2Items
            menge={formData.menge || {}}
            objekte={formData.objekte || {}}
            wasteType={formData.entsorgungs_art!}
            onMengeChange={(menge) => setFormData({ ...formData, menge })}
            onObjekteChange={(objekte) => setFormData({ ...formData, objekte })}
          />
        );
      case 3:
        return (
          <Step3Address
            address={formData.adresse!}
            onChange={(adresse) => setFormData({ ...formData, adresse })}
          />
        );
      case 4:
        return (
          <Step4Access
            access={formData.zugang!}
            onChange={(zugang) => setFormData({ ...formData, zugang })}
          />
        );
      case 5:
        return (
          <Step5Services
            services={formData.zusatzleistungen!}
            onChange={(zusatzleistungen) =>
              setFormData({ ...formData, zusatzleistungen })
            }
          />
        );
      case 6:
        return (
          <Step6Timing
            timing={formData.termin!}
            onChange={(termin) => setFormData({ ...formData, termin })}
          />
        );
      case 7:
        return (
          <Step7Contact
            contact={formData.anfragender!}
            onChange={(anfragender) => setFormData({ ...formData, anfragender })}
          />
        );
      case 8:
        return (
          <Step8Summary
            data={formData}
            onEdit={handleGoToStep}
            onUpdateRemarks={(bemerkungen) =>
              setFormData({ ...formData, bemerkungen })
            }
            onUpdateAGB={(agb_akzeptiert) =>
              setFormData({ ...formData, agb_akzeptiert })
            }
            onUpdateKorrekteAngaben={(korrekte_angaben_bestaetigt) =>
              setFormData({ ...formData, korrekte_angaben_bestaetigt })
            }
            maxCompanies={formData.max_companies || 3}
            onMaxCompaniesChange={(value) =>
              setFormData({ ...formData, max_companies: value as 1 | 3 | 5 })
            }
          />
        );
      default:
        return null;
    }
  };

  const isLastStep = currentStep === TOTAL_STEPS;
  const canSubmit = formData.agb_akzeptiert && formData.korrekte_angaben_bestaetigt;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <EntsorgungProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
      </div>

      {/* Form Content */}
      <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-6">
        {renderStep()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </Button>

        {isLastStep ? (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Wird gesendet...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Anfrage absenden
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-2"
          >
            Weiter
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default EntsorgungWizard;

