from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from src.aditivos import exceptions, schemas
from src.aditivos.models import Aditivo, ClaseFuncional
from src.common.texto import sin_tildes


# --------------------------------------------------------------------------
# Clases funcionales
# --------------------------------------------------------------------------

def listar_clases(db: Session, incluir_inactivas: bool = False) -> list[ClaseFuncional]:
    consulta = select(ClaseFuncional)
    if not incluir_inactivas:
        consulta = consulta.where(ClaseFuncional.activo.is_(True))
    return list(db.scalars(consulta.order_by(sin_tildes(ClaseFuncional.nombre))).all())


def obtener_clase(db: Session, clase_id: int) -> ClaseFuncional:
    clase = db.get(ClaseFuncional, clase_id)
    if clase is None:
        raise exceptions.ClaseNoEncontrada()
    return clase


def _nombre_clase_libre(db: Session, nombre: str, excepto_id: int | None = None) -> None:
    consulta = select(ClaseFuncional.id).where(
        func.lower(ClaseFuncional.nombre) == nombre.lower()
    )
    if excepto_id is not None:
        consulta = consulta.where(ClaseFuncional.id != excepto_id)
    if db.scalar(consulta) is not None:
        raise exceptions.ClaseYaExiste()


def crear_clase(db: Session, datos: schemas.ClaseFuncionalCreate) -> ClaseFuncional:
    _nombre_clase_libre(db, datos.nombre)
    clase = ClaseFuncional(nombre=datos.nombre, ins_opcional=datos.ins_opcional, activo=True)
    db.add(clase)
    db.commit()
    db.refresh(clase)
    return clase


def actualizar_clase(
    db: Session, clase_id: int, datos: schemas.ClaseFuncionalUpdate
) -> ClaseFuncional:
    clase = obtener_clase(db, clase_id)
    cambios = {k: v for k, v in datos.model_dump(exclude_unset=True).items() if v is not None}
    if "nombre" in cambios:
        _nombre_clase_libre(db, cambios["nombre"], excepto_id=clase.id)
    for campo, valor in cambios.items():
        setattr(clase, campo, valor)
    db.commit()
    db.refresh(clase)
    return clase


def eliminar_clase(db: Session, clase_id: int) -> ClaseFuncional:
    """Baja lógica: los aditivos e insumos que la usan conservan el dato."""
    clase = obtener_clase(db, clase_id)
    clase.activo = False
    db.commit()
    db.refresh(clase)
    return clase


# --------------------------------------------------------------------------
# Aditivos
# --------------------------------------------------------------------------

def listar_aditivos(
    db: Session,
    incluir_inactivos: bool = False,
    clase_funcional_id: int | None = None,
    buscar: str | None = None,
) -> list[Aditivo]:
    consulta = (
        select(Aditivo)
        .join(Aditivo.clase_funcional)
        .options(selectinload(Aditivo.clase_funcional))
    )
    if not incluir_inactivos:
        consulta = consulta.where(Aditivo.activo.is_(True), ClaseFuncional.activo.is_(True))
    if clase_funcional_id:
        consulta = consulta.where(Aditivo.clase_funcional_id == clase_funcional_id)
    if buscar and buscar.strip():
        patron = f"%{buscar.strip().lower()}%"
        consulta = consulta.where(
            func.lower(Aditivo.nombre).like(patron)
            | func.lower(func.coalesce(Aditivo.numero_ins, "")).like(patron)
        )
    return list(
        db.scalars(
            consulta.order_by(sin_tildes(ClaseFuncional.nombre), sin_tildes(Aditivo.nombre))
        ).all()
    )


def obtener_aditivo(db: Session, aditivo_id: int) -> Aditivo:
    aditivo = db.get(Aditivo, aditivo_id)
    if aditivo is None:
        raise exceptions.AditivoNoEncontrado()
    return aditivo


def _validar_aditivo(
    db: Session, clase_id: int, nombre: str, numero_ins: str | None, excepto_id: int | None
) -> ClaseFuncional:
    clase = obtener_clase(db, clase_id)
    if not clase.activo:
        raise exceptions.ClaseInactiva()
    if numero_ins is None and not clase.ins_opcional:
        raise exceptions.InsObligatorio()
    consulta = select(Aditivo.id).where(
        Aditivo.clase_funcional_id == clase.id,
        func.lower(Aditivo.nombre) == nombre.lower(),
    )
    if excepto_id is not None:
        consulta = consulta.where(Aditivo.id != excepto_id)
    if db.scalar(consulta) is not None:
        raise exceptions.AditivoYaExiste()
    return clase


def crear_aditivo(db: Session, datos: schemas.AditivoCreate) -> Aditivo:
    _validar_aditivo(db, datos.clase_funcional_id, datos.nombre, datos.numero_ins, None)
    aditivo = Aditivo(
        clase_funcional_id=datos.clase_funcional_id,
        nombre=datos.nombre,
        numero_ins=datos.numero_ins,
        activo=True,
    )
    db.add(aditivo)
    db.commit()
    db.refresh(aditivo)
    return aditivo


def actualizar_aditivo(db: Session, aditivo_id: int, datos: schemas.AditivoUpdate) -> Aditivo:
    aditivo = obtener_aditivo(db, aditivo_id)
    cambios = datos.model_dump(exclude_unset=True)
    # `numero_ins` puede venir en null a propósito (para borrarlo); el resto no.
    cambios = {k: v for k, v in cambios.items() if v is not None or k == "numero_ins"}
    final_clase = cambios.get("clase_funcional_id", aditivo.clase_funcional_id)
    final_nombre = cambios.get("nombre", aditivo.nombre)
    final_ins = cambios["numero_ins"] if "numero_ins" in cambios else aditivo.numero_ins
    _validar_aditivo(db, final_clase, final_nombre, final_ins, aditivo.id)
    for campo, valor in cambios.items():
        setattr(aditivo, campo, valor)
    db.commit()
    db.refresh(aditivo)
    return aditivo


def eliminar_aditivo(db: Session, aditivo_id: int) -> Aditivo:
    """Baja lógica: los insumos que lo usan conservan la referencia."""
    aditivo = obtener_aditivo(db, aditivo_id)
    aditivo.activo = False
    db.commit()
    db.refresh(aditivo)
    return aditivo


def resumen(aditivo: Aditivo | None) -> schemas.AditivoResumen | None:
    if aditivo is None:
        return None
    return schemas.AditivoResumen(
        id=aditivo.id,
        nombre=aditivo.nombre,
        numero_ins=aditivo.numero_ins,
        clase_funcional=aditivo.clase_funcional.nombre,
    )
