import { useEffect, useMemo, useState } from "react";
import { BlobProvider } from "@react-pdf/renderer";
import { QuittungPDF, type QuittungPDFProps, type QuittungPdfCompany } from "@/components/quittung/QuittungPDF";
import { getArchivedQuittungDocument, prepareQuittungPdfCompany } from "@/lib/quittungDocuments";
import type { Locale } from "@/i18n/locale";
import { createTranslator } from "@/i18n/translator";
import { Button } from "@/components/ui/button";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AlertCircle, Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";

interface Props extends QuittungPDFProps {
  /** Only the controls use the dashboard language; the document keeps `locale`. */
  uiLocale?: Locale;
  onClose?: () => void;
}

interface PreviewState {
  url: string | null;
  loading: boolean;
  error: Error | null;
}

interface PanelProps extends PreviewState {
  locale: Locale;
  filename: string;
  onRetry: () => void;
}

const PreviewFailure = ({ locale, onRetry }: Pick<PanelProps, "locale" | "onRetry">) => {
  const t = createTranslator(locale);
  return (
    <div role="alert" className="space-y-3 p-6 text-sm text-red-700">
      <p className="flex items-center gap-2"><AlertCircle className="size-4" />{t("receipt.previewError")}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 size-4" />{t("receipt.previewRetry")}
      </Button>
    </div>
  );
};

const PreviewPanel = ({ url, loading, error, locale, filename, onRetry }: PanelProps) => {
  const t = createTranslator(locale);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label={t("receipt.preview")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">{t("receipt.preview")}</h2>
        {url && !loading && !error && (
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />{t("receipt.previewOpen")}</a>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a href={url} download={filename}><Download className="size-4" />{t("receipt.download")}</a>
            </Button>
          </div>
        )}
      </div>
      {error ? <PreviewFailure locale={locale} onRetry={onRetry} /> : loading || !url ? (
        <div role="status" className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />{t("receipt.previewLoading")}
        </div>
      ) : (
        <iframe title={t("receipt.preview")} src={url} className="h-[70vh] min-h-96 w-full border-0" />
      )}
    </section>
  );
};

const DraftPreview = ({ quittung, company, locale, mode, uiLocale = locale }: Props) => {
  const [attempt, setAttempt] = useState(0);
  const [prepared, setPrepared] = useState<{
    sourceReceipt: Props["quittung"] | null;
    sourceCompany: QuittungPdfCompany | null;
    company: QuittungPdfCompany | null;
    loading: boolean;
    error: Error | null;
  }>({ sourceReceipt: null, sourceCompany: null, company: null, loading: true, error: null });
  const filename = `Quittung-${quittung.quittung_nr || "draft"}${mode === "worksheet" ? "-worksheet" : ""}.pdf`;
  useEffect(() => {
    let active = true;
    const source = { sourceReceipt: quittung, sourceCompany: company };
    setPrepared({ ...source, company: null, loading: true, error: null });
    void prepareQuittungPdfCompany(quittung, company).then(
      value => { if (active) setPrepared({ ...source, company: value, loading: false, error: null }); },
      error => { if (active) setPrepared({ ...source, company: null, loading: false, error: error instanceof Error ? error : new Error(String(error)) }); },
    );
    return () => { active = false; };
  }, [quittung, company, attempt]);
  const preparedForCurrentInput = prepared.sourceReceipt === quittung && prepared.sourceCompany === company;
  const document = useMemo(
    () => preparedForCurrentInput && prepared.company ? <QuittungPDF quittung={quittung} company={prepared.company} locale={locale} mode={mode} /> : null,
    [quittung, prepared.company, preparedForCurrentInput, locale, mode],
  );
  const retry = () => setAttempt(value => value + 1);
  if (!document) return <PreviewPanel url={null} loading={!preparedForCurrentInput || prepared.loading} error={preparedForCurrentInput ? prepared.error : null} locale={uiLocale} filename={filename} onRetry={retry} />;

  return (
    <ErrorBoundary key={`${quittung.id}:${quittung.version ?? quittung.updated_at}:${attempt}`} fallback={<PreviewFailure locale={uiLocale} onRetry={retry} />}>
      <BlobProvider key={attempt} document={document}>
        {({ url, loading, error }) => <PreviewPanel url={url} loading={loading} error={error} locale={uiLocale} filename={filename} onRetry={retry} />}
      </BlobProvider>
    </ErrorBoundary>
  );
};

const ArchivedPreview = ({ quittung, company, locale, uiLocale = locale }: Props) => {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PreviewState>({ url: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const controller = new AbortController();
    setState({ url: null, loading: true, error: null });
    const load = async () => {
      try {
        const archived = await getArchivedQuittungDocument(quittung, company);
        if (!archived.document || !archived.url) throw new Error("PDF archive is incomplete.");
        const response = await fetch(archived.url, { signal: controller.signal });
        if (!response.ok) throw new Error(`PDF download failed (${response.status}).`);
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, loading: false, error: null });
      } catch (error) {
        if (active) setState({ url: null, loading: false, error: error instanceof Error ? error : new Error(String(error)) });
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [quittung, company, attempt]);

  return <PreviewPanel {...state} locale={uiLocale} filename={`Quittung-${quittung.quittung_nr}.pdf`} onRetry={() => setAttempt(value => value + 1)} />;
};

/** Finalized previews use exactly the archived PDF bytes that download and email use. */
export const QuittungPDFPreview = (props: Props) => props.quittung.issued_at && props.mode !== "worksheet"
  ? <ArchivedPreview key={`${props.quittung.id}:${props.quittung.version}`} {...props} />
  : <DraftPreview {...props} />;
