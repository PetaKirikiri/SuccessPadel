import { AppTopBar } from '../components/AppTopBar'
import { CompetitionTable } from '../components/CompetitionTable'
import { useCompetitionSetup } from '../hooks/useCompetitionSetup'

export function CompetitionSetup() {
  const { rows, loading, error, refresh } = useCompetitionSetup()

  return (
    <div className="game-bg flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <AppTopBar className="py-3">
        <img
          src="/brand/logo-padel.webp"
          alt="Success Padel"
          className="h-8 w-auto max-w-[10rem]"
        />
      </AppTopBar>

      <main data-scroll-y className="scroll-y min-h-0 min-w-0 flex-1 px-3 pb-6 pt-1">
        <div className="mx-auto w-full max-w-full space-y-3">
          <p className="text-center font-display text-lg font-semibold text-brand-primary">
            Set up competition
          </p>
          <CompetitionTable
            rows={rows}
            loading={loading}
            error={error}
            isAdmin
            onRefresh={refresh}
          />
        </div>
      </main>
    </div>
  )
}
