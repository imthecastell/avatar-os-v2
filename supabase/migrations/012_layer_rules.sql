-- Reglas de capa: default de edición (color/posición) para TODOS los assets
-- de esa capa, sin tener que configurar cada asset por separado. Un asset
-- específico puede seguir anulando este default (ver assets.allow_transform,
-- assets.color_disabled y color_unlocks.target_asset_id).
ALTER TABLE layers ADD COLUMN IF NOT EXISTS position_editable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE layers ADD COLUMN IF NOT EXISTS color_editable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE layers ADD COLUMN IF NOT EXISTS color_target_role TEXT;
ALTER TABLE layers ADD COLUMN IF NOT EXISTS color_mode TEXT NOT NULL DEFAULT 'swatches';
ALTER TABLE layers ADD COLUMN IF NOT EXISTS color_swatches TEXT[];

-- assets.allow_transform pasa a ser tri-estado: NULL = heredar el default de
-- la capa, true/false = anular explícitamente para ESTE asset. Los valores
-- en false de hoy nunca fueron desactivados a propósito por un admin (es
-- solo el default viejo de la columna) — se limpian a NULL para que hereden
-- de su capa en vez de quedar forzados a "no".
UPDATE assets SET allow_transform = NULL WHERE allow_transform = false;
ALTER TABLE assets ALTER COLUMN allow_transform DROP DEFAULT;

-- Permite que un asset específico desactive el color aunque su capa lo
-- tenga habilitado por defecto (ej. capa "Ropa" editable en general, pero
-- una prenda puntual que no debe cambiar de color).
ALTER TABLE assets ADD COLUMN IF NOT EXISTS color_disabled BOOLEAN NOT NULL DEFAULT false;

-- La regla "color propio por palabra clave" (target_asset_id) permite
-- keyword_id NULL (color siempre disponible, sin gatillo) sin scope_asset_id
-- — eso violaba la restricción original de que algún disparador esté
-- presente. Se relaja para aceptar también target_asset_id como disparador
-- válido por sí solo.
ALTER TABLE color_unlocks DROP CONSTRAINT IF EXISTS color_unlocks_has_trigger;
ALTER TABLE color_unlocks ADD CONSTRAINT color_unlocks_has_trigger
  CHECK (keyword_id IS NOT NULL OR scope_asset_id IS NOT NULL OR target_asset_id IS NOT NULL);
