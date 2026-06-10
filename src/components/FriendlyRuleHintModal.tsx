import { createPortal } from 'react-dom'
import type { FriendlyRuleChip } from '../lib/friendlyGameDisplay'
import { useTranslation } from '../hooks/useTranslation'
import { FriendlyRuleChipIcon } from './FriendlyRuleChipIcon'

type Props = {
  chip: FriendlyRuleChip
  onClose: () => void
}

export function FriendlyRuleHintModal({ chip, onClose }: Props) {
  const { t } = useTranslation()

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center bg-black/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-brand-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="friendly-rule-hint-title"
      >
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-border/70 bg-white">
            <FriendlyRuleChipIcon icon={chip.icon} className="h-6 w-6 text-brand-accent" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="friendly-rule-hint-title"
              className="font-display text-lg font-semibold leading-snug text-brand-primary"
            >
              {chip.label}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-text">{t(chip.hintKey)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="shrink-0 rounded-full px-2 py-1 text-xl leading-none text-brand-muted"
          >
            ✕
          </button>
        </div>
        <button type="button" onClick={onClose} className="brand-btn mt-1 w-full py-2.5 text-sm font-semibold">
          {t('common.close')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
