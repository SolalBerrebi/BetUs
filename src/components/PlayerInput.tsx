import { useMemo, useRef, useState } from 'react'
import { PLAYERS } from '../lib/players'
import { teamFlag } from '../lib/teams'

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  /** Restreint les suggestions à ces équipes (les 2 d'un match). Vide = tous. */
  teams?: (string | null)[]
  disabled?: boolean
}

/**
 * Champ joueur avec autocomplete sur les effectifs officiels. La saisie libre
 * reste possible (filet de sécurité) : ce qui est tapé est toujours la valeur,
 * les suggestions ne font que pré-remplir le nom de famille.
 */
export default function PlayerInput({ label, value, onChange, placeholder, hint, teams, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const blurTimer = useRef<number | undefined>(undefined)
  const id = label.toLowerCase().replace(/\W+/g, '-')

  const codes = useMemo(() => (teams ? teams.filter((c): c is string => !!c) : []), [teams])
  const pool = useMemo(
    () => (codes.length ? PLAYERS.filter((p) => codes.includes(p.t)) : PLAYERS),
    [codes],
  )

  const suggestions = useMemo(() => {
    const q = norm(value)
    if (!q) return codes.length ? pool.slice(0, 8) : []
    const starts = pool.filter((p) => norm(p.s).startsWith(q) || norm(p.f).startsWith(q))
    const contains = pool.filter(
      (p) => !norm(p.s).startsWith(q) && !norm(p.f).startsWith(q) && norm(p.f).includes(q),
    )
    return [...starts, ...contains].slice(0, 8)
  }, [value, pool, codes])

  const exactPick = suggestions.length === 1 && norm(suggestions[0].s) === norm(value)
  const showList = open && suggestions.length > 0 && !exactPick

  function pick(s: string) {
    onChange(s)
    setOpen(false)
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
        <input
          id={id}
          value={value}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 150)
          }}
          onKeyDown={(e) => {
            if (!showList) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, suggestions.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              pick(suggestions[active].s)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder={placeholder}
          className="h-12 w-full rounded-xl bg-surface-2 px-4 text-[17px] text-ink placeholder:text-ink-3
            outline-none transition-shadow duration-150 focus:ring-2 focus:ring-accent disabled:opacity-50"
        />
      </label>
      {hint && !showList && <span className="mt-1 block text-[12px] text-ink-3">{hint}</span>}

      {showList && (
        <ul
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto rounded-xl bg-surface p-1 shadow-(--shadow-float)"
          role="listbox"
        >
          {suggestions.map((p, i) => (
            <li key={`${p.s}-${p.t}-${i}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault()
                  window.clearTimeout(blurTimer.current)
                  pick(p.s)
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  i === active ? 'bg-accent-soft' : ''
                }`}
              >
                <span className="text-[18px]">{teamFlag(p.t)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{p.s}</span>
                  {p.f !== p.s && <span className="block truncate text-[12px] text-ink-3">{p.f}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
