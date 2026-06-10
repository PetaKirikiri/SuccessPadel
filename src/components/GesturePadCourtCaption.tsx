type Props = {
  label: string
}

export function GesturePadCourtCaption({ label }: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[4%] z-[5] flex justify-center px-3 sm:top-[5%]">
      <p className="rounded-lg border border-white/20 bg-black/55 px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-amber-200/95 shadow-sm backdrop-blur-sm sm:text-sm">
        {label}
      </p>
    </div>
  )
}
