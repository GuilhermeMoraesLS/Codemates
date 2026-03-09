from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import uuid
from datetime import datetime

from core.config import get_settings
from core.supabase_client import get_supabase
from core.streak import get_current_week_ref
from models.schemas import MissionPublic

router = APIRouter(prefix="/missions", tags=["missions"])
security = HTTPBearer()


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    s = get_settings()
    try:
        payload = jwt.decode(credentials.credentials, s.server_secret_key, algorithms=["HS256"])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")


@router.get("/group/{group_id}/current")
async def get_current_missions(group_id: str, user_id: str = Depends(get_current_user_id)):
    """Return current week's missions for a group (individual + collective)."""
    db = get_supabase()
    semana_ref = get_current_week_ref()

    missions = (
        db.table("missions")
        .select("*")
        .eq("group_id", group_id)
        .eq("semana_ref", semana_ref)
        .eq("status", "ativa")
        .execute()
    )

    individual = [m for m in missions.data if m["tipo"] == "individual" and m.get("user_id") == user_id]
    coletiva = [m for m in missions.data if m["tipo"] == "coletiva"]

    # Get deliveries for current user this week
    deliveries = (
        db.table("deliveries")
        .select("mission_id, pontos_ganhos, commit_url")
        .eq("user_id", user_id)
        .execute()
    )
    delivered_mission_ids = {d["mission_id"] for d in deliveries.data}

    return {
        "semana_ref": semana_ref,
        "individual": individual[0] if individual else None,
        "coletiva": coletiva[0] if coletiva else None,
        "minhas_entregas": deliveries.data,
        "missao_individual_entregue": individual[0]["id"] in delivered_mission_ids if individual else False,
        "missao_coletiva_entregue": coletiva[0]["id"] in delivered_mission_ids if coletiva else False,
    }


@router.get("/group/{group_id}/history")
async def get_mission_history(group_id: str):
    """Return past missions for a group."""
    db = get_supabase()

    missions = (
        db.table("missions")
        .select("*")
        .eq("group_id", group_id)
        .order("created_at", desc=True)
        .limit(12)
        .execute()
    )

    return missions.data
