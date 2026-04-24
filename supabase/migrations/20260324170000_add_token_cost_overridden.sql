-- Add token_cost_overridden flag to preserve admin manual overrides
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS token_cost_overridden BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads.token_cost_overridden IS 
  'If true, admin manually set token_cost — match-lead must NOT overwrite it.';
