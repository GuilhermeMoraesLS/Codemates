import httpx
from typing import Any


GITHUB_API = "https://api.github.com"
GITHUB_OAUTH_URL = "https://github.com/login/oauth/access_token"


async def exchange_code_for_token(code: str, client_id: str, client_secret: str) -> str:
    """Exchange GitHub OAuth code for access token."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            GITHUB_OAUTH_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
            },
        )
        data = response.json()
        if "access_token" not in data:
            raise ValueError(f"GitHub OAuth error: {data.get('error_description', data)}")
        return data["access_token"]


async def get_github_user(token: str) -> dict[str, Any]:
    """Fetch authenticated GitHub user profile."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GITHUB_API}/user",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
        )
        response.raise_for_status()
        return response.json()


async def get_user_repos(token: str, username: str) -> list[dict[str, Any]]:
    """Fetch public repos for a GitHub user (up to 100)."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GITHUB_API}/users/{username}/repos",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
            params={"sort": "pushed", "per_page": 100, "type": "owner"},
        )
        response.raise_for_status()
        return response.json()


async def get_user_commits_since(
    token: str, username: str, repo: str, since_iso: str
) -> list[dict[str, Any]]:
    """Fetch commits in a repo since a given ISO date."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GITHUB_API}/repos/{username}/{repo}/commits",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
            params={"author": username, "since": since_iso, "per_page": 100},
        )
        if response.status_code == 409:  # empty repo
            return []
        response.raise_for_status()
        return response.json()


async def get_commit_files(token: str, owner: str, repo: str, sha: str) -> list[str]:
    """Return list of filenames changed in a commit."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/commits/{sha}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
        )
        response.raise_for_status()
        data = response.json()
        return [f["filename"] for f in data.get("files", [])]
