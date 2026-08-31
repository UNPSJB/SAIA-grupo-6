import logging
from src.config import settings

def setup_logging():
    """Configura el sistema de logging de la aplicación."""
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def get_logger(name: str) -> logging.Logger:
    """Retorna una instancia de logger configurada para el módulo que lo solicite."""
    return logging.getLogger(name)
