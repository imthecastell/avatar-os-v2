import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const collectionId = searchParams.get('collectionId')
  const layerKey = searchParams.get('layerKey')

  const supabase = await createClient()

  let query = supabase.from('assets').select('*')

  if (collectionId) query = query.eq('collection_id', collectionId)
  if (layerKey) query = query.eq('layer_key', layerKey)

  // Only public assets (no keyword required)
  query = query.is('keyword_id', null)

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
