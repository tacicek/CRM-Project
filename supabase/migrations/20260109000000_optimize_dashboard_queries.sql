-- Dashboard Query Optimization
-- Add composite indexes for faster dashboard queries

-- 1. lead_distributions: company_id + status (for pending/accepted counts)
CREATE INDEX IF NOT EXISTS idx_lead_distributions_company_status 
ON public.lead_distributions(company_id, status);

-- 2. lead_distributions: company_id + sent_at (for recent leads)
CREATE INDEX IF NOT EXISTS idx_lead_distributions_company_sent_at 
ON public.lead_distributions(company_id, sent_at DESC);

-- 3. notifications: company_id + type (for besichtigung requests)
CREATE INDEX IF NOT EXISTS idx_notifications_company_type 
ON public.notifications(company_id, type);

-- 4. notifications: company_id + type + created_at (for ordered queries)
CREATE INDEX IF NOT EXISTS idx_notifications_company_type_created 
ON public.notifications(company_id, type, created_at DESC);

-- 5. token_transactions: company_id + type (for total spent)
CREATE INDEX IF NOT EXISTS idx_token_transactions_company_type 
ON public.token_transactions(company_id, type);

-- 6. offers: company_id + status + rejected_at (for rejected offers)
CREATE INDEX IF NOT EXISTS idx_offers_company_status_rejected_at 
ON public.offers(company_id, status, rejected_at DESC NULLS LAST);

-- 7. appointments: company_id + appointment_type + status (for filtering)
CREATE INDEX IF NOT EXISTS idx_appointments_company_type_status 
ON public.appointments(company_id, appointment_type, status);

-- 8. umzugsbox_rentals: company_id + archived_at (for box stats)
CREATE INDEX IF NOT EXISTS idx_umzugsbox_rentals_company_archived 
ON public.umzugsbox_rentals(company_id, archived_at) 
WHERE archived_at IS NULL;

-- 9. umzugsbox_rentals: company_id + status (for active/overdue counts)
CREATE INDEX IF NOT EXISTS idx_umzugsbox_rentals_company_status 
ON public.umzugsbox_rentals(company_id, status);

-- Comments
COMMENT ON INDEX idx_lead_distributions_company_status IS 'Optimizes dashboard pending/accepted lead counts';
COMMENT ON INDEX idx_lead_distributions_company_sent_at IS 'Optimizes dashboard recent leads query';
COMMENT ON INDEX idx_notifications_company_type IS 'Optimizes dashboard besichtigung requests query';
COMMENT ON INDEX idx_token_transactions_company_type IS 'Optimizes dashboard total spent calculation';
COMMENT ON INDEX idx_offers_company_status_rejected_at IS 'Optimizes dashboard rejected offers query';

