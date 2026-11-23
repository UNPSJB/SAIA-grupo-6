"""Aislamiento automático de los datos de cada establecimiento.

La sede activa vive en `session.info["establecimiento_id"]`. La fijan las
dependencias de autenticación (la sede del usuario logueado) y la vista
pública (la sede dueña del enlace). A partir de ahí, tres listeners hacen el
trabajo sin que los services tengan que acordarse:

* `filtrar_por_establecimiento`: toda consulta ORM (SELECT, UPDATE, DELETE,
  `db.get`, cargas de relaciones) sobre una tabla de sede recibe
  `WHERE establecimiento_id = <sede activa>`. Una fila de otra sede
  directamente no existe: `db.get` devuelve None y el service responde 404.
* `sellar_y_validar`: las filas nuevas reciben la sede activa, y se rechaza
  guardar una fila en otra sede o apuntarla (por FK) a una fila de otra sede.

Ojo: un `exists().where(...)` de Core suelto NO recibe el filtro (no tiene
una entidad ORM en su FROM). Usar `select(...).exists()`, que sí lo recibe.
Correlacionado con una fila padre ya filtrada (`exists().where(Hija.padre_id
== Padre.id)`) es seguro: la hija siempre es de la misma sede que el padre.

Sin sede activa (scripts, migraciones, seeds, tests de services) no se
filtra nada y las filas nuevas van al establecimiento principal. Para mirar
varias sedes a propósito (el tablero del gerente) se usa
`.execution_options(todos_los_establecimientos=True)` en la consulta.
"""

from typing import Any, Optional

from sqlalchemy import event, inspect, or_, select
from sqlalchemy.orm import ORMExecuteState, Session, with_loader_criteria

from src.exceptions import NotFound
from src.establecimientos.models import (
    ESTABLECIMIENTO_PRINCIPAL_ID,
    DatosDeEstablecimiento,
    DatosDeEstablecimientoOpcional,
    _ConEstablecimiento,
)

CLAVE_SESION = "establecimiento_id"

# Opción de ejecución para consultar todas las sedes a propósito.
OPCION_TODOS = "todos_los_establecimientos"


class EstablecimientoAjenoError(NotFound):
    """Se intentó guardar o vincular un dato de otra sede.

    Responde 404 y no 403: para una sede, los datos de otra no existen, y
    distinguir "existe pero no es tuyo" filtraría información.
    """


def fijar_establecimiento(db: Session, establecimiento_id: Optional[int]) -> None:
    """Activa la sede de esta sesión: desde acá, todo se filtra por ella."""
    if establecimiento_id is None:
        db.info.pop(CLAVE_SESION, None)
    else:
        db.info[CLAVE_SESION] = establecimiento_id


def establecimiento_activo(db: Session) -> Optional[int]:
    return db.info.get(CLAVE_SESION)


def sede_efectiva(db: Session) -> int:
    """La sede activa o, sin contexto (scripts, tests), la principal.

    Es la misma sede que recibe una fila nueva creada sin contexto: sirve para
    leer la configuración "propia" también fuera de un request.
    """
    sede = db.info.get(CLAVE_SESION)
    return sede if sede is not None else ESTABLECIMIENTO_PRINCIPAL_ID


# --------------------------------------------------------------------------
# Filtro de lectura
# --------------------------------------------------------------------------

@event.listens_for(Session, "do_orm_execute")
def filtrar_por_establecimiento(estado: ORMExecuteState) -> None:
    if not (estado.is_select or estado.is_update or estado.is_delete):
        return
    if estado.execution_options.get(OPCION_TODOS):
        return
    sede = estado.session.info.get(CLAVE_SESION)
    if sede is None:
        return

    estado.statement = estado.statement.options(
        with_loader_criteria(
            DatosDeEstablecimiento,
            lambda cls: cls.establecimiento_id == sede,
            include_aliases=True,
        ),
        with_loader_criteria(
            DatosDeEstablecimientoOpcional,
            lambda cls: or_(
                cls.establecimiento_id == sede, cls.establecimiento_id.is_(None)
            ),
            include_aliases=True,
        ),
    )


# --------------------------------------------------------------------------
# Sellado y validación de escritura
# --------------------------------------------------------------------------

def _tablas_de_sede() -> dict[str, Any]:
    """Tabla -> mapper de cada entidad de sede (se arma una vez, ya mapeado todo)."""
    global _CACHE_TABLAS
    if _CACHE_TABLAS is None:
        from src.models import ModeloBase

        _CACHE_TABLAS = {
            mapper.local_table.name: mapper
            for mapper in ModeloBase.registry.mappers
            if issubclass(mapper.class_, _ConEstablecimiento)
        }
    return _CACHE_TABLAS


_CACHE_TABLAS: Optional[dict[str, Any]] = None


def _sede_por_defecto(objeto: Any, sede: Optional[int]) -> Optional[int]:
    # El super admin es de la empresa: no pertenece a ninguna sede.
    if getattr(objeto, "es_super_admin", False):
        return None
    return sede if sede is not None else ESTABLECIMIENTO_PRINCIPAL_ID


def _fks_a_validar(objeto: Any, es_nuevo: bool):
    """(tabla destino, id) de cada FK hacia una tabla de sede que hay que revisar."""
    estado = inspect(objeto)
    mapper = estado.mapper
    tablas = _tablas_de_sede()
    for columna in mapper.local_table.columns:
        if columna.key == "establecimiento_id":
            continue
        for fk in columna.foreign_keys:
            destino = fk.column.table
            if destino.name not in tablas:
                continue
            try:
                propiedad = mapper.get_property_by_column(columna)
            except Exception:
                continue
            atributo = estado.attrs[propiedad.key]
            if not es_nuevo and not atributo.history.has_changes():
                continue
            valor = atributo.value
            if valor is not None:
                yield destino, fk.column, valor


@event.listens_for(Session, "before_flush")
def sellar_y_validar(session: Session, flush_context, instances) -> None:
    sede = session.info.get(CLAVE_SESION)

    pendientes = [(o, True) for o in session.new] + [(o, False) for o in session.dirty]
    for objeto, es_nuevo in pendientes:
        if not isinstance(objeto, _ConEstablecimiento):
            continue

        if es_nuevo and objeto.establecimiento_id is None:
            objeto.establecimiento_id = _sede_por_defecto(objeto, sede)

        propia = objeto.establecimiento_id
        if sede is not None and propia is not None and propia != sede:
            if es_nuevo or inspect(objeto).attrs["establecimiento_id"].history.has_changes():
                raise EstablecimientoAjenoError(
                    f"No se puede guardar un registro de '{objeto.__tablename__}' "
                    "en otro establecimiento."
                )

        if propia is None:
            continue

        # Nadie apunta a un dato de otra sede (p. ej. un lote de la sede A con
        # el producto de la sede B). Se consulta por Core: sin filtros ni
        # eventos del ORM, y se tolera la fila de empresa (NULL).
        for destino, columna_pk, valor in _fks_a_validar(objeto, es_nuevo):
            sede_destino = session.connection().execute(
                select(destino.c.establecimiento_id).where(columna_pk == valor)
            ).scalar_one_or_none()
            if sede_destino is not None and sede_destino != propia:
                raise EstablecimientoAjenoError(
                    f"'{objeto.__tablename__}' no puede referenciar un registro "
                    f"de '{destino.name}' de otro establecimiento."
                )
