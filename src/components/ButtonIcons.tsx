import type { LucideIcon, LucideProps } from 'lucide-react'
import {
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Globe,
  LayoutGrid,
  Link2,
  Lock,
  Pencil,
  Play,
  Plus,
  Rocket,
  Share2,
  Shuffle,
  Star,
  Tablet,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
  Gauge,
} from 'lucide-react'

export const BTN_ICON = 'h-4 w-4 shrink-0'

function makeIcon(Icon: LucideIcon) {
  return function BtnIcon({ className, ...props }: LucideProps) {
    return <Icon className={className ?? BTN_ICON} aria-hidden {...props} />
  }
}

export const IconAdd = makeIcon(Plus)
export const IconEdit = makeIcon(Pencil)
export const IconDelete = makeIcon(Trash2)
export const IconShare = makeIcon(Share2)
export const IconPlay = makeIcon(Play)
export const IconJoin = makeIcon(UserPlus)
export const IconReview = makeIcon(ClipboardCheck)
export const IconOpenPad = makeIcon(Tablet)
export const IconPublic = makeIcon(Globe)
export const IconPrivate = makeIcon(Lock)
export const IconFreePlay = makeIcon(Users)
export const IconOrganized = makeIcon(LayoutGrid)
export const IconCancel = makeIcon(X)
export const IconSave = makeIcon(Check)
export const IconShuffle = makeIcon(Shuffle)
export const IconCopy = makeIcon(Copy)
export const IconExternal = makeIcon(ExternalLink)
export const IconPublish = makeIcon(Rocket)
export const IconLink = makeIcon(Link2)
export const IconUser = makeIcon(User)
export const IconUsers = makeIcon(Users)
export const IconStar = makeIcon(Star)
export const IconGauge = makeIcon(Gauge)
