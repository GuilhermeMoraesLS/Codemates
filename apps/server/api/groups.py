from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import uuid
import secrets
from datetime import datetime

from core.config import get_settings
from core.supabase_client import get_supabase
from models.schemas import GroupCreate, GroupPublic, InvitePublic, RankingMember

router = APIRouter(prefix="/groups", tags=["groups"])
security = HTTPBearer()


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    s = get_settings()
    try:
        payload = jwt.decode(credentials.credentials, s.server_secret_key, algorithms=["HS256"])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")


@router.post("/", response_model=GroupPublic)
async def create_group(body: GroupCreate, user_id: str = Depends(get_current_user_id)):
    db = get_supabase()

    # Check user isn't already in too many groups (max 3 for MVP)
    memberships = db.table("group_members").select("group_id").eq("user_id", user_id).execute()
    if len(memberships.data) >= 3:
        raise HTTPException(status_code=400, detail="Limite de 3 grupos por usuário")

    group = {
        "id": str(uuid.uuid4()),
        "nome": body.nome,
        "stack_alvo": body.stack_alvo,
        "objetivo": body.objetivo,
        "owner_id": user_id,
        "streak_coletivo": 0,
        "max_membros": body.max_membros,
    }
    result = db.table("groups").insert(group).execute()
    created = result.data[0]

    # Add owner as member
    db.table("group_members").insert({
        "user_id": user_id,
        "group_id": created["id"],
    }).execute()

    return GroupPublic(**created)


@router.get("/{group_id}", response_model=GroupPublic)
async def get_group(group_id: str):
    db = get_supabase()
    result = db.table("groups").select("*").eq("id", group_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")
    return GroupPublic(**result.data[0])


@router.post("/{group_id}/invite", response_model=InvitePublic)
async def create_invite(group_id: str, user_id: str = Depends(get_current_user_id)):
    db = get_supabase()

    # Only group owner can create invites
    group = db.table("groups").select("owner_id, max_membros").eq("id", group_id).execute()
    if not group.data:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")

    if group.data[0]["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Apenas o admin pode criar convites")

    # Check group isn't full
    members = db.table("group_members").select("user_id").eq("group_id", group_id).execute()
    if len(members.data) >= group.data[0]["max_membros"]:
        raise HTTPException(status_code=400, detail="Grupo já está cheio")

    token = secrets.token_urlsafe(16)
    from datetime import timedelta
    expires_at = (datetime.utcnow() + timedelta(days=7)).isoformat()

    invite = {
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "criado_por": user_id,
        "token": token,
        "expires_at": expires_at,
    }
    db.table("invites").insert(invite).execute()

    return InvitePublic(token=token, group_id=group_id, expires_at=datetime.fromisoformat(expires_at))


@router.post("/join/{token}")
async def join_group(token: str, user_id: str = Depends(get_current_user_id)):
    db = get_supabase()

    # Validate invite
    invite = db.table("invites").select("*").eq("token", token).eq("usado", False).execute()
    if not invite.data:
        raise HTTPException(status_code=404, detail="Convite inválido ou expirado")

    inv = invite.data[0]
    if datetime.fromisoformat(inv["expires_at"].replace("Z", "")) < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Convite expirado")

    group_id = inv["group_id"]

    # Check group capacity
    group = db.table("groups").select("max_membros").eq("id", group_id).execute()
    members = db.table("group_members").select("user_id").eq("group_id", group_id).execute()

    if len(members.data) >= group.data[0]["max_membros"]:
        raise HTTPException(status_code=400, detail="Grupo já está cheio")

    # Check user isn't already a member
    already = db.table("group_members").select("user_id").eq("user_id", user_id).eq("group_id", group_id).execute()
    if already.data:
        raise HTTPException(status_code=400, detail="Você já é membro deste grupo")

    # Join group
    db.table("group_members").insert({"user_id": user_id, "group_id": group_id}).execute()

    # Mark invite as used
    db.table("invites").update({"usado": True}).eq("token", token).execute()

    return {"message": "Entrou no grupo com sucesso", "group_id": group_id}


@router.get("/{group_id}/ranking")
async def get_group_ranking(group_id: str):
    """
    Return weekly and all-time rankings for the group using the
    ranking_semanal and ranking_geral views (created in migration v4).
    """
    db = get_supabase()

    semanal_result = (
        db.table("ranking_semanal")
        .select("*")
        .eq("group_id", group_id)
        .execute()
    )
    geral_result = (
        db.table("ranking_geral")
        .select("*")
        .eq("group_id", group_id)
        .execute()
    )

    semanal_map = {r["user_id"]: r for r in semanal_result.data}
    geral_map = {r["user_id"]: r for r in geral_result.data}
    all_user_ids = set(semanal_map.keys()) | set(geral_map.keys())

    merged = []
    for uid in all_user_ids:
        s = semanal_map.get(uid, {})
        g = geral_map.get(uid, {})
        merged.append({
            "user_id": uid,
            "username": s.get("username") or g.get("username", ""),
            "avatar": s.get("avatar") or g.get("avatar"),
            "nivel": s.get("nivel") or g.get("nivel", "INICIANTE"),
            "pontos_semana": int(s.get("pontos_semana") or 0),
            "pontos_total": int(g.get("pontos_total") or 0),
            "missoes_entregues": int(s.get("missoes_entregues") or 0),
            "ultima_entrega": s.get("ultima_entrega"),
        })

    # Weekly ranking — sorted by pontos_semana desc
    semanal_sorted = sorted(merged, key=lambda x: x["pontos_semana"], reverse=True)
    semanal_ranking = [
        RankingMember(posicao=i + 1, **m).model_dump()
        for i, m in enumerate(semanal_sorted)
    ]

    # All-time ranking — sorted by pontos_total desc
    geral_sorted = sorted(merged, key=lambda x: x["pontos_total"], reverse=True)
    geral_ranking = [
        RankingMember(posicao=i + 1, **m).model_dump()
        for i, m in enumerate(geral_sorted)
    ]

    return {"semanal": semanal_ranking, "geral": geral_ranking}
