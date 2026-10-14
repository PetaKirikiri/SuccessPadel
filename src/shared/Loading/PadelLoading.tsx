import { useTranslation } from '../../hooks/useTranslation'
import './padel-loading.css'

/** Shared loading presentation; no timer or dependency on account/event data. */
export function PadelLoading() {
  const { t } = useTranslation()
  return (
    <div className="padel-loading" role="status" aria-live="polite">
      <img className="padel-loading__logo" src="/brand/success-padel-silver-source.png" alt={t('common.brandAlt')} />
      <div className="padel-loading__scene" aria-hidden="true">
        <div className="padel-loading__burst" />
        <img className="padel-loading__heroes" src="/brand/superhero-americano-duo.png" alt="" />
      </div>
      <span className="padel-loading__label">{t('common.loading')}</span>
      <span className="padel-loading__rally" aria-hidden="true">
        <span className="padel-loading__ball" />
      </span>
    </div>
  )
}
