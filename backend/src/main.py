from contextlib import asynccontextmanager
from fastapi import FastAPI
#from src.database import Base, engine   si anda, esto ay que sacarlo
from src.database import engine
from src.models import ModeloBase

# Importamos la configuración validada por Pydantic
from src.config import settings

# Importamos configuracion de logger
from src.logger import setup_logging

# Importamos los routers desde nuestros modulos
from src.personal.router import router as personal_router
from fastapi.middleware.cors import CORSMiddleware

from src.Equipo import models as equipo_models
from src.Equipo.router import router as equipo_router

from src.insumos import models as insumos_models
from src.insumos.router import router as insumos_router

ENV = settings.ENV.upper()
ROOT_PATH = getattr(settings, f"ROOT_PATH_{ENV}", "")

setup_logging()

@asynccontextmanager
async def db_creation_lifespan(app: FastAPI):
    ModeloBase.metadata.create_all(bind=engine)
    yield


app = FastAPI(root_path=ROOT_PATH, lifespan=db_creation_lifespan)

origins = [
    "http://localhost:5173", # para recibir requests desde app React (puerto: 5173)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# asociamos los routers a nuestra app
app.include_router(personal_router)
app.include_router(insumos_router)
app.include_router(equipo_router)

#crear tabla registrada en SQLAlchemy
ModeloBase.metadata.create_all(bind=engine)
