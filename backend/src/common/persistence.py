"""Utilidades de persistencia compartidas por los services del dominio.

Cada módulo repite el mismo esqueleto: aplicar cambios a una entidad,
commitear, refrescar, y traducir un `IntegrityError` a una excepción de
negocio. Además, el mapeo se hacía a mano con `if "nombre" in mensaje`, lo que
convertía *cualquier* `IntegrityError` (incluidos `NOT NULL` o claves
foráneas) en un "ya existe" engañoso.

Acá se concentran esos patrones:

* `es_violacion_unica` / `es_violacion_nulo` para distinguir la causa real.
* `mapa_por_campo` para construir el mapeo mensaje -> excepción de cada módulo.
* `guardar` / `aplicar_cambios` / `baja_logica` / `listar` para el CRUD básico.
* `verificar_disponibilidad` para el chequeo "duplicado activo / dado de baja".
"""

from typing import Any, Callable, Optional, Sequence, Type, TypeVar

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.exceptions import ConflictoRegistroInactivo, NotFound

M = TypeVar("M")


# --------------------------------------------------------------------------
# Clasificación del error de la base
# --------------------------------------------------------------------------

def es_violacion_unica(mensaje: str) -> bool:
    """True si el mensaje corresponde a una violación de restricción UNIQUE."""
    return "unique" in mensaje


def es_violacion_nulo(mensaje: str) -> bool:
    """True si el mensaje corresponde a un NOT NULL (no a un duplicado)."""
    return "not null" in mensaje or "none value" in mensaje


def mapa_por_campo(
    *pares: tuple[str, Callable[[], Exception]],
    por_defecto: Optional[Callable[[], Exception]] = None,
) -> Callable[[str], Exception]:
    """Construye un mapeador `mensaje_del_driver -> excepción`.

    Solo translate a "duplicado" cuando el mensaje dice `UNIQUE`: así un
    `NOT NULL` o una clave foránea rota no se le reporta al usuario como
    "ese valor ya está registrado".

    Ejemplo:
        mapa_por_campo(
            ("unique", exceptions.NombreYaExiste),
            ("personal.dni", exceptions.DniDuplicado),
            por_defecto=exceptions.DatoDuplicado,
        )
    """
    reglas: Sequence[tuple[str, Callable[[], Exception]]] = pares

    def mapear(mensaje: str) -> Exception:
        if not es_violacion_unica(mensaje):
            return _fallback(mensaje)
        for fragmento, excepcion in reglas:
            if fragmento in mensaje:
                return excepcion()
        return _fallback(mensaje)

    def _fallback(mensaje: str) -> Exception:
        if por_defecto is not None:
            return por_defecto()
        # Sin regla explícita no inventamos un mensaje de negocio: dejamos que
        # el error original llegue al manejador global (500 con detalle).
        raise IntegrityError("sin mapear", {}, Exception(mensaje))

    return mapear


# --------------------------------------------------------------------------
# Escritura
# --------------------------------------------------------------------------

def guardar(
    db: Session,
    entidad: M,
    mapear: Optional[Callable[[str], Exception]] = None,
) -> M:
    """`commit` + `refresh` sobre una entidad ya modificada en la sesión."""
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _traducir(e, mapear) from e
    db.refresh(entidad)
    return entidad


def agregar(
    db: Session,
    entidad: M,
    mapear: Optional[Callable[[str], Exception]] = None,
) -> M:
    """Agrega una entidad nueva, commitea y refresca."""
    db.add(entidad)
    return guardar(db, entidad, mapear)


def aplicar_cambios(
    db: Session,
    entidad: M,
    cambios: dict[str, Any],
    mapear: Optional[Callable[[str], Exception]] = None,
) -> M:
    """Asigna los campos indicados y persiste.

    Se atribuye en memoria y se commitea (en vez de un `update()` de Core) para
    no mezclar sentencias Core con el flush del ORM, que con `autoflush=False`
    deja el orden implícito.
    """
    for clave, valor in cambios.items():
        setattr(entidad, clave, valor)
    return guardar(db, entidad, mapear)


def baja_logica(db: Session, entidad: M, campo_activo: str = "activo") -> M:
    """Marca la entidad como dada de baja y persiste."""
    setattr(entidad, campo_activo, False)
    return guardar(db, entidad)


# --------------------------------------------------------------------------
# Lectura
# --------------------------------------------------------------------------

def listar(
    db: Session,
    modelo: Type[M],
    *,
    incluir_inactivos: bool = False,
    orden: str = "id",
) -> list[M]:
    """Lista entidades, ocultando las dadas de baja por defecto.

    Unifica el `.is_(True)` y el `== True` que se mezclaban entre módulos.
    """
    consulta = select(modelo).order_by(getattr(modelo, orden))
    if not incluir_inactivos:
        consulta = consulta.where(getattr(modelo, "activo").is_(True))
    return list(db.scalars(consulta).all())


def obtener(
    db: Session,
    modelo: Type[M],
    entidad_id: int,
    no_encontrado: Callable[[], Exception],
    *,
    solo_activos: bool = False,
) -> M:
    """Busca por id y lanza la excepción del módulo si no existe."""
    consulta = select(modelo).where(modelo.id == entidad_id)
    if solo_activos:
        consulta = consulta.where(modelo.activo.is_(True))
    entidad = db.scalar(consulta)
    if entidad is None:
        raise no_encontrado()
    return entidad


# --------------------------------------------------------------------------
# Chequeo de duplicado con opción de reactivación
# --------------------------------------------------------------------------

def verificar_disponibilidad(
    db: Session,
    modelo: Type[M],
    campo: str,
    valor: str,
    *,
    ya_existe: Callable[[], Exception],
    etiqueta: str,
    femenina: bool = False,
) -> None:
    """Verifica que `valor` esté libre en `campo`.

    Si el registro existe pero está dado de baja, lanza
    `ConflictoRegistroInactivo` (409) para que el frontend ofrezca reactivarlo
    en vez de rechazar la operación en seco. Este es el bloque que estaba
    copiado en seis módulos con variations de género.
    """
    existente = db.scalar(select(modelo).where(getattr(modelo, campo) == valor))
    if not existente:
        return

    if existente.activo:
        raise ya_existe()

    estado = "dada de baja" if femenina else "dado de baja"
    aceptacion = "Querés" if femenina else "¿Querés"
    raise ConflictoRegistroInactivo(
        mensaje=(
            f"{aceptacion} reactivar con estos nuevos datos el registro "
            f"'{valor}', que ya existe pero está {estado}."
        ),
        entidad_id=existente.id,
        campo=campo,
    )


def pedir_texto_no_duplicado(valor: str) -> str:
    """Escapa los comodines de `LIKE`/`ILIKE` para comparar por igualdad.

    Sin esto, un nombre con `%` o `_` hace que la preconsulta case con
    cualquier fila y produzca un "ya existe" falso.
    """
    return valor.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def comparar_texto(columna: Any, valor: str) -> Any:
    """Predicado de igualdad insensible a mayúsculas, sin comodines."""
    return columna.ilike(pedir_texto_no_duplicado(valor), escape="\\")


def _traducir(e: IntegrityError, mapear: Optional[Callable[[str], Exception]]) -> Exception:
    mensaje = str(getattr(e, "orig", e)).lower()
    if mapear is None:
        return e
    return mapear(mensaje)