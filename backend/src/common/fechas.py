from datetime import date, datetime
from zoneinfo import ZoneInfo

from src.config import settings

_ZONA = ZoneInfo(settings.ZONA_HORARIA)


def hoy() -> date:
    return datetime.now(tz=_ZONA).date()


def ahora() -> datetime:
    # Devolver naive para compatibilidad con DB
    return datetime.now(tz=_ZONA).replace(tzinfo=None)
