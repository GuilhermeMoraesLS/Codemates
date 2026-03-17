'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  getMyMission, getGroupRanking, submitDelivery, getGroup, getGroupFeed,
  type User, type Group, type MissionV2, type RankingMember, type SubmitResult, type FeedEvent,
} from '@/lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const TRILHA_COLOR: Record<string, string> = {
  qualidade:    'var(--green)',
  devops:       'var(--cyan)',
  arquitetura:  'var(--purple)',
  integracao:   '#f59e0b',
  'integração': '#f59e0b',
}

const RANK_COLOR = ['', 'var(--green)', 'var(--cyan)', 'var(--purple)']

const NIVEL_BADGE: Record<string, string> = {
  INICIANTE:  'var(--muted)',
  DEV:        'var(--cyan)',
  ENGENHEIRO: 'var(--green)',
  'SÊNIOR':   'var(--purple)',
  ARQUITETO:  '#FFD700',
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

export default function MissionPage() {
  const router   = useRouter()
  const params   = useParams()
  const groupId  = params.groupId as string

  const [user, setUser]                 = useState<User | null>(null)
  const [group, setGroup]               = useState<Group | null>(null)
  const [mission, setMission]           = useState<MissionV2 | null>(null)
  const [missionLoading, setMissionLoading] = useState(true)
  const [ranking, setRanking]           = useState<{ semanal: RankingMember[]; geral: RankingMember[] } | null>(null)
  const [rankingLoading, setRankingLoading] = useState(true)
  const [activeTab, setActiveTab]       = useState<'semanal' | 'geral'>('semanal')

  const [feed, setFeed]                 = useState<FeedEvent[]>([])
  const [showStreakCelebration, setShowStreakCelebration] = useState(false)
  const [streakNovo, setStreakNovo]     = useState(0)

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
    if (!groupId) return
    getGroup(groupId).then(setGroup).catch(() => {})
    getGroupRanking(groupId)
      .then(setRanking)
      .catch(() => setRanking(null))
      .finally(() => setRankingLoading(false))
    getGroupFeed(groupId)
      .then(r => setFeed(r.eventos))
      .catch(() => setFeed([]))
  }, [groupId])

  useEffect(() => {
    if (!groupId) return
    setMissionLoading(true)
    getMyMission(groupId)
      .then(m => {
        setMission(m)
        // If already delivered from a prior session, jump to approved state
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
      })
      .catch(() => setMission(null))
      .finally(() => setMissionLoading(false))
  }, [groupId])

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

    // Minimum terminal display time so animation plays fully
    const [result] = await Promise.allSettled([
      submitDelivery(mission.id, commitUrl.trim()),
      new Promise(r => setTimeout(r, 3200)),
    ])

    if (result.status === 'rejected') {
      const msg = result.reason?.message ?? 'Erro ao verificar o commit'
      setSubmitError(msg)
      setPhase('rejected')
      setSubmitResult(null)
      return
    }

    const res = result.value as SubmitResult
    setSubmitResult(res)
    setPhase(res.aprovado ? 'approved' : 'rejected')

    if (res.aprovado && res.streak_coletivo_novo) {
      setTimeout(() => {
        setStreakNovo(res.streak_coletivo_novo!)
        setShowStreakCelebration(true)
      }, 1500)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const trilhaColor = (t: string) => TRILHA_COLOR[t?.toLowerCase()] ?? 'var(--muted)'
  const rankColor   = (pos: number) => pos <= 3 ? RANK_COLOR[pos] : 'var(--muted)'

  function getDiasRestantes(): number {
    const day = new Date().getUTCDay() // 0=Sun
    return day === 0 ? 0 : 7 - day
  }

  function formatTimestamp(ts: string): string {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffH = Math.floor(diffMs / 3600000)
    const diffD = Math.floor(diffMs / 86400000)
    if (diffH < 1) return 'agora'
    if (diffH < 24) return `${diffH}h atrás`
    if (diffD < 7) return `${diffD}d atrás`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  if (!user) return null

  const ring        = NIVEL_RING[user.nivel] ?? NIVEL_RING.INICIANTE
  const currentIdx  = NIVEL_ORDER.indexOf(user.nivel)
  const xpProgresso = user.pontos_total % 500
  const xpPct       = (xpProgresso / 500) * 100
  const nextNivel   = currentIdx < NIVEL_ORDER.length - 1 ? NIVEL_ORDER[currentIdx + 1] : null

  const rankingList = activeTab === 'semanal'
    ? (ranking?.semanal ?? [])
    : (ranking?.geral ?? [])

  const bonus30 = mission ? Math.round(mission.pontos * 0.3) : 0
  const bonus20 = mission ? Math.round(mission.pontos * 0.2) : 0

  // ── Render ─────────────────────────────────────────────────────────────────

  const diasRestantes = getDiasRestantes()

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>

      {/* ── Streak Celebration ───────────────────────────────────── */}
      {showStreakCelebration && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(10,14,26,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.3s ease',
          }}
          onClick={() => setShowStreakCelebration(false)}
        >
          <div style={{
            background: 'var(--bg3)',
            border: '2px solid rgba(0,255,148,0.4)',
            boxShadow: '0 0 80px rgba(0,255,148,0.15)',
            borderRadius: 20, padding: '40px 52px',
            textAlign: 'center', maxWidth: 400,
            animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔥</div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
              color: 'var(--green)', letterSpacing: '0.25em', marginBottom: 8,
            }}>
              // streak coletivo
            </div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontWeight: 800,
              fontSize: 52, color: 'var(--green)',
              textShadow: '0 0 30px rgba(0,255,148,0.5)',
              marginBottom: 8,
            }}>
              {streakNovo}
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>
              todo o grupo entregou esta semana!
            </div>
            <button
              onClick={() => setShowStreakCelebration(false)}
              style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                color: 'var(--muted)', background: 'transparent',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '8px 20px', cursor: 'pointer',
              }}
            >
              continuar →
            </button>
          </div>
        </div>
      )}

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

        {/* Pro CTA + Logout */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {user?.plano !== 'pro' && (
            <button
              onClick={() => router.push('/pro')}
              style={{
                width: '100%', fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                color: '#f59e0b', background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6,
                padding: '7px 0', cursor: 'pointer',
              }}
            >
              ⚡ upgrade pro
            </button>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => user && router.push(`/u/${user.username}`)}
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--cyan)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              portfólio →
            </button>
            <button
              onClick={() => { localStorage.removeItem('codemates_token'); localStorage.removeItem('codemates_user'); router.push('/') }}
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.15s ease' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              sair
            </button>
          </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {group && (
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
                  {group.nome}
                </div>
              )}
              {/* Countdown + streak */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                  color: diasRestantes <= 1 ? '#ef4444' : diasRestantes <= 3 ? '#f59e0b' : 'var(--muted)',
                  background: diasRestantes <= 1 ? 'rgba(239,68,68,0.08)' : 'var(--bg2)',
                  border: `1px solid ${diasRestantes <= 1 ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`,
                  padding: '4px 10px', borderRadius: 6,
                }}>
                  {diasRestantes === 0 ? 'último dia' : `${diasRestantes}d restantes`}
                </span>
                {group && group.streak_coletivo > 0 && (
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                    color: 'var(--green)',
                  }}>
                    🔥 {group.streak_coletivo}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 1: Mission Card ───────────────────────────── */}
          {missionLoading ? (
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
          ) : mission === null ? (
            /* No mission generated yet */
            <div style={{
              background: 'var(--bg3)', border: '1px dashed var(--border)',
              borderRadius: 16, padding: '40px 32px',
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32,
            }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)' }}>
                // missões desta semana ainda não foram geradas
              </span>
              <span className="animate-blink" style={{ color: 'var(--green)', fontSize: 16 }}>█</span>
            </div>
          ) : (
            /* Mission card */
            <div style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 16, overflow: 'hidden', marginBottom: 32,
            }}>
              {/* Card header */}
              <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border)',
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
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 800,
                  color: trilhaColor(mission.trilha),
                }}>
                  {mission.pontos} XP
                </span>
              </div>

              {/* Card body */}
              <div style={{ padding: '24px 28px' }}>
                {/* Title */}
                <h2 style={{
                  fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700,
                  color: 'var(--text)', marginBottom: 16,
                }}>
                  {mission.titulo}
                </h2>

                {/* Contexto mercado */}
                {mission.contexto_mercado && (
                  <div style={{
                    background: 'rgba(0, 212, 255, 0.06)',
                    border: '1px solid rgba(0, 212, 255, 0.25)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: 16,
                  }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--cyan)', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      🏢 por que isso importa
                    </span>
                    <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: 'rgba(0, 212, 255, 0.85)', lineHeight: 1.6, margin: 0 }}>
                      {mission.contexto_mercado}
                    </p>
                  </div>
                )}

                {/* Description */}
                <p style={{
                  fontFamily: 'Space Grotesk, sans-serif', fontSize: 14,
                  color: 'var(--text)', lineHeight: 1.7, marginBottom: 20,
                }}>
                  {mission.descricao}
                </p>

                {/* Exemplo commit */}
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

                {/* Bonus info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--cyan)', opacity: 0.8 }}>
                    ⚡ entregue até quarta → +{bonus30} XP bônus
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--cyan)', opacity: 0.8 }}>
                    ⚡ entregue até quinta → +{bonus20} XP bônus
                  </span>
                </div>

                {/* ── Footer: submit states ───────────────────────── */}

                {/* STATE B — Verifying terminal */}
                {phase === 'verifying' && (
                  <div style={{
                    border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
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
                      {submitResult.ranking_pos_atual && (
                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>
                            você está em
                          </div>
                          <div style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 800,
                            color: rankColor(submitResult.ranking_pos_atual),
                          }}>
                            #{submitResult.ranking_pos_atual} esta semana
                          </div>
                        </div>
                      )}
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
                        fontFamily: 'Space Grotesk, sans-serif', fontSize: 14,
                        color: 'var(--text)', lineHeight: 1.65, marginBottom: 16,
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
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                          outline: 'none',
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

                {/* STATE A — Idle (no delivery yet) */}
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
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                        outline: 'none',
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

          {/* ── Section 2: Ranking ────────────────────────────────── */}
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              // ranking do grupo
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
              {(['semanal', 'geral'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={activeTab === tab ? 'tab-active' : 'tab-inactive'}
                  style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '8px 18px',
                  }}
                >
                  {tab === 'semanal' ? 'esta semana' : 'geral'}
                </button>
              ))}
            </div>

            {/* Members list */}
            {rankingLoading ? (
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)', padding: '16px 0' }}>
                // carregando...
              </div>
            ) : rankingList.length === 0 ? (
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)', padding: '16px 0' }}>
                // nenhum dado disponível ainda
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {rankingList.map(member => {
                  const isMe = member.user_id === user.id
                  const pos  = member.posicao
                  const noBadge = NIVEL_BADGE[member.nivel] ?? 'var(--muted)'
                  const pontos  = activeTab === 'semanal' ? member.pontos_semana : member.pontos_total
                  const naoEntregou = activeTab === 'semanal' && member.missoes_entregues === 0

                  return (
                    <div
                      key={member.user_id}
                      className={isMe ? 'ranking-row ranking-row-me' : 'ranking-row'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 8,
                      }}
                    >
                      {/* Position */}
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
                        color: pos <= 3 ? rankColor(pos) : 'var(--muted)',
                        width: 28, flexShrink: 0,
                      }}>
                        {pos <= 3 ? '⌁' : ''}{pos}
                      </span>

                      {/* Avatar */}
                      {member.avatar ? (
                        <img src={member.avatar} alt={member.username} style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg2)', flexShrink: 0 }} />
                      )}

                      {/* Username */}
                      <span style={{
                        fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 600,
                        color: isMe ? 'var(--text)' : 'var(--text)', flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {member.username}
                      </span>

                      {/* Nivel badge */}
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                        color: noBadge, background: `${noBadge}15`,
                        border: `1px solid ${noBadge}30`,
                        padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                      }}>
                        {member.nivel}
                      </span>

                      {/* Points */}
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700,
                        color: naoEntregou ? 'var(--muted)' : (pos <= 3 ? rankColor(pos) : 'var(--text)'),
                        flexShrink: 0, minWidth: 60, textAlign: 'right',
                      }}>
                        {naoEntregou ? '—' : `${pontos} XP`}
                      </span>

                      {/* Missoes count or pending tag */}
                      {naoEntregou ? (
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 9, flexShrink: 0,
                          color: diasRestantes <= 1 ? '#ef4444' : '#f59e0b',
                        }}>
                          {diasRestantes === 0 ? 'último dia' : `${diasRestantes}d`}
                        </span>
                      ) : (
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                          {activeTab === 'semanal' ? member.missoes_entregues : member.missoes_entregues}✓
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Section 3: Activity Feed ──────────────────────────── */}
          {feed.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 16,
              }}>
                // atividade do grupo
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {feed.map((ev, i) => {
                  const tc = ev.trilha ? (TRILHA_COLOR[ev.trilha.toLowerCase()] ?? 'var(--muted)') : 'var(--muted)'
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 8,
                        background: i === 0 ? 'rgba(0,255,148,0.03)' : 'transparent',
                      }}
                    >
                      {/* Avatar */}
                      {ev.avatar ? (
                        <img src={ev.avatar} alt={ev.username} style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg2)', flexShrink: 0 }} />
                      )}

                      {/* Event content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {ev.tipo === 'missao_concluida' ? (
                          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: 'var(--text)' }}>
                            <strong>{ev.username}</strong>
                            <span style={{ color: 'var(--muted)' }}> completou </span>
                            <span style={{ color: tc }}>{ev.titulo_missao}</span>
                          </span>
                        ) : (
                          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: 'var(--text)' }}>
                            <strong>{ev.username}</strong>
                            <span style={{ color: 'var(--muted)' }}> entrou no grupo</span>
                          </span>
                        )}
                      </div>

                      {/* XP earned */}
                      {ev.tipo === 'missao_concluida' && ev.xp > 0 && (
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                          color: 'var(--green)', flexShrink: 0,
                        }}>
                          +{ev.xp} XP
                        </span>
                      )}

                      {/* Timestamp */}
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                        color: 'var(--muted)', flexShrink: 0,
                      }}>
                        {formatTimestamp(ev.timestamp)}
                      </span>
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
