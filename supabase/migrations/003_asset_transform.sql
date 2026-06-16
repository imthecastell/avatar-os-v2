-- Transformación por asset (scale + offset para alinear elementos)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS transform JSONB DEFAULT '{"scale":1,"offsetX":0,"offsetY":0}';

-- Keyword requerida para activar este asset (además del keyword_id ya existente)
-- keyword_id ya existe y es el FK; no hay que agregar nada aquí.

-- Color sugerido al activar el asset (p.ej. color default del cabello para este estilo)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS suggested_color TEXT DEFAULT NULL;

-- Máscara automática: ID del asset que se usa para enmascarar cuando este está activo
ALTER TABLE assets ADD COLUMN IF NOT EXISTS mask_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL;
