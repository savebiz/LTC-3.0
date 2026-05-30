-- ========================================================
-- C3TC EMAIL NOTIFICATION COLUMNS AND TRIGGERS SETUP
-- Run this script in the Supabase SQL Editor
-- ========================================================

-- 1. ADD COLUMNS FOR NOTIFICATION STATES AND ACTIONS LOGGING
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS cleared_by TEXT,
ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP WITH TIME ZONE;

-- 2. ENABLE OUTGOING HTTP REQUESTS (Supabase Webhooks)
-- Normally, Supabase enables Database Webhooks through its dashboard UI.
-- If you want to configure it via code/trigger, you can use the template below.
-- Remember to replace [YOUR-VERCEL-DOMAIN] with your actual Vercel deployment URL.

/*
CREATE OR REPLACE FUNCTION public.notify_registrant_webhook()
RETURNS TRIGGER AS $$
BEGIN
  -- Perform an HTTP POST webhook request via pg_net (Supabase's background net worker)
  -- This fires when payment_status transitions to cleared or rejected.
  IF (NEW.payment_status IN ('cleared', 'rejected') AND (OLD.payment_status IS NULL OR OLD.payment_status != NEW.payment_status)) THEN
    PERFORM net.http_post(
      url := 'https://[YOUR-VERCEL-DOMAIN]/api/notify-registrant',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := json_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD)
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_payment_status_notify ON public.registrations;
CREATE TRIGGER tr_payment_status_notify
AFTER UPDATE OF payment_status ON public.registrations
FOR EACH ROW
EXECUTE FUNCTION public.notify_registrant_webhook();
*/
