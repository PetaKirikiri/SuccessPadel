import type { TeamLearningIdentity } from '../lib/spiritAnimals'
import './TeamLearningBadge.css'

export function TeamLearningBadge({
  identity,
  side,
  variant = 'court',
}: {
  identity: TeamLearningIdentity
  side?: 'left' | 'right'
  variant?: 'court' | 'leaderboard' | 'player'
}) {
  const sideClass = side ? ` team-learning-badge--${side}` : ''
  if (variant === 'player') {
    return (
      <figure className="player-learning-badge">
        <img className="player-learning-badge__image" src={identity.imageUrl} alt={identity.english} draggable={false} />
        <figcaption className="player-learning-badge__copy">
          <span className="player-learning-badge__thai" lang="th">{identity.thai}</span>
          <span className="player-learning-badge__phonetic">{identity.phonetic}</span>
          <span className="player-learning-badge__english">{identity.english}</span>
        </figcaption>
      </figure>
    )
  }
  return (
    <figure className={`team-learning-badge team-learning-badge--${variant}${sideClass}`}>
      <img className="team-learning-badge__image" src={identity.imageUrl} alt={identity.english} draggable={false} />
      <figcaption className="team-learning-badge__copy">
        <span className="team-learning-badge__thai" lang="th">{identity.thai}</span>
        <span className="team-learning-badge__phonetic">{identity.phonetic}</span>
        <span className="team-learning-badge__english">{identity.english}</span>
      </figcaption>
    </figure>
  )
}
