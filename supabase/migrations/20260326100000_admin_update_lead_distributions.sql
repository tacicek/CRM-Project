-- Allow admins to update lead_distributions (e.g., to sync token_cost after manual edit)
--
-- Ergaenzt 2026-07-28: Ohne dieses DROP scheitert eine SAUBERE Installation hier mit
-- 42710 — die gleichnamige Policy entsteht bereits in 20251220141207 und wird bis
-- hierhin nie entfernt. Die Kette blieb dadurch an dieser Datei stehen.
--
-- Warum die Datei bearbeitet statt eine neue angelegt wird: der Fehler entsteht,
-- WAEHREND diese Datei laeuft — keine spaetere Migration kommt je an die Reihe.
-- In der Produktion existiert keine Migrations-Historientabelle (die Dateien werden
-- von Hand per psql eingespielt), die Kette wird dort also nie erneut abgespielt.
-- Der Wert, den "bestehende Migration nicht bearbeiten" schuetzt — Produktion und
-- Repo duerfen nicht auseinanderlaufen — bleibt damit unberuehrt: die entstehende
-- Policy ist Zeichen fuer Zeichen dieselbe.
DROP POLICY IF EXISTS "Admins can update lead distributions" ON public.lead_distributions;

CREATE POLICY "Admins can update lead distributions"
  ON public.lead_distributions
  FOR UPDATE
  USING (public.is_admin(auth.uid()));
