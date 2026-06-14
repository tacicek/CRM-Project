import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputCH } from "@/components/ui/date-input-ch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  Send,
  Save,
  Loader2,
  ArrowLeft,
  Trash2,
  GripVertical,
} from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import SpellCheckModal from "@/components/offerte/SpellCheckModal";
import { runSpellCheck, type SpellCheckFields } from "@/lib/spellCheckService";
import { sendOffer } from "@/lib/sendOffer";

interface Company {
  id: string;
  company_name: string;
}

interface ItemTimeEstimate {
  minHours: string;
  maxHours: string;
  hourlyRate: string;
}

interface OfferItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  price_type?: string;
  is_highlighted?: boolean;
  is_optional?: boolean;
  timeEstimate?: ItemTimeEstimate | null;
}

// Common unit options for offer items
const unitOptions = [
  { value: "Pauschal", label: "Pauschal" },
  { value: "Stunden", label: "Stunden" },
  { value: "Stk.", label: "Stück (Stk.)" },
  { value: "m²", label: "Quadratmeter (m²)" },
  { value: "m³", label: "Kubikmeter (m³)" },
  { value: "lfm", label: "Laufmeter (lfm)" },
  { value: "kg", label: "Kilogramm (kg)" },
  { value: "Tag", label: "Tag" },
  { value: "Fahrt", label: "Fahrt" },
  { value: "Person", label: "Person" },
];

// Helper to infer price_type from unit and price for backward compatibility
const inferPriceType = (unit: string, unitPrice: number): string => {
  if (unit === "inkl." || unitPrice === 0) return "inkl";
  if (unit === "Stunden" || unit === "Stunde" || unit === "Std." || unit === "h") return "per_hour";
  if (unit === "Pauschal") return "pauschale";
  return "per_unit";
};

type PriceModel = 'pauschal' | 'stundenansatz' | 'kostendach';

interface Offer {
  id: string;
  company_id: string;
  lead_id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string | null;
  title: string;
  description: string | null;
  service_date: string | null;
  valid_until: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  status: string;
  price_model?: PriceModel | null;
  hourly_rate?: number | null;
  kostendach_max?: number | null;
}

const generateItemId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const FirmaOfferteBearbeiten = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { offerId } = useParams<{ offerId: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [vatRate, setVatRate] = useState(8.1);
  const [mwstEnabled, setMwstEnabled] = useState(true);
  const [items, setItems] = useState<OfferItem[]>([]);

  // Price model state
  const [priceModel, setPriceModel] = useState<PriceModel>('pauschal');
  const [hourlyRate, setHourlyRate] = useState<string>('');
  const [kostendachMax, setKostendachMax] = useState<string>('');
  const [briefLayout, setBriefLayout] = useState<boolean>(false);
  const [offerteType, setOfferteType] = useState<'normal' | 'blind'>('normal');

  // Payment terms
  const [paymentTerms, setPaymentTerms] = useState("Barzahlung nach der Ausführung");

  // Spell check state
  const [isSpellChecking, setIsSpellChecking] = useState(false);
  const [spellCheckOpen, setSpellCheckOpen] = useState(false);
  const [spellCheckOriginal, setSpellCheckOriginal] = useState<SpellCheckFields>({});
  const [spellCheckCorrected, setSpellCheckCorrected] = useState<SpellCheckFields>({});
  const pendingSpellSaveRef = useRef<boolean>(false);
  // Ref to handleSave — lets spell-check callbacks call it without causing a TDZ error
  const handleSaveRef = useRef<(sendAfterSave?: boolean) => void>(() => {});

  // Customer info
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !offerId) {
        setIsLoading(false);
        return;
      }

      try {
        // Get company
        const companyData = await fetchSingleCompanyForUser<Company>({
          userId: user.id,
          userEmail: user.email,
          select: "id, company_name",
        });

        if (!companyData) {
          navigate("/firma");
          return;
        }
        setCompany(companyData);

        // Get offer
        const { data: offerData, error: offerError } = await supabase
          .from("offers")
          .select("*")
          .eq("id", offerId)
          .eq("company_id", companyData.id)
          .single();

        if (offerError || !offerData) {
          toast({
            title: "Fehler",
            description: "Offerte nicht gefunden",
            variant: "destructive",
          });
          navigate("/firma/offerten");
          return;
        }

        // Kabul edilmiş veya reddedilmiş teklifler düzenlenemez
        if (["accepted", "rejected"].includes(offerData.status)) {
          toast({
            title: "Bearbeitung nicht möglich",
            description: `Diese Offerte wurde bereits ${offerData.status === "accepted" ? "angenommen" : "abgelehnt"} und kann nicht mehr bearbeitet werden.`,
            variant: "destructive",
          });
          navigate(`/firma/offerten/${offerId}`);
          return;
        }

        setOffer(offerData);
        setTitle(offerData.title || "");
        setDescription(offerData.description || "");
        setServiceDate(offerData.service_date || "");
        setValidUntil(offerData.valid_until || "");
        setVatRate(offerData.vat_rate || 8.1);
        setMwstEnabled(offerData.vat_rate > 0);
        setCustomerFirstName(offerData.customer_first_name || "");
        setCustomerLastName(offerData.customer_last_name || "");
        setCustomerEmail(offerData.customer_email || "");
        setCustomerPhone(offerData.customer_phone || "");
        if (offerData.payment_terms) {
          setPaymentTerms(String(offerData.payment_terms));
        }
        // Price model
        const pm = (offerData.price_model as PriceModel | null | undefined) ?? 'pauschal';
        setPriceModel(pm);
        if (offerData.hourly_rate !== null && offerData.hourly_rate !== undefined) setHourlyRate(String(offerData.hourly_rate));
        if (offerData.kostendach_max !== null && offerData.kostendach_max !== undefined) setKostendachMax(String(offerData.kostendach_max));
        setBriefLayout(offerData.brief_layout ?? false);
        const ot = offerData.offerte_type;
        setOfferteType(ot === 'blind' ? 'blind' : 'normal');

        // Get offer items
        const { data: itemsData, error: itemsError } = await supabase
          .from("offer_items")
          .select("*")
          .eq("offer_id", offerId)
          .order("position", { ascending: true });

        if (!itemsError && itemsData) {
          setItems(
            itemsData.map((item) => ({
              id: item.id,
              position: item.position,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unit_price: item.unit_price,
              // Load new fields with fallback logic for existing data
              price_type: item.price_type || inferPriceType(item.unit, item.unit_price),
              is_highlighted: item.is_highlighted || false,
              is_optional: item.is_optional || false,
              timeEstimate: item.time_estimate
                ? { minHours: String(item.time_estimate.minHours), maxHours: String(item.time_estimate.maxHours), hourlyRate: String(item.time_estimate.hourlyRate) }
                : null,
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Fehler",
          description: "Daten konnten nicht geladen werden",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, offerId, navigate, toast]);

  const addItem = () => {
    setItems([
      ...items,
      {
        id: generateItemId(),
        position: items.length + 1,
        description: "",
        quantity: 1,
        unit: "Pauschal",
        unit_price: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems.map((item, i) => ({ ...item, position: i + 1 })));
  };

  const updateItem = useCallback(
    (index: number, field: keyof OfferItem, value: unknown) => {
      setItems((prev) => {
        const newItems = [...prev];
        newItems[index] = { ...newItems[index], [field]: value };
        return newItems;
      });
    },
    []
  );

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const reorderedItems = Array.from(items);
    const [removed] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, removed);

    setItems(reorderedItems.map((item, i) => ({ ...item, position: i + 1 })));
  };

  const calculateSubtotal = () =>
    items.reduce((sum, item) => {
      if (item.unit === "inkl.") return sum;
      const te = item.timeEstimate;
      if (te && te.minHours && te.hourlyRate)
        return sum + parseFloat(te.minHours) * parseFloat(te.hourlyRate);
      return sum + item.quantity * item.unit_price;
    }, 0);

  const calculateMaxSubtotal = (): number | null => {
    const hasAny = items.some(i => i.timeEstimate && i.timeEstimate.maxHours && i.timeEstimate.hourlyRate);
    if (!hasAny) return null;
    return items.reduce((sum, item) => {
      if (item.unit === "inkl.") return sum;
      const te = item.timeEstimate;
      if (te && te.maxHours && te.hourlyRate)
        return sum + parseFloat(te.maxHours) * parseFloat(te.hourlyRate);
      return sum + item.quantity * item.unit_price;
    }, 0);
  };

  const calculateVat = () => {
    if (!mwstEnabled) return 0;
    return calculateSubtotal() * (vatRate / 100);
  };

  const calculateMaxVat = (): number | null => {
    const maxSub = calculateMaxSubtotal();
    if (maxSub === null || !mwstEnabled) return null;
    return maxSub * (vatRate / 100);
  };

  const calculateTotal = () => calculateSubtotal() + calculateVat();

  const calculateMaxTotal = (): number | null => {
    const maxSub = calculateMaxSubtotal();
    if (maxSub === null) return null;
    return maxSub + (calculateMaxVat() ?? 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: "CHF",
    }).format(amount);
  };


  const applySpellCorrections = useCallback(
    (corrected: SpellCheckFields) => {
      if (corrected["title"] !== undefined) setTitle(corrected["title"]);
      if (corrected["description"] !== undefined) setDescription(corrected["description"]);
      setItems((prev) =>
        prev.map((item, idx) => {
          const descKey = `item_${idx + 1}_description`;
          return corrected[descKey] !== undefined
            ? { ...item, description: corrected[descKey] }
            : item;
        })
      );
    },
    [setTitle, setDescription, setItems]
  );

  const handleSpellCheckAccept = useCallback(() => {
    setSpellCheckOpen(false);
    applySpellCorrections(spellCheckCorrected);
    setTimeout(() => handleSaveRef.current(pendingSpellSaveRef.current), 0);
  }, [applySpellCorrections, spellCheckCorrected]);

  const handleSpellCheckKeepOriginal = useCallback(() => {
    setSpellCheckOpen(false);
    setTimeout(() => handleSaveRef.current(pendingSpellSaveRef.current), 0);
  }, []);

  const handleSpellCheckDismiss = useCallback(() => {
    setSpellCheckOpen(false);
    setTimeout(() => handleSaveRef.current(pendingSpellSaveRef.current), 0);
  }, []);

  const handleSave = async (sendAfterSave: boolean = false) => {
    if (!company?.id || !offer || !offerId) return;

    if (!title.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Titel ein",
        variant: "destructive",
      });
      return;
    }

    if (items.some((item) => !item.description.trim())) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Positionen aus",
        variant: "destructive",
      });
      return;
    }

    if (priceModel === 'stundenansatz' || priceModel === 'kostendach') {
      if (!hourlyRate || Number(hourlyRate) <= 0) {
        toast({
          title: "Fehler",
          description: "Bitte geben Sie einen gültigen Stundenansatz ein",
          variant: "destructive",
        });
        return;
      }
    }

    if (priceModel === 'kostendach') {
      if (!kostendachMax || Number(kostendachMax) <= 0) {
        toast({
          title: "Fehler",
          description: "Bitte geben Sie ein gültiges Kostendach ein",
          variant: "destructive",
        });
        return;
      }
      if (Number(kostendachMax) < Number(hourlyRate)) {
        toast({
          title: "Fehler",
          description: "Das Kostendach muss mindestens so hoch sein wie der Stundenansatz",
          variant: "destructive",
        });
        return;
      }
    }

    // Blind Offerte — per-item time estimate validation
    for (const item of items) {
      const te = item.timeEstimate;
      if (!te) continue;
      if (!te.minHours || !te.maxHours || !te.hourlyRate) {
        toast({ title: "Fehler", description: `Zeitschätzung für "${item.description || 'Position'}" unvollständig`, variant: "destructive" });
        return;
      }
      if (parseFloat(te.maxHours) < parseFloat(te.minHours)) {
        toast({ title: "Fehler", description: `Max. Stunden müssen ≥ Min. Stunden sein (${item.description || 'Position'})`, variant: "destructive" });
        return;
      }
    }

    // ── Spell check intercept ──
    const spellFields: SpellCheckFields = {};
    if (title.trim()) spellFields["title"] = title;
    if (description?.trim()) spellFields["description"] = description;
    items.forEach((item, idx) => {
      if (item.description.trim()) spellFields[`item_${idx + 1}_description`] = item.description;
    });

    if (Object.keys(spellFields).length > 0) {
      setIsSpellChecking(true);
      const result = await runSpellCheck(spellFields);
      setIsSpellChecking(false);

      if (result && result.hasCorrections) {
        const changed = Object.entries(result.fields).some(
          ([k, v]) => spellFields[k] !== undefined && spellFields[k] !== v
        );
        if (changed) {
          pendingSpellSaveRef.current = sendAfterSave;
          setSpellCheckOriginal(spellFields);
          setSpellCheckCorrected(result.fields);
          setSpellCheckOpen(true);
          return;
        }
      }
    }

    setIsSaving(true);

    try {
      const subtotal = calculateSubtotal();

      // Update offer
      const { error: offerError } = await supabase
        .from("offers")
        .update({
          customer_first_name: customerFirstName,
          customer_last_name: customerLastName,
          customer_email: customerEmail,
          customer_phone: customerPhone || null,
          title,
          description: description || null,
          service_date: serviceDate || null,
          valid_until: validUntil || null,
          subtotal,
          vat_rate: mwstEnabled ? vatRate : 0,
          // status/sent_at NICHT hier setzen — die "sent"-Transition gehört
          // ausschliesslich der send-offer Edge Function (nur bei erfolgreichem Versand).
          updated_at: new Date().toISOString(),
          price_model: priceModel,
          hourly_rate: (priceModel === 'stundenansatz' || priceModel === 'kostendach') && hourlyRate
            ? Number(hourlyRate) : null,
          kostendach_max: priceModel === 'kostendach' && kostendachMax
            ? Number(kostendachMax) : null,
          payment_terms: paymentTerms?.trim() || null,
          brief_layout: briefLayout,
          offerte_type: offerteType,
        })
        .eq("id", offerId);

      if (offerError) throw offerError;

      // Atomic replace via RPC — delete + insert in a single transaction
      // Prevents orphan state if insert fails after delete
      const itemsPayload = items.map((item) => {
        const te = item.timeEstimate;
        const teValid = te && te.minHours && te.maxHours && te.hourlyRate;
        return {
          position: item.position,
          description: item.description,
          quantity: item.unit === "inkl." ? 1 : item.quantity,
          unit: item.unit,
          unit_price: teValid ? parseFloat(te!.minHours) * parseFloat(te!.hourlyRate) : (item.unit === "inkl." ? 0 : item.unit_price),
          price_type: item.price_type || inferPriceType(item.unit, item.unit_price),
          is_highlighted: item.is_highlighted || false,
          is_optional: item.is_optional || false,
          time_estimate: teValid
            ? { minHours: parseFloat(te!.minHours), maxHours: parseFloat(te!.maxHours), hourlyRate: parseFloat(te!.hourlyRate) }
            : null,
        };
      });

      const { error: itemsError } = await supabase
        .rpc("replace_offer_items", {
          p_offer_id: offerId,
          p_items: itemsPayload,
        });

      if (itemsError) throw itemsError;

      // Send email if requested — den Status-Übergang ("sent") setzt die send-offer
      // Edge Function selbst, nur bei erfolgreichem Versand. forceResend, weil die
      // Offerte bereits "sent"/"viewed" sein kann (Bearbeiten blockt accepted/rejected).
      if (sendAfterSave) {
        const result = await sendOffer({ offerId, companyId: company.id, forceResend: true });
        if (result.success) {
          toast({
            title: "Offerte gesendet",
            description: "Die Offerte wurde erfolgreich aktualisiert und gesendet.",
          });
        } else {
          toast({
            title: "Offerte gespeichert",
            description: `Die Offerte wurde gespeichert, aber: ${result.error ?? "die E-Mail konnte nicht gesendet werden."} Sie können sie unter Offerten erneut versenden.`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Offerte gespeichert",
          description: "Ihre Änderungen wurden erfolgreich gespeichert.",
        });
      }

      navigate("/firma/offerten");
    } catch (error: unknown) {
      console.error("Save error:", error);
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Die Offerte konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  // Keep ref in sync every render so spell-check callbacks always invoke the latest closure
  handleSaveRef.current = handleSave;

  if (isLoading) {
    return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!offer) {
    return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Offerte nicht gefunden</p>
          <Button className="mt-4" onClick={() => navigate("/firma/offerten")}>
            Zurück zu Offerten
          </Button>
        </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Offerte bearbeiten | Firma</title>
      </Helmet>
        <div className="space-y-4 sm:space-y-6">
          {/* Folk-style header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/firma/offerten")}
              className="h-9 w-9 shrink-0 rounded-md text-folk-ink3 hover:bg-folk-bg-warm hover:text-folk-ink2"
              aria-label="Zurück"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-2xl leading-none">📄</span>
                <h1 className="text-xl font-bold tracking-tight text-folk-ink sm:text-2xl">Offerte bearbeiten</h1>
              </div>
              <p className="mt-1 text-[13px] text-folk-ink2">
                Für <span className="font-semibold text-folk-ink">{customerFirstName} {customerLastName}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={isSaving || isSpellChecking}
                className="h-9 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-[13px] font-medium text-folk-ink2 hover:bg-folk-bg-warm"
              >
                {isSaving || isSpellChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isSpellChecking ? "Wird geprüft …" : "Speichern"}</span>
                <span className="sm:hidden">{isSpellChecking ? "…" : "Speich."}</span>
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={isSaving || isSpellChecking}
                className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[13px] font-semibold text-white hover:bg-folk-ink2"
              >
                {isSaving || isSpellChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isSpellChecking ? "Text wird geprüft …" : "Speichern & Senden"}</span>
                <span className="sm:hidden">{isSpellChecking ? "…" : "Senden"}</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Main Form */}
            <div className="md:col-span-2 lg:col-span-2 space-y-4 sm:space-y-6 order-2 md:order-1">
              {/* Customer Info */}
              <Card>
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                    Kundendaten
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">Vorname</Label>
                      <Input
                        value={customerFirstName}
                        onChange={(e) => setCustomerFirstName(e.target.value)}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">Nachname</Label>
                      <Input
                        value={customerLastName}
                        onChange={(e) => setCustomerLastName(e.target.value)}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">E-Mail</Label>
                      <Input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">Telefon</Label>
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Offer Details */}
              <Card>
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base">Offerte-Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">Titel</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="z.B. Umzugsofferte"
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">Beschreibung</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optionale Beschreibung..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">Ausführungsdatum</Label>
                      <DateInputCH
                        value={serviceDate}
                        onChange={setServiceDate}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs sm:text-sm">Gültig bis</Label>
                        {validUntil && (
                          <button
                            type="button"
                            onClick={() => setValidUntil("")}
                            className="text-[10px] text-muted-foreground hover:text-destructive"
                          >
                            Entfernen
                          </button>
                        )}
                      </div>
                      {validUntil ? (
                        <DateInputCH
                          value={validUntil}
                          onChange={setValidUntil}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 30);
                            setValidUntil(d.toISOString().split("T")[0]);
                          }}
                          className="w-full h-9 sm:h-10 border border-dashed border-input rounded-md text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1"
                        >
                          + Gültig bis hinzufügen
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Preismodell */}
              <Card>
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base">Preismodell</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        { value: 'pauschal', label: 'Pauschalpreis' },
                        { value: 'stundenansatz', label: 'Stundenansatz' },
                        { value: 'kostendach', label: 'Stundenansatz mit Kostendach' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPriceModel(opt.value)}
                        className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left ${
                          priceModel === opt.value
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {(priceModel === 'stundenansatz' || priceModel === 'kostendach') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
                      <div className="space-y-1">
                        <Label className="text-xs sm:text-sm">Stundenansatz (CHF / Std.)</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(e.target.value)}
                          placeholder="z.B. 120"
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                      {priceModel === 'kostendach' && (
                        <div className="space-y-1">
                          <Label className="text-xs sm:text-sm">Kostendach (max. CHF)</Label>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={kostendachMax}
                            onChange={(e) => setKostendachMax(e.target.value)}
                            placeholder="z.B. 1800"
                            className="h-9 sm:h-10 text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Der Kunde zahlt maximal diesen Betrag, unabhängig vom Zeitaufwand.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Offerte-Art: Normal / Blind */}
              <Card>
                <CardContent className="px-3 sm:px-6 py-3 sm:py-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Label className="text-sm font-medium">Offerte-Art</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: 'normal' as const, label: 'Normal Offerte', sub: 'Nach Besichtigung' },
                        { value: 'blind'  as const, label: 'Blind Offerte',  sub: 'Ohne Besichtigung' },
                      ]
                    ).map(({ value, label, sub }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setOfferteType(value)}
                        className={`rounded-lg border-2 px-3 py-2 text-left transition-colors ${
                          offerteType === value
                            ? value === 'blind'
                              ? 'border-amber-500 bg-amber-50 text-amber-800'
                              : 'border-primary bg-primary/5 text-primary'
                            : 'border-border bg-background text-muted-foreground hover:border-muted-foreground'
                        }`}
                      >
                        <p className="text-xs font-semibold">{label}</p>
                        <p className="text-[10px] mt-0.5">{sub}</p>
                      </button>
                    ))}
                  </div>
                  {offerteType === 'blind' && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      Diese Offerte basiert auf Kundenangaben ohne persönliche Besichtigung.
                      Preise sind Schätzungen und können nach Besichtigung angepasst werden.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Briefversand (SN 010 130) toggle */}
              <Card>
                <CardContent className="px-3 sm:px-6 py-3 sm:py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="brief-layout-toggle-edit" className="text-sm font-medium cursor-pointer">
                        Als Brief versenden
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        PDF im Schweizer Briefstandard SN 010 130 (mit Absenderblock, Empfängeradresse und korrekter Anrede)
                      </p>
                    </div>
                    <Switch
                      id="brief-layout-toggle-edit"
                      checked={briefLayout}
                      onCheckedChange={setBriefLayout}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Items */}
              <Card>
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base">Positionen</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="items">
                      {(provided) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="space-y-2 sm:space-y-3"
                        >
                          {items.map((item, index) => (
                            <Draggable
                              key={item.id}
                              draggableId={item.id}
                              index={index}
                            >
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-4 border rounded-lg bg-muted/30"
                                >
                                  <div
                                    {...provided.dragHandleProps}
                                    className="mt-1.5 sm:mt-2 cursor-grab"
                                  >
                                    <GripVertical className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs sm:text-sm">Beschreibung</Label>
                                      <Textarea
                                        value={item.description}
                                        onChange={(e) =>
                                          updateItem(index, "description", e.target.value)
                                        }
                                        placeholder="Leistungsbeschreibung..."
                                        rows={2}
                                        className="text-sm"
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-xs sm:text-sm">Menge</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={item.quantity}
                                          onChange={(e) =>
                                            updateItem(index, "quantity", Number(e.target.value))
                                          }
                                          onFocus={(e) => e.target.select()}
                                          className="h-8 sm:h-10 text-sm"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs sm:text-sm">Einheit</Label>
                                        <Select
                                          value={item.unit}
                                          onValueChange={(value) =>
                                            updateItem(index, "unit", value)
                                          }
                                        >
                                          <SelectTrigger className="h-8 sm:h-10 text-sm">
                                            <SelectValue placeholder="Einheit" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {unitOptions.map((option) => (
                                              <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs sm:text-sm">Preis/Einheit</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          step={0.01}
                                          value={item.unit_price}
                                          onChange={(e) =>
                                            updateItem(index, "unit_price", Number(e.target.value))
                                          }
                                          onFocus={(e) => e.target.select()}
                                          className="h-8 sm:h-10 text-sm"
                                        />
                                      </div>
                                      <div className="flex items-end">
                                        <div className="text-right w-full">
                                          <Label className="text-xs sm:text-sm text-muted-foreground">Total</Label>
                                          {item.timeEstimate && item.timeEstimate.minHours && item.timeEstimate.maxHours && item.timeEstimate.hourlyRate ? (
                                            <p className="font-semibold text-sm sm:text-base text-amber-700">
                                              {formatCurrency(parseFloat(item.timeEstimate.minHours) * parseFloat(item.timeEstimate.hourlyRate))}
                                              {' –'}
                                              <br className="sm:hidden" />
                                              {' '}{formatCurrency(parseFloat(item.timeEstimate.maxHours) * parseFloat(item.timeEstimate.hourlyRate))}
                                            </p>
                                          ) : (
                                            <p className="font-semibold text-sm sm:text-base">
                                              {formatCurrency(item.quantity * item.unit_price)}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Blind Offerte — per-item Zeitschätzung */}
                                    {offerteType === 'blind' && (
                                      <div className="mt-2 border-t border-amber-100 pt-2">
                                        {item.timeEstimate ? (
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-medium text-amber-700">⏱ Zeitschätzung</span>
                                              <button
                                                type="button"
                                                onClick={() => updateItem(index, 'timeEstimate', null)}
                                                className="text-xs text-muted-foreground hover:text-destructive"
                                              >
                                                Entfernen
                                              </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                              <div>
                                                <Label className="text-[10px] text-muted-foreground">Min. Std.</Label>
                                                <Input
                                                  type="number" min={1} step={1} placeholder="7"
                                                  value={item.timeEstimate.minHours}
                                                  onChange={(e) => updateItem(index, 'timeEstimate', { ...item.timeEstimate!, minHours: e.target.value })}
                                                  className="h-7 text-xs"
                                                />
                                              </div>
                                              <div>
                                                <Label className="text-[10px] text-muted-foreground">Max. Std.</Label>
                                                <Input
                                                  type="number" min={1} step={1} placeholder="9"
                                                  value={item.timeEstimate.maxHours}
                                                  onChange={(e) => updateItem(index, 'timeEstimate', { ...item.timeEstimate!, maxHours: e.target.value })}
                                                  className="h-7 text-xs"
                                                />
                                              </div>
                                              <div>
                                                <Label className="text-[10px] text-muted-foreground">CHF / Std.</Label>
                                                <Input
                                                  type="number" min={0} step={0.05} placeholder="95"
                                                  value={item.timeEstimate.hourlyRate}
                                                  onChange={(e) => updateItem(index, 'timeEstimate', { ...item.timeEstimate!, hourlyRate: e.target.value })}
                                                  className="h-7 text-xs"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => updateItem(index, 'timeEstimate', { minHours: '', maxHours: '', hourlyRate: '' })}
                                            className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1"
                                          >
                                            <span>+</span> Zeitschätzung hinzufügen
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="mt-1.5 sm:mt-2 h-7 w-7 sm:h-8 sm:w-8"
                                    onClick={() => removeItem(index)}
                                    disabled={items.length === 1}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
                                  </Button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>

                  {/* Add Position Button - At Bottom */}
                  <div className="mt-4 pt-4 border-t border-dashed">
                    <Button size="sm" onClick={addItem} className="text-xs sm:text-sm h-8 sm:h-9">
                      <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                      Position hinzufügen
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Zahlungskondition */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm sm:text-base">Zahlungskondition</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    rows={3}
                    placeholder="z.B. Barzahlung nach der Ausführung"
                  />
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "Barzahlung nach der Ausführung", label: "Barzahlung" },
                      { value: "Zahlung innerhalb 10 Tagen netto", label: "10 Tage netto" },
                      { value: "50% Anzahlung, Rest bei Fertigstellung", label: "50% Anzahlung" },
                      { value: "Zahlung innerhalb 30 Tagen", label: "30 Tage" },
                      { value: "Zahlung per Rechnung innerhalb 30 Tagen", label: "Rechnung" },
                      { value: "Zahlung per TWINT nach der Ausführung", label: "TWINT" },
                      { value: "Zahlung per Kreditkarte nach der Ausführung", label: "Kreditkarte" },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setPaymentTerms(preset.value)}
                        className="px-3 py-1 text-xs rounded-full border border-slate-200 hover:bg-slate-100 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="md:col-span-2 lg:col-span-1 space-y-4 sm:space-y-6 order-1 md:order-2">
              {/* Mobile/Tablet: Horizontal layout for summary + actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-1 gap-4">
                {/* Hourly Rate Notice */}
                {items.some(item => item.unit === "Stunden") && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800">
                      <span className="font-medium">⏱️ Stundenarbeiten:</span>{" "}
                      Die angegebenen Stunden sind eine Schätzung. Die tatsächliche Arbeitszeit 
                      kann je nach Gegebenheiten vor Ort variieren.
                    </p>
                  </div>
                )}

                {/* Totals */}
                <Card>
                  <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                    <CardTitle className="text-sm sm:text-base">Zusammenfassung</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                    <div className="flex justify-between items-start text-xs sm:text-sm">
                      <span className="text-muted-foreground shrink-0">Zwischensumme</span>
                      {calculateMaxSubtotal() !== null ? (
                        <div className="text-right text-amber-700 font-medium leading-snug">
                          <div>{formatCurrency(calculateSubtotal())}</div>
                          <div className="text-[10px] text-amber-600">– {formatCurrency(calculateMaxSubtotal()!)}</div>
                        </div>
                      ) : (
                        <span>{formatCurrency(calculateSubtotal())}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={mwstEnabled}
                          onCheckedChange={setMwstEnabled}
                          className="scale-90 sm:scale-100"
                        />
                        <span className="text-xs sm:text-sm text-muted-foreground">MwSt.</span>
                      </div>
                      {mwstEnabled && (
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={vatRate}
                            onChange={(e) => setVatRate(Number(e.target.value))}
                            className="w-14 sm:w-20 text-right h-7 sm:h-9 text-xs sm:text-sm"
                          />
                          <span className="text-xs sm:text-sm">%</span>
                        </div>
                      )}
                    </div>

                    {mwstEnabled && (
                      <div className="flex justify-between items-start text-xs sm:text-sm">
                        <span className="text-muted-foreground shrink-0">MwSt. ({vatRate}%)</span>
                        {calculateMaxVat() !== null ? (
                          <div className="text-right text-amber-700 leading-snug">
                            <div>{formatCurrency(calculateVat())}</div>
                            <div className="text-[10px] text-amber-600">– {formatCurrency(calculateMaxVat()!)}</div>
                          </div>
                        ) : (
                          <span>{formatCurrency(calculateVat())}</span>
                        )}
                      </div>
                    )}

                    <Separator />

                    <div className="flex justify-between items-start text-base sm:text-lg font-bold">
                      <span className="shrink-0">Total</span>
                      {calculateMaxTotal() !== null ? (
                        <div className="text-right text-amber-700 leading-snug">
                          <div>{formatCurrency(calculateTotal())}</div>
                          <div className="text-sm font-semibold text-amber-600">– {formatCurrency(calculateMaxTotal()!)}</div>
                        </div>
                      ) : (
                        <span className="text-primary">{formatCurrency(calculateTotal())}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <Card>
                  <CardContent className="pt-4 sm:pt-6 space-y-2 sm:space-y-3 px-3 sm:px-6 pb-3 sm:pb-6">
                    <Button
                      className="w-full h-9 sm:h-10 text-xs sm:text-sm"
                      variant="outline"
                      onClick={() => handleSave(false)}
                      disabled={isSaving || isSpellChecking}
                    >
                      {isSaving || isSpellChecking ? (
                        <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                      )}
                      {isSpellChecking ? "Text wird geprüft..." : "Änderungen speichern"}
                    </Button>
                    <Button
                      className="w-full h-9 sm:h-10 text-xs sm:text-sm"
                      onClick={() => handleSave(true)}
                      disabled={isSaving || isSpellChecking}
                    >
                      {isSaving || isSpellChecking ? (
                        <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                      )}
                      {isSpellChecking ? "..." : "Speichern & erneut senden"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Spell Check Review Modal */}
        <SpellCheckModal
          open={spellCheckOpen}
          originalFields={spellCheckOriginal}
          correctedFields={spellCheckCorrected}
          onAccept={handleSpellCheckAccept}
          onKeepOriginal={handleSpellCheckKeepOriginal}
          onDismiss={handleSpellCheckDismiss}
        />
    </>
  );
};

export default FirmaOfferteBearbeiten;

