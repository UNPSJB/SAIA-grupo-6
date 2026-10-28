"""Listeners del ORM que alimentan la bitácora (`audit_log`).

Los eventos `after_insert` / `after_update` / `after_delete` se registran
sobre `ModeloBase` con `propagate=True`: TODAS las entidades quedan auditadas
sin que los services lo pidan, porque la fila de auditoría se escribe con el
`Connection` del propio flush. Así comparte la transacción con el cambio: si
el commit falla, tampoco queda auditoría.

El actor sale de `session.info["usuario_id"]`, que setean las dependencias
de autenticación (`src.auth.dependencies`) y el login. NULL significa
"sistema o script".

Quedan fuera de la bitácora:

* las clases con `__audit__ = False` (la propia bitácora, los tokens
  internos de sesión);
* las sesiones con `session.info["sin_auditoria"] = True` (los seeds y los
  scripts de carga de datos).

Dos guardas protegen esta garantía de que "TODO queda registrado":

* `impedir_dml_masivo_sin_auditoria`: un `update()` / `delete()` / `insert()`
  masivo (ORM o Core) sobre una entidad auditada NO dispara los eventos de
  arriba, así que dejaría un cambio sin rastro. En vez de dejarlo pasar en
  silencio, se rechaza. Si de verdad hace falta (una purga, un script), se
  habilita a propósito con `sin_auditoria` en la sesión o con
  `.execution_options(auditoria_omitir=True)` en la sentencia.
* La bitácora es de solo agregado: modificar o borrar una fila de `audit_log`
  desde el ORM levanta `BitacoraInmutableError`.
"""

from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy import Connection, event, inspect
from sqlalchemy.orm import NO_VALUE, ORMExecuteState, Session, object_session

from src.auditoria.models import AuditLog
from src.models import ModeloBase

# Acciones que puede registrar la bitácora.
CREAR = "CREAR"
MODIFICAR = "MODIFICAR"
BAJA = "BAJA"
REACTIVAR = "REACTIVAR"
ELIMINAR = "ELIMINAR"

# Columnas de metadatos de la fila: no aportan al diff de un cambio.
COLUMNAS_IGNORADAS = {"fecha_actualizacion"}

# Columnas sensibles: se registra QUE cambiaron, nunca SU contenido.
# En `cambios` no tiene que aparecer jamás el hash de una contraseña.
#
# Se marcan en el propio modelo (`mapped_column(..., info=AUDITORIA_REDACTAR)`,
# ver `src.models`), así la decisión vive junto a la columna y no en una lista
# aparte que alguien tiene que acordarse de actualizar. Como red de seguridad,
# también se redacta toda columna cuyo nombre sugiere un secreto.
_FRAGMENTOS_SENSIBLES = ("password", "contrasena", "secret")

# Texto con el que se reemplaza una columna redactada.
MASCARA = "***"

# Opción de ejecución que habilita un DML masivo a propósito:
#   db.execute(delete(Modelo).execution_options(auditoria_omitir=True))
OPCION_OMITIR = "auditoria_omitir"


class DmlMasivoSinAuditoriaError(RuntimeError):
    """Un UPDATE/DELETE/INSERT masivo sobre una entidad auditada esquivaría la bitácora."""


class BitacoraInmutableError(RuntimeError):
    """La bitácora es de solo agregado: sus filas no se modifican ni se borran."""


def _redactada(atributo: Any) -> bool:
    """True si el valor de la columna no debe aparecer jamás en la bitácora."""
    if any(columna.info.get("auditoria_redactar") for columna in atributo.columns):
        return True
    nombre = atributo.key.lower()
    return any(fragmento in nombre for fragmento in _FRAGMENTOS_SENSIBLES)


def _auditable(target: Any) -> bool:
    """True si el objeto tiene que dejar rastro en la bitácora."""
    # La clase puede autoexcluirse (la bitácora, los tokens internos).
    if not getattr(type(target), "__audit__", True):
        return False

    sesion = object_session(target)
    if sesion is None:
        # Sin sesión no hay actor ni transacción a la cual sumarse.
        return False

    return not bool(sesion.info.get("sin_auditoria"))


def _actor(target: Any) -> Optional[int]:
    """Usuario de la sesión que hace el cambio; None = sistema o script."""
    sesion = object_session(target)
    if sesion is None:
        return None
    return sesion.info.get("usuario_id")


def _identidad(target: Any) -> str:
    """PK del objeto auditado; si es compuesta, unida con "-"."""
    estado = inspect(target)
    partes = []
    for columna in estado.mapper.primary_key:
        valor = estado.attrs[columna.key].loaded_value
        partes.append("" if valor is NO_VALUE else str(valor))
    return "-".join(partes)


def _serializable(valor: Any) -> Any:
    """Convierte un valor de columna a algo que el JSON pueda guardar."""
    if valor is NO_VALUE or valor is None:
        return None
    if isinstance(valor, (bool, int, float, str)):
        return valor
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    if isinstance(valor, Enum):
        return valor.value
    # Decimal, time, UUID y cualquier otro tipo: conservarlo como texto
    # antes que perder el dato.
    return str(valor)


def _instantanea(target: Any) -> dict[str, Any]:
    """Valores de todas las columnas del objeto, listos para JSON.

    Se lee con `loaded_value` a propósito: es el valor ya cargado en
    memoria y no dispara cargas perezosas en pleno flush.
    """
    estado = inspect(target)
    valores: dict[str, Any] = {}
    for atributo in estado.mapper.column_attrs:
        if atributo.key in COLUMNAS_IGNORADAS:
            continue
        valor = _serializable(estado.attrs[atributo.key].loaded_value)
        if _redactada(atributo):
            valor = MASCARA
        valores[atributo.key] = valor
    return valores


def _registrar(
    connection: Connection, target: Any, accion: str, cambios: dict[str, Any]
) -> None:
    """Inserta la fila de auditoría en la transacción del cambio.

    Va por `connection.execute` y NO con `session.add`: estamos dentro del
    flush, y agregar objetos a la sesión en este momento es justamente lo
    que la documentación de SQLAlchemy prohíbe. El INSERT de Core comparte
    la transacción y no dispara eventos del ORM (no hay recursión).
    """
    connection.execute(
        AuditLog.__table__.insert().values(
            usuario_id=_actor(target),
            entidad=type(target).__tablename__,
            entidad_id=_identidad(target),
            accion=accion,
            cambios=cambios,
        )
    )


@event.listens_for(ModeloBase, "after_insert", propagate=True)
def auditar_creacion(mapper, connection, target):
    """CREAR: los valores finales de la fila nueva.

    `antes` es None: en un alta no hay estado previo.
    """
    if not _auditable(target):
        return
    cambios = {campo: [None, valor] for campo, valor in _instantanea(target).items()}
    _registrar(connection, target, CREAR, cambios)


@event.listens_for(ModeloBase, "after_update", propagate=True)
def auditar_modificacion(mapper, connection, target):
    """MODIFICAR / BAJA / REACTIVAR: solo las columnas que cambiaron.

    El diff sale del historial de atributos del flush (`history`), así que
    un update que toca una sola columna registra una sola entrada. Si no
    hay columnas con cambios, no se registra nada.
    """
    if not _auditable(target):
        return

    estado = inspect(target)
    cambios: dict[str, Any] = {}
    accion = MODIFICAR

    for atributo in estado.mapper.column_attrs:
        if atributo.key in COLUMNAS_IGNORADAS:
            continue

        historial = estado.attrs[atributo.key].history
        if not historial.has_changes():
            continue

        antes = _serializable(historial.deleted[0] if historial.deleted else None)
        despues = _serializable(historial.added[0] if historial.added else None)

        # La baja lógica y su inversa clasifican el evento completo: son
        # acciones de negocio, no una edición de campo más.
        #
        # Se clasifica por el valor final: si el objeto venía expirado de
        # un commit anterior, `history` no conoce el valor previo y no hay
        # True→False que comparar. Como `activo` solo entra al diff cuando
        # cambia (un set al mismo valor sobre un objeto cargado no genera
        # historial), el valor final es la clasificación correcta.
        if atributo.key == "activo":
            if despues is False:
                accion = BAJA
            elif despues is True:
                accion = REACTIVAR

        if _redactada(atributo):
            cambios[atributo.key] = [MASCARA, MASCARA]
        else:
            cambios[atributo.key] = [antes, despues]

    if cambios:
        _registrar(connection, target, accion, cambios)


@event.listens_for(ModeloBase, "after_delete", propagate=True)
def auditar_eliminacion(mapper, connection, target):
    """ELIMINAR: una instantánea de la fila borrada.

    `despues` es None: la fila dejó de existir.
    """
    if not _auditable(target):
        return
    cambios = {campo: [valor, None] for campo, valor in _instantanea(target).items()}
    _registrar(connection, target, ELIMINAR, cambios)


# --------------------------------------------------------------------------
# Guardas
# --------------------------------------------------------------------------

def _clase_de_tabla(tabla: Any) -> Optional[type]:
    """Clase mapeada cuya tabla es `tabla` (None si no hay una).

    Se compara por nombre y esquema y no por identidad: en un `update(Modelo)`
    del ORM, `statement.table` es una copia anotada de la tabla, no el mismo
    objeto que `Modelo.__table__`.
    """
    if tabla is None:
        return None
    for mapper in ModeloBase.registry.mappers:
        propia = mapper.local_table
        if propia.name == tabla.name and propia.schema == tabla.schema:
            return mapper.class_
    return None


@event.listens_for(Session, "do_orm_execute")
def impedir_dml_masivo_sin_auditoria(estado: ORMExecuteState) -> None:
    """Rechaza un UPDATE/DELETE/INSERT masivo que esquivaría la bitácora.

    Los listeners de arriba se enganchan al flush del ORM. Un `update(Modelo)`
    o `delete(Modelo)` (ORM o sobre `Modelo.__table__`) va directo a la base y
    no pasa por ahí: el cambio quedaría sin rastro y nadie se enteraría.
    """
    if not (estado.is_update or estado.is_delete or estado.is_insert):
        return
    if estado.execution_options.get(OPCION_OMITIR):
        return

    clase = _clase_de_tabla(getattr(estado.statement, "table", None))
    if clase is None:
        return

    if clase is AuditLog:
        # La bitácora solo se toca a propósito (p. ej. una purga por retención);
        # `sin_auditoria` no alcanza, porque esa bandera es para los seeds.
        raise BitacoraInmutableError(
            "audit_log es de solo agregado. Una purga explícita requiere "
            f".execution_options({OPCION_OMITIR}=True)."
        )

    if not getattr(clase, "__audit__", True):
        return
    if estado.session.info.get("sin_auditoria"):
        return

    raise DmlMasivoSinAuditoriaError(
        f"Un DML masivo sobre '{clase.__tablename__}' no dispara los listeners "
        "de auditoría y el cambio quedaría sin registrar. Asigná los campos "
        "sobre el objeto ORM y hacé commit, o, si es intencional, usá "
        f".execution_options({OPCION_OMITIR}=True) o session.info['sin_auditoria']."
    )


@event.listens_for(AuditLog, "before_update")
@event.listens_for(AuditLog, "before_delete")
def impedir_modificar_bitacora(mapper, connection, target):
    """La bitácora es de solo agregado."""
    raise BitacoraInmutableError(
        "Las filas de audit_log no se modifican ni se borran."
    )
