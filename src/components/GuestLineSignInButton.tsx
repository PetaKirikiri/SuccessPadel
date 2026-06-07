type Props = {
  signedIn: boolean
  onClick: () => void
  compact?: boolean
}

export function GuestLineSignInButton({ signedIn, onClick, compact = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        compact
          ? 'shrink-0 rounded bg-[#06C755] px-1.5 py-0.5 text-[9px] font-semibold leading-tight text-white'
          : 'mt-1 rounded-lg bg-[#06C755] px-2.5 py-1 text-[11px] font-semibold leading-tight text-white'
      }
    >
      {signedIn ? (compact ? 'Link' : 'Link to my account') : compact ? 'LINE' : 'Link with LINE'}
    </button>
  )
}
