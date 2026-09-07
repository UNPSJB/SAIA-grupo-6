from sqlalchemy import select
from sqlalchemy.orm import Session

from .exceptions import EquipoNoEncontrado
from .models import Equipo
from .schemas import EquipoCreate, EquipoUpdate

def crear_equipo(db: Session, datos: EquipoCreate)-> Equipo:
    nuevo_equipo = Equipo(**datos.model_dump())
    db.add(nuevo_equipo)
    db.commit()
    db.refresh(nuevo_equipo)

    return nuevo_equipo

def listar_equipos(db:Session) -> list[Equipo]:
    consulta = (
        select(Equipo)
        .where(Equipo.activo.is_(True))
        .order_by(Equipo.id)
    )

    return list(db.scalars(consulta).all)

def obtener_equipo(db: Session, equipo_id:int)-> Equipo:
    Equipo: equipo = db.get(Equipo, equipo_id)

    if equipo is None:
        raise EquipoNoEncontrado(equipo_id)

    return equipo

def actualizar_equipo(db: Session, equipo_id: int, datos: EquipoUpdate)-> Equipo:
    equipo = obtener_equipo(db, equipo_id)

    cambios = datos.model_dump(
        exclude_unset=True, exclude_none=True
    )

    for atributo, valor in cambios.items():
        setattr(equipo, atributo, valor)

    db.commit()
    db.refresh(equipo)

    return equipo

def dar_de_baja_equipo(db:Session, equipo_id: int)-> Equipo:
    equipo = obtener_equipo(db, equipo_id)

    equipo.activo = False

    db.commit()
    db.refresh(equipo)

    return equipo