from pydantic import BaseModel, Field
from typing import Optional
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


class GitHubProfileData(BaseModel):
    linguagens_json: dict = Field(default_factory=dict)
    repos_publicos: int = 0
    frequencia_commits: str = "baixa"  # alta | media | baixa


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

class MissionPublic(BaseModel):
    id: str
    group_id: str
    user_id: Optional[str]
    tipo: str
    descricao: str
    criterios: Optional[dict]
    pontos: int
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


# ── Invites ──────────────────────────────────────────────────

class InviteCreate(BaseModel):
    group_id: str


class InvitePublic(BaseModel):
    token: str
    group_id: str
    expires_at: datetime
