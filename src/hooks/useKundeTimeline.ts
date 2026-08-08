import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deuteLadefehler, type Ladefehler } from "@/lib/ladefehler";
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
 *
 * BEFUND (behoben): der Fehlerzweig setzte nur `loading` zurueck und liess die
 * Liste leer. Die Oberflaeche zeigte daraufhin "Noch keine Ereignisse" — eine
 * Aussage ueber diesen Kunden, die aus einem Fehlschlag entstanden war. Der
 * Fehler wird jetzt getragen und ist von "nichts vorhanden" unterscheidbar.
 */
export const useKundeTimeline = (customerId: string | undefined) => {
  const [ereignisse, setEreignisse] = useState<Ereignis[]>([]);
  const [loading, setLoading] = useState(true);
  const [mehrLaedt, setMehrLaedt] = useState(false);
  const [mehrDa, setMehrDa] = useState(false);
  const [fehler, setFehler] = useState<Ladefehler | null>(null);

  const holen = useCallback(
    async (offset: number) => {
      if (!customerId) return;
      if (offset === 0) {
        setLoading(true);
      } else {
        setMehrLaedt(true);
      }

      const { data, error } = await supabase.rpc("customer_timeline", {
        p_customer_id: customerId,
        p_limit: SEITE,
        p_offset: offset,
      });

      if (error) {
        setFehler(deuteLadefehler(error));
        // Beim ersten Laden bleibt die Liste leer, beim Nachladen bleibt das
        // Bisherige stehen — es war ja gueltig.
        if (offset === 0) setEreignisse([]);
        setLoading(false);
        setMehrLaedt(false);
        return;
      }

      const zeilen = (data ?? []) as Ereignis[];
      setFehler(null);
      setEreignisse((bisher) => (offset === 0 ? zeilen : [...bisher, ...zeilen]));
      // Eine volle Seite heisst: es koennte noch mehr geben.
      setMehrDa(zeilen.length === SEITE);
      setLoading(false);
      setMehrLaedt(false);
    },
    [customerId],
  );

  useEffect(() => {
    setEreignisse([]);
    setFehler(null);
    holen(0);
  }, [holen]);

  const mehrLaden = useCallback(() => holen(ereignisse.length), [holen, ereignisse.length]);
  const neuLaden = useCallback(() => holen(0), [holen]);

  return { ereignisse, loading, mehrLaedt, mehrDa, fehler, mehrLaden, neuLaden };
};
