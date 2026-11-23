from datetime import date, datetime
from sqlalchemy import Index, Boolean, Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models import ModeloBase
from src.establecimientos.models import DatosDeEstablecimiento

class Proveedor(DatosDeEstablecimiento, ModeloBase):
    __tablename__ = "proveedores"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(120), index=True)
    matricula: Mapped[str] = mapped_column(String(50), index=True)
    cuit: Mapped[str | None] = mapped_column(String(13), nullable=True, index=True)
    contacto: Mapped[str | None] = mapped_column(String(150), nullable=True)
    domicilio: Mapped[str | None] = mapped_column(String(250), nullable=True)
    rubro: Mapped[str | None] = mapped_column(String(120), nullable=True)
    es_certificado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    # Los insumos (marcas) que vende. La tabla de asociación está en `src.insumos.models`.
    insumos: Mapped[list["Insumo"]] = relationship(
        secondary="proveedores_insumos", back_populates="proveedores", order_by="Insumo.marca"
    )
    certificaciones: Mapped[list["CertificacionProveedor"]] = relationship(
        back_populates="proveedor", cascade="all, delete-orphan",
        order_by="desc(CertificacionProveedor.fecha_carga)"
    )

class CertificacionProveedor(DatosDeEstablecimiento, ModeloBase):
    __tablename__ = "certificaciones_proveedor"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    proveedor_id: Mapped[int] = mapped_column(ForeignKey("proveedores.id", ondelete="RESTRICT"), index=True)
    tipo: Mapped[str] = mapped_column(String(120), nullable=False)
    numero: Mapped[str] = mapped_column(String(100), nullable=False)
    fecha_emision: Mapped[date | None] = mapped_column(Date, nullable=True)
    fecha_vencimiento: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    archivo_url: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha_carga: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    proveedor: Mapped["Proveedor"] = relationship(back_populates="certificaciones")


# Únicos por establecimiento: cada sede tiene su propio catálogo, así que dos
# sedes pueden repetir el valor (ver src/establecimientos).
Index("uq_proveedores_establecimiento_matricula", Proveedor.establecimiento_id, Proveedor.matricula, unique=True)
