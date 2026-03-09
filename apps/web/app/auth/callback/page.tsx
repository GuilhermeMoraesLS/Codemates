'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { githubCallback } from '@/lib/api'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setError('Código de autenticação inválido.')
      setStatus('error')
      return
    }

    githubCallback(code)
      .then(({ access_token, user }) => {
        localStorage.setItem('codemates_token', access_token)
        localStorage.setItem('codemates_user', JSON.stringify(user))
        router.push('/dashboard')
      })
      .catch((err) => {
        setError(err.message || 'Erro na autenticação.')
        setStatus('error')
      })
  }, [searchParams, router])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', position: 'relative', zIndex: 1,
    }}>
      {status === 'loading' ? (
        <>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--bg3)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 20,
            color: 'var(--green)', marginBottom: 24,
          }}>
            &gt;_
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
            color: 'var(--muted)',
          }}>
            // autenticando com GitHub...
          </div>
        </>
      ) : (
        <div style={{
          background: 'var(--bg3)', border: '1px solid #FF4444',
          borderRadius: 12, padding: '24px 32px', textAlign: 'center',
        }}>
          <p style={{ color: '#FF6666', fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>
            {error}
          </p>
          <button
            onClick={() => router.push('/')}
            style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600,
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--green)', color: '#0A0E1A',
            }}
          >
            Voltar
          </button>
        </div>
      )}
    </div>
  )
}
