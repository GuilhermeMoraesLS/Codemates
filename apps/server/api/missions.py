import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from core.config import get_settings
from core.supabase_client import get_supabase
from core.streak import get_current_week_ref, calcular_nivel
from agents.mission_agent import run_mission_agent
from agents.verification_agent import run_verification_agent
from models.schemas import MissionPublic, DeliverySubmit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/missions", tags=["missions"])
security = HTTPBearer()


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    s = get_settings()
    try:
        payload = jwt.decode(credentials.credentials, s.server_secret_key, algorithms=["HS256"])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")


@router.post("/generate/{group_id}")
async def generate_missions(group_id: str, user_id: str = Depends(get_current_user_id)):
    """
    Generate individual weekly missions for every member of the group.
    Skips members who already have an active mission this week.
    """
    db = get_supabase()
    semana_ref = get_current_week_ref()

    group_result = db.table("groups").select("*").eq("id", group_id).execute()
    if not group_result.data:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")
    group = group_result.data[0]

    members_result = (
        db.table("group_members")
        .select("user_id")
        .eq("group_id", group_id)
        .execute()
    )
    if not members_result.data:
        return {"geradas": [], "semana_ref": semana_ref, "total": 0}

    generated = []

    for member in members_result.data:
        member_user_id = member["user_id"]

        # Skip if active mission already exists this week for this member
        existing = (
            db.table("missions")
            .select("id")
            .eq("group_id", group_id)
            .eq("user_id", member_user_id)
            .eq("semana_ref", semana_ref)
            .eq("status", "ativa")
            .execute()
        )
        if existing.data:
            continue

        # Get GitHub profile
        profile_result = (
            db.table("github_profiles")
            .select("*")
            .eq("user_id", member_user_id)
            .execute()
        )
        member_profile = profile_result.data[0] if profile_result.data else {}

        # Get user level
        user_result = (
            db.table("users")
            .select("nivel")
            .eq("id", member_user_id)
            .execute()
        )
        user_nivel = user_result.data[0]["nivel"] if user_result.data else "INICIANTE"

        # Get mission history (all mission_bank_ids ever assigned to this user)
        history_result = (
            db.table("missions")
            .select("mission_bank_id")
            .eq("user_id", member_user_id)
            .execute()
        )
        mission_history = [
            m["mission_bank_id"]
            for m in history_result.data
            if m.get("mission_bank_id")
        ]

        try:
            mission_data = run_mission_agent(
                member_profile=member_profile,
                group=group,
                mission_history=mission_history,
                user_nivel=user_nivel,
            )

            new_mission = {
                "id": str(uuid.uuid4()),
                "group_id": group_id,
                "user_id": member_user_id,
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
            }
            result = db.table("missions").insert(new_mission).execute()
            generated.append(result.data[0])

        except Exception as e:
            logger.error(
                f"[mission_agent] falhou para user {member_user_id}: "
                f"{type(e).__name__}: {e}"
            )

    return {"geradas": generated, "semana_ref": semana_ref, "total": len(generated)}


@router.get("/current/{group_id}")
async def get_current_missions(group_id: str, user_id: str = Depends(get_current_user_id)):
    """
    Return all active individual missions for the group this week.
    Each mission includes delivery status. The authenticated user's mission
    is flagged with destaque=True and sorted first.
    """
    db = get_supabase()
    semana_ref = get_current_week_ref()

    missions_result = (
        db.table("missions")
        .select("*")
        .eq("group_id", group_id)
        .eq("semana_ref", semana_ref)
        .eq("status", "ativa")
        .eq("tipo", "individual")
        .execute()
    )

    mission_ids = [m["id"] for m in missions_result.data]
    deliveries_map: dict = {}

    if mission_ids:
        deliveries_result = (
            db.table("deliveries")
            .select("mission_id, user_id, pontos_ganhos, verificado_em")
            .in_("mission_id", mission_ids)
            .execute()
        )
        for d in deliveries_result.data:
            deliveries_map[d["mission_id"]] = d

    missions_with_status = []
    for m in missions_result.data:
        delivery = deliveries_map.get(m["id"])
        missions_with_status.append({
            **m,
            "entregue": delivery is not None,
            "pontos_ganhos": delivery["pontos_ganhos"] if delivery else None,
            "destaque": m.get("user_id") == user_id,
        })

    # Authenticated user's mission appears first
    missions_with_status.sort(key=lambda x: (not x["destaque"], x.get("titulo", "")))

    return {"semana_ref": semana_ref, "missoes": missions_with_status}


@router.get("/my")
async def get_my_individual_mission(user_id: str = Depends(get_current_user_id)):
    """
    Return the authenticated user's active individual mission for the current week.
    Individual missions have group_id IS NULL.
    Returns 404 with detail 'generating' if none exists yet.
    """
    db = get_supabase()
    semana_ref = get_current_week_ref()

    result = (
        db.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("semana_ref", semana_ref)
        .eq("status", "ativa")
        .is_("group_id", "null")
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="generating")

    mission = result.data[0]

    delivery_result = (
        db.table("deliveries")
        .select("*")
        .eq("mission_id", mission["id"])
        .eq("user_id", user_id)
        .execute()
    )

    return {
        **mission,
        "entregue": bool(delivery_result.data),
        "entrega": delivery_result.data[0] if delivery_result.data else None,
    }


@router.get("/history")
async def get_my_mission_history(user_id: str = Depends(get_current_user_id)):
    """
    Return the authenticated user's last 8 individual missions (group_id IS NULL),
    ordered by semana_ref descending. Includes delivery status for each.
    """
    db = get_supabase()

    result = (
        db.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .is_("group_id", "null")
        .order("semana_ref", desc=True)
        .limit(8)
        .execute()
    )

    mission_ids = [m["id"] for m in result.data]
    deliveries_map: dict = {}

    if mission_ids:
        deliveries_result = (
            db.table("deliveries")
            .select("mission_id, pontos_ganhos, pontos_bonus, verificado_em")
            .in_("mission_id", mission_ids)
            .execute()
        )
        for d in deliveries_result.data:
            deliveries_map[d["mission_id"]] = d

    missions_with_status = []
    for m in result.data:
        delivery = deliveries_map.get(m["id"])
        if delivery:
            status_entrega = "concluida"
        elif m["status"] == "ativa":
            status_entrega = "ativa"
        else:
            status_entrega = "expirada"

        missions_with_status.append({
            **m,
            "entregue": delivery is not None,
            "pontos_ganhos": delivery["pontos_ganhos"] if delivery else None,
            "status_entrega": status_entrega,
        })

    return {"missoes": missions_with_status}


@router.get("/my/{group_id}")
async def get_my_mission(group_id: str, user_id: str = Depends(get_current_user_id)):
    """
    Return the authenticated user's active mission for the current week
    in this group, including criterios, contexto_mercado and exemplo_commit.
    """
    db = get_supabase()
    semana_ref = get_current_week_ref()

    result = (
        db.table("missions")
        .select("*")
        .eq("group_id", group_id)
        .eq("user_id", user_id)
        .eq("semana_ref", semana_ref)
        .eq("status", "ativa")
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Nenhuma missão ativa para esta semana")

    mission = result.data[0]

    delivery_result = (
        db.table("deliveries")
        .select("*")
        .eq("mission_id", mission["id"])
        .eq("user_id", user_id)
        .execute()
    )

    return {
        **mission,
        "entregue": bool(delivery_result.data),
        "entrega": delivery_result.data[0] if delivery_result.data else None,
    }


@router.post("/{mission_id}/submit")
async def submit_mission(
    mission_id: str,
    body: DeliverySubmit,
    user_id: str = Depends(get_current_user_id),
):
    """
    Submit a commit URL as evidence for a mission.
    Runs structural + LLM verification.
    If approved, records the delivery and updates points/streak.
    Always returns feedback regardless of approval.
    """
    db = get_supabase()

    # ── Validate mission ownership ────────────────────────────────
    mission_result = (
        db.table("missions")
        .select("*")
        .eq("id", mission_id)
        .eq("user_id", user_id)
        .eq("status", "ativa")
        .execute()
    )
    if not mission_result.data:
        raise HTTPException(
            status_code=404,
            detail="Missão não encontrada ou não pertence a este usuário",
        )
    mission = mission_result.data[0]

    # ── Guard: no double submit ───────────────────────────────────
    existing_delivery = (
        db.table("deliveries")
        .select("id, pontos_ganhos")
        .eq("mission_id", mission_id)
        .eq("user_id", user_id)
        .execute()
    )
    if existing_delivery.data:
        raise HTTPException(
            status_code=409,
            detail="Você já entregou esta missão",
        )

    # ── Fetch GitHub token (best-effort — public repos work without it) ──
    profile_result = (
        db.table("github_profiles")
        .select("github_token")
        .eq("user_id", user_id)
        .execute()
    )
    github_token = ""
    if profile_result.data:
        github_token = profile_result.data[0].get("github_token") or ""

    # Get username for agent context
    user_result = db.table("users").select("username").eq("id", user_id).execute()
    username = user_result.data[0]["username"] if user_result.data else ""

    # ── Run verification ──────────────────────────────────────────
    try:
        verification = run_verification_agent(
            commit_url=body.commit_url,
            mission=mission,
            github_token=github_token,
            username=username,
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"[verification_agent] falhou para mission {mission_id}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao verificar o commit")

    # ── If rejected, return feedback without saving ───────────────
    if not verification["aprovado"]:
        return {
            "aprovado": False,
            "feedback": verification["feedback"],
            "criterio_falhou": verification["criterio_falhou"],
            "criterios_resultado": verification["criterios_resultado"],
            "pontos_ganhos": 0,
            "pontos_bonus": 0,
            "ranking_pos_atual": None,
        }

    # ── Approved: persist delivery ────────────────────────────────
    semana_ref = get_current_week_ref()
    pontos_ganhos = verification["pontos_ganhos"]
    pontos_bonus = verification["pontos_bonus"]
    pontos_total_entrega = pontos_ganhos + pontos_bonus

    db.table("deliveries").insert({
        "id": str(uuid.uuid4()),
        "mission_id": mission_id,
        "user_id": user_id,
        "commit_url": body.commit_url,
        "commit_sha": verification["_commit_sha"],
        "repo_name": verification["_repo_name"],
        "pontos_ganhos": pontos_ganhos,
        "pontos_bonus": pontos_bonus,
        "semana_ref": semana_ref,
        "verificado_em": datetime.utcnow().isoformat(),
    }).execute()

    # ── Update user stats ─────────────────────────────────────────
    user_data = (
        db.table("users")
        .select("pontos_total, missoes_concluidas")
        .eq("id", user_id)
        .execute()
    )
    if user_data.data:
        u = user_data.data[0]
        new_pontos = u["pontos_total"] + pontos_total_entrega
        new_missoes = u["missoes_concluidas"] + 1
        db.table("users").update({
            "pontos_total": new_pontos,
            "missoes_concluidas": new_missoes,
            "nivel": calcular_nivel(new_missoes),
        }).eq("id", user_id).execute()

    # ── Update group_members (only for group missions) ───────────────────────────
    group_id = mission["group_id"]
    if group_id:
        member_data = (
            db.table("group_members")
            .select("missoes_concluidas")
            .eq("user_id", user_id)
            .eq("group_id", group_id)
            .execute()
        )
        if member_data.data:
            db.table("group_members").update({
                "missoes_concluidas": member_data.data[0]["missoes_concluidas"] + 1,
            }).eq("user_id", user_id).eq("group_id", group_id).execute()

    # ── Check collective streak (only for group missions) ────────────────────────
    if group_id:
        all_members = (
            db.table("group_members")
            .select("user_id")
            .eq("group_id", group_id)
            .execute()
        )
        member_ids = [m["user_id"] for m in all_members.data]

        delivered_this_week = (
            db.table("deliveries")
            .select("user_id")
            .eq("semana_ref", semana_ref)
            .in_("user_id", member_ids)
            .execute()
        )
        delivered_ids = {d["user_id"] for d in delivered_this_week.data}

        if set(member_ids) <= delivered_ids:
            group_data = (
                db.table("groups")
                .select("streak_coletivo")
                .eq("id", group_id)
                .execute()
            )
            if group_data.data:
                db.table("groups").update({
                    "streak_coletivo": group_data.data[0]["streak_coletivo"] + 1,
                }).eq("id", group_id).execute()

    # ── Get updated ranking position (only for group missions) ───────────────────
    ranking_pos_atual = None
    if group_id:
        try:
            semanal = (
                db.table("ranking_semanal")
                .select("user_id, pontos_semana")
                .eq("group_id", group_id)
                .execute()
            )
            if semanal.data:
                sorted_members = sorted(
                    semanal.data,
                    key=lambda x: int(x.get("pontos_semana") or 0),
                    reverse=True,
                )
                for i, m in enumerate(sorted_members, start=1):
                    if m["user_id"] == user_id:
                        ranking_pos_atual = i
                        break
        except Exception as e:
            logger.warning(f"[submit] ranking query falhou: {e}")

    return {
        "aprovado": True,
        "feedback": verification["feedback"],
        "criterio_falhou": None,
        "criterios_resultado": verification["criterios_resultado"],
        "pontos_ganhos": pontos_ganhos,
        "pontos_bonus": pontos_bonus,
        "ranking_pos_atual": ranking_pos_atual,
    }
