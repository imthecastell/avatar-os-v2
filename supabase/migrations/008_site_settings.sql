CREATE TABLE IF NOT EXISTS site_settings (
  id                    INT PRIMARY KEY DEFAULT 1,
  welcome_message_es    TEXT,
  welcome_message_en    TEXT,
  welcome_message_nl    TEXT,
  welcome_message_fr    TEXT,
  creator_name          TEXT,
  social_instagram      TEXT,
  social_tiktok         TEXT,
  social_twitter        TEXT,
  social_website         TEXT,
  creator_avatar_state  JSONB,
  creator_collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  updated_at            TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings_public_read" ON site_settings
  FOR SELECT USING (true);
