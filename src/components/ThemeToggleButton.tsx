import { Moon, Sun } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import { useTheme } from '../providers/ThemeProvider'

type Props = {
  className?: string
  showLabel?: boolean
  menuItem?: boolean
  dark?: boolean
}

export function ThemeToggleButton({
  className = '',
  showLabel = false,
  menuItem = false,
  dark = false,
}: Props) {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'dark' ? t('common.themeLight') : t('common.themeDark')
  const cornerCls = dark
    ? 'border-white/35 bg-black/40 text-white hover:bg-white/10 active:bg-white/10'
    : 'border-brand-border bg-brand-surface text-brand-primary hover:bg-brand-bg-alt active:bg-brand-bg-alt'
  const iconCls = dark ? 'text-sky-300' : 'text-brand-accent'

  return (
    <button
      type="button"
      role={menuItem ? 'menuitem' : undefined}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center gap-2 rounded-full border transition ${showLabel ? 'px-3 py-2 text-sm font-medium' : 'h-9 w-9 md:h-11 md:w-11'} ${showLabel && !dark ? cornerCls : showLabel ? 'border-0 bg-transparent text-brand-primary hover:bg-brand-bg-alt active:bg-brand-bg-alt' : cornerCls} ${className}`}
    >
      {theme === 'dark' ? (
        <Sun className={`h-4 w-4 shrink-0 md:h-5 md:w-5 ${iconCls}`} aria-hidden />
      ) : (
        <Moon className={`h-4 w-4 shrink-0 md:h-5 md:w-5 ${iconCls}`} aria-hidden />
      )}
      {showLabel ? label : null}
    </button>
  )
}
