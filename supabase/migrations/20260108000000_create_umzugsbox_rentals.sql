-- Umzugsbox Rental Tracking System
-- Tracks rental boxes sent to customers and their return status

-- Create enum for box rental status
CREATE TYPE box_rental_status AS ENUM (
  'reserved',      -- Box reserved but not yet delivered
  'delivered',     -- Box delivered to customer
  'in_use',        -- Customer is using the box
  'pickup_requested', -- Customer requested pickup
  'pickup_scheduled', -- Pickup appointment scheduled
  'returned',      -- Box returned
  'lost',          -- Box lost/not returned
  'damaged'        -- Box returned but damaged
);

-- Create enum for box type
CREATE TYPE umzugsbox_type AS ENUM (
  'standard',      -- Standard moving box
  'wardrobe',      -- Wardrobe box (Kleiderbox)
  'book',          -- Book box (Bücherbox)
  'fragile',       -- Fragile items box
  'archive',       -- Archive/document box
  'other'
);

-- Main table for tracking box rentals
CREATE TABLE IF NOT EXISTS umzugsbox_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  offer_id UUID REFERENCES offers(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Customer info (denormalized for convenience)
  customer_first_name TEXT NOT NULL,
  customer_last_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  
  -- Delivery address
  delivery_address TEXT,
  delivery_plz TEXT,
  delivery_city TEXT,
  
  -- Box details
  box_type umzugsbox_type DEFAULT 'standard',
  box_quantity INTEGER NOT NULL DEFAULT 1,
  box_description TEXT, -- e.g., "20x Standard, 5x Kleiderbox"
  
  -- Rental info
  is_rental BOOLEAN DEFAULT true, -- false = sold boxes
  rental_price_per_day DECIMAL(10,2),
  deposit_amount DECIMAL(10,2),
  deposit_paid BOOLEAN DEFAULT false,
  
  -- Dates
  delivery_date DATE NOT NULL,
  expected_return_date DATE, -- When boxes should be returned
  actual_return_date DATE,
  pickup_scheduled_date DATE,
  pickup_scheduled_time TIME,
  
  -- Status tracking
  status box_rental_status DEFAULT 'delivered',
  
  -- Team assignment
  assigned_team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  delivered_by_team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  picked_up_by_team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  
  -- Reminder settings
  reminder_days_before INTEGER DEFAULT 3, -- Days before expected return to send reminder
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  second_reminder_sent BOOLEAN DEFAULT false,
  second_reminder_sent_at TIMESTAMPTZ,
  
  -- Customer notification
  customer_notified BOOLEAN DEFAULT false,
  customer_notified_at TIMESTAMPTZ,
  customer_pickup_request_at TIMESTAMPTZ,
  
  -- Notes
  internal_notes TEXT,
  customer_notes TEXT, -- Notes from customer about pickup
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_umzugsbox_rentals_company ON umzugsbox_rentals(company_id);
CREATE INDEX idx_umzugsbox_rentals_status ON umzugsbox_rentals(status);
CREATE INDEX idx_umzugsbox_rentals_delivery_date ON umzugsbox_rentals(delivery_date);
CREATE INDEX idx_umzugsbox_rentals_expected_return ON umzugsbox_rentals(expected_return_date);
CREATE INDEX idx_umzugsbox_rentals_pickup_scheduled ON umzugsbox_rentals(pickup_scheduled_date);
CREATE INDEX idx_umzugsbox_rentals_assigned ON umzugsbox_rentals(assigned_team_member_id);

-- Enable RLS
ALTER TABLE umzugsbox_rentals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Companies can view their own box rentals"
  ON umzugsbox_rentals FOR SELECT
  USING (company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  ));

CREATE POLICY "Companies can insert their own box rentals"
  ON umzugsbox_rentals FOR INSERT
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  ));

CREATE POLICY "Companies can update their own box rentals"
  ON umzugsbox_rentals FOR UPDATE
  USING (company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  ));

CREATE POLICY "Companies can delete their own box rentals"
  ON umzugsbox_rentals FOR DELETE
  USING (company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  ));

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role full access to box rentals"
  ON umzugsbox_rentals FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_umzugsbox_rentals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER umzugsbox_rentals_updated_at
  BEFORE UPDATE ON umzugsbox_rentals
  FOR EACH ROW
  EXECUTE FUNCTION update_umzugsbox_rentals_updated_at();

-- View for pending pickups (boxes that need to be collected)
CREATE OR REPLACE VIEW pending_box_pickups AS
SELECT 
  ubr.*,
  c.company_name,
  tm.first_name as assigned_first_name,
  tm.last_name as assigned_last_name,
  tm.color_code as assigned_color,
  CASE 
    WHEN ubr.expected_return_date < CURRENT_DATE THEN 'overdue'
    WHEN ubr.expected_return_date = CURRENT_DATE THEN 'today'
    WHEN ubr.expected_return_date = CURRENT_DATE + 1 THEN 'tomorrow'
    WHEN ubr.expected_return_date <= CURRENT_DATE + 3 THEN 'soon'
    ELSE 'upcoming'
  END as urgency
FROM umzugsbox_rentals ubr
JOIN companies c ON ubr.company_id = c.id
LEFT JOIN team_members tm ON ubr.assigned_team_member_id = tm.id
WHERE ubr.status IN ('delivered', 'in_use', 'pickup_requested', 'pickup_scheduled')
  AND ubr.is_rental = true
ORDER BY ubr.expected_return_date ASC NULLS LAST;

-- Function to get box rental statistics for a company
CREATE OR REPLACE FUNCTION get_box_rental_stats(p_company_id UUID)
RETURNS TABLE (
  total_active INTEGER,
  overdue INTEGER,
  pickup_today INTEGER,
  pickup_this_week INTEGER,
  total_boxes_out INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_active,
    COUNT(*) FILTER (WHERE expected_return_date < CURRENT_DATE)::INTEGER as overdue,
    COUNT(*) FILTER (WHERE expected_return_date = CURRENT_DATE OR pickup_scheduled_date = CURRENT_DATE)::INTEGER as pickup_today,
    COUNT(*) FILTER (WHERE expected_return_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)::INTEGER as pickup_this_week,
    COALESCE(SUM(box_quantity), 0)::INTEGER as total_boxes_out
  FROM umzugsbox_rentals
  WHERE company_id = p_company_id
    AND status IN ('delivered', 'in_use', 'pickup_requested', 'pickup_scheduled')
    AND is_rental = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE umzugsbox_rentals IS 'Tracks rental moving boxes sent to customers, their return status, and pickup scheduling';
COMMENT ON COLUMN umzugsbox_rentals.expected_return_date IS 'The date when boxes should be returned/picked up';
COMMENT ON COLUMN umzugsbox_rentals.reminder_days_before IS 'How many days before expected return to send reminder (default 3)';

