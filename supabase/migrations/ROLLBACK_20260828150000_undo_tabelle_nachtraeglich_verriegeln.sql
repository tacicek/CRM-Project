-- Ruecknahme zu 20260828150000.
--
-- Stellt den Zustand her, in dem die Undo-Tabelle in der Produktion lag:
-- RLS aus, anon und authenticated mit vollen Tabellenrechten. Das ist der
-- UNSICHERE Zustand. Diese Datei existiert nur, damit die Vorwaertsrichtung
-- umkehrbar ist — sie ist kein empfohlener Zielzustand.

ALTER TABLE public.undo_20260828100000 DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.undo_20260828100000 TO anon;
GRANT ALL ON public.undo_20260828100000 TO authenticated;
