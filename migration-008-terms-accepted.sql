-- Add terms_accepted_at to locations table
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ DEFAULT NULL;

-- Separate table to track acceptance for users who haven't created a club yet
CREATE TABLE IF NOT EXISTS user_terms_acceptance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  accepted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_terms_acceptance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own acceptance" ON user_terms_acceptance
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own acceptance" ON user_terms_acceptance
  FOR INSERT WITH CHECK (auth.uid() = user_id);
