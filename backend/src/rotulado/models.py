from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
    UniqueConstraint,
    event,
    inspect,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.common.fechas import ahora
from src.models import ModeloBase


class BorradorRotulado(ModeloBase):
    """Borrador de datos de rotulado de un producto (Capítulo V del CAA).

    Un producto puede tener varios borradores a lo largo del tiempo
    (relación 1:N). Cada borrador referencia opcionalmente a una versión
    de receta y a un lote de producción usados como origen de los datos
    autocompletados.
    """

    __tablename__ = "borradores_rotulado"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    archivado: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    version_receta_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("versiones_receta.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    lote_producto_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("lotes_producto.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    denominacion_venta: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    lista_ingredientes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contenido_neto: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    rnpa_rppa: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    razon_social: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    domicilio: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    identificacion_lote: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fecha_produccion: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_cierre: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_duracion: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    instrucciones_uso: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    es_importado: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", nullable=False
    )
    importador_razon_social: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True
    )
    importador_domicilio: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    estado: Mapped[str] = mapped_column(
        String(20), default="borrador", server_default="borrador", nullable=False
    )
    datos_nutricionales_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sellos_disponibles: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", nullable=False
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, default=ahora, nullable=False
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=ahora, onupdate=ahora, nullable=False
    )
    creado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("personal.id", ondelete="SET NULL"), nullable=True
    )
    actualizado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("personal.id", ondelete="SET NULL"), nullable=True
    )

    producto: Mapped["Producto"] = relationship()
    version_receta: Mapped[Optional["VersionReceta"]] = relationship()
    lote_producto: Mapped[Optional["LoteProducto"]] = relationship()
    campos_editados: Mapped[list["CampoRotuladoEditado"]] = relationship(
        back_populates="borrador", order_by="CampoRotuladoEditado.modificado_en.desc()"
    )
    creado_por: Mapped[Optional["Personal"]] = relationship(
        foreign_keys=[creado_por_id]
    )
    actualizado_por: Mapped[Optional["Personal"]] = relationship(
        foreign_keys=[actualizado_por_id]
    )

    @property
    def producto_nombre(self) -> str:
        return self.producto.nombre

    @property
    def version_receta_numero(self) -> Optional[int]:
        return self.version_receta.numero if self.version_receta else None

    @property
    def lote_numero(self) -> Optional[str]:
        return self.lote_producto.numero_lote if self.lote_producto else None


class CampoRotuladoEditado(ModeloBase):
    """Trazabilidad de modificaciones sobre campos de un borrador de rotulado.

    Registra valor original, valor nuevo, origen del dato, tipo de operación,
    usuario responsable y fecha de modificación.
    """

    __tablename__ = "campos_rotulado_editados"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    borrador_id: Mapped[int] = mapped_column(
        ForeignKey("borradores_rotulado.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    campo: Mapped[str] = mapped_column(String(50), nullable=False)
    valor_original: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    valor_nuevo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    origen: Mapped[str] = mapped_column(String(30), nullable=False)
    tipo_operacion: Mapped[str] = mapped_column(String(20), nullable=False)
    usuario_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("personal.id", ondelete="SET NULL"), nullable=True
    )
    modificado_en: Mapped[datetime] = mapped_column(
        DateTime, default=ahora, nullable=False
    )

    borrador: Mapped["BorradorRotulado"] = relationship(back_populates="campos_editados")
    usuario: Mapped[Optional["Personal"]] = relationship()

    @property
    def usuario_nombre(self) -> Optional[str]:
        if self.usuario is None:
            return None
        return " ".join(p for p in (self.usuario.nombre, self.usuario.apellido) if p)


class RevisionDeclaracionRotulado(ModeloBase):
    """Instantánea histórica; el contenido nunca se actualiza al regenerar."""

    __tablename__ = "revisiones_declaracion_rotulado"
    __table_args__ = (UniqueConstraint("borrador_id", "numero"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    borrador_id: Mapped[int] = mapped_column(
        ForeignKey("borradores_rotulado.id", ondelete="RESTRICT"), index=True
    )
    numero: Mapped[int] = mapped_column(Integer)
    contenido: Mapped[dict] = mapped_column(JSON)
    huella_origen: Mapped[str] = mapped_column(String(64))
    creado_por_id: Mapped[int | None] = mapped_column(ForeignKey("personal.id"))
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora)
    confirmado_por_id: Mapped[int | None] = mapped_column(ForeignKey("personal.id"))
    confirmado_en: Mapped[datetime | None] = mapped_column(DateTime)

    confirmado_por: Mapped[Optional["Personal"]] = relationship(foreign_keys=[confirmado_por_id])


@event.listens_for(RevisionDeclaracionRotulado, "before_update")
def proteger_revision_declaraciones(mapper, connection, revision):
    atributos = inspect(revision).attrs
    inmutables = ("borrador_id", "numero", "contenido", "huella_origen", "creado_por_id", "creado_en")
    if any(atributos[campo].history.has_changes() for campo in inmutables):
        raise ValueError("Una revisión es histórica. Creá una revisión nueva para editar.")
    for campo in ("confirmado_por_id", "confirmado_en"):
        historia = atributos[campo].history
        if historia.has_changes() and historia.deleted and historia.deleted[0] is not None:
            raise ValueError("La confirmación histórica no puede modificarse.")


@event.listens_for(RevisionDeclaracionRotulado, "before_delete")
def impedir_borrar_revision_declaraciones(mapper, connection, revision):
    raise ValueError("Las revisiones de declaraciones son históricas y no se eliminan.")
