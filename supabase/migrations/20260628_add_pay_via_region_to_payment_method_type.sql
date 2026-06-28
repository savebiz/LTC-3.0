-- Alter payment_method_type enum to support regional payments
ALTER TYPE public.payment_method_type ADD VALUE 'pay_via_region';
