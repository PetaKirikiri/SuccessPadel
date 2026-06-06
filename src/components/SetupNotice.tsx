const hasSupabase =
  Boolean(import.meta.env.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)

export function SetupNotice() {
  if (hasSupabase) return null

  return (
    <div className="max-w-full border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm break-words text-amber-900">
      <p className="font-medium">Supabase not configured</p>
      <p className="mt-1 text-xs text-amber-800">
        Copy <code className="text-amber-900">.env.example</code> to{' '}
        <code className="text-amber-900">.env.local</code> and set your project URL and anon key.
      </p>
    </div>
  )
}
