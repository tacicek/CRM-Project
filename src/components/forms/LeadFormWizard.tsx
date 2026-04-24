import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailField } from "@/components/ui/email-field";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { sendCustomerConfirmation } from "@/lib/sendCustomerConfirmation";
import { triggerLeadQualityValidation } from "@/lib/triggerLeadQualityValidation";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { verifyRecaptchaToken } from "@/lib/recaptchaVerify";
import { validateStep, leadFormSchema } from "@/lib/validations/leadForm";
import { FormError } from "@/components/ui/form-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Truck,
  Trash2,
  Piano,
  ArrowUp,
  Armchair,
  Warehouse,
  Recycle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Home,
  Calendar,
  User,
  Navigation,
  Paintbrush,
  BedDouble,
  Package,
  SprayCan,
} from "lucide-react";
import { GooglePlacesAutocomplete, PlaceResult } from "@/components/ui/google-places-autocomplete";

interface LeadFormWizardProps {
  allowedServices?: string[];
  formId?: string;
  formSlug?: string;
  language?: "de" | "en" | "fr" | "it";
  isEmbedded?: boolean;
}

const LeadFormWizard = ({
  allowedServices,
  formId,
  formSlug,
  language: _language = "de",
  isEmbedded = false,
}: LeadFormWizardProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();

  // When exactly one service is allowed, skip step 1 and pre-select that service.
  const isSingleService = allowedServices !== undefined && allowedServices !== null && allowedServices.length === 1;
  const autoService = isSingleService ? allowedServices[0] : "";

  const [currentStep, setCurrentStep] = useState(isSingleService ? 2 : 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const totalSteps = 5;
  const draftStorageKey = `leadform:draft:${formSlug || formId || "default"}`;

  const [formData, setFormData] = useState({
    // Step 1: Service
    serviceType: autoService,
    // Step 2: From Address (used by all categories)
    fromPlz: "",
    fromCity: "",
    fromStreet: "",
    fromHouseNumber: "",
    fromFloor: "",
    fromHasLift: false,
    fromLat: 0,
    fromLng: 0,
    fromFormattedAddress: "",
    // Step 2: To Address (only for Umzug/Transport/Lagerung)
    toPlz: "",
    toCity: "",
    toStreet: "",
    toHouseNumber: "",
    toFloor: "",
    toHasLift: false,
    toLat: 0,
    toLng: 0,
    toFormattedAddress: "",
    // Step 3: Property Details (Umzug)
    rooms: "",
    livingSpace: "",
    specialItems: [] as string[],
    packingServiceNeeded: false,
    cleaningServiceNeeded: false,
    storageNeeded: false,
    // Step 3: Klaviertransport specific
    pianoType: "",
    pianoBrand: "",
    pianoWeightKg: "",
    staircaseType: "",
    staircaseWidthCm: "",
    staircaseTurns: "",
    windowAccessPossible: false,
    // Step 3: Möbellift specific
    moebelliftFloor: "",
    moebelliftItemDescription: "",
    moebelliftItemDimensions: "",
    // Step 3: Reinigung specific
    reinigungType: "", // endreinigung, grundreinigung, etc.
    reinigungRooms: "",
    reinigungBathrooms: "",
    reinigungKitchen: true,
    reinigungWindows: false,
    reinigungBalcony: false,
    // Step 3: Räumung specific
    raeumungType: "", // wohnung, haus, keller, etc.
    raeumungVolume: "", // m³ estimation
    raeumungHasHeavyItems: false,
    raeumungNeedsDisposal: true,
    // Step 3: Entsorgung specific
    entsorgungType: "", // möbel, elektro, sperrmüll, etc.
    entsorgungVolume: "",
    entsorgungItems: "",
    // Step 3: Lagerung specific
    lagerungDuration: "", // wochen, monate
    lagerungVolume: "",
    lagerungClimateControlled: false,
    lagerungAccessFrequency: "", // selten, monatlich, wöchentlich
    lagerungItems: "", // description of items to store
    // Step 3: Malerarbeit specific
    malerarbeitType: "",
    malerarbeitRooms: "",
    malerarbeitArea: "",
    malerarbeitDescription: "",
    malerarbeitCeilings: false,
    malerarbeitWallpaper: false,
    // Step 3: USM Transport specific
    usmItemCount: "",
    usmItemDescription: "",
    usmNeedsAssembly: false,
    usmNeedsDisassembly: false,
    // Step 3: Wasserbett Transport specific
    wasserbettSize: "",
    wasserbettBrand: "",
    wasserbettNeedsDraining: false,
    wasserbettNeedsRefilling: false,
    wasserbettHasHeater: false,
    // Step 4: Timing
    preferredDate: "",
    timeSlot: "",
    isFlexibleDate: true,
    description: "",
    // Step 5: Contact
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    maxCompanies: "3",
    acceptTerms: false,
    acceptPrivacy: false,
  });

  // Helper to determine category from service type
  const getServiceCategory = (serviceType: string): string => {
    if (["umzug_privat", "umzug_firma"].includes(serviceType)) return "umzug";
    if (["reinigung_end", "reinigung_grund"].includes(serviceType)) return "reinigung";
    if (["raeumung_wohnung"].includes(serviceType)) return "raeumung";
    if (["transport_moebel", "klaviertransport", "moebellift", "usm_transport", "wasserbett_transport"].includes(serviceType)) return "transport";
    if (["lagerung"].includes(serviceType)) return "lagerung";
    if (["entsorgung"].includes(serviceType)) return "entsorgung";
    if (["malerarbeit"].includes(serviceType)) return "malerarbeit";
    return "umzug"; // default
  };

  const currentCategory = getServiceCategory(formData.serviceType);

  // Distance calculation state
  const [distanceInfo, setDistanceInfo] = useState<{
    distanceKm: number;
    distanceText: string;
    durationMinutes: number;
    durationText: string;
  } | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

  // Check if the service needs two addresses
  const needsTwoAddresses = ["umzug", "transport", "lagerung"].includes(currentCategory);

  // Calculate distance when both addresses have coordinates
  const calculateDistance = useCallback(async () => {
    if (!needsTwoAddresses) return;
    if (!formData.fromLat || !formData.fromLng || !formData.toLat || !formData.toLng) {
      setDistanceInfo(null);
      return;
    }

    setIsCalculatingDistance(true);
    try {
      const { data, error } = await supabase.functions.invoke("calculate-distance", {
        body: {
          origin: { lat: formData.fromLat, lng: formData.fromLng },
          destination: { lat: formData.toLat, lng: formData.toLng },
        },
      });

      if (error) throw error;
      if (data?.result) {
        setDistanceInfo(data.result);
      }
    } catch (err) {
      console.error("Error calculating distance:", err);
      setDistanceInfo(null);
    } finally {
      setIsCalculatingDistance(false);
    }
  }, [formData.fromLat, formData.fromLng, formData.toLat, formData.toLng, needsTwoAddresses]);

  useEffect(() => {
    calculateDistance();
  }, [calculateDistance]);

  // Handle Google Places selection for "from" address
  const handleFromPlaceSelect = (place: PlaceResult) => {
    setFormData(prev => ({
      ...prev,
      fromPlz: place.plz,
      fromCity: place.city,
      fromStreet: place.street,
      fromHouseNumber: place.houseNumber,
      fromLat: place.lat,
      fromLng: place.lng,
      fromFormattedAddress: place.formattedAddress,
    }));
    setErrors(prev => ({ ...prev, fromPlz: "", fromCity: "" }));
  };

  // Handle Google Places selection for "to" address
  const handleToPlaceSelect = (place: PlaceResult) => {
    setFormData(prev => ({
      ...prev,
      toPlz: place.plz,
      toCity: place.city,
      toStreet: place.street,
      toHouseNumber: place.houseNumber,
      toLat: place.lat,
      toLng: place.lng,
      toFormattedAddress: place.formattedAddress,
    }));
  };
  
  // Get address labels based on category
  const getAddressLabels = () => {
    switch (currentCategory) {
      case "umzug":
        return { from: "Von (Abholort)", to: "Nach (Zielort)" };
      case "transport":
        return { from: "Abholadresse", to: "Lieferadresse" };
      case "lagerung":
        return { from: "Abholadresse", to: "Lagerort (optional)" };
      case "reinigung":
        return { from: "Adresse der Reinigung", to: "" };
      case "raeumung":
        return { from: "Adresse der Räumung", to: "" };
      case "entsorgung":
        return { from: "Abholadresse", to: "" };
      case "malerarbeit":
        return { from: "Adresse für Malerarbeiten", to: "" };
      default:
        return { from: "Adresse", to: "" };
    }
  };

  // Piano types
  const pianoTypes = [
    { value: "klavier", label: "Klavier (aufrecht)" },
    { value: "fluegel", label: "Flügel" },
    { value: "stutzfluegel", label: "Stutzflügel" },
    { value: "e_piano", label: "E-Piano / Digitalpiano" },
    { value: "keyboard", label: "Keyboard / Synthesizer" },
  ];

  // Staircase types
  const staircaseTypes = [
    { value: "gerade", label: "Gerade Treppe" },
    { value: "kurvig", label: "Treppe mit Kurven" },
    { value: "wendel", label: "Wendeltreppe" },
    { value: "keine", label: "Keine Treppe (Lift/Erdgeschoss)" },
  ];

  // Service categories with icons
  const serviceCategories = [
    { 
      id: "umzug", 
      label: "Umzug", 
      description: "Privat- und Firmenumzüge",
      icon: Truck,
      services: ["umzug_privat", "umzug_firma"]
    },
    { 
      id: "reinigung", 
      label: "Reinigung", 
      description: "End- und Grundreinigung",
      icon: SprayCan,
      services: ["reinigung_end", "reinigung_grund"]
    },
    { 
      id: "raeumung", 
      label: "Räumung", 
      description: "Wohnungsräumung",
      icon: Package,
      services: ["raeumung_wohnung"]
    },
    { 
      id: "transport", 
      label: "Transport", 
      description: "Möbel- und Spezialtransporte",
      icon: Piano,
      services: ["transport_moebel", "klaviertransport", "moebellift", "usm_transport", "wasserbett_transport"]
    },
    { 
      id: "lagerung", 
      label: "Lagerung", 
      description: "Möbel- und Lagerlösungen",
      icon: Warehouse,
      services: ["lagerung"]
    },
    { 
      id: "entsorgung", 
      label: "Entsorgung", 
      description: "Entrümpelung und Entsorgung",
      icon: Recycle,
      services: ["entsorgung"]
    },
    { 
      id: "malerarbeit", 
      label: "Malerarbeit", 
      description: "Maler- und Renovationsarbeiten",
      icon: Paintbrush,
      services: ["malerarbeit"]
    },
  ];

  // Main services - simple list with icons (neutral style)
  const mainServices = [
    { id: "umzug", label: "Umzug", icon: Truck },
    { id: "reinigung", label: "Reinigung", icon: SprayCan },
    { id: "klaviertransport", label: "Klaviertransport", icon: Piano },
    { id: "moebellift", label: "Möbellift mieten", icon: ArrowUp },
    { id: "raeumung", label: "Räumung / Entsorgung", icon: Trash2 },
    { id: "lagerung", label: "Lagerung", icon: Warehouse },
    { id: "transport_moebel", label: "Möbeltransport", icon: Armchair },
    { id: "malerarbeit", label: "Malerarbeit", icon: Paintbrush },
  ];

  const allServices = [
    { id: "umzug_privat", label: "Privatumzug", icon: Truck },
    { id: "umzug_firma", label: "Firmenumzug", icon: Truck },
    { id: "klaviertransport", label: "Klaviertransport", icon: Piano },
    { id: "moebellift", label: "Möbellift", icon: Truck },
    { id: "reinigung_end", label: "Endreinigung", icon: SprayCan },
    { id: "reinigung_grund", label: "Grundreinigung", icon: SprayCan },
    { id: "raeumung_wohnung", label: "Wohnungsräumung", icon: Package },
    { id: "transport_moebel", label: "Möbeltransport", icon: Piano },
    { id: "usm_transport", label: "USM Transport", icon: Armchair },
    { id: "wasserbett_transport", label: "Wasserbett Transport", icon: BedDouble },
    { id: "lagerung", label: "Lagerung", icon: Warehouse },
    { id: "entsorgung", label: "Entsorgung", icon: Recycle },
    { id: "malerarbeit", label: "Malerarbeit", icon: Paintbrush },
  ];

  // Filter services if allowedServices is provided
  const services = allowedServices && allowedServices.length > 0
    ? allServices.filter(s => allowedServices.includes(s.id))
    : allServices;

  // Get the current category based on allowed services (for header display)
  const allowedCategory = allowedServices && allowedServices.length > 0
    ? serviceCategories.find(cat => cat.services.some(s => allowedServices.includes(s)))
    : null;

  const specialItemsList = [
    { id: "klavier", label: "Klavier/Flügel" },
    { id: "tresor", label: "Tresor" },
    { id: "kunst", label: "Kunstwerke" },
    { id: "wasserbett", label: "Wasserbett" },
    { id: "schwere_moebel", label: "Schwere Möbel (>100kg)" },
    { id: "elektronik", label: "Empfindliche Elektronik" },
  ];

  const floors = ["EG", "1", "2", "3", "4", "5+"];
  const roomOptions = ["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5+"];
  const timeSlots = [
    { value: "morning", label: "Vormittag (08:00-12:00)" },
    { value: "afternoon", label: "Nachmittag (13:00-17:00)" },
    { value: "flexible", label: "Flexibel" },
  ];

  const updateFormData = (field: string, value: unknown) => {
    // Redirect to detailed wizards based on main service selection
    if (field === "serviceType" && !isEmbedded) {
      // Reinigung -> Reinigung wizard
      if (value === "reinigung" || value === "reinigung_end" || value === "reinigung_grund") {
        navigate("/anfrage/reinigung");
        return;
      }
      
      // Umzug -> Umzug wizard
      if (value === "umzug" || value === "umzug_privat" || value === "umzug_firma") {
        navigate("/anfrage/umzug");
        return;
      }
      
      // Entsorgung -> dedicated Entsorgung wizard
      if (value === "entsorgung") {
        navigate("/anfrage/entsorgung");
        return;
      }

      // Räumung -> Räumung wizard
      if (value === "raeumung" || value === "raeumung_wohnung") {
        navigate("/anfrage/raeumung");
        return;
      }
      
      // Klaviertransport -> Klaviertransport wizard
      if (value === "klaviertransport") {
        navigate("/anfrage/klaviertransport");
        return;
      }
      
      // Möbellift -> Möbellift wizard
      if (value === "moebellift") {
        navigate("/anfrage/moebellift");
        return;
      }

      // Lagerung -> Lagerung wizard
      if (value === "lagerung") {
        navigate("/anfrage/lagerung");
        return;
      }

      // Malerarbeit -> Malerarbeit wizard
      if (value === "malerarbeit") {
        navigate("/anfrage/malerarbeiten");
        return;
      }

    }
    
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user makes changes
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  useEffect(() => {
    if (!isEmbedded) return;
    try {
      const raw = sessionStorage.getItem(draftStorageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        currentStep?: number;
        formData?: typeof formData;
      };

      if (parsed.formData) {
        setFormData(parsed.formData);
      }

      // For single-service forms, never restore to step 1 (service selection is skipped).
      const minStep = isSingleService ? 2 : 1;
      if (typeof parsed.currentStep === "number" && parsed.currentStep >= minStep && parsed.currentStep <= totalSteps) {
        setCurrentStep(parsed.currentStep);
      }
    } catch {
      // ignore invalid draft payload
    }
  }, [draftStorageKey, isEmbedded, isSingleService]);

  useEffect(() => {
    if (!isEmbedded) return;
    try {
      sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          currentStep,
          formData,
          ts: Date.now(),
        }),
      );
    } catch {
      // ignore quota / storage errors
    }
  }, [currentStep, draftStorageKey, formData, isEmbedded]);

  useEffect(() => {
    if (!isEmbedded) return;

    window.scrollTo({ top: 0, behavior: "smooth" });
    window.parent.postMessage({ type: "leadform-step-change" }, "*");
  }, [currentStep, isEmbedded]);

  const toggleSpecialItem = (itemId: string) => {
    setFormData((prev) => ({
      ...prev,
      specialItems: prev.specialItems.includes(itemId)
        ? prev.specialItems.filter((id) => id !== itemId)
        : [...prev.specialItems, itemId],
    }));
  };

  const nextStep = () => {
    const validation = validateStep(currentStep, formData);
    
    if (!validation.success) {
      setErrors(validation.errors);
      toast({
        title: "Bitte prüfen Sie Ihre Eingaben",
        description: "Einige Felder enthalten ungültige Daten.",
        variant: "destructive",
      });
      return;
    }
    
    setErrors({});
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    setErrors({});
    // For single-service forms step 1 is skipped; minimum navigable step is 2.
    const firstStep = isSingleService ? 2 : 1;
    if (currentStep > firstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Fetch user's IP address for spam detection
  const getClientIpAddress = async (): Promise<string | null> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      if (response.ok) {
        const data = await response.json();
        return data.ip || null;
      }
    } catch (error) {
      console.warn('Could not fetch IP address:', error);
    }
    return null;
  };

  const handleSubmit = async () => {
    // Full form validation with Zod
    const result = leadFormSchema.safeParse(formData);
    
    if (!result.success) {
      const validationErrors: Record<string, string> = {};
      // Show validation errors
      result.error.errors.forEach((err) => {
        validationErrors[err.path.join(".")] = err.message;
      });
      setErrors(validationErrors);
      toast({
        title: "Bitte überprüfen Sie Ihre Eingaben",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    // reCAPTCHA verification
    if (recaptchaEnabled) {
      const token = await executeRecaptcha("submit_lead_form");
      const verifyResult = await verifyRecaptchaToken(token, "submit_lead_form");
      
      if (!verifyResult.success) {
        toast({
          title: "Sicherheitsüberprüfung fehlgeschlagen",
          description: "Bitte versuchen Sie es erneut.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
    }

    setErrors({});

    // Get IP address for spam detection (non-blocking)
    const ipAddress = await getClientIpAddress();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insertData: any = {
        service_type: formData.serviceType,
        from_plz: formData.fromPlz,
        from_city: formData.fromCity,
        from_street: formData.fromStreet || null,
        from_house_number: formData.fromHouseNumber || null,
        from_floor: formData.fromFloor ? parseInt(formData.fromFloor === "EG" ? "0" : formData.fromFloor.replace("+", "")) : null,
        from_has_lift: formData.fromHasLift,
        from_rooms: formData.rooms ? parseFloat(formData.rooms.replace("+", "")) : null,
        from_living_space_m2: formData.livingSpace ? parseInt(formData.livingSpace) : null,
        to_plz: formData.toPlz || null,
        to_city: formData.toCity || null,
        to_street: formData.toStreet || null,
        to_house_number: formData.toHouseNumber || null,
        to_floor: formData.toFloor ? parseInt(formData.toFloor === "EG" ? "0" : formData.toFloor.replace("+", "")) : null,
        to_has_lift: formData.toHasLift,
        preferred_date: formData.preferredDate || null,
        preferred_time_slot: formData.timeSlot || null,
        is_flexible_date: formData.isFlexibleDate,
        description: formData.description || null,
        special_items: formData.specialItems.length > 0 ? formData.specialItems : null,
        // Umzug additional services
        packing_service_needed: formData.packingServiceNeeded,
        cleaning_service_needed: formData.cleaningServiceNeeded,
        storage_needed: formData.storageNeeded,
        // Klaviertransport specific fields
        piano_type: formData.pianoType || null,
        piano_brand: formData.pianoBrand || null,
        piano_weight_kg: formData.pianoWeightKg ? parseInt(formData.pianoWeightKg) : null,
        staircase_type: formData.staircaseType || null,
        staircase_width_cm: formData.staircaseWidthCm ? parseInt(formData.staircaseWidthCm) : null,
        staircase_turns: formData.staircaseTurns ? parseInt(formData.staircaseTurns) : null,
        window_access_possible: formData.windowAccessPossible,
        // Möbellift specific fields
        moebellift_floor: formData.moebelliftFloor ? parseInt(formData.moebelliftFloor) : null,
        moebellift_item_description: formData.moebelliftItemDescription || null,
        moebellift_item_dimensions: formData.moebelliftItemDimensions || null,
        // Reinigung specific fields
        property_type: formData.reinigungType || null,
        bathroom_count: formData.reinigungBathrooms ? parseInt(formData.reinigungBathrooms) : null,
        has_balcony: formData.reinigungBalcony,
        has_garage: false,
        has_basement: false,
        has_attic: false,
        // Räumung specific fields
        clearing_type: formData.raeumungType || null,
        estimated_volume: formData.raeumungVolume || formData.entsorgungVolume || formData.lagerungVolume || null,
        has_heavy_items: formData.raeumungHasHeavyItems,
        heavy_items_description: null,
        // Entsorgung specific fields
        disposal_type: formData.entsorgungType || null,
        items_description: formData.entsorgungItems || null,
        // Lagerung specific fields
        storage_duration: formData.lagerungDuration || null,
        storage_volume: formData.lagerungVolume || null,
        access_frequency: formData.lagerungAccessFrequency || null,
        needs_climate_control: formData.lagerungClimateControlled,
        storage_items_description: formData.lagerungItems || null,
        pickup_street: null,
        pickup_house_number: null,
        pickup_floor: null,
        pickup_has_lift: false,
        // Distance info
        distance_km: distanceInfo?.distanceKm || null,
        estimated_duration_minutes: distanceInfo?.durationMinutes || null,
        // Contact info
        customer_first_name: formData.firstName,
        customer_last_name: formData.lastName,
        customer_email: formData.email,
        customer_phone: formData.phone,
        max_companies: parseInt(formData.maxCompanies),
        source_form_id: formId || null,
        // Spam detection
        ip_address: ipAddress,
      };
      // Use RPC function to bypass RLS (SECURITY DEFINER)
      const { data: newLeadId, error } = await supabase.rpc("submit_lead_json", {
        lead_data: insertData
      });

      if (error) throw error;
      console.log("Lead created with ID:", newLeadId);

      triggerLeadQualityValidation(newLeadId as string | null);

      sendCustomerConfirmation({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        serviceType: formData.serviceType,
        fromCity: formData.fromCity,
        toCity: formData.toCity || undefined,
        maxCompanies: parseInt(formData.maxCompanies),
      });

      toast({
        title: "Anfrage erfolgreich gesendet!",
        description: "Sie erhalten in Kürze bis zu " + formData.maxCompanies + " Offerten.",
      });

      if (isEmbedded) {
        sessionStorage.removeItem(draftStorageKey);
      }

      // Reset form — single-service forms skip step 1 and keep the pre-selected service
      setCurrentStep(isSingleService ? 2 : 1);
      setFormData({
        serviceType: autoService,
        fromPlz: "",
        fromCity: "",
        fromStreet: "",
        fromHouseNumber: "",
        fromFloor: "",
        fromHasLift: false,
        fromLat: 0,
        fromLng: 0,
        fromFormattedAddress: "",
        toPlz: "",
        toCity: "",
        toStreet: "",
        toHouseNumber: "",
        toFloor: "",
        toHasLift: false,
        toLat: 0,
        toLng: 0,
        toFormattedAddress: "",
        rooms: "",
        livingSpace: "",
        specialItems: [],
        packingServiceNeeded: false,
        cleaningServiceNeeded: false,
        storageNeeded: false,
        pianoType: "",
        pianoBrand: "",
        pianoWeightKg: "",
        staircaseType: "",
        staircaseWidthCm: "",
        staircaseTurns: "",
        windowAccessPossible: false,
        moebelliftFloor: "",
        moebelliftItemDescription: "",
        moebelliftItemDimensions: "",
        reinigungType: "",
        reinigungRooms: "",
        reinigungBathrooms: "",
        reinigungKitchen: true,
        reinigungWindows: false,
        reinigungBalcony: false,
        raeumungType: "",
        raeumungVolume: "",
        raeumungHasHeavyItems: false,
        raeumungNeedsDisposal: true,
        entsorgungType: "",
        entsorgungVolume: "",
        entsorgungItems: "",
        lagerungDuration: "",
        lagerungVolume: "",
        lagerungClimateControlled: false,
        lagerungAccessFrequency: "",
        lagerungItems: "",
        malerarbeitType: "",
        malerarbeitRooms: "",
        malerarbeitArea: "",
        malerarbeitDescription: "",
        malerarbeitCeilings: false,
        malerarbeitWallpaper: false,
        usmItemCount: "",
        usmItemDescription: "",
        usmNeedsAssembly: false,
        usmNeedsDisassembly: false,
        wasserbettSize: "",
        wasserbettBrand: "",
        wasserbettNeedsDraining: false,
        wasserbettNeedsRefilling: false,
        wasserbettHasHeater: false,
        preferredDate: "",
        timeSlot: "",
        isFlexibleDate: true,
        description: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        maxCompanies: "3",
        acceptTerms: false,
        acceptPrivacy: false,
      });
    } catch (error: unknown) {
      const pgErr = error as { message?: string; code?: string; details?: string; hint?: string } | null;
      const errMsg = pgErr?.message ?? String(error);
      console.error("[LeadForm] Submit failed — message:", errMsg, "| code:", pgErr?.code, "| details:", pgErr?.details, "| hint:", pgErr?.hint);
      toast({
        title: "Fehler beim Senden",
        description: errMsg || "Bitte versuchen Sie es erneut oder kontaktieren Sie uns.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIcons = [
    { icon: Truck, label: "Service" },
    { icon: MapPin, label: "Adressen" },
    { icon: Home, label: "Details" },
    { icon: Calendar, label: "Termin" },
    { icon: User, label: "Kontakt" },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          {/* Progress Line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-border">
            <div 
              className="h-full bg-secondary transition-all duration-300"
              style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
            />
          </div>
          
          {stepIcons.map((step, index) => (
            <div 
              key={index} 
              className="relative z-10 flex flex-col items-center gap-2"
            >
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  index + 1 <= currentStep
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-card border-2 border-border text-muted-foreground"
                }`}
              >
                {index + 1 < currentStep ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <step.icon className="w-5 h-5" />
                )}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${
                index + 1 <= currentStep ? "text-foreground" : "text-muted-foreground"
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="glass-card p-6 md:p-8">
        {/* Step 1: Service Selection */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fade-in">
            {/* Category Header - shown when form is filtered to a category */}
            {allowedCategory && (
              <div className="flex items-center gap-3 p-4 bg-secondary/10 rounded-xl border border-secondary/20">
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center">
                  <allowedCategory.icon className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-secondary">{allowedCategory.label}</h3>
                  <p className="text-sm text-muted-foreground">{allowedCategory.description}</p>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xl font-semibold mb-2">
                {allowedCategory 
                  ? `Welche Art von ${allowedCategory.label} benötigen Sie?`
                  : "Welchen Service benötigen Sie?"
                }
              </h3>
              <p className="text-muted-foreground">
                {allowedCategory 
                  ? `Wählen Sie aus ${services.length} verfügbaren Optionen.`
                  : "Wählen Sie die gewünschte Dienstleistung aus."
                }
              </p>
            </div>

            {/* Simple Services Grid - Main services only */}
            {(!allowedServices || allowedServices.length === 0) ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {mainServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => updateFormData("serviceType", service.id)}
                    className={`relative p-5 rounded-2xl border-2 text-center transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group ${
                      formData.serviceType === service.id
                        ? "border-secondary bg-secondary/5 shadow-md"
                        : errors.serviceType
                        ? "border-destructive/50 bg-white dark:bg-gray-800"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-secondary/50"
                    }`}
                  >
                    {/* Selected Indicator */}
                    {formData.serviceType === service.id && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-secondary rounded-full flex items-center justify-center shadow-md">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    )}
                    
                    {/* Icon */}
                    <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <service.icon className="w-7 h-7 text-gray-700 group-hover:text-primary transition-colors" />
                    </div>
                    
                    {/* Label */}
                    <div className="font-semibold text-sm group-hover:text-secondary transition-colors">
                      {service.label}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* Filtered Services Grid - Original layout for filtered forms */
              <div className={`grid gap-4 ${
                services.length <= 2 
                  ? "grid-cols-1 md:grid-cols-2 max-w-md mx-auto" 
                  : services.length <= 4 
                    ? "grid-cols-2 md:grid-cols-4" 
                    : "grid-cols-2 md:grid-cols-4"
              }`}>
                {services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => updateFormData("serviceType", service.id)}
                    className={`p-4 rounded-xl border-2 text-center transition-all hover:border-secondary/50 ${
                      formData.serviceType === service.id
                        ? "border-secondary bg-secondary/10"
                        : errors.serviceType
                        ? "border-destructive bg-destructive/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <service.icon className={`w-8 h-8 mx-auto mb-2 ${
                      formData.serviceType === service.id ? "text-secondary" : "text-muted-foreground"
                    }`} />
                    <span className="text-sm font-medium">{service.label}</span>
                  </button>
                ))}
              </div>
            )}
            <FormError message={errors.serviceType} />
          </div>
        )}

        {/* Step 2: Addresses - Category Specific */}
        {currentStep === 2 && (
          <div className="space-y-8 animate-fade-in">
            {/* Primary Address - Always shown */}
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-secondary" />
                {getAddressLabels().from}
              </h3>
              
              {/* Google Places Autocomplete */}
              <div className="mb-4">
                <Label>Adresse suchen</Label>
                <GooglePlacesAutocomplete
                  value={formData.fromFormattedAddress}
                  onPlaceSelect={handleFromPlaceSelect}
                  placeholder="Adresse eingeben..."
                  className={errors.fromPlz || errors.fromCity ? "border-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Beginnen Sie mit der Eingabe und wählen Sie aus den Vorschlägen
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-1">
                  <Label htmlFor="fromPlz">PLZ *</Label>
                  <Input
                    id="fromPlz"
                    placeholder="8001"
                    value={formData.fromPlz}
                    onChange={(e) => updateFormData("fromPlz", e.target.value)}
                    className={errors.fromPlz ? "border-destructive" : ""}
                  />
                  <FormError message={errors.fromPlz} />
                </div>
                <div className="col-span-1 md:col-span-3">
                  <Label htmlFor="fromCity">Ort *</Label>
                  <Input
                    id="fromCity"
                    placeholder="Zürich"
                    value={formData.fromCity}
                    onChange={(e) => updateFormData("fromCity", e.target.value)}
                    className={errors.fromCity ? "border-destructive" : ""}
                  />
                  <FormError message={errors.fromCity} />
                </div>
                <div className="col-span-2 md:col-span-3">
                  <Label htmlFor="fromStreet">Strasse</Label>
                  <Input
                    id="fromStreet"
                    placeholder="Bahnhofstrasse"
                    value={formData.fromStreet}
                    onChange={(e) => updateFormData("fromStreet", e.target.value)}
                  />
                </div>
                <div className="col-span-1">
                  <Label htmlFor="fromHouseNumber">Nr.</Label>
                  <Input
                    id="fromHouseNumber"
                    placeholder="10"
                    value={formData.fromHouseNumber}
                    onChange={(e) => updateFormData("fromHouseNumber", e.target.value)}
                  />
                </div>
                {/* Floor and Lift - only for certain categories */}
                {["umzug", "transport", "raeumung"].includes(currentCategory) && (
                  <>
                    <div className="col-span-1">
                      <Label>Stockwerk</Label>
                      <Select value={formData.fromFloor} onValueChange={(v) => updateFormData("fromFloor", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {floors.map((floor) => (
                            <SelectItem key={floor} value={floor}>{floor}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <Label>Lift vorhanden?</Label>
                      <RadioGroup 
                        value={formData.fromHasLift ? "ja" : "nein"} 
                        onValueChange={(v) => updateFormData("fromHasLift", v === "ja")}
                        className="flex gap-4 mt-2"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="ja" id="fromLiftJa" />
                          <Label htmlFor="fromLiftJa" className="cursor-pointer font-normal">Ja</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="nein" id="fromLiftNein" />
                          <Label htmlFor="fromLiftNein" className="cursor-pointer font-normal">Nein</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Second Address - Only for Umzug, Transport, Lagerung */}
            {needsTwoAddresses && (
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-accent" />
                  {getAddressLabels().to}
                </h3>

                {/* Google Places Autocomplete for To Address */}
                <div className="mb-4">
                  <Label>Adresse suchen</Label>
                  <GooglePlacesAutocomplete
                    value={formData.toFormattedAddress}
                    onPlaceSelect={handleToPlaceSelect}
                    placeholder="Zieladresse eingeben..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Beginnen Sie mit der Eingabe und wählen Sie aus den Vorschlägen
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-1">
                    <Label htmlFor="toPlz">PLZ {currentCategory !== "lagerung" ? "*" : ""}</Label>
                    <Input
                      id="toPlz"
                      placeholder="4001"
                      value={formData.toPlz}
                      onChange={(e) => updateFormData("toPlz", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1 md:col-span-3">
                    <Label htmlFor="toCity">Ort</Label>
                    <Input
                      id="toCity"
                      placeholder="Basel"
                      value={formData.toCity}
                      onChange={(e) => updateFormData("toCity", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <Label htmlFor="toStreet">Strasse</Label>
                    <Input
                      id="toStreet"
                      placeholder="Steinenvorstadt"
                      value={formData.toStreet}
                      onChange={(e) => updateFormData("toStreet", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    <Label htmlFor="toHouseNumber">Nr.</Label>
                    <Input
                      id="toHouseNumber"
                      placeholder="5"
                      value={formData.toHouseNumber}
                      onChange={(e) => updateFormData("toHouseNumber", e.target.value)}
                    />
                  </div>
                  {["umzug", "transport"].includes(currentCategory) && (
                    <>
                      <div className="col-span-1">
                        <Label>Stockwerk</Label>
                        <Select value={formData.toFloor} onValueChange={(v) => updateFormData("toFloor", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {floors.map((floor) => (
                              <SelectItem key={floor} value={floor}>{floor}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <Label>Lift vorhanden?</Label>
                        <RadioGroup 
                          value={formData.toHasLift ? "ja" : "nein"} 
                          onValueChange={(v) => updateFormData("toHasLift", v === "ja")}
                          className="flex gap-4 mt-2"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="ja" id="toLiftJa" />
                            <Label htmlFor="toLiftJa" className="cursor-pointer font-normal">Ja</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="nein" id="toLiftNein" />
                            <Label htmlFor="toLiftNein" className="cursor-pointer font-normal">Nein</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Distance Info Display */}
            {needsTwoAddresses && (distanceInfo || isCalculatingDistance) && (
              <div className="p-4 bg-secondary/10 rounded-xl border border-secondary/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                    <Navigation className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    {isCalculatingDistance ? (
                      <p className="text-muted-foreground">Entfernung wird berechnet...</p>
                    ) : distanceInfo ? (
                      <>
                        <p className="font-semibold text-lg">
                          {distanceInfo.distanceText} Entfernung
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Geschätzte Fahrzeit: {distanceInfo.durationText}
                        </p>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Category-Specific Details */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-fade-in">
            {/* UMZUG - Property details */}
            {currentCategory === "umzug" && (
              <>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Objektdetails</h3>
                  <p className="text-muted-foreground">Geben Sie uns mehr Informationen über die Immobilie.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Anzahl Zimmer *</Label>
                    <Select 
                      value={formData.rooms} 
                      onValueChange={(v) => updateFormData("rooms", v)}
                    >
                      <SelectTrigger className={errors.rooms ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {roomOptions.map((room) => (
                          <SelectItem key={room} value={room}>{room} Zimmer</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormError message={errors.rooms} />
                  </div>
                  <div>
                    <Label htmlFor="livingSpace">Wohnfläche (m²) *</Label>
                    <Input
                      id="livingSpace"
                      type="number"
                      placeholder="85"
                      value={formData.livingSpace}
                      onChange={(e) => updateFormData("livingSpace", e.target.value)}
                      className={errors.livingSpace ? "border-destructive" : ""}
                    />
                    <FormError message={errors.livingSpace} />
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block">Spezielle Gegenstände</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {specialItemsList.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <Checkbox
                          id={item.id}
                          checked={formData.specialItems.includes(item.id)}
                          onCheckedChange={() => toggleSpecialItem(item.id)}
                        />
                        <Label htmlFor={item.id} className="cursor-pointer text-sm">{item.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="mb-3 block">Zusatzservices</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="packingService"
                        checked={formData.packingServiceNeeded}
                        onCheckedChange={(c) => updateFormData("packingServiceNeeded", c)}
                      />
                      <Label htmlFor="packingService" className="cursor-pointer">Packservice gewünscht</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="cleaningService"
                        checked={formData.cleaningServiceNeeded}
                        onCheckedChange={(c) => updateFormData("cleaningServiceNeeded", c)}
                      />
                      <Label htmlFor="cleaningService" className="cursor-pointer">Reinigung gewünscht</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="storageService"
                        checked={formData.storageNeeded}
                        onCheckedChange={(c) => updateFormData("storageNeeded", c)}
                      />
                      <Label htmlFor="storageService" className="cursor-pointer">Zwischenlagerung</Label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* REINIGUNG - Cleaning details */}
            {currentCategory === "reinigung" && (
              <>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Reinigungsdetails</h3>
                  <p className="text-muted-foreground">Geben Sie uns mehr Informationen über die zu reinigende Immobilie.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Anzahl Zimmer *</Label>
                    <Select 
                      value={formData.rooms} 
                      onValueChange={(v) => updateFormData("rooms", v)}
                    >
                      <SelectTrigger className={errors.rooms ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {roomOptions.map((room) => (
                          <SelectItem key={room} value={room}>{room} Zimmer</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormError message={errors.rooms} />
                  </div>
                  <div>
                    <Label htmlFor="livingSpaceReinigung">Wohnfläche (m²) *</Label>
                    <Input
                      id="livingSpaceReinigung"
                      type="number"
                      placeholder="85"
                      value={formData.livingSpace}
                      onChange={(e) => updateFormData("livingSpace", e.target.value)}
                      className={errors.livingSpace ? "border-destructive" : ""}
                    />
                    <FormError message={errors.livingSpace} />
                  </div>
                  <div>
                    <Label>Anzahl Badezimmer *</Label>
                    <Select 
                      value={formData.reinigungBathrooms} 
                      onValueChange={(v) => updateFormData("reinigungBathrooms", v)}
                    >
                      <SelectTrigger className={errors.reinigungBathrooms ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {["1", "2", "3", "4+"].map((num) => (
                          <SelectItem key={num} value={num}>{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormError message={errors.reinigungBathrooms} />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="mb-3 block">Zusätzliche Bereiche</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="reinigungKitchen"
                        checked={formData.reinigungKitchen}
                        onCheckedChange={(c) => updateFormData("reinigungKitchen", c)}
                      />
                      <Label htmlFor="reinigungKitchen" className="cursor-pointer">Küche (inkl. Geräte)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="reinigungWindows"
                        checked={formData.reinigungWindows}
                        onCheckedChange={(c) => updateFormData("reinigungWindows", c)}
                      />
                      <Label htmlFor="reinigungWindows" className="cursor-pointer">Fensterreinigung</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="reinigungBalcony"
                        checked={formData.reinigungBalcony}
                        onCheckedChange={(c) => updateFormData("reinigungBalcony", c)}
                      />
                      <Label htmlFor="reinigungBalcony" className="cursor-pointer">Balkon/Terrasse</Label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* RÄUMUNG - Clearing details */}
            {currentCategory === "raeumung" && (
              <>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Räumungsdetails</h3>
                  <p className="text-muted-foreground">Beschreiben Sie, was geräumt werden soll.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Anzahl Zimmer *</Label>
                    <Select 
                      value={formData.rooms} 
                      onValueChange={(v) => updateFormData("rooms", v)}
                    >
                      <SelectTrigger className={errors.rooms ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {roomOptions.map((room) => (
                          <SelectItem key={room} value={room}>{room} Zimmer</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormError message={errors.rooms} />
                  </div>
                  <div>
                    <Label htmlFor="livingSpaceRaeumung">Wohnfläche (m²) *</Label>
                    <Input
                      id="livingSpaceRaeumung"
                      type="number"
                      placeholder="85"
                      value={formData.livingSpace}
                      onChange={(e) => updateFormData("livingSpace", e.target.value)}
                      className={errors.livingSpace ? "border-destructive" : ""}
                    />
                    <FormError message={errors.livingSpace} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label>Art der Räumung *</Label>
                    <Select 
                      value={formData.raeumungType} 
                      onValueChange={(v) => updateFormData("raeumungType", v)}
                    >
                      <SelectTrigger className={errors.raeumungType ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wohnung">Wohnung</SelectItem>
                        <SelectItem value="haus">Haus</SelectItem>
                        <SelectItem value="keller">Keller</SelectItem>
                        <SelectItem value="estrich">Estrich/Dachboden</SelectItem>
                        <SelectItem value="garage">Garage</SelectItem>
                        <SelectItem value="buero">Büro/Gewerbe</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormError message={errors.raeumungType} />
                  </div>
                  <div>
                    <Label>Geschätztes Volumen *</Label>
                    <Select 
                      value={formData.raeumungVolume} 
                      onValueChange={(v) => updateFormData("raeumungVolume", v)}
                    >
                      <SelectTrigger className={errors.raeumungVolume ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="klein">Klein (bis 10m³)</SelectItem>
                        <SelectItem value="mittel">Mittel (10-30m³)</SelectItem>
                        <SelectItem value="gross">Gross (30-60m³)</SelectItem>
                        <SelectItem value="sehr_gross">Sehr gross (60m³+)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormError message={errors.raeumungVolume} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="raeumungHeavy"
                      checked={formData.raeumungHasHeavyItems}
                      onCheckedChange={(c) => updateFormData("raeumungHasHeavyItems", c)}
                    />
                    <Label htmlFor="raeumungHeavy" className="cursor-pointer">Schwere Gegenstände vorhanden</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="raeumungDisposal"
                      checked={formData.raeumungNeedsDisposal}
                      onCheckedChange={(c) => updateFormData("raeumungNeedsDisposal", c)}
                    />
                    <Label htmlFor="raeumungDisposal" className="cursor-pointer">Entsorgung gewünscht</Label>
                  </div>
                </div>
              </>
            )}

            {/* ENTSORGUNG - Disposal details */}
            {currentCategory === "entsorgung" && (
              <>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Entsorgungsdetails</h3>
                  <p className="text-muted-foreground">Was soll entsorgt werden?</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Art der Entsorgung *</Label>
                    <Select 
                      value={formData.entsorgungType} 
                      onValueChange={(v) => updateFormData("entsorgungType", v)}
                    >
                      <SelectTrigger className={errors.entsorgungType ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="moebel">Möbel</SelectItem>
                        <SelectItem value="elektro">Elektrogeräte</SelectItem>
                        <SelectItem value="sperrmuell">Sperrmüll</SelectItem>
                        <SelectItem value="bauschutt">Bauschutt</SelectItem>
                        <SelectItem value="gruenabfall">Grünabfall</SelectItem>
                        <SelectItem value="gemischt">Gemischt</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormError message={errors.entsorgungType} />
                  </div>
                  <div>
                    <Label>Geschätztes Volumen *</Label>
                    <Select 
                      value={formData.entsorgungVolume} 
                      onValueChange={(v) => updateFormData("entsorgungVolume", v)}
                    >
                      <SelectTrigger className={errors.entsorgungVolume ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="klein">Klein (1-3 Stücke)</SelectItem>
                        <SelectItem value="mittel">Mittel (4-10 Stücke)</SelectItem>
                        <SelectItem value="gross">Gross (10+ Stücke)</SelectItem>
                        <SelectItem value="container">Container nötig</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormError message={errors.entsorgungVolume} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="entsorgungItems">Was soll entsorgt werden? *</Label>
                  <Textarea
                    id="entsorgungItems"
                    placeholder="z.B. altes Sofa, Kühlschrank, 3 Stühle..."
                    value={formData.entsorgungItems}
                    onChange={(e) => updateFormData("entsorgungItems", e.target.value)}
                    rows={3}
                    className={errors.entsorgungItems ? "border-destructive" : ""}
                  />
                  <FormError message={errors.entsorgungItems} />
                </div>
              </>
            )}

            {/* LAGERUNG - Storage details */}
            {currentCategory === "lagerung" && (
              <>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Lagerungsdetails</h3>
                  <p className="text-muted-foreground">Was möchten Sie einlagern?</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Lagerdauer *</Label>
                    <Select 
                      value={formData.lagerungDuration} 
                      onValueChange={(v) => updateFormData("lagerungDuration", v)}
                    >
                      <SelectTrigger className={errors.lagerungDuration ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-4_wochen">1-4 Wochen</SelectItem>
                        <SelectItem value="1-3_monate">1-3 Monate</SelectItem>
                        <SelectItem value="3-6_monate">3-6 Monate</SelectItem>
                        <SelectItem value="6-12_monate">6-12 Monate</SelectItem>
                        <SelectItem value="ueber_1_jahr">Über 1 Jahr</SelectItem>
                        <SelectItem value="unbestimmt">Unbestimmt</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormError message={errors.lagerungDuration} />
                  </div>
                  <div>
                    <Label>Geschätztes Volumen *</Label>
                    <Select 
                      value={formData.lagerungVolume} 
                      onValueChange={(v) => updateFormData("lagerungVolume", v)}
                    >
                      <SelectTrigger className={errors.lagerungVolume ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="klein">Klein (1-5m³)</SelectItem>
                        <SelectItem value="mittel">Mittel (5-15m³)</SelectItem>
                        <SelectItem value="gross">Gross (15-30m³)</SelectItem>
                        <SelectItem value="sehr_gross">Sehr gross (30m³+)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormError message={errors.lagerungVolume} />
                  </div>
                  <div>
                    <Label>Zugriffshäufigkeit *</Label>
                    <Select 
                      value={formData.lagerungAccessFrequency} 
                      onValueChange={(v) => updateFormData("lagerungAccessFrequency", v)}
                    >
                      <SelectTrigger className={errors.lagerungAccessFrequency ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nie">Kein Zugriff nötig</SelectItem>
                        <SelectItem value="selten">Selten</SelectItem>
                        <SelectItem value="monatlich">Monatlich</SelectItem>
                        <SelectItem value="woechentlich">Wöchentlich</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormError message={errors.lagerungAccessFrequency} />
                  </div>
                </div>

                <div className="mt-4">
                  <Label htmlFor="lagerungItems">Was soll eingelagert werden? *</Label>
                  <Textarea
                    id="lagerungItems"
                    placeholder="z.B. Möbel aus 3-Zimmer-Wohnung, Winterreifen, Kartons..."
                    value={formData.lagerungItems || ""}
                    onChange={(e) => updateFormData("lagerungItems", e.target.value)}
                    rows={3}
                    className={errors.lagerungItems ? "border-destructive" : ""}
                  />
                  <FormError message={errors.lagerungItems} />
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <Checkbox
                    id="lagerungClimate"
                    checked={formData.lagerungClimateControlled}
                    onCheckedChange={(c) => updateFormData("lagerungClimateControlled", c)}
                  />
                  <Label htmlFor="lagerungClimate" className="cursor-pointer">Klimatisierter Lagerraum gewünscht</Label>
                </div>
              </>
            )}

            {/* TRANSPORT - Klaviertransport */}
            {formData.serviceType === "klaviertransport" && (
              <>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Klaviertransport Details</h3>
                  <p className="text-muted-foreground">Geben Sie uns Informationen über Ihr Instrument.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Instrument-Typ *</Label>
                    <Select value={formData.pianoType} onValueChange={(v) => updateFormData("pianoType", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {pianoTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.pianoType && <FormError message={errors.pianoType} />}
                  </div>
                  <div>
                    <Label htmlFor="pianoBrand">Marke / Modell</Label>
                    <Input
                      id="pianoBrand"
                      placeholder="z.B. Steinway, Yamaha"
                      value={formData.pianoBrand}
                      onChange={(e) => updateFormData("pianoBrand", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pianoWeight">Geschätztes Gewicht (kg)</Label>
                    <Input
                      id="pianoWeight"
                      type="number"
                      placeholder="z.B. 250"
                      value={formData.pianoWeightKg}
                      onChange={(e) => updateFormData("pianoWeightKg", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Klavier: ca. 200-300kg, Flügel: ca. 300-500kg
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Treppenhaus-Informationen</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Treppenart *</Label>
                      <Select value={formData.staircaseType} onValueChange={(v) => updateFormData("staircaseType", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {staircaseTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.staircaseType && <FormError message={errors.staircaseType} />}
                    </div>
                    <div>
                      <Label htmlFor="staircaseWidth">Treppenbreite (cm)</Label>
                      <Input
                        id="staircaseWidth"
                        type="number"
                        placeholder="z.B. 90"
                        value={formData.staircaseWidthCm}
                        onChange={(e) => updateFormData("staircaseWidthCm", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="staircaseTurns">Anzahl Kurven/Wendungen</Label>
                      <Input
                        id="staircaseTurns"
                        type="number"
                        placeholder="z.B. 2"
                        value={formData.staircaseTurns}
                        onChange={(e) => updateFormData("staircaseTurns", e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="windowAccess"
                          checked={formData.windowAccessPossible}
                          onCheckedChange={(c) => updateFormData("windowAccessPossible", c)}
                        />
                        <Label htmlFor="windowAccess" className="cursor-pointer">
                          Fensterzugang möglich (Kran)
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* TRANSPORT - Möbellift */}
            {formData.serviceType === "moebellift" && (
              <>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Möbellift Details</h3>
                  <p className="text-muted-foreground">Geben Sie uns Informationen über Ihren Bedarf.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Stockwerk *</Label>
                    <Select value={formData.moebelliftFloor} onValueChange={(v) => updateFormData("moebelliftFloor", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"].map((floor) => (
                          <SelectItem key={floor} value={floor}>{floor}. Stock</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.moebelliftFloor && <FormError message={errors.moebelliftFloor} />}
                  </div>
                  <div>
                    <Label htmlFor="moebelliftDimensions">Masse der Gegenstände</Label>
                    <Input
                      id="moebelliftDimensions"
                      placeholder="z.B. 200x80x100 cm"
                      value={formData.moebelliftItemDimensions}
                      onChange={(e) => updateFormData("moebelliftItemDimensions", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="moebelliftDescription">Was soll transportiert werden? *</Label>
                  <Textarea
                    id="moebelliftDescription"
                    placeholder="z.B. Sofa, Schrank, Waschmaschine..."
                    value={formData.moebelliftItemDescription}
                    onChange={(e) => updateFormData("moebelliftItemDescription", e.target.value)}
                    rows={3}
                  />
                  {errors.moebelliftItemDescription && <FormError message={errors.moebelliftItemDescription} />}
                </div>
              </>
            )}

            {/* TRANSPORT - Möbeltransport (standard) */}
            {formData.serviceType === "transport_moebel" && (
              <>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Transportdetails</h3>
                  <p className="text-muted-foreground">Was soll transportiert werden?</p>
                </div>

                <div>
                  <Label className="mb-3 block">Spezielle Gegenstände</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {specialItemsList.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <Checkbox
                          id={item.id}
                          checked={formData.specialItems.includes(item.id)}
                          onCheckedChange={() => toggleSpecialItem(item.id)}
                        />
                        <Label htmlFor={item.id} className="cursor-pointer text-sm">{item.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* TRANSPORT - USM Transport */}
            {formData.serviceType === "usm_transport" && (
              <>
                <div>
                  <h3 className="text-xl font-semibold mb-2">USM Transport Details</h3>
                  <p className="text-muted-foreground">Geben Sie uns Informationen über Ihre USM-Möbel.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Anzahl USM-Elemente *</Label>
                    <Select 
                      value={formData.usmItemCount} 
                      onValueChange={(v) => updateFormData("usmItemCount", v)}
                    >
                      <SelectTrigger className={errors.usmItemCount ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {["1-3", "4-6", "7-10", "10+"].map((count) => (
                          <SelectItem key={count} value={count}>{count} Elemente</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormError message={errors.usmItemCount} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="usmDescription">Beschreibung der USM-Möbel *</Label>
                  <Textarea
                    id="usmDescription"
                    placeholder="z.B. 2x Sideboard, 1x Highboard, 3x Rollcontainer..."
                    value={formData.usmItemDescription}
                    onChange={(e) => updateFormData("usmItemDescription", e.target.value)}
                    rows={3}
                    className={errors.usmItemDescription ? "border-destructive" : ""}
                  />
                  <FormError message={errors.usmItemDescription} />
                </div>

                <div className="border-t pt-4">
                  <Label className="mb-3 block">Zusatzleistungen</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="usmDisassembly"
                        checked={formData.usmNeedsDisassembly}
                        onCheckedChange={(c) => updateFormData("usmNeedsDisassembly", c)}
                      />
                      <Label htmlFor="usmDisassembly" className="cursor-pointer">Demontage gewünscht</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="usmAssembly"
                        checked={formData.usmNeedsAssembly}
                        onCheckedChange={(c) => updateFormData("usmNeedsAssembly", c)}
                      />
                      <Label htmlFor="usmAssembly" className="cursor-pointer">Montage am Zielort gewünscht</Label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* TRANSPORT - Wasserbett Transport */}
            {formData.serviceType === "wasserbett_transport" && (
              <>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Wasserbett Transport Details</h3>
                  <p className="text-muted-foreground">Geben Sie uns Informationen über Ihr Wasserbett.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Bettgrösse *</Label>
                    <Select 
                      value={formData.wasserbettSize} 
                      onValueChange={(v) => updateFormData("wasserbettSize", v)}
                    >
                      <SelectTrigger className={errors.wasserbettSize ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="90x200">90x200 cm (Einzelbett)</SelectItem>
                        <SelectItem value="140x200">140x200 cm (Doppelbett)</SelectItem>
                        <SelectItem value="160x200">160x200 cm (Queensize)</SelectItem>
                        <SelectItem value="180x200">180x200 cm (Kingsize)</SelectItem>
                        <SelectItem value="200x200">200x200 cm (Kingsize XL)</SelectItem>
                        <SelectItem value="200x220">200x220 cm (Kingsize XXL)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormError message={errors.wasserbettSize} />
                  </div>
                  <div>
                    <Label htmlFor="wasserbettBrand">Marke / Hersteller</Label>
                    <Input
                      id="wasserbettBrand"
                      placeholder="z.B. Akva, Aqua Dynamic"
                      value={formData.wasserbettBrand}
                      onChange={(e) => updateFormData("wasserbettBrand", e.target.value)}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="mb-3 block">Benötigte Leistungen</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="wasserbettDraining"
                        checked={formData.wasserbettNeedsDraining}
                        onCheckedChange={(c) => updateFormData("wasserbettNeedsDraining", c)}
                      />
                      <Label htmlFor="wasserbettDraining" className="cursor-pointer">Entleeren gewünscht</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="wasserbettRefilling"
                        checked={formData.wasserbettNeedsRefilling}
                        onCheckedChange={(c) => updateFormData("wasserbettNeedsRefilling", c)}
                      />
                      <Label htmlFor="wasserbettRefilling" className="cursor-pointer">Befüllen am Zielort</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="wasserbettHeater"
                        checked={formData.wasserbettHasHeater}
                        onCheckedChange={(c) => updateFormData("wasserbettHasHeater", c)}
                      />
                      <Label htmlFor="wasserbettHeater" className="cursor-pointer">Mit Heizung</Label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* MALERARBEIT - Painting details */}
            {currentCategory === "malerarbeit" && (
              <>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Malerarbeit Details</h3>
                  <p className="text-muted-foreground">Beschreiben Sie die gewünschten Malerarbeiten.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Art der Malerarbeit *</Label>
                    <Select 
                      value={formData.malerarbeitType} 
                      onValueChange={(v) => updateFormData("malerarbeitType", v)}
                    >
                      <SelectTrigger className={errors.malerarbeitType ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="innenanstrich">Innenanstrich</SelectItem>
                        <SelectItem value="aussenanstrich">Aussenanstrich</SelectItem>
                        <SelectItem value="fassade">Fassadenrenovation</SelectItem>
                        <SelectItem value="lackierung">Lackierung (Türen/Fenster)</SelectItem>
                        <SelectItem value="tapezieren">Tapezieren</SelectItem>
                        <SelectItem value="komplett">Komplettrenovation</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormError message={errors.malerarbeitType} />
                  </div>
                  <div>
                    <Label>Anzahl Räume *</Label>
                    <Select 
                      value={formData.malerarbeitRooms} 
                      onValueChange={(v) => updateFormData("malerarbeitRooms", v)}
                    >
                      <SelectTrigger className={errors.malerarbeitRooms ? "border-destructive" : ""}>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {["1", "2", "3", "4", "5", "6+"].map((num) => (
                          <SelectItem key={num} value={num}>{num} Raum/Räume</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormError message={errors.malerarbeitRooms} />
                  </div>
                  <div>
                    <Label htmlFor="malerarbeitArea">Fläche (m²) *</Label>
                    <Input
                      id="malerarbeitArea"
                      type="number"
                      placeholder="z.B. 80"
                      value={formData.malerarbeitArea}
                      onChange={(e) => updateFormData("malerarbeitArea", e.target.value)}
                      className={errors.malerarbeitArea ? "border-destructive" : ""}
                    />
                    <FormError message={errors.malerarbeitArea} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="malerarbeitDescription">Beschreibung der Arbeiten *</Label>
                  <Textarea
                    id="malerarbeitDescription"
                    placeholder="z.B. Wände in Weiss streichen, Decken renovieren, Farbakzente im Wohnzimmer..."
                    value={formData.malerarbeitDescription}
                    onChange={(e) => updateFormData("malerarbeitDescription", e.target.value)}
                    rows={3}
                    className={errors.malerarbeitDescription ? "border-destructive" : ""}
                  />
                  <FormError message={errors.malerarbeitDescription} />
                </div>

                <div className="border-t pt-4">
                  <Label className="mb-3 block">Zusätzliche Optionen</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="malerarbeitCeilings"
                        checked={formData.malerarbeitCeilings}
                        onCheckedChange={(c) => updateFormData("malerarbeitCeilings", c)}
                      />
                      <Label htmlFor="malerarbeitCeilings" className="cursor-pointer">Decken streichen</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="malerarbeitWallpaper"
                        checked={formData.malerarbeitWallpaper}
                        onCheckedChange={(c) => updateFormData("malerarbeitWallpaper", c)}
                      />
                      <Label htmlFor="malerarbeitWallpaper" className="cursor-pointer">Alte Tapete entfernen</Label>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 4: Timing */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-xl font-semibold mb-2">Wunschtermin</h3>
              <p className="text-muted-foreground">Wann soll der Service stattfinden?</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preferredDate">Wunschdatum</Label>
                <Input
                  id="preferredDate"
                  type="date"
                  value={formData.preferredDate}
                  onChange={(e) => updateFormData("preferredDate", e.target.value)}
                />
              </div>
              <div>
                <Label>Zeitfenster</Label>
                <Select value={formData.timeSlot} onValueChange={(v) => updateFormData("timeSlot", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="flexibleDate"
                checked={formData.isFlexibleDate}
                onCheckedChange={(c) => updateFormData("isFlexibleDate", c)}
              />
              <Label htmlFor="flexibleDate" className="cursor-pointer">
                Ich bin beim Datum flexibel
              </Label>
            </div>

            <div>
              <Label htmlFor="description">Zusätzliche Informationen</Label>
              <Textarea
                id="description"
                placeholder="Beschreiben Sie hier besondere Anforderungen oder Wünsche..."
                rows={4}
                value={formData.description}
                onChange={(e) => updateFormData("description", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 5: Contact */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-xl font-semibold mb-2">Ihre Kontaktdaten</h3>
              <p className="text-muted-foreground">Fast geschafft! Wie können die Anbieter Sie erreichen?</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Vorname *</Label>
                <Input
                  id="firstName"
                  placeholder="Max"
                  value={formData.firstName}
                  onChange={(e) => updateFormData("firstName", e.target.value)}
                  className={errors.firstName ? "border-destructive" : ""}
                />
                <FormError message={errors.firstName} />
              </div>
              <div>
                <Label htmlFor="lastName">Nachname *</Label>
                <Input
                  id="lastName"
                  placeholder="Mustermann"
                  value={formData.lastName}
                  onChange={(e) => updateFormData("lastName", e.target.value)}
                  className={errors.lastName ? "border-destructive" : ""}
                />
                <FormError message={errors.lastName} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <EmailField
                  id="email"
                  label="E-Mail"
                  required
                  placeholder="max@example.ch"
                  value={formData.email}
                  onChange={(v) => updateFormData("email", v)}
                  inputClassName={errors.email ? "border-destructive" : ""}
                />
                <FormError message={errors.email} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <Label htmlFor="phone">Telefon *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+41 79 123 45 67"
                  value={formData.phone}
                  onChange={(e) => updateFormData("phone", e.target.value)}
                  className={errors.phone ? "border-destructive" : ""}
                />
                <FormError message={errors.phone} />
              </div>
            </div>

            <div>
              <Label className="mb-3 block">Wie viele Offerten möchten Sie erhalten?</Label>
              <RadioGroup
                value={formData.maxCompanies}
                onValueChange={(v) => updateFormData("maxCompanies", v)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="3" id="companies3" />
                  <Label htmlFor="companies3" className="cursor-pointer">3 Offerten (empfohlen)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="5" id="companies5" />
                  <Label htmlFor="companies5" className="cursor-pointer">5 Offerten</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={formData.acceptTerms}
                    onCheckedChange={(c) => updateFormData("acceptTerms", c)}
                  />
                  <Label htmlFor="terms" className="cursor-pointer text-sm leading-relaxed">
                    Ich akzeptiere die <a href="/agb" className="text-secondary hover:underline">AGB</a> *
                  </Label>
                </div>
                <FormError message={errors.acceptTerms} />
              </div>
              <div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="privacy"
                    checked={formData.acceptPrivacy}
                    onCheckedChange={(c) => updateFormData("acceptPrivacy", c)}
                  />
                  <Label htmlFor="privacy" className="cursor-pointer text-sm leading-relaxed">
                    Ich habe die <a href="/datenschutz" className="text-secondary hover:underline">Datenschutzerklärung</a> gelesen und stimme der Verarbeitung meiner Daten zu *
                  </Label>
                </div>
                <FormError message={errors.acceptPrivacy} />
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={currentStep === (isSingleService ? 2 : 1)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Button>

          {currentStep < totalSteps ? (
            <Button 
              variant="hero" 
              onClick={nextStep}
              disabled={currentStep === 1 && !formData.serviceType}
              className="gap-2"
            >
              Weiter
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button 
              variant="gradient" 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>Wird gesendet...</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Offerten anfordern
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadFormWizard;
