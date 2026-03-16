'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getMyIndividualMission, getMissionHistory, submitDelivery,
  type User, type MissionV2, type MissionHistory, type SubmitResult,
} from '@/lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const TRILHA_COLOR: Record<string, string> = {
  qualidade:    'var(--green)',
  devops:       'var(--cyan)',
  arquitetura:  'var(--purple)',
  integracao:   '#f59e0b',
  'integração': '#f59e0b',
}

const NIVEL_RING: Record<string, { solid: string }> = {
  INICIANTE:  { solid: '#00FF94' },
  DEV:        { solid: '#00D4FF' },
  ENGENHEIRO: { solid: '#8B5CF6' },
  'SÊNIOR':   { solid: '#f59e0b' },
  ARQUITETO:  { solid: '#ef4444' },
}

const NIVEL_ORDER = ['INICIANTE', 'DEV', 'ENGENHEIRO', 'SÊNIOR', 'ARQUITETO']

const NAV_ITEMS = [
  { icon: '⌂', label: 'dashboard', href: '/dashboard', soon: false },
  { icon: '⚔', label: 'missões',   href: '/missions',  soon: false },
  { icon: '◈', label: 'meu grupo', href: '/groups',    soon: true  },
  { icon: '◎', label: 'ranking',   href: '/ranking',   soon: true  },
]

const VERIFY_LINES = [
  '> analisando commit...',
  '> checando critérios da missão...',
  '> gerando feedback...',
]

type SubmitPhase = 'idle' | 'verifying' | 'approved' | 'rejected'

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyMissionsPage() {
  const router = useRouter()

  const [user, setUser]                     = useState<User | null>(null)
  const [mission, setMission]               = useState<MissionV2 | null>(null)
  const [missionLoading, setMissionLoading] = useState(true)
  const [generating, setGenerating]         = useState(false)
  const [history, setHistory]               = useState<MissionHistory[]>([])

  const [commitUrl, setCommitUrl]       = useState('')
  const [phase, setPhase]               = useState<SubmitPhase>('idle')
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [verifyStep, setVerifyStep]     = useState(0)
  const [submitError, setSubmitError]   = useState<string | null>(null)

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const token    = localStorage.getItem('codemates_token')
    const userData = localStorage.getItem('codemates_user')
    if (!token || !userData) { router.push('/'); return }
    setUser(JSON.parse(userData))
  }, [router])

  useEffect(() => {
    if (!user) return
    setMissionLoading(true)

    getMyIndividualMission()
      .then(m => {
        if (m === null) {
          setGenerating(false)
          setMission(null)
        } else if ('generating' in m) {
          setGenerating(true)
          setMission(null)
        } else {
          setGenerating(false)
          setMission(m)
          if (m.entregue && m.entrega) {
            setSubmitResult({
              aprovado: true,
              feedback: 'Esta missão já foi entregue e verificada anteriormente.',
              criterio_falhou: null,
              criterios_resultado: {},
              pontos_ganhos: m.entrega.pontos_ganhos,
              pontos_bonus:  m.entrega.pontos_bonus ?? 0,
              ranking_pos_atual: null,
            })
            setPhase('approved')
          }
        }
      })
      .catch(() => { setGenerating(false); setMission(null) })
      .finally(() => setMissionLoading(false))

    getMissionHistory()
      .then(r => setHistory(r.missoes))
      .catch(() => setHistory([]))
  }, [user?.id])

  // ── Verify terminal animation ───────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'verifying') return
    setVerifyStep(0)
    const t1 = setTimeout(() => setVerifyStep(1), 0)
    const t2 = setTimeout(() => setVerifyStep(2), 1200)
    const t3 = setTimeout(() => setVerifyStep(3), 2400)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [phase])

  // ── Submit handler ─────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!mission || !commitUrl.trim()) return
    setSubmitError(null)
    setPhase('verifying')

    const [result] = await Promise.allSettled([
      submitDelivery(mission.id, commitUrl.trim()),
      new Promise(r => setTimeout(r, 3200)),
    ])

    if (result.status === 'rejected') {
      setSubmitError(result.reason?.message ?? 'Erro ao verificar o commit')
      setPhase('rejected')
      setSubmitResult(null)
      return
    }

    const res = result.value as SubmitResult
    setSubmitResult(res)
    setPhase(res.aprovado ? 'approved' : 'rejected')
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const trilhaColor = (t: string) => TRILHA_COLOR[t?.toLowerCase()] ?? 'var(--muted)'

  if (!user) return null

  const ring        = NIVEL_RING[user.nivel] ?? NIVEL_RING.INICIANTE
  const currentIdx  = NIVEL_ORDER.indexOf(user.nivel)
  const xpProgresso = user.pontos_total % 500
  const xpPct       = (xpProgresso / 500) * 100
  const nextNivel   = currentIdx < NIVEL_ORDER.length - 1 ? NIVEL_ORDER[currentIdx + 1] : null

  const bonus30 = mission ? Math.round(mission.pontos * 0.3) : 0
  const bonus20 = mission ? Math.round(mission.pontos * 0.2) : 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className="sidebar-fixed"
        style={{
          position: 'fixed', left: 0, top: 0,
          height: '100vh', width: 220,
          background: 'var(--bg3)',
          borderRight: '1px solid var(--border)',
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '24px 20px 16px' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
            code<span style={{ color: 'var(--green)' }}>mates</span>
          </span>
        </div>

        {/* User */}
        <div style={{ padding: '0 16px 20px' }}>
          {user.avatar && (
            <img src={user.avatar} alt={user.username} style={{
              width: 48, height: 48, borderRadius: 12, display: 'block',
              boxShadow: `0 0 0 2px ${ring.solid}, 0 0 12px ${ring.solid}30`,
            }} />
          )}
          <div style={{
            fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 600,
            color: 'var(--text)', marginTop: 10,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user.username}
          </div>
          <span style={{
            display: 'inline-block',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            color: ring.solid, background: `${ring.solid}15`,
            border: `1px solid ${ring.solid}40`,
            padding: '2px 8px', borderRadius: 20, marginTop: 6,
          }}>
            &gt; {user.nivel}
          </span>
          <div style={{ width: '100%', height: 4, background: 'var(--bg2)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${xpPct}%`,
              background: 'linear-gradient(90deg, var(--green), var(--cyan))',
              borderRadius: 2, transition: 'width 1s ease',
            }} />
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>
            {xpProgresso} / 500 XP → {nextNivel ?? 'MAX'}
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />

        {/* Nav */}
        <div style={{ padding: '16px 8px' }}>
          {NAV_ITEMS.map(item => {
            const isActive = item.label === 'missões'
            return (
              <div
                key={item.label}
                onClick={item.soon ? undefined : () => router.push(item.href)}
                style={{
                  padding: '8px 12px', borderRadius: 8, marginBottom: 2,
                  cursor: item.soon ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                  opacity: item.soon ? 0.5 : 1,
                  background: isActive ? 'rgba(0,255,148,0.07)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--green)' : '2px solid transparent',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => { if (!isActive && !item.soon) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg2)' }}
                onMouseLeave={e => { if (!isActive && !item.soon) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: isActive ? 'var(--green)' : 'var(--muted)' }}>
                  {item.icon}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: isActive ? 'var(--green)' : 'var(--muted)', flex: 1 }}>
                  {item.label}
                </span>
                {item.soon && (
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: 'var(--muted)', background: 'var(--bg2)', padding: '1px 5px', borderRadius: 3 }}>
                    em breve
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />

        {/* Trilha */}
        <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14 }}>
            // trilha
          </div>
          {NIVEL_ORDER.map((nivel, i) => {
            const isPast    = i < currentIdx
            const isCurrent = i === currentIdx
            const nRing     = NIVEL_RING[nivel]
            return (
              <div key={nivel} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: isCurrent ? '4px 8px' : '4px 0',
                borderRadius: isCurrent ? 6 : 0,
                background:  isCurrent ? `${nRing.solid}10` : 'transparent',
                border:      isCurrent ? `1px solid ${nRing.solid}25` : '1px solid transparent',
                marginBottom: 6,
              }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: isPast ? 'var(--green)' : isCurrent ? 'var(--cyan)' : 'var(--muted)' }}>
                  {isPast ? '✓' : isCurrent ? '→' : '○'}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: isPast ? 'var(--green)' : isCurrent ? 'var(--cyan)' : 'var(--muted)', opacity: i > currentIdx ? 0.4 : 1 }}>
                  {nivel}
                </span>
              </div>
            )
          })}
        </div>

        {/* Logout */}
        <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => { localStorage.removeItem('codemates_token'); localStorage.removeItem('codemates_user'); router.push('/') }}
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.15s ease' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            sair
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <div className="main-sidebar-offset">
        <main style={{ maxWidth: 860, margin: '0 auto', padding: '48px 32px' }}>

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--green)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
              // missão da semana
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              individual
            </div>
          </div>

          {/* ── Section 1: Mission Card ───────────────────────────── */}
          {missionLoading ? (
            /* Loading skeleton */
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px', marginBottom: 32 }}>
              {[80, 50, 95, 60].map((w, i) => (
                <div key={i} style={{
                  height: i === 0 ? 14 : 10, width: `${w}%`, borderRadius: 4, marginBottom: 14,
                  background: 'linear-gradient(90deg, var(--bg2) 25%, var(--bg3) 50%, var(--bg2) 75%)',
                  backgroundSize: '200% auto', animation: 'shimmer 1.5s linear infinite',
                  animationDelay: `${i * 0.1}s`,
                }} />
              ))}
            </div>

          ) : generating ? (
            /* Generating state — terminal style */
            <div style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 16, overflow: 'hidden', marginBottom: 32,
            }}>
              <div style={{
                background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
                padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {['#ff5f57', '#febc2e', '#28c840'].map(c => (
                    <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                  ))}
                </div>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>
                  mission_agent.py
                </span>
              </div>
              <div style={{ background: 'var(--bg)', padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 10, minHeight: 80 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)' }}>
                  // gerando missão personalizada para esta semana...
                </span>
                <span className="animate-blink" style={{ color: 'var(--green)', fontSize: 16 }}>█</span>
              </div>
            </div>

          ) : mission === null ? (
            /* No mission and not generating */
            <div style={{
              background: 'var(--bg3)', border: '1px dashed var(--border)',
              borderRadius: 16, padding: '40px 32px',
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32,
            }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)' }}>
                // nenhuma missão encontrada para esta semana
              </span>
            </div>

          ) : (
            /* Mission card */
            <div style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 16, overflow: 'hidden', marginBottom: 32,
            }}>
              {/* Card header */}
              <div style={{
                padding: '16px 24px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
                  color: trilhaColor(mission.trilha),
                  background: `${trilhaColor(mission.trilha)}15`,
                  border: `1px solid ${trilhaColor(mission.trilha)}40`,
                  padding: '3px 10px', borderRadius: 20,
                }}>
                  {mission.trilha}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)' }}>
                  nível {mission.nivel}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 800, color: trilhaColor(mission.trilha) }}>
                  {mission.pontos} XP
                </span>
              </div>

              {/* Card body */}
              <div style={{ padding: '24px 28px' }}>
                <h2 style={{
                  fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700,
                  color: 'var(--text)', marginBottom: 16,
                }}>
                  {mission.titulo}
                </h2>

                {mission.contexto_mercado && (
                  <>
                    <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.6, marginBottom: 16 }}>
                      {mission.contexto_mercado}
                    </p>
                    <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />
                  </>
                )}

                <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: 'var(--text)', lineHeight: 1.7, marginBottom: 20 }}>
                  {mission.descricao}
                </p>

                {mission.exemplo_commit && (
                  <div style={{
                    background: 'var(--bg)', borderRadius: 8, padding: '12px 16px',
                    borderLeft: '3px solid var(--green)', marginBottom: 16,
                  }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--green)' }}>
                      // exemplo:{' '}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                      {mission.exemplo_commit}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--cyan)', opacity: 0.8 }}>
                    ⚡ entregue até quarta → +{bonus30} XP bônus
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--cyan)', opacity: 0.8 }}>
                    ⚡ entregue até quinta → +{bonus20} XP bônus
                  </span>
                </div>

                {/* STATE B — Verifying terminal */}
                {phase === 'verifying' && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{
                      background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
                      padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {['#ff5f57', '#febc2e', '#28c840'].map(c => (
                          <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                        ))}
                      </div>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>
                        verification_agent.py
                      </span>
                    </div>
                    <div style={{ background: 'var(--bg)', padding: '16px 20px', minHeight: 100, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {VERIFY_LINES.map((line, i) => {
                        if (verifyStep <= i) return null
                        const isLast = i === VERIFY_LINES.length - 1
                        return (
                          <div key={i} className="animate-fade-in-up" style={{ display: 'flex', alignItems: 'center', gap: 10, animationDuration: '0.3s' }}>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text)', flex: 1 }}>
                              {line}
                            </span>
                            {isLast
                              ? <span className="animate-blink" style={{ color: 'var(--green)', fontSize: 13 }}>█</span>
                              : <span className="animate-scale-in" style={{ color: 'var(--green)', fontSize: 13, fontWeight: 700, animationDuration: '0.2s' }}>✓</span>
                            }
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* STATE C — Approved */}
                {phase === 'approved' && submitResult && (
                  <div style={{
                    background: 'rgba(0,255,148,0.06)', border: '1px solid rgba(0,255,148,0.25)',
                    borderRadius: 12, padding: '20px 24px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                      <span className="animate-check-pop" style={{ fontSize: 32, lineHeight: 1, color: 'var(--green)' }}>
                        ✓
                      </span>
                      <div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>
                          missão concluída
                        </div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--text)', marginTop: 4 }}>
                          +{submitResult.pontos_ganhos} XP
                          {submitResult.pontos_bonus > 0 && (
                            <span style={{ color: 'var(--cyan)', marginLeft: 8 }}>
                              +{submitResult.pontos_bonus} bônus
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {submitResult.feedback && (
                      <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
                        {submitResult.feedback}
                      </p>
                    )}
                  </div>
                )}

                {/* STATE D — Rejected */}
                {phase === 'rejected' && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)' }}>
                        ○ ainda não aprovado
                      </span>
                    </div>
                    {(submitResult?.feedback || submitError) && (
                      <p style={{
                        fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: 'var(--text)',
                        lineHeight: 1.65, marginBottom: 16,
                        background: 'var(--bg2)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '12px 16px',
                      }}>
                        {submitResult?.feedback ?? submitError}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        value={commitUrl}
                        onChange={e => setCommitUrl(e.target.value)}
                        placeholder="cole o link do commit aqui"
                        style={{
                          flex: 1, background: 'var(--bg2)',
                          border: '1px solid var(--border)', borderRadius: 8,
                          padding: '10px 14px', color: 'var(--text)',
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 12, outline: 'none',
                        }}
                        onFocus={e  => (e.target.style.borderColor = 'var(--green)')}
                        onBlur={e   => (e.target.style.borderColor = 'var(--border)')}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                      />
                      <button
                        className="btn-primary"
                        onClick={handleSubmit}
                        style={{ padding: '10px 18px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}
                      >
                        tentar novamente
                      </button>
                    </div>
                  </div>
                )}

                {/* STATE A — Idle */}
                {phase === 'idle' && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      value={commitUrl}
                      onChange={e => setCommitUrl(e.target.value)}
                      placeholder="cole o link do commit aqui"
                      style={{
                        flex: 1, background: 'var(--bg2)',
                        border: '1px solid var(--border)', borderRadius: 8,
                        padding: '10px 14px', color: 'var(--text)',
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 12, outline: 'none',
                      }}
                      onFocus={e  => (e.target.style.borderColor = 'var(--green)')}
                      onBlur={e   => (e.target.style.borderColor = 'var(--border)')}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    />
                    <button
                      className="btn-primary"
                      onClick={handleSubmit}
                      disabled={!commitUrl.trim()}
                      style={{ padding: '10px 18px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap', opacity: commitUrl.trim() ? 1 : 0.5 }}
                    >
                      verificar entrega →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Section 2: History ────────────────────────────────── */}
          {history.length > 0 && (
            <div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 16,
              }}>
                // histórico
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.map(item => {
                  const tc = trilhaColor(item.trilha)
                  const isConcluida = item.status_entrega === 'concluida'
                  const isAtiva     = item.status_entrega === 'ativa'

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: 'var(--bg2)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '14px 18px',
                        display: 'flex', alignItems: 'center', gap: 14,
                        opacity: item.status_entrega === 'expirada' ? 0.5 : 1,
                      }}
                    >
                      {/* Status icon */}
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 14,
                        color: isConcluida ? 'var(--green)' : isAtiva ? 'var(--cyan)' : 'var(--muted)',
                        flexShrink: 0, width: 18, textAlign: 'center',
                      }}>
                        {isConcluida ? '✓' : isAtiva ? '→' : '○'}
                      </span>

                      {/* Trilha badge */}
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700,
                        color: tc, background: `${tc}15`, border: `1px solid ${tc}40`,
                        padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                      }}>
                        {item.trilha}
                      </span>

                      {/* Title */}
                      <span style={{
                        fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 600,
                        color: 'var(--text)', flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.titulo}
                      </span>

                      {/* Week ref */}
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                        color: 'var(--muted)', flexShrink: 0,
                      }}>
                        {item.semana_ref}
                      </span>

                      {/* Points */}
                      {isConcluida && item.pontos_ganhos !== null && (
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
                          color: 'var(--green)', flexShrink: 0,
                        }}>
                          +{item.pontos_ganhos} XP
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
