import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
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
  Languages,
} from "lucide-react";
import { LOCALES, LOCALE_NAMES, DEFAULT_LOCALE, toLocale, type Locale } from "@/i18n/locale";
import { useI18n, useT } from "@/i18n/useI18n";
import { getServiceLabel } from "@/i18n/domain";
import { formatCurrency as formatCurrencyI18n, formatPercent } from "@/i18n/format";
import { documentI18nFor } from "@/i18n/documentLocale";
import type { MessageKey } from "@/i18n/translator";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { SurchargeEditor } from "@/components/offerte/SurchargeEditor";
import {
  computeSurchargeAmount, surchargesTotal, withComputedAmounts, surchargesToJson, type OfferSurcharge,
} from "@/lib/offerSurcharges";
import { parseTimeEstimate } from "@/lib/offerTimeEstimate";
import type { Json } from "@/integrations/supabase/types";
import { applyDiscount, computeDiscountAmount, computeItemsSubtotal, isFreeItem, itemAmountDisplay, offerHasRateItem, toAmountBasis, type SubtotalItem } from "@/lib/offerPricing";
import { parsePriceModel, type PriceModel } from "@/lib/offerPriceModel";
import { cn } from "@/lib/utils";
import { getServiceOptions, groupItemsByService } from "@/lib/offerServiceType";
import { ServiceMetaFields } from "@/components/offerte/ServiceMetaFields";
import { metaKindForService, buildMetaPayload, metaPayloadToJson, seedMetaDraft, EMPTY_META_DRAFT, type GroupMetaDraft } from "@/lib/offerItemMeta";
import { OFFER_ITEMS_PDF_SELECT } from "@/lib/offerItemsPdfSelect";
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
  serviceType?: string | null; // multi-service clean base; null = Allgemein
  amount_basis?: string | null;   // preserve-only im Edit (kein Selektor hier; 3d = create-flow)
  kostendach_max?: number | null;
}

// Common unit options for offer items.
// The `value` is a CUSTOMER-facing snapshot: it is stored in offer_items.unit and printed
// on the PDF, so it stays unchanged. Only the operator's dropdown `labelKey` is localised.
const unitOptions: { value: string; labelKey: MessageKey }[] = [
  { value: "Pauschal", labelKey: "offer.form.unit.pauschal" },
  { value: "Stunden", labelKey: "offer.form.unit.stunden" },
  { value: "Stk.", labelKey: "offer.form.unit.stk" },
  { value: "m²", labelKey: "offer.form.unit.m2" },
  { value: "m³", labelKey: "offer.form.unit.m3" },
  { value: "lfm", labelKey: "offer.form.unit.lfm" },
  { value: "kg", labelKey: "offer.form.unit.kg" },
  { value: "Tag", labelKey: "offer.form.unit.tag" },
  { value: "Fahrt", labelKey: "offer.form.unit.fahrt" },
  { value: "Person", labelKey: "offer.form.unit.person" },
];

// Helper to infer price_type from unit and price for backward compatibility
const inferPriceType = (unit: string, unitPrice: number): string => {
  if (unit === "inkl." || unitPrice === 0) return "inkl";
  if (unit === "Stunden" || unit === "Stunde" || unit === "Std." || unit === "h") return "per_hour";
  if (unit === "Pauschal") return "pauschale";
  return "per_unit";
};

// PriceModel is the canonical union from @/lib/offerPriceModel (imported above).

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
  discount_percent?: number | null;
  /** DOCUMENT locale — frozen from the lead at creation, correctable here. */
  language?: string | null;
}

const generateItemId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const FirmaOfferteBearbeiten = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { offerId } = useParams<{ offerId: string }>();
  // Dashboard locale — the OPERATOR's chrome only. Everything the customer reads (payment
  // terms, item descriptions, PDF, e-mail) resolves `offerLanguage` instead, see below.
  const t = useT();
  const { locale } = useI18n();
  const serviceOptions = useMemo(() => getServiceOptions(locale), [locale]);

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
  // Kostendach-Eingabe-Einheit je Item (Std/CHF) — nur UI, gespeichert wird immer CHF.
  const [kdUnitById, setKdUnitById] = useState<Record<string, "std" | "chf">>({});
  // Per-service dates: one date per service group (invariant — copied to every item of
  // the group on save via replace_offer_items). Seeded from the loaded items.
  const [groupDates, setGroupDates] = useState<Record<string, { date: string; startTime: string; endTime: string }>>({});

  const serviceGroupKey = (serviceType: string | null | undefined): string => {
    const raw = (serviceType ?? "").trim().toLowerCase();
    return raw === "" ? "null" : raw;
  };

  const updateGroupDate = (key: string, field: "date" | "startTime" | "endTime", value: string) => {
    setGroupDates((prev) => ({
      ...prev,
      [key]: { date: "", startTime: "", endTime: "", ...prev[key], [field]: value },
    }));
  };

  // Per-group service meta (effort/area/volume) — seeded from the loaded items, attached
  // to the group's first billable item on save (replace_offer_items).
  const [groupMeta, setGroupMeta] = useState<Record<string, GroupMetaDraft>>({});
  const updateGroupMeta = (key: string, patch: Partial<GroupMetaDraft>) => {
    setGroupMeta((prev) => ({
      ...prev,
      [key]: { ...EMPTY_META_DRAFT, ...prev[key], ...patch },
    }));
    // Top-down: the group's Stundensatz fills each group item's pricing rate
    // (Zeitschätzung CHF/Std, or per_hour Preis/Einheit) so it isn't re-typed.
    if (patch.hourlyRate !== undefined && patch.hourlyRate.trim() !== "") {
      const rate = patch.hourlyRate;
      const n = Number(rate.replace(",", "."));
      setItems((prev) =>
        prev.map((it) => {
          if (serviceGroupKey(it.serviceType) !== key) return it;
          if (it.timeEstimate) return { ...it, timeEstimate: { ...it.timeEstimate, hourlyRate: rate } };
          if (it.price_type === "per_hour" && Number.isFinite(n)) return { ...it, unit_price: n };
          return it;
        }),
      );
    }
  };

  // Price model state
  const [priceModel, setPriceModel] = useState<PriceModel>('pauschal');
  const [discountPercent, setDiscountPercent] = useState<string>('');
  const [surcharges, setSurcharges] = useState<OfferSurcharge[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [hourlyRate, setHourlyRate] = useState<string>('');
  const [kostendachMax, setKostendachMax] = useState<string>('');
  const [briefLayout, setBriefLayout] = useState<boolean>(false);
  const [offerteType, setOfferteType] = useState<'normal' | 'blind'>('normal');

  // Offer-level Stundenansatz (Preismodell) — offer-wide top-down: fills every hourly
  // position (Zeitschätzung / per_hour) AND mirrors into each effort group's Service-Details
  // Stundensatz, so the single rate drives price and PDF badge alike.
  const applyGlobalHourlyRate = (value: string) => {
    setHourlyRate(value);
    if (value.trim() === "") return;
    const n = Number(value.replace(",", "."));
    setItems((prev) =>
      prev.map((it) => {
        if (it.timeEstimate) return { ...it, timeEstimate: { ...it.timeEstimate, hourlyRate: value } };
        if (it.price_type === "per_hour" && Number.isFinite(n)) return { ...it, unit_price: n };
        return it;
      }),
    );
    setGroupMeta((prev) => {
      const next = { ...prev };
      for (const it of items) {
        if (metaKindForService(it.serviceType) !== "effort") continue;
        const k = serviceGroupKey(it.serviceType);
        next[k] = { ...EMPTY_META_DRAFT, ...next[k], hourlyRate: value };
      }
      return next;
    });
  };

  // Payment terms — DOCUMENT content: this text is stored on the offer and printed on the
  // customer's PDF. It is therefore written in the CUSTOMER's language (offerLanguage), never
  // in the operator's dashboard language. Seeded in fetchData below.
  const [paymentTerms, setPaymentTerms] = useState("");

  // Spell check state
  const [isSpellChecking, setIsSpellChecking] = useState(false);
  const [spellCheckOpen, setSpellCheckOpen] = useState(false);
  const [spellCheckOriginal, setSpellCheckOriginal] = useState<SpellCheckFields>({});
  const [spellCheckCorrected, setSpellCheckCorrected] = useState<SpellCheckFields>({});
  const pendingSpellSaveRef = useRef<boolean>(false);
  // Ref to handleSave — lets spell-check callbacks call it without causing a TDZ error
  const handleSaveRef = useRef<(sendAfterSave?: boolean) => void>(() => {});

  // DOCUMENT locale of this offer — the language the CUSTOMER is addressed in (PDF, e-mail,
  // public token page). Independent of the operator's dashboard language.
  const [offerLanguage, setOfferLanguage] = useState<Locale>(DEFAULT_LOCALE);
  // Translator for text that is WRITTEN INTO the offer (payment terms) — resolves the
  // customer's language, never the operator's. Deliberately NOT useT().
  const documentT = documentI18nFor(offerLanguage).t;

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
            title: t("common.error"),
            description: t("offer.detail.toast.notFound"),
            variant: "destructive",
          });
          navigate("/firma/offerten");
          return;
        }

        // Accepted or rejected offers cannot be edited
        if (["accepted", "rejected"].includes(offerData.status)) {
          toast({
            title: t("offer.edit.toast.locked.title"),
            description: offerData.status === "accepted"
              ? t("offer.edit.toast.locked.accepted")
              : t("offer.edit.toast.locked.rejected"),
            variant: "destructive",
          });
          navigate(`/firma/offerten/${offerId}`);
          return;
        }

        // Price model — narrow the DB `string` at this A→D boundary. The DB CHECK
        // constraint guarantees validity; parse defensively instead of casting or
        // silently defaulting to 'pauschal'. An out-of-range value is a data-integrity
        // problem, so fail closed rather than edit an offer under the wrong model.
        const parsedPriceModel = parsePriceModel(offerData.price_model);
        if (!parsedPriceModel.ok) {
          toast({
            title: t("common.error"),
            description: t("offer.edit.toast.loadFailed"),
            variant: "destructive",
          });
          navigate("/firma/offerten");
          return;
        }

        // Narrow the only view-model-incompatible column: price_model (Row string → PriceModel),
        // validated fail-closed just above. Every other Row column is compatible with Offer.
        setOffer({ ...offerData, price_model: parsedPriceModel.value });
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
        const offerLocale = toLocale(offerData.language);
        setOfferLanguage(offerLocale);
        // Document locale, not dashboard locale: an offer without stored terms falls back to
        // the default payment condition IN THE CUSTOMER'S LANGUAGE.
        setPaymentTerms(
          offerData.payment_terms
            ? String(offerData.payment_terms)
            : documentI18nFor(offerLocale).t("offer.doc.payment.cash"),
        );
        setPriceModel(parsedPriceModel.value);
        setDiscountPercent(offerData.discount_percent !== null && offerData.discount_percent !== undefined ? String(offerData.discount_percent) : '');
        if (offerData.hourly_rate !== null && offerData.hourly_rate !== undefined) setHourlyRate(String(offerData.hourly_rate));
        if (offerData.kostendach_max !== null && offerData.kostendach_max !== undefined) setKostendachMax(String(offerData.kostendach_max));
        setBriefLayout(offerData.brief_layout ?? false);
        const ot = offerData.offerte_type;
        setOfferteType(ot === 'blind' ? 'blind' : 'normal');
        setSurcharges(Array.isArray(offerData.surcharges) ? (offerData.surcharges as unknown as OfferSurcharge[]) : []);
        setDistanceKm(offerData.moving_distance_km ?? null);

        // Get offer items
        const { data: itemsData, error: itemsError } = await supabase
          .from("offer_items")
          .select(OFFER_ITEMS_PDF_SELECT)
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
              // time_estimate is a raw Json column → narrow with the canonical parser before
              // reading its numeric fields (the form keeps them as strings).
              timeEstimate: (() => {
                const te = parseTimeEstimate(item.time_estimate);
                return te ? { minHours: String(te.minHours), maxHours: String(te.maxHours), hourlyRate: String(te.hourlyRate) } : null;
              })(),
              // PRESERVE: the loaded item keeps its own stamp (old/null items stay Allgemein)
              serviceType: item.service_type ?? null,
              // PRESERVE (delete+insert RPC trap): ohne Mitschicken wuerde amount_basis auf
              // 'fixed' zurueckfallen. Kein Selektor im Edit — nur bewahren.
              amount_basis: item.amount_basis ?? null,
              kostendach_max: item.kostendach_max ?? null,
            }))
          );
          // Seed per-group dates from the first item of each group (the invariant
          // guarantees all items of a group carry the same values).
          const seeded: Record<string, { date: string; startTime: string; endTime: string }> = {};
          for (const item of itemsData) {
            const raw = (item.service_type ?? "").trim().toLowerCase();
            const k = raw === "" ? "null" : raw;
            if (!seeded[k] && (item.scheduled_date || item.scheduled_start_time || item.scheduled_end_time)) {
              seeded[k] = {
                date: item.scheduled_date ?? "",
                startTime: (item.scheduled_start_time ?? "").slice(0, 5),
                endTime: (item.scheduled_end_time ?? "").slice(0, 5),
              };
            }
          }
          setGroupDates(seeded);

          // Seed per-group service meta from the first item of each group that carries a
          // meta row (invariant: only the group's first billable item holds it). For effort
          // groups WITHOUT a meta row yet (all pre-feature offers), derive the Stundensatz
          // from the item's pricing rate (Zeitschätzung CHF/Std, or per_hour Preis/Einheit)
          // so the badge pre-fills and the rate isn't re-typed.
          const seededMeta: Record<string, GroupMetaDraft> = {};
          for (const item of itemsData as unknown as Array<{
            service_type: string | null;
            effort_meta: Parameters<typeof seedMetaDraft>[0];
            volume_meta: Parameters<typeof seedMetaDraft>[1];
            area_meta: Parameters<typeof seedMetaDraft>[2];
            time_estimate: { hourlyRate?: number | string | null } | null;
            price_type: string | null;
            unit_price: number | null;
          }>) {
            const raw = (item.service_type ?? "").trim().toLowerCase();
            const k = raw === "" ? "null" : raw;
            if (seededMeta[k]) continue;
            let draft =
              item.effort_meta || item.volume_meta || item.area_meta
                ? seedMetaDraft(item.effort_meta, item.volume_meta, item.area_meta)
                : null;
            if (metaKindForService(item.service_type) === "effort" && !draft?.hourlyRate?.trim()) {
              const priced = item.time_estimate?.hourlyRate ?? (item.price_type === "per_hour" ? item.unit_price : null);
              if (priced !== null && priced !== undefined && String(priced) !== "") {
                draft = { ...(draft ?? EMPTY_META_DRAFT), hourlyRate: String(priced) };
              }
            }
            if (draft) seededMeta[k] = draft;
          }
          setGroupMeta(seededMeta);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: t("common.error"),
          description: t("offer.edit.toast.loadFailed"),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, offerId, navigate, toast, t]);

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
        // In edit mode there is no access to lead/primary service_type → null (Allgemein). To be resolved with the Phase 4 picker.
        serviceType: null,
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
        let v = value;
        // A freshly added Zeitschätzung inherits the known Stundensatz (global Preismodell
        // rate, else the group's Service-Details rate). Without this the top-down fill only
        // works for fields that already exist when the rate is typed — ordering trap.
        if (field === "timeEstimate" && v && typeof v === "object" && !(v as ItemTimeEstimate).hourlyRate) {
          const seed =
            (priceModel === "stundenansatz" || priceModel === "kostendach") && hourlyRate.trim() !== ""
              ? hourlyRate
              : groupMeta[serviceGroupKey(prev[index]?.serviceType)]?.hourlyRate ?? "";
          if (seed.trim() !== "") v = { ...(v as ItemTimeEstimate), hourlyRate: seed };
        }
        newItems[index] = { ...newItems[index], [field]: v };
        return newItems;
      });
    },
    [priceModel, hourlyRate, groupMeta]
  );

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const reorderedItems = Array.from(items);
    const [removed] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, removed);

    setItems(reorderedItems.map((item, i) => ({ ...item, position: i + 1 })));
  };

  // Convert the form item shape into the helper's SubtotalItem. Exclusion is now SEMANTIC
  // via price_type (the old unit==="inkl." string guard was removed → optional is also excluded).
  const toSubtotalItems = (): SubtotalItem[] =>
    items.map((item) => ({
      priceType: item.price_type ?? "",
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      timeEstimate: item.timeEstimate
        ? {
            minHours: parseFloat(item.timeEstimate.minHours),
            maxHours: parseFloat(item.timeEstimate.maxHours),
            hourlyRate: parseFloat(item.timeEstimate.hourlyRate),
          }
        : null,
      amountBasis: toAmountBasis(item.amount_basis),
    }));

  const calculateSubtotal = () => computeItemsSubtotal(toSubtotalItems(), "min");

  // Blind/Stunden-Spanne (nur fixed+range). rate-Posten → gar keine Aggregatsumme (Box ausgeblendet).
  const calculateMaxSubtotal = (): number | null => {
    const hasAny = items.some(i => i.timeEstimate && i.timeEstimate.maxHours && i.timeEstimate.hourlyRate);
    if (!hasAny) return null;
    return computeItemsSubtotal(toSubtotalItems(), "max");
  };

  const hasRateItem = () => offerHasRateItem(toSubtotalItems());

  // Steuerbare Basis = Positionen + Zuschläge → offers.subtotal (GENERATED vat/total).
  // #7: Rabatt is now editable in the form (single parse source, like OfferteErstellen).
  const effectiveDiscountPercent = discountPercent.trim() !== "" ? Number(discountPercent) : null;

  const calculateTaxableBase = () =>
    calculateSubtotal() + surchargesTotal(surcharges, calculateSubtotal(), distanceKm);


  // P3b-2b: MwSt/Total im Live-Preview rechnen ab der RABATTIERTEN Basis — exakt das, was
  // der Save-Flow (P3b-1) nach offers.subtotal schreibt. Die Zwischensumme bleibt ROH;
  // die sichtbare Rabatt-Zeile folgt in P3b-2c.
  const calculateDiscountedBase = () => applyDiscount(calculateTaxableBase(), effectiveDiscountPercent);

  const calculateVat = () => {
    if (!mwstEnabled) return 0;
    return calculateDiscountedBase() * (vatRate / 100);
  };

  const calculateMaxTaxableBase = (): number | null => {
    const maxSub = calculateMaxSubtotal();
    if (maxSub === null) return null;
    return maxSub + surchargesTotal(surcharges, maxSub, distanceKm);
  };

  const calculateMaxDiscountedBase = (): number | null => {
    const maxBase = calculateMaxTaxableBase();
    return maxBase === null ? null : applyDiscount(maxBase, effectiveDiscountPercent);
  };

  const calculateMaxVat = (): number | null => {
    const maxBase = calculateMaxDiscountedBase();
    if (maxBase === null || !mwstEnabled) return null;
    return maxBase * (vatRate / 100);
  };

  const calculateTotal = () => calculateDiscountedBase() + calculateVat();

  const calculateMaxTotal = (): number | null => {
    const maxBase = calculateMaxDiscountedBase();
    if (maxBase === null) return null;
    return maxBase + (calculateMaxVat() ?? 0);
  };

  // Dashboard locale — these amounts are shown to the operator in the form's live summary.
  const formatCurrency = (amount: number) => formatCurrencyI18n(amount, locale);


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
        title: t("common.error"),
        description: t("offer.form.toast.titleRequired"),
        variant: "destructive",
      });
      return;
    }

    if (items.some((item) => !item.description.trim())) {
      toast({
        title: t("common.error"),
        description: t("offer.form.toast.itemsIncomplete"),
        variant: "destructive",
      });
      return;
    }

    if (priceModel === 'stundenansatz' || priceModel === 'kostendach') {
      if (!hourlyRate || Number(hourlyRate) <= 0) {
        toast({
          title: t("common.error"),
          description: t("offer.form.toast.hourlyRateRequired"),
          variant: "destructive",
        });
        return;
      }
    }

    if (priceModel === 'kostendach') {
      if (!kostendachMax || Number(kostendachMax) <= 0) {
        toast({
          title: t("common.error"),
          description: t("offer.form.toast.kostendachRequired"),
          variant: "destructive",
        });
        return;
      }
      if (Number(kostendachMax) < Number(hourlyRate)) {
        toast({
          title: t("common.error"),
          description: t("offer.form.toast.kostendachTooLow"),
          variant: "destructive",
        });
        return;
      }
    }

    // Blind Offerte — per-item time estimate validation
    for (const item of items) {
      const te = item.timeEstimate;
      if (!te) continue;
      const itemLabel = item.description || t("offer.form.toast.itemFallback");
      if (!te.minHours || !te.maxHours || !te.hourlyRate) {
        toast({
          title: t("common.error"),
          description: t("offer.form.toast.timeEstimateIncomplete", { item: itemLabel }),
          variant: "destructive",
        });
        return;
      }
      if (parseFloat(te.maxHours) < parseFloat(te.minHours)) {
        toast({
          title: t("common.error"),
          description: t("offer.form.toast.timeEstimateInvalid", { item: itemLabel }),
          variant: "destructive",
        });
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
      const itemsSubtotal = calculateSubtotal();
      const computedSurcharges = withComputedAmounts(surcharges, itemsSubtotal, distanceKm);
      // Steuerbare Basis = Positionen + Zuschläge. P3b-1: rabattierte Basis schreiben —
      // GENERATED vat_amount/total leiten sich automatisch ab. discount_percent kommt aus der
      // geladenen Offerte (Edit-Formularfeld existiert noch nicht, F1c) und wird im Update-
      // Payload bewusst NICHT mitgeschickt → der DB-Wert bleibt erhalten.
      const taxableBase = itemsSubtotal + surchargesTotal(surcharges, itemsSubtotal, distanceKm);
      const subtotal = applyDiscount(taxableBase, effectiveDiscountPercent);

      // Update offer — TOCTOU guard (#2): the accepted/rejected block at LOAD isn't enough.
      // If the customer accepts between load and save, this header UPDATE must NOT mutate
      // the financials of an already-accepted offer (whose Auftrag snapshot is frozen).
      // Conditional update: only draft/sent/viewed; 0 rows → offer went terminal → abort
      // BEFORE replace_offer_items (which has its own guard) can cause a partial write.
      const { data: updatedRows, error: offerError } = await supabase
        .from("offers")
        .update({
          customer_first_name: customerFirstName,
          customer_last_name: customerLastName,
          customer_email: customerEmail,
          customer_phone: customerPhone || null,
          // DOCUMENT locale — drives PDF + e-mail rendering for this offer and is inherited
          // by every document created from it (Auftrag, Rechnung, Quittung, Termin).
          language: offerLanguage,
          title,
          description: description || null,
          service_date: serviceDate || null,
          valid_until: validUntil || null,
          subtotal,
          surcharges: surchargesToJson(computedSurcharges),
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
          discount_percent: effectiveDiscountPercent,
        })
        .eq("id", offerId)
        .in("status", ["draft", "sent", "viewed"])
        .select("id");

      if (offerError) throw offerError;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(t("offer.edit.toast.wentTerminal"));
      }

      // Atomic replace via RPC — delete + insert in a single transaction
      // Prevents orphan state if insert fails after delete
      // Meta attaches to the FIRST billable item of each service group (matches the PDF).
      const firstBillableIdByGroup = new Map<string, string>();
      for (const it of items) {
        if (isFreeItem(it.price_type)) continue;
        const gk = serviceGroupKey(it.serviceType);
        if (!firstBillableIdByGroup.has(gk)) firstBillableIdByGroup.set(gk, it.id);
      }

      const itemsPayload = items.map((item): Json => {
        const te = item.timeEstimate;
        const teValid = te && te.minHours && te.maxHours && te.hourlyRate;
        const gk = serviceGroupKey(item.serviceType);
        const metaPayload = firstBillableIdByGroup.get(gk) === item.id
          ? metaPayloadToJson(buildMetaPayload(metaKindForService(item.serviceType), groupMeta[gk]))
          : {};
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
          service_type: item.serviceType ?? null,
          // Per-service date — replace_offer_items writes these columns; without them
          // every edit would silently reset the dates (delete+insert RPC trap).
          scheduled_date: groupDates[serviceGroupKey(item.serviceType)]?.date || null,
          scheduled_start_time: groupDates[serviceGroupKey(item.serviceType)]?.startTime || null,
          scheduled_end_time: groupDates[serviceGroupKey(item.serviceType)]?.endTime || null,
          amount_basis: item.amount_basis ?? "fixed",
          kostendach_max: item.kostendach_max ?? null,
          ...metaPayload,
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
            title: t("offer.list.toast.sent.title"),
            description: t("offer.edit.toast.sent.description"),
          });
        } else {
          toast({
            title: t("offer.create.toast.saved.title"),
            description: t("offer.create.toast.sendFailed.description", {
              error: result.error ?? t("offer.create.toast.sendFailed.genericError"),
            }),
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: t("offer.create.toast.saved.title"),
          description: t("offer.edit.toast.saved.description"),
        });
      }

      navigate("/firma/offerten");
    } catch (error: unknown) {
      console.error("Save error:", error);
      toast({
        title: t("offer.edit.toast.saveFailed.title"),
        description: error instanceof Error ? error.message : t("offer.form.toast.saveFailed"),
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
          <p className="text-muted-foreground">{t("offer.detail.notFound.title")}</p>
          <Button className="mt-4" onClick={() => navigate("/firma/offerten")}>
            {t("offer.detail.back")}
          </Button>
        </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t("offer.edit.pageTitle")}</title>
      </Helmet>
        <div className="space-y-4 sm:space-y-6">
          {/* Folk-style header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/firma/offerten")}
              className="h-9 w-9 shrink-0 rounded-md text-folk-ink3 hover:bg-folk-bg-warm hover:text-folk-ink2"
              aria-label={t("common.back")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-2xl leading-none">📄</span>
                <h1 className="text-xl font-bold tracking-tight text-folk-ink sm:text-2xl">{t("offer.edit.title")}</h1>
              </div>
              <p className="mt-1 text-[15px] text-folk-ink2">
                {t("offer.edit.for")} <span className="font-semibold text-folk-ink">{customerFirstName} {customerLastName}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={isSaving || isSpellChecking}
                className="h-9 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-[15px] font-medium text-folk-ink2 hover:bg-folk-bg-warm"
              >
                {isSaving || isSpellChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isSpellChecking ? t("offer.form.spellChecking") : t("common.save")}</span>
                <span className="sm:hidden">{isSpellChecking ? "…" : t("common.save")}</span>
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={isSaving || isSpellChecking}
                className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
              >
                {isSaving || isSpellChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isSpellChecking ? t("offer.form.spellChecking") : t("offer.edit.saveAndSend")}</span>
                <span className="sm:hidden">{isSpellChecking ? "…" : t("common.send")}</span>
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
                    {t("offer.form.customer.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">{t("common.firstName")}</Label>
                      <Input
                        value={customerFirstName}
                        onChange={(e) => setCustomerFirstName(e.target.value)}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">{t("common.lastName")}</Label>
                      <Input
                        value={customerLastName}
                        onChange={(e) => setCustomerLastName(e.target.value)}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">{t("common.email")}</Label>
                      <Input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">{t("common.phone")}</Label>
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                  </div>

                  {/* DOCUMENT locale — the VALUE stays the customer's language (offerLanguage);
                      only the surrounding chrome (label, hint) is operator-facing. */}
                  <div className="space-y-1">
                    <Label htmlFor="offer-language" className="flex items-center gap-1.5 text-xs sm:text-sm">
                      <Languages className="h-3.5 w-3.5" />
                      {t("offer.form.customerLanguage.label")}
                    </Label>
                    <Select
                      value={offerLanguage}
                      onValueChange={(v) => setOfferLanguage(toLocale(v))}
                    >
                      <SelectTrigger id="offer-language" className="h-9 sm:h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCALES.map((locale) => (
                          <SelectItem key={locale} value={locale}>
                            {LOCALE_NAMES[locale]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t("offer.form.customerLanguage.hint")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Offer Details */}
              <Card>
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base">{t("offer.form.details.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">{t("offer.form.field.title")}</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t("offer.form.placeholder.title")}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">{t("common.description")}</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("offer.form.placeholder.description")}
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">{t("offer.form.field.serviceDate")}</Label>
                      <DateInputCH
                        value={serviceDate}
                        onChange={setServiceDate}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs sm:text-sm">{t("offer.form.field.validUntil")}</Label>
                        {validUntil && (
                          <button
                            type="button"
                            onClick={() => setValidUntil("")}
                            className="text-[10px] text-muted-foreground hover:text-destructive"
                          >
                            {t("common.remove")}
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
                          {t("offer.form.validUntil.add")}
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Preismodell */}
              <Card>
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base">{t("offer.form.priceModel.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        { value: 'pauschal', labelKey: 'offer.form.priceModel.pauschal' },
                        { value: 'stundenansatz', labelKey: 'domain.priceModel.stundenansatz' },
                        { value: 'kostendach', labelKey: 'offer.form.priceModel.kostendach' },
                      ] as const satisfies readonly { value: PriceModel; labelKey: MessageKey }[]
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
                        {t(opt.labelKey)}
                      </button>
                    ))}
                  </div>

                  {/* Offer-level Rabatt (%) — editable (#7: was missing in edit) */}
                  <div className="space-y-1 pt-1 sm:max-w-[50%]">
                    <Label className="text-xs sm:text-sm">{t("offer.form.field.discount")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      placeholder={t("offer.form.placeholder.discount")}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>

                  {(priceModel === 'stundenansatz' || priceModel === 'kostendach') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
                      <div className="space-y-1">
                        <Label className="text-xs sm:text-sm">{t("offer.form.field.hourlyRate")}</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={hourlyRate}
                          onChange={(e) => applyGlobalHourlyRate(e.target.value)}
                          placeholder={t("offer.form.placeholder.hourlyRate")}
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                      {priceModel === 'kostendach' && (
                        <div className="space-y-1">
                          <Label className="text-xs sm:text-sm">{t("offer.form.field.kostendach")}</Label>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={kostendachMax}
                            onChange={(e) => setKostendachMax(e.target.value)}
                            placeholder={t("offer.form.placeholder.kostendach")}
                            className="h-9 sm:h-10 text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            {t("offer.form.kostendach.hint")}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Zuschläge */}
              <Card>
                <CardContent className="px-3 sm:px-6 py-3 sm:py-4">
                  <SurchargeEditor
                    surcharges={surcharges}
                    onChange={setSurcharges}
                    itemsSubtotal={calculateSubtotal()}
                    distanceKm={distanceKm}
                    documentLocale={offerLanguage}
                  />
                </CardContent>
              </Card>

              {/* Offerte-Art: Normal / Blind */}
              <Card>
                <CardContent className="px-3 sm:px-6 py-3 sm:py-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Label className="text-sm font-medium">{t("offer.form.offerType.title")}</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: 'normal', labelKey: 'offer.form.offerType.normal', subKey: 'offer.form.offerType.normalHint' },
                        { value: 'blind', labelKey: 'offer.form.offerType.blind', subKey: 'offer.form.offerType.blindHint' },
                      ] as const satisfies readonly { value: 'normal' | 'blind'; labelKey: MessageKey; subKey: MessageKey }[]
                    ).map(({ value, labelKey, subKey }) => (
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
                        <p className="text-xs font-semibold">{t(labelKey)}</p>
                        <p className="text-[10px] mt-0.5">{t(subKey)}</p>
                      </button>
                    ))}
                  </div>
                  {offerteType === 'blind' && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      {t("offer.form.offerType.blindNote")}
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
                        {t("offer.form.brief.label")}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t("offer.form.brief.hint")}
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
                  <CardTitle className="text-sm sm:text-base">{t("offer.detail.positions")}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  {(() => {
                    const groups = groupItemsByService(items.map((it) => ({ ...it, service_type: it.serviceType ?? null })));
                    if (groups.length < 2) return null;
                    return (
                      <div className="mb-4 rounded-lg border border-dashed p-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("offer.form.groupDates.title")}</p>
                        {groups.map((g) => {
                          const k = g.serviceType ?? "null";
                          return (
                            <div key={k} className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-medium w-24 shrink-0">{getServiceLabel(g.serviceType, locale)}</span>
                              <DatePicker value={groupDates[k]?.date ?? ""} onChange={(value) => updateGroupDate(k, "date", value)} className="h-7 w-[8.5rem] text-xs" />
                              <Input type="time" value={groupDates[k]?.startTime ?? ""} onChange={(e) => updateGroupDate(k, "startTime", e.target.value)} className="h-7 w-[5.5rem] text-xs" />
                              <span className="text-[10px] text-muted-foreground">–</span>
                              <Input type="time" value={groupDates[k]?.endTime ?? ""} onChange={(e) => updateGroupDate(k, "endTime", e.target.value)} className="h-7 w-[5.5rem] text-xs" />
                            </div>
                          );
                        })}
                        <p className="text-[10px] text-muted-foreground">{t("offer.form.groupDates.hint")}</p>
                      </div>
                    );
                  })()}
                  {(() => {
                    const groups = groupItemsByService(items.map((it) => ({ ...it, service_type: it.serviceType ?? null })))
                      .filter((g) => metaKindForService(g.serviceType) !== null);
                    if (groups.length === 0) return null;
                    return (
                      <div className="mb-4 rounded-lg border border-dashed p-3 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("offer.form.serviceMeta.title")}</p>
                        {groups.map((g) => {
                          const k = g.serviceType ?? "null";
                          const metaKind = metaKindForService(g.serviceType)!;
                          return (
                            <div key={k} className="space-y-1.5">
                              <span className="text-xs font-medium">{getServiceLabel(g.serviceType, locale)}</span>
                              <ServiceMetaFields
                                kind={metaKind}
                                draft={groupMeta[k] ?? EMPTY_META_DRAFT}
                                onChange={(patch) => updateGroupMeta(k, patch)}
                                idPrefix={`meta-edit-${k}`}
                              />
                            </div>
                          );
                        })}
                        <p className="text-[10px] text-muted-foreground">{t("offer.form.serviceMeta.hint")}</p>
                      </div>
                    );
                  })()}
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
                                      <Label className="text-xs sm:text-sm">{t("common.description")}</Label>
                                      <Textarea
                                        value={item.description}
                                        onChange={(e) =>
                                          updateItem(index, "description", e.target.value)
                                        }
                                        placeholder={t("offer.form.item.descriptionPlaceholder")}
                                        rows={2}
                                        className="text-sm"
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-xs sm:text-sm">{t("common.quantity")}</Label>
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
                                        <Label className="text-xs sm:text-sm">{t("common.unit")}</Label>
                                        <Select
                                          value={item.unit}
                                          onValueChange={(value) =>
                                            updateItem(index, "unit", value)
                                          }
                                        >
                                          <SelectTrigger className="h-8 sm:h-10 text-sm">
                                            <SelectValue placeholder={t("common.unit")} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {unitOptions.map((option) => (
                                              <SelectItem key={option.value} value={option.value}>
                                                {t(option.labelKey)}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs sm:text-sm">{t("offer.form.item.unitPrice")}</Label>
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
                                          <Label className="text-xs sm:text-sm text-muted-foreground">{t("common.total")}</Label>
                                          {(() => {
                                            const te = item.timeEstimate;
                                            const disp = itemAmountDisplay({
                                              priceType: item.price_type ?? "",
                                              amountBasis: toAmountBasis(item.amount_basis),
                                              quantity: Number(item.quantity),
                                              unitPrice: Number(item.unit_price),
                                              unit: item.unit,
                                              timeEstimate: te && te.minHours && te.maxHours && te.hourlyRate
                                                ? { minHours: Number(te.minHours), maxHours: Number(te.maxHours), hourlyRate: Number(te.hourlyRate) }
                                                : null,
                                            });
                                            if (disp.kind === "range") return (
                                              <p className="font-semibold text-sm sm:text-base text-amber-700">
                                                {formatCurrency(disp.min)}{' –'}<br className="sm:hidden" />{' '}{formatCurrency(disp.max)}
                                              </p>
                                            );
                                            if (disp.kind === "rate") return (
                                              <p className="font-semibold text-sm sm:text-base">
                                                {t("offer.detail.perUnit", { amount: formatCurrency(disp.unitPrice), unit: disp.unit })}
                                              </p>
                                            );
                                            return (
                                              <p className="font-semibold text-sm sm:text-base">
                                                {formatCurrency(disp.kind === "fixed" ? disp.amount : item.quantity * item.unit_price)}
                                              </p>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    </div>

                                    {item.price_type !== "inkl" && item.price_type !== "optional" && (
                                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                        <div className="space-y-1">
                                          <Label className="text-xs sm:text-sm">{t("offer.form.item.amountBasis")}</Label>
                                          <Select
                                            value={item.amount_basis ?? "fixed"}
                                            onValueChange={(v) => updateItem(index, "amount_basis", v)}
                                          >
                                            <SelectTrigger className="h-8 sm:h-10 text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="fixed">{t("offer.form.amountBasis.fixed")}</SelectItem>
                                              <SelectItem value="rate">{t("offer.form.amountBasis.rate")}</SelectItem>
                                              <SelectItem value="range">{t("offer.form.amountBasis.range")}</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        {item.amount_basis === "rate" && (() => {
                                          const kdUnit = kdUnitById[item.id] ?? "std";
                                          const c = item.kostendach_max;
                                          const kdVal = (c === null || c === undefined)
                                            ? ""
                                            : (kdUnit === "std" && item.unit_price > 0 ? String(+(c / item.unit_price).toFixed(2)) : String(c));
                                          return (
                                          <div className="space-y-1">
                                            <Label className="text-xs sm:text-sm">{t("offer.form.item.kostendach")}</Label>
                                            <div className="flex gap-2 items-center">
                                              <Input
                                                type="text"
                                                inputMode="decimal"
                                                value={kdVal}
                                                onChange={(e) => {
                                                  const raw = e.target.value;
                                                  const v = parseFloat(raw.replace(",", "."));
                                                  if (raw.trim() === "" || !isFinite(v) || v < 0) { updateItem(index, "kostendach_max", null); return; }
                                                  const chf = kdUnit === "std" ? (item.unit_price > 0 ? v * item.unit_price : 0) : v;
                                                  updateItem(index, "kostendach_max", Math.round(chf * 100) / 100);
                                                }}
                                                onFocus={(e) => e.target.select()}
                                                placeholder={kdUnit === "std"
                                                  ? t("offer.form.item.kostendachPlaceholderHours")
                                                  : t("offer.form.item.kostendachPlaceholderChf")}
                                                className="h-8 sm:h-10 text-sm flex-1"
                                              />
                                              <div className="flex rounded-md border overflow-hidden text-xs shrink-0">
                                                {(["std", "chf"] as const).map((u) => (
                                                  <button key={u} type="button"
                                                    onClick={() => setKdUnitById((p) => ({ ...p, [item.id]: u }))}
                                                    className={cn("px-2.5 py-1.5", kdUnit === u ? "bg-secondary text-secondary-foreground" : "bg-background text-muted-foreground")}
                                                  >{u === "std" ? t("offer.form.item.kdUnitHours") : "CHF"}</button>
                                                ))}
                                              </div>
                                            </div>
                                            {(c ?? null) !== null && (
                                              <p className="text-[10px] text-muted-foreground">
                                                {item.unit_price > 0
                                                  ? t("offer.form.item.kostendachHint", {
                                                      amount: formatCurrency(Number(c)),
                                                      hours: +(Number(c) / item.unit_price).toFixed(2),
                                                      rate: formatCurrency(item.unit_price),
                                                    })
                                                  : t("offer.form.item.kostendachHintPlain", {
                                                      amount: formatCurrency(Number(c)),
                                                    })}
                                              </p>
                                            )}
                                          </div>
                                          );
                                        })()}
                                      </div>
                                    )}

                                    <div className="space-y-1">
                                      <Label className="text-xs sm:text-sm">{t("offer.form.item.serviceGroup")}</Label>
                                      <Select
                                        value={item.serviceType ?? "allgemein"}
                                        onValueChange={(v) =>
                                          updateItem(index, "serviceType", v === "allgemein" ? null : v)
                                        }
                                      >
                                        <SelectTrigger className="h-8 sm:h-10 text-sm">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {serviceOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {getServiceLabel(option.value, locale)}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {/* Blind Offerte — per-item Zeitschätzung */}
                                    {offerteType === 'blind' && (
                                      <div className="mt-2 border-t border-amber-100 pt-2">
                                        {item.timeEstimate ? (
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-medium text-amber-700">⏱ {t("offer.form.timeEstimate.title")}</span>
                                              <button
                                                type="button"
                                                onClick={() => updateItem(index, 'timeEstimate', null)}
                                                className="text-xs text-muted-foreground hover:text-destructive"
                                              >
                                                {t("common.remove")}
                                              </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                              <div>
                                                <Label className="text-[10px] text-muted-foreground">{t("offer.form.timeEstimate.minHours")}</Label>
                                                <Input
                                                  type="number" min={1} step={1} placeholder="7"
                                                  value={item.timeEstimate.minHours}
                                                  onChange={(e) => updateItem(index, 'timeEstimate', { ...item.timeEstimate!, minHours: e.target.value })}
                                                  className="h-7 text-xs"
                                                />
                                              </div>
                                              <div>
                                                <Label className="text-[10px] text-muted-foreground">{t("offer.form.timeEstimate.maxHours")}</Label>
                                                <Input
                                                  type="number" min={1} step={1} placeholder="9"
                                                  value={item.timeEstimate.maxHours}
                                                  onChange={(e) => updateItem(index, 'timeEstimate', { ...item.timeEstimate!, maxHours: e.target.value })}
                                                  className="h-7 text-xs"
                                                />
                                              </div>
                                              <div>
                                                <Label className="text-[10px] text-muted-foreground">{t("offer.form.timeEstimate.hourlyRate")}</Label>
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
                                            <span>+</span> {t("offer.form.timeEstimate.add")}
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
                      {t("offer.form.items.add")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Zahlungskondition */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm sm:text-base">{t("offer.form.payment.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    rows={3}
                    placeholder={t("offer.form.payment.placeholder")}
                  />
                  {/* Chip LABEL = operator (t); chip VALUE = the text written into the offer and
                      printed on the customer's PDF → customer's language (documentT). */}
                  <div className="flex flex-wrap gap-2">
                    {([
                      { valueKey: "offer.doc.payment.cash", labelKey: "offer.form.payment.quick.cash" },
                      { valueKey: "offer.doc.payment.net10", labelKey: "offer.form.payment.quick.net10" },
                      { valueKey: "offer.doc.payment.deposit50", labelKey: "offer.form.payment.quick.deposit50" },
                      { valueKey: "offer.doc.payment.net30", labelKey: "offer.form.payment.quick.net30" },
                      { valueKey: "offer.doc.payment.invoice", labelKey: "offer.form.payment.quick.invoice" },
                      { valueKey: "offer.doc.payment.twint", labelKey: "offer.form.payment.quick.twint" },
                      { valueKey: "offer.doc.payment.card", labelKey: "offer.form.payment.quick.card" },
                    ] as const satisfies readonly { valueKey: MessageKey; labelKey: MessageKey }[]).map((preset) => (
                      <button
                        key={preset.valueKey}
                        type="button"
                        onClick={() => setPaymentTerms(documentT(preset.valueKey))}
                        className="px-3 py-1 text-xs rounded-full border border-slate-200 hover:bg-slate-100 transition-colors"
                      >
                        {t(preset.labelKey)}
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
                      <span className="font-medium">⏱️ {t("offer.form.hourlyNotice.label")}</span>{" "}
                      {t("offer.form.hourlyNotice.text")}
                    </p>
                  </div>
                )}

                {/* Totals */}
                <Card>
                  <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                    <CardTitle className="text-sm sm:text-base">{t("offer.form.summary.title")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                    {hasRateItem() ? (
                      <div className="text-sm text-muted-foreground leading-snug">
                        {t("doc.offer.rateAggregateNote")}
                      </div>
                    ) : (
                    <>
                    <div className="flex justify-between items-start text-xs sm:text-sm">
                      <span className="text-muted-foreground shrink-0">{t("common.subtotal")}</span>
                      {calculateMaxSubtotal() !== null ? (
                        <div className="text-right text-amber-700 font-medium leading-snug">
                          <div>{formatCurrency(calculateSubtotal())}</div>
                          <div className="text-[10px] text-amber-600">– {formatCurrency(calculateMaxSubtotal()!)}</div>
                        </div>
                      ) : (
                        <span>{formatCurrency(calculateSubtotal())}</span>
                      )}
                    </div>

                    {/* Zuschläge (zwischen Zwischensumme und MwSt) */}
                    {surcharges.map((s, i) => (
                      <div key={i} className="flex justify-between items-center text-xs sm:text-sm text-muted-foreground">
                        <span className="shrink-0 truncate">{s.label || t("offer.form.totals.surcharge")}</span>
                        <span>{formatCurrency(computeSurchargeAmount(s, calculateSubtotal(), distanceKm))}</span>
                      </div>
                    ))}

                    {/* Rabatt + Total exkl. MwSt (P3b-2c-ii, new_offer.png) — nur bei aktivem Rabatt */}
                    {effectiveDiscountPercent !== null && effectiveDiscountPercent > 0 && (
                      <>
                        <div className="flex justify-between items-start text-xs sm:text-sm text-muted-foreground">
                          <span className="shrink-0">
                            {t("offer.form.totals.discount", { percent: formatPercent(effectiveDiscountPercent, locale) })}
                          </span>
                          {calculateMaxTaxableBase() !== null ? (
                            <div className="text-right text-amber-700 leading-snug">
                              <div>- {formatCurrency(computeDiscountAmount(calculateTaxableBase(), effectiveDiscountPercent))}</div>
                              <div className="text-[10px] text-amber-600">– - {formatCurrency(computeDiscountAmount(calculateMaxTaxableBase()!, effectiveDiscountPercent))}</div>
                            </div>
                          ) : (
                            <span>- {formatCurrency(computeDiscountAmount(calculateTaxableBase(), effectiveDiscountPercent))}</span>
                          )}
                        </div>
                        <div className="flex justify-between items-start text-xs sm:text-sm">
                          <span className="shrink-0">{t("offer.form.totals.totalExclVat")}</span>
                          {calculateMaxDiscountedBase() !== null ? (
                            <div className="text-right text-amber-700 font-medium leading-snug">
                              <div>{formatCurrency(calculateDiscountedBase())}</div>
                              <div className="text-[10px] text-amber-600">– {formatCurrency(calculateMaxDiscountedBase()!)}</div>
                            </div>
                          ) : (
                            <span>{formatCurrency(calculateDiscountedBase())}</span>
                          )}
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={mwstEnabled}
                          onCheckedChange={setMwstEnabled}
                          className="scale-90 sm:scale-100"
                        />
                        <span className="text-xs sm:text-sm text-muted-foreground">{t("common.vat")}</span>
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
                        <span className="text-muted-foreground shrink-0">{t("offer.detail.vatRow", { rate: formatPercent(vatRate, locale) })}</span>
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
                      <span className="shrink-0">{t("common.total")}</span>
                      {calculateMaxTotal() !== null ? (
                        <div className="text-right text-amber-700 leading-snug">
                          <div>{formatCurrency(calculateTotal())}</div>
                          <div className="text-sm font-semibold text-amber-600">– {formatCurrency(calculateMaxTotal()!)}</div>
                        </div>
                      ) : (
                        <span className="text-primary">{formatCurrency(calculateTotal())}</span>
                      )}
                    </div>
                    </>
                    )}
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
                      {isSpellChecking ? t("offer.form.spellChecking") : t("offer.edit.saveChanges")}
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
                      {isSpellChecking ? "…" : t("offer.edit.saveAndResend")}
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

