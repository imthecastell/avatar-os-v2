import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { mapCollection } from '@/lib/supabase/mappers'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('collections').select('*').order('number')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(mapCollection))
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { name, slug, number } = body

  if (!name || !slug) return NextResponse.json({ error: 'name and slug required' }, { status: 400 })

  const { data, error } = await supabase
    .from('collections')
    .insert({ name, slug: slug.toLowerCase().replace(/\s+/g, '-'), number: number || 1, active: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapCollection(data))
}

export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data, error } = await supabase
    .from('collections')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapCollection(data))
}

export async function DELETE(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase.from('collections').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
