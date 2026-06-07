import { useTranslation } from '../hooks/useTranslation'

type Props = {
  busy: boolean
  onContinue: () => void
}

export function LineNativeLoginPanel({ busy, onContinue }: Props) {
  const { t } = useTranslation()

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <img
        src="/brand/logo-padel.webp"
        alt={t('common.brandAlt')}
        className="h-16 w-auto max-w-[min(100%,12rem)]"
      />
      <p className="max-w-sm text-center text-sm text-brand-muted">{t('login.pitch')}</p>
      <button
        type="button"
        disabled={busy}
        onClick={onContinue}
        className="w-full rounded-xl bg-[#06C755] px-8 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {busy ? t('login.openingLine') : t('login.continueLine')}
      </button>
    </div>
  )
}
