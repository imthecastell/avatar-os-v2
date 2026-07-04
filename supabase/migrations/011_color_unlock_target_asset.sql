-- Permite que una regla de color aplique solo cuando un asset ESPECÍFICO
-- (no cualquiera de la capa) está seleccionado — ej. "Lentes" tiene color
-- desbloqueable por palabra clave, pero otro accesorio en la misma capa no.
ALTER TABLE color_unlocks ADD COLUMN IF NOT EXISTS target_asset_id UUID REFERENCES assets(id) ON DELETE CASCADE;
