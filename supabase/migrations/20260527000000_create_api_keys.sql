-- API Keys tablosu: firmanın kendi API anahtarlarını saklar
-- edge function'lar bu tablodan okur, Deno.env fallback olarak kullanılır

CREATE TABLE IF NOT EXISTS public.api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key_name    text NOT NULL,
  key_value   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, key_name)
);

-- Otomatik updated_at
CREATE OR REPLACE FUNCTION public.set_api_keys_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_api_keys_updated_at();

-- RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Şirket sahibi kendi kayıtlarını okuyabilir (değer maskeli döner — UI katmanı maskeler)
CREATE POLICY "company_owner_select" ON public.api_keys
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- Şirket sahibi ekleyebilir
CREATE POLICY "company_owner_insert" ON public.api_keys
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- Şirket sahibi güncelleyebilir
CREATE POLICY "company_owner_update" ON public.api_keys
  FOR UPDATE USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- Şirket sahibi silebilir
CREATE POLICY "company_owner_delete" ON public.api_keys
  FOR DELETE USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- Index
CREATE INDEX idx_api_keys_company_name ON public.api_keys (company_id, key_name);
