import { COUNTRY_OPTIONS, countryOptionFromValue } from '../lib/countries'
import { MemberContactControls } from './MemberContactControls'
import { Camera, Check, Eye, EyeOff, KeyRound, Trash2, X, Mars, Venus, House, Plane } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MEMBER_SKILL_LEVELS, memberLevel, type DirectoryMember, type DirectoryPatch } from '../lib/memberDirectory'

type Props = {
  member: DirectoryMember
  onSave: (id: string, patch: DirectoryPatch) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onUploadPhoto?: (id: string, file: File) => Promise<string>
}
const levels = MEMBER_SKILL_LEVELS
export function MemberDirectoryControls({ member, onSave, onUploadPhoto, onDelete }: Props) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null)
  const [levelDraft,setLevelDraft]=useState<number | null>(null)
  const savedLevel = levels.indexOf(memberLevel(member).label)
  const levelValue = levelDraft ?? savedLevel
  async function commitLevel(value: number) {
    if(levels[value] && levels[value] !== member.skill_level) await save({skill_level:levels[value]})
    setLevelDraft(null)
  }
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [feedback, setFeedback] = useState('')
  const [failed, setFailed] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(member.display_name)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const uploadedPhoto = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!photo) { setPreview(null); return }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])
  function startEditing() {
    if (editing) return
    setName(member.display_name); setPhoto(null); setRemovePhoto(false)
    uploadedPhoto.current = null; setFeedback(''); setFailed(false); setEditing(true)
  }
  async function save(patch: DirectoryPatch, identity = false) {
    if (saving.current) return
    saving.current = true; setBusy(true); setFailed(false); setFeedback('Saving…')
    try {
      if (identity && photo && onUploadPhoto) {
        uploadedPhoto.current ??= await onUploadPhoto(member.id, photo)
        patch.avatar_url = uploadedPhoto.current
      }
      await onSave(member.id, patch)
      setFeedback('Saved')
      if (identity) { setEditing(false); setPhoto(null) }
    } catch (error) {
      setFailed(true); setFeedback(error instanceof Error ? error.message : 'Could not save. Try again.')
    } finally { saving.current = false; setBusy(false) }
  }
  async function deletePlayer() {
    if (!onDelete || saving.current) return
    saving.current = true; setBusy(true); setFailed(false); setFeedback('')
    try { await onDelete(member.id) }
    catch (error) { setFailed(true); setFeedback(error instanceof Error ? error.message : 'Could not delete player. Try again.') }
    finally { saving.current = false; setBusy(false) }
  }
  function choosePhoto(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setFailed(true); setFeedback('Choose a JPG, PNG or WebP up to 5 MB.'); return
    }
    setPhoto(file); setRemovePhoto(false); uploadedPhoto.current = null; setFeedback(''); setFailed(false)
  }
  const currentPhoto = removePhoto ? null : preview ?? member.avatar_url
  return <fieldset className="member-directory__controls" disabled={busy} aria-label={`Settings for ${member.display_name}`}>
    <legend>Player settings</legend>
    <div className="member-directory__card-heading">
    <div className="member-directory__compact-identity">
      <button className="member-directory__avatar-edit" type="button" aria-label={`Edit photo for ${member.display_name}`} title="Edit photo" onClick={() => { startEditing(); fileInput.current?.click() }} aria-expanded={editing}>
        {member.avatar_url && failedAvatar !== member.avatar_url ? <img src={member.avatar_url} alt="" loading="lazy" onError={() => setFailedAvatar(member.avatar_url)} /> : <span className="member-directory__avatar">{member.display_name[0]?.toUpperCase() || '?'}</span>}
      </button>
      <button className="member-directory__name-edit" type="button" onClick={startEditing} aria-label={`Edit name for ${member.display_name}`} title="Edit name" aria-expanded={editing}><strong>{member.display_name}</strong></button>
    </div>
      <div className="member-directory__setting member-directory__level-slider"><span>Level</span>
        <input type="range" min="0" max={levels.length - 1} step="1" value={levelValue} aria-label={`Level for ${member.display_name}`} aria-valuetext={levels[levelValue]} onChange={e=>setLevelDraft(Number(e.target.value))} onPointerUp={e=>void commitLevel(Number(e.currentTarget.value))} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))void commitLevel(Number(e.currentTarget.value))}} onBlur={e=>{if(levelDraft!==null)void commitLevel(Number(e.currentTarget.value))}} />
        <div className="member-directory__milestones" role="group" aria-label={`Skill milestones for ${member.display_name}`}>
          {levels.map((level,index) => <button key={level} type="button" aria-label={`Set ${member.display_name} to ${level}`} title={level} aria-pressed={levelValue === index} onClick={() => void commitLevel(index)}><span className="member-directory__milestone-full">{level}</span><span className="member-directory__milestone-short" aria-hidden="true">{['Beg', 'Low Int', 'Inter', 'Adv'][index]}</span></button>)}
        </div>
      </div>
    </div>
    <input ref={fileInput} className="member-directory__file" type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Choose photo for ${member.display_name}`} onChange={event => { choosePhoto(event.target.files?.[0]); event.target.value = '' }} />
    {editing ? <div className="member-directory__editor">
      <div className="member-directory__photo-preview">
        {currentPhoto ? <img src={currentPhoto} alt="Photo preview" /> : <span className="member-directory__avatar">{name[0]?.toUpperCase() || '?'}</span>}
        <div className="member-directory__photo-actions">
          {onUploadPhoto ? <button type="button" onClick={() => fileInput.current?.click()}><Camera aria-hidden="true" />Choose photo</button> : null}
          {currentPhoto ? <button type="button" onClick={() => { setRemovePhoto(true); setPhoto(null); uploadedPhoto.current = null }}>Remove photo</button> : null}
        </div>
      </div>
      <label className="member-directory__setting">Name
        <input value={name} maxLength={100} aria-label={`Name for ${member.display_name}`} onChange={e => setName(e.target.value)} />
      </label>
      <div className="member-directory__edit-actions">
        <button className="member-directory__save" type="button" disabled={!name.trim()} onClick={() => void save({ display_name: name.trim(), ...(removePhoto ? { avatar_url: null } : {}) }, true)}><Check aria-hidden="true" />Save</button>
        <button type="button" onClick={() => { setEditing(false); setPhoto(null); setFeedback('') }}><X aria-hidden="true" />Cancel</button>
      </div>
    </div> : null}
    <div className="member-directory__card-toolbar">
      <div className="member-directory__quick-fields">
        <div className="member-directory__quick-field"><span>Gender</span>
          <div className="member-directory__icon-toggle" role="group" aria-label={`Gender for ${member.display_name}`}>
            <button type="button" aria-label="Male" title="Male" aria-pressed={member.gender === 'Male'} onClick={() => void save({gender:member.gender === 'Male' ? null : 'Male'})}><Mars aria-hidden="true" /></button>
            <button type="button" aria-label="Female" title="Female" aria-pressed={member.gender === 'Female'} onClick={() => void save({gender:member.gender === 'Female' ? null : 'Female'})}><Venus aria-hidden="true" /></button>
          </div>
        </div>
        <div className="member-directory__quick-field"><span>Member</span>
          <div className="member-directory__icon-toggle" role="group" aria-label={`Court membership for ${member.display_name}`}>
            <button type="button" aria-label="Court member" title="Court member" aria-pressed={member.court_member === true} onClick={() => void save({court_member:true})}><MembershipIcon member /></button>
            <button type="button" aria-label="Not a court member" title="Not a court member" aria-pressed={member.court_member !== true} onClick={() => void save({court_member:false})}><MembershipIcon member={false} /></button>
          </div>
        </div>
        <label className="member-directory__quick-field"><span>Country</span>
          <span className="member-directory__flag-select"><span aria-hidden="true">{countryOptionFromValue(member.country)?.flag ?? '🌐'}</span>
            <select aria-label={`Country for ${member.display_name}`} title={countryOptionFromValue(member.country)?.name ?? 'Choose country'} value={countryOptionFromValue(member.country)?.code ?? member.country ?? ''} onChange={e=>void save({country:e.target.value || null})}>
              <option value="">Not set</option>
              {member.country && !countryOptionFromValue(member.country) ? <option value={member.country}>{member.country}</option> : null}
              {COUNTRY_OPTIONS.map(country=><option key={country.code} value={country.code}>{country.label}</option>)}
            </select>
          </span>
        </label>
        <div className="member-directory__quick-field"><span>Stay</span>
          <div className="member-directory__icon-toggle" role="group" aria-label={`Residency for ${member.display_name}`}>
            <button type="button" aria-label="Local / resident" title="Local / resident" aria-pressed={member.residency_status === 'local'} onClick={() => void save({residency_status:member.residency_status === 'local' ? null : 'local'})}><House aria-hidden="true" /></button>
            <button type="button" aria-label="On holiday" title="On holiday" aria-pressed={member.residency_status === 'holiday'} onClick={() => void save({residency_status:member.residency_status === 'holiday' ? null : 'holiday'})}><Plane aria-hidden="true" /></button>
          </div>
        </div>
      </div>
    <MemberContactControls member={member} onSave={onSave} showEditAction={editing}>
      <button className="member-directory__visibility-icon" type="button" title={member.directory_hidden ? 'Hidden from directory' : 'Visible in directory'} aria-label={`Hide ${member.display_name} from directory`} aria-pressed={member.directory_hidden} onClick={() => void save({ directory_hidden: !member.directory_hidden })}>
        {member.directory_hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
      <span className="member-directory__login-icon" data-linked={member.has_line_account} role="img" aria-label={member.has_line_account ? 'Court login linked' : 'No court login'} title={member.has_line_account ? 'Court login linked' : 'No court login'}><KeyRound aria-hidden="true" /></span>
      {onDelete ? <button ref={deleteButton} className="member-directory__delete" type="button" aria-label={`Delete ${member.display_name}`} title="Delete player" aria-expanded={confirmDelete} onClick={() => { setConfirmDelete(true); setFeedback('') }}><Trash2 aria-hidden="true" /></button> : null}
    </MemberContactControls>
    </div>
    {confirmDelete ? <div className="member-directory__delete-confirm" role="group" aria-label={`Confirm deletion of ${member.display_name}`}>
      <span>Delete {member.display_name}?</span>
      <button className="member-directory__delete-confirm-action" type="button" onClick={() => void deletePlayer()}>{busy ? 'Deleting…' : 'Delete'}</button>
      <button type="button" onClick={() => { setConfirmDelete(false); setFeedback(''); deleteButton.current?.focus() }}>Cancel</button>
    </div> : null}
    {feedback ? <span className="member-directory__save-status" data-error={failed} role="status">{feedback}</span> : null}
  </fieldset>
}

export function MembershipIcon({ member }: { member: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M2 8h20M6 12h3M6 16h2" />
    <path d={member ? 'M13 15l2 2 4-5' : 'M14 12l5 5m0-5-5 5'} />
  </svg>
}
