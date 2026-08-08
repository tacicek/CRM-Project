import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building,
  Copy,
  Loader2,
  Map,
  MapPin,
  Package,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n/useI18n";
import { AbschnittFehler } from "@/components/firma/kunde/AbschnittFehler";
import { AnschriftDialog } from "@/components/firma/kunde/AnschriftDialog";
import { ServiceortDialog } from "@/components/firma/kunde/ServiceortDialog";
import type { Anschrift, Serviceort, useKundeOrte } from "@/hooks/useKundeOrte";
import type { MessageKey } from "@/i18n/translator";

const ROLLE_LABEL: Record<string, MessageKey> = {
  from: "kunde.location.kind.from",
  to: "kunde.location.kind.to",
  object: "kunde.location.kind.object",
  storage: "kunde.location.kind.storage",
};

const ROLLE_ICON: Record<string, typeof MapPin> = {
  from: ArrowUpRight,
  to: ArrowDownLeft,
  object: Building,
  storage: Package,
};

type Orte = ReturnType<typeof useKundeOrte>;

const AdressAktionen = ({ text }: { text: string }) => {
  const t = useT();
  const { toast } = useToast();
  return (
    <div className="flex shrink-0 gap-1">
      <Button
        size="icon"
        variant="ghost"
        className="h-9 w-9"
        aria-label={t("kunde.action.copyAddress")}
        title={t("kunde.action.copyAddress")}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            toast({ title: t("kunde.action.copied") });
          } catch {
            toast({ title: t("kunde.action.copyFailed"), variant: "destructive" });
          }
        }}
      >
        <Copy className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        asChild
        size="icon"
        variant="ghost"
        className="h-9 w-9"
        aria-label={t("kunde.action.openMap")}
        title={t("kunde.action.openMap")}
      >
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
        >
          <Map className="h-4 w-4" aria-hidden />
        </a>
      </Button>
    </div>
  );
};

/**
 * Anschriften und Einsatzorte.
 *
 * Zwei Begriffe, zwei Bloecke, ein Bildschirm — und zwischen ihnen ein Satz,
 * der sagt, wofuer jeder da ist. Sie in eine Liste zu werfen waere kuerzer und
 * wuerde genau die Verwechslung erzeugen, wegen der die Kundenkarte bisher
 * ueberhaupt keine Anschrift zeigte.
 *
 * Die Adresstexte werden NICHT abgeschnitten: eine halbe Adresse ist keine
 * Adresse. Sie brechen um, und daneben stehen Kopieren und Karte.
 */
export const KundeOrte = ({
  orte,
  darfLoeschen,
}: {
  orte: Orte;
  /** Loeschen ist in der Datenbank owner/admin vorbehalten (RLS-Policy). */
  darfLoeschen: boolean;
}) => {
  const t = useT();

  const [anschriftDialog, setAnschriftDialog] = useState<{
    offen: boolean;
    satz: Anschrift | null;
    art?: "correspondence" | "billing";
  }>({ offen: false, satz: null });
  const [ortDialog, setOrtDialog] = useState<{ offen: boolean; satz: Serviceort | null }>({
    offen: false,
    satz: null,
  });
  const [loeschen, setLoeschen] = useState<
    { art: "anschrift" | "ort"; id: string } | null
  >(null);
  const [loescht, setLoescht] = useState(false);

  if (orte.fehler) {
    return (
      <AbschnittFehler
        titelKey="kunde.error.addresses"
        fehler={orte.fehler}
        laedt={orte.laedt}
        onRetry={orte.laden}
      />
    );
  }

  if (orte.laedt) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-folk-coral" aria-hidden />
      </div>
    );
  }

  const korrespondenz = orte.anschriften.filter((a) => a.address_type === "correspondence");
  const rechnung = orte.anschriften.filter((a) => a.address_type === "billing");

  const anschriftZeile = (a: Anschrift) => (
    <li
      key={a.id}
      className="flex flex-wrap items-start gap-2 rounded-lg border border-folk-line p-3"
    >
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-folk-ink3" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {a.is_primary && (
            <span className="rounded bg-folk-mint-bg px-1.5 py-0.5 text-[11px] font-medium text-folk-mint">
              {t("kunde.address.primary")}
            </span>
          )}
          {a.label && <span className="text-[12.5px] text-folk-ink3">{a.label}</span>}
        </div>
        <p className="mt-0.5 break-words text-[14px] text-folk-ink">{a.address_raw}</p>
        {a.notes && <p className="mt-0.5 break-words text-[12.5px] text-folk-ink2">{a.notes}</p>}
      </div>
      <AdressAktionen text={a.address_raw} />
      <div className="flex shrink-0 gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          aria-label={t("kunde.address.editTitle")}
          title={t("kunde.address.editTitle")}
          onClick={() => setAnschriftDialog({ offen: true, satz: a })}
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
        {darfLoeschen && (
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 text-folk-coral"
            aria-label={t("kunde.address.delete")}
            title={t("kunde.address.delete")}
            onClick={() => setLoeschen({ art: "anschrift", id: a.id })}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </li>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-folk-line bg-folk-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-folk-ink">
            {t("kunde.address.section")}
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setAnschriftDialog({ offen: true, satz: null })}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("kunde.address.add")}
          </Button>
        </div>

        {orte.anschriften.length === 0 ? (
          <div className="rounded-lg border border-dashed border-folk-line p-5 text-center">
            <p className="text-[14px] font-medium text-folk-ink">
              {t("kunde.empty.noAddress")}
            </p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-folk-ink2">
              {t("kunde.empty.noAddressHint")}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 gap-1.5"
              onClick={() =>
                setAnschriftDialog({ offen: true, satz: null, art: "correspondence" })
              }
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t("kunde.empty.addAddress")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="mb-1.5 text-[13px] font-medium text-folk-ink2">
                {t("kunde.address.correspondence")}
              </h3>
              {korrespondenz.length > 0 ? (
                <ul className="space-y-2">{korrespondenz.map(anschriftZeile)}</ul>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    setAnschriftDialog({ offen: true, satz: null, art: "correspondence" })
                  }
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {t("kunde.empty.addAddress")}
                </Button>
              )}
            </div>

            <div>
              <h3 className="mb-1.5 text-[13px] font-medium text-folk-ink2">
                {t("kunde.address.billing")}
              </h3>
              {rechnung.length > 0 ? (
                <ul className="space-y-2">{rechnung.map(anschriftZeile)}</ul>
              ) : (
                // Keine Rechnungsadresse ist kein Mangel, sondern der Normalfall:
                // die Rechnung geht dann an die Korrespondenzadresse. Das gehoert
                // hingeschrieben, sonst sucht jemand nach einer fehlenden Angabe.
                <div className="rounded-lg border border-dashed border-folk-line p-3">
                  <p className="text-[13px] text-folk-ink2">
                    {korrespondenz.length > 0
                      ? t("kunde.address.billingSame")
                      : t("kunde.empty.noAddress")}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1.5 gap-1.5"
                    onClick={() =>
                      setAnschriftDialog({ offen: true, satz: null, art: "billing" })
                    }
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {t("kunde.address.add")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-folk-line bg-folk-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-folk-ink">
            {t("kunde.location.section")}
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setOrtDialog({ offen: true, satz: null })}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("kunde.location.add")}
          </Button>
        </div>

        {orte.orte.length === 0 ? (
          <div className="rounded-lg border border-dashed border-folk-line p-5 text-center">
            <p className="text-[14px] font-medium text-folk-ink">
              {t("kunde.empty.noLocations")}
            </p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-folk-ink2">
              {t("kunde.empty.noLocationsHint")}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {orte.orte.map((o) => {
              const Icon = ROLLE_ICON[o.kind] ?? MapPin;
              const merkmale = [
                o.floor ? `${t("kunde.location.floor")}: ${o.floor}` : null,
                o.has_elevator === null
                  ? null
                  : t(o.has_elevator ? "kunde.location.elevatorYes" : "kunde.location.elevatorNo"),
                o.rooms !== null ? `${o.rooms} ${t("kunde.location.rooms")}` : null,
                o.area_m2 !== null ? `${o.area_m2} m²` : null,
              ].filter(Boolean) as string[];

              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-start gap-2 rounded-lg border border-folk-line p-3"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-folk-ink3" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-folk-bg-warm px-1.5 py-0.5 text-[11px] font-medium text-folk-ink2">
                        {t(ROLLE_LABEL[o.kind] ?? "kunde.location.kind.object")}
                      </span>
                      {o.label && (
                        <span className="text-[12.5px] text-folk-ink3">{o.label}</span>
                      )}
                    </div>
                    <p className="mt-0.5 break-words text-[14px] text-folk-ink">
                      {o.address_raw}
                    </p>
                    {merkmale.length > 0 && (
                      <p className="mt-0.5 text-[12.5px] text-folk-ink2">
                        {merkmale.join(" · ")}
                      </p>
                    )}
                    {o.parking_note && (
                      <p className="mt-0.5 break-words text-[12.5px] text-folk-ink2">
                        {t("kunde.location.parking")}: {o.parking_note}
                      </p>
                    )}
                    {o.access_note && (
                      <p className="mt-0.5 break-words text-[12.5px] text-folk-ink2">
                        {t("kunde.location.access")}: {o.access_note}
                      </p>
                    )}
                  </div>
                  <AdressAktionen text={o.address_raw} />
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9"
                      aria-label={t("kunde.location.editTitle")}
                      title={t("kunde.location.editTitle")}
                      onClick={() => setOrtDialog({ offen: true, satz: o })}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    {darfLoeschen && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-folk-coral"
                        aria-label={t("kunde.address.delete")}
                        title={t("kunde.address.delete")}
                        onClick={() => setLoeschen({ art: "ort", id: o.id })}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AnschriftDialog
        offen={anschriftDialog.offen}
        anschrift={anschriftDialog.satz}
        vorgabeArt={anschriftDialog.art}
        onOpenChange={(o) => setAnschriftDialog((z) => ({ ...z, offen: o }))}
        onSpeichern={orte.anschriftSpeichern}
      />

      <ServiceortDialog
        offen={ortDialog.offen}
        ort={ortDialog.satz}
        onOpenChange={(o) => setOrtDialog((z) => ({ ...z, offen: o }))}
        onSpeichern={orte.ortSpeichern}
      />

      <AlertDialog open={loeschen !== null} onOpenChange={(o) => !o && setLoeschen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                loeschen?.art === "ort"
                  ? "kunde.location.deleteTitle"
                  : "kunde.address.deleteTitle",
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                loeschen?.art === "ort"
                  ? "kunde.location.deleteHint"
                  : "kunde.address.deleteHint",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loescht}>{t("kunde.edit.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={loescht}
              onClick={async (e) => {
                // Der Standardablauf schliesst den Dialog sofort; das Loeschen
                // laeuft dann ohne sichtbaren Zustand weiter und liesse sich
                // durch einen zweiten Klick wiederholen.
                e.preventDefault();
                if (!loeschen || loescht) return;
                setLoescht(true);
                const ok =
                  loeschen.art === "ort"
                    ? await orte.ortLoeschen(loeschen.id)
                    : await orte.anschriftLoeschen(loeschen.id);
                setLoescht(false);
                if (ok) setLoeschen(null);
              }}
            >
              {loescht && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {t("kunde.address.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
