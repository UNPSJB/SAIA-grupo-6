from sqlalchemy import select
from sqlalchemy.orm import Session
from datetime import date

from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    comparar_texto,
    guardar,
    listar,
    mapa_por_campo,
    obtener,
)
from src.exceptions import ConflictoRegistroInactivo
from .exceptions import ElementoLimpiezaNoEncontrado, ElementoLimpiezaYaExiste
from .models import ElementoLimpieza
from .schemas import ElementoLimpiezaCreate, ElementoLimpiezaUpdate, ElementoLimpiezaOpcion

# `elementos_limpieza.nombre` es UNIQUE: la preconsulta con ilike no alcanza
# (es insensible a mayúsculas y el índice no lo es), así que el commit
# también necesita su traducción a 400.
_MAPEA_CONFLICTO = mapa_por_campo(
    ("elementos_limpieza.nombre", ElementoLimpiezaYaExiste),
    por_defecto=ElementoLimpiezaYaExiste,
)

def crear_elemento_limpieza(db: Session, datos: ElementoLimpiezaCreate) -> ElementoLimpieza:

  # comparar_texto escapa los comodines de LIKE: sin eso, un nombre con
  # "%" o "_" matcheaba cualquier fila y rechazaba altas válidas.
  existente = db.scalar(
    select(ElementoLimpieza).where(comparar_texto(ElementoLimpieza.nombre, datos.nombre))
  )

  if existente:
    if existente.activo:
      raise ElementoLimpiezaYaExiste()

    raise ConflictoRegistroInactivo(
       mensaje=f"El elemento de limpieza '{existente.nombre}' ya existe pero está dado de baja. ¿Querés reactivarlo con estos nuevos datos?",
       entidad_id=existente.id,
       campo="nombre"
    )

  nuevo_elementoLimpieza = datos.model_dump()

  # Si no se envía fecha de último recambio, se establece la fecha actual por defecto
  if nuevo_elementoLimpieza.get("fecha_ultimo_recambio") is None:
    nuevo_elementoLimpieza["fecha_ultimo_recambio"] = date.today()

  
  instancia = ElementoLimpieza(**nuevo_elementoLimpieza)
  db.add(instancia)
  return guardar(db, instancia, _MAPEA_CONFLICTO)


def listar_elementos_limpieza( db: Session, incluir_inactivos: bool = False) -> list[ElementoLimpieza]:
  return listar(db, ElementoLimpieza, incluir_inactivos=incluir_inactivos)


def listar_opciones_elementos(db: Session) -> list[ElementoLimpiezaOpcion]:
  """Solo los datos necesarios para que el operario elija el elemento
  utilizado al marcar su tarea del checklist."""
  elementos = db.scalars(
    select(ElementoLimpieza)
    .where(ElementoLimpieza.activo.is_(True))
    .order_by(ElementoLimpieza.nombre)
  ).all()

  return [
    ElementoLimpiezaOpcion(id=elemento.id, nombre=elemento.nombre)
    for elemento in elementos
  ]


def obtener_elemento_limpieza(db: Session, elemento_id: int) -> ElementoLimpieza:
  return obtener(db, ElementoLimpieza, elemento_id, ElementoLimpiezaNoEncontrado)

def actualizar_elemento_limpieza(db: Session, elemento_id: int, datos: ElementoLimpiezaUpdate) -> ElementoLimpieza:
    elemento = obtener_elemento_limpieza(db, elemento_id)

    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)

    # Validar si el nombre está ocupado
    if "nombre" in cambios:
      existente = db.scalar(
        select(ElementoLimpieza).where(
          comparar_texto(ElementoLimpieza.nombre, cambios["nombre"]),
          ElementoLimpieza.id != elemento_id ) )
      if existente:
        raise ElementoLimpiezaYaExiste()

    return aplicar_cambios(db, elemento, cambios, _MAPEA_CONFLICTO)
  


def dar_de_baja_elemento_limpieza(db: Session, elemento_id: int) -> ElementoLimpieza:
  return baja_logica(db, obtener_elemento_limpieza(db, elemento_id))


# Función adicional específica para el reset de alerta del elemento de limpieza
def registrar_recambio_elemento( db: Session, elemento_id: int) -> ElementoLimpieza:
  elemento = obtener_elemento_limpieza(db, elemento_id)

  elemento.fecha_ultimo_recambio = date.today()

  return guardar(db, elemento)
