const BUCKET = 'avatar-os-assets'

/**
 * Sube un buffer binario a Supabase Storage vía REST directo con la
 * service-role key.
 *
 * NO usar `supabase.storage.from(BUCKET).upload()` del SDK para binarios:
 * en este runtime (Vercel/Node serverless) corrompe archivos pequeños
 * (~<100KB) — cada byte no-ASCII sale reemplazado por U+FFFD, señal clásica
 * de un buffer pasado por una re-codificación UTF-8 en algún punto interno
 * del SDK. Un POST REST crudo con el Buffer como body no tiene ese problema
 * (verificado: mismo buffer, mismo bucket, éxito consistente).
 */
export async function uploadBinary(path: string, buffer: Buffer, contentType: string): Promise<{ publicUrl: string } | { error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: new Uint8Array(buffer),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { error: text }
  }

  return { publicUrl: `${url}/storage/v1/object/public/${BUCKET}/${path}` }
}
