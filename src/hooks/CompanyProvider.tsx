import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchCompaniesForUser } from "@/lib/fetchCompaniesForUser";
import { CompanyContext, type CompanyData } from "@/hooks/useCompanyContext";
import {
  cacheActiveCompany,
  getActiveCompanyId,
  setActiveCompanyId,
} from "@/lib/tenantSession";

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const CompanyProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [memberships, setMemberships] = useState<Map<string, string>>(new Map());
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(
    getActiveCompanyId()
  );
  const [loading, setLoading] = useState(true);

  // Semantische Abhängigkeit ist die USER-ID, nicht die Objekt-Referenz: onAuthStateChange
  // liefert bei Tab-Fokus (TOKEN_REFRESHED) neue User-Objekte für denselben User — ein
  // [user]-Dep würde dann refetchen, loading=true setzen und via FirmaLayout die offene
  // Seite unmounten (Formular-Reset).
  const userId = user?.id ?? null;

  const fetchCompanies = useCallback(async () => {
    if (!userId) {
      setCompanies([]);
      setMemberships(new Map());
      // Solange Auth noch auflöst, NICHT „fertig" melden — sonst blitzt „Keine Firma gefunden"
      // auf, sobald der User gleich gesetzt wird und der Firmen-Fetch noch läuft. Erst wenn Auth
      // definitiv ohne User settled ist (logged out), ist loading=false → FirmaLayout → /auth.
      setLoading(authLoading);
      return;
    }

    // Authentifiziert → wir laden (erneut) Firmen. Ohne dieses setLoading(true) bliebe loading
    // aus dem no-user-Lauf false und die ~1s DB-Abfrage würde als „keine Firma" fehlinterpretiert.
    setLoading(true);
    try {
      // Gemeinsamer Helfer statt einer zweiten Kopie derselben Abfrage: bis
      // 2026-07-28 stand die Mitgliedschaftsabfrage hier inline UND in
      // fetchCompaniesForUser — zwei Orte, an denen "welche Firma ist meine"
      // beantwortet wurde.
      const { companies: fetchedCompanies, memberships: rows } =
        await fetchCompaniesForUser<CompanyData>({
          userId,
          select: "id, company_name, logo_url, is_verified, default_language",
        });

      const roleMap = new Map<string, string>();
      rows.forEach((r) => roleMap.set(r.company_id, r.role));

      setCompanies(fetchedCompanies);
      setMemberships(roleMap);

      // Auto-Auswahl: zuletzt gewaehlte Firma, sonst eine FREIGESCHALTETE.
      //
      // Bis 2026-08-28 stand hier `fetchedCompanies[0]`. `fetchCompaniesForUser`
      // sortiert nicht, die erste Zeile ist also beliebig — und `FirmaLayout`
      // zeigt fuer eine Firma mit `is_verified === false` eine Sackgasse mit nur
      // einem Abmelden-Knopf. Wer in einer freigeschalteten Firma A und einer
      // noch nicht freigeschalteten B Mitglied ist, konnte damit ausgesperrt
      // werden, obwohl A bereitsteht.
      //
      // Die manuelle Auswahl bleibt unberuehrt: wer B ausdruecklich waehlt,
      // bekommt B (und den Hinweis). Geraten wird nur, wenn niemand gewaehlt hat.
      const cachedId = getActiveCompanyId();
      const cached = fetchedCompanies.find((c) => c.id === cachedId);
      const auswahl =
        cached ??
        fetchedCompanies.find((c) => c.is_verified === true) ??
        fetchedCompanies[0];
      if (auswahl) {
        setActiveCompanyIdState(auswahl.id);
        setActiveCompanyId(auswahl.id);
      }
    } catch (err) {
      console.error("[CompanyProvider] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, authLoading]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Preload all companies into sessionStorage cache so child hooks get instant data
  useEffect(() => {
    const active = companies.find((c) => c.id === activeCompanyId) ?? null;
    if (active) {
      cacheActiveCompany(active);
    }
  }, [companies, activeCompanyId]);

  const switchCompany = useCallback(
    (companyId: string) => {
      if (companies.some((c) => c.id === companyId)) {
        setActiveCompanyIdState(companyId);
        setActiveCompanyId(companyId);
      }
    },
    [companies]
  );

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null;
  const role = activeCompany ? (memberships.get(activeCompany.id) ?? null) : null;

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompany,
        companyId: activeCompanyId,
        role,
        loading,
        switchCompany,
        refresh: fetchCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};
