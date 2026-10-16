import { Crown, Users, Venus, Mars, CircleHelp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { memberGender, memberLevel, type DirectoryPatch, type DirectoryMember } from '../lib/memberDirectory'
import { playerProfilePath } from '../lib/playerProfileSlug'

type DirectoryProps = {
  members: DirectoryMember[]
  canEdit?: boolean
  onSave?: (id: string, patch: DirectoryPatch) => Promise<void>
}

function MemberControls({ member, onSave }: { member: DirectoryMember; onSave: NonNullable<DirectoryProps['onSave']> }) {
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  async function save(patch: DirectoryPatch) {
    setBusy(true)
    setFeedback('Saving…')
    try { await onSave(member.id, patch); setFeedback('Saved') }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Could not save. Try again.') }
    finally { setBusy(false) }
  }
  return <fieldset className="member-directory__controls" disabled={busy} aria-label={`Settings for ${member.display_name}`}>
    <legend>Player settings</legend>
    <label className="member-directory__setting">Level
      <select aria-label={`Level for ${member.display_name}`} value={member.skill_level ?? ''} onChange={e => void save({ skill_level: e.target.value || null })}>
        <option value="">Not set</option>
        {['Beginner','Low Inter','Intermediate','Advanced','Open'].map(level => <option key={level}>{level}</option>)}
      </select>
    </label>
    <div className="member-directory__setting">Gender
      <div className="member-directory__choices" role="group" aria-label={`Gender for ${member.display_name}`}>
        {[[null,'Unset'],['Female','Woman'],['Male','Man']].map(([value,label]) => <button key={label} type="button" aria-pressed={member.gender === value} onClick={() => void save({gender:value})}>{label}</button>)}
      </div>
    </div>
    <div className="member-directory__setting">Court member
      <div className="member-directory__choices" role="group" aria-label={`Court member for ${member.display_name}`}>
        {([{value:null,label:'Unset'},{value:true,label:'Yes'},{value:false,label:'No'}] as const).map(({value,label}) => <button key={label} type="button" aria-pressed={member.court_member === value} onClick={() => void save({court_member:value})}>{label}</button>)}
      </div>
    </div>
    <span className="member-directory__save-status" role="status">{feedback}</span>
  </fieldset>
}

const groups = [{ name: 'Women', Icon: Venus }, { name: 'Men', Icon: Mars }, { name: 'Gender not set', Icon: CircleHelp }] as const

function MemberAvatar({ member }: { member: DirectoryMember }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (member.avatar_url && failedUrl !== member.avatar_url) {
    return <img src={member.avatar_url} alt="" loading="lazy" onError={() => setFailedUrl(member.avatar_url)} />
  }
  return <span className="member-directory__avatar" aria-hidden="true">{member.display_name[0]?.toUpperCase() ?? '?'}</span>
}

export function PublicMemberDirectory({ members, canEdit = false, onSave }: DirectoryProps) {
  return <section className="member-directory">
    <header className="member-directory__header">
      <Users aria-hidden="true" />
      <div><p>SUCCESS PADEL</p><h1>THE PLAYERS</h1></div>
      <span className="member-directory__count">{members.length}</span>
    </header>
    {canEdit ? <p className="member-directory__owner" role="status">Owner editing · changes save automatically</p> : null}
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
            {canEdit && onSave ? <MemberControls member={member} onSave={onSave} /> : null}
          </li>
        })}</ul>
      </section>
    })}
  </section>
}
