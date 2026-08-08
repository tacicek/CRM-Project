import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n/useI18n";
import { deuteLadefehler, type Ladefehler } from "@/lib/ladefehler";
import type { Database } from "@/integrations/supabase/types";

export type Anschrift = Database["public"]["Tables"]["customer_addresses"]["Row"];
export type AnschriftEingabe = Database["public"]["Tables"]["customer_addresses"]["Insert"];
export type Serviceort = Database["public"]["Tables"]["service_locations"]["Row"];
export type ServiceortEingabe = Database["public"]["Tables"]["service_locations"]["Insert"];

export type Adressart = "correspondence" | "billing";

export type Ortsrolle = "from" | "to" | "object" | "storage";
export const ORTSROLLEN: Ortsrolle[] = ["from", "to", "object", "storage"];

/**
 * Die Orte eines Kunden — zwei Begriffe, bewusst nebeneinander.
 *
 *   `customer_addresses`  wo der Kunde WOHNT und wohin die Rechnung geht.
 *                         Stammdatum, aenderbar, ohne Wirkung auf Belege.
 *   `service_locations`   wo GEARBEITET wird: Auszug, Einzug, Objekt, Lager.
 *                         Traegt Stockwerk, Lift, Parksituation, Zugang.
 *
 * Sie in einer Liste zu fuehren waere bequemer und falsch: eine Hausverwaltung
 * bekommt die Rechnung ins Buero und den Auftrag in die Liegenschaft.
 *
 * Beide Tabellen tragen `company_id` und RLS auf `is_company_member`; die
 * Abfragen hier filtern zusaetzlich auf den Kunden.
 */
export const useKundeOrte = (customerId: string | undefined, companyId: string | undefined) => {
  const { toast } = useToast();
  const t = useT();

  const [anschriften, setAnschriften] = useState<Anschrift[]>([]);
  const [orte, setOrte] = useState<Serviceort[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<Ladefehler | null>(null);

  const laden = useCallback(async () => {
    if (!customerId) return;
    setLaedt(true);
    const [a, o] = await Promise.all([
      supabase
        .from("customer_addresses")
        .select("*")
        .eq("customer_id", customerId)
        .order("address_type")
        .order("is_primary", { ascending: false })
        .order("created_at"),
      supabase
        .from("service_locations")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ]);

    // Ein Fehlschlag auf einer der beiden Seiten macht den ganzen Abschnitt
    // unsicher: eine halb geladene Adressliste sieht aus wie eine vollstaendige.
    const f = deuteLadefehler(a.error) ?? deuteLadefehler(o.error);
    if (f) {
      setFehler(f);
      setAnschriften([]);
      setOrte([]);
      setLaedt(false);
      return;
    }
    setFehler(null);
    setAnschriften(a.data ?? []);
    setOrte(o.data ?? []);
    setLaedt(false);
  }, [customerId]);

  useEffect(() => {
    laden();
  }, [laden]);

  const melden = useCallback(
    (titelKey: Parameters<typeof t>[0], f: Ladefehler | null) =>
      toast({
        title: t(titelKey),
        description: f?.art === "kein_zugriff" ? t("kunde.error.forbidden") : f?.nachricht,
        variant: "destructive",
      }),
    [toast, t],
  );

  const anschriftSpeichern = useCallback(
    async (werte: Partial<AnschriftEingabe> & { id?: string }): Promise<boolean> => {
      if (!customerId || !companyId) return false;
      const { id, ...rest } = werte;

      const { error } = id
        ? await supabase.from("customer_addresses").update(rest).eq("id", id)
        : await supabase.from("customer_addresses").insert({
            ...(rest as AnschriftEingabe),
            company_id: companyId,
            customer_id: customerId,
          });

      if (error) {
        melden("kunde.address.saved", deuteLadefehler(error));
        return false;
      }
      toast({ title: t("kunde.address.saved") });
      await laden();
      return true;
    },
    [customerId, companyId, laden, toast, t, melden],
  );

  const anschriftLoeschen = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from("customer_addresses").delete().eq("id", id);
      if (error) {
        melden("kunde.address.saved", deuteLadefehler(error));
        return false;
      }
      toast({ title: t("kunde.address.deleted") });
      await laden();
      return true;
    },
    [laden, toast, t, melden],
  );

  const ortSpeichern = useCallback(
    async (werte: Partial<ServiceortEingabe> & { id?: string }): Promise<boolean> => {
      if (!customerId || !companyId) return false;
      const { id, ...rest } = werte;

      const { error } = id
        ? await supabase.from("service_locations").update(rest).eq("id", id)
        : await supabase.from("service_locations").insert({
            ...(rest as ServiceortEingabe),
            company_id: companyId,
            customer_id: customerId,
          });

      if (error) {
        melden("kunde.location.saved", deuteLadefehler(error));
        return false;
      }
      toast({ title: t("kunde.location.saved") });
      await laden();
      return true;
    },
    [customerId, companyId, laden, toast, t, melden],
  );

  const ortLoeschen = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from("service_locations").delete().eq("id", id);
      if (error) {
        melden("kunde.location.saved", deuteLadefehler(error));
        return false;
      }
      toast({ title: t("kunde.location.deleted") });
      await laden();
      return true;
    },
    [laden, toast, t, melden],
  );

  /** Die Hauptadresse einer Art; `undefined`, wenn keine erfasst ist. */
  const haupt = (art: Adressart): Anschrift | undefined =>
    anschriften.find((a) => a.address_type === art && a.is_primary) ??
    anschriften.find((a) => a.address_type === art);

  return {
    anschriften,
    orte,
    laedt,
    fehler,
    laden,
    haupt,
    anschriftSpeichern,
    anschriftLoeschen,
    ortSpeichern,
    ortLoeschen,
  };
};
