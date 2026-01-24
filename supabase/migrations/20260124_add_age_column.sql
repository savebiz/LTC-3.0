-- Run this in the Supabase SQL Editor

ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS age INTEGER;

-- Optional: If you want to backfill or migrate data from age_range (if any exists)
-- UPDATE public.registrations SET age = 15 WHERE age IS NULL; 
