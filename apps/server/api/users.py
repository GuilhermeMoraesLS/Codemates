from fastapi import APIRouter, HTTPException
from core.supabase_client import get_supabase
from models.schemas import UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{username}", response_model=UserPublic)
async def get_public_profile(username: str):
    """Public profile page — no auth required."""
    db = get_supabase()

    user = db.table("users").select("*").eq("username", username).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    u = user.data[0]
    return UserPublic(
        id=u["id"],
        username=u["username"],
        avatar=u.get("avatar"),
        streak_atual=u["streak_atual"],
        pontos_total=u["pontos_total"],
        nivel=u["nivel"],
        missoes_concluidas=u["missoes_concluidas"],
    )


@router.get("/{username}/github-profile")
async def get_github_profile(username: str):
    """Return cached GitHub profile analysis."""
    db = get_supabase()

    user = db.table("users").select("id").eq("username", username).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    profile = db.table("github_profiles").select("*").eq("user_id", user.data[0]["id"]).execute()
    if not profile.data:
        return {"linguagens_json": {}, "repos_publicos": 0, "frequencia_commits": "baixa", "frameworks_json": [], "nivel_mercado": "", "especialidade_detectada": "", "areas_a_fortalecer": [], "missao_sugerida": ""}

    return profile.data[0]


@router.get("/{username}/groups")
async def get_user_groups(username: str):
    """Return groups the user is a member of."""
    db = get_supabase()

    user = db.table("users").select("id").eq("username", username).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    memberships = (
        db.table("group_members")
        .select("group_id")
        .eq("user_id", user.data[0]["id"])
        .execute()
    )
    if not memberships.data:
        return []

    group_ids = [m["group_id"] for m in memberships.data]
    groups = db.table("groups").select("*").in_("id", group_ids).execute()
    return groups.data


@router.get("/{username}/deliveries")
async def get_user_deliveries(username: str):
    """Return recent deliveries for a user's public profile."""
    db = get_supabase()

    user = db.table("users").select("id").eq("username", username).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    deliveries = (
        db.table("deliveries")
        .select("*, missions(descricao, semana_ref, pontos)")
        .eq("user_id", user.data[0]["id"])
        .order("verificado_em", desc=True)
        .limit(20)
        .execute()
    )

    return deliveries.data
