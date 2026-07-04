import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Save, Send, Loader2, Download,
  Plus, Trash2, CheckCircle, FileText, Link2, X,
} from "lucide-react";
import { PDFDownloadLink, pdf } from "@react-pdf/renderer";
import { QuittungPDF } from "@/components/quittung/QuittungPDF";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { logoToBase64 } from "@/lib/logoToBase64";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";
import { SignaturePad, SignaturePadRef } from "@/components/quittung/SignaturePad";
import { QuittungPDFPreview } from "@/components/quittung/QuittungPDFPreview";
import {
  Quittung, QuittungPosition, QuittungStatus,
  PREDEFINED_POSITIONEN, CUSTOM_ROW_COUNT,
  calculateTotals, formatChf, STATUS_CONFIG,
} from "@/types/quittung.types";

interface OfferOption {
  id: string;
  offer_number: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  lead: {
    from_street: string | null;
    from_plz: string | null;
    from_city: string | null;
    to_street: string | null;
    to_plz: string | null;
    to_city: string | null;
  } | null;
}

interface CompanyInfo {
  id: string;
  company_name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  email: string;
  phone?: string | null;
  street?: string | null;
  plz?: string | null;
  city?: string | null;
  mwst_number?: string | null;
  iban?: string | null;
  bank_name?: string | null;
  bewertungs_url?: string | null;
}

function buildDefaultPositionen(): QuittungPosition[] {
  return [
    ...PREDEFINED_POSITIONEN.map(p => ({ ...p, id: uuidv4() })),
    ...Array.from({ length: CUSTOM_ROW_COUNT }, () => ({
      id: uuidv4(), beschreibung: "", satz: "", betrag: 0,
      checked: false, is_custom: true,
    })),
  ];
}

interface AuftragPrefillItem {
  description?: string;
  beschreibung?: string;
  quantity?: number;
  unit?: string | null;
  unit_price?: number;
  total?: number | null;
}

interface FromAuftragPrefill {
  auftragId?: string | null;
  offerId: string | null;
  customerName?: string;
  customerAddress?: string;
  customerDestination?: string;
  customerEmail?: string;
  customerPhone?: string;
  items?: AuftragPrefillItem[];
  extraServices?: AuftragPrefillItem[];
}

/** Blob → base64 (without the data: prefix), for the email attachment. */
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export default function QuittungDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "neu";
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const prefillAppliedRef = useRef(false);

  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [quittungId, setQuittungId] = useState<string | null>(isNew ? null : (id ?? null));

  // Form state
  const [datum, setDatum] = useState(new Date().toISOString().split("T")[0]);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerDestination, setCustomerDestination] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [positionen, setPositionen] = useState<QuittungPosition[]>(buildDefaultPositionen);
  const [mwstSatz, setMwstSatz] = useState(8.1);
  const [rabatt, setRabatt] = useState(0);
  const [betragNochOffen, setBetragNochOffen] = useState(false);
  const [notiz, setNotiz] = useState("");
  const [status, setStatus] = useState<QuittungStatus>("draft");
  const [quittungNr, setQuittungNr] = useState<string>("");
  const [kundeSignatur, setKundeSignatur] = useState<string | null>(null);
  const [teamchefSignatur, setTeamchefSignatur] = useState<string | null>(null);
  const [kundeSignedAt, setKundeSignedAt] = useState<string | null>(null);
  const [teamchefSignedAt, setTeamchefSignedAt] = useState<string | null>(null);

  const [linkedOfferId, setLinkedOfferId] = useState<string | null>(null);
  const [linkedAuftragId, setLinkedAuftragId] = useState<string | null>(null);
  const [offerOptions, setOfferOptions] = useState<OfferOption[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);

  const kundeSignRef = useRef<SignaturePadRef>(null);
  const teamSignRef = useRef<SignaturePadRef>(null);

  const totals = calculateTotals(positionen, mwstSatz, rabatt);

  // Single source: PDF download, preview and email attachment all use the same data (prevents drift).
  const buildQuittungData = (): Quittung => ({
    id: quittungId || "",
    company_id: company?.id ?? "",
    offer_id: linkedOfferId,
    quittung_nr: quittungNr,
    datum,
    customer_name: customerName,
    customer_address: customerAddress,
    customer_destination: customerDestination,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    positionen,
    mwst_satz: mwstSatz,
    rabatt,
    betrag_noch_offen: betragNochOffen,
    notiz,
    status,
    ...totals,
    kunde_unterschrift: kundeSignatur,
    teamchef_unterschrift: teamchefSignatur,
    kunde_signed_at: kundeSignedAt,
    teamchef_signed_at: teamchefSignedAt,
    pdf_url: null,
    created_at: "",
    updated_at: "",
  });

  // Load company + pre-fetch logo as base64 so @react-pdf/renderer can embed it (bypasses CORS)
  useEffect(() => {
    if (!user?.id) return;
    fetchSingleCompanyForUser<CompanyInfo>({
      userId: user.id,
      userEmail: user.email,
      select: "id, company_name, logo_url, primary_color, email, phone, street, plz, city, mwst_number, iban, bank_name, bewertungs_url",
    }).then(async c => {
      if (!c) return;
      setCompany(c);
      const b64 = await logoToBase64(c.logo_url);
      if (b64) setLogoBase64(b64);
    });
  }, [user?.id, user?.email]);

  // Load offers for linking
  const loadOffers = useCallback(async (companyId: string) => {
    setOffersLoading(true);
    const { data } = await supabase
      .from("offers")
      .select(`
        id, offer_number,
        customer_first_name, customer_last_name, customer_email, customer_phone,
        leads(from_street, from_plz, from_city, to_street, to_plz, to_city)
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) {
      setOfferOptions(data.map(o => ({
        id: o.id,
        offer_number: o.offer_number || o.id.substring(0, 8),
        customer_first_name: o.customer_first_name,
        customer_last_name: o.customer_last_name,
        customer_email: o.customer_email,
        customer_phone: o.customer_phone,
        lead: Array.isArray(o.leads)
          ? (o.leads[0] ?? null)
          : (o.leads ?? null),
      })));
    }
    setOffersLoading(false);
  }, []);

  useEffect(() => {
    if (company?.id) loadOffers(company.id);
  }, [company?.id, loadOffers]);

  const applyOfferData = useCallback((offerId: string) => {
    const offer = offerOptions.find(o => o.id === offerId);
    if (!offer) return;
    const name = [offer.customer_first_name, offer.customer_last_name].filter(Boolean).join(" ");
    if (name) setCustomerName(name);
    if (offer.customer_email) setCustomerEmail(offer.customer_email);
    if (offer.customer_phone) setCustomerPhone(offer.customer_phone);
    if (offer.lead) {
      const from = [offer.lead.from_street, [offer.lead.from_plz, offer.lead.from_city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      const to = [offer.lead.to_street, [offer.lead.to_plz, offer.lead.to_city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      if (from) setCustomerAddress(from);
      if (to) setCustomerDestination(to);
    }
    setLinkedOfferId(offerId);
  }, [offerOptions]);

  // Load existing quittung
  const loadQuittung = useCallback(async () => {
    if (isNew || !id) { setIsLoading(false); return; }
    const { data, error } = await supabase
      .from("quittungen").select("*").eq("id", id).single();
    if (error || !data) {
      toast({ title: "Nicht gefunden", variant: "destructive" });
      navigate("/firma/quittungen");
      return;
    }
    const q = data as unknown as Quittung;
    if (q.offer_id) setLinkedOfferId(q.offer_id);
    if (q.auftrag_id) setLinkedAuftragId(q.auftrag_id);
    setDatum(q.datum);
    setCustomerName(q.customer_name || "");
    setCustomerAddress(q.customer_address || "");
    setCustomerDestination(q.customer_destination || "");
    setCustomerEmail(q.customer_email || "");
    setCustomerPhone(q.customer_phone || "");
    setPositionen(Array.isArray(q.positionen) && q.positionen.length > 0
      ? q.positionen
      : buildDefaultPositionen());
    setRabatt(q.rabatt || 0);
    // Restore the stored VAT rate; only new receipts default to 8.1 (pre-2024 receipts
    // may carry 7.7 or 0 — recomputing at 8.1 would silently rewrite a signed receipt).
    setMwstSatz(q.mwst_satz ?? 8.1);
    setBetragNochOffen(q.betrag_noch_offen || false);
    setNotiz(q.notiz || "");
    setStatus(q.status);
    setQuittungNr(q.quittung_nr || "");
    setKundeSignatur(q.kunde_unterschrift || null);
    setTeamchefSignatur(q.teamchef_unterschrift || null);
    setKundeSignedAt(q.kunde_signed_at || null);
    setTeamchefSignedAt(q.teamchef_signed_at || null);
    setIsLoading(false);
  }, [id, isNew, navigate, toast]);

  useEffect(() => { loadQuittung(); }, [loadQuittung]);

  // Prefill aus einem Auftrag (Auftrag → Quittung Brücke). Nur einmal, nur bei Neuanlage.
  useEffect(() => {
    if (!isNew || prefillAppliedRef.current) return;
    const fa = (location.state as { fromAuftrag?: FromAuftragPrefill } | null)?.fromAuftrag;
    if (!fa) return;
    prefillAppliedRef.current = true;

    if (fa.customerName) setCustomerName(fa.customerName);
    if (fa.customerAddress) setCustomerAddress(fa.customerAddress);
    if (fa.customerDestination) setCustomerDestination(fa.customerDestination);
    if (fa.customerEmail) setCustomerEmail(fa.customerEmail);
    if (fa.customerPhone) setCustomerPhone(fa.customerPhone);
    if (fa.offerId) setLinkedOfferId(fa.offerId);
    if (fa.auftragId) setLinkedAuftragId(fa.auftragId);

    const toRow = (it: AuftragPrefillItem): QuittungPosition => {
      const qty = it.quantity ?? 1;
      const unitPrice = it.unit_price ?? 0;
      const betrag = it.total ?? qty * unitPrice;
      return {
        id: uuidv4(),
        beschreibung: it.description ?? it.beschreibung ?? "",
        satz: it.unit ? `${qty} ${it.unit}` : "",
        betrag: Math.round((betrag || 0) * 100) / 100,
        checked: true,
        is_custom: true,
      };
    };

    const mapped = [...(fa.items ?? []), ...(fa.extraServices ?? [])]
      .filter((it) => (it.description ?? it.beschreibung ?? "").trim().length > 0)
      .map(toRow);

    if (mapped.length > 0) {
      // Vordefinierte (ungekreuzte) Zeilen behalten, gemappte Auftrag-Positionen anhängen
      setPositionen((prev) => [...prev.filter((p) => !p.is_custom), ...mapped]);
    }

    // State leeren, damit ein Reload die Prefill nicht erneut anwendet
    navigate(location.pathname, { replace: true, state: null });
  }, [isNew, location.state, location.pathname, navigate]);

  // Position helpers
  const updatePosition = (pos: Partial<QuittungPosition> & { id: string }) => {
    setPositionen(prev => prev.map(p => p.id === pos.id ? { ...p, ...pos } : p));
  };

  const addCustomRow = () => {
    setPositionen(prev => [...prev, {
      id: uuidv4(), beschreibung: "", satz: "", betrag: 0,
      checked: false, is_custom: true,
    }]);
  };

  const removeCustomRow = (posId: string) => {
    setPositionen(prev => prev.filter(p => p.id !== posId || !p.is_custom));
  };

  // Save
  const save = async (newStatus?: QuittungStatus): Promise<string | null> => {
    if (!company?.id) return null;
    setIsSaving(true);
    const payload = {
      company_id: company.id,
      offer_id: linkedOfferId ?? undefined,
      auftrag_id: linkedAuftragId ?? undefined,
      datum,
      customer_name: customerName,
      customer_address: customerAddress || null,
      customer_destination: customerDestination || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      positionen: positionen as unknown as never,
      zwischensumme: totals.zwischensumme,
      mwst_satz: mwstSatz,
      mwst_betrag: totals.mwst_betrag,
      total: totals.total,
      rabatt,
      gesamttotal: totals.gesamttotal,
      betrag_noch_offen: betragNochOffen,
      notiz: notiz || null,
      status: newStatus ?? status,
      kunde_unterschrift: kundeSignatur,
      teamchef_unterschrift: teamchefSignatur,
      kunde_signed_at: kundeSignedAt,
      teamchef_signed_at: teamchefSignedAt,
    };

    let savedId = quittungId;
    if (quittungId) {
      const { error } = await supabase
        .from("quittungen").update(payload).eq("id", quittungId);
      if (error) {
        toast({ title: "Fehler", description: error.message, variant: "destructive" });
        setIsSaving(false);
        return null;
      }
    } else {
      const { data, error } = await supabase
        .from("quittungen").insert(payload).select("id, quittung_nr").single();
      if (error || !data) {
        toast({ title: "Fehler", description: error?.message, variant: "destructive" });
        setIsSaving(false);
        return null;
      }
      savedId = data.id;
      setQuittungId(data.id);
      setQuittungNr((data as { id: string; quittung_nr: string }).quittung_nr);
    }
    if (newStatus) setStatus(newStatus);
    setIsSaving(false);
    return savedId;
  };

  const handleSaveDraft = async () => {
    const savedId = await save("draft");
    if (savedId) toast({ title: "Entwurf gespeichert" });
  };

  const handleConfirmSignatures = async () => {
    // Capture from pads if not yet confirmed
    if (!kundeSignatur && kundeSignRef.current && !kundeSignRef.current.isEmpty()) {
      const sig = kundeSignRef.current.toDataURL();
      setKundeSignatur(sig);
      setKundeSignedAt(new Date().toISOString());
    }
    if (!teamchefSignatur && teamSignRef.current && !teamSignRef.current.isEmpty()) {
      const sig = teamSignRef.current.toDataURL();
      setTeamchefSignatur(sig);
      setTeamchefSignedAt(new Date().toISOString());
    }
    const newStatus: QuittungStatus = "signed";
    const savedId = await save(newStatus);
    if (savedId) {
      toast({ title: "Quittung unterzeichnet!", description: "Beide Unterschriften gespeichert." });
    }
  };

  const handleSendEmail = async () => {
    const savedId = await save();
    if (!savedId || !company) return;
    setIsSendingEmail(true);
    try {
      // Generate the PDF client-side (react-pdf) → base64 → send it as an attachment to send-quittung.
      const blob = await pdf(
        <QuittungPDF
          quittung={buildQuittungData()}
          company={{ ...company, logo_url: logoBase64 ?? company.logo_url }}
        />
      ).toBlob();
      const quittungPdfBase64 = await blobToBase64(blob);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Nicht angemeldet");
      const { error } = await supabase.functions.invoke("send-quittung", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { quittungId: savedId, quittungPdfBase64 },
      });
      if (error) throw error;
      // send-quittung sets the status to 'sent' on the server — here only the local UI is updated.
      setStatus("sent");
      toast({ title: "Quittung versendet!", description: `E-Mail an ${customerEmail} gesendet.` });
    } catch (e) {
      toast({ title: "Fehler beim Versenden", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
    );
  }

  const cfg = STATUS_CONFIG[status];
  const predefined = positionen.filter(p => !p.is_custom);
  const custom = positionen.filter(p => p.is_custom);
  const isSigned = status === "signed" || status === "sent" || status === "paid";

  return (
    <>
      <Helmet><title>{isNew ? "Neue Quittung" : `Quittung ${quittungNr}`} | Firma</title></Helmet>
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Folk-style header */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/firma/quittungen")}
              className="h-9 gap-1.5 rounded-md text-folk-ink3 hover:bg-folk-bg-warm hover:text-folk-ink2"
            >
              <ArrowLeft className="h-4 w-4" /> Zurück
            </Button>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl leading-none">🧾</span>
              <div>
                <h1 className="text-[17px] font-bold tracking-tight text-folk-ink">
                  {isNew ? "Neue Quittung" : `Quittung ${quittungNr || ""}`}
                </h1>
              </div>
            </div>
            <div className="flex-1" />
            {quittungNr && !isNew && (
              <span className="font-mono text-[11px] text-folk-ink4">{quittungNr}</span>
            )}
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
            {showPdfPreview ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPdfPreview(false)}
                className="h-9 rounded-lg border-folk-line bg-folk-card px-3 text-[12.5px] text-folk-ink2 hover:bg-folk-bg-warm"
              >
                Formular
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => { await save(); setShowPdfPreview(true); }}
                className="h-9 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-[12.5px] text-folk-ink2 hover:bg-folk-bg-warm"
              >
                <FileText className="h-4 w-4" /> PDF-Vorschau
              </Button>
            )}
          </div>

          {/* PDF Preview */}
          {showPdfPreview && company && (
            <QuittungPDFPreview
              quittung={buildQuittungData()}
              company={{ ...company, logo_url: logoBase64 ?? company.logo_url }}
            />
          )}

          {/* Form */}
          <div className="rounded-xl border border-folk-line bg-folk-card">
            <div className="space-y-6 p-4 md:p-6">

              {/* ── Header Section ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Kundendaten</h3>
                  <div>
                    <Label className="text-xs">Name *</Label>
                    <Input value={customerName} onChange={e => setCustomerName(e.target.value)}
                      placeholder="Vor- und Nachname" className="mt-1 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Adresse (Von)</Label>
                    <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)}
                      placeholder="Strasse Nr, PLZ Ort" className="mt-1 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Adresse (Nach)</Label>
                    <Input value={customerDestination} onChange={e => setCustomerDestination(e.target.value)}
                      placeholder="Strasse Nr, PLZ Ort" className="mt-1 h-9 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">E-Mail</Label>
                      <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)}
                        type="email" placeholder="kunde@email.ch" className="mt-1 h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Telefon</Label>
                      <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                        placeholder="+41 79 000 00 00" className="mt-1 h-9 text-sm" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Quittung-Details</h3>

                  {/* Von Offerte laden */}
                  <div>
                    <Label className="text-xs flex items-center gap-1.5">
                      <Link2 className="w-3 h-3" /> Von Offerte laden
                    </Label>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Select
                        value={linkedOfferId ?? ""}
                        onValueChange={v => v ? applyOfferData(v) : setLinkedOfferId(null)}
                        disabled={offersLoading}
                      >
                        <SelectTrigger className="h-9 text-sm flex-1">
                          <SelectValue placeholder={offersLoading ? "Lädt…" : "Offerte auswählen…"} />
                        </SelectTrigger>
                        <SelectContent>
                          {offerOptions.map(o => (
                            <SelectItem key={o.id} value={o.id}>
                              <span className="font-mono text-xs mr-2 text-slate-500">{o.offer_number}</span>
                              {[o.customer_first_name, o.customer_last_name].filter(Boolean).join(" ") || "–"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {linkedOfferId && (
                        <button
                          onClick={() => setLinkedOfferId(null)}
                          className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                          title="Verknüpfung aufheben"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {linkedOfferId && (
                      <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Kundendaten aus Offerte geladen
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Datum *</Label>
                    <DatePicker value={datum} onChange={(value) => setDatum(value)}
                      className="mt-1 h-9 text-sm" />
                  </div>
                  {quittungNr && (
                    <div>
                      <Label className="text-xs">Quittung-Nr.</Label>
                      <Input value={quittungNr} readOnly className="mt-1 h-9 text-sm bg-slate-50 font-mono" />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Notiz (intern)</Label>
                    <Textarea value={notiz} onChange={e => setNotiz(e.target.value)}
                      placeholder="Interne Notiz..." rows={3} className="mt-1 text-sm resize-none" />
                  </div>
                </div>
              </div>

              {/* ── Line Items ── */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Leistungen</h3>
                <div className="rounded-xl border border-slate-200 overflow-hidden">

                  {/* Desktop header — hidden on mobile */}
                  <div className="hidden sm:grid sm:grid-cols-[2rem_1fr_1fr_7rem_2rem] gap-3 bg-slate-800 text-white text-[10px] font-semibold uppercase tracking-wider px-3 py-2">
                    <div className="flex items-center justify-center">✓</div>
                    <div>Beschreibung</div>
                    <div>Satz / Bemerkung</div>
                    <div className="text-right">Betrag CHF</div>
                    <div />
                  </div>

                  {/* Predefined rows */}
                  {predefined.map(pos => (
                    <div key={pos.id}
                      className={`border-b border-slate-100 last:border-0 transition-opacity ${!pos.checked ? "opacity-50" : ""}`}>

                      {/* Mobile layout */}
                      <div className="sm:hidden px-3 py-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Checkbox checked={pos.checked}
                              onCheckedChange={v => updatePosition({ id: pos.id, checked: !!v })}
                              className="size-4 shrink-0" />
                            <span className="text-sm font-medium text-slate-800 truncate">{pos.beschreibung}</span>
                          </div>
                          <Input
                            type="number" min="0" step="0.01"
                            value={pos.betrag || ""}
                            onChange={e => updatePosition({ id: pos.id, betrag: parseFloat(e.target.value) || 0 })}
                            className="h-8 w-24 text-sm text-right shrink-0"
                            placeholder="0.00" />
                        </div>
                        <Input value={pos.satz}
                          onChange={e => updatePosition({ id: pos.id, satz: e.target.value })}
                          placeholder="Satz / Bemerkung (z.B. 3 Std. × CHF 50)"
                          className="h-8 text-xs w-full" />
                      </div>

                      {/* Desktop layout */}
                      <div className="hidden sm:grid sm:grid-cols-[2rem_1fr_1fr_7rem_2rem] gap-3 items-center px-3 py-2">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={pos.checked}
                            onCheckedChange={v => updatePosition({ id: pos.id, checked: !!v })}
                            className="size-4 shrink-0" />
                        </div>
                        <span className="text-sm font-medium text-slate-800">{pos.beschreibung}</span>
                        <Input value={pos.satz}
                          onChange={e => updatePosition({ id: pos.id, satz: e.target.value })}
                          placeholder="z.B. 3 Std. × CHF 50"
                          className="h-7 text-xs border-0 bg-slate-50 px-2" />
                        <Input
                          type="number" min="0" step="0.01"
                          value={pos.betrag || ""}
                          onChange={e => updatePosition({ id: pos.id, betrag: parseFloat(e.target.value) || 0 })}
                          className="h-7 text-xs text-right border-0 bg-slate-50 px-2" />
                        <div />
                      </div>
                    </div>
                  ))}

                  {/* Custom rows separator */}
                  <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 border-t border-t-slate-200">
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Zusatzleistungen</span>
                  </div>

                  {/* Custom rows */}
                  {custom.map(pos => (
                    <div key={pos.id} className="border-b border-slate-100 last:border-0">

                      {/* Mobile layout */}
                      <div className="sm:hidden px-3 py-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Checkbox checked={pos.checked}
                              onCheckedChange={v => updatePosition({ id: pos.id, checked: !!v })}
                              className="size-4 shrink-0" />
                            <Input value={pos.beschreibung}
                              onChange={e => updatePosition({ id: pos.id, beschreibung: e.target.value })}
                              placeholder="Beschreibung..."
                              className="h-8 text-sm flex-1 min-w-0" />
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Input
                              type="number" min="0" step="0.01"
                              value={pos.betrag || ""}
                              onChange={e => updatePosition({ id: pos.id, betrag: parseFloat(e.target.value) || 0 })}
                              className="h-8 w-24 text-sm text-right"
                              placeholder="0.00" />
                            <button onClick={() => removeCustomRow(pos.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <Input value={pos.satz}
                          onChange={e => updatePosition({ id: pos.id, satz: e.target.value })}
                          placeholder="Satz / Bemerkung"
                          className="h-8 text-xs w-full" />
                      </div>

                      {/* Desktop layout */}
                      <div className="hidden sm:grid sm:grid-cols-[2rem_1fr_1fr_7rem_2rem] gap-3 items-center px-3 py-2">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={pos.checked}
                            onCheckedChange={v => updatePosition({ id: pos.id, checked: !!v })}
                            className="size-4 shrink-0" />
                        </div>
                        <Input value={pos.beschreibung}
                          onChange={e => updatePosition({ id: pos.id, beschreibung: e.target.value })}
                          placeholder="Beschreibung..."
                          className="h-7 text-xs border-0 bg-transparent px-1" />
                        <Input value={pos.satz}
                          onChange={e => updatePosition({ id: pos.id, satz: e.target.value })}
                          placeholder="Satz / Bemerkung"
                          className="h-7 text-xs border-0 bg-transparent px-1" />
                        <Input
                          type="number" min="0" step="0.01"
                          value={pos.betrag || ""}
                          onChange={e => updatePosition({ id: pos.id, betrag: parseFloat(e.target.value) || 0 })}
                          className="h-7 text-xs text-right border-0 bg-transparent px-1" />
                        <div className="flex justify-center">
                          <button onClick={() => removeCustomRow(pos.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add row */}
                  <div className="px-3 py-2.5 bg-slate-50">
                    <button onClick={addCustomRow}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-600 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Zeile hinzufügen
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Totals — only shown when not draft (draft = on-site, worker fills by hand) ── */}
              {status !== "draft" && (
                <div className="flex justify-end">
                  <div className="w-full max-w-xs space-y-1.5 rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Zwischensumme:</span>
                      <span>{formatChf(totals.zwischensumme)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <span>Rabatt:</span>
                        <Input type="number" min="0" step="0.01" value={rabatt || ""}
                          onChange={e => setRabatt(parseFloat(e.target.value) || 0)}
                          className="h-6 w-20 text-xs text-right py-0 px-1.5" />
                      </div>
                      <span>-{formatChf(rabatt)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>MwSt. ({mwstSatz}%):</span>
                      <span>{formatChf(totals.mwst_betrag)}</span>
                    </div>
                    <div className="border-t border-slate-300 pt-1.5 flex justify-between font-bold text-base text-slate-900">
                      <span>Gesamttotal:</span>
                      <span className="text-emerald-700">{formatChf(totals.gesamttotal)}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox id="betrag-offen" checked={betragNochOffen}
                        onCheckedChange={v => setBetragNochOffen(!!v)} />
                      <label htmlFor="betrag-offen" className="text-xs text-slate-600 cursor-pointer">
                        Betrag noch offen
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Signatures ── */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Unterschriften</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SignaturePad
                    ref={kundeSignRef}
                    label="Datum / Unterschrift Kunde"
                    existingSignature={kundeSignatur}
                    signedAt={kundeSignedAt}
                    disabled={isSigned}
                    onConfirm={sig => {
                      setKundeSignatur(sig);
                      setKundeSignedAt(new Date().toISOString());
                    }}
                    onClear={() => { setKundeSignatur(null); setKundeSignedAt(null); }}
                  />
                  <SignaturePad
                    ref={teamSignRef}
                    label="Datum / Unterschrift Teamchef"
                    existingSignature={teamchefSignatur}
                    signedAt={teamchefSignedAt}
                    disabled={isSigned}
                    onConfirm={sig => {
                      setTeamchefSignatur(sig);
                      setTeamchefSignedAt(new Date().toISOString());
                    }}
                    onClear={() => { setTeamchefSignatur(null); setTeamchefSignedAt(null); }}
                  />
                </div>
              </div>

              {/* ── Footer Info ── */}
              {company && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1">
                  <p className="text-center text-sm font-semibold text-slate-600">
                    VIELEN DANK FÜR IHREN GESCHÄTZTEN AUFTRAG!
                  </p>
                  {company.bewertungs_url && (
                    <p className="text-center text-xs text-slate-500">
                      Bewertung: <a href={company.bewertungs_url} className="underline text-emerald-600" target="_blank" rel="noreferrer">{company.bewertungs_url}</a>
                    </p>
                  )}
                  <div className="flex items-center justify-center gap-4 text-xs text-slate-500 pt-1 flex-wrap">
                    {company.iban && <span>IBAN: {company.iban}</span>}
                    {company.bank_name && <span>{company.bank_name}</span>}
                    {company.mwst_number && <span>MwSt-Nr: {company.mwst_number}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pb-6">
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Entwurf speichern
            </Button>

            {/* PDF Download */}
            {company && (
              <PDFDownloadLink
                document={
                  <QuittungPDF
                    quittung={buildQuittungData()}
                    company={{ ...company, logo_url: logoBase64 ?? company.logo_url }}
                  />
                }
                fileName={`Quittung-${quittungNr || "entwurf"}.pdf`}
              >
                {({ loading }) => (
                  <Button variant="outline" disabled={loading}>
                    {loading
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <Download className="w-4 h-4 mr-2" />}
                    {loading ? "Erstelle PDF…" : "PDF herunterladen"}
                  </Button>
                )}
              </PDFDownloadLink>
            )}

            {!isSigned && (
              <Button
                onClick={handleConfirmSignatures}
                disabled={isSaving || (!kundeSignatur && !teamchefSignatur)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Unterschriften bestätigen
              </Button>
            )}

            {(status === "signed" || status === "draft") && customerEmail && (
              <Button onClick={handleSendEmail} disabled={isSendingEmail || isSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {isSendingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Per E-Mail versenden
              </Button>
            )}
          </div>
        </div>
    </>
  );
}
