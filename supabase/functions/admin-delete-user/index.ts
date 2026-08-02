import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { retiredAdminResponse } from "../_shared/retiredAdminEndpoint.ts";

/**
 * Stillgelegt: admin-delete-user.
 *
 * Teil der Offerio-Plattformverwaltung, die mit dem Marktplatz entfernt wurde.
 * Kein Aufrufer mehr — weder im Frontend noch in einer anderen Funktion, in SQL
 * oder in einem Cron-Job.
 *
 * Warum hier ein Grabstein steht und keine geloeschte Datei, erklaert
 * ../_shared/retiredAdminEndpoint.ts. Dort steht auch die Entscheidung, die
 * hier nur angewandt wird, und dort laesst sie sich ausfuehren.
 *
 * Von der Anfrage wird ausser der Methode nichts angesehen.
 */
serve((req: Request) => {
  const ergebnis = retiredAdminResponse(req.method);
  return new Response(ergebnis.body === null ? null : JSON.stringify(ergebnis.body), {
    status: ergebnis.status,
    headers: ergebnis.headers,
  });
});
