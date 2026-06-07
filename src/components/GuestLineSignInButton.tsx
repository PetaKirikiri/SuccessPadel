type Props = {
  signedIn: boolean
  onClick: () => void
}

export function GuestLineSignInButton({ signedIn, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 rounded-lg bg-[#06C755] px-2.5 py-1 text-[11px] font-semibold leading-tight text-white"
    >
      {signedIn ? 'Link to my account' : 'Link with LINE'}
    </button>
  )
}
