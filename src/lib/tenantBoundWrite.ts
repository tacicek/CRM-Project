/**
 * Ein verzögerter Schreibvorgang trägt seinen Mandanten selbst.
 *
 * DER BEFUND, DER DIESE DATEI ERZWUNGEN HAT
 *
 * `Einstellungen` speicherte den unfertigen Formularentwurf mit 600 ms
 * Verzögerung. Der Schlüssel kam aus `activeCompanyId` (dem Kontext), die Werte
 * aus `company` (der geladenen Zeile). Beim Mandantenwechsel springt der Kontext
 * SOFORT auf B, während die Zeile bis zum Ende der Abfrage noch A ist. In genau
 * diesem Fenster schrieb der Timer A-Werte unter den Schlüssel von B; das Laden
 * legte sie über die frischen B-Werte, und `.eq("id", company.id)` schrieb sie
 * in die B-Zeile. Ohne Fehler, ohne Warnung.
 *
 * Ein statisches Verbot von `fetchSingleCompanyForUser` und `getCachedCompany`
 * fängt das NICHT: hier rät niemand eine Firma. Zwei richtige Werte laufen
 * auseinander, weil sie zu verschiedenen Zeitpunkten entstanden sind.
 *
 * DIE ANTWORT
 *
 * Nutzlast und Mandant reisen zusammen. `schedule()` nimmt ein Paket, das seinen
 * Mandanten TRÄGT; der Schreibvorgang bekommt genau diesen — nicht den, der beim
 * Auslösen des Timers gerade aktuell ist. Der Fehler ist damit nicht behoben,
 * sondern nicht mehr formulierbar.
 *
 * Die Invariante:
 *
 *     Jeder verzögerte Aufruf, jede Anfrage, jede Antwort, jeder Cache-Eintrag,
 *     jeder Entwurfsschlüssel und jede Mutation trägt EINE Mandantenidentität
 *     von Anfang bis Ende.
 */

/** Eine Nutzlast, die ihren Mandanten mitbringt. */
export interface TenantBound<T> {
  readonly tenantId: string;
  readonly payload: T;
}

export const tenantBound = <T>(tenantId: string, payload: T): TenantBound<T> => ({
  tenantId,
  payload,
});

export interface TenantScopedDebounce<T> {
  /**
   * Plant einen Schreibvorgang. Ein bereits geplanter wird ersetzt — auch der
   * eines anderen Mandanten: wer die Firma wechselt, will den halbfertigen
   * Entwurf der vorigen nicht nachträglich abgelegt bekommen.
   */
  schedule: (paket: TenantBound<T>) => void;
  /** Verwirft einen geplanten Schreibvorgang ersatzlos. */
  cancel: () => void;
  /** Nur für Tests und Abmeldung: gibt es gerade einen geplanten? */
  readonly pending: boolean;
}

export const createTenantScopedDebounce = <T>(opts: {
  delayMs: number;
  /** Bekommt Mandant und Nutzlast aus DEMSELBEN Paket. */
  write: (tenantId: string, payload: T) => void;
}): TenantScopedDebounce<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    schedule(paket) {
      cancel();
      // Das Paket wird in die Closure genommen, nicht ein Verweis auf „den
      // aktuellen Mandanten". Genau hier lag der Fehler.
      timer = setTimeout(() => {
        timer = null;
        opts.write(paket.tenantId, paket.payload);
      }, opts.delayMs);
    },
    cancel,
    get pending() {
      return timer !== null;
    },
  };
};

/**
 * Nutzlast und Ziel einer Mutation müssen denselben Mandanten tragen.
 *
 * `.eq("id", company.id)` mit einer Nutzlast, deren `company_id` woanders
 * herkommt, ist eine mandantenübergreifende Schreiboperation mit zwei
 * plausibel aussehenden Hälften. Diese Prüfung macht daraus einen Fehler.
 */
export class TenantMismatchError extends Error {
  constructor(
    readonly payloadTenant: string | null | undefined,
    readonly targetTenant: string | null | undefined,
  ) {
    super(
      `Mandantenbruch: die Nutzlast gehoert zu ${payloadTenant ?? "(keiner Firma)"}, ` +
        `geschrieben wuerde nach ${targetTenant ?? "(keiner Firma)"}.`,
    );
    this.name = "TenantMismatchError";
  }
}

export const assertSameTenant = (
  payloadTenant: string | null | undefined,
  targetTenant: string | null | undefined,
): string => {
  if (!payloadTenant || !targetTenant || payloadTenant !== targetTenant) {
    throw new TenantMismatchError(payloadTenant, targetTenant);
  }
  return payloadTenant;
};
