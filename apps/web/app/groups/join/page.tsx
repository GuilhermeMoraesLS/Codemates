'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { joinGroup } from '@/lib/api'

export default function JoinGroupPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await joinGroup(token.trim())
      router.push(`/groups/${result.group_id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Convite inválido ou expirado')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', zIndex: 1 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, marginBottom: 32, padding: 0 }}
        >
          ← voltar
        </button>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, marginBottom: 8 }}>
            entrar via <span style={{ color: 'var(--cyan)' }}>convite</span>
          </h1>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: 'var(--muted)', margin: 0 }}>
            Cole o token de convite que você recebeu.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{
              display: 'block', marginBottom: 6,
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
              color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Token de convite
            </label>
            <input
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                background: 'var(--bg)', border: '1px solid var(--border)',
                color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
              }}
              placeholder="ex: Abc123XyzQwerty"
              value={token}
              onChange={e => setToken(e.target.value)}
              required
            />
          </div>

          {error && (
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#FF6666', margin: 0 }}>
              // {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="btn-primary"
            style={{ width: '100%', padding: '12px 0', borderRadius: 8, fontSize: 14, opacity: loading || !token.trim() ? 0.5 : 1 }}
          >
            {loading ? '// entrando...' : 'entrar no grupo'}
          </button>
        </form>
      </div>
    </div>
  )
}
