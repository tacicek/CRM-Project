-- Fix leads RLS policy for public form submissions
-- This migration ensures anonymous users can submit leads via the public form

-- First, enable RLS if not already enabled
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Drop all existing insert policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;
DROP POLICY IF EXISTS "Public can submit leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public lead submissions" ON public.leads;
DROP POLICY IF EXISTS "Enable insert for anonymous users" ON public.leads;
DROP POLICY IF EXISTS "anon_insert_leads" ON public.leads;
DROP POLICY IF EXISTS "Public lead submission" ON public.leads;

-- Create a simple policy that allows ANYONE to insert leads
-- This is needed because the public inquiry forms don't require authentication
CREATE POLICY "Public lead submission" ON public.leads 
FOR INSERT 
WITH CHECK (true);
