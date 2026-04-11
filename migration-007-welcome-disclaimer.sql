-- Migration 007: Welcome modal disclaimer + video placeholder
-- Run this in your Supabase SQL Editor

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS welcome_disclaimer        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS welcome_video_placeholder TEXT DEFAULT 'https://www.youtube.com/embed/dQw4w9WgXcQ';
