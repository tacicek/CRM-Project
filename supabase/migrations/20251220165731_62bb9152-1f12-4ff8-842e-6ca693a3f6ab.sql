-- Leads tablosuna Klaviertransport ve Möbellift için özel alanlar ekle
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS piano_type varchar NULL,
ADD COLUMN IF NOT EXISTS piano_brand varchar NULL,
ADD COLUMN IF NOT EXISTS piano_weight_kg integer NULL,
ADD COLUMN IF NOT EXISTS staircase_type varchar NULL,
ADD COLUMN IF NOT EXISTS staircase_width_cm integer NULL,
ADD COLUMN IF NOT EXISTS staircase_turns integer NULL,
ADD COLUMN IF NOT EXISTS window_access_possible boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS moebellift_floor integer NULL,
ADD COLUMN IF NOT EXISTS moebellift_item_description text NULL,
ADD COLUMN IF NOT EXISTS moebellift_item_dimensions varchar NULL;

-- Yorum ekle
COMMENT ON COLUMN public.leads.piano_type IS 'Piano type: klavier, fluegel, e_piano, keyboard';
COMMENT ON COLUMN public.leads.staircase_type IS 'Staircase type: gerade, kurvig, wendel, keine';
COMMENT ON COLUMN public.leads.staircase_width_cm IS 'Staircase width in centimeters';