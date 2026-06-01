-- 1. Create or replace the batch reference generation function to handle randomized alphanumeric references
CREATE OR REPLACE FUNCTION generate_batch_reference()
RETURNS trigger AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'C3TC-';
  qr_result TEXT := '';
  i INTEGER;
BEGIN
  -- Generate batch reference if not already defined
  IF NEW.batch_reference IS NULL THEN
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    NEW.batch_reference := result;
  END IF;

  -- Generate randomized qr_code_hash (16 chars) instead of uuid_generate_v4()
  IF NEW.qr_code_hash IS NULL OR NEW.qr_code_hash = '' THEN
    FOR i IN 1..16 LOOP
      qr_result := qr_result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    NEW.qr_code_hash := qr_result;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Alter registrations table qr_code_hash default constraint to be NULL so trigger generates it
ALTER TABLE public.registrations ALTER COLUMN qr_code_hash DROP DEFAULT;
