import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Was `get_box_rental_stats` (Migration 20260802100000) zurückgibt. */
export type BoxRentalStats = {
  total_active: number;
  overdue: number;
  urgent: number;
  pickup_today: number;
};

export const boxRentalStatsQueryKey = (companyId: string | null) =>
  ["boxRentalStats", companyId] as const;

/**
 * Die Kennzahlen der Boxenvermietung.
 *
 * Ein gemeinsamer Hook, weil zwei Stellen dieselbe Zahl brauchen: das Abzeichen
 * neben „Umzugsboxen" in der Navigation und die Kachel auf der Übersicht. Sie
 * riefen die RPC bisher getrennt auf — bei jedem Besuch der Übersicht zweimal
 * dasselbe. Über einen gemeinsamen Schlüssel fasst React Query das zusammen.
 *
 * Über die RPC und nicht über eigene Abfragen: `urgent` ist dort definiert und
 * ist dieselbe Zahl, die die Boxenseite im roten Band zeigt. Eine zweite
 * Filterlogik ergäbe früher oder später eine andere Zahl als die Seite, auf die
 * das Abzeichen führt.
 *
 * **Auffrischung.** Eine Miete wird nicht durch ein Ereignis überfällig,
 * sondern durch Zeitablauf — ein Realtime-Kanal hätte hier nichts zu melden.
 * Die Navigation lud deshalb bei jedem Seitenwechsel neu, was bei zwanzig
 * Klicks in einer Minute zwanzig Abfragen für eine Zahl bedeutete, die sich
 * frühestens am nächsten Tag ändert. Stattdessen: eine Minute Haltbarkeit, und
 * neu geholt wird beim Zurückkehren ins Fenster oder beim nächsten Aufbau der
 * Übersicht.
 */
export const useBoxRentalStats = (companyId: string | null) =>
  useQuery({
    queryKey: boxRentalStatsQueryKey(companyId),
    enabled: companyId !== null,
    staleTime: 60_000,
    // Bewusst gegen die globale Vorgabe: dieses Abzeichen soll aktuell sein,
    // wenn jemand nach einer Pause zurück an den Rechner kommt.
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<BoxRentalStats | null> => {
      // `enabled` schliesst den Fall aus; der Typ weiss davon nichts.
      if (companyId === null) throw new Error("Boxen-Kennzahlen ohne Firma abgefragt");

      const { data, error } = await supabase.rpc("get_box_rental_stats", {
        p_company_id: companyId,
      });
      if (error) throw error;

      // Die RPC liefert eine Menge mit höchstens einer Zeile. Keine Zeile heisst
      // „noch keine Vermietung", nicht „Fehler" — daher null und keine Nullen.
      return (data?.[0] as BoxRentalStats | undefined) ?? null;
    },
  });
