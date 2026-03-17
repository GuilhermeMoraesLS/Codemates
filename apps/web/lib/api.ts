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
    const detail = err.detail
    const msg = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join('; ')
        : res.statusText
    throw new Error(msg || 'API error')
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
  return request<RankingResult>(`/groups/${groupId}/ranking`)
}

export async function getGroupFeed(groupId: string) {
  return request<{ eventos: FeedEvent[] }>(`/groups/${groupId}/feed`)
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

export async function getMyMission(groupId: string) {
  return request<MissionV2>(`/missions/my/${groupId}`)
}

export async function submitDelivery(missionId: string, commitUrl: string) {
  return request<SubmitResult>(`/missions/${missionId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ commit_url: commitUrl }),
  })
}

export type IndividualMissionResult = MissionV2 | { generating: true }

export async function getMyIndividualMission(): Promise<IndividualMissionResult | null> {
  try {
    return await request<MissionV2>('/missions/my')
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'generating') return { generating: true }
    if (err instanceof Error) return null
    throw err
  }
}

export async function generateIndividualMission(trilha: string): Promise<MissionV2> {
  return request<MissionV2>('/missions/generate-individual', {
    method: 'POST',
    body: JSON.stringify({ trilha }),
  })
}

export async function regenerateIndividualMission(): Promise<MissionV2> {
  return request<MissionV2>('/missions/regenerate-individual', { method: 'POST' })
}

export async function getMissionHistory() {
  return request<{ missoes: MissionHistory[] }>('/missions/history')
}

export async function getMyActivity() {
  return request<ActivityWeek[]>('/missions/activity')
}

export async function getMyAchievements() {
  return request<{ achievements: Achievement[] }>('/missions/achievements')
}

export async function getMyMissionHistory() {
  return getMissionHistory()
}

// ── Market Missions ────────────────────────────────────────────
export async function getMarketMission() {
  return request<MarketMissionResponse>('/missions/mercado')
}

export async function acceptMarketMission() {
  return request<{ message: string; mission_id: string }>('/missions/mercado/aceitar', { method: 'POST' })
}

export async function submitMarketMission(commitUrl: string) {
  return request<{ aprovado: boolean; feedback: string; pontos_ganhos: number }>('/missions/mercado/submit', {
    method: 'POST',
    body: JSON.stringify({ commit_url: commitUrl }),
  })
}

// ── Portfolio ──────────────────────────────────────────────────
export async function getUserPortfolio(username: string) {
  return request<PortfolioResponse>(`/users/${username}/portfolio`)
}

export async function upgradeToPro() {
  return request<{ message: string; plano: string }>('/auth/upgrade-pro', { method: 'POST' })
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
  plano?: string
}

export interface GithubProfile {
  linguagens_json: Record<string, number>
  frameworks_json: string[]
  nivel_mercado: string | null
  repos_publicos: number
  frequencia_commits: string
  ultimo_scan: string | null
  especialidade_detectada: string
  areas_a_fortalecer: string[]
  missao_sugerida: string
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

export interface RankingMember {
  user_id: string
  username: string
  avatar: string | null
  nivel: string
  pontos_semana: number
  pontos_total: number
  missoes_entregues: number
  ultima_entrega: string | null
  posicao: number
}

export interface RankingResult {
  semanal: RankingMember[]
  geral: RankingMember[]
}

// Legacy shape still used in groups page
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

export interface MissionV2 {
  id: string
  group_id: string
  user_id: string | null
  mission_bank_id: string
  titulo: string
  descricao: string
  contexto_mercado: string
  exemplo_commit: string
  criterios: Record<string, unknown> | null
  pontos: number
  trilha: string
  nivel: number
  semana_ref: string
  status: string
  entregue: boolean
  entrega: Delivery | null
  can_regenerate?: boolean
}

export interface SubmitResult {
  aprovado: boolean
  feedback: string
  criterio_falhou: string | null
  criterios_resultado: Record<string, boolean>
  pontos_ganhos: number
  pontos_bonus: number
  ranking_pos_atual: number | null
  leveled_up?: boolean
  new_nivel?: string | null
  new_achievements?: Achievement[]
  streak_coletivo_novo?: number | null
}

export interface FeedEvent {
  tipo: 'missao_concluida' | 'membro_entrou'
  timestamp: string
  username: string
  avatar: string | null
  titulo_missao: string | null
  trilha: string | null
  xp: number
}

export interface ActivityWeek {
  semana_ref: string
  xp: number
}

export interface Achievement {
  id: string
  nome: string
  descricao: string
  icone: string
  criterio: string
  xp_bonus: number
  desbloqueado: boolean
  desbloqueado_em: string | null
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
  pontos_bonus: number
  semana_ref: string
  verificado_em: string
}

export interface PortfolioUser {
  id: string
  username: string
  avatar: string | null
  nivel: string
  pontos_total: number
  missoes_concluidas: number
  streak_atual: number
  plano: string
  created_at: string | null
}

export interface CompletedMission {
  id: string
  titulo: string
  trilha: string
  nivel: number
  pontos: number
  semana_ref: string
  pontos_ganhos: number
  pontos_bonus: number
  verificado_em: string
  commit_url: string | null
}

export interface PortfolioResponse {
  user: PortfolioUser
  github_profile: GithubProfile
  completed_missions: CompletedMission[]
  achievements: Achievement[]
  activity: ActivityWeek[]
}

export interface MarketMission {
  id: string
  semana_ref: string
  trilha: string
  titulo: string
  descricao: string
  contexto_mercado: string
  exemplo_commit: string
  criterios: Record<string, unknown>
  pontos: number
  nivel: number
}

export interface MarketMissionResponse {
  mission: MarketMission | null
  aceita: boolean
  entregue: boolean
  commit_url: string | null
}

export interface MissionHistory {
  id: string
  mission_bank_id: string
  titulo: string
  descricao: string
  trilha: string
  nivel: number
  pontos: number
  semana_ref: string
  status: string
  entregue: boolean
  pontos_ganhos: number | null
  status_entrega: 'concluida' | 'ativa' | 'expirada'
}
