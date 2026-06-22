export type LineupFacing = 'left' | 'right'

type Props = {
  src: string
  facing: LineupFacing
  size?: number
  className?: string
}

export function GameLineupSprite({ src, facing, size = 48, className = '' }: Props) {
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 object-contain object-bottom ${className}`}
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
        transform: facing === 'left' ? 'scaleX(-1)' : undefined,
      }}
    />
  )
}
