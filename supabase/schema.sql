-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('super_admin', 'region_lead', 'verifier');
CREATE TYPE reg_type AS ENUM ('delegate', 'volunteer');
CREATE TYPE reg_status AS ENUM ('pending_payment', 'confirmed', 'checked_in');
CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed');

-- 2. PROFILES (Linked to Auth Users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role user_role DEFAULT 'verifier',
  assigned_region TEXT, -- "Region 1", "Region 20", etc. (Must match Registration data)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. REGISTRATIONS
CREATE TABLE registrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Personal Info
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  gender TEXT NOT NULL,
  age_range TEXT,
  
  -- Location (Cascading Data)
  region TEXT NOT NULL,
  province TEXT NOT NULL,
  
  -- Classification
  type reg_type NOT NULL,
  department TEXT, -- Only for volunteers
  
  -- Status
  status reg_status DEFAULT 'pending_payment',
  
  -- Security
  qr_code_hash TEXT UNIQUE DEFAULT uuid_generate_v4()::text -- Simple unique string for QR
);

-- 4. PAYMENTS
CREATE TABLE payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  registration_id UUID REFERENCES registrations(id) NOT NULL,
  
  reference TEXT UNIQUE NOT NULL, -- Paystack Reference
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'NGN',
  channel TEXT, -- 'card', 'bank_transfer'
  
  status payment_status DEFAULT 'pending'
);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- Profiles: Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- Registrations:
-- 1. Public can INSERT (Registration Form)
CREATE POLICY "Public can register" 
ON registrations FOR INSERT 
WITH CHECK (true);

-- 2. Super Admin can VIEW ALL
CREATE POLICY "Super Admin view all" 
ON registrations FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- 3. Region Leads can VIEW THEIR REGION
CREATE POLICY "Region Leads view own region" 
ON registrations FOR SELECT 
USING (
  region = (SELECT assigned_region FROM profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- 4. Public can view their own registration (by ID - for Success Page)
-- Note: This is loose for now to allow "Find by Email" or "Local ID". 
-- Strict way: Return ID after insert and use that.

-- Payments:
-- 1. Public can INSERT (Payment Gateway Webhook/Callback)
CREATE POLICY "Public can insert payments" 
ON payments FOR INSERT 
WITH CHECK (true);

-- 2. Admins can VIEW
CREATE POLICY "Admins view payments" 
ON payments FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'super_admin' OR role = 'region_lead'))
);

-- 6. TRIGGERS
-- Auto-create profile on SignUp
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, full_name)
  values (new.id, new.email, 'verifier', new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
