-- Add visibility flag for builder tab bar
ALTER TABLE layers ADD COLUMN IF NOT EXISTS visible_in_builder BOOLEAN DEFAULT true;

-- Known auto-managed layers that should NOT show as builder tabs
UPDATE layers
SET visible_in_builder = false
WHERE layer_key IN ('hair-front', 'effect-final', 'frame', 'mask');
