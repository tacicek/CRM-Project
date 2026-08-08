import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Copy,
  Mail,
  Map,
  Pencil,
  Phone,
  User,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/translator";
import type { Kunde } from "@/hooks/useKunden";

const STATUS_LABEL: Record<string, MessageKey> = {
  active: "kunde.status.active",
  inactive: "kunde.status.inactive",
  blocked: "kunde.status.blocked",
  anonymized: "kunde.status.anonymized",
};

/**
 * Statusfarben. Der Text steht IMMER daneben — die Farbe ist Beiwerk, nicht die
 * Auskunft (WCAG 1.4.1). `blocked` bekommt zusaetzlich einen kraeftigeren
 * Rahmen, damit es sich auch ohne Farbwahrnehmung von `inactive` abhebt.
 */
const STATUS_STIL: Record<string, string> = {
  active: "bg-folk-mint-bg text-folk-mint",
  inactive: "bg-folk-bg-warm text-folk-ink2",
  blocked: "bg-folk-coral-bg text-folk-coral ring-1 ring-folk-coral/50",
  anonymized: "bg-folk-bg-warm text-folk-ink3",
};

const initialen = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((teil) => teil[0]?.toUpperCase() ?? "")
    .join("") || "?";

/**
 * Die Kopfzeile der Kundenkarte: wer das ist und was man von hier aus tun kann.
 *
 * Es gibt NUR Schaltflaechen fuer Wege, die es wirklich gibt. `tel:` und
 * `mailto:` entfallen ohne Nummer bzw. Adresse, "Auf der Karte" ohne Anschrift,
 * und "Offerte" nur, wenn eine Anfrage existiert — die Offertenerstellung
 * verlangt `?lead=…` (OfferteErstellen.tsx) und waere ohne Lead eine
 * Schaltflaeche, die in eine Fehlermeldung fuehrt.
 */
export const KundeKopf = ({
  kunde,
  anschrift,
  letzteAnfrageId,
  onBearbeiten,
}: {
  kunde: Kunde;
  /** Der Adresstext der Hauptanschrift; ohne ihn entfallen Kopieren und Karte. */
  anschrift: string | null;
  letzteAnfrageId: string | null;
  onBearbeiten: () => void;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useT();

  const kopieren = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t("kunde.action.copied") });
    } catch {
      // Ohne sicheren Kontext (http) gibt es keine Zwischenablage. Das ist ein
      // Fehlschlag und wird als solcher gemeldet, nicht verschluckt.
      toast({ title: t("kunde.action.copyFailed"), variant: "destructive" });
    }
  };

  const statusKey = STATUS_LABEL[kunde.status] ?? "kunde.status.active";
  const istFirma = kunde.customer_type === "company";

  return (
    <header className="space-y-3">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 gap-1.5 text-folk-ink3"
        onClick={() => navigate("/firma/kunden")}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("kunde.detail.back")}
      </Button>

      <div className="flex flex-wrap items-start gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-folk-bg-warm font-mono text-[15px] font-semibold text-folk-ink2"
          aria-hidden
        >
          {initialen(kunde.display_name)}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-folk-ink">
            {kunde.display_name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="inline-flex items-center gap-1 rounded bg-folk-bg-warm px-1.5 py-0.5 font-medium text-folk-ink2">
              {istFirma ? (
                <Building2 className="h-3 w-3" aria-hidden />
              ) : (
                <User className="h-3 w-3" aria-hidden />
              )}
              {t(istFirma ? "kunde.type.company" : "kunde.type.person")}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 font-medium ${STATUS_STIL[kunde.status] ?? STATUS_STIL.inactive}`}
            >
              {t(statusKey)}
            </span>
            {kunde.language !== "de" && (
              <span className="rounded bg-folk-sky-bg px-1.5 py-0.5 font-medium uppercase text-folk-sky">
                {kunde.language}
              </span>
            )}
            {kunde.external_customer_number && (
              <span className="font-mono text-folk-ink3">
                {t("kunde.field.customerNumber")}: {kunde.external_customer_number}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Schnellaktionen. `size="sm"` ist im Repo 44 px hoch (button.tsx) und
          erfuellt damit die Mindest-Trefferflaeche auf dem Telefon. */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5" onClick={onBearbeiten}>
          <Pencil className="h-4 w-4" aria-hidden />
          {t("kunde.action.edit")}
        </Button>

        {kunde.primary_phone && (
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <a href={`tel:${kunde.primary_phone.replace(/[^\d+]/g, "")}`}>
              <Phone className="h-4 w-4" aria-hidden />
              {t("kunde.action.call")}
            </a>
          </Button>
        )}

        {kunde.primary_email && (
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <a href={`mailto:${kunde.primary_email}`}>
              <Mail className="h-4 w-4" aria-hidden />
              {t("kunde.action.mail")}
            </a>
          </Button>
        )}

        {anschrift && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => kopieren(anschrift)}
            >
              <Copy className="h-4 w-4" aria-hidden />
              {t("kunde.action.copyAddress")}
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(anschrift)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Map className="h-4 w-4" aria-hidden />
                {t("kunde.action.openMap")}
              </a>
            </Button>
          </>
        )}

        {letzteAnfrageId && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => navigate(`/firma/offerten/neu?lead=${letzteAnfrageId}`)}
          >
            <FileText className="h-4 w-4" aria-hidden />
            {t("kunde.action.newOffer")}
          </Button>
        )}
      </div>
    </header>
  );
};
