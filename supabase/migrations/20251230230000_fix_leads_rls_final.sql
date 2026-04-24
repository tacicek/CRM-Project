-- Final fix for leads table RLS to allow public submissions

-- Disable RLS temporarily to reset
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on leads
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'leads' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.leads', pol.policyname);
    END LOOP;
END $$;

-- 1. INSERT: Allow anyone to insert leads (critical for public forms)
CREATE POLICY "leads_insert_public" ON public.leads
FOR INSERT
TO public
WITH CHECK (true);

-- 2. SELECT: Allow authenticated users to view leads (simplified)
CREATE POLICY "leads_select_authenticated" ON public.leads
FOR SELECT
TO authenticated
USING (true);

-- 3. UPDATE: Allow authenticated users to update (will be controlled by app logic)
CREATE POLICY "leads_update_authenticated" ON public.leads
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.leads TO authenticated;
GRANT INSERT ON public.leads TO anon;
