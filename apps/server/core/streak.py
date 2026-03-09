from datetime import datetime, timedelta


def get_current_week_ref() -> str:
    """Returns ISO week string like '2025-W12'."""
    now = datetime.utcnow()
    year, week, _ = now.isocalendar()
    return f"{year}-W{week:02d}"


def get_week_start_iso(week_ref: str) -> str:
    """Returns ISO date string for Monday of the given week ref."""
    year, week = week_ref.split("-W")
    monday = datetime.strptime(f"{year}-W{week}-1", "%Y-W%W-%w")
    return monday.isoformat() + "Z"


def calcular_nivel(missoes_concluidas: int) -> str:
    """Calculate user level based on completed missions."""
    if missoes_concluidas >= 50:
        return "ARQUITETO"
    elif missoes_concluidas >= 25:
        return "SÊNIOR"
    elif missoes_concluidas >= 10:
        return "ENGENHEIRO"
    elif missoes_concluidas >= 3:
        return "DEV"
    return "INICIANTE"


def calcular_pontos_entrega(pontos_missao: int, arquivos_relevantes: int, total_arquivos: int) -> int:
    """
    Calculate points for a delivery based on relevant files ratio.
    Minimum 20% of mission points if at least 1 relevant file found.
    """
    if total_arquivos == 0 or arquivos_relevantes == 0:
        return 0
    ratio = min(arquivos_relevantes / total_arquivos, 1.0)
    # Scale: starts at 20% floor, goes up to 100%
    pontos = int(pontos_missao * max(0.2, ratio))
    return pontos
