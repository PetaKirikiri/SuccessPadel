type Props = {
  message: string
  lineName?: string | null
  linePhoto?: string | null
}

export function LineSigningInScreen({ message, lineName, linePhoto }: Props) {
  return (
    <div className="game-bg flex h-full min-h-0 w-full flex-col items-center justify-center px-6">
      <img
        src="/brand/logo-padel.webp"
        alt="Success Padel"
        className="mb-6 h-14 w-auto max-w-[min(100%,11rem)]"
      />
      {linePhoto ? (
        <img src={linePhoto} alt="" className="mb-3 h-14 w-14 rounded-full object-cover" />
      ) : null}
      {lineName ? (
        <p className="mb-2 text-sm text-brand-muted">Signed in to LINE as {lineName}</p>
      ) : null}
      <p className="font-display text-lg font-semibold text-brand-primary">{message}</p>
    </div>
  )
}
