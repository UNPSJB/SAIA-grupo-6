"""Enriquecimiento del detalle de auditoría.

La bitácora guarda en ``cambios`` un diff ``{"campo": [antes, despues]}``
con IDs crudos. Este módulo agrega dos cosas para que la UI sea legible:

1. ``cambios_detalle``: por cada campo, ``antes`` / ``despues`` y, si es una
   clave foránea, el nombre legible del objeto relacionado::

       {"campo": {"antes": ..., "despues": ..., "antes_nombre": ..., "despues_nombre": ...}}

2. ``registro``: QUÉ registro se tocó (nombre, DNI, código, y los nombres de
   sus relaciones), porque en una baja, reactivación o modificación el diff
   solo trae las columnas que cambiaron (p. ej. ``activo``) y no dice a quién
   ni a qué le pasó::

       {"etiqueta": "Tomás Luna", "datos": [{"campo": "dni", "valor": "123", "valor_nombre": None}, ...]}

De dónde sale la foto del registro:

* CREAR     -> los valores finales del propio evento.
* ELIMINAR  -> los valores borrados del propio evento.
* el resto  -> la fila actual de la base; si esa fila ya no existe, la
  instantánea del evento ELIMINAR que la borró.

Las FKs se derivan de los modelos SQLAlchemy (``ForeignKey``). Todo se
resuelve en lote: una consulta por tabla para toda la página (sin N+1). Los
mapas se arman la primera vez que se necesitan, con todos los modelos ya
cargados.
"""

from functools import lru_cache
from typing import Any, Optional

from sqlalchemy import inspect as sa_inspect
from sqlalchemy import select
from sqlalchemy.exc import NoReferencedTableError
from sqlalchemy.orm import Session

from src.auditoria.models import AuditLog
from src.models import ModeloBase

# Columnas que identifican a un registro, en orden de aparición. Se usan las
# que existan en el modelo. Para una entidad puntual se puede forzar otra
# lista en `_CAMPOS_CONTEXTO_POR_ENTIDAD`.
_CAMPOS_IDENTIFICADORES = (
    "nombre",
    "apellido",
    "dni",
    "documento",
    "cuil",
    "cuit",
    "legajo",
    "matricula",
    "codigo",
    "numero",
    "email",
    "titulo",
    "descripcion",
)

# Ejemplo: {"personal": ("nombre", "apellido", "dni", "legajo")}
_CAMPOS_CONTEXTO_POR_ENTIDAD: dict[str, tuple[str, ...]] = {}

# Mismo criterio que `listeners._redactada`: jamás se muestra un secreto.
_FRAGMENTOS_SENSIBLES = ("password", "contrasena", "secret")

# Para la etiqueta del registro, si no hay nombre.
_CAMPOS_ETIQUETA_ALTERNATIVOS = ("codigo", "descripcion", "titulo", "email", "numero")

_MAX_TEXTO = 120


# --------------------------------------------------------------------------
# Modelos y claves foráneas
# --------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _modelos_por_tabla() -> dict[str, type]:
    """{__tablename__: clase mapeada}, calculado una sola vez."""
    return {m.local_table.name: m.class_ for m in ModeloBase.registry.mappers}


def _modelo_por_tabla(tabla: str) -> Optional[type]:
    return _modelos_por_tabla().get(tabla)


@lru_cache(maxsize=1)
def _fks_por_entidad() -> dict[str, dict[str, str]]:
    """{tabla_origen: {columna_fk: tabla_destino}} derivado de los modelos.

    Solo entran las FKs que se pueden mostrar con un nombre: la tabla destino
    tiene PK ``id`` y una columna ``nombre``.
    """
    resultado: dict[str, dict[str, str]] = {}
    for mapper in ModeloBase.registry.mappers:
        fks_tabla: dict[str, str] = {}
        for fk in mapper.local_table.foreign_keys:
            try:
                columna_destino = fk.column
            except NoReferencedTableError:
                continue
            if columna_destino.name != "id":
                continue
            tabla_destino = columna_destino.table.name
            modelo_destino = _modelo_por_tabla(tabla_destino)
            if modelo_destino is None or not hasattr(modelo_destino, "nombre"):
                continue
            fks_tabla[fk.parent.name] = tabla_destino
        if fks_tabla:
            resultado[mapper.local_table.name] = fks_tabla
    return resultado


@lru_cache(maxsize=None)
def _columnas_contexto(entidad: str) -> tuple[str, ...]:
    """Columnas del modelo que identifican al registro (sin secretos)."""
    modelo = _modelo_por_tabla(entidad)
    if modelo is None:
        return ()
    columnas = sa_inspect(modelo).columns
    candidatas = _CAMPOS_CONTEXTO_POR_ENTIDAD.get(entidad, _CAMPOS_IDENTIFICADORES)
    resultado = []
    for nombre in candidatas:
        columna = columnas.get(nombre)
        if columna is None:
            continue
        if columna.info.get("auditoria_redactar") or any(
            f in nombre.lower() for f in _FRAGMENTOS_SENSIBLES
        ):
            continue
        resultado.append(nombre)
    return tuple(resultado)


def _campos_snapshot(entidad: str) -> tuple[str, ...]:
    """Columnas que hay que leer para describir un registro: identificadoras + FKs."""
    return _columnas_contexto(entidad) + tuple(_fks_por_entidad().get(entidad, {}))


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------

def _a_int(valor: Any) -> Optional[int]:
    """ID entero o None (descarta None, booleanos y valores como "***")."""
    if valor is None or isinstance(valor, bool):
        return None
    try:
        return int(valor)
    except (ValueError, TypeError):
        return None


def _recortar(valor: Any) -> Any:
    if isinstance(valor, str) and len(valor) > _MAX_TEXTO:
        return valor[: _MAX_TEXTO - 1] + "…"
    return valor


def _agregar_ids(
    entidad: str, valores: dict[str, Any], ids_por_tabla: dict[str, set[int]]
) -> None:
    """Suma a `ids_por_tabla` los IDs de FK que aparecen en `valores` ({campo: valor})."""
    for campo, tabla_destino in _fks_por_entidad().get(entidad, {}).items():
        id_valor = _a_int(valores.get(campo))
        if id_valor is not None:
            ids_por_tabla.setdefault(tabla_destino, set()).add(id_valor)


# --------------------------------------------------------------------------
# Nombres de entidades relacionadas
# --------------------------------------------------------------------------

def _resolver_nombres(
    db: Session, ids_por_tabla: dict[str, set[int]]
) -> dict[str, dict[int, str]]:
    """Una consulta ``IN (...)`` por tabla destino: {tabla: {id: etiqueta}}.

    Personal se muestra como "nombre apellido"; el resto, por su `nombre`.
    """
    nombres: dict[str, dict[int, str]] = {}
    for tabla, ids in ids_por_tabla.items():
        modelo = _modelo_por_tabla(tabla)
        if modelo is None or not ids:
            continue

        con_apellido = tabla == "personal" and hasattr(modelo, "apellido")
        columnas = [modelo.id, modelo.nombre]
        if con_apellido:
            columnas.append(modelo.apellido)

        etiquetas: dict[int, str] = {}
        for fila in db.execute(select(*columnas).where(modelo.id.in_(list(ids)))).all():
            partes = (fila.nombre, fila.apellido) if con_apellido else (fila.nombre,)
            etiqueta = " ".join(p for p in partes if p)
            if etiqueta:
                etiquetas[fila.id] = etiqueta
        nombres[tabla] = etiquetas
    return nombres


# --------------------------------------------------------------------------
# Foto del registro afectado
# --------------------------------------------------------------------------

def _snapshot_del_evento(fila: Any) -> Optional[dict[str, Any]]:
    """Valores del registro si el propio evento los trae completos (CREAR / ELIMINAR)."""
    if fila.accion not in ("CREAR", "ELIMINAR"):
        return None
    lado = 1 if fila.accion == "CREAR" else 0
    return {
        campo: (valores[lado] if len(valores) > lado else None)
        for campo, valores in (fila.cambios or {}).items()
    }


def _cargar_filas_actuales(
    db: Session, pendientes: dict[str, set[int]]
) -> dict[tuple[str, int], dict[str, Any]]:
    """Fila actual de cada registro pendiente (solo columnas de contexto y FKs)."""
    actuales: dict[tuple[str, int], dict[str, Any]] = {}
    for entidad, ids in pendientes.items():
        modelo = _modelo_por_tabla(entidad)
        campos = _campos_snapshot(entidad)
        if modelo is None or not hasattr(modelo, "id") or not campos:
            continue
        consulta = select(modelo.id, *(getattr(modelo, c) for c in campos)).where(
            modelo.id.in_(list(ids))
        )
        for fila in db.execute(consulta).all():
            actuales[(entidad, fila.id)] = {c: fila._mapping[c] for c in campos}
    return actuales


def _cargar_snapshots_eliminados(
    db: Session, faltantes: set[tuple[str, int]]
) -> dict[tuple[str, int], dict[str, Any]]:
    """Último evento ELIMINAR de cada registro que ya no existe en la base."""
    entidades = {e for e, _ in faltantes}
    ids_texto = {str(i) for _, i in faltantes}
    consulta = (
        select(AuditLog.entidad, AuditLog.entidad_id, AuditLog.cambios)
        .where(
            AuditLog.accion == "ELIMINAR",
            AuditLog.entidad.in_(entidades),
            AuditLog.entidad_id.in_(ids_texto),
        )
        .order_by(AuditLog.id)
    )
    resultado: dict[tuple[str, int], dict[str, Any]] = {}
    for entidad, entidad_id, cambios in db.execute(consulta).all():
        id_valor = _a_int(entidad_id)
        if id_valor is None or (entidad, id_valor) not in faltantes:
            continue
        resultado[(entidad, id_valor)] = {
            campo: (valores[0] if valores else None)
            for campo, valores in (cambios or {}).items()
        }
    return resultado


def _armar_registro(
    entidad: str,
    snapshot: Optional[dict[str, Any]],
    nombres: dict[str, dict[int, str]],
) -> Optional[dict[str, Any]]:
    """{"etiqueta": ..., "datos": [{campo, valor, valor_nombre}]} o None si no hay nada."""
    if not snapshot:
        return None

    # Etiqueta: "nombre apellido" -> código/descripción/... -> nombres de las relaciones.
    nombre_completo = " ".join(
        str(snapshot[c]) for c in ("nombre", "apellido") if snapshot.get(c)
    )
    etiqueta: Optional[str] = nombre_completo or None
    if etiqueta is None:
        for campo in _CAMPOS_ETIQUETA_ALTERNATIVOS:
            if snapshot.get(campo):
                etiqueta = str(_recortar(snapshot[campo]))
                break

    datos: list[dict[str, Any]] = []
    for campo in _columnas_contexto(entidad):
        valor = snapshot.get(campo)
        if valor is None or valor == "":
            continue
        # Ya van en la etiqueta.
        if nombre_completo and campo in ("nombre", "apellido"):
            continue
        datos.append({"campo": campo, "valor": _recortar(valor), "valor_nombre": None})

    nombres_relacion: list[str] = []
    for campo, tabla_destino in _fks_por_entidad().get(entidad, {}).items():
        id_valor = _a_int(snapshot.get(campo))
        if id_valor is None:
            continue
        nombre = nombres.get(tabla_destino, {}).get(id_valor)
        datos.append({"campo": campo, "valor": id_valor, "valor_nombre": nombre})
        if nombre:
            nombres_relacion.append(nombre)

    if etiqueta is None and nombres_relacion:
        etiqueta = " · ".join(nombres_relacion)

    if etiqueta is None and not datos:
        return None
    return {"etiqueta": etiqueta, "datos": datos}


# --------------------------------------------------------------------------
# Diff enriquecido
# --------------------------------------------------------------------------

def _armar_cambios(
    entidad: str,
    cambios: dict[str, list[Any]],
    nombres: dict[str, dict[int, str]],
) -> dict[str, Any]:
    """Arma ``{campo: {antes, despues, antes_nombre, despues_nombre}}``."""
    fks = _fks_por_entidad().get(entidad, {})
    resultado: dict[str, Any] = {}
    for campo, valores in cambios.items():
        antes = valores[0] if len(valores) > 0 else None
        despues = valores[1] if len(valores) > 1 else None
        entrada: dict[str, Any] = {
            "antes": antes,
            "despues": despues,
            "antes_nombre": None,
            "despues_nombre": None,
        }
        tabla_destino = fks.get(campo)
        if tabla_destino is not None:
            mapa = nombres.get(tabla_destino, {})
            id_antes = _a_int(antes)
            id_despues = _a_int(despues)
            if id_antes is not None:
                entrada["antes_nombre"] = mapa.get(id_antes)
            if id_despues is not None:
                entrada["despues_nombre"] = mapa.get(id_despues)
        resultado[campo] = entrada
    return resultado


# --------------------------------------------------------------------------
# API pública
# --------------------------------------------------------------------------

def enriquecer_lote_auditoria(db: Session, filas: list[Any]) -> dict[int, dict[str, Any]]:
    """Enriquece varios eventos de una vez, sin N+1.

    ``filas`` son objetos ``AuditLog``. Devuelve, por ``audit.id``::

        {"cambios_detalle": {...}, "registro": {...} | None}
    """
    if not filas:
        return {}

    # 1) Foto del registro afectado de cada evento.
    snapshots: dict[int, Optional[dict[str, Any]]] = {}
    pendientes: dict[str, set[int]] = {}
    for fila in filas:
        snapshot = _snapshot_del_evento(fila)
        snapshots[fila.id] = snapshot
        if snapshot is None:
            id_registro = _a_int(fila.entidad_id)  # una PK compuesta no se resuelve
            if id_registro is not None:
                pendientes.setdefault(fila.entidad, set()).add(id_registro)

    actuales = _cargar_filas_actuales(db, pendientes)
    faltantes = {
        (entidad, i)
        for entidad, ids in pendientes.items()
        for i in ids
        if (entidad, i) not in actuales
    }
    eliminados = _cargar_snapshots_eliminados(db, faltantes) if faltantes else {}

    for fila in filas:
        if snapshots[fila.id] is None:
            clave = (fila.entidad, _a_int(fila.entidad_id))
            snapshots[fila.id] = actuales.get(clave) or eliminados.get(clave)  # type: ignore[arg-type]

    # 2) Nombres de todas las FKs de la página, en una consulta por tabla.
    ids_por_tabla: dict[str, set[int]] = {}
    for fila in filas:
        # Un campo FK trae dos valores (antes y después): se resuelven ambos.
        for campo, tabla_destino in _fks_por_entidad().get(fila.entidad, {}).items():
            for valor in (fila.cambios or {}).get(campo) or ():
                id_valor = _a_int(valor)
                if id_valor is not None:
                    ids_por_tabla.setdefault(tabla_destino, set()).add(id_valor)
        _agregar_ids(fila.entidad, snapshots[fila.id] or {}, ids_por_tabla)

    nombres = _resolver_nombres(db, ids_por_tabla)

    # 3) Resultado por evento.
    return {
        fila.id: {
            "cambios_detalle": _armar_cambios(fila.entidad, fila.cambios or {}, nombres),
            "registro": _armar_registro(fila.entidad, snapshots[fila.id], nombres),
        }
        for fila in filas
    }


def enriquecer_detalle_auditoria(db: Session, fila: Any) -> dict[str, Any]:
    """Enriquece UN evento (endpoint de detalle): ``{"cambios_detalle", "registro"}``."""
    return enriquecer_lote_auditoria(db, [fila])[fila.id]
