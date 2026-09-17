interface IconProps {
  className?: string
}

const base = 'h-5 w-5'

export function IconReview({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" strokeLinejoin="round" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" strokeLinejoin="round" />
      <path d="M8 7h7M8 10.5h5" strokeLinecap="round" />
    </svg>
  )
}

export function IconLibrary({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3.5" y="4" width="7" height="16" rx="1.5" />
      <rect x="13.5" y="4" width="7" height="16" rx="1.5" />
      <path d="M6 8h2M16 8h2" strokeLinecap="round" />
    </svg>
  )
}

export function IconPlay({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.2 9.2l4.6 2.8-4.6 2.8z" fill="currentColor" strokeLinejoin="round" />
    </svg>
  )
}

export function IconSettings({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 3.5v2M12 18.5v2M4.9 7.5l1.7 1M17.4 15.5l1.7 1M4.9 16.5l1.7-1M17.4 8.5l1.7-1"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconChart({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 20V4M4 20h16" strokeLinecap="round" />
      <path d="M8 20v-6M12.5 20V9M17 20v-8" strokeLinecap="round" />
    </svg>
  )
}

export function IconPlus({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 5.5v13M5.5 12h13" strokeLinecap="round" />
    </svg>
  )
}

export function IconClose({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" strokeLinecap="round" />
    </svg>
  )
}

export function IconChevron({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconSearch({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5L20 20" strokeLinecap="round" />
    </svg>
  )
}

export function IconPause({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9.5 6v12M14.5 6v12" strokeLinecap="round" />
    </svg>
  )
}

export function IconPrev({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 6v12" strokeLinecap="round" />
      <path d="M18 6.8v10.4L9.8 12z" fill="currentColor" strokeLinejoin="round" />
    </svg>
  )
}

export function IconNext({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 6v12" strokeLinecap="round" />
      <path d="M6 6.8v10.4L14.2 12z" fill="currentColor" strokeLinejoin="round" />
    </svg>
  )
}

export function IconRepeat({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 9.5A3.5 3.5 0 0 1 8.5 6H18" strokeLinecap="round" />
      <path d="M15.5 3.5L18.5 6l-3 2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 14.5A3.5 3.5 0 0 1 15.5 18H6" strokeLinecap="round" />
      <path d="M8.5 15.5L5.5 18l3 2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconRepeatOne({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 9.5A3.5 3.5 0 0 1 8.5 6H18" strokeLinecap="round" />
      <path d="M15.5 3.5L18.5 6l-3 2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 14.5A3.5 3.5 0 0 1 15.5 18H6" strokeLinecap="round" />
      <path d="M8.5 15.5L5.5 18l3 2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 10.5v3.5M11 11l1-.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconMic({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="9.5" y="3.5" width="5" height="10" rx="2.5" />
      <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3M9 20.5h6" strokeLinecap="round" />
    </svg>
  )
}

export function IconTrash({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconEdit({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 20h4L19 9l-4-4L4 16z" strokeLinejoin="round" />
      <path d="M14 6l4 4" strokeLinecap="round" />
    </svg>
  )
}

export function IconEye({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2.8 12S6.5 5.8 12 5.8 21.2 12 21.2 12 17.5 18.2 12 18.2 2.8 12 2.8 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  )
}

export function IconEyeOff({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 5l16 14" strokeLinecap="round" />
      <path d="M7.5 7.3C5 9 2.8 12 2.8 12s3.7 6.2 9.2 6.2c1.5 0 2.9-.4 4.1-1" strokeLinecap="round" />
      <path d="M12 5.8c5.5 0 9.2 6.2 9.2 6.2s-1 1.7-2.8 3.3" strokeLinecap="round" />
    </svg>
  )
}

export function IconCheck({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconUpload({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 16V5" strokeLinecap="round" />
      <path d="M8 8.5L12 4.5l4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11A1.5 1.5 0 0 0 19 18.5V15" strokeLinecap="round" />
    </svg>
  )
}

export function IconDownload({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 4v11" strokeLinecap="round" />
      <path d="M8 11.5l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11A1.5 1.5 0 0 0 19 18.5V15" strokeLinecap="round" />
    </svg>
  )
}

export function IconCalendar({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 10h16M9 3.5v4M15 3.5v4" strokeLinecap="round" />
    </svg>
  )
}
