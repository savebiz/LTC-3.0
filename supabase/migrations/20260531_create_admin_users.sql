-- Create admin_users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Allow read access for select by public (only returning safe columns, but we block this and use API instead)
-- So we only configure service role bypass which is default in Supabase.

-- Seed default Super Admin: Victor Sabo
-- The bcrypt hash of 'C3TC@admin2026' is '$2b$10$AxzKr6WI.38RGleM7v6cj.hIGx/IrEckMxTfzAshGGb3Nso.Or2hK'
INSERT INTO public.admin_users (full_name, role, password_hash, is_active)
VALUES ('Victor Sabo', 'Super Admin', '$2b$10$AxzKr6WI.38RGleM7v6cj.hIGx/IrEckMxTfzAshGGb3Nso.Or2hK')
ON CONFLICT (full_name) DO NOTHING;
