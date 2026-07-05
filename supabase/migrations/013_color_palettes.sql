-- Paletas de color por defecto, editables desde el admin: piel, cabello,
-- ropa y accesorios. El builder público las ofrece como muestras rápidas;
-- la rueda de color libre sigue disponible para casos especiales.
CREATE TABLE IF NOT EXISTS color_palettes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  palette_key   TEXT NOT NULL,               -- 'skin' | 'hair' | 'clothing' | 'accessories'
  label_es      TEXT NOT NULL,
  label_en      TEXT NOT NULL,
  swatches      JSONB NOT NULL DEFAULT '[]', -- [{ "hex": "#...", "fantasy": bool }, ...]
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (collection_id, palette_key)
);

ALTER TABLE color_palettes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "color_palettes_public_read" ON color_palettes FOR SELECT USING (true);
