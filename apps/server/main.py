import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from api.auth import router as auth_router
from api.groups import router as groups_router
from api.users import router as users_router
from api.missions import router as missions_router
from core.supabase_client import get_supabase
from core.streak import get_current_week_ref, get_week_start_iso
from agents.mission_agent import generate_individual_mission, generate_collective_mission
from agents.verification_agent import verify_commit
from agents.profile_agent import run_profile_agent

import uuid
from datetime import datetime
import httpx

app = FastAPI(title="Codemates API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(groups_router)
app.include_router(users_router)
app.include_router(missions_router)


# ── Scheduled Jobs ────────────────────────────────────────────

async def job_generate_weekly_missions():
    """
    Runs every Sunday at 08:00 UTC.
    Generates individual + collective missions for all active groups.
    """
    db = get_supabase()
    semana_ref = get_current_week_ref()

    groups = db.table("groups").select("*").execute()

    for group in groups.data:
        group_id = group["id"]

        # Check if missions already exist for this week
        existing = (
            db.table("missions")
            .select("id")
            .eq("group_id", group_id)
            .eq("semana_ref", semana_ref)
            .execute()
        )
        if existing.data:
            continue

        # Generate collective mission
        try:
            collective = generate_collective_mission(
                group_stack=group["stack_alvo"],
                group_objetivo=group.get("objetivo", ""),
                semana_ref=semana_ref,
            )
            db.table("missions").insert({
                "id": str(uuid.uuid4()),
                "group_id": group_id,
                "user_id": None,
                "tipo": "coletiva",
                "descricao": collective["descricao"],
                "criterios": collective["criterios"],
                "pontos": collective["pontos"],
                "semana_ref": semana_ref,
                "status": "ativa",
            }).execute()
        except Exception as e:
            print(f"[Mission Agent] Collective mission error for group {group_id}: {e}")

        # Generate individual missions for each member
        members = (
            db.table("group_members")
            .select("user_id")
            .eq("group_id", group_id)
            .execute()
        )

        for member in members.data:
            user_id = member["user_id"]
            profile = (
                db.table("github_profiles")
                .select("linguagens_json")
                .eq("user_id", user_id)
                .execute()
            )
            linguagens = profile.data[0]["linguagens_json"] if profile.data else {}

            try:
                individual = generate_individual_mission(
                    username="",
                    linguagens=linguagens or {},
                    group_stack=group["stack_alvo"],
                    semana_ref=semana_ref,
                )
                db.table("missions").insert({
                    "id": str(uuid.uuid4()),
                    "group_id": group_id,
                    "user_id": user_id,
                    "tipo": "individual",
                    "descricao": individual["descricao"],
                    "criterios": individual["criterios"],
                    "pontos": individual["pontos"],
                    "semana_ref": semana_ref,
                    "status": "ativa",
                }).execute()
            except Exception as e:
                print(f"[Mission Agent] Individual mission error for user {user_id}: {e}")


async def job_verify_commits():
    """
    Runs daily at 06:00 UTC.
    Checks new commits for all active missions and registers deliveries.
    """
    db = get_supabase()
    semana_ref = get_current_week_ref()
    since_iso = get_week_start_iso(semana_ref)

    active_missions = (
        db.table("missions")
        .select("*")
        .eq("semana_ref", semana_ref)
        .eq("status", "ativa")
        .execute()
    )

    for mission in active_missions.data:
        mission_id = mission["id"]
        group_id = mission["group_id"]
        criterios = mission.get("criterios", {})

        # Determine which users to check
        if mission["tipo"] == "individual" and mission.get("user_id"):
            target_users = [mission["user_id"]]
        else:
            members = (
                db.table("group_members")
                .select("user_id")
                .eq("group_id", group_id)
                .execute()
            )
            target_users = [m["user_id"] for m in members.data]

        for user_id in target_users:
            # Skip if already delivered
            existing_delivery = (
                db.table("deliveries")
                .select("id")
                .eq("mission_id", mission_id)
                .eq("user_id", user_id)
                .execute()
            )
            if existing_delivery.data:
                continue

            # Get user's GitHub token (stored in github_profiles as github_token)
            user = db.table("users").select("username").eq("id", user_id).execute()
            if not user.data:
                continue

            username = user.data[0]["username"]

            # Get user repos and check commits
            # Note: For MVP we use a stored github token or public API
            # In production, store the github_token encrypted in github_profiles
            profile = db.table("github_profiles").select("*").eq("user_id", user_id).execute()
            if not profile.data:
                continue

            github_token = profile.data[0].get("github_token", "")
            if not github_token:
                continue

            async with httpx.AsyncClient() as client:
                repos_response = await client.get(
                    f"https://api.github.com/users/{username}/repos",
                    headers={"Authorization": f"Bearer {github_token}", "Accept": "application/vnd.github+json"},
                    params={"sort": "pushed", "per_page": 10},
                )
                if repos_response.status_code != 200:
                    continue
                repos = repos_response.json()

            for repo in repos[:5]:  # Check top 5 most recently pushed repos
                repo_name = repo["name"]

                async with httpx.AsyncClient() as client:
                    commits_response = await client.get(
                        f"https://api.github.com/repos/{username}/{repo_name}/commits",
                        headers={"Authorization": f"Bearer {github_token}", "Accept": "application/vnd.github+json"},
                        params={"author": username, "since": since_iso, "per_page": 10},
                    )
                    if commits_response.status_code != 200:
                        continue
                    commits = commits_response.json()

                for commit in commits:
                    sha = commit["sha"]
                    message = commit["commit"]["message"]
                    commit_url = commit["html_url"]

                    # Get changed files
                    async with httpx.AsyncClient() as client:
                        commit_detail = await client.get(
                            f"https://api.github.com/repos/{username}/{repo_name}/commits/{sha}",
                            headers={"Authorization": f"Bearer {github_token}", "Accept": "application/vnd.github+json"},
                        )
                        if commit_detail.status_code != 200:
                            continue
                        files = [f["filename"] for f in commit_detail.json().get("files", [])]

                    # Verify with agent
                    try:
                        result = verify_commit(
                            mission_criterios=criterios,
                            commit_files=files,
                            commit_message=message,
                            commit_url=commit_url,
                        )

                        if result.get("relevante") and result.get("percentual", 0) >= 20:
                            pontos_ganhos = int(mission["pontos"] * result["percentual"] / 100)

                            # Register delivery
                            db.table("deliveries").upsert({
                                "id": str(uuid.uuid4()),
                                "mission_id": mission_id,
                                "user_id": user_id,
                                "commit_url": commit_url,
                                "commit_sha": sha,
                                "repo_name": repo_name,
                                "pontos_ganhos": pontos_ganhos,
                                "verificado_em": datetime.utcnow().isoformat(),
                            }, on_conflict="mission_id,user_id,commit_sha").execute()

                            # Update user points + missions count
                            user_data = db.table("users").select("pontos_total, missoes_concluidas").eq("id", user_id).execute()
                            if user_data.data:
                                u = user_data.data[0]
                                new_pontos = u["pontos_total"] + pontos_ganhos
                                new_missoes = u["missoes_concluidas"] + 1
                                from core.streak import calcular_nivel
                                db.table("users").update({
                                    "pontos_total": new_pontos,
                                    "missoes_concluidas": new_missoes,
                                    "nivel": calcular_nivel(new_missoes),
                                }).eq("id", user_id).execute()

                            # Update group member points
                            db.table("group_members").update({
                                "pontos_grupo": db.table("group_members")
                                    .select("pontos_grupo")
                                    .eq("user_id", user_id)
                                    .eq("group_id", group_id)
                                    .execute().data[0]["pontos_grupo"] + pontos_ganhos,
                                "missoes_concluidas": db.table("group_members")
                                    .select("missoes_concluidas")
                                    .eq("user_id", user_id)
                                    .eq("group_id", group_id)
                                    .execute().data[0]["missoes_concluidas"] + 1,
                            }).eq("user_id", user_id).eq("group_id", group_id).execute()

                            break  # One delivery per mission per user

                    except Exception as e:
                        print(f"[Verification Agent] Error: {e}")


# ── Scheduler Setup ───────────────────────────────────────────
scheduler = AsyncIOScheduler()


@app.on_event("startup")
async def startup():
    # Generate missions every Sunday at 08:00 UTC
    scheduler.add_job(
        job_generate_weekly_missions,
        CronTrigger(day_of_week="sun", hour=8, minute=0),
        id="weekly_missions",
    )
    # Verify commits daily at 06:00 UTC
    scheduler.add_job(
        job_verify_commits,
        CronTrigger(hour=6, minute=0),
        id="daily_verification",
    )
    scheduler.start()
    print("[OK] Codemates server started")
    print("[OK] Scheduler running: missions (Sun 08:00) + verification (daily 06:00)")


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "codemates-api"}
