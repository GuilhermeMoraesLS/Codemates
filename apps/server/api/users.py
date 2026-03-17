from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from core.supabase_client import get_supabase
from core.streak import get_last_n_week_refs
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


@router.get("/{username}/portfolio")
async def get_user_portfolio(username: str):
    """
    Public portfolio — aggregates user stats, GitHub analysis,
    completed missions, achievements and activity heatmap.
    No auth required.
    """
    db = get_supabase()

    user_result = db.table("users").select("*").eq("username", username).execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    user = user_result.data[0]
    user_id = user["id"]

    # GitHub profile
    profile_result = db.table("github_profiles").select("*").eq("user_id", user_id).execute()
    github_profile = profile_result.data[0] if profile_result.data else {}

    # Completed missions (individual, last 30)
    missions_result = (
        db.table("missions")
        .select("id, titulo, trilha, nivel, pontos, semana_ref, mission_bank_id")
        .eq("user_id", user_id)
        .is_("group_id", "null")
        .order("semana_ref", desc=True)
        .limit(30)
        .execute()
    )
    mission_ids = [m["id"] for m in missions_result.data]
    deliveries_map: dict = {}
    if mission_ids:
        deliveries_result = (
            db.table("deliveries")
            .select("mission_id, pontos_ganhos, pontos_bonus, verificado_em, commit_url")
            .in_("mission_id", mission_ids)
            .execute()
        )
        for d in deliveries_result.data:
            deliveries_map[d["mission_id"]] = d

    completed_missions = []
    for m in missions_result.data:
        d = deliveries_map.get(m["id"])
        if d:
            completed_missions.append({
                **m,
                "pontos_ganhos": d["pontos_ganhos"],
                "pontos_bonus": d.get("pontos_bonus", 0),
                "verificado_em": d["verificado_em"],
                "commit_url": d.get("commit_url"),
            })

    # Unlocked achievements
    defs_result = db.table("achievement_definitions").select("*").execute()
    unlocked_result = (
        db.table("user_achievements")
        .select("achievement_id, desbloqueado_em")
        .eq("user_id", user_id)
        .execute()
    )
    unlocked_map = {u["achievement_id"]: u["desbloqueado_em"] for u in unlocked_result.data}
    achievements = [
        {**a, "desbloqueado": True, "desbloqueado_em": unlocked_map[a["id"]]}
        for a in defs_result.data if a["id"] in unlocked_map
    ]

    # Activity heatmap (last 26 weeks)
    all_deliveries = (
        db.table("deliveries")
        .select("semana_ref, pontos_ganhos, pontos_bonus")
        .eq("user_id", user_id)
        .execute()
    )
    by_week: dict = {}
    for d in all_deliveries.data:
        sr = d.get("semana_ref", "")
        if sr:
            by_week[sr] = by_week.get(sr, 0) + (d.get("pontos_ganhos") or 0) + (d.get("pontos_bonus") or 0)
    weeks = get_last_n_week_refs(26)
    activity = [{"semana_ref": w, "xp": by_week.get(w, 0)} for w in reversed(weeks)]

    return {
        "user": {
            "id": user["id"],
            "username": user["username"],
            "avatar": user.get("avatar"),
            "nivel": user["nivel"],
            "pontos_total": user["pontos_total"],
            "missoes_concluidas": user["missoes_concluidas"],
            "streak_atual": user["streak_atual"],
            "plano": user.get("plano", "free"),
            "created_at": user.get("created_at"),
        },
        "github_profile": github_profile,
        "completed_missions": completed_missions,
        "achievements": achievements,
        "activity": activity,
    }


# ── Level colors for SVG badge ─────────────────────────────────
_NIVEL_COLOR = {
    "INICIANTE":  "#00FF94",
    "DEV":        "#00D4FF",
    "ENGENHEIRO": "#8B5CF6",
    "SÊNIOR":     "#f59e0b",
    "ARQUITETO":  "#ef4444",
}


@router.get("/{username}/badge.svg", response_class=Response)
async def get_user_badge(username: str):
    """
    Returns an SVG badge suitable for embedding in GitHub READMEs.
    Example: ![Codemates](https://api.codemates.dev/users/johndoe/badge.svg)
    """
    db = get_supabase()
    user_result = db.table("users").select("username, nivel, pontos_total, streak_atual").eq("username", username).execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    u = user_result.data[0]

    nivel = u["nivel"]
    xp = u["pontos_total"]
    streak = u["streak_atual"]
    color = _NIVEL_COLOR.get(nivel, "#00FF94")

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="280" height="56">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0A0E1A"/>
      <stop offset="100%" stop-color="#151C30"/>
    </linearGradient>
  </defs>
  <rect width="280" height="56" rx="8" fill="url(#bg)" stroke="{color}" stroke-width="1" stroke-opacity="0.6"/>
  <text x="12" y="22" font-family="monospace" font-size="13" font-weight="700" fill="{color}">&gt;_ codemates</text>
  <text x="12" y="42" font-family="monospace" font-size="11" fill="#94a3b8">{username}</text>
  <text x="110" y="42" font-family="monospace" font-size="11" fill="{color}" font-weight="700">{nivel}</text>
  <text x="185" y="42" font-family="monospace" font-size="11" fill="#64748b">{xp} XP</text>
  <text x="240" y="42" font-family="monospace" font-size="11" fill="#f59e0b">🔥{streak}</text>
</svg>"""

    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-cache, max-age=0"},
    )
