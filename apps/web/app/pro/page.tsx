'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { upgradeToPro, type User } from '@/lib/api'

const FREE_FEATURES = [
  { label: 'missões semanais individuais',       ok: true  },
  { label: 'escolha de trilha (1x/semana)',       ok: true  },
  { label: 'missões nível 1 e 2',                ok: true  },
  { label: 'banco de 62 missões',                ok: true  },
  { label: 'conquistas e heatmap',               ok: true  },
  { label: 'perfil público /u/username',         ok: true  },
  { label: 'missões nível 3 (avançado)',         ok: false },
  { label: 'troca de trilha ilimitada',          ok: false },
  { label: 'badge premium no portfolio',         ok: false },
  { label: 'histórico completo (ilimitado)',     ok: false },
]

const PRO_FEATURES = [
  { label: 'missões semanais individuais',       ok: true },
  { label: 'escolha de trilha ilimitada',        ok: true },
  { label: 'missões nível 1, 2 e 3',             ok: true },
  { label: 'banco de 62 missões (nível 3 incluso)', ok: true },
  { label: 'conquistas e heatmap',               ok: true },
  { label: 'perfil público com badge PRO',       ok: true },
  { label: 'missões nível 3 (avançado)',         ok: true },
  { label: 'troca de trilha ilimitada',          ok: true },
  { label: 'badge premium no portfolio',         ok: true },
  { label: 'histórico completo',                 ok: true },
]

export default function ProPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const userData = localStorage.getItem('codemates_user')
    if (userData) setUser(JSON.parse(userData))
  }, [])

  const isAlreadyPro = user?.plano === 'pro'

  const handleUpgrade = async () => {
    if (!user) { router.push('/'); return }
    setUpgrading(true)
    setError(null)
    try {
      await upgradeToPro()
      const updated = { ...user, plano: 'pro' }
      localStorage.setItem('codemates_user', JSON.stringify(updated))
      setUser(updated)
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao fazer upgrade')
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Topbar */}
      <div style={{
        borderBottom: '1px solid var(--border)', padding: '12px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Link href="/dashboard" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700, color: 'var(--green)', textDecoration: 'none' }}>
          &gt;_ codemates
        </Link>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>/pro</span>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '56px 24px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
            plano
          </div>
          <h1 style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 38, fontWeight: 800,
            background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: 12,
          }}>
            Codemates Pro
          </h1>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, color: 'var(--muted)', maxWidth: 480, margin: '0 auto' }}>
            Missões de nível avançado, troca de trilha sem limites e badge de portfólio que impressiona recrutadores.
          </p>
        </div>

        {/* Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 40 }}>
          {/* Free card */}
          <div style={{
            background: 'var(--surface, #151C30)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '28px 24px',
          }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              free
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
              R$ 0
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: 'var(--muted)', marginBottom: 24 }}>
              para sempre
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FREE_FEATURES.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: f.ok ? 'var(--green)' : 'var(--border)', flexShrink: 0, marginTop: 1 }}>
                    {f.ok ? '✓' : '✗'}
                  </span>
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: f.ok ? 'var(--text)' : 'var(--muted)', textDecoration: f.ok ? 'none' : 'line-through' }}>
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro card */}
          <div style={{
            background: 'linear-gradient(145deg, #1a1200, #151C30)',
            border: '1px solid rgba(245,158,11,0.5)',
            boxShadow: '0 0 30px rgba(245,158,11,0.08)',
            borderRadius: 14, padding: '28px 24px',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -12, right: 20,
              background: '#f59e0b', color: '#000',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
              padding: '4px 12px', borderRadius: 20,
            }}>
              RECOMENDADO
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              pro
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
              R$ 19
              <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>/mês</span>
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: 'var(--muted)', marginBottom: 24 }}>
              cancele quando quiser
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PRO_FEATURES.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#f59e0b', flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: 'var(--text)' }}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {done || isAlreadyPro ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, color: '#f59e0b', marginBottom: 8 }}>⚡ Pro ativo</div>
              <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
                Você agora tem acesso a missões nível 3 e troca de trilha ilimitada.
              </p>
              <Link href="/missions" style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700,
                color: '#000', background: '#f59e0b', borderRadius: 8,
                padding: '10px 24px', textDecoration: 'none', display: 'inline-block',
              }}>
                ver missões →
              </Link>
            </div>
          ) : (
            <>
              {!user && (
                <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: 'var(--muted)' }}>
                  Faça login para assinar o plano Pro.
                </p>
              )}
              <button
                disabled={upgrading || !user}
                onClick={handleUpgrade}
                style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700,
                  color: '#000', background: upgrading ? 'rgba(245,158,11,0.5)' : '#f59e0b',
                  border: 'none', borderRadius: 10, padding: '14px 40px',
                  cursor: upgrading || !user ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {upgrading ? 'processando...' : 'assinar pro — R$ 19/mês →'}
              </button>
              {error && (
                <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#ef4444' }}>{error}</p>
              )}
              <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 11, color: 'var(--muted)', textAlign: 'center', maxWidth: 380 }}>
                Integração com pagamento em breve. Por enquanto, o upgrade é gratuito para testar.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
