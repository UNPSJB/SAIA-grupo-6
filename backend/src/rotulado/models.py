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
    # Declaración de alérgenos ("Contiene: ... Puede contener: ...").
    alergenos: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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
