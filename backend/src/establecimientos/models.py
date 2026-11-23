"""Establecimientos (sedes de producción) y la marca de "dato de una sede".

SAIA es multiestablecimiento: una sola app y una sola base sirven a varias
sedes, cada una con sus propios datos. Cada tabla cuyos datos pertenecen a una
sede hereda `DatosDeEstablecimiento`, que le agrega la columna
`establecimiento_id`. El filtrado y el sellado de esa columna son automáticos
(ver `src.establecimientos.contexto`): los services no la mencionan.

Quedan globales (sin la columna) los catálogos normativos que comparten todas
las sedes: alérgenos, clases funcionales de aditivos, unidades de medida,
nutrientes y alimentos de referencia, y las reglas de rotulado frontal.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DDL, Boolean, DateTime, ForeignKey, String, event, text
from sqlalchemy.orm import Mapped, mapped_column

from src.common.fechas import ahora
from src.models import ModeloBase

# La sede que existía antes de que SAIA fuera multiestablecimiento. Se crea
# junto con la tabla y recibe todos los datos previos en la migración.
ESTABLECIMIENTO_PRINCIPAL_ID = 1
NOMBRE_ESTABLECIMIENTO_PRINCIPAL = "Establecimiento principal"


class Establecimiento(ModeloBase):
    __tablename__ = "establecimientos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    direccion: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # Nombre legal del elaborador, el que va en el rótulo ("nombre" es el
    # interno de la sede). Con `direccion`, autocompleta el borrador de rotulado.
    razon_social: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=ahora)


# La sede principal nace con la tabla: así una base nueva (o la de los tests)
# ya tiene a quién asignar los datos creados sin un establecimiento explícito.
event.listen(
    Establecimiento.__table__,
    "after_create",
    DDL(
        "INSERT INTO establecimientos (id, nombre, activo, fecha_creacion) "
        f"VALUES ({ESTABLECIMIENTO_PRINCIPAL_ID}, '{NOMBRE_ESTABLECIMIENTO_PRINCIPAL}', 1, CURRENT_TIMESTAMP)"
    ),
)


class _ConEstablecimiento:
    """Base común de los dos mixins (la columna la declara cada uno)."""

    __establecimiento_opcional__ = False


class DatosDeEstablecimiento(_ConEstablecimiento):
    """Mixin: la fila pertenece a una sede, siempre.

    Una consulta hecha en el contexto de una sede solo ve sus filas.

    El default de servidor (la sede principal) existe para el SQL crudo de
    las migraciones que copian datos previos al multiestablecimiento; el ORM
    siempre sella la sede explícitamente.
    """

    establecimiento_id: Mapped[int] = mapped_column(
        ForeignKey("establecimientos.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        server_default=text(str(ESTABLECIMIENTO_PRINCIPAL_ID)),
    )


def columna_sede_pk():
    """`establecimiento_id` como clave primaria (o parte de ella).

    Para las configuraciones: antes había una fila (o una por clave) para toda
    la instalación; ahora hay una por sede. Se asigna en la clase que hereda
    `DatosDeEstablecimiento` y reemplaza a la columna del mixin.
    """
    return mapped_column(
        ForeignKey("establecimientos.id", ondelete="RESTRICT"),
        primary_key=True,
        autoincrement=False,
        # Igual que en el mixin: para el SQL crudo de migraciones viejas.
        server_default=text(str(ESTABLECIMIENTO_PRINCIPAL_ID)),
    )


class DatosDeEstablecimientoOpcional(_ConEstablecimiento):
    """Mixin: la fila pertenece a una sede o a la empresa entera (NULL).

    Lo usan el personal (el super admin es de la empresa, no de una sede) y la
    bitácora (los cambios sobre catálogos globales no son de ninguna sede).
    Una consulta en el contexto de una sede ve sus filas y las de la empresa.
    """

    __establecimiento_opcional__ = True

    establecimiento_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("establecimientos.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
