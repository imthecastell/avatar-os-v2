'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import type { Asset, Keyword, AssetTransform, Layer, ColorUnlock } from '@/types'

interface Props {
  asset:        Asset
  assets:       Asset[]           // para el selector de máscara
  keywords:     Keyword[]
  layers:       Layer[]           // para el selector de capa objetivo de la regla de color
  colorUnlocks: ColorUnlock[]     // reglas existentes, para encontrar la de este asset si ya tiene una
  onClose:      () => void
  onSaved:      () => void        // recarga la página
}

const ROLE_OPTIONS = [
  { value: 'skin',      label: 'Principal' },
  { value: 'primary',   label: 'Secundario' },
  { value: 'secondary', label: 'Detalle' },
]

// Una capa solo se puede recolorear si al menos uno de sus assets es SVG con
// regiones detectadas (colorMap) — capas raster (fondo, marco) nunca podrán
// aplicar un color_unlock por más que se configure una regla sobre ellas.
function isRecolorable(layerKey: string, allAssets: Asset[]): boolean {
  return allAssets.some(a => a.layerKey === layerKey && a.fileType === 'svg' && a.colorMap.length > 0)
}

export default function AssetInspector({ asset, assets, keywords, layers, colorUnlocks, onClose, onSaved }: Props) {
  const [keywordId,      setKeywordId]      = useState<string>(asset.keywordId ?? '')
  const [isDefault,      setIsDefault]      = useState(asset.isDefault)
  const [suggestedColor, setSuggestedColor] = useState<string>(asset.suggestedColor ?? '')
  const [maskAssetId,    setMaskAssetId]    = useState<string>(asset.maskAssetId ?? '')
  const currentLayer = layers.find(l => l.layerKey === asset.layerKey)
  // Tri-estado: heredar el default de la capa, o anularlo explícitamente
  // para este asset puntual.
  const [transformOverride, setTransformOverride] = useState<'inherit' | 'on' | 'off'>(
    asset.allowTransform === null ? 'inherit' : asset.allowTransform ? 'on' : 'off'
  )
  const [transform,      setTransform]      = useState<AssetTransform>(
    asset.transform ?? { scale: 1, offsetX: 0, offsetY: 0 }
  )
  const [saving, setSaving] = useState(false)

  // Regla "al seleccionar este asset, desbloquea el color de otra capa"
  // (ej. chaqueta abierta que libera el color de la camiseta debajo).
  // Solo capas con al menos un SVG con colores detectados pueden recolorearse.
  const recolorableLayers = layers.filter(l => isRecolorable(l.layerKey, assets))
  const existingRule = colorUnlocks.find(u => u.scopeAssetId === asset.id)
  const [colorRuleOn,     setColorRuleOn]     = useState(!!existingRule)
  const [ruleTargetLayer, setRuleTargetLayer] = useState(existingRule?.targetLayerKey ?? recolorableLayers[0]?.layerKey ?? '')
  const [ruleTargetRole,  setRuleTargetRole]  = useState(existingRule?.targetRole ?? 'skin')
  const [ruleMode,        setRuleMode]        = useState<'wheel' | 'swatches'>(existingRule?.mode === 'swatches' ? 'swatches' : 'wheel')
  const [ruleSwatches,    setRuleSwatches]    = useState<string[]>(existingRule?.swatches ?? ['#ffffff', '#000000', '#ff0000'])

  // Color propio desbloqueable por palabra clave (ej. lentes negros por defecto,
  // pero al tener "discord" o cualquiera de N palabras habilitadas, el usuario
  // puede elegir entre una selección de muestras para ESTE asset específico).
  // Cada palabra clave habilitada guarda su propia fila en color_unlocks, todas
  // apuntando al mismo target_asset_id/target_role/swatches — así cualquiera de
  // ellas (sola o combinada) activa el mismo control.
  const ownColorRules = colorUnlocks.filter(u => u.targetAssetId === asset.id)
  const ownRoleOptions: [string, string][] = asset.colorMap.length > 0
    ? Array.from(new Map(asset.colorMap.map(c => [c.role, c.label || c.role])).entries())
    : ROLE_OPTIONS.map(r => [r.value, r.label] as [string, string])
  // Igual que ownRoleOptions pero conservando el color ORIGINAL detectado en el
  // SVG para cada región — permite mostrarlo como muestra visual en vez de que
  // el admin elija a ciegas por un nombre de rol abstracto (Principal/Detalle…).
  const ownRoleSwatches: { role: string; label: string; original: string }[] = asset.colorMap.length > 0
    ? Array.from(new Map(asset.colorMap.map(c => [c.role, c])).values())
        .map(c => ({ role: c.role, label: c.label || c.role, original: c.original }))
    : ROLE_OPTIONS.map(r => ({ role: r.value, label: r.label, original: '#888888' }))
  // Tri-estado: heredar el default de color de la capa, desactivarlo para
  // este asset puntual, o darle una configuración propia (con o sin
  // palabras clave que la gatillen).
  const [colorOverride, setColorOverride] = useState<'inherit' | 'disabled' | 'custom'>(
    ownColorRules.length > 0 ? 'custom' : asset.colorDisabled ? 'disabled' : 'inherit'
  )
  const [ownKeywordIds,  setOwnKeywordIds]  = useState<string[]>(
    ownColorRules.map(u => u.keywordId).filter((id): id is string => !!id)
  )
  const [ownTargetRole,  setOwnTargetRole]  = useState<string>(ownColorRules[0]?.targetRole ?? ownRoleOptions[0]?.[0] ?? 'skin')
  const [ownSwatches,    setOwnSwatches]    = useState<string[]>(ownColorRules[0]?.swatches ?? ['#ffffff', '#000000', '#ff0000'])
  // Además de las muestras fijas, permite ofrecer la rueda de color libre
  // para este asset puntual (igual que "Permitir color personalizado" a
  // nivel de capa, pero aplicado solo a este asset).
  const [ownUseWheel,    setOwnUseWheel]    = useState<boolean>(
    ownColorRules[0]?.mode === 'wheel' || ownColorRules[0]?.mode === 'both'
  )

  function toggleOwnKeyword(id: string) {
    setOwnKeywordIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }

  function updateTransform(key: keyof AssetTransform, val: number) {
    setTransform(t => ({ ...t, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)

    const body: Record<string, unknown> = {
      id:             asset.id,
      keyword_id:     keywordId    || null,
      is_default:     isDefault,
      suggested_color: suggestedColor || null,
      mask_asset_id:  maskAssetId  || null,
      allow_transform: transformOverride === 'inherit' ? null : transformOverride === 'on',
      color_disabled:  colorOverride === 'disabled',
      transform,
    }

    // Si se marca como default, limpiar otros defaults de la misma capa
    if (isDefault && !asset.isDefault) {
      // El endpoint PATCH ya guarda is_default; el admin puede gestionar múltiples defaults
      // desde la vista de assets. Aquí solo guardamos.
    }

    const assetRes = await fetch('/api/assets', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    if (!assetRes.ok) {
      const d = await assetRes.json().catch(() => ({} as { error?: string }))
      alert(`No se pudo guardar el asset: ${d.error ?? `HTTP ${assetRes.status}`}`)
      setSaving(false)
      return
    }

    // Regla de color propia del asset (chaqueta → libera color de camiseta, etc.)
    if (colorRuleOn) {
      const ruleBody = {
        collection_id:    asset.collectionId,
        scope_asset_id:   asset.id,
        target_layer_key: ruleTargetLayer,
        target_role:      ruleTargetRole,
        mode:              ruleMode,
        swatches:          ruleMode === 'swatches' ? ruleSwatches : null,
      }
      const ruleRes = existingRule
        ? await fetch('/api/color-unlocks', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: existingRule.id, ...ruleBody }),
          })
        : await fetch('/api/color-unlocks', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ruleBody),
          })
      if (!ruleRes.ok) {
        const d = await ruleRes.json().catch(() => ({} as { error?: string }))
        alert(`El asset se guardó, pero la regla de color falló: ${d.error ?? `HTTP ${ruleRes.status}`}\n\n¿Se aplicó la migración 010_color_unlocks.sql en Supabase?`)
        setSaving(false)
        return
      }
    } else if (existingRule) {
      await fetch(`/api/color-unlocks?id=${existingRule.id}`, { method: 'DELETE' })
    }

    // Color propio desbloqueable por N palabras clave (ej. Lentes): se borra todo
    // lo existente y se recrea una fila por cada palabra clave seleccionada —
    // más simple que diffear altas/bajas y el volumen es siempre pequeño.
    if (ownColorRules.length > 0) {
      await Promise.all(ownColorRules.map(u => fetch(`/api/color-unlocks?id=${u.id}`, { method: 'DELETE' })))
    }
    if (colorOverride === 'custom') {
      // Sin ninguna palabra clave marcada, el color queda siempre disponible
      // (ej. mostacho: no necesita gatillo, solo mostrar las muestras).
      const kwList: (string | null)[] = ownKeywordIds.length > 0 ? ownKeywordIds : [null]
      for (const kwId of kwList) {
        const res = await fetch('/api/color-unlocks', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collection_id:    asset.collectionId,
            keyword_id:       kwId,
            target_layer_key: asset.layerKey,
            target_asset_id:  asset.id,
            target_role:      ownTargetRole,
            mode:             ownUseWheel ? 'both' : 'swatches',
            swatches:         ownSwatches,
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({} as { error?: string }))
          alert(`El asset se guardó, pero el desbloqueo de color falló: ${d.error ?? `HTTP ${res.status}`}\n\n¿Se aplicó la migración 011_color_unlock_target_asset.sql en Supabase?`)
          setSaving(false)
          return
        }
      }
    }

    setSaving(false)
    onSaved()
  }

  const maskCandidates = assets.filter(a => a.layerKey === 'mask' && a.id !== asset.id)

  const label  = (v: string, d: string) => v || d
  const inputC = `
    w-full text-xs rounded-xl px-3 py-2 border focus:outline-none transition-colors
    focus:border-violet-500
  `
  const inputS = { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
        style={{ background: '#111120', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {asset.cdnUrl && (
            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Image src={asset.cdnUrl} alt={asset.name} width={48} height={48} className="w-full h-full object-cover" unoptimized />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{asset.name}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{asset.layerKey} · {asset.fileType.toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="text-lg leading-none shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>✕</button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Default toggle */}
          <Toggle
            label="Asset por defecto"
            hint="Se usa cuando el usuario abre el builder por primera vez"
            value={isDefault}
            onChange={setIsDefault}
          />

          {/* Keyword requirement */}
          <div>
            <Label text="Requiere palabra clave" hint="Solo se muestra si el usuario ingresa esta clave" />
            <select
              value={keywordId}
              onChange={e => setKeywordId(e.target.value)}
              className={inputC}
              style={inputS}
            >
              <option value="">Sin restricción (público)</option>
              {keywords.map(k => (
                <option key={k.id} value={k.id}>{k.keyword} — {k.label}</option>
              ))}
            </select>
          </div>

          {/* Suggested color */}
          {(asset.layerKey === 'hair-back' || asset.layerKey === 'hair-front') && (
            <div>
              <Label text="Color sugerido" hint="Se aplica automáticamente al seleccionar este estilo de cabello" />
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="color"
                  value={suggestedColor || '#3B2314'}
                  onChange={e => setSuggestedColor(e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border-0"
                  style={{ background: 'none' }}
                />
                <input
                  type="text"
                  value={suggestedColor}
                  onChange={e => setSuggestedColor(e.target.value)}
                  placeholder="Sin color sugerido"
                  className={inputC}
                  style={inputS}
                />
                {suggestedColor && (
                  <button onClick={() => setSuggestedColor('')} className="text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>✕</button>
                )}
              </div>
            </div>
          )}

          {/* Mask asset (for hats/accessories) */}
          {(asset.layerKey === 'acc-front' || asset.layerKey === 'mask') && (
            <div>
              <Label
                text="Máscara automática"
                hint="Asset del layer 'mask' que se aplica cuando este accesorio está activo. Útil para que gorras oculten el cabello que sobresale."
              />
              {maskCandidates.length === 0 ? (
                <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  No hay assets en el layer "mask". Sube primero la máscara en el Studio.
                </p>
              ) : (
                <select
                  value={maskAssetId}
                  onChange={e => setMaskAssetId(e.target.value)}
                  className={`${inputC} mt-1`}
                  style={inputS}
                >
                  <option value="">Sin máscara</option>
                  {maskCandidates.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
              <p className="text-[9px] mt-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                La máscara usa modo "destination-out" sobre las capas anteriores para borrar el cabello que asoma bajo la gorra.
              </p>
            </div>
          )}

          {/* Regla: al seleccionar este asset, libera el color de otra capa */}
          <div>
            <Toggle
              label="Al elegirlo, desbloquea color en otra capa"
              hint="Ej. una chaqueta abierta que deja ver la camiseta — al seleccionar la chaqueta, el usuario podrá recolorear la camiseta libremente"
              value={colorRuleOn}
              onChange={setColorRuleOn}
            />
            {colorRuleOn && (
              <div className="mt-3 p-3 rounded-xl space-y-2" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <div className="flex items-center gap-2">
                  <select
                    value={ruleTargetLayer}
                    onChange={e => setRuleTargetLayer(e.target.value)}
                    className="flex-1 text-[10px] rounded-lg px-2 py-1.5 border focus:outline-none"
                    style={inputS}
                  >
                    {recolorableLayers.map(l => <option key={l.id} value={l.layerKey}>{l.labelEs}</option>)}
                  </select>
                  <select
                    value={ruleTargetRole}
                    onChange={e => setRuleTargetRole(e.target.value)}
                    className="flex-1 text-[10px] rounded-lg px-2 py-1.5 border focus:outline-none"
                    style={inputS}
                  >
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  {(['wheel', 'swatches'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRuleMode(m)}
                      className="text-[9px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                      style={{
                        background: ruleMode === m ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.05)',
                        color: ruleMode === m ? 'white' : 'rgba(255,255,255,0.35)',
                      }}
                    >
                      {m === 'wheel' ? '🎡 Rueda libre' : '🎨 Colores fijos'}
                    </button>
                  ))}
                </div>
                {ruleMode === 'swatches' && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {ruleSwatches.map((hex, i) => (
                      <div key={i} className="relative">
                        <input
                          type="color"
                          value={hex}
                          onChange={e => setRuleSwatches(sw => sw.map((s, idx) => idx === i ? e.target.value : s))}
                          className="w-7 h-7 rounded-lg cursor-pointer border-0"
                        />
                        {ruleSwatches.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setRuleSwatches(sw => sw.filter((_, idx) => idx !== i))}
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center"
                            style={{ background: 'rgba(239,68,68,0.8)', color: 'white' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setRuleSwatches(sw => [...sw, '#ffffff'])}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Colores propios desbloqueables por palabra clave (ej. Lentes negros
              por defecto, pero con "discord" u otras claves habilita muestras) */}
          {asset.colorMap.length > 0 && (
            <div>
              <Label
                text="Color de este asset"
                hint={
                  currentLayer?.colorEditable
                    ? `La capa "${currentLayer.labelEs}" ya permite color por defecto — "Heredar" usa esa configuración`
                    : `La capa "${currentLayer?.labelEs ?? asset.layerKey}" NO permite color por defecto — "Heredar" no mostrará nada`
                }
              />
              <Segmented
                value={colorOverride}
                onChange={setColorOverride}
                options={[
                  { value: 'inherit',  label: 'Heredar de la capa' },
                  { value: 'disabled', label: 'Desactivar' },
                  { value: 'custom',   label: 'Personalizar' },
                ]}
              />
              {colorOverride === 'custom' && (
                <div className="mt-3 p-3 rounded-xl space-y-2.5" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                  {/* Miniatura + selector visual: qué color DEL ASSET se vuelve
                      editable. Antes era un <select> con nombres abstractos
                      (Principal/Secundario/Detalle) sin ninguna referencia visual
                      a qué parte del asset representaba cada uno. */}
                  <div className="flex items-start gap-3">
                    {asset.cdnUrl && (
                      <div
                        className="w-16 h-16 rounded-xl overflow-hidden shrink-0"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        <Image src={asset.cdnUrl} alt={asset.name} width={64} height={64} className="w-full h-full object-contain" unoptimized />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Elige qué color del asset se vuelve editable:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ownRoleSwatches.map(({ role, label: roleLabel, original }) => {
                          const checked = ownTargetRole === role
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => setOwnTargetRole(role)}
                              className="flex flex-col items-center gap-1"
                              title={original}
                            >
                              <span
                                className="w-8 h-8 rounded-lg block transition-all"
                                style={{
                                  background: original,
                                  boxShadow: checked
                                    ? '0 0 0 2px #111120, 0 0 0 4px #7c3aed'
                                    : '0 0 0 1px rgba(255,255,255,0.15)',
                                }}
                              />
                              <span className="text-[9px] max-w-[3.5rem] truncate" style={{ color: checked ? 'white' : 'rgba(255,255,255,0.4)' }}>
                                {roleLabel}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Palabras clave que desbloquean la función (opcional — ninguna marcada = siempre disponible):
                    </p>
                    {keywords.length === 0 ? (
                      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>No hay palabras clave en esta colección todavía.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {keywords.map(k => {
                          const checked = ownKeywordIds.includes(k.id)
                          return (
                            <button
                              key={k.id}
                              type="button"
                              onClick={() => toggleOwnKeyword(k.id)}
                              className="text-[10px] font-medium px-2.5 py-1 rounded-lg transition-all"
                              style={{
                                background: checked ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.05)',
                                color: checked ? 'white' : 'rgba(255,255,255,0.4)',
                              }}
                            >
                              {checked ? '✓ ' : ''}{k.keyword}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Colores que podrá elegir el usuario para esa región:
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                    {ownSwatches.map((hex, i) => (
                      <div key={i} className="relative">
                        <input
                          type="color"
                          value={hex}
                          onChange={e => setOwnSwatches(sw => sw.map((s, idx) => idx === i ? e.target.value : s))}
                          className="w-7 h-7 rounded-lg cursor-pointer border-0"
                        />
                        {ownSwatches.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setOwnSwatches(sw => sw.filter((_, idx) => idx !== i))}
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center"
                            style={{ background: 'rgba(239,68,68,0.8)', color: 'white' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setOwnSwatches(sw => [...sw, '#ffffff'])}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                    >
                      +
                    </button>
                    </div>
                  </div>
                  <Toggle
                    label="Rueda de color libre"
                    hint="Además de las muestras fijas de arriba, deja que el usuario elija cualquier color con la rueda"
                    value={ownUseWheel}
                    onChange={setOwnUseWheel}
                  />
                </div>
              )}
            </div>
          )}

          {/* Ajuste en el builder — disponible para cualquier asset, no solo
              cabello, para no tener que crear excepciones una por una */}
          <div>
            <Label
              text="Ajuste de posición en el builder"
              hint={
                currentLayer?.positionEditable
                  ? `La capa "${currentLayer.labelEs}" ya permite ajuste por defecto — "Heredar" usa esa configuración`
                  : `La capa "${currentLayer?.labelEs ?? asset.layerKey}" NO permite ajuste por defecto — "Heredar" no mostrará el control`
              }
            />
            <Segmented
              value={transformOverride}
              onChange={setTransformOverride}
              options={[
                { value: 'inherit', label: 'Heredar de la capa' },
                { value: 'on',      label: 'Sí' },
                { value: 'off',     label: 'No' },
              ]}
            />
          </div>

          {/* Transform */}
          <div>
            <Label text="Posición y escala" hint="Ajusta si el asset no encaja correctamente con los demás elementos" />
            <div className="space-y-3 mt-2">
              <Slider
                label={`Escala  ${transform.scale.toFixed(2)}×`}
                min={0.3} max={2} step={0.01}
                value={transform.scale}
                onChange={v => updateTransform('scale', v)}
              />
              <Slider
                label={`Desplazamiento X  ${transform.offsetX > 0 ? '+' : ''}${transform.offsetX}px`}
                min={-400} max={400} step={4}
                value={transform.offsetX}
                onChange={v => updateTransform('offsetX', v)}
              />
              <Slider
                label={`Desplazamiento Y  ${transform.offsetY > 0 ? '+' : ''}${transform.offsetY}px`}
                min={-400} max={400} step={4}
                value={transform.offsetY}
                onChange={v => updateTransform('offsetY', v)}
              />
              {(transform.scale !== 1 || transform.offsetX !== 0 || transform.offsetY !== 0) && (
                <button
                  onClick={() => setTransform({ scale: 1, offsetX: 0, offsetY: 0 })}
                  className="text-[10px]"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  ↩ Resetear transformación
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 transition-all"
            style={{ background: 'rgba(124,58,237,0.85)', color: 'white' }}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button
            onClick={onClose}
            className="px-4 text-sm rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────
// Control de 3 (o más) opciones mutuamente excluyentes — usado para los
// tri-estados "heredar de la capa / activar / desactivar".
function Segmented<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
          style={{
            background: value === opt.value ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.05)',
            color: value === opt.value ? 'white' : 'rgba(255,255,255,0.4)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-white">{label}</p>
        {hint && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="w-10 h-6 rounded-full transition-all shrink-0 relative"
        style={{ background: value ? 'rgba(124,58,237,0.8)' : 'rgba(255,255,255,0.1)' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
          style={{ background: 'white', left: value ? '18px' : '2px' }}
        />
      </button>
    </div>
  )
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-xs font-medium text-white">{text}</p>
      {hint && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{hint}</p>}
    </div>
  )
}

function Slider({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: '#7c3aed', background: `linear-gradient(to right, #7c3aed ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) 0%)` }}
      />
    </div>
  )
}
