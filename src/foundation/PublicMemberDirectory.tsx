import { countryLabel } from '../lib/countries'
import { useLocation } from 'react-router-dom'
import { Crown, Users, Mars, Venus, House, Plane, Eye, EyeOff, KeyRound, CircleHelp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { MEMBER_SKILL_LEVELS, memberGender, memberLevel, type DirectoryPatch, type DirectoryMember } from '../lib/memberDirectory'
import { MemberDirectoryControls, MembershipIcon } from './MemberDirectoryControls'
import { playerProfilePath } from '../lib/playerProfileSlug'

type DirectoryProps = {
  members: DirectoryMember[]
  canEdit?: boolean
  onSave?: (id: string, patch: DirectoryPatch) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onUploadPhoto?: (id: string, file: File) => Promise<string>
}

const genderTabs = ['All', 'Men', 'Women', 'Gender not set'] as const
const levelTabs = ['All', ...MEMBER_SKILL_LEVELS] as const


function FilterButtons({ label, value, onChange, options, count, icons, toggle = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  icons?: Record<string, ReactNode>
  count: (value: string) => number
  options: string[][]
  toggle?: boolean
}) {
  return <div className="member-directory__filter-buttons" role="group" aria-label={label}>
    {options.map(([key, text]) => <button key={key} type="button" data-filter={key} aria-label={`${text}: ${count(key)} players`} title={text} aria-pressed={value === key}
      onClick={() => onChange(toggle && value === key ? 'all' : key)}>{icons?.[key] ?? <span>{text}</span>}<span className="member-directory__filter-count">{count(key)}</span></button>)}
  </div>
}

function MemberAvatar({ member }: { member: DirectoryMember }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (member.avatar_url && failedUrl !== member.avatar_url) {
    return <img src={member.avatar_url} alt="" loading="lazy" onError={() => setFailedUrl(member.avatar_url)} />
  }
  return <span className="member-directory__avatar" aria-hidden="true">{member.display_name[0]?.toUpperCase() ?? '?'}</span>
}

export function MemberDirectoryCard({ member, canEdit = false, onSave, onUploadPhoto, onDelete }: Omit<DirectoryProps, 'members'> & { member: DirectoryMember }) {
  const level = memberLevel(member)
  return <>
            {!canEdit ? <Link className="member-directory__profile" to={playerProfilePath({ id: member.id, displayName: member.display_name })}>
              <MemberAvatar member={member} />
              <span className="member-directory__identity"><strong>{member.display_name}</strong>
                <span className="member-directory__level" data-level={level.label} title={level.detail}>
                  {level.label === 'Advanced' ? <Crown aria-hidden="true" /> : null}{level.label}
                  {level.source ? <small>{level.source}</small> : null}
                </span>
                {member.country || member.residency_status ? <small className="member-directory__line-status">{[countryLabel(member.country), member.residency_status === 'local' ? 'Local / resident' : member.residency_status === 'holiday' ? 'On holiday' : null].filter(Boolean).join(' · ')}</small> : null}
                {!canEdit ? <small className="member-directory__line-status" title="Whether this player has linked LINE to Success Padel">{member.has_line_account ? 'Court login linked' : 'No court login'}</small> : null}
                {canEdit && member.directory_hidden ? <small className="member-directory__line-status">Hidden profile</small> : null}
              </span>
            </Link> : null}
            {canEdit && onSave ? <MemberDirectoryControls member={member} onSave={onSave} onUploadPhoto={onUploadPhoto} onDelete={onDelete} /> : null}
  </>
}

export function PublicMemberDirectory({ members, canEdit = false, onSave, onUploadPhoto, onDelete }: DirectoryProps) {
  const location = useLocation()
  const [residencyFilter,setResidencyFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState<string>('All')
  const [levelFilter, setLevelFilter] = useState<string>('All')
  const [lineFilter, setLineFilter] = useState('all')
  const [courtFilter, setCourtFilter] = useState('all')
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const filters = { gender: genderFilter, level: levelFilter, residency: residencyFilter, login: lineFilter, membership: courtFilter, visibility: visibilityFilter }
  function matchingMembers(active: typeof filters) {
    return members.filter(member =>
      (active.gender === 'All' || memberGender(member.gender) === active.gender) &&
      (active.residency === 'all' || (member.residency_status ?? 'unset') === active.residency) &&
      (active.level === 'All' || memberLevel(member).label === active.level) &&
      (active.login === 'all' || member.has_line_account === (active.login === 'linked')) &&
      (active.membership === 'all' || (member.court_member === true) === (active.membership === 'yes')) &&
      (!canEdit || active.visibility === 'all' || member.directory_hidden === (active.visibility === 'hidden'))
    )
  }
  const entries = matchingMembers(filters)
  const filterCount = (group: keyof typeof filters) => (value: string) => matchingMembers({ ...filters, [group]: value }).length
  const hasFilters = residencyFilter !== 'all' || genderFilter !== 'All' || levelFilter !== 'All' || lineFilter !== 'all' || courtFilter !== 'all' || (canEdit && visibilityFilter !== 'all')
  function clearFilters() {
    setResidencyFilter('all'); setGenderFilter('All'); setLevelFilter('All'); setLineFilter('all'); setCourtFilter('all'); setVisibilityFilter('all')
  }
  return <section className="member-directory">
    <nav className="member-directory__navigation" aria-label="Players and rankings"><span aria-current="page">Players</span><Link to={`/rankings${location.hash}`}>Rankings</Link></nav>
    <header className="member-directory__header">
      <Users aria-hidden="true" />
      <div><p>SUCCESS PADEL</p><h1>THE PLAYERS</h1></div>
      <span className="member-directory__count">{members.length}</span>
    </header>
    {canEdit ? <p className="member-directory__owner" role="status">Owner editing</p> : null}
    <div className="member-directory__filters">
      <div className="member-directory__toolbar">
        <FilterButtons count={filterCount('gender')} label="Gender" icons={{ All: <Users aria-hidden="true" />, Men: <Mars aria-hidden="true" />, Women: <Venus aria-hidden="true" />, 'Gender not set': <CircleHelp aria-hidden="true" /> }} value={genderFilter} onChange={setGenderFilter} options={genderTabs.map(value => [value, value === 'Gender not set' ? 'Not set' : value])} />
        <FilterButtons count={filterCount('level')} label="Level" value={levelFilter} onChange={setLevelFilter} options={levelTabs.map(value => [value, value === 'All' ? 'All levels' : value])} />
        <FilterButtons count={filterCount('residency')} label="Residency" icons={{ local: <House aria-hidden="true" />, holiday: <Plane aria-hidden="true" />, unset: <CircleHelp aria-hidden="true" /> }} value={residencyFilter} onChange={setResidencyFilter} toggle options={[["local", "Home"], ["holiday", "Holiday"], ["unset", "Not set"]]} />
        <FilterButtons count={filterCount('membership')} label="Court membership" icons={{ yes: <MembershipIcon member />, no: <MembershipIcon member={false} /> }} value={courtFilter} onChange={setCourtFilter} toggle options={[["yes", "Member"], ["no", "Non-member"]]} />
        <FilterButtons count={filterCount('login')} label="Court login" icons={{ linked: <KeyRound aria-hidden="true" />, unlinked: <KeyRound aria-hidden="true" /> }} value={lineFilter} onChange={setLineFilter} toggle options={[["linked", "Court login"], ["unlinked", "No login"]]} />
        {canEdit ? <FilterButtons count={filterCount('visibility')} label="Visibility" icons={{ visible: <Eye aria-hidden="true" />, hidden: <EyeOff aria-hidden="true" /> }} value={visibilityFilter} onChange={setVisibilityFilter} toggle options={[["visible", "Visible"], ["hidden", "Hidden"]]} /> : null}
      </div>
      <div className="member-directory__results">
        <span role="status">{entries.length} of {members.length} players</span>
        {hasFilters ? <button type="button" onClick={clearFilters}>Clear filters</button> : null}
      </div>
    </div>

    <section className="member-directory__section" aria-label="Filtered players">
      {entries.length === 0 ? <div className="member-directory__empty"><p>No players match these filters.</p><button type="button" onClick={clearFilters}>Show all players</button></div> : null}
        <ul className="member-directory__grid">{entries.map(member => {
          return <li className="member-directory__card" data-editable={canEdit} key={member.id}>
            <MemberDirectoryCard member={member} canEdit={canEdit} onSave={onSave} onUploadPhoto={onUploadPhoto} onDelete={onDelete} />
          </li>
        })}</ul>
      </section>
  </section>
}
