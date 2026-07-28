import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Ereignis =
  Database["public"]["Functions"]["customer_timeline"]["Returns"][number];

const SEITE = 25;

/**
 * Verlauf eines Kunden, seitenweise nachgeladen ("Mehr laden").
 *
 * Geblaettert wird ueber OFFSET. `customer_timeline` traegt zusaetzlich einen
 * `p_before`-Parameter fuer echtes Keyset-Blaettern — der bleibt hier ungenutzt,
 * solange ein Kunde ein paar Dutzend Ereignisse hat. Er steht in der Signatur,
 * damit der Wechsel spaeter weder die RPC noch diesen Hook aendert.
 */
export const useKundeTimeline = (customerId: string | undefined) => {
  const [ereignisse, setEreignisse] = useState<Ereignis[]>([]);
  const [loading, setLoading] = useState(true);
  const [mehrDa, setMehrDa] = useState(false);

  const holen = useCallback(
    async (offset: number) => {
      if (!customerId) return;
      const { data, error } = await supabase.rpc("customer_timeline", {
        p_customer_id: customerId,
        p_limit: SEITE,
        p_offset: offset,
      });
      if (error) {
        setLoading(false);
        return;
      }
      const zeilen = (data ?? []) as Ereignis[];
      setEreignisse((bisher) => (offset === 0 ? zeilen : [...bisher, ...zeilen]));
      // Eine volle Seite heisst: es koennte noch mehr geben.
      setMehrDa(zeilen.length === SEITE);
      setLoading(false);
    },
    [customerId],
  );

  useEffect(() => {
    setLoading(true);
    setEreignisse([]);
    holen(0);
  }, [holen]);

  const mehrLaden = useCallback(() => holen(ereignisse.length), [holen, ereignisse.length]);

  return { ereignisse, loading, mehrDa, mehrLaden };
};
