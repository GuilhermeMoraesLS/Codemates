import logging
import re
from datetime import datetime

import httpx
from agno.agent import Agent
from agno.models.openai import OpenAIChat

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_commit_url(commit_url: str) -> tuple[str, str, str]:
    """
    Parse a GitHub commit URL into (owner, repo, sha).
    Handles: https://github.com/owner/repo/commit/sha[#...]
    """
    match = re.search(r"github\.com/([^/]+)/([^/]+)/commit/([a-f0-9]+)", commit_url)
    if not match:
        raise ValueError(f"URL de commit inválida: {commit_url}")
    return match.group(1), match.group(2), match.group(3)


def _get_commit_detail(owner: str, repo: str, sha: str, token: str) -> dict:
    """
    Fetch full commit detail from GitHub API including files, patches and stats.
    Works without a token for public repos (rate-limited to 60 req/hr).
    """
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    with httpx.Client(timeout=15) as client:
        resp = client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/commits/{sha}",
            headers=headers,
        )

    if resp.status_code == 404:
        raise ValueError(f"Commit não encontrado: {owner}/{repo}@{sha[:8]}")
    if resp.status_code != 200:
        raise RuntimeError(f"GitHub API retornou {resp.status_code} para o commit {sha[:8]}")

    return resp.json()


# ── Structural verification (deterministic, no LLM) ──────────────────────────

def _check_structural(criterios: dict, commit_detail: dict) -> dict:
    files = commit_detail.get("files", [])
    stats = commit_detail.get("stats", {})
    total_additions = stats.get("additions", 0)
    parents = commit_detail.get("parents", [])

    # 1. extensoes_aceitas
    extensoes = criterios.get("extensoes_aceitas", [])
    if extensoes:
        # Extensions start with "." — exact filenames (e.g. "Dockerfile") don't
        ext_ok = any(
            any(
                f["filename"].endswith(ext) if ext.startswith(".")
                else (f["filename"] == ext or f["filename"].endswith("/" + ext))
                for ext in extensoes
            )
            for f in files
        )
    else:
        ext_ok = True

    # 2. keywords_no_diff — search in patch text (the actual diff lines added/removed)
    keywords = criterios.get("keywords_no_diff", [])
    if keywords:
        # Aggregate patches from first 10 files to avoid huge payloads
        all_patches = " ".join(f.get("patch", "") for f in files[:10])
        all_filenames = " ".join(f["filename"] for f in files)
        search_text = (all_patches + " " + all_filenames).lower()
        keyword_ok = any(kw.lower() in search_text for kw in keywords)
    else:
        keyword_ok = True

    # 3. min_linhas_adicionadas — uses stats.additions from GitHub
    min_lines = criterios.get("min_linhas_adicionadas", 0)
    lines_ok = total_additions >= min_lines if min_lines else True

    # 4. repo_pode_ser_novo — if False, repo must have prior commits (parents > 0)
    repo_pode_ser_novo = criterios.get("repo_pode_ser_novo", True)
    repo_ok = True if repo_pode_ser_novo else len(parents) > 0

    results = {
        "extensoes_aceitas": ext_ok,
        "keywords_no_diff": keyword_ok,
        "min_linhas_adicionadas": lines_ok,
        "repo_pode_ser_novo": repo_ok,
    }

    # First failing criterion (order matters for feedback clarity)
    criterio_falhou = next((k for k, v in results.items() if not v), None)

    return {
        "aprovado_estrutural": criterio_falhou is None,
        "criterios_resultado": results,
        "criterio_falhou": criterio_falhou,
        "total_additions": total_additions,
        "filenames": [f["filename"] for f in files],
    }


# ── Bonus calculation ─────────────────────────────────────────────────────────

def _calcular_bonus(pontos_base: int) -> int:
    """
    Early-delivery bonus based on ISO weekday (1=Mon … 7=Sun).
      Mon–Wed (day <= 3) → +30%
      Thu     (day == 4) → +20%
      Fri–Sun            →   0%
    """
    day = datetime.utcnow().isoweekday()
    if day <= 3:
        pct = 0.30
    elif day == 4:
        pct = 0.20
    else:
        pct = 0.0
    return int(pontos_base * pct)


# ── LLM feedback (always runs) ────────────────────────────────────────────────

_CRITERIO_MSGS = {
    "extensoes_aceitas": lambda c, n: (
        f"O commit não modificou arquivos com as extensões esperadas "
        f"({', '.join(c.get('extensoes_aceitas', []))})."
    ),
    "keywords_no_diff": lambda c, n: (
        f"O diff não contém os padrões de código esperados "
        f"({', '.join(c.get('keywords_no_diff', []))})."
    ),
    "min_linhas_adicionadas": lambda c, n: (
        f"O commit adicionou {n} linha(s), "
        f"mas o mínimo exigido é {c.get('min_linhas_adicionadas', 0)}."
    ),
    "repo_pode_ser_novo": lambda c, n: (
        "Esta missão exige um repositório com histórico de commits — "
        "o commit não pode ser o primeiro do repositório."
    ),
}


def _generate_feedback(
    aprovado: bool,
    criterio_falhou: str | None,
    criterios: dict,
    filenames: list[str],
    total_additions: int,
    trilha: str,
    nivel: int,
) -> str:
    files_str = ", ".join(filenames[:8]) if filenames else "nenhum arquivo detectado"

    if aprovado:
        prompt = (
            f"O commit foi APROVADO em uma missão da trilha '{trilha}' (nível {nivel}).\n"
            f"Arquivos modificados: {files_str}\n"
            f"Linhas adicionadas: {total_additions}\n\n"
            "Escreva 2-3 frases de feedback encorajador mas técnico. "
            "Mencione especificamente o que foi bem executado com base nos arquivos listados. "
            "Termine sugerindo o próximo passo natural nessa trilha. "
            "Tom: direto, sem exageros. Responda em português. "
            "Retorne APENAS o texto do feedback, sem aspas ou formatação extra."
        )
    else:
        motivo_fn = _CRITERIO_MSGS.get(criterio_falhou)
        motivo = (
            motivo_fn(criterios, total_additions)
            if motivo_fn
            else f"Critério '{criterio_falhou}' não foi atendido."
        )
        prompt = (
            f"O commit foi REPROVADO em uma missão da trilha '{trilha}' (nível {nivel}).\n"
            f"Motivo da reprovação: {motivo}\n"
            f"Arquivos encontrados no commit: {files_str}\n\n"
            "Escreva 2-3 frases de feedback direto e útil para o desenvolvedor. "
            "Explique o que faltou sem jargão. Oriente exatamente o que corrigir. "
            "Tom: prático, não punitivo. Responda em português. "
            "Retorne APENAS o texto do feedback, sem aspas ou formatação extra."
        )

    agent = Agent(
        model=OpenAIChat(id="gpt-4o-mini", temperature=0.3),
        markdown=False,
    )
    response = agent.run(prompt, stream=False)
    return response.content.strip().strip('"').strip("'")


# ── Public API ────────────────────────────────────────────────────────────────

def run_verification_agent(
    commit_url: str,
    mission: dict,
    github_token: str,
    username: str,
) -> dict:
    """
    Verify whether a commit fulfills a mission's criteria.

    Two-phase process:
      1. Structural check (deterministic) — extensions, keywords, line count, repo history
      2. LLM feedback (always runs) — 2-3 sentences tailored to the result

    Args:
        commit_url:   Full GitHub commit URL
        mission:      Mission dict (criterios, trilha, nivel, pontos)
        github_token: GitHub OAuth/PAT token for API calls (empty = public-repo unauthed)
        username:     GitHub username of the committer (for context)

    Returns:
        {
          "aprovado": bool,
          "criterios_resultado": { ... },
          "criterio_falhou": str | None,
          "feedback": str,
          "pontos_ganhos": int,
          "pontos_bonus": int,
          "_commit_sha": str,   # consumed by submit endpoint
          "_repo_name": str,
        }
    """
    criterios = mission.get("criterios") or {}
    pontos_base = mission.get("pontos", 80)
    trilha = mission.get("trilha", "")
    nivel = mission.get("nivel", 1)

    # 1. Parse URL and fetch commit detail from GitHub API
    owner, repo, sha = _parse_commit_url(commit_url)
    commit_detail = _get_commit_detail(owner, repo, sha, github_token)

    # 2. Structural verification
    structural = _check_structural(criterios, commit_detail)
    aprovado = structural["aprovado_estrutural"]

    # 3. LLM feedback (always)
    feedback = _generate_feedback(
        aprovado=aprovado,
        criterio_falhou=structural["criterio_falhou"],
        criterios=criterios,
        filenames=structural["filenames"],
        total_additions=structural["total_additions"],
        trilha=trilha,
        nivel=nivel,
    )

    pontos_ganhos = pontos_base if aprovado else 0
    pontos_bonus = _calcular_bonus(pontos_base) if aprovado else 0

    return {
        "aprovado": aprovado,
        "criterios_resultado": structural["criterios_resultado"],
        "criterio_falhou": structural["criterio_falhou"],
        "feedback": feedback,
        "pontos_ganhos": pontos_ganhos,
        "pontos_bonus": pontos_bonus,
        # Internal fields consumed by the submit endpoint
        "_commit_sha": sha,
        "_repo_name": repo,
    }


# ── Legacy wrapper (used by existing job in main.py) ─────────────────────────

def verify_commit(
    mission_criterios: dict,
    commit_files: list,
    commit_message: str,
    commit_url: str,
) -> dict:
    """
    Legacy interface kept for compatibility with the scheduler in main.py.
    Returns the old format: { relevante, percentual, justificativa }.
    """
    # Build a minimal structural check without GitHub API calls
    extensoes = mission_criterios.get("extensoes_aceitas", [])
    keywords = mission_criterios.get("keywords", mission_criterios.get("keywords_no_diff", []))

    ext_ok = (
        any(any(f.endswith(ext) for ext in extensoes) for f in commit_files)
        if extensoes else True
    )
    kw_ok = (
        any(kw.lower() in commit_message.lower() or any(kw.lower() in f.lower() for f in commit_files)
            for kw in keywords)
        if keywords else True
    )

    relevante = ext_ok and kw_ok
    percentual = 80 if relevante else 0

    return {
        "relevante": relevante,
        "percentual": percentual,
        "justificativa": (
            "Arquivos e keywords compatíveis com os critérios da missão."
            if relevante
            else "Commit não atende aos critérios estruturais da missão."
        ),
    }
