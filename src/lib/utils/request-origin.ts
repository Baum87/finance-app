import { headers } from 'next/headers'

/** Origin van het huidige request — voor redirect-URL's in auth-e-mails. */
export async function getRequestOrigin() {
  const h = await headers()
  const origin = h.get('origin')
  if (origin) return origin
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${h.get('host')}`
}
