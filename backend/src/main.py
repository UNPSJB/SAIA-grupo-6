import os
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager
from fastapi import FastAPI
from src.database import engine
from src.models import ModeloBase
from src.migrations import crear_tablas_y_migrar
from fastapi.staticfiles import StaticFiles

# Importamos la configuración validada por Pydantic
from src.config import settings

# Importamos configuración de logger
from src.logger import setup_logging

# Importamos los routers desde nuestros módulos
from src.personal.router import router as personal_router
from src.auth.router import router as auth_router
from src.auth import models as auth_models  # noqa: F401 (registra la tabla de tokens revocados)

from src.Equipo import models as equipo_models
from src.Equipo.router import router as equipo_router

from src.insumos import models as insumos_models
from src.insumos.router import router as insumos_router


from src.elementoLimpieza import models as elementosLimpieza_models
from src.elementoLimpieza.router import router as elementosLimpieza_router
from src.PlanLimpieza import models as plan_limpieza_models
from src.PlanLimpieza.router import router as plan_limpieza_router

from src.tareas import models as tareas_models
from src.tareas.router import router as tareas_router

from src.checklist import models as checklist_models
from src.checklist.router import router as checklist_router

from src.insumoQuimico.router import router as insumoQuimico_router

from src.notificaciones.router import router as notificaciones_router
from src.unidadMedida.router import router as unidad_medida_router


ENV = settings.ENV.upper()
ROOT_PATH = getattr(settings, f"ROOT_PATH_{ENV}", "")

setup_logging()


@asynccontextmanager
async def db_creation_lifespan(app: FastAPI):
    # Crea las tablas faltantes y aplica las migraciones de columnas.
    crear_tablas_y_migrar()
    yield


app = FastAPI(
    root_path=ROOT_PATH,
    lifespan=db_creation_lifespan
)


# La carpeta de evidencias se sigue sirviendo como estática por ahora:
# pasar a un endpoint con sesión va en el siguiente commit.
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

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
app.include_router(personal_router)
app.include_router(insumos_router)
app.include_router(equipo_router)
app.include_router(elementosLimpieza_router)
app.include_router(plan_limpieza_router)
app.include_router(tareas_router)
app.include_router(checklist_router)
app.include_router(insumoQuimico_router)
app.include_router(notificaciones_router)
app.include_router(unidad_medida_router)