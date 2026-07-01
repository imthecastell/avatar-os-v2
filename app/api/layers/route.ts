import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const collectionId = searchParams.get('collectionId')

  const supabase = await createClient()
  let query = supabase.from('layers').select('*').order('order_index')
  if (collectionId) query = query.eq('collection_id', collectionId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { id, ...updates } = body

  const { data, error } = await supabase
    .from('layers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const id        = searchParams.get('id')
  const layerKey  = searchParams.get('layerKey')
  const collId    = searchParams.get('collectionId')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Delete all assets belonging to this layer first
  if (layerKey && collId) {
    await supabase.from('assets')
      .delete()
      .eq('layer_key', layerKey)
      .eq('collection_id', collId)
  }

  const { error } = await supabase.from('layers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const body = await request.json()
  const { data, error } = await supabase.from('layers').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
