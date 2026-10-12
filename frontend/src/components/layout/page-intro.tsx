import type { ReactNode } from 'react'

interface PageIntroProps {
  eyebrow: string
  title: string
  description: string
  centered?: boolean
  actions?: ReactNode
}

export function PageIntro({ eyebrow, title, description, centered = false, actions }: PageIntroProps) {
  return (
    <header className={`mb-9 flex gap-6 max-[640px]:flex-col ${centered ? 'mx-auto max-w-3xl flex-col items-center text-center' : 'items-end justify-between'}`}>
      <div className="max-w-3xl">
        <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-bold tracking-wide text-indigo-700">
          {eyebrow}
        </span>
        <h1 className="mb-3 mt-3 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.04em] text-slate-900">
          {title}
        </h1>
        <p className="m-0 max-w-2xl text-[15px] leading-7 text-slate-600">{description}</p>
      </div>
      {actions}
    </header>
  )
}
