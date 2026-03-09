import json
from pathlib import Path
from agno.agent import Agent
from agno.models.openai import OpenAIChat


def _load_prompt() -> str:
    path = Path(__file__).parent.parent / "prompts" / "verification_agent.md"
    return path.read_text(encoding="utf-8")


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def verify_commit(
    mission_criterios: dict,
    commit_files: list[str],
    commit_message: str,
    commit_url: str,
) -> dict:
    """
    Verify if a commit satisfies a mission's criteria.

    Args:
        mission_criterios: dict with keywords, linguagens, min_arquivos, descricao_tecnica
        commit_files: list of filenames changed in the commit
        commit_message: commit message string
        commit_url: GitHub commit URL

    Returns:
        dict with relevante (bool), percentual (int), justificativa (str)
    """
    agent = Agent(
        model=OpenAIChat(id="gpt-4o-mini", temperature=0.1),
        description="Verifica se commits atendem critérios de missões de código.",
        markdown=False,
        instructions=_load_prompt(),
    )

    files_str = ", ".join(commit_files[:30]) if commit_files else "nenhum arquivo"
    criterios_str = json.dumps(mission_criterios, ensure_ascii=False)

    prompt = (
        f"Verify this commit against the mission criteria.\n\n"
        f"Mission criteria: {criterios_str}\n\n"
        f"Commit message: {commit_message}\n"
        f"Changed files: {files_str}\n"
        f"Commit URL: {commit_url}\n\n"
        f"Return ONLY the JSON with relevante, percentual, and justificativa."
    )

    response = agent.run(prompt, stream=False)
    return _parse_json(response.content)
