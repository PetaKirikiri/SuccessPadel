import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PlayerProfileBanner } from '../../src/foundation/profile/PlayerProfileBanner'
import { AdminAddMemberAction } from '../../src/foundation/profile/AdminAddMemberAction'
import { ViewportProvider } from '../../src/contexts/ViewportContext'
import type { TranslateFn } from '../../src/i18n'
import { canManageMembers } from '../../src/lib/memberPermissions'
import '../../src/index.css'

// Visual fixture only: never logs in, creates a member, or alters permissions.
const allowed = canManageMembers(false, 'fixture-admin', { id: 'fixture-admin', is_admin: new URLSearchParams(location.search).get('role') === 'admin' })
createRoot(document.getElementById('root')!).render(<BrowserRouter><ViewportProvider>
  <PlayerProfileBanner name="Admin profile" canAddLine={false} memberSince="2026" t={((key: string) => key) as TranslateFn}
    adminAction={allowed ? <AdminAddMemberAction label="Add member" /> : undefined} />
</ViewportProvider></BrowserRouter>)
