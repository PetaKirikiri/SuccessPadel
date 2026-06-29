/**
 * InviteCard style hooks.
 *
 * The actual responsive rules live in the locked layout CSS
 * (`src/layouts/invite.layout.css` + `hub.layout.css`), scoped per screen via
 * `html[data-viewport='mobile' | 'tablet' | 'web' | 'tv']`. This file is the one
 * place that names the class hooks the InviteCard layout uses, so the four
 * screen contexts (mobile, tablet, web, large screen / TV) are easy to find.
 */
export const inviteCardRootClass =
  'invite-game-card relative min-h-0 w-full min-w-0 max-w-full flex-1 touch-manipulation transition active:opacity-95'

/** Class hooks targeted per screen context inside the locked layout CSS. */
export const inviteCardViewportHooks = {
  mobile: 'invite-game-card',
  tablet: 'invite-game-card',
  web: 'invite-game-card',
  tv: 'invite-game-card',
} as const
