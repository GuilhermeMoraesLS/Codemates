'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getGroup, getGroupRanking, createInvite, type Group, type RankingMember } from '@/lib/api'

const NIVEL_COLORS: Record<string, string> = {
  INICIANTE: 'var(--muted)',
  DEV: 'var(--cyan)',
  ENGENHEIRO: 'var(--green)',
  'SÊNIOR': 'var(--purple)',
  ARQUITETO: '#FFD700',
}

export default function GroupPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.id as string

  const [group, setGroup] = useState<Group | null>(null)
  const [ranking, setRanking] = useState<{ semanal: RankingMember[]; geral: RankingMember[] }>({ semanal: [], geral: [] })
  const [loading, setLoading] = useState(true)
  const [inviteToken, setInviteToken] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const userData = localStorage.getItem('codemates_user')
    if (userData) setCurrentUserId(JSON.parse(userData).id)
  }, [])

  useEffect(() => {
    if (!groupId) return
    Promise.all([getGroup(groupId), getGroupRanking(groupId)])
      .then(([g, r]) => {
        setGroup(g)
        setRanking({
          semanal: Array.isArray(r?.semanal) ? r.semanal : [],
          geral:   Array.isArray(r?.geral)   ? r.geral   : [],
        })
      })
      .catch(() => router.push('/dashboard'))
      .finally(() => setLoading(false))
  }, [groupId, router])

  async function handleCreateInvite() {
    setInviteLoading(true)
    try {
      const inv = await createInvite(groupId)
      setInviteToken(inv.token)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar convite')
    } finally {
      setInviteLoading(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(inviteToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)' }}>// carregando grupo...</span>
      </div>
    )
  }

  if (!group) return null

  const tabAtiva = 'semanal'
  const rankingAtivo = tabAtiva === 'semanal' ? ranking.semanal : ranking.geral
  const listaSegura: any[] = Array.isArray(rankingAtivo) ? rankingAtivo : []

  const isOwner = listaSegura[0]?.user_id === currentUserId || listaSegura.length === 0

  return (
    <div style={{ minHeight: '100vh', padding: '32px 48px', position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 40 }}>
        <div>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, marginBottom: 16, padding: 0 }}
          >
            ← voltar
          </button>
          <h1 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0, marginBottom: 6 }}>
            {group.nome}
          </h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--cyan)', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', padding: '3px 10px', borderRadius: 20 }}>
              {group.stack_alvo}
            </span>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: 'var(--muted)' }}>
              {listaSegura.length}/{group.max_membros} membros
            </span>
            {group.streak_coletivo > 0 && (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--green)' }}>
                🔥 streak {group.streak_coletivo}
              </span>
            )}
          </div>
          {group.objetivo && (
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: 'var(--muted)', margin: '10px 0 0', maxWidth: 500 }}>
              {group.objetivo}
            </p>
          )}
        </div>

        {/* Invite section — visible to owner */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <button
            onClick={handleCreateInvite}
            disabled={inviteLoading}
            style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600,
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              background: 'var(--bg2)', border: '1px solid var(--border)',
              color: 'var(--text)', opacity: inviteLoading ? 0.5 : 1,
            }}
          >
            {inviteLoading ? '...' : '+ gerar convite'}
          </button>
          {inviteToken && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px' }}>
              <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--green)' }}>
                {inviteToken}
              </code>
              <button
                onClick={handleCopy}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: copied ? 'var(--green)' : 'var(--muted)', padding: 0 }}
              >
                {copied ? '✓ copiado' : 'copiar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ranking */}
      <div>
        <h2 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          // ranking
        </h2>

        {listaSegura.length === 0 ? (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)', margin: 0 }}>
              // nenhum membro ainda
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {listaSegura.map((member, i) => {
              const nivelColor = NIVEL_COLORS[member.nivel ?? ''] || 'var(--muted)'
              const isFirst = i === 0
              return (
                <div
                  key={member.user_id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    background: isFirst ? 'rgba(0,255,148,0.04)' : 'var(--bg2)',
                    border: `1px solid ${isFirst ? 'rgba(0,255,148,0.2)' : 'var(--border)'}`,
                    borderRadius: 12, padding: '14px 20px',
                  }}
                >
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 800, color: isFirst ? 'var(--green)' : 'var(--muted)', width: 24, textAlign: 'center' }}>
                    {i === 0 ? '▲' : i + 1}
                  </span>
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.username} style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--border)' }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg3)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: 'var(--muted)' }}>
                      {member.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      {member.username}
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: nivelColor }}>
                      {member.nivel}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                      {member.pontos_grupo} <span style={{ fontSize: 11, color: 'var(--muted)' }}>pts</span>
                    </div>
                    {member.streak_atual > 0 && (
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>
                        🔥 {member.streak_atual}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
