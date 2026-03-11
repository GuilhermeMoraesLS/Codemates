from agno.tools import Toolkit
import httpx
from typing import Any


GITHUB_API = "https://api.github.com"


class GitHubToolkit(Toolkit):
    """Agno toolkit for GitHub REST API — used by Profile and Verification agents."""

    def __init__(self, token: str):
        super().__init__(name="github_toolkit")
        self.token = token
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
        }
        self.register(self.get_user_repos)
        self.register(self.get_repo_languages)
        self.register(self.get_repo_topics)
        self.register(self.get_repo_file)
        self.register(self.get_commit_files)
        self.register(self.get_recent_commits)

    def get_user_repos(self, username: str) -> str:
        """
        Fetch public repositories for a GitHub user.
        Returns JSON string with repo name, language, pushed_at, and description.
        """
        import json
        with httpx.Client() as client:
            response = client.get(
                f"{GITHUB_API}/users/{username}/repos",
                headers=self.headers,
                params={"sort": "pushed", "per_page": 30, "type": "owner"},
            )
            if response.status_code != 200:
                return f"Error fetching repos: {response.status_code}"
            repos = response.json()
            simplified = [
                {
                    "name": r["name"],
                    "language": r.get("language"),
                    "pushed_at": r.get("pushed_at"),
                    "description": r.get("description"),
                    "fork": r.get("fork", False),
                }
                for r in repos
                if not r.get("fork")  # ignore forks
            ]
            return json.dumps(simplified)

    def get_repo_languages(self, owner: str, repo: str) -> str:
        """
        Fetch language breakdown for a repository.
        Returns JSON like {"TypeScript": 12400, "Python": 3200}.
        """
        import json
        with httpx.Client() as client:
            response = client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/languages",
                headers=self.headers,
            )
            if response.status_code != 200:
                return f"Error: {response.status_code}"
            return json.dumps(response.json())

    def get_repo_topics(self, owner: str, repo: str) -> str:
        """
        Fetch topics/tags for a repository.
        Returns JSON array like ["react", "nextjs", "typescript"].
        Topics are user-defined tags that often indicate frameworks and domains.
        """
        import json
        with httpx.Client() as client:
            response = client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/topics",
                headers={**self.headers, "Accept": "application/vnd.github.mercy-preview+json"},
            )
            if response.status_code != 200:
                return "[]"
            return json.dumps(response.json().get("names", []))

    def get_repo_file(self, owner: str, repo: str, path: str) -> str:
        """
        Fetch the decoded content of a file in a repository.
        Use this to read dependency files like package.json, requirements.txt,
        pyproject.toml, Cargo.toml, build.gradle, pom.xml, go.mod, composer.json.
        Returns the raw text content (max 8KB) or an error string.
        """
        import base64
        with httpx.Client() as client:
            response = client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
                headers=self.headers,
            )
            if response.status_code == 404:
                return f"file not found: {path}"
            if response.status_code != 200:
                return f"error: {response.status_code}"
            data = response.json()
            if data.get("encoding") == "base64":
                content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
                return content[:8000]  # cap at 8KB
            return data.get("content", "")[:8000]

    def get_commit_files(self, owner: str, repo: str, sha: str) -> str:
        """
        Get list of files changed in a specific commit.
        Returns comma-separated filenames.
        """
        with httpx.Client() as client:
            response = client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/commits/{sha}",
                headers=self.headers,
            )
            if response.status_code != 200:
                return f"Error: {response.status_code}"
            data = response.json()
            files = [f["filename"] for f in data.get("files", [])]
            return ", ".join(files) if files else "no files"

    def get_recent_commits(self, owner: str, repo: str, since_iso: str) -> str:
        """
        Fetch commits in a repo since a given ISO date.
        Returns JSON with sha, message, and date.
        """
        import json
        with httpx.Client() as client:
            response = client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/commits",
                headers=self.headers,
                params={"author": owner, "since": since_iso, "per_page": 20},
            )
            if response.status_code == 409:
                return "[]"
            if response.status_code != 200:
                return f"Error: {response.status_code}"
            commits = response.json()
            simplified = [
                {
                    "sha": c["sha"][:8],
                    "full_sha": c["sha"],
                    "message": c["commit"]["message"][:120],
                    "date": c["commit"]["author"]["date"],
                    "url": c["html_url"],
                }
                for c in commits
            ]
            return json.dumps(simplified)
