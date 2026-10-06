import logging
import os

import anyio
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager
from fastapi import FastAPI
from src.database import SessionLocal
from src.migrations import crear_tablas_y_migrar
from src.auth.services import purgar_revocados_vencidos
from src.uploads.router import router as uploads_router
from src.config import CARPETA_UPLOADS

# Importamos la configuración validada por Pydantic
from src.config import settings

# Importamos configuración de logger
from src.logger import setup_logging

# Importamos los routers desde nuestros módulos
# Un solo lugar importa todos los modelos: hay pares con relaciones
# bidireccionales que SQLAlchemy resuelve por registro de clases, y ese
# registro solo queda completo si alguien los importo a todos.
import src.all_models  # noqa: F401

from src.personal.router import router as personal_router
from src.auth.router import router as auth_router
from src.Equipo.router import router as equipo_router
from src.insumos.router import router as insumos_router
from src.elementoLimpieza.router import router as elementosLimpieza_router
from src.PlanLimpieza.router import router as plan_limpieza_router
from src.PlanCalibracionMantenimiento.router import (
    router as plan_calibracion_mantenimiento_router,
)
from src.tareas.router import router as tareas_router
from src.checklist.router import router as checklist_router
from src.insumoQuimico.router import router as insumoQuimico_router
from src.notificaciones.router import router as notificaciones_router
from src.unidadMedida.router import router as unidad_medida_router
from src.incidente.router import router as incidente_router
from src.vencimientoPersonal.router import router as vencimiento_personal_router
from src.aptitud.router import router as aptitud_router

from src.documentos import models as documentos_models
from src.documentos.router import router as documentos_router

# Mapeo explícito en vez de f"ROOT_PATH_{ENV}": antes, un ENV mal escrito
# (por ejemplo "DEV", que es lo que tiene el .env local) buscaba una clave
# inexistente y devolvía "" en silencio, sin avisar.
_RAIZ_POR_ENTORNO = {
    "DEVELOPMENT": "ROOT_PATH_DEVELOPMENT",
    "PRODUCTION": "ROOT_PATH_PRODUCTION",
}

ENV = settings.ENV.upper()
if ENV not in _RAIZ_POR_ENTORNO:
    raise RuntimeError(
        f"ENV={settings.ENV!r} no es válido. Usá 'DEVELOPMENT' o 'PRODUCTION' "
        f"(en .env.template está el ejemplo correcto)."
    )
ROOT_PATH = getattr(settings, _RAIZ_POR_ENTORNO[ENV])

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def db_creation_lifespan(app: FastAPI):
    # Crea las tablas faltantes y aplica las migraciones de columnas.
    # Es DDL síncrono: en un hilo para no bloquear el event loop.
    await anyio.to_thread.run_sync(crear_tablas_y_migrar)

    # La tabla de tokens revocados crece un registro por logout y solo se
    # purgaba al expirar el token... nunca: nadie llamaba a la función.
    def _purgar_revocados() -> None:
        with SessionLocal() as db:
            borrados = purgar_revocados_vencidos(db)
            if borrados:
                logger.info("Tokens revocados vencidos purgados: %s", borrados)

    try:
        await anyio.to_thread.run_sync(_purgar_revocados)
    except Exception:  # pragma: no cover - la purga no debe impedir arrancar
        logger.warning("No se pudieron purgar los tokens revocados vencidos", exc_info=True)

    yield


app = FastAPI(
    root_path=ROOT_PATH,
    lifespan=db_creation_lifespan
)


# La carpeta de evidencias existe, pero NO se sirve como carpeta estática:
# las fotos de las tareas requieren sesión (ver src/uploads/router.py).
# Ruta anclada al backend, no al CWD del proceso.
os.makedirs(str(CARPETA_UPLOADS / "evidencias"), exist_ok=True)

origins = settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Asociamos los routers a nuestra app
app.include_router(auth_router)
app.include_router(uploads_router)
app.include_router(personal_router)
app.include_router(insumos_router)
app.include_router(equipo_router)
app.include_router(elementosLimpieza_router)


app.include_router(plan_limpieza_router)
app.include_router(plan_calibracion_mantenimiento_router)
app.include_router(tareas_router)
app.include_router(checklist_router)
app.include_router(insumoQuimico_router)
app.include_router(notificaciones_router)
app.include_router(unidad_medida_router)
app.include_router(vencimiento_personal_router)
app.include_router(aptitud_router)
app.include_router(incidente_router)
app.include_router(documentos_router)
