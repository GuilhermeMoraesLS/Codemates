import json
from pathlib import Path
from agno.agent import Agent
from agno.models.openai import OpenAIChat


def _load_prompt() -> str:
    path = Path(__file__).parent.parent / "prompts" / "mission_agent.md"
    return path.read_text(encoding="utf-8")


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def generate_individual_mission(
    username: str,
    linguagens: dict,
    group_stack: str,
    semana_ref: str,
) -> dict:
    """
    Generate a personalized weekly mission for a single developer.

    Returns:
        dict with descricao, criterios, pontos
    """
    agent = Agent(
        model=OpenAIChat(id="gpt-4o-mini", temperature=0.7),
        description="Gera missões semanais de código personalizadas.",
        markdown=False,
        instructions=_load_prompt(),
    )

    top_langs = ", ".join(list(linguagens.keys())[:3])
    prompt = (
        f"Generate an INDIVIDUAL mission for week {semana_ref}.\n"
        f"Developer top languages: {top_langs}\n"
        f"Group stack: {group_stack}\n"
        f"Type: individual — tailor it to this developer's profile.\n"
        f"Return ONLY the JSON."
    )

    response = agent.run(prompt, stream=False)
    return _parse_json(response.content)


def generate_collective_mission(
    group_stack: str,
    group_objetivo: str,
    semana_ref: str,
) -> dict:
    """
    Generate a collective mission for the entire group.

    Returns:
        dict with descricao, criterios, pontos
    """
    agent = Agent(
        model=OpenAIChat(id="gpt-4o-mini", temperature=0.7),
        description="Gera missões coletivas semanais para grupos de devs.",
        markdown=False,
        instructions=_load_prompt(),
    )

    prompt = (
        f"Generate a COLLECTIVE mission for week {semana_ref}.\n"
        f"Group stack: {group_stack}\n"
        f"Group objective: {group_objetivo or 'Evolução técnica geral'}\n"
        f"Type: collective — should require collaboration between members.\n"
        f"Return ONLY the JSON."
    )

    response = agent.run(prompt, stream=False)
    return _parse_json(response.content)
