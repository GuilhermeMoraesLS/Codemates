const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('codemates_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'API error')
  }
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────
export async function githubCallback(code: string) {
  return request<{ access_token: string; user: User }>('/auth/github/callback', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

// ── Users ─────────────────────────────────────────────────────
export async function getUserProfile(username: string) {
  return request<User>(`/users/${username}`)
}

export async function getUserGithubProfile(username: string) {
  return request<GithubProfile>(`/users/${username}/github-profile`)
}

export async function getUserGroups(username: string) {
  return request<Group[]>(`/users/${username}/groups`)
}

export async function getUserDeliveries(username: string) {
  return request<Delivery[]>(`/users/${username}/deliveries`)
}

// ── Groups ────────────────────────────────────────────────────
export async function createGroup(data: { nome: string; stack_alvo: string; objetivo?: string; max_membros: number }) {
  return request<Group>('/groups/', { method: 'POST', body: JSON.stringify(data) })
}

export async function getGroup(groupId: string) {
  return request<Group>(`/groups/${groupId}`)
}

export async function getGroupRanking(groupId: string) {
  return request<RankingEntry[]>(`/groups/${groupId}/ranking`)
}

export async function createInvite(groupId: string) {
  return request<{ token: string; group_id: string; expires_at: string }>(`/groups/${groupId}/invite`, {
    method: 'POST',
  })
}

export async function joinGroup(token: string) {
  return request<{ message: string; group_id: string }>(`/groups/join/${token}`, { method: 'POST' })
}

// ── Missions ──────────────────────────────────────────────────
export async function getCurrentMissions(groupId: string) {
  return request<CurrentMissions>(`/missions/group/${groupId}/current`)
}

// ── Types ─────────────────────────────────────────────────────
export interface User {
  id: string
  username: string
  avatar: string | null
  streak_atual: number
  pontos_total: number
  nivel: string
  missoes_concluidas: number
}

export interface GithubProfile {
  linguagens_json: Record<string, number>
  frameworks_json: string[]
  nivel_mercado: string | null
  repos_publicos: number
  frequencia_commits: string
  ultimo_scan: string | null
}

export interface Group {
  id: string
  nome: string
  stack_alvo: string
  objetivo: string | null
  streak_coletivo: number
  max_membros: number
  created_at: string
}

export interface RankingEntry {
  position: number
  user_id: string
  username: string
  avatar: string | null
  nivel: string
  streak_atual: number
  pontos_grupo: number
  missoes_concluidas: number
}

export interface Mission {
  id: string
  group_id: string
  user_id: string | null
  tipo: string
  descricao: string
  criterios: Record<string, unknown> | null
  pontos: number
  semana_ref: string
  status: string
}

export interface CurrentMissions {
  semana_ref: string
  individual: Mission | null
  coletiva: Mission | null
  minhas_entregas: Delivery[]
  missao_individual_entregue: boolean
  missao_coletiva_entregue: boolean
}

export interface Delivery {
  id: string
  mission_id: string
  user_id: string
  commit_url: string
  pontos_ganhos: number
  verificado_em: string
}
