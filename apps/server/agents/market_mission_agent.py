import json
import logging
import random
from pathlib import Path
from agno.agent import Agent
from agno.models.openai import OpenAIChat

logger = logging.getLogger(__name__)

TRILHAS = ["qualidade", "testes", "devops", "arquitetura", "integracao"]


def _load_prompt() -> str:
    path = Path(__file__).parent.parent / "prompts" / "market_mission_agent.md"
    return path.read_text(encoding="utf-8")


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def run_market_mission_agent(semana_ref: str, trilha_foco: str | None = None) -> dict:
    """
    Generate a weekly optional "missão de mercado" for a given week.
    Returns a dict with the mission fields ready to be inserted into the DB.
    """
    if not trilha_foco:
        trilha_foco = random.choice(TRILHAS)

    context = {
        "semana_ref": semana_ref,
        "trilha_foco": trilha_foco,
    }

    prompt = _load_prompt()
    agent = Agent(model=OpenAIChat(id="gpt-4o-mini"))
    response = agent.run(
        f"{prompt}\n\nContext:\n{json.dumps(context, ensure_ascii=False, indent=2)}",
        stream=False,
    )
    raw = response.content

    try:
        return _parse_json(raw)
    except Exception:
        logger.exception("market_mission_agent failed to parse response: %s", raw)
        raise
