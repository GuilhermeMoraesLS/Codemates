'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@/lib/api'

const NIVEL_COLORS: Record<string, string> = {
  INICIANTE: 'var(--muted)',
  DEV: 'var(--cyan)',
  ENGENHEIRO: 'var(--green)',
  'SÊNIOR': 'var(--purple)',
  ARQUITETO: '#FFD700',
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('codemates_token')
    const userData = localStorage.getItem('codemates_user')
    if (!token || !userData) {
      router.push('/')
      return
    }
    setUser(JSON.parse(userData))
  }, [router])

  function handleLogout() {
    localStorage.removeItem('codemates_token')
    localStorage.removeItem('codemates_user')
    router.push('/')
  }

  if (!user) return null

  const nivelColor = NIVEL_COLORS[user.nivel] || 'var(--green)'

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 48px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 16,
            color: 'var(--text)',
          }}>
            code<span style={{ color: 'var(--green)' }}>mates</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
            color: 'var(--muted)',
          }}>
            @{user.username}
          </span>
          <button onClick={handleLogout} style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
            padding: '6px 14px', borderRadius: 6,
            background: 'transparent', color: 'var(--muted)',
            border: '1px solid var(--border)', cursor: 'pointer',
          }}>
            sair
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px' }}>
        {/* Welcome header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
            color: 'var(--green)', letterSpacing: '0.2em', textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            // dashboard
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {user.avatar && (
              <img
                src={user.avatar}
                alt={user.username}
                style={{ width: 56, height: 56, borderRadius: 14, border: '2px solid var(--border)' }}
              />
            )}
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
                Olá, {user.username}
              </h1>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600,
                  padding: '3px 10px', borderRadius: 100,
                  background: `${nivelColor}18`,
                  color: nivelColor,
                  border: `1px solid ${nivelColor}40`,
                }}>
                  &gt; {user.nivel}
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                  color: 'var(--cyan)',
                  padding: '3px 10px', borderRadius: 100,
                  background: 'rgba(0,212,255,0.08)',
                  border: '1px solid rgba(0,212,255,0.2)',
                }}>
                  🔥 {user.streak_atual} semanas
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16, marginBottom: 48,
        }}>
          {[
            { label: 'Missões concluídas', value: user.missoes_concluidas, color: 'var(--green)' },
            { label: 'Streak atual', value: `${user.streak_atual}w`, color: 'var(--cyan)' },
            { label: 'Pontos totais', value: user.pontos_total.toLocaleString(), color: 'var(--purple)' },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '24px',
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontWeight: 800,
                fontSize: 32, color: stat.color, lineHeight: 1, marginBottom: 8,
              }}>
                {stat.value}
              </div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Groups section — placeholder */}
        <div style={{
          background: 'var(--bg3)', border: '1px dashed var(--border)',
          borderRadius: 16, padding: '48px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
            color: 'var(--muted)', marginBottom: 16,
          }}>
            // nenhum grupo ainda
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            Crie ou entre em um grupo
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24, maxWidth: 360 }}>
            Grupos de 3-7 devs. Missões semanais geradas por IA. Verificação automática via GitHub.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => router.push('/groups/new')}
              style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600,
                padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'var(--green)', color: '#0A0E1A',
              }}
            >
              ▶ Criar grupo
            </button>
            <button
              onClick={() => router.push('/groups/join')}
              style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600,
                padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
                background: 'transparent', color: 'var(--green)',
                border: '1px solid rgba(0,255,148,0.3)',
              }}
            >
              Entrar via convite
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
