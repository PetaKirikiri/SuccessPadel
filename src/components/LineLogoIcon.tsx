type Props = {
  className?: string
}

export function LineLogoIcon({ className = 'h-4 w-4 shrink-0' }: Props) {
  return (
    <img src="/brand/line-logo.png" alt="" aria-hidden className={`rounded-sm object-contain ${className}`} />
  )
}
