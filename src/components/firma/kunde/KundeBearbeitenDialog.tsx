import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n/useI18n";
import { isValidEmail } from "@/lib/validation";
import { istBrauchbareTelefonnummer } from "@/lib/telefonE164";
import { abgeleiteterAnzeigename, folgtDemNamen } from "@/lib/kundeAnzeigename";
import type { Kunde, KundeUpdate } from "@/hooks/useKunden";

type Formular = {
  customer_type: string;
  salutation: string;
  first_name: string;
  last_name: string;
  company_name: string;
  display_name: string;
  primary_email: string;
  primary_phone: string;
  language: string;
  status: string;
  external_customer_number: string;
  notes: string;
};

const ausKunde = (k: Kunde): Formular => ({
  customer_type: k.customer_type,
  salutation: k.salutation ?? "",
  first_name: k.first_name ?? "",
  last_name: k.last_name ?? "",
  company_name: k.company_name ?? "",
  display_name: k.display_name,
  primary_email: k.primary_email ?? "",
  primary_phone: k.primary_phone ?? "",
  language: k.language,
  status: k.status,
  external_customer_number: k.external_customer_number ?? "",
  notes: k.notes ?? "",
});

/** Leerstring heisst in der Datenbank NULL, nicht "". */
const oderNull = (wert: string): string | null => (wert.trim() === "" ? null : wert.trim());

/**
 * Der Stammsatz eines Kunden — der einzige Ort, an dem er gepflegt wird.
 *
 * Vorher liess sich hier NUR die Notiz aendern; Name, Firma, Telefon, E-Mail,
 * Sprache und Status waren schreibgeschuetzt, obwohl sie sich staendig aendern.
 * Wer umgezogen war oder geheiratet hatte, musste in der Datenbank angefasst
 * werden.
 *
 * ZWEI Dinge, die dieses Formular richtig machen muss:
 *
 *   1. Der ANZEIGENAME. Der Trigger `customers_set_display_name` fuellt ihn nur,
 *      wenn er leer ist — ein geaenderter Nachname zieht ihn deshalb nicht nach.
 *      Ihn bei jedem Speichern neu zu bilden wuerde umgekehrt "Familie Mueller"
 *      ueberschreiben. Der Schalter unten macht den Unterschied sichtbar und
 *      steht beim Oeffnen auf dem, was tatsaechlich der Fall ist.
 *
 *   2. Die TELEFONNUMMER. Eine Nummer ohne Landesvorwahl wird von
 *      `normalize_customer_phone()` verworfen; der Kunde ist dann im Abgleich
 *      unerreichbar und jede neue Anfrage legt einen zweiten an. Das Formular
 *      sagt das VORHER, statt es geschehen zu lassen.
 */
export const KundeBearbeitenDialog = ({
  kunde,
  offen,
  onOpenChange,
  onSpeichern,
}: {
  kunde: Kunde;
  offen: boolean;
  onOpenChange: (offen: boolean) => void;
  onSpeichern: (werte: KundeUpdate) => Promise<boolean>;
}) => {
  const t = useT();

  const [form, setForm] = useState<Formular>(() => ausKunde(kunde));
  const [nameFolgt, setNameFolgt] = useState(() => folgtDemNamen(kunde.display_name, kunde));
  const [speichert, setSpeichert] = useState(false);
  const [verwerfenOffen, setVerwerfenOffen] = useState(false);

  // Beim Oeffnen den aktuellen Stand uebernehmen. Ein Formular, das den Stand
  // von vorgestern zeigt, ueberschreibt fremde Aenderungen.
  useEffect(() => {
    if (offen) {
      setForm(ausKunde(kunde));
      setNameFolgt(folgtDemNamen(kunde.display_name, kunde));
    }
  }, [offen, kunde]);

  const istFirma = form.customer_type === "company";
  const ausAbgeleitet = abgeleiteterAnzeigename(form);

  const schmutzig = useMemo(() => {
    const alt = ausKunde(kunde);
    return (Object.keys(alt) as (keyof Formular)[]).some((k) => alt[k] !== form[k]);
  }, [form, kunde]);

  const fehler = useMemo(() => {
    const f: Partial<Record<keyof Formular | "identitaet" | "name", string>> = {};
    if (form.primary_email.trim() && !isValidEmail(form.primary_email)) {
      f.primary_email = t("kunde.edit.invalidEmail");
    }
    if (!istBrauchbareTelefonnummer(form.primary_phone)) {
      f.primary_phone = t("kunde.edit.invalidPhone");
    }
    // Die CHECK-Bedingung `customers_identity_required` auf der Tabelle: ohne
    // E-Mail und ohne Telefon ist ein Kunde im Abgleich unerreichbar. Sie hier
    // zu spiegeln erspart eine unverstaendliche 23514-Meldung.
    if (!form.primary_email.trim() && !form.primary_phone.trim()) {
      f.identitaet = t("kunde.edit.identityRequired");
    }
    // display_name ist NOT NULL. Folgt er dem Namen und ist der Name leer,
    // koennte die Datenbank nichts bilden.
    const kuenftig = nameFolgt ? ausAbgeleitet : form.display_name.trim();
    if (!kuenftig) f.name = t("kunde.edit.nameRequired");
    return f;
  }, [form, nameFolgt, ausAbgeleitet, t]);

  const gueltig = Object.keys(fehler).length === 0;

  const schliessen = (naechster: boolean) => {
    if (!naechster && schmutzig && !speichert) {
      setVerwerfenOffen(true);
      return;
    }
    if (!speichert) onOpenChange(naechster);
  };

  const absenden = async () => {
    // Doppelklick-Sperre: die zweite Anfrage schriebe dieselben Werte erneut
    // und der zweite Erfolgston verwirrte nur.
    if (speichert || !gueltig) return;
    setSpeichert(true);

    const werte: KundeUpdate = {
      customer_type: form.customer_type,
      salutation: oderNull(form.salutation),
      first_name: oderNull(form.first_name),
      last_name: oderNull(form.last_name),
      company_name: oderNull(form.company_name),
      primary_email: oderNull(form.primary_email),
      primary_phone: oderNull(form.primary_phone),
      language: form.language,
      status: form.status,
      external_customer_number: oderNull(form.external_customer_number),
      notes: oderNull(form.notes),
      // Folgt der Name der Regel, wird ein LEERER Wert geschickt und der
      // Trigger bildet ihn aus den neuen Feldern. So gibt es eine Regel und
      // nicht zwei, die auseinanderlaufen.
      display_name: nameFolgt ? "" : form.display_name.trim(),
    };

    const ok = await onSpeichern(werte);
    setSpeichert(false);
    // Bei einem Fehlschlag bleibt das Formular stehen — samt aller Eingaben.
    if (ok) onOpenChange(false);
  };

  const feld = (schluessel: keyof Formular) => ({
    value: form[schluessel],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [schluessel]: e.target.value })),
    disabled: speichert,
  });

  return (
    <>
      <Dialog open={offen} onOpenChange={schliessen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("kunde.edit.title")}</DialogTitle>
            <DialogDescription>{t("kunde.edit.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="k-typ">{t("kunde.field.type")}</Label>
                <Select
                  value={form.customer_type}
                  disabled={speichert}
                  onValueChange={(v) => setForm((f) => ({ ...f, customer_type: v }))}
                >
                  <SelectTrigger id="k-typ">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="person">{t("kunde.type.person")}</SelectItem>
                    <SelectItem value="company">{t("kunde.type.company")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="k-status">{t("kunde.field.status")}</Label>
                <Select
                  value={form.status}
                  disabled={speichert}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger id="k-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("kunde.status.active")}</SelectItem>
                    <SelectItem value="inactive">{t("kunde.status.inactive")}</SelectItem>
                    <SelectItem value="blocked">{t("kunde.status.blocked")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Firmenfelder und Personenfelder schliessen sich nicht aus: eine
                Firma hat eine Ansprechperson. Was sich aendert, ist die
                Reihenfolge und was zuerst gefragt wird. */}
            {istFirma && (
              <div className="space-y-1.5">
                <Label htmlFor="k-firma">{t("kunde.field.companyName")}</Label>
                <Input id="k-firma" {...feld("company_name")} />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="k-anrede">{t("kunde.field.salutation")}</Label>
                <Select
                  value={form.salutation || "—"}
                  disabled={speichert}
                  onValueChange={(v) => setForm((f) => ({ ...f, salutation: v === "—" ? "" : v }))}
                >
                  <SelectTrigger id="k-anrede">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="—">{t("kunde.field.none")}</SelectItem>
                    <SelectItem value="Herr">Herr</SelectItem>
                    <SelectItem value="Frau">Frau</SelectItem>
                    <SelectItem value="Firma">Firma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="k-vorname">{t("kunde.field.firstName")}</Label>
                <Input id="k-vorname" {...feld("first_name")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="k-nachname">{t("kunde.field.lastName")}</Label>
                <Input id="k-nachname" {...feld("last_name")} />
              </div>
            </div>

            {!istFirma && (
              <div className="space-y-1.5">
                <Label htmlFor="k-firma-p">{t("kunde.field.companyName")}</Label>
                <Input id="k-firma-p" {...feld("company_name")} />
              </div>
            )}

            {/* Anzeigename: zwei Zustaende, sichtbar gemacht. */}
            <div className="space-y-2 rounded-lg border border-folk-line bg-folk-bg-warm p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="k-eigenername" className="text-[13px]">
                  {t("kunde.edit.displayNameOwn")}
                </Label>
                <Switch
                  id="k-eigenername"
                  checked={!nameFolgt}
                  disabled={speichert}
                  onCheckedChange={(an) => {
                    setNameFolgt(!an);
                    if (an && !form.display_name.trim()) {
                      setForm((f) => ({ ...f, display_name: ausAbgeleitet }));
                    }
                  }}
                />
              </div>
              {nameFolgt ? (
                <p className="text-[12.5px] text-folk-ink2">
                  {t("kunde.edit.displayNameFollows", {
                    name: ausAbgeleitet || t("kunde.field.none"),
                  })}
                </p>
              ) : (
                <>
                  <Input
                    aria-label={t("kunde.field.displayName")}
                    {...feld("display_name")}
                  />
                  <p className="text-[12px] text-folk-ink3">
                    {t("kunde.edit.displayNameOwnHint")}
                  </p>
                </>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="k-mail">{t("kunde.field.email")}</Label>
                <Input id="k-mail" type="email" inputMode="email" {...feld("primary_email")} />
                {fehler.primary_email && (
                  <p className="text-[12.5px] font-medium text-folk-coral">
                    {fehler.primary_email}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="k-tel">{t("kunde.field.phone")}</Label>
                <Input id="k-tel" type="tel" inputMode="tel" {...feld("primary_phone")} />
                {fehler.primary_phone && (
                  <p className="text-[12.5px] font-medium text-folk-coral">
                    {fehler.primary_phone}
                  </p>
                )}
              </div>
            </div>

            {fehler.identitaet && (
              <p className="text-[12.5px] font-medium text-folk-coral">{fehler.identitaet}</p>
            )}
            {fehler.name && (
              <p className="text-[12.5px] font-medium text-folk-coral">{fehler.name}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="k-sprache">{t("kunde.field.language")}</Label>
                <Select
                  value={form.language}
                  disabled={speichert}
                  onValueChange={(v) => setForm((f) => ({ ...f, language: v }))}
                >
                  <SelectTrigger id="k-sprache">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="k-nummer">{t("kunde.field.customerNumber")}</Label>
                <Input id="k-nummer" {...feld("external_customer_number")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="k-notiz">{t("kunde.field.notes")}</Label>
              <Textarea
                id="k-notiz"
                rows={3}
                placeholder={t("kunde.field.notesPlaceholder")}
                {...feld("notes")}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={speichert} onClick={() => schliessen(false)}>
              {t("kunde.edit.cancel")}
            </Button>
            <Button disabled={speichert || !gueltig || !schmutzig} onClick={absenden}>
              {speichert && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {speichert ? t("kunde.edit.saving") : t("kunde.edit.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={verwerfenOffen} onOpenChange={setVerwerfenOffen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("kunde.edit.discardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("kunde.edit.discardHint")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("kunde.edit.discardCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setVerwerfenOffen(false);
                onOpenChange(false);
              }}
            >
              {t("kunde.edit.discardConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
