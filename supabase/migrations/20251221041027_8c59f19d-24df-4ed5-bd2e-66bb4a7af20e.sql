-- Add Twilio configuration fields to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS twilio_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS twilio_account_sid text,
ADD COLUMN IF NOT EXISTS twilio_auth_token text,
ADD COLUMN IF NOT EXISTS twilio_phone_number text,
ADD COLUMN IF NOT EXISTS sms_reminders_enabled boolean DEFAULT false;