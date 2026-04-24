-- ⚠️ DİKKAT: Bu script TÜM test verilerini siler!
-- Supabase Dashboard > SQL Editor'da çalıştırın

-- 1. Önce bağımlı tabloları temizle (Foreign Key sırası önemli)

-- Offer responses
DELETE FROM offer_responses;

-- Offers (Offerten)
DELETE FROM offers;

-- Appointments/Besichtigungen
DELETE FROM appointments;

-- Lead distributions (Firmalara dağıtılan leadler)
DELETE FROM lead_distributions;

-- Lead related notifications
DELETE FROM notifications WHERE lead_id IS NOT NULL;

-- 2. Ana tabloyu temizle
-- Leads (Anfragen)
DELETE FROM leads;

-- 3. Sonuçları kontrol et
SELECT 
  (SELECT COUNT(*) FROM leads) as leads_count,
  (SELECT COUNT(*) FROM lead_distributions) as distributions_count,
  (SELECT COUNT(*) FROM offers) as offers_count,
  (SELECT COUNT(*) FROM appointments) as appointments_count,
  (SELECT COUNT(*) FROM notifications WHERE lead_id IS NOT NULL) as lead_notifications_count;

