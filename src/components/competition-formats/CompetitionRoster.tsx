import type { CompetitionRosterProps } from './rosterContract'
import { SinglesRoster } from './singles/SinglesRoster'
import { DuosRoster } from './duos/DuosRoster'

/** Shared routing boundary. Format-owned presenters never choose another format. */
export function CompetitionRoster(props: CompetitionRosterProps) {
  switch (props.format) {
    case 'singles': return <SinglesRoster {...props} />
    case 'duos': return <DuosRoster {...props} />
    default: {
      const unsupported: never = props
      throw new Error(`Unsupported competition roster: ${String(unsupported)}`)
    }
  }
}
