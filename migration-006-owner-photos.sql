-- Migration 006: Owner profile photo URLs
-- Run this in your Supabase SQL Editor

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS owner_photo_url  TEXT,
  ADD COLUMN IF NOT EXISTS owner2_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS owner3_photo_url TEXT;
