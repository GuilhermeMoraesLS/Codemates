'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserGithubProfile, getUserGroups, type User, type GithubProfile, type Group } from '@/lib/api'

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

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [githubProfile, setGithubProfile] = useState<GithubProfile | null>(null)
  const [githubLoading, setGithubLoading] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

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
  }, [user?.username])

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
            <div style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '24px 28px',
            }}>
              {[85, 65, 45, 30].map((w, i) => (
                <div key={i} style={{ marginBottom: i < 3 ? 14 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={shimmerStyle(40, 10, i * 0.12)} />
                    <div style={shimmerStyle(12, 10, i * 0.12)} />
                  </div>
                  <div style={shimmerStyle(w, 6, i * 0.12 + 0.06)} />
                </div>
              ))}
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
              {groups.map(group => (
                <div
                  key={group.id}
                  onClick={() => router.push(`/groups/${group.id}`)}
                  className="group-card"
                  style={{
                    background: 'var(--bg2)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '16px 20px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                      {group.nome}
                    </div>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--cyan)', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', padding: '2px 8px', borderRadius: 20 }}>
                      {group.stack_alvo}
                    </span>
                  </div>
                  {group.streak_coletivo > 0 && (
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--green)' }}>
                      🔥 {group.streak_coletivo}
                    </span>
                  )}
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>→</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
