import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-(--radius-card) bg-surface shadow-(--shadow-card) ${className}`}>
      {children}
    </div>
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, className = '', children, disabled, ...rest }: ButtonProps) {
  const base =
    'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-[17px] font-semibold ' +
    'transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
  const variants = {
    primary: 'bg-accent text-white hover:bg-[#0070ee]',
    secondary: 'bg-accent-soft text-accent hover:bg-[#dcecff]',
    ghost: 'bg-transparent text-accent hover:bg-accent-soft',
    destructive: 'bg-transparent text-negative hover:bg-red-50',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Spinner className="size-4 border-white/40 border-t-white" />}
      {children}
    </button>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block size-5 animate-spin rounded-full border-2 border-line border-t-ink-2 ${className}`}
    />
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

export function Field({ label, hint, id, className = '', ...rest }: FieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\W+/g, '-')
  return (
    <label htmlFor={fieldId} className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      <input
        id={fieldId}
        className={`h-12 w-full rounded-xl bg-surface-2 px-4 text-[17px] text-ink placeholder:text-ink-3
          outline-none transition-shadow duration-150 focus:ring-2 focus:ring-accent ${className}`}
        {...rest}
      />
      {hint && <span className="mt-1 block text-[12px] text-ink-3">{hint}</span>}
    </label>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: ReactNode }[]
  value: T | null
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className="flex rounded-xl bg-surface-2 p-1" role="radiogroup">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`h-10 flex-1 rounded-[10px] text-[15px] font-medium transition-all duration-150
              disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent
              ${active ? 'bg-surface text-ink shadow-(--shadow-card)' : 'text-ink-2 hover:text-ink'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'positive' | 'warning'
  children: ReactNode
}) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2',
    accent: 'bg-accent-soft text-accent',
    positive: 'bg-positive-soft text-[#1d9a45]',
    warning: 'bg-warning-soft text-[#c77700]',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function EmptyState({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="mb-3 text-4xl">{icon}</div>
      <p className="text-[17px] font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-[15px] text-ink-2">{text}</p>}
    </div>
  )
}

export function Powered({ className = '' }: { className?: string }) {
  return (
    <p className={`pb-1 pt-12 text-center text-[9px] font-medium uppercase tracking-[0.22em] text-ink-3/70 select-none ${className}`}>
      Powered by Solal Tech Sport Corp.
    </p>
  )
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-5 pt-2">
      <h1 className="text-[28px] font-bold tracking-tight">{children}</h1>
      {sub && <p className="mt-0.5 text-[15px] text-ink-2">{sub}</p>}
    </header>
  )
}
