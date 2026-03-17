import logging
import random
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel

from core.config import get_settings
from core.supabase_client import get_supabase
from core.streak import get_current_week_ref, calcular_nivel, get_last_n_week_refs
from agents.mission_agent import run_mission_agent
from agents.verification_agent import run_verification_agent
from agents.market_mission_agent import run_market_mission_agent
from models.schemas import MissionPublic, DeliverySubmit


class GenerateIndividualBody(BaseModel):
    trilha: Optional[str] = ""


TRILHAS = ["qualidade", "testes", "devops", "arquitetura", "integração"]

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


def _build_individual_mission_row(user_id: str, mission_data: dict, semana_ref: str) -> dict:
    return {
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
    }


def _fetch_member_context(db, user_id: str) -> tuple[dict, str, list]:
    """Returns (member_profile, user_nivel, mission_history)."""
    profile_result = db.table("github_profiles").select("*").eq("user_id", user_id).execute()
    member_profile = profile_result.data[0] if profile_result.data else {}

    user_result = db.table("users").select("nivel").eq("id", user_id).execute()
    user_nivel = user_result.data[0]["nivel"] if user_result.data else "INICIANTE"

    history_result = (
        db.table("missions").select("mission_bank_id").eq("user_id", user_id).execute()
    )
    mission_history = [m["mission_bank_id"] for m in history_result.data if m.get("mission_bank_id")]

    return member_profile, user_nivel, mission_history


@router.post("/generate-individual")
async def generate_individual_sync(
    body: GenerateIndividualBody,
    user_id: str = Depends(get_current_user_id),
):
    """
    Synchronous individual mission generation for the authenticated user.
    If an active mission already exists this week, returns it (idempotent).
    Accepts optional trilha preference.
    """
    db = get_supabase()
    semana_ref = get_current_week_ref()

    existing = (
        db.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("semana_ref", semana_ref)
        .eq("status", "ativa")
        .is_("group_id", "null")
        .execute()
    )
    if existing.data:
        mission = existing.data[0]
        all_this_week = (
            db.table("missions").select("id")
            .eq("user_id", user_id).eq("semana_ref", semana_ref)
            .is_("group_id", "null").execute()
        )
        delivery_result = (
            db.table("deliveries").select("id")
            .eq("mission_id", mission["id"]).eq("user_id", user_id).execute()
        )
        can_regenerate = len(all_this_week.data) < 2 and not bool(delivery_result.data)
        return {**mission, "entregue": False, "entrega": None, "can_regenerate": can_regenerate}

    member_profile, user_nivel, mission_history = _fetch_member_context(db, user_id)
    user_plano_result = db.table("users").select("plano").eq("id", user_id).execute()
    user_plano = user_plano_result.data[0].get("plano", "free") if user_plano_result.data else "free"

    group = {
        "stack_alvo": member_profile.get("nivel_mercado") or "desenvolvimento de software",
        "objetivo": "evolução técnica individual",
    }

    try:
        mission_data = run_mission_agent(
            member_profile=member_profile,
            group=group,
            mission_history=mission_history,
            user_nivel=user_nivel,
            trilha_preferida=body.trilha or "",
            plano=user_plano,
        )
        row = _build_individual_mission_row(user_id, mission_data, semana_ref)
        result = db.table("missions").insert(row).execute()
        return {**result.data[0], "entregue": False, "entrega": None, "can_regenerate": True}

    except Exception as e:
        logger.error(f"[generate-individual] user={user_id}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao gerar missão. Tente novamente.")


@router.post("/regenerate-individual")
async def regenerate_individual(user_id: str = Depends(get_current_user_id)):
    """
    Regenerates the user's individual mission with a different trilha.
    Limited to once per week (returns 409 if already regenerated).
    """
    db = get_supabase()
    semana_ref = get_current_week_ref()

    all_this_week = (
        db.table("missions").select("id, status, trilha")
        .eq("user_id", user_id).eq("semana_ref", semana_ref)
        .is_("group_id", "null").execute()
    )
    if len(all_this_week.data) >= 2:
        raise HTTPException(status_code=409, detail="Você já regenerou sua missão esta semana")

    active = (
        db.table("missions").select("*")
        .eq("user_id", user_id).eq("semana_ref", semana_ref)
        .eq("status", "ativa").is_("group_id", "null").execute()
    )
    if not active.data:
        raise HTTPException(status_code=404, detail="Nenhuma missão ativa encontrada")

    current_mission = active.data[0]
    current_trilha = (current_mission.get("trilha") or "").lower()

    # Check if already delivered — cannot regenerate after delivery
    delivery_check = (
        db.table("deliveries").select("id")
        .eq("mission_id", current_mission["id"]).eq("user_id", user_id).execute()
    )
    if delivery_check.data:
        raise HTTPException(status_code=409, detail="Missão já entregue — não é possível regenerar")

    # Close current mission
    db.table("missions").update({"status": "encerrada"}).eq("id", current_mission["id"]).execute()

    # Pick a different trilha
    outras = [t for t in TRILHAS if t.lower() != current_trilha]
    nova_trilha = random.choice(outras) if outras else random.choice(TRILHAS)

    member_profile, user_nivel, mission_history = _fetch_member_context(db, user_id)
    group = {
        "stack_alvo": member_profile.get("nivel_mercado") or "desenvolvimento de software",
        "objetivo": "evolução técnica individual",
    }

    try:
        mission_data = run_mission_agent(
            member_profile=member_profile,
            group=group,
            mission_history=mission_history,
            user_nivel=user_nivel,
            trilha_preferida=nova_trilha,
        )
        row = _build_individual_mission_row(user_id, mission_data, semana_ref)
        result = db.table("missions").insert(row).execute()
        return {**result.data[0], "entregue": False, "entrega": None, "can_regenerate": False}

    except Exception as e:
        logger.error(f"[regenerate-individual] user={user_id}: {type(e).__name__}: {e}")
        # Restore previous mission on failure
        db.table("missions").update({"status": "ativa"}).eq("id", current_mission["id"]).execute()
        raise HTTPException(status_code=500, detail="Erro ao regenerar missão. Tente novamente.")


def _check_achievements(db, user_id: str, missoes_concluidas: int, nivel: str, pontos_bonus: int, pontos_ganhos: int) -> list:
    """Check all criteria and unlock new achievements. Returns list of newly unlocked defs."""
    defs_result = db.table("achievement_definitions").select("*").execute()
    unlocked_result = db.table("user_achievements").select("achievement_id").eq("user_id", user_id).execute()
    unlocked_ids = {u["achievement_id"] for u in unlocked_result.data}

    nivel_order = ["INICIANTE", "DEV", "ENGENHEIRO", "SÊNIOR", "ARQUITETO"]
    nivel_idx = nivel_order.index(nivel) if nivel in nivel_order else 0

    trilhas_result = db.table("missions").select("trilha").eq("user_id", user_id).execute()
    user_trilhas = {(t["trilha"] or "").lower() for t in trilhas_result.data if t.get("trilha")}
    tem_integracao = bool(user_trilhas & {"integração", "integracao"})
    todas_trilhas = (
        "qualidade" in user_trilhas and
        "devops" in user_trilhas and
        "arquitetura" in user_trilhas and
        tem_integracao
    )

    bonus_ratio = (pontos_bonus / pontos_ganhos) if pontos_ganhos else 0

    criteria_met = {
        "missoes_1":        missoes_concluidas >= 1,
        "missoes_3":        missoes_concluidas >= 3,
        "missoes_10":       missoes_concluidas >= 10,
        "missoes_25":       missoes_concluidas >= 25,
        "nivel_DEV":        nivel_idx >= 1,
        "nivel_ENGENHEIRO": nivel_idx >= 2,
        "nivel_SENIOR":     nivel_idx >= 3,
        "bonus_30":         bonus_ratio >= 0.28,
        "todas_trilhas":    todas_trilhas,
    }

    newly_unlocked = []
    for ach in defs_result.data:
        if ach["id"] in unlocked_ids:
            continue
        if criteria_met.get(ach["criterio"], False):
            try:
                db.table("user_achievements").insert({"user_id": user_id, "achievement_id": ach["id"]}).execute()
                newly_unlocked.append(ach)
            except Exception:
                pass  # duplicate — ignore

    return newly_unlocked


@router.get("/activity")
async def get_my_activity(user_id: str = Depends(get_current_user_id)):
    """Return XP earned per week for the last 26 weeks (for heatmap)."""
    db = get_supabase()

    deliveries = (
        db.table("deliveries")
        .select("semana_ref, pontos_ganhos, pontos_bonus")
        .eq("user_id", user_id)
        .execute()
    )

    by_week: dict = {}
    for d in deliveries.data:
        sr = d.get("semana_ref", "")
        if not sr:
            continue
        by_week[sr] = by_week.get(sr, 0) + (d.get("pontos_ganhos") or 0) + (d.get("pontos_bonus") or 0)

    weeks = get_last_n_week_refs(26)
    return [{"semana_ref": w, "xp": by_week.get(w, 0)} for w in reversed(weeks)]


@router.get("/achievements")
async def get_my_achievements(user_id: str = Depends(get_current_user_id)):
    """Return all achievement definitions with unlock status for the user."""
    db = get_supabase()

    defs_result = db.table("achievement_definitions").select("*").execute()
    unlocked_result = (
        db.table("user_achievements")
        .select("achievement_id, desbloqueado_em")
        .eq("user_id", user_id)
        .execute()
    )
    unlocked_map = {u["achievement_id"]: u["desbloqueado_em"] for u in unlocked_result.data}

    return {
        "achievements": [
            {**d, "desbloqueado": d["id"] in unlocked_map, "desbloqueado_em": unlocked_map.get(d["id"])}
            for d in defs_result.data
        ]
    }


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

    all_this_week = (
        db.table("missions").select("id")
        .eq("user_id", user_id).eq("semana_ref", semana_ref)
        .is_("group_id", "null").execute()
    )
    can_regenerate = len(all_this_week.data) < 2 and not bool(delivery_result.data)

    return {
        **mission,
        "entregue": bool(delivery_result.data),
        "entrega": delivery_result.data[0] if delivery_result.data else None,
        "can_regenerate": can_regenerate,
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
    leveled_up = False
    new_nivel_name = None
    new_achievements: list = []

    user_data = (
        db.table("users")
        .select("pontos_total, missoes_concluidas, nivel")
        .eq("id", user_id)
        .execute()
    )
    if user_data.data:
        u = user_data.data[0]
        old_nivel = u["nivel"]
        new_pontos = u["pontos_total"] + pontos_total_entrega
        new_missoes = u["missoes_concluidas"] + 1
        new_nivel = calcular_nivel(new_missoes)
        leveled_up = new_nivel != old_nivel
        new_nivel_name = new_nivel if leveled_up else None

        db.table("users").update({
            "pontos_total": new_pontos,
            "missoes_concluidas": new_missoes,
            "nivel": new_nivel,
        }).eq("id", user_id).execute()

        try:
            new_achievements = _check_achievements(
                db, user_id,
                missoes_concluidas=new_missoes,
                nivel=new_nivel,
                pontos_bonus=pontos_bonus,
                pontos_ganhos=pontos_ganhos,
            )
        except Exception as e:
            logger.warning(f"[achievements] falhou para user {user_id}: {e}")

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
    streak_coletivo_novo = None
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
                novo = group_data.data[0]["streak_coletivo"] + 1
                db.table("groups").update({"streak_coletivo": novo}).eq("id", group_id).execute()
                streak_coletivo_novo = novo

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
        "leveled_up": leveled_up,
        "new_nivel": new_nivel_name,
        "new_achievements": new_achievements,
        "streak_coletivo_novo": streak_coletivo_novo,
    }


# ── Market Missions ────────────────────────────────────────────────────────────


@router.get("/mercado")
async def get_market_mission(user_id: str = Depends(get_current_user_id)):
    """
    Return this week's optional market mission.
    Also returns whether the current user has already accepted/completed it.
    """
    db = get_supabase()
    semana_ref = get_current_week_ref()

    result = (
        db.table("market_missions")
        .select("*")
        .eq("semana_ref", semana_ref)
        .execute()
    )

    if not result.data:
        return {"mission": None, "aceita": False, "entregue": False}

    mission = result.data[0]

    acceptance = (
        db.table("market_mission_acceptances")
        .select("*")
        .eq("market_mission_id", mission["id"])
        .eq("user_id", user_id)
        .execute()
    )

    acc = acceptance.data[0] if acceptance.data else None

    return {
        "mission": mission,
        "aceita": acc is not None,
        "entregue": acc["entregue"] if acc else False,
        "commit_url": acc["commit_url"] if acc else None,
    }


@router.post("/mercado/aceitar")
async def accept_market_mission(user_id: str = Depends(get_current_user_id)):
    """
    Accept the current week's market mission.
    Creates an acceptance record for the user.
    """
    db = get_supabase()
    semana_ref = get_current_week_ref()

    result = (
        db.table("market_missions")
        .select("id")
        .eq("semana_ref", semana_ref)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Nenhuma missão de mercado disponível esta semana")

    mission_id = result.data[0]["id"]

    existing = (
        db.table("market_mission_acceptances")
        .select("id")
        .eq("market_mission_id", mission_id)
        .eq("user_id", user_id)
        .execute()
    )
    if existing.data:
        return {"message": "Missão já aceita", "mission_id": mission_id}

    db.table("market_mission_acceptances").insert({
        "id": str(uuid.uuid4()),
        "market_mission_id": mission_id,
        "user_id": user_id,
        "semana_ref": semana_ref,
    }).execute()

    return {"message": "Missão de mercado aceita!", "mission_id": mission_id}


class MarketDeliveryBody(BaseModel):
    commit_url: str


@router.post("/mercado/submit")
async def submit_market_mission(body: MarketDeliveryBody, user_id: str = Depends(get_current_user_id)):
    """
    Submit a commit for the current week's market mission.
    Verifies against mission criteria and awards points.
    """
    db = get_supabase()
    semana_ref = get_current_week_ref()

    mission_result = (
        db.table("market_missions")
        .select("*")
        .eq("semana_ref", semana_ref)
        .execute()
    )
    if not mission_result.data:
        raise HTTPException(status_code=404, detail="Nenhuma missão de mercado esta semana")

    mission = mission_result.data[0]

    acceptance = (
        db.table("market_mission_acceptances")
        .select("*")
        .eq("market_mission_id", mission["id"])
        .eq("user_id", user_id)
        .execute()
    )
    if not acceptance.data:
        raise HTTPException(status_code=400, detail="Você precisa aceitar a missão antes de entregar")

    acc = acceptance.data[0]
    if acc["entregue"]:
        raise HTTPException(status_code=400, detail="Você já entregou esta missão")

    # Get user info for verification
    user_result_pre = db.table("users").select("username").eq("id", user_id).execute()
    username = user_result_pre.data[0]["username"] if user_result_pre.data else ""
    profile_result = db.table("github_profiles").select("github_token").eq("user_id", user_id).execute()
    github_token = profile_result.data[0].get("github_token", "") if profile_result.data else ""

    try:
        verification = run_verification_agent(
            commit_url=body.commit_url,
            mission=mission,
            github_token=github_token,
            username=username,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro ao verificar o commit")

    if not verification["aprovado"]:
        return {
            "aprovado": False,
            "feedback": verification["feedback"],
            "pontos_ganhos": 0,
        }

    pontos_ganhos = mission["pontos"]

    db.table("market_mission_acceptances").update({
        "entregue": True,
        "entregue_em": datetime.utcnow().isoformat(),
        "pontos_ganhos": pontos_ganhos,
        "commit_url": body.commit_url,
    }).eq("id", acc["id"]).execute()

    # Add points to user
    user_points_result = db.table("users").select("pontos_total, nivel, missoes_concluidas").eq("id", user_id).execute()
    if user_points_result.data:
        u = user_points_result.data[0]
        new_pontos = (u["pontos_total"] or 0) + pontos_ganhos
        new_missoes = (u["missoes_concluidas"] or 0) + 1
        new_nivel_str = calcular_nivel(new_pontos)
        db.table("users").update({
            "pontos_total": new_pontos,
            "missoes_concluidas": new_missoes,
            "nivel": new_nivel_str,
        }).eq("id", user_id).execute()

    return {
        "aprovado": True,
        "feedback": verification["feedback"],
        "pontos_ganhos": pontos_ganhos,
    }
