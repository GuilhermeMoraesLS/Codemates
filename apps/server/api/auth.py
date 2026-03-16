from fastapi import APIRouter, HTTPException, BackgroundTasks
from jose import jwt
from datetime import datetime, timedelta
import uuid
import logging

logger = logging.getLogger(__name__)

from core.config import get_settings
from core.supabase_client import get_supabase
from core.streak import get_current_week_ref
from core.github_client import exchange_code_for_token, get_github_user
from agents.profile_agent import run_profile_agent
from agents.mission_agent import run_mission_agent
from models.schemas import GitHubCallbackRequest, AuthResponse, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


def create_jwt(user_id: str) -> str:
    s = get_settings()
    payload = {
        "sub": user_id,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=30),
    }
    return jwt.encode(payload, s.server_secret_key, algorithm="HS256")


def _generate_individual_mission_bg(user_id: str, user_nivel: str) -> None:
    """
    Background task: generate an individual weekly mission if the user
    doesn't have one yet for the current ISO week.
    Runs after the response is sent — never blocks login.
    """
    try:
        db = get_supabase()
        semana_ref = get_current_week_ref()

        # Skip if active individual mission already exists this week
        existing = (
            db.table("missions")
            .select("id")
            .eq("user_id", user_id)
            .eq("semana_ref", semana_ref)
            .eq("status", "ativa")
            .is_("group_id", "null")
            .execute()
        )
        if existing.data:
            return

        # Fetch GitHub profile (may be empty for brand-new users before scan)
        profile_result = (
            db.table("github_profiles")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        member_profile = profile_result.data[0] if profile_result.data else {}

        # Fetch mission history to avoid repeats
        history_result = (
            db.table("missions")
            .select("mission_bank_id")
            .eq("user_id", user_id)
            .execute()
        )
        mission_history = [
            m["mission_bank_id"]
            for m in history_result.data
            if m.get("mission_bank_id")
        ]

        group = {
            "stack_alvo": member_profile.get("nivel_mercado") or "desenvolvimento de software",
            "objetivo": "evolução técnica individual",
        }

        mission_data = run_mission_agent(
            member_profile=member_profile,
            group=group,
            mission_history=mission_history,
            user_nivel=user_nivel,
        )

        db.table("missions").insert({
            "id": str(uuid.uuid4()),
            "group_id": None,
            "user_id": user_id,
            "tipo": "individual",
            "mission_bank_id": mission_data.get("mission_bank_id", ""),
            "titulo": mission_data.get("titulo", ""),
            "descricao": mission_data.get("descricao", ""),
            "contexto_mercado": mission_data.get("contexto_mercado", ""),
            "exemplo_commit": mission_data.get("exemplo_commit", ""),
            "criterios": mission_data.get("criterios", {}),
            "pontos": mission_data.get("pontos", 80),
            "trilha": mission_data.get("trilha", ""),
            "nivel": mission_data.get("nivel", 1),
            "semana_ref": semana_ref,
            "status": "ativa",
        }).execute()

        logger.info(f"[mission_agent] missão individual gerada: user={user_id} semana={semana_ref}")

    except Exception as e:
        logger.error(
            f"[mission_agent] missão individual falhou: user={user_id}: "
            f"{type(e).__name__}: {e}"
        )


@router.post("/github/callback", response_model=AuthResponse)
async def github_callback(body: GitHubCallbackRequest, background_tasks: BackgroundTasks):
    """
    Exchange GitHub OAuth code for app JWT.
    Creates user if first login, triggers Profile Agent scan.
    Schedules individual mission generation in background for all logins.
    """
    s = get_settings()
    db = get_supabase()

    # 1. Exchange code → GitHub token
    try:
        github_token = await exchange_code_for_token(
            body.code, s.github_client_id, s.github_client_secret
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 2. Fetch GitHub user
    gh_user = await get_github_user(github_token)
    github_id = gh_user["id"]
    username = gh_user["login"]
    avatar = gh_user.get("avatar_url")

    # 3. Upsert user in DB
    existing = db.table("users").select("*").eq("github_id", github_id).execute()

    if existing.data:
        user = existing.data[0]
    else:
        # New user — create record
        new_user = {
            "id": str(uuid.uuid4()),
            "github_id": github_id,
            "username": username,
            "avatar": avatar,
            "streak_atual": 0,
            "pontos_total": 0,
            "nivel": "INICIANTE",
            "missoes_concluidas": 0,
            "plano": "free",
        }
        result = db.table("users").insert(new_user).execute()
        user = result.data[0]

        # 4. Trigger Profile Agent scan (best-effort, blocking for new users only)
        try:
            profile_data = run_profile_agent(username, github_token)
            db.table("github_profiles").upsert({
                "user_id": user["id"],
                "linguagens_json": profile_data.get("linguagens_json", {}),
                "frameworks_json": profile_data.get("frameworks_json", []),
                "nivel_mercado": profile_data.get("nivel_mercado"),
                "repos_publicos": profile_data.get("repos_publicos", 0),
                "frequencia_commits": profile_data.get("frequencia_commits", "baixa"),
                "especialidade_detectada": profile_data.get("especialidade_detectada", ""),
                "areas_a_fortalecer": profile_data.get("areas_a_fortalecer", []),
                "missao_sugerida": profile_data.get("missao_sugerida", ""),
                "ultimo_scan": datetime.utcnow().isoformat(),
            }).execute()
        except Exception as e:
            logger.error(f"[profile_agent] falhou para {username}: {type(e).__name__}: {e}")

    # 5. Schedule individual mission generation (non-blocking, runs after response)
    background_tasks.add_task(_generate_individual_mission_bg, user["id"], user["nivel"])

    # 6. Issue JWT
    token = create_jwt(user["id"])

    return AuthResponse(
        access_token=token,
        user=UserPublic(
            id=user["id"],
            username=user["username"],
            avatar=user.get("avatar"),
            streak_atual=user["streak_atual"],
            pontos_total=user["pontos_total"],
            nivel=user["nivel"],
            missoes_concluidas=user["missoes_concluidas"],
        ),
    )
