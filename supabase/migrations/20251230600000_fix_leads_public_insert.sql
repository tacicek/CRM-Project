-- Fix leads table RLS to allow public submissions (Anonymous users)
-- This migration ensures that unauthenticated users can submit lead forms

-- First, check if policy exists and drop it
DO $$
BEGIN
    -- Drop existing public insert policies
    DROP POLICY IF EXISTS "leads_insert_public" ON public.leads;
    DROP POLICY IF EXISTS "Public lead submission" ON public.leads;
    DROP POLICY IF EXISTS "Public can submit leads" ON public.leads;
    DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;
    DROP POLICY IF EXISTS "Allow public lead submissions" ON public.leads;
END $$;

-- Create policy that allows ANYONE (including anon) to insert leads
CREATE POLICY "leads_public_insert_v2" ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Grant INSERT permission to anonymous users
GRANT INSERT ON public.leads TO anon;

-- Also grant usage on sequence if leads has auto-increment id
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

