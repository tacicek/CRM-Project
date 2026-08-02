import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { tombstoneResponse } from "../_shared/resendEmailTombstone.ts";

/**
 * Stillgelegt.
 *
 * Diese Datei ist der Grabstein einer Funktion, die es fachlich nie gab: sie
 * hiess Wiederversand, konnte aber keinen leisten. Warum sie stillgelegt wurde,
 * warum an ihrer Stelle keine geloeschte Datei steht und was sie frueher alles
 * anfasste, erklaert ../_shared/resendEmailTombstone.ts — dort steht auch die
 * Entscheidung, die hier nur noch angewandt wird, und dort laesst sie sich
 * ausfuehren.
 *
 * Von der Anfrage wird ausser der Methode nichts angesehen.
 */
serve((req: Request) => {
  const ergebnis = tombstoneResponse(req.method);
  return new Response(ergebnis.body === null ? null : JSON.stringify(ergebnis.body), {
    status: ergebnis.status,
    headers: ergebnis.headers,
  });
});
