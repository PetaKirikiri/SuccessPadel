import type { TeamLearningIdentity } from '../lib/spiritAnimals'

export function TeamLearningBadge({
  identity,
  side,
  variant = 'court',
}: {
  identity: TeamLearningIdentity
  side?: 'left' | 'right'
  variant?: 'court' | 'leaderboard'
}) {
  const sideClass = side ? ` team-learning-badge--${side}` : ''
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
