import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { fetchCompanyById } from "@/lib/fetchCompanyById";
import { antwortGehoertNochZumMandanten } from "@/lib/aktiverMandant";

/**
 * Der vollstaendige Firmensatz des AKTIVEN Mandanten.
 *
 * `useCompanyContext().activeCompany` traegt nur vier Felder (id, Name, Logo,
 * is_verified, default_language). Wer Adresse, IBAN oder MWST-Nummer braucht —
 * jede QR-Rechnung tut das — muss nachladen. Bis hierher taten das 16 Seiten je
 * einzeln, und alle 16 fragten `fetchSingleCompanyForUser`, also den Helfer,
 * der die Firma RAET statt die ausgewaehlte zu nehmen.
 *
 * Dieser Hook ist die eine Stelle, die das richtig macht:
 *
 *  - Er fragt nach `companyId` aus dem Kontext, nie nach dem Benutzer.
 *  - Er verwirft eine Antwort, deren Mandant nicht mehr der aktive ist
 *    (Wechsel waehrend laufender Abfrage).
 *  - Er MELDET einen Fehler, statt ihn zu schlucken. Eine Rechnung ohne
 *    Firmenadresse ist keine Rechnung, und ein PDF-Knopf, der wortlos nichts
 *    tut, ist schlimmer als eine Fehlermeldung. Der Toast steht hier und nicht
 *    an den vier Aufrufstellen, weil er sonst dreimal vergessen wuerde — andere
 *    Hooks dieses Repos (useRechnungen, useQuittungen, useKunden) melden
 *    ebenso selbst.
 *
 * `select` wird bewusst NICHT memoisiert erwartet: der Wert ist an jeder
 * Aufrufstelle eine Konstante im Modulkoerper oder ein Literal, und ein
 * String-Vergleich in der Dependency-Liste ist billiger als ein `useMemo` an
 * 16 Stellen, das jemand irgendwann vergisst.
 */
export const useCompanyRecord = <T,>(select: string) => {
  const { companyId } = useCompanyContext();
  const [company, setCompany] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Der zuletzt angeforderte Mandant. `useRef`, damit der Vergleich beim
  // Eintreffen der Antwort den JETZIGEN Stand sieht und nicht den, der beim
  // Start der Abfrage in die Closure geschrieben wurde.
  const angefordertFuer = useRef<string | null>(null);

  useEffect(() => {
    angefordertFuer.current = companyId;

    if (!companyId) {
      setCompany(null);
      setError(null);
      setLoading(false);
      return;
    }

    let abgemeldet = false;
    // Beim Wechsel ZUERST leeren. Bliebe der alte Satz stehen, zeigte der
    // Bildschirm fuer die Dauer der Abfrage die Kopfdaten der vorigen Firma
    // unter der Ueberschrift der neuen — und ein Speichern in diesem Fenster
    // schriebe die alte `company_id`.
    setCompany(null);
    setLoading(true);
    setError(null);

    fetchCompanyById<T>({ companyId, select })
      .then((row) => {
        if (abgemeldet) return;
        // Zwischenzeitlich gewechselt? Dann gehoert diese Antwort einem anderen
        // Bildschirm. Sie wird verworfen, nicht angezeigt.
        if (!antwortGehoertNochZumMandanten(companyId, angefordertFuer.current)) return;
        setCompany(row);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (abgemeldet) return;
        if (!antwortGehoertNochZumMandanten(companyId, angefordertFuer.current)) return;
        const fehler = err instanceof Error ? err : new Error(String(err));
        setCompany(null);
        setError(fehler);
        setLoading(false);
        toast.error("Firmendaten konnten nicht geladen werden", {
          description: fehler.message,
        });
      });

    return () => {
      abgemeldet = true;
    };
  }, [companyId, select]);

  return { company, companyId, loading, error };
};
