import { Crown, Users } from 'lucide-react'
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
    <div className="member-directory__setting">Hide profile
      <div className="member-directory__choices" role="group" aria-label={`Hide profile for ${member.display_name}`}>
        <button type="button" aria-pressed={!member.directory_hidden} onClick={() => void save({directory_hidden:false})}>Visible</button>
        <button type="button" aria-pressed={member.directory_hidden} onClick={() => void save({directory_hidden:true})}>Hidden</button>
      </div>
    </div>
    <span className="member-directory__save-status" role="status">{feedback}</span>
  </fieldset>
}

const genderTabs = ['All', 'Men', 'Women', 'Gender not set'] as const
const levelTabs = ['All', 'Beginner', 'Low Inter', 'Intermediate', 'Advanced', 'Open', 'Unrated'] as const


function MemberAvatar({ member }: { member: DirectoryMember }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (member.avatar_url && failedUrl !== member.avatar_url) {
    return <img src={member.avatar_url} alt="" loading="lazy" onError={() => setFailedUrl(member.avatar_url)} />
  }
  return <span className="member-directory__avatar" aria-hidden="true">{member.display_name[0]?.toUpperCase() ?? '?'}</span>
}

export function PublicMemberDirectory({ members, canEdit = false, onSave }: DirectoryProps) {
  const [genderFilter, setGenderFilter] = useState<string>('All')
  const [levelFilter, setLevelFilter] = useState<string>('All')
  const [lineFilter, setLineFilter] = useState('all')
  const [courtFilter, setCourtFilter] = useState('all')
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const genderMembers = members.filter(member => genderFilter === 'All' || memberGender(member.gender) === genderFilter)
  const entries = genderMembers.filter(member =>
    (levelFilter === 'All' || memberLevel(member).label === levelFilter) &&
    (lineFilter === 'all' || member.has_line_account === (lineFilter === 'linked')) &&
    (courtFilter === 'all' || (courtFilter === 'unset' ? member.court_member === null : member.court_member === (courtFilter === 'yes'))) &&
    (!canEdit || visibilityFilter === 'all' || member.directory_hidden === (visibilityFilter === 'hidden'))
  )
  const hasFilters = genderFilter !== 'All' || levelFilter !== 'All' || lineFilter !== 'all' || courtFilter !== 'all' || (canEdit && visibilityFilter !== 'all')
  function clearFilters() {
    setGenderFilter('All'); setLevelFilter('All'); setLineFilter('all'); setCourtFilter('all'); setVisibilityFilter('all')
  }
  return <section className="member-directory">
    <header className="member-directory__header">
      <Users aria-hidden="true" />
      <div><p>SUCCESS PADEL</p><h1>THE PLAYERS</h1></div>
      <span className="member-directory__count">{members.length}</span>
    </header>
    {canEdit ? <p className="member-directory__owner" role="status">Owner editing · changes save automatically</p> : null}
    <div className="member-directory__filters">
      <div className="member-directory__tabs" role="group" aria-label="Gender filter">
        {genderTabs.map(gender => <button key={gender} type="button" aria-pressed={genderFilter === gender} onClick={() => setGenderFilter(gender)}>{gender}<span>{gender === 'All' ? members.length : members.filter(member => memberGender(member.gender) === gender).length}</span></button>)}
      </div>
      <div className="member-directory__tabs member-directory__tabs--levels" role="group" aria-label="Level filter">
        {levelTabs.map(level => <button key={level} type="button" aria-pressed={levelFilter === level} onClick={() => setLevelFilter(level)}>{level}</button>)}
      </div>
      <div className="member-directory__filter-row">
        <label className="member-directory__filter">LINE
          <select value={lineFilter} onChange={event => setLineFilter(event.target.value)} aria-label="Filter by LINE account">
            <option value="all">All accounts</option><option value="linked">Linked</option><option value="unlinked">Not linked</option>
          </select>
        </label>
        <label className="member-directory__filter">Court member
          <select value={courtFilter} onChange={event => setCourtFilter(event.target.value)} aria-label="Filter by court membership">
            <option value="all">Everyone</option><option value="yes">Member</option><option value="no">Non-member</option><option value="unset">Not set</option>
          </select>
        </label>
        {canEdit ? <label className="member-directory__filter">Visibility
          <select value={visibilityFilter} onChange={event => setVisibilityFilter(event.target.value)} aria-label="Filter by visibility">
            <option value="all">All profiles</option><option value="visible">Visible</option><option value="hidden">Hidden</option>
          </select>
        </label> : null}
      </div>
      <div className="member-directory__results">
        <span role="status">{entries.length} of {members.length} players</span>
        {hasFilters ? <button type="button" onClick={clearFilters}>Clear filters</button> : null}
      </div>
    </div>
    <p className="member-directory__legend">Estimated = past competition categories, not a skill assessment.</p>
    <section className="member-directory__section" aria-label="Filtered players">
      {entries.length === 0 ? <p className="member-directory__empty">No players match these filters.</p> : null}
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
                <small className="member-directory__line-status" title="Whether this player has linked LINE to Success Padel">{member.has_line_account ? 'LINE linked' : 'LINE not linked'}</small>
                {canEdit && member.directory_hidden ? <small className="member-directory__line-status">Hidden profile</small> : null}
              </span>
            </Link>
            {canEdit && onSave ? <MemberControls member={member} onSave={onSave} /> : null}
          </li>
        })}</ul>
      </section>
  </section>
}
