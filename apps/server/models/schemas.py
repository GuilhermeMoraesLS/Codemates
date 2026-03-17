from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Auth ─────────────────────────────────────────────────────

class GitHubCallbackRequest(BaseModel):
    code: str


class AuthResponse(BaseModel):
    access_token: str
    user: "UserPublic"


# ── Users ─────────────────────────────────────────────────────

class UserPublic(BaseModel):
    id: str
    username: str
    avatar: Optional[str]
    streak_atual: int
    pontos_total: int
    nivel: str
    missoes_concluidas: int
    plano: str = "free"


class GitHubProfileData(BaseModel):
    linguagens_json: dict = Field(default_factory=dict)
    repos_publicos: int = 0
    frequencia_commits: str = "baixa"  # alta | media | baixa
    frameworks_json: list = Field(default_factory=list)
    nivel_mercado: str = ""
    especialidade_detectada: str = ""
    areas_a_fortalecer: list = Field(default_factory=list)
    missao_sugerida: str = ""


# ── Groups ────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    nome: str
    stack_alvo: str
    objetivo: Optional[str] = None
    max_membros: int = Field(default=5, ge=3, le=7)


class GroupPublic(BaseModel):
    id: str
    nome: str
    stack_alvo: str
    objetivo: Optional[str]
    streak_coletivo: int
    max_membros: int
    created_at: datetime


# ── Missions ──────────────────────────────────────────────────

class MissionBankItem(BaseModel):
    id: str
    trilha: str
    nivel: int
    titulo: str
    descricao_template: str
    descricao_curta: str
    contexto_mercado: str
    exemplo_commit_valido: str
    criterios: dict
    pontos_base: int
    tags_stack: List[str]
    prerequisito_id: Optional[str] = None


class MissionPublic(BaseModel):
    id: str
    group_id: str
    user_id: Optional[str]
    mission_bank_id: str
    titulo: str
    descricao: str
    contexto_mercado: str
    exemplo_commit: str
    criterios: Optional[dict]
    pontos: int
    trilha: str
    nivel: int
    semana_ref: str
    status: str


class MissionGenerated(BaseModel):
    descricao: str
    criterios: dict = Field(
        description="Keywords, linguagens e arquivos esperados para verificação"
    )
    pontos: int = 100


# ── Deliveries ────────────────────────────────────────────────

class DeliveryPublic(BaseModel):
    id: str
    mission_id: str
    user_id: str
    commit_url: str
    pontos_ganhos: int
    verificado_em: datetime


class DeliverySubmit(BaseModel):
    commit_url: str


# ── Ranking ───────────────────────────────────────────────────

class RankingMember(BaseModel):
    user_id: str
    username: str
    avatar: Optional[str]
    nivel: str
    pontos_semana: int
    pontos_total: int
    missoes_entregues: int
    ultima_entrega: Optional[datetime]
    posicao: int


# ── Invites ──────────────────────────────────────────────────

class InviteCreate(BaseModel):
    group_id: str


class InvitePublic(BaseModel):
    token: str
    group_id: str
    expires_at: datetime
