import type { ComponentProps, ReactNode } from 'react'

/** Gutter on the viewport edge — kept narrow so content can use more width. */
const APP_SHELL_GUTTER = 'px-3 md:px-4 lg:px-5'

/** Inner column max width — wider than the old 3xl/4xl stack. */
const APP_SHELL_INNER =
  'mx-auto w-full min-w-0 max-w-full md:max-w-6xl lg:max-w-7xl'

export const APP_SHELL_CLASS = `${APP_SHELL_GUTTER} ${APP_SHELL_INNER}`

type Props = ComponentProps<'div'> & {
  children: ReactNode
  /** When false, column does not grow (e.g. bottom dock bar). */
  fill?: boolean
}

export function AppShellColumn({ children, className = '', fill = true, ...props }: Props) {
  const outerClass = fill
    ? `${APP_SHELL_GUTTER} flex min-h-0 min-w-0 w-full flex-1 basis-0 flex-col`
    : `${APP_SHELL_GUTTER} w-full shrink-0`
  const innerClass = fill
    ? `${APP_SHELL_INNER} flex min-h-0 min-w-0 w-full flex-1 basis-0 flex-col`
    : APP_SHELL_INNER

  return (
    <div className={outerClass}>
      <div className={`${innerClass}${className ? ` ${className}` : ''}`} {...props}>
        {children}
      </div>
    </div>
  )
}
