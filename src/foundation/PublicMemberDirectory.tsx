import { Crown, Users, Venus, Mars, CircleHelp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { memberGender, memberLevel, type DirectoryMember } from '../lib/memberDirectory'
import { playerProfilePath } from '../lib/playerProfileSlug'

const groups = [{ name: 'Women', Icon: Venus }, { name: 'Men', Icon: Mars }, { name: 'Gender not set', Icon: CircleHelp }] as const

function MemberAvatar({ member }: { member: DirectoryMember }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (member.avatar_url && failedUrl !== member.avatar_url) {
    return <img src={member.avatar_url} alt="" loading="lazy" onError={() => setFailedUrl(member.avatar_url)} />
  }
  return <span className="member-directory__avatar" aria-hidden="true">{member.display_name[0]?.toUpperCase() ?? '?'}</span>
}

export function PublicMemberDirectory({ members }: { members: DirectoryMember[] }) {
  return <section className="member-directory">
    <header className="member-directory__header">
      <Users aria-hidden="true" />
      <div><p>SUCCESS PADEL</p><h1>THE PLAYERS</h1></div>
      <span className="member-directory__count">{members.length}</span>
    </header>
    <p className="member-directory__legend">Estimated = past competition categories, not a skill assessment.</p>
    {groups.map(({ name, Icon }) => {
      const entries = members.filter(member => memberGender(member.gender) === name)
      if (!entries.length) return null
      return <section className="member-directory__section" key={name} aria-label={name}>
        <h2><Icon aria-hidden="true" />{name}<span>{entries.length}</span></h2>
        <ul className="member-directory__grid">{entries.map(member => {
          const level = memberLevel(member)
          return <li className="member-directory__card" key={member.id}>
            <Link to={playerProfilePath({ id: member.id, displayName: member.display_name })}>
              <MemberAvatar member={member} />
              <span className="member-directory__identity"><strong>{member.display_name}</strong>
                <span className="member-directory__level" data-level={level.label} title={level.detail}>
                  {level.label === 'Advanced' ? <Crown aria-hidden="true" /> : null}{level.label}
                  {level.source ? <small>{level.source}</small> : null}
                </span>
              </span>
            </Link>
          </li>
        })}</ul>
      </section>
    })}
  </section>
}
