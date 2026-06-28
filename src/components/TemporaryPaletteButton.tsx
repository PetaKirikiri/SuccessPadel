import { useState } from 'react'
import { APP_PALETTE } from '../lib/appPalette'

type PaletteColor = {
  name: string
  hex: string
  use: string
  text?: 'dark' | 'light'
}

const COLORS: PaletteColor[] = [
  { name: 'Navy', hex: APP_PALETTE.navy, use: 'Main page background' },
  { name: 'Dark Blue', hex: APP_PALETTE.darkBlue, use: 'Large panels and secondary background' },
  { name: 'Blue', hex: APP_PALETTE.blue, use: 'Primary links, selected borders, active state', text: 'dark' },
  { name: 'Light Blue', hex: APP_PALETTE.lightBlue, use: 'Court labels, scores, bright readable accents', text: 'dark' },
  { name: 'Cyan', hex: APP_PALETTE.cyan, use: 'Blue-green accent', text: 'dark' },
  { name: 'Green', hex: APP_PALETTE.green, use: 'Friendly, success, logged-in blink, positive state', text: 'dark' },
  { name: 'Yellow', hex: APP_PALETTE.yellow, use: 'Competition, trophy, important highlight', text: 'dark' },
  { name: 'Orange', hex: APP_PALETTE.orange, use: 'Warning or secondary highlight', text: 'dark' },
  { name: 'Red', hex: APP_PALETTE.red, use: 'Delete, danger, losing/negative state', text: 'dark' },
  { name: 'Pink', hex: APP_PALETTE.pink, use: 'Women / mixed accent', text: 'dark' },
  { name: 'Purple', hex: APP_PALETTE.purple, use: 'Special state or alternate category', text: 'dark' },
  { name: 'White', hex: APP_PALETTE.white, use: 'Primary text on navy', text: 'dark' },
  { name: 'Muted White', hex: APP_PALETTE.mutedWhite, use: 'Secondary text on navy', text: 'dark' },
  { name: 'Black', hex: APP_PALETTE.black, use: 'Text on bright colors' },
]

function PaletteRow({ color }: { color: PaletteColor }) {
  const textClass = color.text === 'dark' ? 'text-[#06111f]' : 'text-white'

  return (
    <article className="grid min-h-[5.75rem] grid-cols-[7.5rem_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04] shadow-sm md:grid-cols-[12rem_minmax(0,1fr)]">
      <div
        className={`flex items-end p-3 font-mono text-sm font-black uppercase tracking-wide ${textClass}`}
        style={{ backgroundColor: color.hex }}
      >
        {color.hex}
      </div>
      <div className="flex min-w-0 flex-col justify-center px-4 py-3">
        <h2 className="font-display text-2xl font-black leading-tight text-white md:text-3xl">
          {color.name}
        </h2>
        <p className="mt-1 text-sm font-semibold leading-snug text-white/58 md:text-base">
          {color.use}
        </p>
      </div>
    </article>
  )
}

export function TemporaryPaletteButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-3 z-[360] bottom-[calc(var(--app-shell-dock-height)+0.75rem)] flex h-10 items-center gap-2 rounded-full border border-white/20 bg-[#061d36]/95 px-3 font-display text-xs font-bold text-white shadow-lg shadow-black/25 backdrop-blur active:scale-[0.98] md:right-5"
      >
        <span className="grid grid-cols-2 gap-0.5">
          <span className="h-2 w-2 rounded-full bg-[#4da3ff]" />
          <span className="h-2 w-2 rounded-full bg-[#7dd3fc]" />
          <span className="h-2 w-2 rounded-full bg-[#2dffc4]" />
          <span className="h-2 w-2 rounded-full bg-[#efff3d]" />
        </span>
        Palette
      </button>

      {open ? (
        <div className="fixed inset-0 z-[500] overflow-y-auto bg-[#06111f] text-white">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#06111f]/95 px-4 py-3 backdrop-blur md:px-8">
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
              <div>
                <p className="font-display text-2xl font-black leading-tight md:text-4xl">
                  App Colors
                </p>
                <p className="mt-1 text-xs font-semibold text-white/55 md:text-sm">
                  Standard color names. These are the canonical app colors.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 shrink-0 rounded-full border border-white/18 px-4 font-display text-sm font-black text-white/80 active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </header>

          <main className="mx-auto grid max-w-4xl gap-3 px-4 py-5 pb-24 md:px-8 md:py-8">
            {COLORS.map((color) => (
              <PaletteRow key={color.name} color={color} />
            ))}
          </main>
        </div>
      ) : null}
    </>
  )
}
