-- Allow admins to view all companies
CREATE POLICY "Admins can view all companies" 
ON public.companies 
FOR SELECT 
USING (public.is_admin(auth.uid()));

-- Allow admins to insert companies
CREATE POLICY "Admins can insert companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (public.is_admin(auth.uid()));

-- Allow admins to update all companies
CREATE POLICY "Admins can update all companies" 
ON public.companies 
FOR UPDATE 
USING (public.is_admin(auth.uid()));

-- Allow admins to delete companies
CREATE POLICY "Admins can delete companies" 
ON public.companies 
FOR DELETE 
USING (public.is_admin(auth.uid()));