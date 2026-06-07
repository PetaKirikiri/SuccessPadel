import { useParams } from 'react-router-dom'
import { CompetitionPlay } from './CompetitionPlay'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function BadLink() {
  return (
    <div className="game-bg flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-center px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <img
          src="/brand/logo-padel.webp"
          alt="Success Padel"
          className="h-8 w-auto max-w-[10rem]"
        />
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center px-6">
        <p className="text-center text-sm text-brand-muted">This link doesn&apos;t work. Check the message you were sent.</p>
      </main>
    </div>
  )
}

export function CompetitionPublicGate() {
  const { id } = useParams()
  if (!id || !UUID_RE.test(id)) return <BadLink />
  return <CompetitionPlay />
}
