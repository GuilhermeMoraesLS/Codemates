'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID

export default function LandingPage() {
  const router = useRouter()

  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (localStorage.getItem('codemates_token')) {
      router.push('/dashboard')
    }
  }, [router])

  function handleLogin() {
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=read:user,repo`
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Nav */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 48px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--bg3)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 14,
            color: 'var(--green)',
          }}>
            &gt;_
          </div>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 18,
            color: 'var(--text)',
          }}>
            code<span style={{ color: 'var(--green)' }}>mates</span>
          </span>
        </div>
        <button onClick={handleLogin} style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600,
          padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'var(--green)', color: '#0A0E1A',
        }}>
          Entrar com GitHub
        </button>
      </nav>

      {/* Hero */}
      <main style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', padding: '120px 48px 80px',
      }}>
        {/* Logo */}
        <div style={{
          width: 80, height: 80, borderRadius: 18,
          background: 'var(--bg3)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 32, position: 'relative',
          boxShadow: '0 0 40px rgba(0,255,148,0.08)',
        }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 28,
            color: 'var(--green)', textShadow: '0 0 20px rgba(0,255,148,0.5)',
          }}>
            &gt;_
          </span>
          <div className="animate-blink" style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--green)',
            position: 'absolute', bottom: 10, right: 10,
            boxShadow: '0 0 8px var(--green)',
          }} />
        </div>

        <h1 style={{
          fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
          fontSize: 52, letterSpacing: '-0.04em', marginBottom: 16,
          color: 'var(--text)',
        }}>
          code<span style={{ color: 'var(--green)' }}>mates</span>
        </h1>

        <p style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 14,
          color: 'var(--muted)', letterSpacing: '0.05em', marginBottom: 48,
        }}>
          // <span style={{ color: 'var(--green)' }}>evolução técnica</span> medida em código real
        </p>

        <p style={{
          fontSize: 18, color: 'var(--text)', maxWidth: 540,
          lineHeight: 1.7, marginBottom: 48, opacity: 0.85,
        }}>
          Missões semanais geradas por IA, grupos de até 7 devs e verificação automática via GitHub.
          Sem check-in manual. Sem gamificação vazia.
        </p>

        <button onClick={handleLogin} style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700,
          padding: '14px 32px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'var(--green)', color: '#0A0E1A',
          boxShadow: '0 0 24px rgba(0,255,148,0.25)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <GitHubIcon />
          Começar com GitHub
        </button>

        {/* Features */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16, marginTop: 80, maxWidth: 860, width: '100%',
        }}>
          {[
            { icon: '⚡', title: 'Missões por IA', desc: 'Geradas todo domingo com base na sua stack e perfil do grupo.' },
            { icon: '🔗', title: 'Verificação Automática', desc: 'Agent monitora seus commits. Nenhum check-in manual necessário.' },
            { icon: '🏆', title: 'Ranking do Grupo', desc: 'Compete com seus mates. Streaks semanais. Progresso real.' },
          ].map((f) => (
            <div key={f.title} style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '28px 24px', textAlign: 'left',
            }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{
                fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
                fontSize: 15, marginBottom: 8, color: 'var(--green)',
              }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}
