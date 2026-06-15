-- COLECCIONES
CREATE TABLE collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  number      INTEGER,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- CAPAS del stack
CREATE TABLE layers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  order_index  INTEGER NOT NULL,
  layer_key    TEXT NOT NULL,
  label_es     TEXT NOT NULL,
  label_en     TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('svg', 'image', 'auto')),
  blend_mode   TEXT DEFAULT 'source-over',
  color_token  TEXT,
  optional     BOOLEAN DEFAULT false,
  locked       BOOLEAN DEFAULT false,
  paired_with  TEXT,
  UNIQUE(collection_id, layer_key)
);

-- KEYWORDS (definida antes que assets para la FK)
CREATE TABLE keywords (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  keyword     TEXT NOT NULL,
  label       TEXT NOT NULL,
  hint        TEXT,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(collection_id, keyword)
);

-- ASSETS individuales
CREATE TABLE assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  layer_key     TEXT NOT NULL,
  name          TEXT NOT NULL,
  filename      TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  cdn_url       TEXT NOT NULL,
  thumb_url     TEXT,
  file_type     TEXT NOT NULL CHECK (file_type IN ('svg', 'png', 'jpg')),
  original_size INTEGER,
  color_map     JSONB DEFAULT '[]',
  is_default    BOOLEAN DEFAULT false,
  locked        BOOLEAN DEFAULT false,
  keyword_id    UUID REFERENCES keywords(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- VARIANTES de color
CREATE TABLE variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  color_overrides JSONB NOT NULL,
  keyword_id      UUID REFERENCES keywords(id),
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- DEFAULTS por capa
CREATE TABLE layer_defaults (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  layer_key     TEXT NOT NULL,
  token_id      TEXT NOT NULL,
  default_hex   TEXT NOT NULL,
  default_name  TEXT,
  UNIQUE(collection_id, layer_key, token_id)
);

-- EXCEPCIONES
CREATE TABLE layer_exceptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id         UUID REFERENCES collections(id) ON DELETE CASCADE,
  trigger_layer         TEXT NOT NULL,
  trigger_asset_pattern TEXT NOT NULL,
  affected_layer        TEXT NOT NULL,
  action                TEXT NOT NULL CHECK (action IN ('hide', 'show_only')),
  condition             TEXT,
  note                  TEXT
);

-- ÍNDICES
CREATE INDEX idx_assets_collection_layer ON assets(collection_id, layer_key);
CREATE INDEX idx_variants_parent ON variants(parent_asset_id);
CREATE INDEX idx_layers_order ON layers(collection_id, order_index);

-- ROW LEVEL SECURITY
ALTER TABLE collections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE layers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords       ENABLE ROW LEVEL SECURITY;
ALTER TABLE layer_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE layer_exceptions ENABLE ROW LEVEL SECURITY;

-- Lectura pública
CREATE POLICY "Public read collections"   ON collections    FOR SELECT USING (active = true);
CREATE POLICY "Public read layers"        ON layers         FOR SELECT USING (true);
CREATE POLICY "Public read assets"        ON assets         FOR SELECT USING (keyword_id IS NULL);
CREATE POLICY "Public read variants"      ON variants       FOR SELECT USING (keyword_id IS NULL AND active = true);
CREATE POLICY "Public read layer_defaults" ON layer_defaults FOR SELECT USING (true);
CREATE POLICY "Public read layer_exceptions" ON layer_exceptions FOR SELECT USING (true);
CREATE POLICY "Keywords via API only"     ON keywords       FOR SELECT USING (false);

-- Escritura solo admins
CREATE POLICY "Admin write collections"     ON collections      FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin write layers"          ON layers           FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin write assets"          ON assets           FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin write variants"        ON variants         FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin write keywords"        ON keywords         FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin write layer_defaults"  ON layer_defaults   FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin write layer_exceptions" ON layer_exceptions FOR ALL USING (auth.role() = 'authenticated');
