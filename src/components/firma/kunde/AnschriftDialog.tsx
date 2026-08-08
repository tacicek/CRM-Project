import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { GooglePlacesAutocomplete } from "@/components/ui/google-places-autocomplete";
import { useT } from "@/i18n/useI18n";
import type { Anschrift } from "@/hooks/useKundeOrte";

type Formular = {
  address_type: string;
  label: string;
  address_raw: string;
  street: string;
  house_number: string;
  plz: string;
  city: string;
  notes: string;
  is_primary: boolean;
};

const LEER: Formular = {
  address_type: "correspondence",
  label: "",
  address_raw: "",
  street: "",
  house_number: "",
  plz: "",
  city: "",
  notes: "",
  is_primary: true,
};

const oderNull = (wert: string): string | null => (wert.trim() === "" ? null : wert.trim());

/**
 * Anschrift anlegen oder aendern.
 *
 * `address_raw` ist das fuehrende Feld und bleibt UNZERLEGT — dieselbe
 * Entscheidung wie in `service_locations` (20260731100000). Die Ortssuche fuellt
 * PLZ und Ort mit, wenn Google die Adresse kennt; wer "c/o Meier, Hinterhaus
 * links" eintippt, kommt trotzdem durch. Deshalb haengt das Feld an
 * `onInputChange` und nicht nur an `onPlaceSelect`.
 */
export const AnschriftDialog = ({
  offen,
  onOpenChange,
  anschrift,
  vorgabeArt,
  onSpeichern,
}: {
  offen: boolean;
  onOpenChange: (offen: boolean) => void;
  /** `null` legt eine neue an. */
  anschrift: Anschrift | null;
  vorgabeArt?: "correspondence" | "billing";
  onSpeichern: (werte: Record<string, unknown> & { id?: string }) => Promise<boolean>;
}) => {
  const t = useT();
  const [form, setForm] = useState<Formular>(LEER);
  const [speichert, setSpeichert] = useState(false);

  useEffect(() => {
    if (!offen) return;
    setForm(
      anschrift
        ? {
            address_type: anschrift.address_type,
            label: anschrift.label ?? "",
            address_raw: anschrift.address_raw,
            street: anschrift.street ?? "",
            house_number: anschrift.house_number ?? "",
            plz: anschrift.plz ?? "",
            city: anschrift.city ?? "",
            notes: anschrift.notes ?? "",
            is_primary: anschrift.is_primary,
          }
        : { ...LEER, address_type: vorgabeArt ?? "correspondence" },
    );
  }, [offen, anschrift, vorgabeArt]);

  const gueltig = form.address_raw.trim().length > 0;

  const absenden = async () => {
    if (speichert || !gueltig) return;
    setSpeichert(true);
    const ok = await onSpeichern({
      ...(anschrift ? { id: anschrift.id } : {}),
      address_type: form.address_type,
      label: oderNull(form.label),
      address_raw: form.address_raw.trim(),
      street: oderNull(form.street),
      house_number: oderNull(form.house_number),
      plz: oderNull(form.plz),
      city: oderNull(form.city),
      notes: oderNull(form.notes),
      is_primary: form.is_primary,
    });
    setSpeichert(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={offen} onOpenChange={(o) => !speichert && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t(anschrift ? "kunde.address.editTitle" : "kunde.address.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("kunde.address.hint")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="a-art">{t("kunde.address.type")}</Label>
            <Select
              value={form.address_type}
              disabled={speichert}
              onValueChange={(v) => setForm((f) => ({ ...f, address_type: v }))}
            >
              <SelectTrigger id="a-art">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="correspondence">
                  {t("kunde.address.correspondence")}
                </SelectItem>
                <SelectItem value="billing">{t("kunde.address.billing")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-adresse">{t("kunde.address.raw")}</Label>
            <GooglePlacesAutocomplete
              id="a-adresse"
              value={form.address_raw}
              disabled={speichert}
              placeholder={t("kunde.address.rawPlaceholder")}
              onInputChange={(v) => setForm((f) => ({ ...f, address_raw: v }))}
              onPlaceSelect={(p) =>
                setForm((f) => ({
                  ...f,
                  address_raw: p.formattedAddress || f.address_raw,
                  street: p.street || f.street,
                  house_number: p.houseNumber || f.house_number,
                  plz: p.plz || f.plz,
                  city: p.city || f.city,
                }))
              }
            />
            {!gueltig && (
              <p className="text-[12.5px] text-folk-ink3">{t("kunde.address.required")}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-plz">{t("kunde.address.plz")}</Label>
              <Input
                id="a-plz"
                inputMode="numeric"
                value={form.plz}
                disabled={speichert}
                onChange={(e) => setForm((f) => ({ ...f, plz: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="a-ort">{t("kunde.address.city")}</Label>
              <Input
                id="a-ort"
                value={form.city}
                disabled={speichert}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-label">{t("kunde.address.label")}</Label>
            <Input
              id="a-label"
              value={form.label}
              disabled={speichert}
              placeholder={t("kunde.address.labelPlaceholder")}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-notiz">{t("kunde.address.notes")}</Label>
            <Textarea
              id="a-notiz"
              rows={2}
              value={form.notes}
              disabled={speichert}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-folk-line bg-folk-bg-warm p-3">
            <Label htmlFor="a-haupt" className="text-[13px]">
              {t("kunde.address.setPrimary")}
            </Label>
            <Switch
              id="a-haupt"
              checked={form.is_primary}
              disabled={speichert}
              onCheckedChange={(an) => setForm((f) => ({ ...f, is_primary: an }))}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={speichert} onClick={() => onOpenChange(false)}>
            {t("kunde.edit.cancel")}
          </Button>
          <Button disabled={speichert || !gueltig} onClick={absenden}>
            {speichert && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {t("kunde.edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
