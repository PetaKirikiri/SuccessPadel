import { useEffect, useMemo, useState } from 'react'
import type { PixelAvatarConfig } from '../lib/pixelAvatar/types'
import {
  GAME_CHARACTER_CATALOG,
  SHOWDOWN_FRANCHISE_LABELS,
  gameCharactersForFranchise,
  type GameCharacterFranchise,
} from '../lib/pixelAvatar/catalog'
import { DEFAULT_SHOWDOWN_CHARACTER_ID } from '../lib/pixelAvatar/defaults'

type Props = {
  config: PixelAvatarConfig
  onChange: (config: PixelAvatarConfig) => void
  compact?: boolean
}

const ALL_FRANCHISES: GameCharacterFranchise[] = ['street-fighter', 'dbz', 'naruto', 'cartoon']

export function PixelAvatarEditor({ config, onChange, compact = false }: Props) {
  const catalogIds = useMemo(() => new Set(GAME_CHARACTER_CATALOG.map((item) => item.id)), [])
  const initialId = catalogIds.has(config.characterId) ? config.characterId : DEFAULT_SHOWDOWN_CHARACTER_ID
  const [selectedId, setSelectedId] = useState(initialId)
  const [franchise, setFranchise] = useState<GameCharacterFranchise | 'all'>('all')

  useEffect(() => {
    setSelectedId(catalogIds.has(config.characterId) ? config.characterId : DEFAULT_SHOWDOWN_CHARACTER_ID)
  }, [catalogIds, config.characterId])

  const franchiseTabs = useMemo(() => {
    const tabs: Array<GameCharacterFranchise | 'all'> = ['all']
    for (const key of ALL_FRANCHISES) {
      if (gameCharactersForFranchise(key).length > 0) tabs.push(key)
    }
    return tabs
  }, [])

  const visibleCharacters = useMemo(() => gameCharactersForFranchise(franchise), [franchise])

  const selectCharacter = (id: string) => {
    setSelectedId(id)
    onChange({ v: 1, characterId: id })
  }

  if (GAME_CHARACTER_CATALOG.length === 0) {
    return (
      <p className="text-xs text-brand-muted">
        No showdown characters yet. Add GIFs under public/pixel-avatar/showdown/, then run npm run
        showdown:sync.
      </p>
    )
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-3'}>
      {franchiseTabs.length > 1 && !compact ? (
        <div className="flex flex-wrap gap-1.5">
          {franchiseTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFranchise(tab)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                franchise === tab
                  ? 'border-brand-accent bg-brand-accent/20 text-brand-accent'
                  : 'border-brand-border text-brand-muted'
              }`}
            >
              {tab === 'all' ? 'All' : SHOWDOWN_FRANCHISE_LABELS[tab]}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={
          compact
            ? 'flex max-w-[12.5rem] flex-wrap justify-end gap-1'
            : 'grid grid-cols-3 gap-2 sm:grid-cols-4'
        }
      >
        {visibleCharacters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectCharacter(item.id)}
            aria-label={item.label}
            title={item.label}
            className={`flex flex-col items-center justify-end border font-semibold transition ${
              compact ? 'h-10 w-10 rounded-md p-1 opacity-75 hover:opacity-100' : 'h-24 rounded-lg p-2 text-xs'
            } ${
              selectedId === item.id
                ? compact
                  ? 'border-brand-accent/70 bg-brand-accent/10 text-brand-accent opacity-100'
                  : 'border-brand-accent bg-brand-accent/20 text-brand-accent'
                : compact
                  ? 'border-brand-border/60 bg-brand-surface/60 text-brand-muted'
                  : 'border-brand-border bg-brand-surface text-brand-muted'
            }`}
          >
            <img
              src={item.poses.stance}
              alt=""
              className={compact ? 'max-h-8 max-w-full object-contain' : 'max-h-16 max-w-full object-contain'}
              style={{ imageRendering: 'pixelated' }}
            />
            {compact ? null : <span className="mt-1 truncate">{item.label}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
