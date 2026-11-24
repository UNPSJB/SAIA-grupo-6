from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.aditivos import exceptions, schemas
from src.aditivos.models import ClaseFuncional
from src.aditivos.referencia import ADITIVOS
from src.common.texto import normalizar_texto, sin_tildes


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
    """Baja lógica: los ingredientes que la usan conservan el dato."""
    clase = obtener_clase(db, clase_id)
    clase.activo = False
    db.commit()
    db.refresh(clase)
    return clase


# --------------------------------------------------------------------------
# Sugerencias (lista de referencia) y resumen de un ingrediente aditivo
# --------------------------------------------------------------------------

def listar_sugerencias(db: Session, buscar: str | None = None) -> list[schemas.SugerenciaAditivo]:
    """Entradas de la lista de referencia para autocompletar clase e INS.

    Se filtra por nombre, INS o clase. La clase se vincula por nombre con las
    clases de la app; si no existe o está dada de baja, `clase_funcional_id`
    queda en None (el usuario elige otra).
    """
    clases = {c.nombre.lower(): c.id for c in listar_clases(db)}
    termino = normalizar_texto(buscar or "")
    resultado = []
    for clase, nombre, ins in ADITIVOS:
        texto = normalizar_texto(f"{nombre} {ins or ''} {clase}")
        if termino and termino not in texto:
            continue
        resultado.append(
            schemas.SugerenciaAditivo(
                nombre=nombre,
                numero_ins=ins,
                clase_funcional=clase,
                clase_funcional_id=clases.get(clase.lower()),
            )
        )
    return resultado


def resumen(ingrediente) -> schemas.AditivoResumen | None:
    """Clase funcional, nombre e INS de un ingrediente aditivo (None si no lo es)."""
    if ingrediente is None or not ingrediente.es_aditivo or ingrediente.clase_funcional is None:
        return None
    return schemas.AditivoResumen(
        id=ingrediente.id,
        nombre=ingrediente.nombre,
        numero_ins=ingrediente.numero_ins,
        clase_funcional=ingrediente.clase_funcional.nombre,
        ins_opcional=ingrediente.clase_funcional.ins_opcional,
    )
