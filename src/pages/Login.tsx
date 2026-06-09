import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Field, Segmented } from '../components/ui'

const ERRORS: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
  'User already registered': 'Un compte existe déjà avec cet e-mail.',
  'Password should be at least 6 characters.': 'Le mot de passe doit faire au moins 6 caractères.',
}

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const res =
      mode === 'signup'
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: name.trim() } },
          })
        : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (res.error) setError(ERRORS[res.error.message] ?? res.error.message)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-10 text-center">
        <div className="mb-4 text-6xl">🏆</div>
        <h1 className="text-[34px] font-bold tracking-tight">BetUs</h1>
        <p className="mt-1 text-[17px] text-ink-2">Pronos Coupe du Monde 2026, entre copains.</p>
      </div>

      <Segmented
        options={[
          { value: 'signup', label: 'Inscription' },
          { value: 'signin', label: 'Connexion' },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m)
          setError(null)
        }}
      />

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === 'signup' && (
          <Field
            label="Ton prénom (visible au classement)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="given-name"
            placeholder="Solal"
          />
        )}
        <Field
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="toi@exemple.fr"
        />
        <Field
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          placeholder="6 caractères minimum"
        />
        {error && <p className="text-[14px] font-medium text-negative">{error}</p>}
        <Button type="submit" loading={busy} className="w-full">
          {mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}
        </Button>
      </form>

      <p className="mt-8 text-center text-[13px] leading-relaxed text-ink-3">
        Participation 30 € via Revolut auprès de l'organisateur.
        <br />
        Cagnotte reversée : 70 % au 1er, 30 % au 2e.
      </p>
    </div>
  )
}
