-- Unique constraint so upsert works correctly in /api/layer-defaults
ALTER TABLE layer_defaults
  ADD CONSTRAINT layer_defaults_collection_token_unique
  UNIQUE (collection_id, token_id);
