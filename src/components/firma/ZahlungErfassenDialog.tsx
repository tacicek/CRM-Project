import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";
import type { MessageKey } from "@/i18n/translator";

const WEGE: { wert: string; labelKey: MessageKey }[] = [
  { wert: "bank", labelKey: "finanz.method.bank" },
  { wert: "qr", labelKey: "finanz.method.qr" },
  { wert: "twint", labelKey: "finanz.method.twint" },
  { wert: "cash", labelKey: "finanz.method.cash" },
  { wert: "card", labelKey: "finanz.method.card" },
  { wert: "other", labelKey: "finanz.method.other" },
];

type Props = {
  open: boolean;
  onOpenChange: (offen: boolean) => void;
  companyId: string;
  /** Rechnung, auf die angerechnet wird. Ohne sie ist es eine Quittung. */
  rechnung?: { id: string; nr: string; offen: number; customerId: string | null };
  /** Quittung, deren Eingang bescheinigt wird. */
  quittung?: { id: string; nr: string; betrag: number };
  onDone: () => void;
};

/**
 * Zahlungseingang erfassen.
 *
 * Warum ein Dialog und kein Knopf: der bisherige "Als bezahlt markieren"-Knopf
 * hat einen Wert gesetzt, aber drei verschwiegen — wann, wie viel und womit.
 * Genau die fehlen im Buch, wenn man sie nicht fragt. Der Weg laesst sich
 * spaeter nicht mehr korrigieren (payments ist append-only), deshalb steht er
 * hier und nicht im Nachhinein.
 */
export const ZahlungErfassenDialog = ({
  open, onOpenChange, companyId, rechnung, quittung, onDone,
}: Props) => {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();

  const vorgabe = rechnung?.offen ?? quittung?.betrag ?? 0;
  const [betrag, setBetrag] = useState(String(vorgabe));
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [weg, setWeg] = useState(quittung ? "cash" : "bank");
  const [referenz, setReferenz] = useState("");
  const [sendet, setSendet] = useState(false);

  useEffect(() => {
    if (open) {
      setBetrag(String(rechnung?.offen ?? quittung?.betrag ?? 0));
      setDatum(new Date().toISOString().slice(0, 10));
      setWeg(quittung ? "cash" : "bank");
      setReferenz("");
    }
  }, [open, rechnung?.offen, quittung?.betrag, quittung]);

  const zahl = Number(betrag.replace(",", "."));
  const ueberzahlung = rechnung !== undefined && zahl > rechnung.offen;

  const speichern = async () => {
    if (!Number.isFinite(zahl) || zahl <= 0) return;
    setSendet(true);

    if (quittung) {
      const { data, error } = await supabase.rpc("record_quittung_payment", {
        p_quittung_id: quittung.id,
        p_method: weg,
        p_payment_date: datum,
        p_reference: referenz || undefined,
      });
      setSendet(false);
      if (error) {
        toast({ title: t("common.error"), description: error.message, variant: "destructive" });
        return;
      }
      // Die RPC meldet zurueck, wenn zum selben Vorgang schon eine Zahlung auf
      // eine Rechnung gebucht ist. Verhindern laesst sich das nicht — es kann
      // eine Anzahlung sein. Verschweigen sollte man es nicht.
      const warnung = (data as { warnung?: string | null } | null)?.warnung;
      toast(
        warnung
          ? { title: t("finanz.dialog.saved"), description: t("finanz.dialog.doppelt") }
          : { title: t("finanz.dialog.saved") },
      );
      onOpenChange(false);
      onDone();
      return;
    }

    if (!rechnung) return;
    const angerechnet = Math.min(zahl, rechnung.offen);
    const { error } = await supabase.rpc("record_payment", {
      p_company_id: companyId,
      p_amount: zahl,
      p_payment_date: datum,
      p_method: weg,
      p_customer_id: rechnung.customerId ?? undefined,
      p_reference: referenz || undefined,
      p_allocations: [{ rechnung_id: rechnung.id, amount: angerechnet }],
    });
    setSendet(false);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("finanz.dialog.saved") });
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("finanz.dialog.title")}</DialogTitle>
          <DialogDescription>
            {rechnung
              ? t("finanz.dialog.forInvoice", { nr: rechnung.nr })
              : t("finanz.dialog.forQuittung", { nr: quittung?.nr ?? "" })}
            {rechnung && (
              <>
                {" · "}
                {t("finanz.dialog.openAmount", {
                  amount: formatCurrency(rechnung.offen, locale),
                })}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="zahlung-betrag">{t("finanz.dialog.amount")}</Label>
              <Input
                id="zahlung-betrag"
                type="number"
                step="0.05"
                min="0"
                value={betrag}
                onChange={(e) => setBetrag(e.target.value)}
                disabled={quittung !== undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zahlung-datum">{t("finanz.dialog.date")}</Label>
              <Input
                id="zahlung-datum"
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("finanz.dialog.method")}</Label>
            <Select value={weg} onValueChange={setWeg}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEGE.map((w) => (
                  <SelectItem key={w.wert} value={w.wert}>
                    {t(w.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="zahlung-referenz">{t("finanz.dialog.reference")}</Label>
            <Input
              id="zahlung-referenz"
              value={referenz}
              onChange={(e) => setReferenz(e.target.value)}
              placeholder={t("finanz.dialog.referencePlaceholder")}
            />
          </div>

          {ueberzahlung && (
            <p className="rounded-lg bg-folk-bg-warm px-3 py-2 text-[13px] text-folk-ink3">
              {t("finanz.dialog.overpay")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={speichern}
            disabled={sendet || !Number.isFinite(zahl) || zahl <= 0}
          >
            {sendet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("finanz.dialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
