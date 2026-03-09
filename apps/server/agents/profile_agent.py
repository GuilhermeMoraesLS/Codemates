import json
from pathlib import Path
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from tools.github_tool import GitHubToolkit


def _load_prompt() -> str:
    path = Path(__file__).parent.parent / "prompts" / "profile_agent.md"
    return path.read_text(encoding="utf-8")


def run_profile_agent(username: str, github_token: str) -> dict:
    """
    Analyze a GitHub user's profile and return structured data.

    Args:
        username: GitHub username
        github_token: User's GitHub OAuth token

    Returns:
        dict with linguagens_json, repos_publicos, frequencia_commits
    """
    agent = Agent(
        model=OpenAIChat(id="gpt-4o-mini", temperature=0.1),
        description="Analisa perfis GitHub e retorna JSON estruturado.",
        tools=[GitHubToolkit(token=github_token)],
        markdown=False,
        instructions=_load_prompt(),
    )

    response = agent.run(
        f"Analyze the GitHub profile of user: {username}\n"
        f"Use the available tools to fetch their repositories and return the JSON profile.",
        stream=False,
    )

    raw = response.content.strip()
    # Strip markdown code block if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    return json.loads(raw.strip())
