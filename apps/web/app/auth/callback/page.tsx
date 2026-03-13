'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { githubCallback } from '@/lib/api'

const MESSAGES = [
  'lendo seus repositórios...',
  'verificando sua atividade...',
  'preparando sua análise...',
  'quase lá...',
]

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [msgIndex, setMsgIndex] = useState(0)
  const [msgVisible, setMsgVisible] = useState(true)
  const [barWidth, setBarWidth] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)

  // OAuth logic
  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setTimeout(() => router.push('/'), 500)
      return
    }

    githubCallback(code)
      .then(({ access_token, user }) => {
        localStorage.setItem('codemates_token', access_token)
        localStorage.setItem('codemates_user', JSON.stringify(user))
        router.push('/dashboard')
      })
      .catch(() => {
        setTimeout(() => router.push('/'), 500)
      })
  }, [searchParams, router])

  // Rotating messages with fade
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgVisible(false)
      setTimeout(() => {
        setMsgIndex(i => (i + 1) % MESSAGES.length)
        setMsgVisible(true)
      }, 300)
    }, 1800)
    return () => clearInterval(interval)
  }, [])

  // Fake progress bar: 0% → 85% in 6s ease-out
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setBarWidth(85)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Logo */}
      <div style={{
        paddingTop: 48,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 18,
        fontWeight: 700,
        color: 'var(--text)',
        letterSpacing: '-0.02em',
      }}>
        code<span style={{ color: 'var(--green)' }}>mates</span>
      </div>

      {/* Center content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}>
        {/* Comment label */}
        <p style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          marginBottom: 4,
        }}>
          // conectando ao github
        </p>

        {/* Rotating message */}
        <p
          key={msgIndex}
          className="animate-fade-swap"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
            color: 'var(--text)',
            minHeight: '1.4em',
          }}
        >
          {MESSAGES[msgIndex]}
        </p>

        {/* Fake progress bar */}
        <div style={{
          width: 280,
          height: 3,
          background: 'var(--bg3)',
          borderRadius: 2,
          overflow: 'hidden',
          marginTop: 4,
        }}>
          <div
            ref={barRef}
            style={{
              height: '100%',
              width: `${barWidth}%`,
              background: 'linear-gradient(to right, var(--green), var(--cyan))',
              borderRadius: 2,
              transition: 'width 6s ease-out',
            }}
          />
        </div>

        {/* Footer phrase */}
        <p style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          color: 'var(--green)',
          opacity: 0.6,
          marginTop: 32,
        }}>
          // cada commit conta.
        </p>
      </div>
    </div>
  )
}
