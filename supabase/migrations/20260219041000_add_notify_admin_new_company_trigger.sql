-- Ensure new company registrations notify admins automatically.
-- This trigger calls public.notify_admin_new_company() after each insert.

DROP TRIGGER IF EXISTS trigger_notify_admin_new_company ON public.companies;

CREATE TRIGGER trigger_notify_admin_new_company
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_company();
