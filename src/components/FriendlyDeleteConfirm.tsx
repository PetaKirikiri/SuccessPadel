import { createPortal } from 'react-dom'
import { useTranslation } from '../hooks/useTranslation'

type Props = {
  title: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function FriendlyDeleteConfirm({ title, busy = false, onConfirm, onCancel }: Props) {
  const { t } = useTranslation()

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-end justify-center bg-black/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-brand-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="friendly-delete-title"
      >
        <h2 id="friendly-delete-title" className="font-display text-lg font-semibold text-brand-primary">
          {t('competition.delete')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-brand-text">
          {t('competition.deleteConfirm', { title })}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="brand-btn-outline flex-1 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {t('pad.confirm.cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? t('common.loading') : t('competition.delete')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
