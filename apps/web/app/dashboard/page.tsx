'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getUserGithubProfile, getUserGroups, getGroupRanking, getMyMission,
  getMyIndividualMission,
  type User, type GithubProfile, type Group, type MissionV2, type IndividualMissionResult,
} from '@/lib/api'

// ── Terminal card lines ───────────────────────────────────────────────────────
const TERM_LINES = [
  '> analisando repositórios públicos...',
  '> detectando stack de tecnologias...',
  '> lendo dependências dos últimos 5 repos...',
  '> identificando padrões de commit...',
  '> gerando diagnóstico técnico...',
]
// ms: [lineAppears, checkAppears] — index 4 (last) has no check
const TERM_TIMING: [number, number][] = [
  [0,    800],
  [1000, 1800],
  [2000, 3200],
  [3400, 4200],
  [4400, Infinity],
]

// Mission trilha colors
const TRILHA_COLOR: Record<string, string> = {
  qualidade:    'var(--green)',
  devops:       'var(--cyan)',
  arquitetura:  'var(--purple)',
  integracao:   '#f59e0b',
  'integração': '#f59e0b',
}

// Badge colors (nivel label pill)
const NIVEL_BADGE_COLORS: Record<string, string> = {
  INICIANTE:  'var(--muted)',
  DEV:        'var(--cyan)',
  ENGENHEIRO: 'var(--green)',
  'SÊNIOR':   'var(--purple)',
  ARQUITETO:  '#FFD700',
}

// Ring colors + rgba glow for avatar (hex needed for glow concatenation)
const NIVEL_RING: Record<string, { solid: string; glow: string; bar: string }> = {
  INICIANTE:  { solid: '#00FF94', glow: 'rgba(0,255,148,0.25)',   bar: 'rgba(0,255,148,0.9)' },
  DEV:        { solid: '#00D4FF', glow: 'rgba(0,212,255,0.25)',   bar: 'rgba(0,212,255,0.9)' },
  ENGENHEIRO: { solid: '#8B5CF6', glow: 'rgba(139,92,246,0.25)', bar: 'rgba(139,92,246,0.9)' },
  'SÊNIOR':   { solid: '#f59e0b', glow: 'rgba(245,158,11,0.25)', bar: 'rgba(245,158,11,0.9)' },
  ARQUITETO:  { solid: '#ef4444', glow: 'rgba(239,68,68,0.25)',  bar: 'rgba(239,68,68,0.9)' },
}

const NIVEL_ORDER = ['INICIANTE', 'DEV', 'ENGENHEIRO', 'SÊNIOR', 'ARQUITETO']

const NAV_ITEMS = [
  { icon: '⌂', label: 'dashboard', href: '/dashboard', soon: false },
  { icon: '⚔', label: 'missões',   href: '/missions',  soon: false },
  { icon: '◈', label: 'meu grupo', href: '/groups',    soon: true  },
  { icon: '◎', label: 'ranking',   href: '/ranking',   soon: true  },
]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [githubProfile, setGithubProfile] = useState<GithubProfile | null>(null)
  const [githubLoading, setGithubLoading] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [groupPreviews, setGroupPreviews] = useState<Record<string, { rankingPos: number | null; missionTitle: string | null }>>({})
  const [individualMission, setIndividualMission] = useState<IndividualMissionResult | null>(null)
  const [missionLoading, setMissionLoading] = useState(true)

  const [termStep, setTermStep]     = useState(0)
  const [termChecks, setTermChecks] = useState<boolean[]>([false, false, false, false, false])
  const [showReveal, setShowReveal]   = useState(false)
  const [revealFading, setRevealFading] = useState(false)
  const [barFill, setBarFill]         = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('codemates_token')
    const userData = localStorage.getItem('codemates_user')
    if (!token || !userData) {
      router.push('/')
      return
    }
    setUser(JSON.parse(userData))
  }, [router])

  useEffect(() => {
    if (!user) return
    setGithubLoading(true)
    getUserGithubProfile(user.username)
      .then(setGithubProfile)
      .catch(() => setGithubProfile(null))
      .finally(() => setGithubLoading(false))
    setGroupsLoading(true)
    getUserGroups(user.username)
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setGroupsLoading(false))
    setMissionLoading(true)
    getMyIndividualMission()
      .then(setIndividualMission)
      .catch(() => setIndividualMission(null))
      .finally(() => setMissionLoading(false))
  }, [user?.username])

  // Fetch ranking position + mission title for each group card preview
  useEffect(() => {
    if (!user || groups.length === 0) return
    groups.forEach(async (g) => {
      const [rankRes, missRes] = await Promise.allSettled([
        getGroupRanking(g.id),
        getMyMission(g.id),
      ])
      const rankingPos = rankRes.status === 'fulfilled'
        ? (rankRes.value.semanal.find(m => m.user_id === user.id)?.posicao ?? null)
        : null
      const missionTitle = missRes.status === 'fulfilled'
        ? missRes.value.titulo
        : null
      setGroupPreviews(prev => ({ ...prev, [g.id]: { rankingPos, missionTitle } }))
    })
  }, [user?.id, groups])

  // Terminal animation — starts/resets whenever githubLoading becomes true
  useEffect(() => {
    if (!githubLoading) return
    setTermStep(0)
    setTermChecks([false, false, false, false, false])

    const timers: ReturnType<typeof setTimeout>[] = []
    TERM_TIMING.forEach(([lineMs, checkMs], i) => {
      timers.push(setTimeout(() => setTermStep(s => Math.max(s, i + 1)), lineMs))
      if (checkMs !== Infinity) {
        timers.push(setTimeout(() => setTermChecks(c => {
          const next = [...c]; next[i] = true; return next
        }), checkMs))
      }
    })
    return () => timers.forEach(clearTimeout)
  }, [githubLoading])

  // Reveal screen — fires when loading finishes with valid data
  useEffect(() => {
    if (githubLoading || githubProfile === null) return
    const hasData =
      Object.keys(githubProfile.linguagens_json).length > 0 ||
      githubProfile.repos_publicos > 0
    if (!hasData) return

    setShowReveal(true)
    setRevealFading(false)
    setBarFill(false)

    const t1 = setTimeout(() => setBarFill(true), 2000)
    const t2 = setTimeout(() => setRevealFading(true), 2500)
    const t3 = setTimeout(() => { setShowReveal(false); setRevealFading(false) }, 2800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [githubLoading, githubProfile])

  function handleLogout() {
    localStorage.removeItem('codemates_token')
    localStorage.removeItem('codemates_user')
    router.push('/')
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  if (!user) return null

  const ring = NIVEL_RING[user.nivel] ?? NIVEL_RING.INICIANTE
  const nivelColor = NIVEL_BADGE_COLORS[user.nivel] ?? 'var(--muted)'

  const currentIdx = NIVEL_ORDER.indexOf(user.nivel)
  const nextNivel = currentIdx < NIVEL_ORDER.length - 1 ? NIVEL_ORDER[currentIdx + 1] : null
  const xpProgresso = user.pontos_total % 500
  const xpPct = (xpProgresso / 500) * 100

  const LANG_COLORS = ['var(--green)', 'var(--cyan)', 'var(--purple)']
  const FREQ_MAP = {
    alta:  { color: 'var(--green)',  bg: 'rgba(0,255,148,0.08)',    border: 'rgba(0,255,148,0.3)',    icon: '▲', label: 'ALTA' },
    media: { color: 'var(--cyan)',   bg: 'rgba(0,212,255,0.08)',    border: 'rgba(0,212,255,0.3)',    icon: '→', label: 'MÉDIA' },
    baixa: { color: 'var(--muted)', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.3)', icon: '▼', label: 'BAIXA' },
  }

  const hasGithubData = githubProfile !== null &&
    (Object.keys(githubProfile.linguagens_json).length > 0 || githubProfile.repos_publicos > 0)

  const langEntries = githubProfile ? Object.entries(githubProfile.linguagens_json) : []
  const totalBytes = langEntries.reduce((sum, [, v]) => sum + v, 0)
  const sortedLangs = langEntries
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([lang, bytes]) => [lang, totalBytes > 0 ? Math.round((bytes / totalBytes) * 100) : 0] as [string, number])

  const freqKey = githubProfile?.frequencia_commits ?? 'baixa'
  const freqConfig = FREQ_MAP[freqKey as keyof typeof FREQ_MAP] ?? FREQ_MAP.baixa

  const topFrameworks = githubProfile?.frameworks_json?.slice(0, 2) ?? []
  const areas = githubProfile?.areas_a_fortalecer ?? []

  const shimmerStyle = (widthPct: number, height: number, delay: number) => ({
    height,
    width: `${widthPct}%`,
    borderRadius: 4,
    background: 'linear-gradient(90deg, var(--bg2) 25%, var(--bg3) 50%, var(--bg2) 75%)',
    backgroundSize: '200% auto',
    animation: 'shimmer 1.5s linear infinite',
    animationDelay: `${delay}s`,
  })

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, right: 32, zIndex: 100,
          background: 'var(--bg3)', border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: 10, padding: '12px 20px',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
          color: 'var(--cyan)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          animation: 'fade-in 0.2s ease forwards',
        }}>
          ⚡ {toast}
        </div>
      )}

      {/* ── Sidebar ───────────────────────────────────────────── */}
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
        {/* Block 1 — Logo */}
        <div style={{ padding: '24px 20px 16px' }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 14,
            color: 'var(--text)',
          }}>
            code<span style={{ color: 'var(--green)' }}>mates</span>
          </span>
        </div>

        {/* Block 2 — User identity */}
        <div style={{ padding: '0 16px 20px' }}>
          {user.avatar && (
            <img
              src={user.avatar}
              alt={user.username}
              style={{
                width: 48, height: 48, borderRadius: 12, display: 'block',
                boxShadow: `0 0 0 2px ${ring.solid}, 0 0 12px ${ring.solid}30`,
              }}
            />
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
            color: ring.solid,
            background: `${ring.solid}15`,
            border: `1px solid ${ring.solid}40`,
            padding: '2px 8px', borderRadius: 20,
            marginTop: 6,
          }}>
            &gt; {user.nivel}
          </span>
          {/* XP bar */}
          <div style={{
            width: '100%', height: 4, background: 'var(--bg2)',
            borderRadius: 2, marginTop: 10, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${xpPct}%`,
              background: 'linear-gradient(90deg, var(--green), var(--cyan))',
              borderRadius: 2, transition: 'width 1s ease',
            }} />
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            color: 'var(--muted)', marginTop: 4,
          }}>
            {xpProgresso} / 500 XP → {nextNivel ?? 'MAX'}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />

        {/* Block 3 — Navigation */}
        <div style={{ padding: '16px 8px' }}>
          {NAV_ITEMS.map(item => {
            const isActive = item.href === '/dashboard'
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
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                  color: isActive ? 'var(--green)' : 'var(--muted)',
                }}>
                  {item.icon}
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                  color: isActive ? 'var(--green)' : 'var(--muted)',
                  flex: 1,
                }}>
                  {item.label}
                </span>
                {item.soon && (
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                    color: 'var(--muted)', background: 'var(--bg2)',
                    padding: '1px 5px', borderRadius: 3,
                  }}>
                    em breve
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />

        {/* Block 4 — Trilha de evolução */}
        <div style={{ padding: '16px 16px', flex: 1, overflowY: 'auto' }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            color: 'var(--muted)', textTransform: 'uppercase',
            letterSpacing: '0.15em', marginBottom: 14,
          }}>
            // trilha
          </div>
          {NIVEL_ORDER.map((nivel, i) => {
            const isPast    = i < currentIdx
            const isCurrent = i === currentIdx
            const isFuture  = i > currentIdx
            const nRing     = NIVEL_RING[nivel]
            return (
              <div
                key={nivel}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: isCurrent ? '4px 8px' : '4px 0',
                  borderRadius: isCurrent ? 6 : 0,
                  background:  isCurrent ? `${nRing.solid}10` : 'transparent',
                  border:      isCurrent ? `1px solid ${nRing.solid}25` : '1px solid transparent',
                  marginBottom: 6,
                }}
              >
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                  color: isPast ? 'var(--green)' : isCurrent ? 'var(--cyan)' : 'var(--muted)',
                }}>
                  {isPast ? '✓' : isCurrent ? '→' : '○'}
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                  color: isPast ? 'var(--green)' : isCurrent ? 'var(--cyan)' : 'var(--muted)',
                  opacity: isFuture ? 0.4 : 1,
                }}>
                  {nivel}
                </span>
              </div>
            )
          })}
        </div>

        {/* Block 5 — Logout */}
        <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleLogout}
            style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
              color: 'var(--muted)', background: 'transparent',
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            sair
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="main-sidebar-offset">
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px' }}>

        {/* ── Header ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
            color: 'var(--green)', letterSpacing: '0.2em', textTransform: 'uppercase',
            marginBottom: 16,
          }}>
            // dashboard
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
            {/* Avatar with level ring */}
            {user.avatar && (
              <div style={{
                flexShrink: 0,
                borderRadius: 20,
                lineHeight: 0,
                boxShadow: `0 0 0 3px ${ring.solid}, 0 0 16px ${ring.glow}`,
              }}>
                <img
                  src={user.avatar}
                  alt={user.username}
                  style={{ width: 96, height: 96, borderRadius: 18, display: 'block' }}
                />
              </div>
            )}

            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
                Olá, {user.username}
              </h1>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
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

              {/* XP bar */}
              <div style={{ maxWidth: 360 }}>
                <div style={{
                  height: 6, borderRadius: 3,
                  background: 'var(--bg3)', overflow: 'hidden', marginBottom: 6,
                }}>
                  <div style={{
                    height: '100%',
                    width: `${xpPct}%`,
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${ring.bar}, ${ring.solid}, ${ring.bar})`,
                    backgroundSize: '200% auto',
                    animation: 'shimmer 2s linear infinite',
                  }} />
                </div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: 'var(--muted)',
                }}>
                  {xpProgresso} / 500 XP{nextNivel ? ` → próximo: ${nextNivel}` : ' → nível máximo'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats ────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16, marginBottom: 48,
        }}>
          {[
            { label: 'Missões concluídas', value: user.missoes_concluidas, color: 'var(--green)' },
            { label: 'Streak atual', value: `${user.streak_atual}w`, color: 'var(--cyan)' },
            { label: 'Pontos totais', value: user.pontos_total.toLocaleString(), color: 'var(--purple)' },
          ].map((stat) => (
            <div key={stat.label} className="stat-card">
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

        {/* ── Missão da Semana ─────────────────────────────────────── */}
        {(missionLoading || individualMission !== null) && (() => {
          const tc = !missionLoading && individualMission && !('generating' in individualMission)
            ? TRILHA_COLOR[(individualMission as MissionV2).trilha?.toLowerCase()] ?? 'var(--muted)'
            : 'var(--muted)'
          const mission = (!missionLoading && individualMission && !('generating' in individualMission))
            ? individualMission as MissionV2
            : null
          const bonus30 = mission ? Math.round(mission.pontos * 0.3) : 0

          return (
            <div style={{ marginBottom: 48 }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                color: 'var(--green)', letterSpacing: '0.2em', textTransform: 'uppercase',
                marginBottom: 20,
              }}>
                // missão da semana
              </div>

              {missionLoading ? (
                /* Loading skeleton */
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
                  {[70, 40, 90].map((w, i) => (
                    <div key={i} style={{
                      height: i === 0 ? 12 : 10, width: `${w}%`, borderRadius: 4,
                      marginBottom: i < 2 ? 12 : 0,
                      background: 'linear-gradient(90deg, var(--bg2) 25%, var(--bg3) 50%, var(--bg2) 75%)',
                      backgroundSize: '200% auto', animation: 'shimmer 1.5s linear infinite',
                      animationDelay: `${i * 0.1}s`,
                    }} />
                  ))}
                </div>

              ) : 'generating' in (individualMission as IndividualMissionResult) ? (
                /* State A — generating */
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)' }}>
                        // gerando sua missão...
                      </span>
                      <span className="animate-blink" style={{ color: 'var(--green)', fontSize: 14 }}>█</span>
                    </div>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)', opacity: 0.5 }}>
                      isso leva alguns segundos
                    </span>
                  </div>
                </div>

              ) : mission && (
                /* State B — mission loaded */
                <>
                  <div style={{
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: 16, padding: '20px 24px',
                    display: 'flex', alignItems: 'center', gap: 20,
                  }}>
                    {/* Left column */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Header: trilha badge + nivel + pontos */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
                          color: tc, background: `${tc}15`, border: `1px solid ${tc}40`,
                          padding: '2px 8px', borderRadius: 20,
                        }}>
                          {mission.trilha}
                        </span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)' }}>
                          nível {mission.nivel}
                        </span>
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800,
                          color: tc, marginLeft: 'auto',
                        }}>
                          {mission.pontos} XP
                        </span>
                      </div>

                      {/* Title */}
                      <div style={{
                        fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, fontWeight: 700,
                        color: 'var(--text)', marginBottom: 6,
                      }}>
                        {mission.titulo}
                      </div>

                      {/* Description — 2 lines max */}
                      <div style={{
                        fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: 'var(--muted)',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {mission.descricao}
                      </div>
                    </div>

                    {/* Right column */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      {mission.entregue ? (
                        <>
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
                            color: 'var(--green)',
                            background: 'rgba(0,255,148,0.10)',
                            border: '1px solid rgba(0,255,148,0.30)',
                            padding: '6px 14px', borderRadius: 8,
                          }}>
                            ✓ concluída
                          </span>
                          {mission.entrega && (
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--green)' }}>
                              +{mission.entrega.pontos_ganhos} XP
                            </span>
                          )}
                        </>
                      ) : (
                        <button
                          className="btn-primary"
                          onClick={() => router.push('/missions')}
                          style={{ fontSize: 12, padding: '8px 16px', borderRadius: 8 }}
                        >
                          ver missão →
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Early delivery bonus hint */}
                  {!mission.entregue && (
                    <div style={{ marginTop: 8, paddingLeft: 4 }}>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                        color: 'var(--cyan)', opacity: 0.7,
                      }}>
                        ⚡ entregue até quarta → +{bonus30} XP bônus
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}

        {/* ── GitHub Analysis ───────────────────────────────────────── */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
            color: 'var(--green)', letterSpacing: '0.2em', textTransform: 'uppercase',
            marginBottom: 20,
          }}>
            // análise do seu github
          </div>

          {githubLoading ? (
            /* ── Estado 1: Terminal de análise ─────────────────────── */
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              {/* Terminal title bar */}
              <div style={{
                background: 'var(--bg3)',
                borderBottom: '1px solid var(--border)',
                padding: '10px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['#ff5f57', '#febc2e', '#28c840'].map(c => (
                    <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
                  ))}
                </div>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                  color: 'var(--muted)',
                }}>
                  profile_agent.py
                </span>
              </div>

              {/* Terminal body */}
              <div style={{
                background: 'var(--bg)',
                borderRadius: '0 0 12px 12px',
                padding: '20px 24px',
                minHeight: 160,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {TERM_LINES.map((line, i) => {
                  if (termStep <= i) return null
                  const isDone = termChecks[i]
                  const isActive = i === TERM_LINES.length - 1 && !isDone

                  return (
                    <div
                      key={i}
                      className="animate-fade-in-up"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        animationDuration: '0.3s',
                        animationDelay: '0s',
                      }}
                    >
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                        color: isDone ? 'var(--muted)' : 'var(--text)',
                        flex: 1,
                      }}>
                        {line}
                      </span>
                      {isDone && (
                        <span
                          className="animate-scale-in"
                          style={{
                            color: 'var(--green)',
                            fontSize: 13,
                            fontWeight: 700,
                            animationDuration: '0.2s',
                          }}
                        >
                          ✓
                        </span>
                      )}
                      {isActive && (
                        <span
                          className="animate-blink"
                          style={{ color: 'var(--green)', fontSize: 13, lineHeight: 1 }}
                        >
                          █
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

          ) : showReveal ? (
            /* ── Estado 2: Tela de revelação ───────────────────────── */
            <div style={{
              minHeight: 240,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 12,
              opacity: revealFading ? 0 : 1,
              transition: 'opacity 0.3s ease',
            }}>
              <p
                className="animate-fade-in-up"
                style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.2em',
                  margin: 0, animationDuration: '0.4s', animationDelay: '0s',
                }}
              >
                // análise concluída
              </p>

              <p
                className="animate-fade-in-up"
                style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 32, fontWeight: 800,
                  color: 'var(--text)', textAlign: 'center', maxWidth: 500,
                  lineHeight: 1.2, margin: 0,
                  animationDuration: '0.5s', animationDelay: '0.2s',
                }}
              >
                {githubProfile?.nivel_mercado}
              </p>

              <p
                className="animate-fade-in-up"
                style={{
                  fontFamily: 'Space Grotesk, sans-serif', fontSize: 14,
                  color: 'var(--muted)', margin: 0,
                  animationDuration: '0.4s', animationDelay: '0.5s',
                }}
              >
                {githubProfile?.especialidade_detectada}
              </p>

              {/* Progress bar — fills after 2s */}
              <div style={{
                width: 200, height: 2,
                background: 'var(--border)',
                borderRadius: 1,
                overflow: 'hidden',
                marginTop: 24,
              }}>
                <div style={{
                  height: '100%',
                  background: 'var(--green)',
                  borderRadius: 1,
                  width: barFill ? '100%' : '0%',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>

          ) : !hasGithubData ? (
            <div style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '28px',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
              color: 'var(--muted)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              // analisando seu perfil...
              <span className="animate-blink" style={{ color: 'var(--green)' }}>█</span>
            </div>

          ) : (
            <>
              {/* CARD A — Diagnóstico narrativo */}
              <div style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '24px 28px', marginBottom: 12,
              }}>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: 'var(--green)', letterSpacing: '0.15em', textTransform: 'uppercase',
                  marginBottom: 14,
                }}>
                  // seu perfil técnico
                </div>

                {/* Especialidade */}
                {githubProfile?.especialidade_detectada && (
                  <p style={{
                    fontFamily: 'Space Grotesk, sans-serif', fontSize: 14,
                    color: 'var(--text)', marginBottom: 20, lineHeight: 1.6,
                  }}>
                    Você demonstra domínio em{' '}
                    <strong style={{ color: 'var(--text)' }}>{githubProfile.especialidade_detectada}</strong>
                  </p>
                )}

                {/* Ponto forte / A explorar */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  border: '1px solid var(--border)', borderRadius: 10,
                  overflow: 'hidden', marginBottom: 24,
                }}>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                      color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.15em',
                      marginBottom: 12,
                    }}>
                      ponto forte
                    </div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {githubProfile?.nivel_mercado && (
                        <li style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                          color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <span style={{ opacity: 0.6 }}>●</span>
                          {githubProfile.nivel_mercado}
                        </li>
                      )}
                      {topFrameworks.map(fw => (
                        <li key={fw} style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                          color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <span style={{ opacity: 0.6 }}>●</span>
                          {fw}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ padding: '16px 20px', borderLeft: '1px solid var(--border)' }}>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                      color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.15em',
                      marginBottom: 12,
                    }}>
                      a explorar
                    </div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {areas.map((area, i) => (
                        <li key={i} style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                          color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <span>○</span>
                          {area}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Language bars */}
                {sortedLangs.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    {sortedLangs.map(([lang, pct], i) => (
                      <div key={lang} style={{ marginBottom: i < sortedLangs.length - 1 ? 8 : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                            color: i < 3 ? LANG_COLORS[i] : 'var(--muted)',
                          }}>
                            {lang}
                          </span>
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                            color: 'var(--muted)',
                          }}>
                            {pct}%
                          </span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: 'var(--bg2)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            background: i < 3 ? LANG_COLORS[i] : 'var(--muted)',
                            width: `${pct}%`,
                            animation: 'bar-fill 0.8s ease forwards',
                            animationDelay: `${i * 0.1}s`,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Framework badges */}
                {(githubProfile?.frameworks_json?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                    {githubProfile!.frameworks_json.map(fw => (
                      <span key={fw} style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                        color: 'var(--cyan)', background: 'rgba(0,212,255,0.08)',
                        border: '1px solid rgba(0,212,255,0.2)', padding: '2px 8px', borderRadius: 20,
                      }}>
                        {fw}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer metrics: frequência + repos */}
                <div style={{
                  display: 'flex', gap: 24, alignItems: 'center',
                  paddingTop: 16, borderTop: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                      color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
                    }}>
                      frequência
                    </span>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
                      color: freqConfig.color,
                      background: freqConfig.bg,
                      border: `1px solid ${freqConfig.border}`,
                      padding: '2px 8px', borderRadius: 6,
                    }}>
                      {freqConfig.icon} {freqConfig.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                      color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
                    }}>
                      repositórios
                    </span>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 800,
                      color: 'var(--cyan)',
                    }}>
                      {githubProfile!.repos_publicos}
                    </span>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                      color: 'var(--muted)',
                    }}>
                      públicos
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD B — Missão sugerida */}
              {!!githubProfile?.missao_sugerida && (
                <div style={{
                  background: 'rgba(0,212,255,0.04)',
                  border: '1px solid var(--border)',
                  borderLeft: '3px solid var(--cyan)',
                  borderRadius: 16,
                  padding: '20px 24px',
                  display: 'flex', alignItems: 'flex-start', gap: 20,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                      color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.15em',
                      marginBottom: 10,
                    }}>
                      ⚡ próxima missão sugerida
                    </div>
                    <p style={{
                      fontFamily: 'Space Grotesk, sans-serif', fontSize: 14,
                      color: 'var(--text)', lineHeight: 1.65, margin: 0,
                    }}>
                      {githubProfile.missao_sugerida}
                    </p>
                  </div>
                  <button
                    className="btn-outline-cyan"
                    onClick={() => showToast('em breve')}
                    style={{
                      fontSize: 11, padding: '6px 14px', borderRadius: 6,
                      flexShrink: 0, marginTop: 28,
                      opacity: 0.55, cursor: 'not-allowed',
                    }}
                  >
                    aceitar missão →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Grupos ───────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              // meus grupos
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => router.push('/groups/new')}
                className="btn-primary"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7 }}
              >
                + criar
              </button>
              <button
                onClick={() => router.push('/groups/join')}
                className="btn-outline"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7 }}
              >
                entrar via convite
              </button>
            </div>
          </div>

          {groupsLoading ? (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>// carregando...</span>
            </div>
          ) : groups.length === 0 ? (
            <div style={{
              background: 'var(--bg3)', border: '1px dashed var(--border)',
              borderRadius: 16, padding: '40px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            }}>
              <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: 'var(--muted)', margin: '0 0 4px' }}>
                Você ainda não está em nenhum grupo.
              </p>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', margin: 0 }}>
                Crie um ou peça um convite para um amigo.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groups.map(group => {
                const preview = groupPreviews[group.id]
                const pos = preview?.rankingPos ?? null
                const posColor =
                  pos === 1 ? 'var(--green)' :
                  pos === 2 ? 'var(--cyan)'  :
                  pos === 3 ? 'var(--purple)' :
                  'var(--muted)'

                return (
                  <div
                    key={group.id}
                    onClick={() => router.push(`/missions/${group.id}`)}
                    className="group-card"
                    style={{
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: '16px 20px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                        {group.nome}
                      </div>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--cyan)', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', padding: '2px 8px', borderRadius: 20 }}>
                        {group.stack_alvo}
                      </span>
                      {/* Preview line */}
                      {preview && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                          {pos && (
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: posColor }}>
                              #{pos} esta semana
                            </span>
                          )}
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260,
                          }}>
                            {preview.missionTitle ?? 'sem missão'}
                          </span>
                        </div>
                      )}
                    </div>
                    {group.streak_coletivo > 0 && (
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--green)', flexShrink: 0 }}>
                        🔥 {group.streak_coletivo}
                      </span>
                    )}
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>→</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      </div>
    </div>
  )
}
