-- Anchor Demo - Seed Users
-- Run this AFTER running anchor_migration.sql in the Supabase SQL Editor

INSERT INTO public.anchor_users (username, email, password_hash, role, full_name)
VALUES
  (
    'anchor_admin',
    'admin@anchor.demo',
    'Anch0r@Admin#2025',
    'admin',
    'Anchor Admin'
  ),
  (
    'anchor_user',
    'user@anchor.demo',
    'Anch0r@User#2025',
    'user',
    'Anchor User'
  )
ON CONFLICT (username) DO NOTHING;
