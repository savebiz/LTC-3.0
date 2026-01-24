-- FIX STORAGE POLICIES
-- This script enables public uploads to the 'payment_receipts' bucket.

-- 1. Create the bucket if it doesn't exist (Idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_receipts', 'payment_receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on objects (just in case)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Public can SELECT (View) their own receipt
-- Note: Making it public means anyone with the URL can view, which is fine for this use case.
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'payment_receipts' );

-- 4. Policy: Public can INSERT (Upload)
-- CRITICAL FIX: This allows anyone to upload to this specific bucket.
CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'payment_receipts' );

-- 5. Policy: Public can UPDATE (optional, maybe not needed, but good for retries)
CREATE POLICY "Public Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'payment_receipts' );
