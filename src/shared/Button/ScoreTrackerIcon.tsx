import { ScanLine } from 'lucide-react'

type Props = { className?: string }

/** Mini court + shot stroke — opens gesture score tracker (wired by parent). */
export function ScoreTrackerIcon({ className }: Props) {
  return <ScanLine className={className} strokeWidth={2.25} aria-hidden />
}
