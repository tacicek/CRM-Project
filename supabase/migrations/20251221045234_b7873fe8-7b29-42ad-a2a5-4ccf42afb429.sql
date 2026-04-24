-- Create notifications table for in-app notifications
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    type VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    body TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Companies can view their notifications"
ON public.notifications
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.companies
        WHERE companies.id = notifications.company_id
        AND companies.user_id = auth.uid()
    )
);

CREATE POLICY "Companies can update their notifications"
ON public.notifications
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.companies
        WHERE companies.id = notifications.company_id
        AND companies.user_id = auth.uid()
    )
);

CREATE POLICY "Companies can delete their notifications"
ON public.notifications
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.companies
        WHERE companies.id = notifications.company_id
        AND companies.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage all notifications"
ON public.notifications
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to notify on offer response
CREATE OR REPLACE FUNCTION public.notify_offer_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only trigger when status changes to accepted or rejected
    IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status IN ('accepted', 'rejected')) THEN
        INSERT INTO public.notifications (company_id, type, title, body, metadata)
        VALUES (
            NEW.company_id,
            'offer_response',
            CASE 
                WHEN NEW.status = 'accepted' THEN 'Offerte angenommen!'
                ELSE 'Offerte abgelehnt'
            END,
            CASE 
                WHEN NEW.status = 'accepted' THEN NEW.customer_first_name || ' ' || NEW.customer_last_name || ' hat Ihre Offerte angenommen.'
                ELSE NEW.customer_first_name || ' ' || NEW.customer_last_name || ' hat Ihre Offerte abgelehnt.'
            END,
            jsonb_build_object(
                'offer_id', NEW.id,
                'offer_title', NEW.title,
                'customer_name', NEW.customer_first_name || ' ' || NEW.customer_last_name,
                'status', NEW.status,
                'total', NEW.total
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger for offer status changes
CREATE TRIGGER on_offer_response
    AFTER UPDATE ON public.offers
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_offer_response();