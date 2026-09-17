import { UserRound } from 'lucide-react'
import { useSignInChip } from '../../hooks/useSignInChip'
import { useTranslation } from '../../hooks/useTranslation'
import { LineSignInModal } from '../../shared/Modal/LineSignInModal'

export function InviteProfileAction() {
  const { t } = useTranslation()
  const { openProfile, modalOpen, setModalOpen, busy } = useSignInChip()
  return <>
    <button type="button" className="invite-game-card__profile-action"
      aria-label={t('members.myProfile')} title={t('members.myProfile')} disabled={busy}
      onClick={() => void openProfile()}>
      <UserRound className="invite-game-card__profile-icon" aria-hidden="true" />
    </button>
    {modalOpen ? <LineSignInModal onClose={() => setModalOpen(false)} /> : null}
  </>
}
