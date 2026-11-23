"""Alta y administración de establecimientos (solo el super admin).

`establecimientos` no es una tabla de sede: no la alcanza el filtro
automático, así que estas consultas ven todas las sedes.
"""

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.exceptions import BadRequest, NotFound
from src.establecimientos import schemas
from src.establecimientos.contexto import OPCION_TODOS
from src.establecimientos.models import ESTABLECIMIENTO_PRINCIPAL_ID, Establecimiento
from src.personal.models import Personal


class NombreYaExiste(BadRequest):
    DETAIL = "Ya existe un establecimiento con ese nombre."


def _con_personal(db: Session, establecimientos: list[Establecimiento]) -> list[Establecimiento]:
    """Suma a cada sede la cantidad de personal activo (de todas las sedes)."""
    conteo = dict(
        db.execute(
            select(Personal.establecimiento_id, func.count(Personal.id))
            .where(Personal.activo.is_(True))
            .group_by(Personal.establecimiento_id)
            .execution_options(**{OPCION_TODOS: True})
        ).all()
    )
    for establecimiento in establecimientos:
        establecimiento.personal_activo = conteo.get(establecimiento.id, 0)
    return establecimientos


def listar(db: Session, incluir_inactivos: bool = False) -> list[Establecimiento]:
    consulta = select(Establecimiento).order_by(Establecimiento.nombre)
    if not incluir_inactivos:
        consulta = consulta.where(Establecimiento.activo.is_(True))
    return _con_personal(db, list(db.scalars(consulta)))


def obtener(db: Session, establecimiento_id: int) -> Establecimiento:
    establecimiento = db.get(Establecimiento, establecimiento_id)
    if establecimiento is None:
        raise NotFound("El establecimiento no existe.")
    return _con_personal(db, [establecimiento])[0]


def _nombre_libre(db: Session, nombre: str, excepto_id: Optional[int] = None) -> None:
    consulta = select(Establecimiento.id).where(
        func.lower(Establecimiento.nombre) == nombre.lower()
    )
    if excepto_id is not None:
        consulta = consulta.where(Establecimiento.id != excepto_id)
    if db.scalar(consulta) is not None:
        raise NombreYaExiste()


def _guardar(db: Session, establecimiento: Establecimiento) -> Establecimiento:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise NombreYaExiste()
    db.refresh(establecimiento)
    return _con_personal(db, [establecimiento])[0]


def crear(db: Session, datos: schemas.EstablecimientoCreate) -> Establecimiento:
    _nombre_libre(db, datos.nombre)
    establecimiento = Establecimiento(
        nombre=datos.nombre, direccion=datos.direccion, razon_social=datos.razon_social, activo=True
    )
    db.add(establecimiento)
    return _guardar(db, establecimiento)


def modificar(
    db: Session, establecimiento_id: int, datos: schemas.EstablecimientoUpdate
) -> Establecimiento:
    establecimiento = obtener(db, establecimiento_id)
    cambios = datos.model_dump(exclude_unset=True)
    if cambios.get("nombre") is None:
        cambios.pop("nombre", None)
    if cambios.get("activo") is None:
        cambios.pop("activo", None)
    if "nombre" in cambios:
        _nombre_libre(db, cambios["nombre"], excepto_id=establecimiento_id)
    if cambios.get("activo") is False and establecimiento_id == ESTABLECIMIENTO_PRINCIPAL_ID:
        # Es la sede por defecto del super admin y de lo creado sin sede.
        raise BadRequest("El establecimiento principal no se puede dar de baja.")
    for campo, valor in cambios.items():
        setattr(establecimiento, campo, valor)
    return _guardar(db, establecimiento)
