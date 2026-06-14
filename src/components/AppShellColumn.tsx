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
  /** Large screens: flush to viewport edges, no max-width cap (TV play views). */
  edgeToEdge?: boolean
}

export function AppShellColumn({
  children,
  className = '',
  fill = true,
  edgeToEdge = false,
  ...props
}: Props) {
  const gutter = edgeToEdge ? 'px-3 md:px-4 lg:px-0' : APP_SHELL_GUTTER
  const inner = edgeToEdge
    ? 'mx-auto w-full min-w-0 max-w-full lg:max-w-none'
    : APP_SHELL_INNER
  const outerClass = fill
    ? `${gutter} flex min-h-0 min-w-0 w-full flex-1 basis-0 flex-col`
    : `${gutter} w-full shrink-0`
  const innerClass = fill
    ? `${inner} flex min-h-0 min-w-0 w-full flex-1 basis-0 flex-col`
    : inner

  return (
    <div className={outerClass}>
      <div className={`${innerClass}${className ? ` ${className}` : ''}`} {...props}>
        {children}
      </div>
    </div>
  )
}
