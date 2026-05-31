-- ========================================================
-- C3TC AUDIT TRAIL AND SETTINGS SETUP MIGRATION
-- Run this script in the Supabase SQL Editor
-- ========================================================

-- 1. Create Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Enable RLS for settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to settings (for loading volunteer list at login)
DROP POLICY IF EXISTS "Allow public read settings" ON public.settings;
CREATE POLICY "Allow public read settings" 
ON public.settings FOR SELECT 
USING (true);

-- Allow all operations for service role bypass
DROP POLICY IF EXISTS "Allow service role write settings" ON public.settings;
CREATE POLICY "Allow service role write settings" 
ON public.settings FOR ALL 
USING (true);

-- Seed default volunteer list in settings
INSERT INTO public.settings (key, value)
VALUES ('checkin_volunteers', '["Registration Team Lead", "Victor Sabo", "Volunteer Name 1", "Volunteer Name 2"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Create Audit Log Table (Append-Only)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  action TEXT NOT NULL,
  registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  batch_reference TEXT,
  registrant_name TEXT,
  performed_by TEXT NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  previous_value JSONB,
  new_value JSONB,
  notes TEXT
);

-- Enable RLS for audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (so front-end client-side forms can write audit logs)
DROP POLICY IF EXISTS "Public can insert audit logs" ON public.audit_log;
CREATE POLICY "Public can insert audit logs" 
ON public.audit_log FOR INSERT 
WITH CHECK (true);

-- Allow admins select (anyone can read for now, but RLS restricts updates/deletes)
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_log;
CREATE POLICY "Admins can read audit logs" 
ON public.audit_log FOR SELECT 
USING (true);

-- No UPDATE or DELETE policies created = append-only immutable constraint.

-- 3. Create Registrations Update Trigger (Tamper-Evident Backstop)
CREATE OR REPLACE FUNCTION public.log_registration_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_log (
    action,
    registration_id,
    batch_reference,
    registrant_name,
    performed_by,
    previous_value,
    new_value,
    notes
  ) VALUES (
    'db_update',
    NEW.id,
    NEW.batch_reference,
    NEW.full_name,
    'system_trigger',
    row_to_json(OLD)::jsonb,
    row_to_json(NEW)::jsonb,
    'Database trigger automatic backstop log'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if it exists and attach it
DROP TRIGGER IF EXISTS on_registration_updated ON public.registrations;
CREATE TRIGGER on_registration_updated
  AFTER UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.log_registration_changes();
