-- ============================================================
-- leads.from_rooms: integer → numeric (İsviçre oda sayısı kesirli, "3.5 Zimmer").
-- Hata: ManualImport from_rooms'u parseFloat ile (3.5) gönderiyordu ama kolon integer
--   → "invalid input syntax for type integer: 3.5". leads.to_rooms zaten numeric.
-- Engel: offer_details VIEW'ı l.from_rooms'u seçiyor → kolon tipi değiştirilemiyor.
-- Çözüm: view drop → ALTER → view'ı birebir recreate → grant'ler geri ver (tek transaction).
-- View app'te kullanılmıyor (fork kalıntısı); birebir yeniden kuruluyor.
-- offer_details.from_rooms otomatik numeric'e döner (base leads.from_rooms'tan türüyor).
-- ============================================================

DROP VIEW IF EXISTS public.offer_details;

ALTER TABLE leads
  ALTER COLUMN from_rooms TYPE numeric USING from_rooms::numeric;

CREATE VIEW public.offer_details AS
 SELECT o.id,
    o.company_id,
    o.lead_id,
    o.lead_distribution_id,
    o.customer_first_name,
    o.customer_last_name,
    o.customer_email,
    o.customer_phone,
    o.title,
    o.description,
    o.service_date,
    o.valid_until,
    o.subtotal,
    o.vat_rate,
    o.vat_amount,
    o.total,
    o.status,
    o.sent_at,
    o.viewed_at,
    o.accepted_at,
    o.rejected_at,
    o.created_at,
    o.updated_at,
    o.access_token,
    o.customer_response_note,
    o.checklist_url,
    o.leistungsuebersicht_url,
    o.agb_accepted_at,
    o.agb_version,
    o.agb_ip_address,
    o.offer_number,
    o.company_reference,
    o.customer_salutation,
    o.service_start_time,
    o.service_end_time,
    o.secondary_service_date,
    o.secondary_service_type,
    o.service_details,
    o.resources,
    o.highlighted_items,
    o.payment_method,
    o.payment_due_days,
    o.internal_notes,
    o.assigned_team_member_id,
    c.company_name,
    c.street AS company_street,
    c.house_number AS company_house_number,
    c.plz AS company_plz,
    c.city AS company_city,
    c.phone AS company_phone,
    c.email AS company_email,
    c.mwst_number AS company_mwst_number,
    c.logo_url AS company_logo_url,
    l.service_type,
    l.from_street,
    l.from_house_number,
    l.from_plz,
    l.from_city,
    l.from_floor,
    l.from_has_lift,
    l.from_rooms,
    l.from_living_space_m2,
    l.to_street,
    l.to_house_number,
    l.to_plz,
    l.to_city,
    l.to_floor,
    l.to_has_lift,
    l.preferred_date,
    l.description AS lead_description,
    tm.first_name AS reference_first_name,
    tm.last_name AS reference_last_name,
    tm.email AS reference_email,
    tm.phone AS reference_phone
   FROM offers o
     LEFT JOIN companies c ON o.company_id = c.id
     LEFT JOIN leads l ON o.lead_id = l.id
     LEFT JOIN team_members tm ON o.assigned_team_member_id = tm.id;

GRANT ALL ON public.offer_details TO anon, authenticated, service_role;
