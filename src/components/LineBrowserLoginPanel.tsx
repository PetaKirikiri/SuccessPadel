type Props = {
  busy: boolean
  onContinue: () => void
  signupUrl: string
}

export function LineBrowserLoginPanel({ busy, onContinue, signupUrl }: Props) {
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(signupUrl)
    } catch {
      window.prompt('Copy this link for your group:', signupUrl)
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <img
        src="/brand/logo-padel.webp"
        alt="Success Padel"
        className="h-16 w-auto max-w-[min(100%,12rem)]"
      />
      <div className="max-w-sm space-y-3 text-center text-sm text-brand-muted">
        <p>
          Open this page in <strong className="text-brand-text">Safari</strong> — not by tapping the
          link inside LINE (that opens LINE&apos;s own browser). Long-press the group link → Open in
          Safari.
        </p>
        <p>
          Tap <strong className="text-brand-text">Continue with LINE</strong> below. On LINE&apos;s
          page tap <strong className="text-brand-text">Continue as …</strong> if you see your name.
        </p>
        <p>
          Do <strong className="text-brand-text">not</strong> use the QR scanner inside LINE on
          LINE&apos;s login page — that causes &ldquo;Unable to log in with QR code&rdquo;. If you
          must use another phone, open LINE on that phone → Home → QR scanner → scan the code on
          this screen.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onContinue}
        className="w-full rounded-xl bg-[#06C755] px-8 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        Continue with LINE
      </button>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="text-xs text-brand-muted underline"
      >
        Copy group signup link
      </button>
    </div>
  )
}
