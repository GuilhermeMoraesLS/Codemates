'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getUserPortfolio, type PortfolioResponse, type CompletedMission, type Achievement, type ActivityWeek } from '@/lib/api'

// ── Constants ──────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const NIVEL_COLOR: Record<string, string> = {
  INICIANTE:  '#00FF94',
  DEV:        '#00D4FF',
  ENGENHEIRO: '#8B5CF6',
  'SÊNIOR':   '#f59e0b',
  ARQUITETO:  '#ef4444',
}

const TRILHA_COLOR: Record<string, string> = {
  qualidade:    '#00FF94',
  testes:       '#ec4899',
  devops:       '#00D4FF',
  arquitetura:  '#8B5CF6',
  integracao:   '#f59e0b',
  'integração': '#f59e0b',
}

const NIVEL_ORDER = ['INICIANTE', 'DEV', 'ENGENHEIRO', 'SÊNIOR', 'ARQUITETO']

function xpForLevel(nivel: string): number {
  const map: Record<string, number> = { INICIANTE: 0, DEV: 500, ENGENHEIRO: 1500, 'SÊNIOR': 3500, ARQUITETO: 7000 }
  return map[nivel] ?? 0
}

function xpForNextLevel(nivel: string): number {
  const idx = NIVEL_ORDER.indexOf(nivel)
  const next = NIVEL_ORDER[idx + 1]
  if (!next) return xpForLevel(nivel)
  return xpForLevel(next)
}

function heatmapIntensity(xp: number): string {
  if (xp === 0) return 'var(--border)'
  if (xp < 80)  return 'rgba(0,255,148,0.18)'
  if (xp < 150) return 'rgba(0,255,148,0.4)'
  if (xp < 250) return 'rgba(0,255,148,0.65)'
  return 'rgba(0,255,148,0.9)'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `${days}d atrás`
  if (days < 30) return `${Math.floor(days / 7)}sem atrás`
  return `${Math.floor(days / 30)}m atrás`
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PublicProfilePage() {
  const params = useParams()
  const username = typeof params.username === 'string' ? params.username : ''

  const [data, setData]       = useState<PortfolioResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied]   = useState(false)

  useEffect(() => {
    if (!username) return
    getUserPortfolio(username)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [username])

  const handleCopyBadge = () => {
    const md = `[![Codemates](${API_URL}/users/${username}/badge.svg)](https://codemates.dev/u/${username})`
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)' }}>carregando...</span>
    </div>
  )

  if (notFound || !data) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, color: 'var(--green)' }}>&gt;_</span>
      <p style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--muted)' }}>perfil não encontrado</p>
      <Link href="/" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--cyan)', textDecoration: 'none' }}>← início</Link>
    </div>
  )

  const { user, github_profile, completed_missions, achievements, activity } = data
  const nivelColor = NIVEL_COLOR[user.nivel] ?? '#00FF94'
  const nivelIdx = NIVEL_ORDER.indexOf(user.nivel)
  const nextNivel = NIVEL_ORDER[nivelIdx + 1]
  const xpCurrent = user.pontos_total - xpForLevel(user.nivel)
  const xpNeeded  = xpForNextLevel(user.nivel) - xpForLevel(user.nivel)
  const xpPct     = nextNivel ? Math.min(100, Math.round((xpCurrent / xpNeeded) * 100)) : 100

  const topLanguages = Object.entries(github_profile.linguagens_json || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5)
  const maxLang = topLanguages[0]?.[1] as number || 1

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Topbar */}
      <div style={{
        borderBottom: '1px solid var(--border)', padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700, color: 'var(--green)', textDecoration: 'none' }}>
          &gt;_ codemates
        </Link>
        <Link href="/dashboard" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', textDecoration: 'none' }}>
          entrar →
        </Link>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--surface, #151C30)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '32px 28px',
          display: 'flex', flexDirection: 'column', gap: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {/* Avatar with level ring */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                border: `3px solid ${nivelColor}`,
                boxShadow: `0 0 20px ${nivelColor}40`,
                overflow: 'hidden', background: 'var(--bg)',
              }}>
                {user.avatar
                  ? <img src={user.avatar} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 22, color: nivelColor }}>&gt;_</div>
                }
              </div>
              {user.plano === 'pro' && (
                <div style={{
                  position: 'absolute', bottom: -4, right: -4,
                  background: '#f59e0b', borderRadius: 8, padding: '2px 6px',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700, color: '#000',
                }}>PRO</div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                {user.username}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
                  color: nivelColor, background: `${nivelColor}15`,
                  border: `1px solid ${nivelColor}40`, borderRadius: 4, padding: '3px 8px',
                }}>
                  {user.nivel}
                </span>
                {github_profile.especialidade_detectada && (
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: 'var(--muted)' }}>
                    {github_profile.especialidade_detectada}
                  </span>
                )}
              </div>
            </div>

            {/* Badge copy */}
            <button
              onClick={handleCopyBadge}
              style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                color: copied ? 'var(--green)' : 'var(--muted)',
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
                transition: 'color 0.2s',
              }}
            >
              {copied ? '✓ copiado' : '⎋ badge README'}
            </button>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'missões', value: user.missoes_concluidas },
              { label: 'streak', value: `${user.streak_atual}w` },
              { label: 'XP total', value: user.pontos_total.toLocaleString() },
              { label: 'repos', value: github_profile.repos_publicos || 0 },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{s.value}</div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 11, color: 'var(--muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* XP progress bar */}
          {nextNivel && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)' }}>{user.nivel}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)' }}>{nextNivel} · {xpPct}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${xpPct}%`, background: nivelColor, borderRadius: 2, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          )}

          {/* Badge preview */}
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              // badge para README
            </div>
            <img
              src={`${API_URL}/users/${user.username}/badge.svg`}
              alt="Codemates badge"
              style={{ display: 'block', height: 56, borderRadius: 8 }}
            />
          </div>
        </div>

        {/* ── GitHub Languages ────────────────────────────────────── */}
        {topLanguages.length > 0 && (
          <div style={{ background: 'var(--surface, #151C30)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              // stack
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topLanguages.map(([lang, pct]) => (
                <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text)', width: 110, flexShrink: 0 }}>{lang}</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.round(((pct as number) / maxLang) * 100)}%`,
                      background: 'var(--cyan)', borderRadius: 3,
                    }} />
                  </div>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', width: 36, textAlign: 'right' }}>{pct}%</span>
                </div>
              ))}
            </div>
            {github_profile.nivel_mercado && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: 'var(--muted)' }}>
                nível de mercado: <span style={{ color: 'var(--text)' }}>{github_profile.nivel_mercado}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Activity Heatmap ────────────────────────────────────── */}
        <div style={{ background: 'var(--surface, #151C30)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
            // atividade — últimas 26 semanas
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {activity.map(w => (
              <div
                key={w.semana_ref}
                title={`${w.semana_ref}: ${w.xp} XP`}
                style={{
                  width: 16, height: 16, borderRadius: 3,
                  background: heatmapIntensity(w.xp),
                  cursor: w.xp > 0 ? 'default' : undefined,
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Completed Missions ─────────────────────────────────── */}
        {completed_missions.length > 0 && (
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              // missões concluídas — {completed_missions.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {completed_missions.map(m => {
                const tc = TRILHA_COLOR[m.trilha] ?? '#64748b'
                const total = (m.pontos_ganhos || 0) + (m.pontos_bonus || 0)
                return (
                  <div key={m.id} style={{
                    background: 'var(--surface, #151C30)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 4, height: 36, borderRadius: 2,
                      background: tc, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: 'var(--text)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.titulo}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: tc }}>{m.trilha}</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)' }}>{m.semana_ref}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>+{total}</div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)' }}>{relativeTime(m.verificado_em)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Achievements ───────────────────────────────────────── */}
        {achievements.length > 0 && (
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              // conquistas — {achievements.length}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {achievements.map(a => (
                <div key={a.id} style={{
                  background: 'var(--surface, #151C30)', border: '1px solid var(--green)',
                  boxShadow: '0 0 10px rgba(0,255,148,0.08)',
                  borderRadius: 10, padding: '14px 16px',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{a.icone}</div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{a.nome}</div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 11, color: 'var(--muted)' }}>{a.descricao}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <Link href="/" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--green)', textDecoration: 'none' }}>
            &gt;_ codemates — evolução técnica semanal
          </Link>
        </div>
      </div>
    </div>
  )
}
