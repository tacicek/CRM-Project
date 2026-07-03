-- ============================================================
-- Offerte Redesign — Katman 2a: Adres dondurma (frozen address) + backfill
-- ============================================================
-- ⚠ VERİ KAYBI RİSKİ KAPATMA:
--   offers'ta adres kolonu YOKtu; PDF/UI adresi lead'den (lead_id join) okuyordu.
--   offers_lead_id_fkey ON DELETE SET NULL — bir lead silinince offers.lead_id NULL olur ve
--   gönderilmiş teklif adresini KALICI kaybeder. Bu migration adresi teklife DONDURUR (kopyalar).
--
-- Tasarım:
--   * Additive: offers'a granüler frozen_from_*/frozen_to_* kolonları (leads şemasıyla BİREBİR tip).
--     Mevcut hiçbir kolona/veriye dokunulmaz. RLS/policy değişmez (offers kendi RLS'ine sahip).
--   * Backfill: mevcut tekliflerin adresi leads'ten kopyalanır. SALT OKUMA — leads'e dokunulmaz
--     (UPDATE/DELETE yok). Idempotent (frozen_from_plz IS NULL guard) — tekrar çalışsa ezmez.
--   * Kod tarafı okuma geçişi (offer-öncelik, lead-fallback) AYRI adım (Katman 2b) — bu dosya
--     yalnızca veri kurtarma.
--
-- Tipler leads'ten birebir (canlı DB \d ile doğrulandı):
--   street/house_number/plz/city = varchar (frozen'da text — uyumlu),
--   floor/living_space_m2/distance_to_parking = integer, has_lift/path_obstruction = boolean,
--   rooms = numeric, lift_type/steps_to_entrance = text.
-- ============================================================

-- 1. Frozen adres kolonları (hepsi nullable, additive)
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS frozen_from_street             text,
  ADD COLUMN IF NOT EXISTS frozen_from_house_number       text,
  ADD COLUMN IF NOT EXISTS frozen_from_plz                text,
  ADD COLUMN IF NOT EXISTS frozen_from_city               text,
  ADD COLUMN IF NOT EXISTS frozen_from_floor              integer,
  ADD COLUMN IF NOT EXISTS frozen_from_has_lift           boolean,
  ADD COLUMN IF NOT EXISTS frozen_from_rooms              numeric,
  ADD COLUMN IF NOT EXISTS frozen_from_living_space_m2    integer,
  ADD COLUMN IF NOT EXISTS frozen_from_lift_type          text,
  ADD COLUMN IF NOT EXISTS frozen_from_steps_to_entrance  text,
  ADD COLUMN IF NOT EXISTS frozen_from_distance_to_parking integer,
  ADD COLUMN IF NOT EXISTS frozen_from_path_obstruction   boolean,
  ADD COLUMN IF NOT EXISTS frozen_to_street               text,
  ADD COLUMN IF NOT EXISTS frozen_to_house_number         text,
  ADD COLUMN IF NOT EXISTS frozen_to_plz                  text,
  ADD COLUMN IF NOT EXISTS frozen_to_city                 text,
  ADD COLUMN IF NOT EXISTS frozen_to_floor                integer,
  ADD COLUMN IF NOT EXISTS frozen_to_has_lift             boolean,
  ADD COLUMN IF NOT EXISTS frozen_to_rooms                numeric,
  ADD COLUMN IF NOT EXISTS frozen_to_living_space_m2      integer,
  ADD COLUMN IF NOT EXISTS frozen_to_lift_type            text,
  ADD COLUMN IF NOT EXISTS frozen_to_steps_to_entrance    text,
  ADD COLUMN IF NOT EXISTS frozen_to_distance_to_parking  integer,
  ADD COLUMN IF NOT EXISTS frozen_to_path_obstruction     boolean,
  ADD COLUMN IF NOT EXISTS frozen_address_at              timestamptz;

COMMENT ON COLUMN public.offers.frozen_address_at IS
  'Adresin teklife dondurulduğu an. Backfill veya create-time ayrımı için. NULL = henüz dondurulmadı.';

-- 2. Backfill: mevcut tekliflerin adresini leads''ten kopyala (idempotent, salt okuma kaynak)
UPDATE public.offers o SET
  frozen_from_street              = l.from_street,
  frozen_from_house_number        = l.from_house_number,
  frozen_from_plz                 = l.from_plz,
  frozen_from_city                = l.from_city,
  frozen_from_floor               = l.from_floor,
  frozen_from_has_lift            = l.from_has_lift,
  frozen_from_rooms               = l.from_rooms,
  frozen_from_living_space_m2     = l.from_living_space_m2,
  frozen_from_lift_type           = l.from_lift_type,
  frozen_from_steps_to_entrance   = l.from_steps_to_entrance,
  frozen_from_distance_to_parking = l.from_distance_to_parking,
  frozen_from_path_obstruction    = l.from_path_obstruction,
  frozen_to_street                = l.to_street,
  frozen_to_house_number          = l.to_house_number,
  frozen_to_plz                   = l.to_plz,
  frozen_to_city                  = l.to_city,
  frozen_to_floor                 = l.to_floor,
  frozen_to_has_lift              = l.to_has_lift,
  frozen_to_rooms                 = l.to_rooms,
  frozen_to_living_space_m2       = l.to_living_space_m2,
  frozen_to_lift_type             = l.to_lift_type,
  frozen_to_steps_to_entrance     = l.to_steps_to_entrance,
  frozen_to_distance_to_parking   = l.to_distance_to_parking,
  frozen_to_path_obstruction      = l.to_path_obstruction,
  frozen_address_at               = COALESCE(o.frozen_address_at, now())
FROM public.leads l
WHERE l.id = o.lead_id
  AND o.lead_id IS NOT NULL
  AND o.frozen_from_plz IS NULL;  -- idempotent guard: zaten donmuşsa tekrar yazma
