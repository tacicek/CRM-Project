import { Helmet } from 'react-helmet-async';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Send, Loader2, Download, Plus, Trash2, CheckCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KundeLink } from '@/components/firma/KundeLink';
import { ZahlungErfassenDialog } from '@/components/firma/ZahlungErfassenDialog';
import { SignaturePad, type SignaturePadRef } from '@/components/quittung/SignaturePad';
import { QuittungPDFPreview } from '@/components/quittung/QuittungPDFPreview';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useCompanyRecord } from '@/hooks/useCompanyRecord';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/useI18n';
import { documentI18nFor } from '@/i18n/documentLocale';
import { formatCurrency } from '@/i18n/format';
import { getQuittungStatusLabel } from '@/i18n/domain';
import { LOCALES, LOCALE_NAMES, toLocale } from '@/i18n/locale';
import { validateAuftragItems, validateExtraServices } from '@/lib/auftragSnapshot';
import { round2 } from '@/lib/offerSurcharges';
import {
  emptyQuittungDraft, draftFromQuittung, createReceiptDraftFromOrder, validateQuittungDraft,
  buildQuittungDraftPayload, isQuittungFrozen, receiptToday, getReceiptOfferAddresses, type QuittungDraft,
} from '@/lib/quittungDraft';
import {
  downloadQuittungDocument, sendQuittungDocument, generateQuittungBlob,
} from '@/lib/quittungDocuments';
import { calculateTotals, mapQuittungRow, type Quittung, type QuittungPosition, type ReceiptCompanySnapshot } from '@/types/quittung.types';

interface CompanyInfo extends ReceiptCompanySnapshot { id: string; default_language?: string | null }
const QUITTUNG_FIRMA_SELECT = 'id, company_name, logo_url, primary_color, email, phone, street, house_number, plz, city, mwst_number, iban, bank_name, bewertungs_url, default_language';
type InvoiceOption = Pick<Database['public']['Tables']['rechnungen']['Row'], 'id' | 'rechnung_nr' | 'customer_id' | 'customer_name' | 'open_amount' | 'status'>;
type OfferOption = Pick<Database['public']['Tables']['offers']['Row'], 'id' | 'offer_number' | 'customer_first_name' | 'customer_last_name'>;
type PaymentTarget = { receipt: Quittung; invoice?: InvoiceOption };
const errorMessage = (error: unknown, fallback: string): string =>
  typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
    ? error.message : fallback;

export default function QuittungDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, locale: uiLocale } = useI18n();
  const { company, companyId } = useCompanyRecord<CompanyInfo>(QUITTUNG_FIRMA_SELECT);
  const isNew = !id || id === 'neu';
  const sourceOrderId = new URLSearchParams(location.search).get('auftrag');
  const [draft, setDraft] = useState<QuittungDraft>(() => emptyQuittungDraft(receiptToday(), 'de', 8.1));
  const [saved, setSaved] = useState<Quittung | null>(null);
  const [offers, setOffers] = useState<OfferOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [preview, setPreview] = useState<Quittung | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const actionRef = useRef(false);
  const dirtyRef = useRef(false);
  const savedRef = useRef<Quittung | null>(null);
  const customerPad = useRef<SignaturePadRef>(null);
  const teamPad = useRef<SignaturePadRef>(null);
  const frozen = isQuittungFrozen(saved);
  const totals = frozen && saved ? {
    zwischensumme: saved.zwischensumme, total: saved.total,
    mwst_betrag: saved.mwst_betrag, gesamttotal: saved.gesamttotal,
  } : calculateTotals(draft.positionen, draft.mwst_satz, draft.rabatt);
  const { t: docT } = documentI18nFor(draft.language);

  const hydrate = useCallback((q: Quittung) => {
    // An earlier read can finish after a save/finalize response. Never replace that
    // newer canonical version with the stale request's snapshot.
    const current = savedRef.current;
    if (current?.id === q.id && current.version !== undefined && q.version !== undefined && current.version > q.version) return;
    savedRef.current = q;
    dirtyRef.current = false;
    setSaved(q); setDraft(draftFromQuittung(q)); setDirty(false); setConflict(false); setLoadError(null);
    setPreview(previous => previous ? q : null);
  }, []);

  const readReceipt = useCallback(async (receiptId: string, replaceDirty = false) => {
    if (!companyId) return;
    const { data, error } = await supabase.from('quittungen').select('*').eq('id', receiptId).eq('company_id', companyId).single();
    if (error) throw error;
    const mapped = mapQuittungRow(data);
    if (!mapped.ok) throw new Error(t('receipt.loadFailed'));
    if (dirtyRef.current && !replaceDirty) {
      if (mapped.value.version !== savedRef.current?.version) setConflict(true);
      return;
    }
    hydrate(mapped.value);
  }, [companyId, hydrate, t]);

  useEffect(() => {
    if (!companyId || !company) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true); setLoadError(null);
      try {
        const [offerResult, invoiceResult, settingsResult] = await Promise.all([
          supabase.from('offers').select('id, offer_number, customer_first_name, customer_last_name').eq('company_id', companyId).order('created_at', { ascending: false }),
          supabase.from('rechnungen').select('id, rechnung_nr, customer_id, customer_name, open_amount, status').eq('company_id', companyId).order('created_at', { ascending: false }),
          supabase.from('company_offer_settings').select('default_vat_rate').eq('company_id', companyId).maybeSingle(),
        ]);
        if (offerResult.error) throw offerResult.error;
        if (invoiceResult.error) throw invoiceResult.error;
        if (settingsResult.error) throw settingsResult.error;
        if (cancelled) return;
        setOffers(offerResult.data); setInvoices(invoiceResult.data);
        if (!isNew && id) {
          await readReceipt(id, true);
        } else {
          const vat = settingsResult.data?.default_vat_rate ?? 8.1;
          let initial = emptyQuittungDraft(receiptToday(), toLocale(company.default_language), vat);
          if (sourceOrderId) {
            const { data, error } = await supabase.from('auftraege').select('*').eq('id', sourceOrderId).eq('company_id', companyId).single();
            if (error) throw error;
            const items = validateAuftragItems(data.items);
            const extras = validateExtraServices(data.extra_services);
            if (!items.ok || !extras.ok) throw new Error(t('receipt.invalid.items'));
            initial = createReceiptDraftFromOrder({ ...data, items: items.value, extra_services: extras.value }, receiptToday(), vat);
          }
          if (cancelled) return;
          setSaved(null); savedRef.current = null;
          setDraft(initial); setDirty(!!sourceOrderId); dirtyRef.current = !!sourceOrderId;
          setConflict(false); setPreview(null);
        }
      } catch (error) {
        if (!cancelled) setLoadError(errorMessage(error, t('receipt.loadFailed')));
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [companyId, company, id, isNew, sourceOrderId, readReceipt, t]);

  useEffect(() => {
    if (!saved?.id) return;
    const receiptId = saved.id;
    const refresh = () => { void readReceipt(receiptId).catch(error => setLoadError(errorMessage(error, t('receipt.loadFailed')))); };
    const channel = supabase.channel(`receipt-${receiptId}`).on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'quittungen', filter: `id=eq.${receiptId}`,
    }, refresh).subscribe();
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => { void supabase.removeChannel(channel); window.removeEventListener('focus', refresh); window.clearInterval(interval); };
  }, [saved?.id, readReceipt, t]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  const changeDraft = (patch: Partial<QuittungDraft>) => {
    if (frozen || busy) return;
    customerPad.current?.clear(); teamPad.current?.clear();
    setDraft(previous => ({ ...previous, ...patch, kunde_unterschrift: null, teamchef_unterschrift: null, kunde_signed_at: null, teamchef_signed_at: null }));
    setDirty(true); dirtyRef.current = true; setPreview(null);
  };

  const changePosition = (position: QuittungPosition, patch: Partial<QuittungPosition>) => {
    const next = { ...position, ...patch };
    if (('menge' in patch || 'einzelpreis' in patch) && typeof next.menge === 'number' && typeof next.einzelpreis === 'number') {
      next.betrag = next.price_type === 'inkl' ? 0 : round2(next.menge * next.einzelpreis);
    }
    changeDraft({ positionen: draft.positionen.map(p => p.id === next.id ? next : p) });
  };

  const run = async (action: () => Promise<void>) => {
    if (actionRef.current) return;
    actionRef.current = true; setBusy(true);
    try { await action(); }
    catch (error) { toast({ title: t('receipt.error'), description: errorMessage(error, t('receipt.error')), variant: 'destructive' }); }
    finally { actionRef.current = false; setBusy(false); }
  };

  const persist = async (value: QuittungDraft = draft): Promise<Quittung> => {
    if (!companyId) throw new Error(t('receipt.loadFailed'));
    const current = savedRef.current;
    if (current && isQuittungFrozen(current)) return current;
    const validation = validateQuittungDraft(value, 'draft');
    if (validation) throw new Error(t(validation));
    const payload = buildQuittungDraftPayload(value, companyId);
    const existing = current;
    if (existing && existing.version === undefined) throw new Error(t('receipt.conflict'));
    const result = existing
      ? await supabase.from('quittungen').update(payload).eq('id', existing.id).eq('company_id', companyId).eq('version', existing.version!).select('*').maybeSingle()
      : await supabase.from('quittungen').insert(payload).select('*').single();
    if (result.error) throw result.error;
    if (!result.data) { setConflict(true); throw new Error(t('receipt.conflict')); }
    const mapped = mapQuittungRow(result.data);
    if (!mapped.ok) throw new Error(t('receipt.loadFailed'));
    hydrate(mapped.value);
    if (!existing) navigate(`/firma/quittungen/${mapped.value.id}`, { replace: true });
    return mapped.value;
  };

  const captureSignatures = (): QuittungDraft => {
    const customer = customerPad.current?.toDataURL() ?? draft.kunde_unterschrift;
    const team = teamPad.current?.toDataURL() ?? draft.teamchef_unterschrift;
    const now = new Date().toISOString();
    return { ...draft, kunde_unterschrift: customer, teamchef_unterschrift: team,
      kunde_signed_at: customer ? (customer === draft.kunde_unterschrift ? draft.kunde_signed_at ?? now : now) : null,
      teamchef_signed_at: team ? (team === draft.teamchef_unterschrift ? draft.teamchef_signed_at ?? now : now) : null };
  };

  const finalize = async (mode: 'issue' | 'send' = 'issue'): Promise<Quittung> => {
    const value = frozen && saved ? draftFromQuittung(saved) : captureSignatures();
    const validation = validateQuittungDraft(value, mode);
    if (validation) throw new Error(t(validation));
    const persisted = await persist(value);
    if (persisted.version === undefined) throw new Error(t('receipt.conflict'));
    const { data, error } = await supabase.rpc('finalize_quittung', {
      p_quittung_id: persisted.id, p_expected_version: persisted.version,
      p_kunde_unterschrift: value.kunde_unterschrift ?? undefined,
      p_teamchef_unterschrift: value.teamchef_unterschrift ?? undefined,
      p_kunde_signed_at: value.kunde_signed_at ?? undefined,
      p_teamchef_signed_at: value.teamchef_signed_at ?? undefined,
    });
    if (error) throw error;
    const mapped = mapQuittungRow(data);
    if (!mapped.ok) throw new Error(t('receipt.loadFailed'));
    hydrate(mapped.value);
    return mapped.value;
  };

  const selectOffer = async (offerId: string) => {
    if (offerId === 'none') { changeDraft({ offer_id: null, auftrag_id: null, rechnung_id: null }); return; }
    await run(async () => {
      if (!companyId) return;
      const [offerResult, itemsResult] = await Promise.all([
        supabase.from('offers').select('id, customer_id, customer_first_name, customer_last_name, customer_email, customer_phone, language, vat_rate, subtotal, frozen_from_street, frozen_from_house_number, frozen_from_plz, frozen_from_city, frozen_to_street, frozen_to_house_number, frozen_to_plz, frozen_to_city, leads(from_street, from_house_number, from_plz, from_city, to_street, to_house_number, to_plz, to_city)').eq('id', offerId).eq('company_id', companyId).single(),
        supabase.from('offer_items').select('id, description, quantity, unit, unit_price, total, price_type').eq('offer_id', offerId).order('position'),
      ]);
      if (offerResult.error) throw offerResult.error;
      if (itemsResult.error) throw itemsResult.error;
      const offer = offerResult.data;
      const mapped = createReceiptDraftFromOrder({
        id: offer.id, offer_id: offer.id, customer_id: offer.customer_id,
        customer_name: [offer.customer_first_name, offer.customer_last_name].filter(Boolean).join(' '),
        customer_email: offer.customer_email, customer_phone: offer.customer_phone,
        ...getReceiptOfferAddresses(offer),
        language: offer.language, vat_rate: offer.vat_rate, subtotal: offer.subtotal,
        pricing_type: 'fixed', items: itemsResult.data, extra_services: [],
      }, draft.datum, draft.mwst_satz);
      customerPad.current?.clear(); teamPad.current?.clear();
      setDraft({ ...mapped, auftrag_id: null }); setDirty(true); dirtyRef.current = true; setPreview(null);
    });
  };

  const startPayment = async () => {
    const receipt = await finalize();
    if (receipt.rechnung_id) {
      const { data, error } = await supabase.from('rechnungen').select('id, rechnung_nr, customer_id, customer_name, open_amount, status').eq('id', receipt.rechnung_id).eq('company_id', receipt.company_id).single();
      if (error) throw error;
      if (data.open_amount <= 0) { await readReceipt(receipt.id, true); return; }
      setPaymentTarget({ receipt, invoice: data });
    } else setPaymentTarget({ receipt });
  };

  if (loading || !company) return <div className="flex justify-center py-16"><Loader2 className="size-7 animate-spin" /></div>;
  if (loadError && !saved) return <div role="alert" className="space-y-3 p-6"><p>{t('receipt.loadFailed')}: {loadError}</p><Button onClick={() => window.location.reload()}>{t('receipt.retry')}</Button></div>;

  const invoiceOptions = invoices.filter(invoice => invoice.id === draft.rechnung_id || (draft.customer_id !== null && invoice.customer_id === draft.customer_id));
  const linkedInvoice = invoices.find(invoice => invoice.id === draft.rechnung_id);
  const paymentStatus = saved?.rechnung_id === draft.rechnung_id ? saved.payment_status ?? 'open' : 'open';
  const title = saved ? t('receipt.title', { number: saved.quittung_nr ?? '' }) : t('receipt.new');
  const field = (key: 'customer_name' | 'customer_address' | 'customer_destination' | 'customer_email' | 'customer_phone', label: string, type = 'text') => (
    <div><Label htmlFor={key}>{label}</Label><Input id={key} type={type} value={draft[key]} disabled={frozen || busy} onChange={event => changeDraft({ [key]: event.target.value })} className="mt-1" /></div>
  );

  return <>
    <Helmet><title>{title} | CRM</title></Helmet>
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" aria-label={t('receipt.back')} onClick={() => navigate('/firma/quittungen')}><ArrowLeft className="size-5" /></Button>
        <h1 className="flex-1 text-2xl font-semibold">{title}</h1>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-sm">{getQuittungStatusLabel(saved?.status ?? 'draft', uiLocale)}</span>
        {dirty && <span className="text-sm text-amber-700">{t('receipt.unsaved')}</span>}
      </div>
      {loadError && <p role="alert" className="text-red-700">{loadError}</p>}
      {conflict && <div role="alert" className="space-y-2 rounded-lg border border-amber-400 p-4"><p>{t('receipt.conflict')}</p><Button onClick={() => void run(async () => { if (saved) await readReceipt(saved.id, true); })}>{t('receipt.reload')}</Button></div>}
      {frozen && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{t('receipt.frozen')}</p>}
      <div className="rounded-xl border bg-white p-5 md:p-7">
        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-3"><h2 className="font-semibold">{t('receipt.customer')} {draft.customer_id && <KundeLink customerId={draft.customer_id} />}</h2>
            {field('customer_name', `${t('receipt.name')} *`)}
            {field('customer_address', t('receipt.address'))}
            {field('customer_destination', t('receipt.destination'))}
            {field('customer_email', t('receipt.email'), 'email')}
            {field('customer_phone', t('receipt.phone'), 'tel')}
          </section>
          <section className="space-y-3"><h2 className="font-semibold">{t('receipt.details')}</h2>
            <div><Label>{t('receipt.offer')}</Label><Select value={draft.offer_id ?? 'none'} onValueChange={value => void selectOffer(value)} disabled={frozen || busy}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{t('receipt.noOffer')}</SelectItem>{offers.map(offer => <SelectItem key={offer.id} value={offer.id}>{offer.offer_number} · {[offer.customer_first_name, offer.customer_last_name].filter(Boolean).join(' ')}</SelectItem>)}</SelectContent></Select></div>
            {draft.auftrag_id && <p className="text-sm text-slate-500">{t('receipt.orderLinked')}</p>}
            <div><Label>{t('receipt.date')} *</Label><DatePicker value={draft.datum} onChange={value => changeDraft({ datum: value })} disabled={frozen || busy} className="mt-1" /></div>
            <div><Label>{t('receipt.language')}</Label><Select value={draft.language} onValueChange={value => changeDraft({ language: toLocale(value) })} disabled={frozen || busy}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{LOCALES.map(locale => <SelectItem key={locale} value={locale}>{LOCALE_NAMES[locale]}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="receipt-note">{t('receipt.note')}</Label><Textarea id="receipt-note" value={draft.notiz} onChange={event => changeDraft({ notiz: event.target.value })} disabled={frozen || busy} className="mt-1" /></div>
          </section>
        </div>
        <section className="mt-7 space-y-3"><h2 className="font-semibold">{t('receipt.items')}</h2>
          {draft.auftrag_id && <p className="text-sm text-slate-500">{t('receipt.sourceReconciled')}</p>}
          {draft.positionen.map(position => <div key={position.id} className="space-y-3 rounded-lg border p-3">
            <div className="flex items-start gap-3"><Checkbox aria-label={t('receipt.include')} checked={position.checked} disabled={frozen || busy} onCheckedChange={checked => changePosition(position, { checked: checked === true })} className="mt-3" /><div className="flex-1"><Label htmlFor={`description-${position.id}`}>{t('receipt.description')}</Label><Input id={`description-${position.id}`} value={position.beschreibung} disabled={frozen || busy} onChange={event => changePosition(position, { beschreibung: event.target.value })} /></div><Button variant="ghost" size="icon" aria-label={t('receipt.removeRow')} disabled={frozen || busy} onClick={() => changeDraft({ positionen: draft.positionen.filter(p => p.id !== position.id) })}><Trash2 className="size-4" /></Button></div>
            {position.price_type === 'optional' && <p className="text-xs text-amber-700">{t('receipt.optional')}</p>}
            {position.price_type === 'inkl' && <p className="text-xs text-emerald-700">{t('receipt.included')}</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><Label htmlFor={`quantity-${position.id}`}>{t('receipt.quantity')}</Label><Input id={`quantity-${position.id}`} type="number" min="0" step="0.01" value={position.menge ?? ''} disabled={frozen || busy} onChange={event => changePosition(position, { menge: event.target.value === '' ? null : Number(event.target.value) })} /></div>
              <div><Label htmlFor={`unit-${position.id}`}>{t('receipt.unit')}</Label><Input id={`unit-${position.id}`} value={position.einheit ?? ''} disabled={frozen || busy} onChange={event => changePosition(position, { einheit: event.target.value })} /></div>
              <div><Label htmlFor={`unit-price-${position.id}`}>{t('receipt.unitPrice')}</Label><Input id={`unit-price-${position.id}`} type="number" min="0" step="0.01" value={position.einzelpreis ?? ''} disabled={frozen || busy || position.price_type === 'inkl'} onChange={event => changePosition(position, { einzelpreis: event.target.value === '' ? null : Number(event.target.value) })} /></div>
              <div><Label htmlFor={`amount-${position.id}`}>{t('receipt.amount')}</Label><Input id={`amount-${position.id}`} type="number" min="0" step="0.01" value={position.betrag} disabled={frozen || busy || position.price_type === 'inkl'} onChange={event => changePosition(position, { betrag: Number(event.target.value), menge: null, einzelpreis: null })} /></div>
            </div>
            <div><Label htmlFor={`rate-${position.id}`}>{t('receipt.rate')}</Label><Input id={`rate-${position.id}`} value={position.satz} disabled={frozen || busy} onChange={event => changePosition(position, { satz: event.target.value })} /></div>
          </div>)}
          {!frozen && <Button variant="outline" disabled={busy} onClick={() => changeDraft({ positionen: [...draft.positionen, { id: crypto.randomUUID(), beschreibung: '', satz: '', betrag: 0, checked: true, is_custom: true }] })}><Plus className="mr-2 size-4" />{t('receipt.addRow')}</Button>}
        </section>
        <section className="ml-auto mt-6 max-w-sm space-y-3 rounded-xl bg-slate-50 p-4">
          <div className="flex justify-between"><span>{t('receipt.subtotal')}</span><span>{formatCurrency(totals.zwischensumme, uiLocale)}</span></div>
          <div className="flex items-center justify-between gap-3"><Label htmlFor="receipt-discount">{t('receipt.discount')}</Label><Input id="receipt-discount" type="number" min="0" max={totals.zwischensumme} step="0.01" value={draft.rabatt} disabled={frozen || busy} onChange={event => changeDraft({ rabatt: Number(event.target.value) })} className="w-28 text-right" /></div>
          <div className="flex items-center justify-between gap-3"><Label htmlFor="receipt-vat">{t('receipt.vat')}</Label><Input id="receipt-vat" type="number" min="0" max="100" step="0.1" value={draft.mwst_satz} disabled={frozen || busy} onChange={event => changeDraft({ mwst_satz: Number(event.target.value) })} className="w-28 text-right" /></div>
          <div className="flex justify-between"><span>{t('receipt.vatAmount')}</span><span>{formatCurrency(totals.mwst_betrag, uiLocale)}</span></div>
          <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>{t('receipt.total')}</span><span>{formatCurrency(totals.gesamttotal, uiLocale)}</span></div>
        </section>
        <section className="mt-6 space-y-3 rounded-lg border p-4"><Label>{t('receipt.invoice')}</Label><Select value={draft.rechnung_id ?? 'none'} onValueChange={value => changeDraft({ rechnung_id: value === 'none' ? null : value })} disabled={frozen || busy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{t('receipt.noInvoice')}</SelectItem>{invoiceOptions.map(invoice => <SelectItem key={invoice.id} value={invoice.id}>{invoice.rechnung_nr} · {invoice.customer_name}</SelectItem>)}</SelectContent></Select>
          <p className="text-sm text-slate-500">{t('receipt.invoiceHint')}</p>
          {!draft.customer_id && <p className="text-sm text-slate-500">{t('receipt.invoiceNeedsCustomer')}</p>}
          <div className="flex flex-wrap items-center gap-3"><span className="font-semibold">{draft.rechnung_id ? paymentStatus === 'paid' ? t('receipt.invoicePaid', { number: linkedInvoice?.rechnung_nr ?? '' }) : t('receipt.invoiceOpen') : t(paymentStatus === 'paid' ? 'receipt.paid' : paymentStatus === 'partial' ? 'receipt.partial' : 'receipt.open')}</span>{saved && <span className="text-sm">{t('receipt.paidAmount', { amount: formatCurrency(saved.paid_amount ?? 0, uiLocale) })}</span>}</div>
          {saved?.rechnung_id && <Button variant="link" onClick={() => navigate(`/firma/rechnungen/${saved.rechnung_id}`)}>{t('receipt.openInvoice')}</Button>}
        </section>
        <section className="mt-6 space-y-3"><h2 className="font-semibold">{t('receipt.signatures')}</h2><p className="text-sm text-slate-500">{t('receipt.signatureHint')}</p><div className="grid gap-4 sm:grid-cols-2">
          <SignaturePad ref={customerPad} onDraw={() => { setDirty(true); dirtyRef.current = true; }} label={docT('doc.receipt.signature.customer')} locale={draft.language} existingSignature={draft.kunde_unterschrift} signedAt={draft.kunde_signed_at} disabled={frozen || busy} onConfirm={signature => { setDraft(previous => ({ ...previous, kunde_unterschrift: signature, kunde_signed_at: new Date().toISOString() })); setDirty(true); dirtyRef.current = true; }} onClear={() => { setDraft(previous => ({ ...previous, kunde_unterschrift: null, kunde_signed_at: null })); setDirty(true); dirtyRef.current = true; }} />
          <SignaturePad ref={teamPad} onDraw={() => { setDirty(true); dirtyRef.current = true; }} label={docT('doc.receipt.signature.teamLead')} locale={draft.language} existingSignature={draft.teamchef_unterschrift} signedAt={draft.teamchef_signed_at} disabled={frozen || busy} onConfirm={signature => { setDraft(previous => ({ ...previous, teamchef_unterschrift: signature, teamchef_signed_at: new Date().toISOString() })); setDirty(true); dirtyRef.current = true; }} onClear={() => { setDraft(previous => ({ ...previous, teamchef_unterschrift: null, teamchef_signed_at: null })); setDirty(true); dirtyRef.current = true; }} />
        </div></section>
      </div>
      <div className="flex flex-wrap gap-2">
        {!frozen && <Button variant="outline" disabled={busy || conflict} onClick={() => void run(async () => { await persist(captureSignatures()); toast({ title: t('receipt.saved') }); })}><Save className="mr-2 size-4" />{t('receipt.saveDraft')}</Button>}
        <Button variant="outline" disabled={busy || conflict} onClick={() => void run(async () => { const q = await persist(captureSignatures()); setPreview(q); })}><FileText className="mr-2 size-4" />{t('receipt.preview')}</Button>
        <Button variant="outline" disabled={busy || conflict} onClick={() => void run(async () => { const q = await persist(captureSignatures()); await downloadQuittungDocument(q, company); })}><Download className="mr-2 size-4" />{t('receipt.download')}</Button>
        {!frozen && <Button variant="outline" disabled={busy || conflict} onClick={() => void run(async () => { const q = await persist(captureSignatures()); const blob = await generateQuittungBlob(q, company, 'worksheet'); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Quittung-${q.quittung_nr}-worksheet.pdf`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); })}>{t('receipt.worksheet')}</Button>}
        {!frozen && <Button disabled={busy || conflict} onClick={() => void run(async () => { await finalize(); toast({ title: t('receipt.issued') }); })}><CheckCircle className="mr-2 size-4" />{t('receipt.issue')}</Button>}
        {paymentStatus !== 'paid' && <Button disabled={busy || conflict} className="bg-emerald-700 hover:bg-emerald-800" onClick={() => void run(startPayment)}><CheckCircle className="mr-2 size-4" />{draft.rechnung_id ? t('receipt.openInvoice') : t('receipt.markPaid')}</Button>}
        <Button disabled={busy || conflict || !draft.customer_email} onClick={() => void run(async () => { const q = await finalize('send'); await sendQuittungDocument(q, company); await readReceipt(q.id, true); toast({ title: t('receipt.sent') }); })}><Send className="mr-2 size-4" />{t('receipt.send')}</Button>
        {busy && <Loader2 className="m-2 size-5 animate-spin" />}
      </div>
      {preview && <QuittungPDFPreview quittung={preview} company={company} locale={toLocale(preview.language)} uiLocale={uiLocale} />}
    </div>
    {paymentTarget && <ZahlungErfassenDialog open companyId={company.id} onOpenChange={open => { if (!open) setPaymentTarget(null); }}
      quittung={paymentTarget.invoice ? undefined : { id: paymentTarget.receipt.id, nr: paymentTarget.receipt.quittung_nr ?? '', betrag: paymentTarget.receipt.gesamttotal }}
      rechnung={paymentTarget.invoice ? { id: paymentTarget.invoice.id, nr: paymentTarget.invoice.rechnung_nr ?? '', offen: paymentTarget.invoice.open_amount, customerId: paymentTarget.invoice.customer_id } : undefined}
      onDone={() => { const receiptId = paymentTarget.receipt.id; setPaymentTarget(null); void run(async () => { await readReceipt(receiptId, true); }); }} />}
  </>;
}
