-- Add AI Voice Assistant fields to leads table
-- These fields track leads coming from AI voice conversations via Vapi.ai

-- Add new columns for AI voice tracking
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'web_form',
ADD COLUMN IF NOT EXISTS conversation_transcript TEXT,
ADD COLUMN IF NOT EXISTS conversation_duration INTEGER,
ADD COLUMN IF NOT EXISTS lead_score INTEGER,
ADD COLUMN IF NOT EXISTS ai_confidence_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS vapi_call_id VARCHAR(100);

-- First, update any NULL or non-matching source values to 'web_form'
UPDATE public.leads 
SET source = 'web_form' 
WHERE source IS NULL 
   OR source NOT IN ('web_form', 'ai_voice', 'manual', 'import', 'widget', 'api');

-- Add check constraint for source values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_source_check'
  ) THEN
    ALTER TABLE public.leads
    ADD CONSTRAINT leads_source_check 
    CHECK (source IN ('web_form', 'ai_voice', 'manual', 'import', 'widget', 'api'));
  END IF;
END $$;

-- Create index for filtering by source
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);

-- Create index for AI voice leads (for dashboard filtering)
CREATE INDEX IF NOT EXISTS idx_leads_ai_voice ON public.leads(source) WHERE source = 'ai_voice';

-- Add comment for documentation
COMMENT ON COLUMN public.leads.source IS 'Origin of the lead: web_form, ai_voice, manual, import, widget, api';
COMMENT ON COLUMN public.leads.conversation_transcript IS 'Full transcript of AI voice conversation (Vapi.ai)';
COMMENT ON COLUMN public.leads.conversation_duration IS 'Duration of AI voice conversation in seconds';
COMMENT ON COLUMN public.leads.lead_score IS 'Calculated lead quality score (0-100)';
COMMENT ON COLUMN public.leads.ai_confidence_score IS 'AI confidence in extracted data (0-100)';
COMMENT ON COLUMN public.leads.vapi_call_id IS 'Unique call ID from Vapi.ai for reference';
