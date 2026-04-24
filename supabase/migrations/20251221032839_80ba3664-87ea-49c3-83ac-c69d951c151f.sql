-- Appointment Types Enum
CREATE TYPE appointment_type AS ENUM (
  'besichtigung',
  'service',
  'follow_up',
  'meeting',
  'blocked'
);

CREATE TYPE appointment_status AS ENUM (
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'rescheduled',
  'no_show'
);

-- Team Members (Mitarbeiter)
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID, -- Optional: if they have login
  
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  role TEXT, -- 'driver', 'helper', 'cleaner', 'manager'
  skills TEXT[],
  
  is_active BOOLEAN DEFAULT true,
  color_code TEXT DEFAULT '#3B82F6',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main Appointments Table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Related entities
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  offer_id UUID REFERENCES offers(id) ON DELETE SET NULL,
  
  -- Appointment details
  appointment_type appointment_type NOT NULL,
  status appointment_status DEFAULT 'pending',
  
  -- Date & Time
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER,
  all_day BOOLEAN DEFAULT false,
  
  -- Location
  location_address TEXT,
  location_plz TEXT,
  location_city TEXT,
  location_notes TEXT,
  
  -- Customer info (denormalized for convenience)
  customer_first_name TEXT,
  customer_last_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  
  -- Details
  title TEXT NOT NULL,
  description TEXT,
  internal_notes TEXT,
  
  -- Team assignment
  assigned_team_member_ids UUID[],
  required_vehicles TEXT[],
  required_equipment TEXT[],
  
  -- Reminders
  reminder_sent_firma BOOLEAN DEFAULT false,
  reminder_sent_customer BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  
  -- Confirmation
  confirmed_by_firma BOOLEAN DEFAULT false,
  confirmed_by_customer BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  
  -- Completion
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  
  -- Cancellation
  cancelled_by TEXT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Rescheduling
  rescheduled_from_id UUID,
  rescheduled_to_id UUID,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add self-referencing foreign keys after table creation
ALTER TABLE appointments 
  ADD CONSTRAINT fk_rescheduled_from FOREIGN KEY (rescheduled_from_id) REFERENCES appointments(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_rescheduled_to FOREIGN KEY (rescheduled_to_id) REFERENCES appointments(id) ON DELETE SET NULL;

-- Team Availability
CREATE TABLE team_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  
  -- Recurring availability (weekly)
  day_of_week INTEGER, -- 0=Sunday, 1=Monday, etc.
  start_time TIME,
  end_time TIME,
  
  -- Or specific date
  specific_date DATE,
  is_available BOOLEAN DEFAULT true,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicles & Equipment
CREATE TABLE firma_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  resource_type TEXT NOT NULL, -- 'vehicle', 'equipment'
  name TEXT NOT NULL,
  description TEXT,
  
  -- For vehicles
  license_plate TEXT,
  capacity_m3 DECIMAL(10,2),
  
  -- For equipment
  quantity INTEGER DEFAULT 1,
  
  is_available BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointment Reminders Log
CREATE TABLE appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE NOT NULL,
  
  recipient_type TEXT NOT NULL, -- 'firma', 'customer', 'team_member'
  recipient_id UUID,
  recipient_email TEXT,
  recipient_phone TEXT,
  
  reminder_type TEXT NOT NULL, -- 'email', 'sms', 'push'
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'delivered'
  
  error_message TEXT
);

-- Appointment History (for audit trail)
CREATE TABLE appointment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE NOT NULL,
  
  changed_by UUID,
  change_type TEXT NOT NULL, -- 'created', 'updated', 'confirmed', 'cancelled', 'completed'
  old_data JSONB,
  new_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_appointments_company ON appointments(company_id);
CREATE INDEX idx_appointments_lead ON appointments(lead_id);
CREATE INDEX idx_appointments_offer ON appointments(offer_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_type ON appointments(appointment_type);
CREATE INDEX idx_appointments_datetime ON appointments(appointment_date, start_time);
CREATE INDEX idx_appointments_company_date_status ON appointments(company_id, appointment_date, status);
CREATE INDEX idx_team_members_company ON team_members(company_id);
CREATE INDEX idx_team_availability_member ON team_availability(team_member_id);
CREATE INDEX idx_resources_company ON firma_resources(company_id);
CREATE INDEX idx_reminders_appointment ON appointment_reminders(appointment_id);
CREATE INDEX idx_history_appointment ON appointment_history(appointment_id);

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE firma_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_members
CREATE POLICY "Admins can manage all team members"
ON team_members FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Companies can manage their team members"
ON team_members FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = team_members.company_id
  AND companies.user_id = auth.uid()
));

-- RLS Policies for appointments
CREATE POLICY "Admins can manage all appointments"
ON appointments FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Companies can manage their appointments"
ON appointments FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = appointments.company_id
  AND companies.user_id = auth.uid()
));

-- RLS Policies for team_availability
CREATE POLICY "Admins can manage all availability"
ON team_availability FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Companies can manage their team availability"
ON team_availability FOR ALL
USING (EXISTS (
  SELECT 1 FROM team_members tm
  JOIN companies c ON c.id = tm.company_id
  WHERE tm.id = team_availability.team_member_id
  AND c.user_id = auth.uid()
));

-- RLS Policies for firma_resources
CREATE POLICY "Admins can manage all resources"
ON firma_resources FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Companies can manage their resources"
ON firma_resources FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = firma_resources.company_id
  AND companies.user_id = auth.uid()
));

-- RLS Policies for appointment_reminders
CREATE POLICY "Admins can view all reminders"
ON appointment_reminders FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Companies can view their appointment reminders"
ON appointment_reminders FOR SELECT
USING (EXISTS (
  SELECT 1 FROM appointments a
  JOIN companies c ON c.id = a.company_id
  WHERE a.id = appointment_reminders.appointment_id
  AND c.user_id = auth.uid()
));

-- RLS Policies for appointment_history
CREATE POLICY "Admins can view all history"
ON appointment_history FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Companies can view their appointment history"
ON appointment_history FOR SELECT
USING (EXISTS (
  SELECT 1 FROM appointments a
  JOIN companies c ON c.id = a.company_id
  WHERE a.id = appointment_history.appointment_id
  AND c.user_id = auth.uid()
));

-- Function to auto-calculate duration
CREATE OR REPLACE FUNCTION calculate_appointment_duration()
RETURNS TRIGGER AS $$
BEGIN
  NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_calculate_duration
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION calculate_appointment_duration();

-- Function to log appointment changes
CREATE OR REPLACE FUNCTION log_appointment_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO appointment_history (appointment_id, change_type, new_data, changed_by)
    VALUES (NEW.id, 'created', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO appointment_history (appointment_id, change_type, old_data, new_data, changed_by)
    VALUES (NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_log_appointment_changes
  AFTER INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION log_appointment_changes();