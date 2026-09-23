import { supabase } from '../../lib/supabaseClient'
export const streamingEnabled = Boolean(import.meta.env.VITE_STREAMING_API_URL)
export type StreamStatus = { id: string; state: 'preparing' | 'connecting' | 'live' | 'stopping' | 'complete' | 'failed'; title: string; live_at: string | null; error: string | null; videoUrl: string | null }
export type StreamMatch = { session_id: string; round_id: string; court_id: string; court_name: string; round_number: number; event_name: string; starts_at: string; ends_at: string; status: string; teams: { a: string[]; b: string[] } }
export async function streamingApi<T>(path: string, data?: unknown): Promise<T> {
  const { data: auth } = await supabase.auth.getSession()
  if (!auth.session) throw new Error('Tap Sign In to sign in to Success Padel first.')
  const response = await fetch(`${import.meta.env.VITE_STREAMING_API_URL}${path}`, {
    method: data === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${auth.session.access_token}`, 'Content-Type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Streaming service unavailable')
  return result as T
}
