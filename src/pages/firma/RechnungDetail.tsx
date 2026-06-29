import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Download, Plus, Trash2, CheckCircle, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useRechnungen, positionenToJson, type RechnungInsert } from "@/hooks/useRechnungen";
import {
  buildRechnungDoc, downloadRechnungPdf, type RechnungCompany, type RechnungData, type RechnungPosition,
} from "@/lib/generateRechnungPdf";
import { computeQrReference, type NeueRechnung } from "@/lib/erstelleRechnung";
import { logoToBase64 } from "@/lib/logoToBase64";
import {
  RECHNUNG_STATUS_LABELS, RECHNUNG_STATUS_COLORS, allowedRechnungTargets,
  isRechnungStatus, type RechnungStatus,
} from "@/lib/rechnungStatus";
import { formatChf } from "@/types/quittung.types";

interface CompanyInfo {
  id: string;
  company_name: string;
  street: string | null;
  house_number: string | null;
  plz: string;
  city: string;
  phone: string | null;
  email: string;
  website: string | null;
  mwst_number: string | null;
  iban: string | null;
  logo_url: string | null;
}

type EditPosition = RechnungPosition & { _key: string };

const todayIso = (): string => new Date().toISOString().split("T")[0];

const addDaysIso = (iso: string, days: number): string => {
  // UTC üzerinden hesapla: local parse + UTC format takvim gününü kaydırıyordu
  // (CH UTC+2'de "datum + 30" sonucu 29 güne düşüyordu).
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
};

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const newRow = (): EditPosition => ({
  _key: uuidv4(), beschreibung: "", menge: 1, einheit: null, einzelpreis: 0, betrag: 0,
});

const withKeys = (positionen: RechnungPosition[]): EditPosition[] =>
  positionen.map((p) => ({ ...p, _key: uuidv4() }));

const stripKey = (p: EditPosition): RechnungPosition => {
  const { _key, ...rest } = p;
  void _key;
  return rest;
};

export default function RechnungDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "neu";
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const prefillAppliedRef = useRef(false);

  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const { createRechnung, updateRechnung } = useRechnungen(company?.id);

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [rechnungId, setRechnungId] = useState<string | null>(isNew ? null : id ?? null);

  // Form state
  const [datum, setDatum] = useState(todayIso());
  const [faelligAm, setFaelligAm] = useState(addDaysIso(todayIso(), 30));
  // Kullanıcı faellig'i elle değiştirdi mi? false ise datum değişince datum+30 takip eder.
  const [faelligTouched, setFaelligTouched] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerDestination, setCustomerDestination] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [positionen, setPositionen] = useState<EditPosition[]>([newRow()]);
  const [mwstSatz, setMwstSatz] = useState(8.1);
  const [notiz, setNotiz] = useState("");
  const [status, setStatus] = useState<RechnungStatus>("entwurf");
  const [rechnungNr, setRechnungNr] = useState("");
  const [qrReferenz, setQrReferenz] = useState<string | null>(null);
  const [qrIban, setQrIban] = useState<string | null>(null);
  const [linkedOfferId, setLinkedOfferId] = useState<string | null>(null);
  const [linkedAuftragId, setLinkedAuftragId] = useState<string | null>(null);

  // Totals (live)
  const zwischensumme = round2(positionen.reduce((s, p) => s + (p.betrag || 0), 0));
  const mwstBetrag = round2((zwischensumme * mwstSatz) / 100);
  const total = round2(zwischensumme + mwstBetrag);

  // Load company
  useEffect(() => {
    if (!user?.id) return;
    fetchSingleCompanyForUser<CompanyInfo>({
      userId: user.id,
      userEmail: user.email,
      select: "id, company_name, street, house_number, plz, city, phone, email, website, mwst_number, iban, logo_url",
    }).then((c) => {
      if (c) setCompany(c);
    });
  }, [user?.id, user?.email]);

  // Load existing rechnung
  const loadRechnung = useCallback(async () => {
    if (isNew || !id) {
      setIsLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("rechnungen").select("*").eq("id", id).single();
    if (error || !data) {
      toast({ title: "Nicht gefunden", variant: "destructive" });
      navigate("/firma/rechnungen");
      return;
    }
    setDatum(data.datum);
    setFaelligAm(data.faellig_am);
    setFaelligTouched(true); // kayıtlı değer korunur (datum değişse de override edilmez)
    setCustomerName(data.customer_name || "");
    setCustomerAddress(data.customer_address || "");
    setCustomerDestination(data.customer_destination || "");
    setCustomerEmail(data.customer_email || "");
    setCustomerPhone(data.customer_phone || "");
    setPositionen(withKeys((data.positionen as unknown as RechnungPosition[]) ?? []));
    setMwstSatz(data.mwst_satz);
    setNotiz(data.notiz || "");
    setStatus(isRechnungStatus(data.status) ? data.status : "entwurf");
    setRechnungNr(data.rechnung_nr || "");
    setQrReferenz(data.qr_referenz);
    setQrIban(data.qr_iban);
    setLinkedOfferId(data.offer_id);
    setLinkedAuftragId(data.auftrag_id);
    setIsLoading(false);
  }, [id, isNew, navigate, toast]);

  useEffect(() => { loadRechnung(); }, [loadRechnung]);

  // Prefill aus einem Auftrag (erstelleRechnungAusAuftrag-Ergebnis via location.state).
  useEffect(() => {
    if (!isNew || prefillAppliedRef.current) return;
    const fr = (location.state as { fromRechnung?: NeueRechnung } | null)?.fromRechnung;
    if (!fr) return;
    prefillAppliedRef.current = true;

    setCustomerName(fr.customer_name || "");
    if (fr.customer_address) setCustomerAddress(fr.customer_address);
    if (fr.customer_destination) setCustomerDestination(fr.customer_destination);
    if (fr.customer_email) setCustomerEmail(fr.customer_email);
    if (fr.customer_phone) setCustomerPhone(fr.customer_phone);
    setMwstSatz(fr.mwst_satz);
    setQrIban(fr.qr_iban);
    setLinkedOfferId(fr.offer_id);
    setLinkedAuftragId(fr.auftrag_id);
    if (fr.positionen.length > 0) setPositionen(withKeys(fr.positionen));

    navigate(location.pathname, { replace: true, state: null });
  }, [isNew, location.state, location.pathname, navigate]);

  // Position helpers — menge/einzelpreis değişince betrag otomatik hesaplanır
  const updatePosition = (key: string, changes: Partial<RechnungPosition>) => {
    setPositionen((prev) =>
      prev.map((p) => {
        if (p._key !== key) return p;
        const merged = { ...p, ...changes };
        if (("menge" in changes || "einzelpreis" in changes) && !("betrag" in changes)) {
          merged.betrag = round2((merged.menge ?? 0) * (merged.einzelpreis ?? 0));
        }
        return merged;
      }),
    );
  };

  const addRow = () => setPositionen((prev) => [...prev, newRow()]);
  const removeRow = (key: string) => setPositionen((prev) => prev.filter((p) => p._key !== key));

  const pdfCompany = (): RechnungCompany | null =>
    company
      ? {
          company_name: company.company_name,
          street: company.street,
          house_number: company.house_number,
          plz: company.plz,
          city: company.city,
          phone: company.phone,
          email: company.email,
          website: company.website,
          mwst_number: company.mwst_number,
          iban: qrIban || company.iban || "",
        }
      : null;

  const buildPdfData = (override?: { rechnungNr?: string; qrReferenz?: string | null }): RechnungData | null => {
    const c = pdfCompany();
    if (!c) return null;
    return {
      rechnung_nr: override?.rechnungNr || rechnungNr || "ENTWURF",
      datum,
      faellig_am: faelligAm,
      customer_name: customerName,
      customer_address: customerAddress || null,
      customer_email: customerEmail || null,
      positionen: positionen.map(stripKey),
      zwischensumme,
      mwst_satz: mwstSatz,
      mwst_betrag: mwstBetrag,
      total,
      currency: "CHF",
      qr_referenz: override ? override.qrReferenz ?? null : qrReferenz,
      qr_iban: qrIban || company?.iban || null,
      company: c,
    };
  };

  const buildPayload = (): RechnungInsert | null => {
    if (!company?.id) return null;
    return {
      company_id: company.id,
      auftrag_id: linkedAuftragId,
      offer_id: linkedOfferId,
      datum,
      faellig_am: faelligAm,
      customer_name: customerName,
      customer_address: customerAddress || null,
      customer_destination: customerDestination || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      positionen: positionenToJson(positionen.map(stripKey)),
      zwischensumme,
      mwst_satz: mwstSatz,
      mwst_betrag: mwstBetrag,
      total,
      rabatt: 0,
      gesamttotal: total,
      qr_iban: qrIban || company.iban,
      qr_referenz: qrReferenz,
      status,
    };
  };

  const save = async (): Promise<{ id: string; rechnungNr: string; qrReferenz: string | null } | null> => {
    const payload = buildPayload();
    if (!payload || !company) {
      toast({ title: "Firma nicht geladen", variant: "destructive" });
      return null;
    }
    if (!customerName.trim()) {
      toast({ title: "Kundenname fehlt", variant: "destructive" });
      return null;
    }
    setIsSaving(true);
    try {
      if (rechnungId) {
        const updated = await updateRechnung(rechnungId, payload);
        // Yüklenmiş kayıt: rechnung_nr/qr_referenz state'i zaten güncel (loadRechnung)
        return updated ? { id: rechnungId, rechnungNr, qrReferenz } : null;
      }
      const created = await createRechnung(payload);
      if (!created) return null;
      setRechnungId(created.id);
      setRechnungNr(created.rechnung_nr ?? "");
      // QR referansını gerçek rechnung_nr ile üret (QR-IBAN → QRR)
      const ref = computeQrReference(created.rechnung_nr ?? "", created.qr_iban ?? "");
      let finalRef = created.qr_referenz;
      if (ref && ref !== created.qr_referenz) {
        await updateRechnung(created.id, { qr_referenz: ref });
        setQrReferenz(ref);
        finalRef = ref;
      } else {
        setQrReferenz(created.qr_referenz);
      }
      // setState asenkron → buildPdfData state'ten eski değeri okur; dönüş değeriyle taze numarayı geçir
      return { id: created.id, rechnungNr: created.rechnung_nr ?? "", qrReferenz: finalRef };
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    const saved = await save();
    if (saved) toast({ title: "Rechnung gespeichert" });
  };

  const handleStatusChange = async (next: string) => {
    if (!isRechnungStatus(next) || next === status) return;
    if (!rechnungId) {
      setStatus(next);
      return;
    }
    const updated = await updateRechnung(rechnungId, { status: next });
    if (updated) {
      setStatus(next);
      toast({ title: `Status: ${RECHNUNG_STATUS_LABELS[next]}` });
    }
  };

  const handleDownload = async () => {
    // save-first: rechnung_nr DB trigger'ında INSERT'te üretilir; numarayı dönüş değerinden al
    const saved = await save();
    if (!saved) return;
    const data = buildPdfData({ rechnungNr: saved.rechnungNr, qrReferenz: saved.qrReferenz });
    if (!data) {
      toast({ title: "Firma nicht geladen", variant: "destructive" });
      return;
    }
    if (!data.company.iban) {
      toast({ title: "IBAN fehlt", description: "Bitte IBAN in den Einstellungen hinterlegen.", variant: "destructive" });
      return;
    }
    // QR-Bill creditor structured adres ister — eksikse kriptik "PLZ zorunlu" yerine net uyarı.
    const missingAddr = [!data.company.street?.trim() && "Strasse", !data.company.plz?.trim() && "PLZ", !data.company.city?.trim() && "Ort"].filter(Boolean) as string[];
    if (missingAddr.length > 0) {
      toast({ title: "Firmen-Adresse unvollständig", description: `Bitte ${missingAddr.join(", ")} in den Einstellungen hinterlegen.`, variant: "destructive" });
      return;
    }
    try {
      const logo = company?.logo_url ? await logoToBase64(company.logo_url) : null;
      await downloadRechnungPdf(data, logo);
    } catch (e) {
      toast({ title: "PDF-Fehler", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleSendEmail = async () => {
    if (!customerEmail.trim()) {
      toast({ title: "Keine Kunden-E-Mail", variant: "destructive" });
      return;
    }
    const saved = await save();
    if (!saved) return;
    const data = buildPdfData({ rechnungNr: saved.rechnungNr, qrReferenz: saved.qrReferenz });
    if (!data) return;
    if (!data.company.iban) {
      toast({ title: "IBAN fehlt", description: "Bitte IBAN in den Einstellungen hinterlegen.", variant: "destructive" });
      return;
    }
    const missingAddr = [!data.company.street?.trim() && "Strasse", !data.company.plz?.trim() && "PLZ", !data.company.city?.trim() && "Ort"].filter(Boolean) as string[];
    if (missingAddr.length > 0) {
      toast({ title: "Firmen-Adresse unvollständig", description: `Bitte ${missingAddr.join(", ")} in den Einstellungen hinterlegen.`, variant: "destructive" });
      return;
    }
    if (!company?.id) {
      toast({ title: "Firma nicht geladen", variant: "destructive" });
      return;
    }
    setIsSendingEmail(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) throw new Error("Nicht angemeldet");

      // 1) Signierte Upload-URL von der Edge Function holen (service_role erstellt sie,
      //    leitet den Pfad selbst aus der Rechnung ab → IDOR-Schutz). PDF geht NICHT als
      //    base64 im Body (self-hosted edge-runtime bricht große Bodies ab → 502) und der
      //    Upload läuft über die signierte URL (umgeht die Storage-RLS, die hier client-
      //    seitig nicht greift, weil storage Uploads nicht als Rolle 'authenticated' ausführt).
      const { data: prep, error: prepErr } = await supabase.functions.invoke("send-rechnung-email", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { rechnungId: saved.id, mode: "prepare" },
      });
      if (prepErr) throw prepErr;
      const { path: uploadPath, token: uploadToken } = prep as { path: string; token: string };

      // 2) PDF erzeugen und über die signierte URL hochladen.
      const logo = company.logo_url ? await logoToBase64(company.logo_url) : null;
      const doc = await buildRechnungDoc(data, logo);
      const pdfBlob = doc.output("blob");
      const { error: uploadErr } = await supabase.storage
        .from("document-pdfs")
        .uploadToSignedUrl(uploadPath, uploadToken, pdfBlob, { contentType: "application/pdf" });
      if (uploadErr) throw new Error(`Anhang-Upload fehlgeschlagen: ${uploadErr.message}`);

      // 3) Versand auslösen — Edge lädt das PDF, hängt es an, sendet und löscht es.
      const { error } = await supabase.functions.invoke("send-rechnung-email", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { rechnungId: saved.id },
      });
      if (error) throw error;
      setStatus("versendet");
      toast({ title: "Rechnung versendet", description: `E-Mail an ${customerEmail} gesendet.` });
    } catch (e) {
      toast({ title: "Fehler beim Versenden", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin text-folk-coral" />
      </div>
    );
  }

  const statusOptions = allowedRechnungTargets(status);

  return (
    <>
      <Helmet><title>{isNew ? "Neue Rechnung" : `Rechnung ${rechnungNr}`} · CRM</title></Helmet>
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/firma/rechnungen")} className="h-9 gap-1.5 rounded-md text-folk-ink3 hover:bg-folk-bg-warm hover:text-folk-ink2">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </Button>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl leading-none">📄</span>
            <h1 className="text-[17px] font-bold tracking-tight text-folk-ink">
              {isNew ? "Neue Rechnung" : `Rechnung ${rechnungNr || ""}`}
            </h1>
          </div>
          <div className="flex-1" />
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${RECHNUNG_STATUS_COLORS[status]}`}>
            {RECHNUNG_STATUS_LABELS[status]}
          </span>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-folk-line bg-folk-card">
          <div className="space-y-6 p-4 md:p-6">
            {/* Kunde + Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Kundendaten</h3>
                <div>
                  <Label className="text-xs">Name *</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Vor- und Nachname" className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Adresse</Label>
                  <Textarea
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder={"Strasse Nr.\nPLZ Ort"}
                    rows={2}
                    className="mt-1 text-sm resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">E-Mail</Label>
                    <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} type="email" placeholder="kunde@email.ch" className="mt-1 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Telefon</Label>
                    <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+41 79 000 00 00" className="mt-1 h-9 text-sm" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Rechnungs-Details</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Datum</Label>
                    <Input type="date" value={datum} onChange={(e) => {
                      const v = e.target.value;
                      setDatum(v);
                      if (!faelligTouched && v) setFaelligAm(addDaysIso(v, 30));
                    }} className="mt-1 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Fällig am</Label>
                    <Input type="date" value={faelligAm} onChange={(e) => { setFaelligAm(e.target.value); setFaelligTouched(true); }} className="mt-1 h-9 text-sm" />
                  </div>
                </div>
                {rechnungNr && (
                  <div>
                    <Label className="text-xs">Rechnung-Nr.</Label>
                    <Input value={rechnungNr} readOnly className="mt-1 h-9 text-sm bg-slate-50 font-mono" />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>{RECHNUNG_STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Notiz (intern)</Label>
                  <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Interne Notiz..." rows={2} className="mt-1 text-sm resize-none" />
                </div>
              </div>
            </div>

            {/* Positionen */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Positionen</h3>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="hidden sm:grid sm:grid-cols-[1fr_5rem_5rem_6rem_6rem_2rem] gap-2 bg-slate-800 text-white text-[10px] font-semibold uppercase tracking-wider px-3 py-2">
                  <div>Beschreibung</div>
                  <div className="text-right">Menge</div>
                  <div>Einheit</div>
                  <div className="text-right">Einzelpreis</div>
                  <div className="text-right">Betrag</div>
                  <div />
                </div>
                {positionen.map((p) => (
                  <div key={p._key} className="grid grid-cols-1 sm:grid-cols-[1fr_5rem_5rem_6rem_6rem_2rem] gap-2 items-center px-3 py-2 border-b border-slate-100 last:border-0">
                    <Input value={p.beschreibung} onChange={(e) => updatePosition(p._key, { beschreibung: e.target.value })} placeholder="Beschreibung..." className="h-8 text-sm" />
                    <Input type="number" min="0" step="0.01" value={p.menge ?? ""} onChange={(e) => updatePosition(p._key, { menge: parseFloat(e.target.value) || 0 })} className="h-8 text-sm sm:text-right" placeholder="Menge" />
                    <Input value={p.einheit ?? ""} onChange={(e) => updatePosition(p._key, { einheit: e.target.value || null })} placeholder="Std/Stk" className="h-8 text-sm" />
                    <Input type="number" min="0" step="0.01" value={p.einzelpreis ?? ""} onChange={(e) => updatePosition(p._key, { einzelpreis: parseFloat(e.target.value) || 0 })} className="h-8 text-sm sm:text-right" placeholder="Preis" />
                    <Input type="number" min="0" step="0.01" value={p.betrag || ""} onChange={(e) => updatePosition(p._key, { betrag: parseFloat(e.target.value) || 0 })} className="h-8 text-sm sm:text-right font-medium" placeholder="0.00" />
                    <div className="flex justify-center">
                      <button onClick={() => removeRow(p._key)} className="text-slate-400 hover:text-red-500 transition-colors" aria-label="Zeile entfernen">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="px-3 py-2.5 bg-slate-50">
                  <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-folk-coral transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Zeile hinzufügen
                  </button>
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1.5 rounded-xl border border-slate-200 p-4 bg-slate-50">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Zwischensumme:</span>
                  <span>{formatChf(zwischensumme)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span>MwSt.</span>
                    <Input type="number" min="0" step="0.1" value={mwstSatz} onChange={(e) => setMwstSatz(parseFloat(e.target.value) || 0)} className="h-6 w-16 text-xs text-right py-0 px-1.5" />
                    <span>%</span>
                  </div>
                  <span>{formatChf(mwstBetrag)}</span>
                </div>
                <div className="border-t border-slate-300 pt-1.5 flex justify-between font-bold text-base text-slate-900">
                  <span>Total:</span>
                  <span className="text-folk-coral">{formatChf(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pb-6">
          <Button onClick={handleSave} disabled={isSaving} className="bg-folk-ink text-white hover:bg-folk-ink2">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Speichern
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" /> PDF herunterladen
          </Button>
          {customerEmail && status !== "bezahlt" && (
            <Button onClick={handleSendEmail} disabled={isSendingEmail || isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSendingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Per E-Mail senden
            </Button>
          )}
          {rechnungId && status !== "bezahlt" && (
            <Button onClick={() => handleStatusChange("bezahlt")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle className="w-4 h-4 mr-2" /> Zahlung erhalten
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
