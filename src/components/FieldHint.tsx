import { useState } from 'react'

type Props = {
  text: string
  label?: string
}

export function FieldHint({ text, label = 'More info' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex shrink-0 align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-brand-border/80 bg-brand-bg-alt text-[10px] font-bold leading-none text-brand-muted"
      >
        ?
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-1 w-44 -translate-x-1/2 rounded-lg border border-brand-border bg-brand-surface px-2 py-1.5 text-left text-[10px] font-normal normal-case leading-snug tracking-normal text-brand-text shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          {text}
        </span>
      ) : null}
    </span>
  )
}
