import { useState } from 'react'
import type { PixelAvatarConfig } from '../lib/pixelAvatar/types'
import { GAME_CHARACTER_CATALOG } from '../lib/pixelAvatar/catalog'
import { PixelAvatarRenderer } from './PixelAvatarRenderer'

type Props = {
  config: PixelAvatarConfig
  onChange: (config: PixelAvatarConfig) => void
}

const REFERENCES = GAME_CHARACTER_CATALOG

export function PixelAvatarEditor({ config, onChange }: Props) {
  const initialReference = REFERENCES.find((item) => item.src === config.reference)?.id ?? 'ryu'
  const [selectedReference, setSelectedReference] = useState<(typeof REFERENCES)[number]['id']>(initialReference)
  const reference = REFERENCES.find((item) => item.id === selectedReference) ?? REFERENCES[0]
  const previewConfig: PixelAvatarConfig = { v: 1, reference: reference.src }

  const selectReference = (id: (typeof REFERENCES)[number]['id']) => {
    const next = REFERENCES.find((item) => item.id === id) ?? REFERENCES[0]
    setSelectedReference(next.id)
    onChange({ v: 1, reference: next.src })
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <div className="flex h-72 w-full items-end justify-center rounded-lg bg-slate-950/90 p-4 ring-2 ring-brand-border">
          <PixelAvatarRenderer config={previewConfig} size={224} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {REFERENCES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectReference(item.id)}
            className={`flex h-24 flex-col items-center justify-end rounded-lg border p-2 text-xs font-semibold ${
              selectedReference === item.id
                ? 'border-brand-accent bg-brand-accent/20 text-brand-accent'
                : 'border-brand-border bg-brand-surface text-brand-muted'
            }`}
          >
            <img
              src={item.src}
              alt=""
              className="max-h-16 max-w-full object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
            <span className="mt-1">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        <div className="flex h-48 w-full items-end justify-center overflow-hidden rounded-lg bg-white p-3 ring-1 ring-brand-border">
          <img
            src={reference.src}
            alt=""
            className="max-h-full max-w-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      </div>
    </div>
  )
}
