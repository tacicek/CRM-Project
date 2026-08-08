import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { GooglePlacesAutocomplete } from "@/components/ui/google-places-autocomplete";
import { useT } from "@/i18n/useI18n";
import { ORTSROLLEN, type Serviceort } from "@/hooks/useKundeOrte";
import type { MessageKey } from "@/i18n/translator";

const ROLLE_LABEL: Record<string, MessageKey> = {
  from: "kunde.location.kind.from",
  to: "kunde.location.kind.to",
  object: "kunde.location.kind.object",
  storage: "kunde.location.kind.storage",
};

type Formular = {
  kind: string;
  label: string;
  address_raw: string;
  street: string;
  house_number: string;
  plz: string;
  city: string;
  floor: string;
  has_elevator: string;
  parking_note: string;
  access_note: string;
  rooms: string;
  area_m2: string;
  notes: string;
};

const LEER: Formular = {
  kind: "object",
  label: "",
  address_raw: "",
  street: "",
  house_number: "",
  plz: "",
  city: "",
  floor: "",
  has_elevator: "unbekannt",
  parking_note: "",
  access_note: "",
  rooms: "",
  area_m2: "",
  notes: "",
};

const oderNull = (wert: string): string | null => (wert.trim() === "" ? null : wert.trim());
const zahlOderNull = (wert: string): number | null => {
  const w = wert.trim().replace(",", ".");
  if (w === "") return null;
  const n = Number(w);
  return Number.isFinite(n) ? n : null;
};

/**
 * Einsatzort anlegen oder aendern — inklusive dessen, was beim Anfahren zaehlt.
 *
 * `has_elevator` ist in der Datenbank ein NULLABLE Boolean, und das ist eine
 * Angabe fuer sich: "kein Lift" und "wir wissen es nicht" sind verschiedene
 * Dinge. Deshalb drei Auswahlwerte und keine Schaltflaeche mit zwei Zustaenden.
 */
export const ServiceortDialog = ({
  offen,
  onOpenChange,
  ort,
  onSpeichern,
}: {
  offen: boolean;
  onOpenChange: (offen: boolean) => void;
  /** `null` legt einen neuen an. */
  ort: Serviceort | null;
  onSpeichern: (werte: Record<string, unknown> & { id?: string }) => Promise<boolean>;
}) => {
  const t = useT();
  const [form, setForm] = useState<Formular>(LEER);
  const [speichert, setSpeichert] = useState(false);

  useEffect(() => {
    if (!offen) return;
    setForm(
      ort
        ? {
            kind: ort.kind,
            label: ort.label ?? "",
            address_raw: ort.address_raw,
            street: ort.street ?? "",
            house_number: ort.house_number ?? "",
            plz: ort.plz ?? "",
            city: ort.city ?? "",
            floor: ort.floor ?? "",
            has_elevator:
              ort.has_elevator === null ? "unbekannt" : ort.has_elevator ? "ja" : "nein",
            parking_note: ort.parking_note ?? "",
            access_note: ort.access_note ?? "",
            rooms: ort.rooms === null ? "" : String(ort.rooms),
            area_m2: ort.area_m2 === null ? "" : String(ort.area_m2),
            notes: ort.notes ?? "",
          }
        : LEER,
    );
  }, [offen, ort]);

  const gueltig = form.address_raw.trim().length > 0;

  const absenden = async () => {
    if (speichert || !gueltig) return;
    setSpeichert(true);
    const ok = await onSpeichern({
      ...(ort ? { id: ort.id } : {}),
      kind: form.kind,
      label: oderNull(form.label),
      address_raw: form.address_raw.trim(),
      street: oderNull(form.street),
      house_number: oderNull(form.house_number),
      plz: oderNull(form.plz),
      city: oderNull(form.city),
      floor: oderNull(form.floor),
      has_elevator:
        form.has_elevator === "unbekannt" ? null : form.has_elevator === "ja",
      parking_note: oderNull(form.parking_note),
      access_note: oderNull(form.access_note),
      rooms: zahlOderNull(form.rooms),
      area_m2: zahlOderNull(form.area_m2),
      notes: oderNull(form.notes),
    });
    setSpeichert(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={offen} onOpenChange={(o) => !speichert && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t(ort ? "kunde.location.editTitle" : "kunde.location.addTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="o-rolle">{t("kunde.location.kind")}</Label>
              <Select
                value={form.kind}
                disabled={speichert}
                onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}
              >
                <SelectTrigger id="o-rolle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORTSROLLEN.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(ROLLE_LABEL[r])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-label">{t("kunde.address.label")}</Label>
              <Input
                id="o-label"
                value={form.label}
                disabled={speichert}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="o-adresse">{t("kunde.address.raw")}</Label>
            <GooglePlacesAutocomplete
              id="o-adresse"
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
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="o-plz">{t("kunde.address.plz")}</Label>
              <Input
                id="o-plz"
                inputMode="numeric"
                value={form.plz}
                disabled={speichert}
                onChange={(e) => setForm((f) => ({ ...f, plz: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="o-ort">{t("kunde.address.city")}</Label>
              <Input
                id="o-ort"
                value={form.city}
                disabled={speichert}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="o-stock">{t("kunde.location.floor")}</Label>
              <Input
                id="o-stock"
                value={form.floor}
                disabled={speichert}
                onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-lift">{t("kunde.location.elevator")}</Label>
              <Select
                value={form.has_elevator}
                disabled={speichert}
                onValueChange={(v) => setForm((f) => ({ ...f, has_elevator: v }))}
              >
                <SelectTrigger id="o-lift">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unbekannt">
                    {t("kunde.location.elevatorUnknown")}
                  </SelectItem>
                  <SelectItem value="ja">{t("kunde.location.elevatorYes")}</SelectItem>
                  <SelectItem value="nein">{t("kunde.location.elevatorNo")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="o-zimmer">{t("kunde.location.rooms")}</Label>
              <Input
                id="o-zimmer"
                inputMode="decimal"
                value={form.rooms}
                disabled={speichert}
                onChange={(e) => setForm((f) => ({ ...f, rooms: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-flaeche">{t("kunde.location.area")}</Label>
              <Input
                id="o-flaeche"
                inputMode="decimal"
                value={form.area_m2}
                disabled={speichert}
                onChange={(e) => setForm((f) => ({ ...f, area_m2: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="o-park">{t("kunde.location.parking")}</Label>
            <Input
              id="o-park"
              value={form.parking_note}
              disabled={speichert}
              onChange={(e) => setForm((f) => ({ ...f, parking_note: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="o-zugang">{t("kunde.location.access")}</Label>
            <Textarea
              id="o-zugang"
              rows={2}
              value={form.access_note}
              disabled={speichert}
              onChange={(e) => setForm((f) => ({ ...f, access_note: e.target.value }))}
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
