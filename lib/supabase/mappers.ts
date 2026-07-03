import type { Asset, Layer, LayerException, LayerDefault, Keyword, Collection, SiteSettings, AvatarState, ColorUnlock } from '@/types'

export function mapAsset(r: Record<string, unknown>): Asset {
  return {
    id:           r.id as string,
    collectionId: r.collection_id as string,
    layerKey:     r.layer_key as string,
    name:         r.name as string,
    filename:     r.filename as string,
    storagePath:  r.storage_path as string,
    cdnUrl:       r.cdn_url as string,
    thumbUrl:     r.thumb_url as string | null,
    fileType:     r.file_type as 'svg' | 'png' | 'jpg',
    originalSize: r.original_size as number,
    colorMap:     (r.color_map as []) || [],
    isDefault:    r.is_default as boolean,
    locked:       r.locked as boolean,
    keywordId:    r.keyword_id as string | null,
    svgEditable:    r.svg_editable !== false,
    transform:      (r.transform as { scale: number; offsetX: number; offsetY: number }) ?? { scale: 1, offsetX: 0, offsetY: 0 },
    suggestedColor: r.suggested_color as string | null,
    maskAssetId:    r.mask_asset_id as string | null,
    allowTransform: (r.allow_transform as boolean) ?? false,
  }
}

export function mapLayer(r: Record<string, unknown>): Layer {
  return {
    id:           r.id as string,
    collectionId: r.collection_id as string,
    orderIndex:   r.order_index as number,
    layerKey:     r.layer_key as string,
    labelEs:      r.label_es as string,
    labelEn:      r.label_en as string,
    type:         r.type as 'svg' | 'image' | 'auto',
    blendMode:    r.blend_mode as string,
    colorToken:       r.color_token as string | null,
    optional:         r.optional as boolean,
    locked:           r.locked as boolean,
    pairedWith:       r.paired_with as string | null,
    visibleInBuilder: (r.visible_in_builder as boolean) ?? true,
    opacity:          (r.opacity as number) ?? 1,
  }
}

export function mapLayerException(r: Record<string, unknown>): LayerException {
  return {
    id:                  r.id as string,
    collectionId:        r.collection_id as string,
    triggerLayer:        r.trigger_layer as string,
    triggerAssetPattern: r.trigger_asset_pattern as string,
    affectedLayer:       r.affected_layer as string,
    action:              r.action as 'hide' | 'show_only',
    condition:           r.condition as string,
    note:                r.note as string,
  }
}

export function mapLayerDefault(r: Record<string, unknown>): LayerDefault {
  return {
    id:           r.id as string,
    collectionId: r.collection_id as string,
    layerKey:     r.layer_key as string,
    tokenId:      r.token_id as string,
    defaultHex:   r.default_hex as string,
    defaultName:  r.default_name as string | null,
  }
}

export function mapCollection(r: Record<string, unknown>): Collection {
  return {
    id:     r.id as string,
    slug:   r.slug as string,
    name:   r.name as string,
    number: r.number as number,
    active: r.active as boolean,
  }
}

export function mapColorUnlock(r: Record<string, unknown>): ColorUnlock {
  return {
    id:             r.id as string,
    collectionId:   r.collection_id as string,
    keywordId:      r.keyword_id as string | null,
    scopeAssetId:   r.scope_asset_id as string | null,
    targetLayerKey: r.target_layer_key as string,
    targetRole:     r.target_role as string,
    mode:           (r.mode as 'wheel' | 'swatches') ?? 'wheel',
    swatches:       (r.swatches as string[]) ?? null,
  }
}

export function mapSiteSettings(r: Record<string, unknown>): SiteSettings {
  return {
    welcomeMessageEs:    r.welcome_message_es as string | null,
    welcomeMessageEn:    r.welcome_message_en as string | null,
    welcomeMessageNl:    r.welcome_message_nl as string | null,
    welcomeMessageFr:    r.welcome_message_fr as string | null,
    creatorName:         r.creator_name as string | null,
    socialInstagram:     r.social_instagram as string | null,
    socialTiktok:        r.social_tiktok as string | null,
    socialTwitter:       r.social_twitter as string | null,
    socialWebsite:       r.social_website as string | null,
    creatorAvatarState:  r.creator_avatar_state as AvatarState | null,
    creatorCollectionId: r.creator_collection_id as string | null,
  }
}

export function mapKeyword(r: Record<string, unknown>): Keyword {
  return {
    id:           r.id as string,
    collectionId: r.collection_id as string,
    keyword:      r.keyword as string,
    label:        r.label as string,
    hint:         r.hint as string | null,
    active:       r.active as boolean,
    isMaster:     (r.is_master as boolean) ?? false,
  }
}
