import { Check, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { DirectoryMember, DirectoryPatch } from '../lib/memberDirectory'
import { normalizeLineContact, normalizeWhatsApp, whatsAppContactUrl } from '../lib/memberContacts'

type Props = { showEditAction?: boolean; children?: ReactNode; member: DirectoryMember; onSave: (id: string, patch: DirectoryPatch) => Promise<void> }
export function MemberContactControls({member,onSave,children,showEditAction = false}: Props) {
  const [editing,setEditing]=useState(false)
  const [line,setLine]=useState('')
  const [whatsapp,setWhatsapp]=useState('')
  const [busy,setBusy]=useState(false)
  const [feedback,setFeedback]=useState('')
  const [failed,setFailed]=useState(false)
  const ready=member.contacts_loaded === true
  const whatsappUrl=whatsAppContactUrl(member.whatsapp_number)
  function edit() {
    setLine(member.line_contact_url ?? '');setWhatsapp(member.whatsapp_number ? `+${member.whatsapp_number}` : '')
    setFeedback('');setEditing(true)
  }
  async function save() {
    if(busy)return
    setBusy(true);setFailed(false);setFeedback('Saving…')
    try {
      await onSave(member.id,{line_contact_url:normalizeLineContact(line),whatsapp_number:normalizeWhatsApp(whatsapp)})
      setEditing(false);setFeedback('Contacts saved')
    } catch(error) {setFailed(true);setFeedback(error instanceof Error ? error.message : 'Could not save contacts.')}
    finally {setBusy(false)}
  }
  return <div className="member-directory__contacts">
    <div className="member-directory__contact-buttons">
      {ready && member.line_contact_url ? <a className="member-directory__contact-link" href={member.line_contact_url} target="_blank" rel="noopener noreferrer" aria-label={`Open LINE contact for ${member.display_name}`}><img src="/brand/line-logo.png" alt="" /></a>
        : <button type="button" disabled={!ready || busy} onClick={edit} aria-label={`Add LINE contact for ${member.display_name}`}><img src="/brand/line-logo.png" alt="" /></button>}
      {ready && whatsappUrl ? <a className="member-directory__contact-link" href={whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open WhatsApp contact for ${member.display_name}`}><img src="/brand/whatsapp-logo.svg" alt="" /></a>
        : <button type="button" disabled={!ready || busy} onClick={edit} aria-label={`Add WhatsApp contact for ${member.display_name}`}><img src="/brand/whatsapp-logo.svg" alt="" /></button>}
      <span className="member-directory__status-icons">{children}</span>
    </div>
    {showEditAction ? <button className="member-directory__contact-edit" type="button" disabled={!ready || busy} onClick={edit} aria-label={`Edit contact details for ${member.display_name}`}>Edit contacts</button> : null}
    {!ready ? <span className="member-directory__save-status" data-error="true">Contacts unavailable — refresh to retry.</span> : null}
    {editing ? <fieldset className="member-directory__contact-editor" disabled={busy}>
      <legend>Contact details</legend>
      <label className="member-directory__setting">LINE profile link<input type="url" value={line} placeholder="https://line.me/ti/p/…" aria-label={`LINE profile link for ${member.display_name}`} onChange={e=>setLine(e.target.value)} /></label>
      <label className="member-directory__setting">WhatsApp number<input type="tel" value={whatsapp} placeholder="+66 81 234 5678" aria-label={`WhatsApp number for ${member.display_name}`} onChange={e=>setWhatsapp(e.target.value)} /></label>
      <div className="member-directory__edit-actions"><button className="member-directory__save" type="button" onClick={()=>void save()}><Check aria-hidden="true" />Save contacts</button><button type="button" onClick={()=>{setEditing(false);setFeedback('')}}><X aria-hidden="true" />Cancel</button></div>
    </fieldset> : null}
    {feedback ? <span className="member-directory__save-status" data-error={failed} role="status">{feedback}</span> : null}
  </div>
}
