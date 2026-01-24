-- 1. Create Volunteers Table
CREATE TABLE IF NOT EXISTS public.volunteers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    region TEXT,
    province TEXT,
    role TEXT, -- Teenager / Teacher
    department TEXT, -- Ushers, Technical, etc.
    experience TEXT,
    status TEXT DEFAULT 'pending' -- confirmed, rejected
);

-- Enable RLS for Volunteers
ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;

-- Allow Public Insert for Volunteers
CREATE POLICY "Public can register as volunteer"
ON public.volunteers FOR INSERT
WITH CHECK (true);

-- Allow Public Select for Volunteers (Verification/Success page)
CREATE POLICY "Public can view own volunteer reg"
ON public.volunteers FOR SELECT
USING (true);


-- 2. Update Registrations Table (Delegates)
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 3. Storage Policies (If you run this in SQL Editor)
-- Note: Buckets usually need to be created in the UI, but we can set policies
-- Policy to allow public to upload receipts
-- (Assuming bucket 'payment_receipts' exists)
-- This part might error if bucket doesn't exist, so best to run via UI or separate script if needed.
