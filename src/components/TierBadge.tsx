type Props = { level: string }

const styles: Record<string, string> = {
  Elite: 'bg-brand-bg-alt text-brand-accent',
  Advanced: 'bg-brand-tan/20 text-brand-primary',
  Intermediate: 'bg-brand-sage/15 text-brand-sage',
  Beginner: 'bg-brand-border/50 text-brand-muted',
}

export function TierBadge({ level }: Props) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[level] ?? styles.Beginner}`}
    >
      {level}
    </span>
  )
}
