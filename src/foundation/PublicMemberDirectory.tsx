import { countryLabel } from '../lib/countries'
import { useLocation } from 'react-router-dom'
import { Crown, Search, SlidersHorizontal, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { MEMBER_SKILL_LEVELS, memberGender, memberLevel, type DirectoryPatch, type DirectoryMember } from '../lib/memberDirectory'
import { MemberDirectoryControls } from './MemberDirectoryControls'
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
  const [search, setSearch] = useState('')
  const [moreFilters, setMoreFilters] = useState(false)
  const [genderFilter, setGenderFilter] = useState<string>('All')
  const [levelFilter, setLevelFilter] = useState<string>('All')
  const [lineFilter, setLineFilter] = useState('all')
  const [courtFilter, setCourtFilter] = useState('all')
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const genderMembers = members.filter(member => genderFilter === 'All' || memberGender(member.gender) === genderFilter)
  const entries = genderMembers.filter(member =>
    member.display_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) &&
    (residencyFilter === 'all' || (member.residency_status ?? 'unset') === residencyFilter) &&
    (levelFilter === 'All' || memberLevel(member).label === levelFilter) &&
    (lineFilter === 'all' || member.has_line_account === (lineFilter === 'linked')) &&
    (courtFilter === 'all' || (courtFilter === 'unset' ? member.court_member === null : member.court_member === (courtFilter === 'yes'))) &&
    (!canEdit || visibilityFilter === 'all' || member.directory_hidden === (visibilityFilter === 'hidden'))
  )
  const extraFilterCount = Number(residencyFilter !== 'all') + Number(lineFilter !== 'all') + Number(courtFilter !== 'all') + Number(canEdit && visibilityFilter !== 'all')
  const hasFilters = residencyFilter !== 'all' || search.trim() !== '' || genderFilter !== 'All' || levelFilter !== 'All' || lineFilter !== 'all' || courtFilter !== 'all' || (canEdit && visibilityFilter !== 'all')
  function clearFilters() {
    setResidencyFilter('all'); setSearch(''); setGenderFilter('All'); setLevelFilter('All'); setLineFilter('all'); setCourtFilter('all'); setVisibilityFilter('all')
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
        <label className="member-directory__search"><Search aria-hidden="true" /><input type="search" placeholder="Search players" aria-label="Search players" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <select aria-label="Filter by gender" value={genderFilter} onChange={e => setGenderFilter(e.target.value)}>{genderTabs.map(value => <option key={value} value={value}>{value === 'All' ? 'All genders' : value}</option>)}</select>
        <select aria-label="Filter by level" value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>{levelTabs.map(value => <option key={value} value={value}>{value === 'All' ? 'All levels' : value}</option>)}</select>
        <button type="button" aria-expanded={moreFilters} aria-controls="member-extra-filters" onClick={() => setMoreFilters(!moreFilters)}><SlidersHorizontal aria-hidden="true" />Filters{extraFilterCount ? ` (${extraFilterCount})` : ''}</button>
      </div>
      {moreFilters ? <div className="member-directory__filter-row" id="member-extra-filters">

        <label className="member-directory__filter">Based here<select aria-label="Filter by residency" value={residencyFilter} onChange={e=>setResidencyFilter(e.target.value)}><option value="all">Everyone</option><option value="local">Local / resident</option><option value="holiday">On holiday</option><option value="unset">Not set</option></select></label>
        <label className="member-directory__filter">Court login
          <select value={lineFilter} onChange={event => setLineFilter(event.target.value)} aria-label="Filter by court login">
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
      </div> : null}
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
