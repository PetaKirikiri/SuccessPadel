import type { ComponentProps, ReactNode } from 'react'

/** Gutter on the viewport edge — kept narrow so content can use more width. */
const APP_SHELL_GUTTER = 'px-3 md:px-4 lg:px-5'

/** Inner column max width — wider than the old 3xl/4xl stack. */
const APP_SHELL_INNER =
  'mx-auto w-full min-w-0 max-w-full md:max-w-6xl lg:max-w-7xl'

export const APP_SHELL_CLASS = `${APP_SHELL_GUTTER} ${APP_SHELL_INNER}`

type Props = ComponentProps<'div'> & {
  children: ReactNode
}

export function AppShellColumn({ children, className = '', ...props }: Props) {
  return (
    <div className={APP_SHELL_GUTTER}>
      <div className={`${APP_SHELL_INNER}${className ? ` ${className}` : ''}`} {...props}>
        {children}
      </div>
    </div>
  )
}
