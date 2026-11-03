"""Smoke test de arranque: importa modelos, configura mappers y crea tablas."""

from sqlalchemy import create_engine
from sqlalchemy.orm import configure_mappers

import src.all_models  # noqa: F401  (registro completo de modelos)


def test_smoke_importa_modelos_y_crea_tablas():
    """Importa src.all_models, ejecuta configure_mappers() y create_all en memoria."""
    configure_mappers()
    motor = create_engine("sqlite://")
    from src.models import ModeloBase

    ModeloBase.metadata.create_all(motor)
    motor.dispose()
