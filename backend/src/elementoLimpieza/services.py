from sqlalchemy import select
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from src.common.listados import ColumnaOrden, filtro_busqueda, paginar_consulta
from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    comparar_texto,
    guardar,
    mapa_por_campo,
    obtener,
)
from src.common.texto import sin_tildes
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

# `fecha_ultimo_recambio` y `frecuencia_recambio_dias` son opcionales: sus
# NULL van al final para no encabezar una lista ascendente.
_ORDENES = {
    "nombre_asc": ColumnaOrden((sin_tildes(ElementoLimpieza.nombre),)),
    "nombre_desc": ColumnaOrden(
        (sin_tildes(ElementoLimpieza.nombre),), descendente=True
    ),
    "ultimo_recambio_asc": ColumnaOrden(
        (ElementoLimpieza.fecha_ultimo_recambio,), nulos_al_final=True
    ),
    "ultimo_recambio_desc": ColumnaOrden(
        (ElementoLimpieza.fecha_ultimo_recambio,),
        descendente=True,
        nulos_al_final=True,
    ),
    "frecuencia_asc": ColumnaOrden(
        (ElementoLimpieza.frecuencia_recambio_dias,), nulos_al_final=True
    ),
    "frecuencia_desc": ColumnaOrden(
        (ElementoLimpieza.frecuencia_recambio_dias,),
        descendente=True,
        nulos_al_final=True,
    ),
}

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


def _consulta_elementos_limpieza(
    incluir_inactivos: bool, buscar: Optional[str]
):
    """Consulta base compartida por el listado completo y el paginado."""
    consulta = select(ElementoLimpieza)

    filtro = filtro_busqueda((ElementoLimpieza.nombre,), buscar)
    if filtro is not None:
        consulta = consulta.where(filtro)

    if not incluir_inactivos:
        consulta = consulta.where(ElementoLimpieza.activo.is_(True))

    return consulta


def listar_elementos_limpieza(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
) -> list[ElementoLimpieza]:
  consulta = _consulta_elementos_limpieza(incluir_inactivos, buscar).order_by(
      ElementoLimpieza.id
  )
  return list(db.scalars(consulta).all())


def listar_elementos_limpieza_paginado(
  db: Session,
  incluir_inactivos: bool,
  page: int,
  page_size: int,
  buscar: Optional[str] = None,
  orden: str = "nombre_asc",
) -> tuple[list[ElementoLimpieza], int]:
  """Mismo filtro que `listar_elementos_limpieza`, recortado en la base."""
  return paginar_consulta(
      db,
      _consulta_elementos_limpieza(incluir_inactivos, buscar),
      modelo=ElementoLimpieza,
      orden=orden,
      ordenes=_ORDENES,
      por_defecto="nombre_asc",
      page=page,
      page_size=page_size,
  )


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
