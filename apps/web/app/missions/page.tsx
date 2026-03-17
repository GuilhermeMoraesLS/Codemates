'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getMyIndividualMission, getMissionHistory, submitDelivery,
  generateIndividualMission, regenerateIndividualMission,
  getMyActivity, getMyAchievements,
  getMarketMission, acceptMarketMission, submitMarketMission,
  type User, type MissionV2, type MissionHistory, type SubmitResult,
  type ActivityWeek, type Achievement, type MarketMissionResponse,
} from '@/lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const TRILHA_COLOR: Record<string, string> = {
  qualidade:    'var(--green)',
  devops:       'var(--cyan)',
  arquitetura:  'var(--purple)',
  integracao:   '#f59e0b',
  'integração': '#f59e0b',
  testes:       '#ec4899',
}

const TRILHA_OPTIONS = [
  { id: 'qualidade',   icon: '◈', label: 'qualidade',   desc: 'clean code, linting, formatação',  color: 'var(--green)'  },
  { id: 'testes',      icon: '⬡', label: 'testes',      desc: 'unit, integração, E2E, TDD',       color: '#ec4899'       },
  { id: 'devops',      icon: '⚙', label: 'devops',      desc: 'CI/CD, containers, infra',         color: 'var(--cyan)'   },
  { id: 'arquitetura', icon: '◎', label: 'arquitetura', desc: 'design patterns, SOLID, escalável', color: 'var(--purple)' },
  { id: 'integração',  icon: '⬡', label: 'integração',  desc: 'APIs, mensageria, webhooks',        color: '#f59e0b'       },
]

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
type PageState = 'loading' | 'select_trilha' | 'generating' | 'loaded' | 'gen_error'

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyMissionsPage() {
  const router = useRouter()

  const [user, setUser]         = useState<User | null>(null)
  const [mission, setMission]   = useState<MissionV2 | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [genError, setGenError] = useState<string | null>(null)
  const [canRegenerate, setCanRegenerate] = useState(false)
  const [regenerating, setRegenerating]   = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [history, setHistory]       = useState<MissionHistory[]>([])
  const [activity, setActivity]     = useState<ActivityWeek[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([])
  const [marketMission, setMarketMission] = useState<MarketMissionResponse | null>(null)
  const [marketCommitUrl, setMarketCommitUrl] = useState('')
  const [marketPhase, setMarketPhase] = useState<'idle' | 'accepting' | 'submitting' | 'done' | 'rejected'>('idle')
  const [marketResult, setMarketResult] = useState<{ aprovado: boolean; feedback: string; pontos_ganhos: number } | null>(null)

  // Level up ceremony
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [levelUpNivel, setLevelUpNivel] = useState('')

  // Floating XP
  const [floatXP, setFloatXP] = useState<number | null>(null)

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
    setPageState('loading')

    getMyIndividualMission()
      .then(m => {
        if (m === null || 'generating' in m) {
          setMission(null)
          setPageState('select_trilha')
        } else {
          setMission(m)
          setCanRegenerate(m.can_regenerate ?? false)
          setPageState('loaded')
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
      .catch(() => {
        setMission(null)
        setPageState('select_trilha')
      })

    getMissionHistory().then(r => setHistory(r.missoes)).catch(() => setHistory([]))
    getMyActivity().then(setActivity).catch(() => setActivity([]))
    getMyAchievements().then(r => setAchievements(r.achievements)).catch(() => setAchievements([]))
    getMarketMission().then(setMarketMission).catch(() => setMarketMission(null))
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

  // ── Generate handler ───────────────────────────────────────────────────────

  async function handleGenerate(trilha: string) {
    setGenError(null)
    setPageState('generating')
    try {
      const m = await generateIndividualMission(trilha)
      setMission(m)
      setCanRegenerate(m.can_regenerate ?? true)
      setPageState('loaded')
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Erro ao gerar missão')
      setPageState('gen_error')
    }
  }

  // ── Regenerate handler ─────────────────────────────────────────────────────

  async function handleRegenerate() {
    setRegenerating(true)
    setShowRegenConfirm(false)
    setPageState('generating')
    try {
      const m = await regenerateIndividualMission()
      setMission(m)
      setCanRegenerate(false)
      setPhase('idle')
      setSubmitResult(null)
      setCommitUrl('')
      setPageState('loaded')
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Erro ao regenerar missão')
      setPageState('loaded') // keep showing old mission
      setMission(mission)    // restore
    } finally {
      setRegenerating(false)
    }
  }

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

    if (res.aprovado) {
      // Floating XP
      const totalXP = (res.pontos_ganhos ?? 0) + (res.pontos_bonus ?? 0)
      if (totalXP > 0) {
        setFloatXP(totalXP)
        setTimeout(() => setFloatXP(null), 2000)
      }
      // New achievements
      if (res.new_achievements?.length) {
        setNewAchievements(res.new_achievements)
        setAchievements(prev => prev.map(a => {
          const unlocked = res.new_achievements!.find(n => n.id === a.id)
          return unlocked ? { ...a, desbloqueado: true } : a
        }))
      }
      // Level up ceremony
      if (res.leveled_up && res.new_nivel) {
        setTimeout(() => {
          setLevelUpNivel(res.new_nivel!)
          setShowLevelUp(true)
        }, 1800)
      }
    }
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

  const NIVEL_RING_MAP: Record<string, string> = {
    INICIANTE: '#00FF94', DEV: '#00D4FF', ENGENHEIRO: '#8B5CF6', 'SÊNIOR': '#f59e0b', ARQUITETO: '#ef4444',
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>

      {/* ── Floating XP ─────────────────────────────────────────── */}
      {floatXP !== null && (
        <div
          key={floatXP}
          style={{
            position: 'fixed', bottom: 80, right: 40,
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 800,
            fontSize: 28, color: 'var(--green)',
            textShadow: '0 0 20px rgba(0,255,148,0.6)',
            pointerEvents: 'none', zIndex: 9999,
            animation: 'floatUp 2s ease-out forwards',
          }}
        >
          +{floatXP} XP
        </div>
      )}

      {/* ── Level Up Ceremony ────────────────────────────────────── */}
      {showLevelUp && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(10,14,26,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.4s ease',
          }}
          onClick={() => setShowLevelUp(false)}
        >
          <div style={{
            background: 'var(--bg3)',
            border: `2px solid ${NIVEL_RING_MAP[levelUpNivel] ?? '#00FF94'}`,
            boxShadow: `0 0 60px ${NIVEL_RING_MAP[levelUpNivel] ?? '#00FF94'}40`,
            borderRadius: 20, padding: '48px 56px',
            textAlign: 'center', maxWidth: 420,
            animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
              color: NIVEL_RING_MAP[levelUpNivel] ?? 'var(--green)',
              letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 16,
            }}>
              // level up
            </div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontWeight: 800,
              fontSize: 42, color: NIVEL_RING_MAP[levelUpNivel] ?? 'var(--green)',
              textShadow: `0 0 30px ${NIVEL_RING_MAP[levelUpNivel] ?? '#00FF94'}70`,
              marginBottom: 12, letterSpacing: '0.05em',
            }}>
              {levelUpNivel}
            </div>
            <div style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: 14,
              color: 'var(--muted)', marginBottom: 28,
            }}>
              você avançou para um novo nível de carreira
            </div>
            <button
              onClick={() => setShowLevelUp(false)}
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

      {/* ── Achievement Unlock Toast ─────────────────────────────── */}
      {newAchievements.length > 0 && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9998,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {newAchievements.map((a, i) => (
            <div
              key={a.id}
              style={{
                background: 'var(--bg3)', border: '1px solid var(--green)',
                boxShadow: '0 0 20px rgba(0,255,148,0.15)',
                borderRadius: 12, padding: '12px 18px',
                display: 'flex', alignItems: 'center', gap: 12,
                animation: `slideInRight 0.4s ease ${i * 0.15}s both`,
                minWidth: 260,
              }}
            >
              <span style={{ fontSize: 20 }}>{a.icone}</span>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--green)', marginBottom: 2 }}>
                  conquista desbloqueada
                </div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {a.nome}
                </div>
              </div>
              <button
                onClick={() => setNewAchievements(prev => prev.filter(x => x.id !== a.id))}
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: 0 }}
              >
                ×
              </button>
            </div>
          ))}
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

        {/* Pro CTA / Profile links */}
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
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              individual
            </div>
          </div>

          {/* ── Section 1: Mission Card ───────────────────────────── */}
          {pageState === 'loading' ? (
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

          ) : pageState === 'generating' ? (
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

          ) : pageState === 'select_trilha' || pageState === 'gen_error' ? (
            /* Trilha selection / retry */
            <div style={{ marginBottom: 32 }}>
              {pageState === 'gen_error' && genError && (
                <div style={{
                  background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#ef4444' }}>
                    // erro: {genError}
                  </span>
                </div>
              )}

              <div style={{
                fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 600,
                color: 'var(--text)', marginBottom: 6,
              }}>
                {pageState === 'gen_error' ? 'tentar novamente — escolha a trilha:' : 'escolha sua trilha desta semana:'}
              </div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)',
                marginBottom: 20,
              }}>
                // missões são geradas com base no seu perfil + trilha escolhida
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {TRILHA_OPTIONS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleGenerate(t.id)}
                    style={{
                      background: 'var(--bg3)', border: `1px solid ${t.color}30`,
                      borderRadius: 12, padding: '20px 22px', cursor: 'pointer',
                      textAlign: 'left', transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.border = `1px solid ${t.color}80`
                      ;(e.currentTarget as HTMLButtonElement).style.background = `${t.color}08`
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.border = `1px solid ${t.color}30`
                      ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg3)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, color: t.color }}>
                        {t.icon}
                      </span>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700,
                        color: t.color,
                      }}>
                        {t.label}
                      </span>
                    </div>
                    <div style={{
                      fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: 'var(--muted)',
                      lineHeight: 1.4,
                    }}>
                      {t.desc}
                    </div>
                  </button>
                ))}
              </div>
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

                {/* Regenerate section */}
                {canRegenerate && phase === 'idle' && (
                  <div style={{
                    marginTop: 20, paddingTop: 16,
                    borderTop: '1px solid var(--border)',
                  }}>
                    {!showRegenConfirm ? (
                      <button
                        onClick={() => setShowRegenConfirm(true)}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                          color: 'var(--muted)', padding: 0,
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                      >
                        não é minha prioridade → gerar outra trilha
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>
                          // 1x por semana — confirmar?
                        </span>
                        <button
                          onClick={handleRegenerate}
                          disabled={regenerating}
                          style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                            color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
                            border: '1px solid rgba(245,158,11,0.3)',
                            borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
                            opacity: regenerating ? 0.5 : 1,
                          }}
                        >
                          {regenerating ? 'gerando...' : 'sim, nova trilha'}
                        </button>
                        <button
                          onClick={() => setShowRegenConfirm(false)}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                            color: 'var(--muted)', padding: 0,
                          }}
                        >
                          cancelar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Market Mission Card ───────────────────────────────── */}
          {marketMission?.mission && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
                padding: '10px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>⚡</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  missão de mercado da semana
                </span>
                <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
                  +{marketMission.mission.pontos} XP
                </span>
              </div>

              <div style={{ padding: '20px 24px' }}>
                <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                  {marketMission.mission.titulo}
                </h3>

                {/* Contexto mercado */}
                <div style={{
                  background: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  marginBottom: 12,
                }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#f59e0b', fontWeight: 700, display: 'block', marginBottom: 3 }}>
                    🏢 por que isso importa
                  </span>
                  <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: 'rgba(245, 158, 11, 0.85)', lineHeight: 1.6, margin: 0 }}>
                    {marketMission.mission.contexto_mercado}
                  </p>
                </div>

                <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: 'var(--text)', lineHeight: 1.7, marginBottom: 16 }}>
                  {marketMission.mission.descricao}
                </p>

                {/* Trilha badge */}
                <div style={{ marginBottom: 16 }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                    color: TRILHA_COLOR[marketMission.mission.trilha] || '#f59e0b',
                    background: `${TRILHA_COLOR[marketMission.mission.trilha] || '#f59e0b'}18`,
                    border: `1px solid ${TRILHA_COLOR[marketMission.mission.trilha] || '#f59e0b'}40`,
                    borderRadius: 4, padding: '3px 8px',
                  }}>
                    {marketMission.mission.trilha}
                  </span>
                </div>

                {/* Actions */}
                {marketMission.entregue ? (
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: 'var(--green)' }}>
                    ✓ Missão entregue — +{marketMission.mission.pontos} XP
                  </div>
                ) : marketMission.aceita ? (
                  <div>
                    {marketPhase === 'done' && marketResult ? (
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: marketResult.aprovado ? 'var(--green)' : 'var(--muted)', lineHeight: 1.6 }}>
                        {marketResult.aprovado
                          ? `✓ Aprovado! +${marketResult.pontos_ganhos} XP`
                          : `✗ ${marketResult.feedback}`}
                      </div>
                    ) : marketPhase === 'submitting' ? (
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#f59e0b' }}>verificando...</div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          value={marketCommitUrl}
                          onChange={e => setMarketCommitUrl(e.target.value)}
                          placeholder="https://github.com/user/repo/commit/..."
                          style={{
                            flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
                            borderRadius: 6, padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 12, color: 'var(--text)', outline: 'none',
                          }}
                        />
                        <button
                          disabled={!marketCommitUrl.trim()}
                          onClick={async () => {
                            setMarketPhase('submitting')
                            try {
                              const r = await submitMarketMission(marketCommitUrl.trim())
                              setMarketResult(r)
                              setMarketPhase(r.aprovado ? 'done' : 'rejected')
                              if (r.aprovado) setMarketMission(prev => prev ? { ...prev, entregue: true } : prev)
                            } catch {
                              setMarketPhase('idle')
                            }
                          }}
                          style={{
                            background: '#f59e0b', color: '#000', fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 6,
                            padding: '8px 16px', cursor: 'pointer', whiteSpace: 'nowrap',
                            opacity: !marketCommitUrl.trim() ? 0.4 : 1,
                          }}
                        >
                          entregar →
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    disabled={marketPhase === 'accepting'}
                    onClick={async () => {
                      setMarketPhase('accepting')
                      try {
                        await acceptMarketMission()
                        setMarketMission(prev => prev ? { ...prev, aceita: true } : prev)
                        setMarketPhase('idle')
                      } catch {
                        setMarketPhase('idle')
                      }
                    }}
                    style={{
                      background: 'transparent', border: '1px solid #f59e0b',
                      color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 12, fontWeight: 700, borderRadius: 6,
                      padding: '8px 20px', cursor: 'pointer',
                      opacity: marketPhase === 'accepting' ? 0.5 : 1,
                    }}
                  >
                    {marketPhase === 'accepting' ? 'aceitando...' : 'aceitar missão →'}
                  </button>
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

          {/* ── Section 3: Activity Heatmap ──────────────────────── */}
          {activity.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 16,
              }}>
                // atividade — últimas 26 semanas
              </div>
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                  {activity.map(week => {
                    const xp = week.xp
                    const intensity = xp === 0 ? 0 : xp < 50 ? 1 : xp < 100 ? 2 : xp < 200 ? 3 : 4
                    const colors = ['var(--bg3)', 'rgba(0,255,148,0.2)', 'rgba(0,255,148,0.4)', 'rgba(0,255,148,0.65)', 'rgba(0,255,148,0.9)']
                    const isCurrent = week.semana_ref === activity[activity.length - 1]?.semana_ref
                    return (
                      <div
                        key={week.semana_ref}
                        title={`${week.semana_ref}: ${xp} XP`}
                        style={{
                          flex: 1, height: 28, borderRadius: 4,
                          background: colors[intensity],
                          border: isCurrent ? '1px solid var(--green)' : '1px solid transparent',
                          cursor: 'default', transition: 'transform 0.1s ease',
                          minWidth: 0,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scaleY(1.1)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scaleY(1)')}
                      />
                    )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--muted)' }}>
                    {activity[0]?.semana_ref}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--green)' }}>
                    agora
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Section 4: Achievements ──────────────────────────── */}
          {achievements.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 16,
              }}>
                // conquistas — {achievements.filter(a => a.desbloqueado).length}/{achievements.length}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {achievements.map(a => (
                  <div
                    key={a.id}
                    style={{
                      background: a.desbloqueado ? 'rgba(0,255,148,0.04)' : 'var(--bg2)',
                      border: a.desbloqueado ? '1px solid rgba(0,255,148,0.2)' : '1px solid var(--border)',
                      borderRadius: 10, padding: '14px 16px',
                      opacity: a.desbloqueado ? 1 : 0.45,
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      transition: 'opacity 0.3s ease',
                    }}
                  >
                    <span style={{ fontSize: 20, flexShrink: 0, filter: a.desbloqueado ? 'none' : 'grayscale(1)' }}>
                      {a.icone}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, fontWeight: 600,
                        color: a.desbloqueado ? 'var(--text)' : 'var(--muted)',
                        marginBottom: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {a.nome}
                      </div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
                        {a.descricao}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
