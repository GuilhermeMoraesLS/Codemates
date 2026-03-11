'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createGroup } from '@/lib/api'

export default function NewGroupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ nome: '', stack_alvo: '', objetivo: '', max_membros: 5 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const group = await createGroup({
        nome: form.nome,
        stack_alvo: form.stack_alvo,
        objetivo: form.objetivo || undefined,
        max_membros: form.max_membros,
      })
      router.push(`/groups/${group.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar grupo')
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    background: 'var(--bg)', border: '1px solid var(--border)',
    color: 'var(--text)', fontFamily: 'Space Grotesk, sans-serif', fontSize: 14,
    outline: 'none', boxSizing: 'border-box' as const,
  }
  const labelStyle = {
    display: 'block', marginBottom: 6,
    fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
    color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.08em',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', zIndex: 1 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, marginBottom: 32, padding: 0 }}
        >
          ← voltar
        </button>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, marginBottom: 8 }}>
            criar <span style={{ color: 'var(--green)' }}>grupo</span>
          </h1>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: 'var(--muted)', margin: 0 }}>
            3 a 7 membros. Você será o admin.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>Nome do grupo</label>
            <input
              style={inputStyle}
              placeholder="ex: fullstack-warriors"
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Stack alvo</label>
            <input
              style={inputStyle}
              placeholder="ex: React, Node.js, Python"
              value={form.stack_alvo}
              onChange={e => setForm(f => ({ ...f, stack_alvo: e.target.value }))}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Objetivo <span style={{ color: 'var(--bg3)' }}>(opcional)</span></label>
            <input
              style={inputStyle}
              placeholder="ex: aprender TypeScript avançado"
              value={form.objetivo}
              onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Máximo de membros</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[3, 4, 5, 6, 7].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, max_membros: n }))}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700,
                    border: `1px solid ${form.max_membros === n ? 'var(--green)' : 'var(--border)'}`,
                    background: form.max_membros === n ? 'rgba(0,255,148,0.1)' : 'var(--bg)',
                    color: form.max_membros === n ? 'var(--green)' : 'var(--muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#FF6666', margin: 0 }}>
              // {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '12px 0', borderRadius: 8, fontSize: 14, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '// criando...' : 'criar grupo'}
          </button>
        </form>
      </div>
    </div>
  )
}
