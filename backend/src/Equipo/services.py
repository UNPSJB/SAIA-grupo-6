from sqlalchemy.orm import Session

from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    guardar,
    listar,
    mapa_por_campo,
    obtener,
)
from . import exceptions
from .exceptions import EquipoNoEncontrado
from .models import Equipo
from .schemas import EquipoCreate, EquipoUpdate

# `equipos.nombre` es UNIQUE: antes un PUT con nombre repetido escapaba como 500.
_MAPEA_CONFLICTO = mapa_por_campo(
    ("equipos.nombre", exceptions.NombreDuplicado),
    por_defecto=exceptions.NombreDuplicado,
)

def crear_equipo(db: Session, datos: EquipoCreate)-> Equipo:
    nuevo_equipo = Equipo(**datos.model_dump())
    db.add(nuevo_equipo)
    return guardar(db, nuevo_equipo, _MAPEA_CONFLICTO)

def listar_equipos(db: Session, incluir_inactivos: bool = False) -> list[Equipo]:
    return listar(db, Equipo, incluir_inactivos=incluir_inactivos)

def obtener_equipo(db: Session, equipo_id:int)-> Equipo:
    return obtener(db, Equipo, equipo_id, lambda: EquipoNoEncontrado(equipo_id))

def actualizar_equipo(db: Session, equipo_id: int, datos: EquipoUpdate)-> Equipo:
    equipo = obtener_equipo(db, equipo_id)

    cambios = datos.model_dump(
        exclude_unset=True, exclude_none=True
    )

    return aplicar_cambios(db, equipo, cambios, _MAPEA_CONFLICTO)

def dar_de_baja_equipo(db:Session, equipo_id: int)-> Equipo:
    return baja_logica(db, obtener_equipo(db, equipo_id))