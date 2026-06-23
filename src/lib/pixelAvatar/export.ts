import type { PixelAvatarConfig } from './types'
import { resolveCharacterPoseSrc } from './catalog'
import { DEFAULT_PIXEL_AVATAR_REFERENCE, DEFAULT_SHOWDOWN_CHARACTER_ID } from './defaults'

export async function renderPixelAvatarPng(config: PixelAvatarConfig): Promise<Blob> {
  const characterId = config.characterId?.trim() || DEFAULT_SHOWDOWN_CHARACTER_ID
  const src =
    resolveCharacterPoseSrc(characterId, 'stance') ?? DEFAULT_PIXEL_AVATAR_REFERENCE
  const canvas = await renderReferenceToCanvas(src)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not export pixel avatar')
  return blob
}

export async function renderPixelAvatarDataUrl(config: PixelAvatarConfig): Promise<string> {
  const characterId = config.characterId?.trim() || DEFAULT_SHOWDOWN_CHARACTER_ID
  const src =
    resolveCharacterPoseSrc(characterId, 'stance') ?? DEFAULT_PIXEL_AVATAR_REFERENCE
  const canvas = await renderReferenceToCanvas(src)
  return canvas.toDataURL('image/png')
}

function renderReferenceToCanvas(src: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0)
      resolve(canvas)
    }
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}
