import { IconSparkles, IconTicket } from '../ui/icons'

interface EventoraLogoProps {
  tone?: 'dark' | 'light'
  size?: 'compact' | 'regular'
}

const markSizes = {
  compact: 'size-7 rounded-[8px]',
  regular: 'size-8 rounded-[10px]',
}

const wordmarkSizes = {
  compact: 'text-[22px] tracking-[-0.8px]',
  regular: 'text-[26px] tracking-[-1px]',
}

export function EventoraLogo({ tone = 'dark', size = 'compact' }: EventoraLogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`relative inline-grid shrink-0 place-items-center bg-[linear-gradient(145deg,#818cf8_0%,#4f46e5_72%,#4338ca_100%)] text-white shadow-[0_3px_8px_rgba(79,70,229,0.28)] ring-1 ring-inset ring-white/20 ${markSizes[size]}`}
      >
        <IconTicket className={size === 'compact' ? 'size-4' : 'size-[18px]'} />
        <IconSparkles className="absolute -right-1 -top-1 size-[11px] fill-indigo-100 text-indigo-100 drop-shadow-sm" />
      </span>
      <span className={`font-extrabold leading-none ${tone === 'light' ? 'text-white' : 'text-slate-900'} ${wordmarkSizes[size]}`}>
        eventora<span className="text-indigo-500">.</span>
      </span>
    </span>
  )
}
