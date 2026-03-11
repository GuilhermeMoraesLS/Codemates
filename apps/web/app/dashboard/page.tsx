'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserGithubProfile, getUserGroups, type User, type GithubProfile, type Group } from '@/lib/api'

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
  const [githubProfile, setGithubProfile] = useState<GithubProfile | null>(null)
  const [githubLoading, setGithubLoading] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)

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

  if (!user) return null

  const nivelColor = NIVEL_COLORS[user.nivel] || 'var(--green)'

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

        {/* GitHub Analysis */}
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
            <div style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '24px 28px',
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 32,
            }}>

              {/* Languages */}
              <div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
                  marginBottom: 16,
                }}>
                  linguagens
                </div>
                {sortedLangs.map(([lang, pct], i) => (
                  <div key={lang} style={{ marginBottom: i < sortedLangs.length - 1 ? 12 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                        color: i < 3 ? LANG_COLORS[i] : 'var(--muted)',
                      }}>
                        {lang}
                      </span>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                        color: 'var(--muted)',
                      }}>
                        {pct}%
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'var(--bg2)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: i < 3 ? LANG_COLORS[i] : 'var(--muted)',
                        width: `${pct}%`,
                        animation: 'bar-fill 0.8s ease forwards',
                        animationDelay: `${i * 0.1}s`,
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Frequency */}
              <div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
                  marginBottom: 16,
                }}>
                  frequência
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 8,
                  background: freqConfig.bg,
                  border: `1px solid ${freqConfig.border}`,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700,
                  color: freqConfig.color,
                }}>
                  {freqConfig.icon} {freqConfig.label}
                </div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: 'var(--muted)', marginTop: 8,
                }}>
                  de commits
                </div>
              </div>

              {/* Repos */}
              <div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
                  marginBottom: 16,
                }}>
                  repositórios
                </div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 800,
                  fontSize: 36, color: 'var(--cyan)', lineHeight: 1, marginBottom: 4,
                }}>
                  {githubProfile!.repos_publicos}
                </div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: 'var(--muted)',
                }}>
                  públicos analisados
                </div>
              </div>

            </div>

            {/* Frameworks + nivel_mercado row */}
            {(githubProfile?.frameworks_json?.length > 0 || githubProfile?.nivel_mercado) && (
              <div style={{
                marginTop: 16,
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '20px 28px',
                display: 'flex', alignItems: 'flex-start', gap: 40,
              }}>
                {githubProfile?.nivel_mercado && (
                  <div>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                      color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
                    }}>
                      perfil de mercado
                    </div>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700,
                      color: 'var(--purple)', background: 'rgba(139,92,246,0.1)',
                      border: '1px solid rgba(139,92,246,0.3)', padding: '5px 14px', borderRadius: 20,
                    }}>
                      {githubProfile.nivel_mercado}
                    </span>
                  </div>
                )}
                {githubProfile?.frameworks_json?.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                      color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
                    }}>
                      frameworks detectados
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {githubProfile.frameworks_json.map(fw => (
                        <span key={fw} style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                          color: 'var(--cyan)', background: 'rgba(0,212,255,0.08)',
                          border: '1px solid rgba(0,212,255,0.2)', padding: '3px 10px', borderRadius: 20,
                        }}>
                          {fw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            </>
          )}
        </div>

        {/* Groups section */}
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
                  style={{
                    background: 'var(--bg2)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '16px 20px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--green)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
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
