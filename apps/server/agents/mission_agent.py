import json
import logging
from pathlib import Path
from agno.agent import Agent
from agno.models.openai import OpenAIChat

logger = logging.getLogger(__name__)


def _load_prompt() -> str:
    path = Path(__file__).parent.parent / "prompts" / "mission_agent.md"
    return path.read_text(encoding="utf-8")


def _load_bank() -> list:
    path = Path(__file__).parent.parent / "data" / "missions_bank.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def run_mission_agent(
    member_profile: dict,
    group: dict,
    mission_history: list,
    user_nivel: str,
) -> dict:
    """
    Select and personalize a weekly mission for a group member.

    Args:
        member_profile: dict from github_profiles table
        group: dict with stack_alvo and objetivo
        mission_history: list of mission_bank_id strings already completed
        user_nivel: user's current level (INICIANTE, DEV, ENGENHEIRO, SÊNIOR, ARQUITETO)

    Returns:
        dict with mission_bank_id, titulo, descricao, contexto_mercado,
        exemplo_commit, criterios, pontos, trilha, nivel
    """
    bank = _load_bank()

    context = {
        "perfil_membro": {
            "linguagens_json": member_profile.get("linguagens_json", {}),
            "frameworks_json": member_profile.get("frameworks_json", []),
            "especialidade_detectada": member_profile.get("especialidade_detectada", ""),
            "areas_a_fortalecer": member_profile.get("areas_a_fortalecer", []),
            "nivel_mercado": member_profile.get("nivel_mercado", ""),
            "repos_publicos": member_profile.get("repos_publicos", 0),
        },
        "grupo": {
            "stack_alvo": group.get("stack_alvo", ""),
            "objetivo": group.get("objetivo", ""),
        },
        "historico_missoes": mission_history,
        "nivel_usuario": user_nivel,
        "banco_missoes": bank,
    }

    agent = Agent(
        model=OpenAIChat(id="gpt-4o-mini", temperature=0.1),
        description="Seleciona e personaliza missões semanais para devs do Codemates.",
        markdown=False,
        instructions=_load_prompt(),
    )

    prompt = (
        "Selecione e personalize uma missão semanal para o membro abaixo.\n\n"
        f"CONTEXTO:\n{json.dumps(context, ensure_ascii=False, indent=2)}"
    )

    response = agent.run(prompt, stream=False)
    return _parse_json(response.content)


# ── Backward-compat wrappers (used by the scheduled job in main.py) ──────────

def generate_individual_mission(
    username: str,
    linguagens: dict,
    group_stack: str,
    semana_ref: str,
) -> dict:
    """Legacy wrapper: delegates to run_mission_agent with minimal context."""
    member_profile = {
        "linguagens_json": linguagens,
        "frameworks_json": [],
        "areas_a_fortalecer": [],
        "nivel_mercado": "",
        "especialidade_detectada": "",
        "repos_publicos": 0,
    }
    group = {"stack_alvo": group_stack, "objetivo": ""}

    result = run_mission_agent(
        member_profile=member_profile,
        group=group,
        mission_history=[],
        user_nivel="INICIANTE",
    )
    return {
        "descricao": result.get("descricao", ""),
        "criterios": result.get("criterios", {}),
        "pontos": result.get("pontos", 80),
    }


def generate_collective_mission(
    group_stack: str,
    group_objetivo: str,
    semana_ref: str,
) -> dict:
    """Generate a free-form collective mission for the whole group."""
    agent = Agent(
        model=OpenAIChat(id="gpt-4o-mini", temperature=0.3),
        description="Gera missões coletivas semanais para grupos de devs.",
        markdown=False,
    )

    prompt = (
        f"Gere uma missão coletiva semanal para um grupo de devs.\n"
        f"Stack do grupo: {group_stack}\n"
        f"Objetivo: {group_objetivo or 'melhorar habilidades técnicas'}\n\n"
        "A missão deve exigir colaboração — por exemplo, todos contribuírem para um "
        "mesmo repositório, revisarem PRs uns dos outros, ou completarem partes de "
        "uma mesma feature.\n\n"
        "Retorne APENAS este JSON, sem markdown:\n"
        '{"descricao": "...", "criterios": {"keywords_no_diff": [], '
        '"extensoes_aceitas": [".py", ".ts", ".js"]}, "pontos": 150}'
    )

    response = agent.run(prompt, stream=False)
    return _parse_json(response.content)
