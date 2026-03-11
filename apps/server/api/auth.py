from fastapi import APIRouter, HTTPException
from jose import jwt
from datetime import datetime, timedelta
import uuid

from core.config import get_settings
from core.supabase_client import get_supabase
from core.github_client import exchange_code_for_token, get_github_user
from agents.profile_agent import run_profile_agent
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


@router.post("/github/callback", response_model=AuthResponse)
async def github_callback(body: GitHubCallbackRequest):
    """
    Exchange GitHub OAuth code for app JWT.
    Creates user if first login, triggers Profile Agent scan.
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

        # 4. Trigger Profile Agent scan (async, best-effort)
        try:
            profile_data = run_profile_agent(username, github_token)
            db.table("github_profiles").upsert({
                "user_id": user["id"],
                "linguagens_json": profile_data.get("linguagens_json", {}),
                "frameworks_json": profile_data.get("frameworks_json", []),
                "nivel_mercado": profile_data.get("nivel_mercado"),
                "repos_publicos": profile_data.get("repos_publicos", 0),
                "frequencia_commits": profile_data.get("frequencia_commits", "baixa"),
                "ultimo_scan": datetime.utcnow().isoformat(),
            }).execute()
        except Exception:
            pass  # Non-blocking — profile scan failure shouldn't break login

    # 5. Issue JWT
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
