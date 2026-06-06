-- =============================================================================
-- OfferteBearbeiten: Orphan riski — delete-then-insert atomic transaction RPC
-- Sorun: OfferteBearbeiten.tsx önce tüm offer_items'ı siler, sonra insert eder.
-- Ağ hatası veya RLS hatası insert'i engellerse offer itemsız kalır.
-- Çözüm: Tek bir Postgres transaction içinde delete + insert yapan RPC.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.replace_offer_items(
  p_offer_id uuid,
  p_items    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Önce yetkiyi doğrula: çağıran kullanıcı bu offer'ın company'sine üye mi?
  -- (SECURITY DEFINER olduğu için RLS bypass edilir; manuel kontrol zorunlu)
  IF NOT EXISTS (
    SELECT 1
    FROM public.offers o
    JOIN public.companies c ON c.id = o.company_id
    WHERE o.id = p_offer_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.company_members cm
          WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Offerte'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Kabul/red teklifler üzerinde item değişikliği yapılamaz
  IF EXISTS (
    SELECT 1 FROM public.offers
    WHERE id = p_offer_id AND status IN ('accepted', 'rejected')
  ) THEN
    RAISE EXCEPTION 'Offerte ist bereits abgeschlossen und kann nicht bearbeitet werden'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Atomic: bu iki işlem aynı transaction içinde çalışır
  -- Insert başarısız olursa delete de geri alınır
  DELETE FROM public.offer_items WHERE offer_id = p_offer_id;

  INSERT INTO public.offer_items (
    offer_id,
    position,
    description,
    quantity,
    unit,
    unit_price,
    price_type,
    is_highlighted,
    is_optional,
    time_estimate
  )
  SELECT
    p_offer_id,
    (item ->> 'position')::integer,
    item ->> 'description',
    COALESCE((item ->> 'quantity')::numeric, 1),
    item ->> 'unit',
    COALESCE((item ->> 'unit_price')::numeric, 0),
    item ->> 'price_type',
    COALESCE((item ->> 'is_highlighted')::boolean, false),
    COALESCE((item ->> 'is_optional')::boolean, false),
    CASE
      WHEN item -> 'time_estimate' IS NOT NULL AND item ->> 'time_estimate' != 'null'
      THEN (item -> 'time_estimate')::jsonb
      ELSE NULL
    END
  FROM jsonb_array_elements(p_items) AS item;

END;
$$;

COMMENT ON FUNCTION public.replace_offer_items(uuid, jsonb) IS
  'offer_items tablosunu atomik olarak yeniler. '
  'Delete + insert tek transaction içinde — insert başarısız olursa delete de geri alınır. '
  'Çağıran kullanıcı offer company_id''sine üye olmalı.';

-- Yalnızca authenticated kullanıcılar çağırabilir (anon değil)
REVOKE EXECUTE ON FUNCTION public.replace_offer_items(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_offer_items(uuid, jsonb) TO authenticated;
