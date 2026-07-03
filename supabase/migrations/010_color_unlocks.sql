CREATE TABLE IF NOT EXISTS color_unlocks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id     UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  -- Disparador por palabra clave: se requiere tenerla desbloqueada (o cualquier
  -- keyword master) para que la regla aplique. Nullable — puede quedar vacío
  -- si el disparador es únicamente scope_asset_id (ver abajo).
  keyword_id        UUID REFERENCES keywords(id) ON DELETE CASCADE,
  -- Disparador por selección de asset: la regla solo aplica mientras este
  -- asset específico esté seleccionado en su capa (ej. una chaqueta abierta
  -- que, al elegirla, libera el color de la camiseta que se ve debajo).
  -- Nullable — puede quedar vacío si el disparador es únicamente keyword_id.
  scope_asset_id    UUID REFERENCES assets(id) ON DELETE CASCADE,
  target_layer_key  TEXT NOT NULL,             -- capa cuyo color se vuelve editable
  target_role       TEXT NOT NULL DEFAULT 'skin', -- región del colorMap del asset activo en esa capa (skin/primary/secondary/...)
  mode              TEXT NOT NULL DEFAULT 'wheel', -- 'wheel' (rueda libre) | 'swatches' (colores fijos)
  swatches          TEXT[],                     -- lista de hex, solo si mode='swatches'
  created_at        TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT color_unlocks_has_trigger CHECK (keyword_id IS NOT NULL OR scope_asset_id IS NOT NULL)
);

ALTER TABLE color_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "color_unlocks_public_read" ON color_unlocks FOR SELECT USING (true);
