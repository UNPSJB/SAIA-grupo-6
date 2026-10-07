from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.documentos.constants import EstadoVersion
from src.models import ModeloBase
from src.personal.models import Personal  # noqa: F401  (para resolver la relación "Personal")


class Documento(ModeloBase):
    __tablename__ = "documentos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    tipo: Mapped[str] = mapped_column(String(30))
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    # Relación 1-N, de la más nueva a la más vieja.
    versiones: Mapped[list["VersionDocumento"]] = relationship(
        back_populates="documento",
        order_by="VersionDocumento.numero_version.desc()",
    )

    @property
    def version_vigente(self) -> Optional["VersionDocumento"]:
        """La versión vigente (historias 2 y 3)."""
        return next((v for v in self.versiones if v.vigente), None)

    @property
    def cantidad_archivadas(self) -> int:
        return sum(1 for v in self.versiones if not v.vigente)

    @property
    def proximo_numero_version(self) -> int:
        """Autoincremento: máximo actual + 1 (la primera versión es la 1)."""
        return max((v.numero_version for v in self.versiones), default=0) + 1


class VersionDocumento(ModeloBase):
    __tablename__ = "versiones_documento"
    __table_args__ = (
        # Autoincremento: no puede repetirse el número dentro de un documento.
        UniqueConstraint("documento_id", "numero_version", name="uq_documento_version"),
        # Solo UNA versión vigente por documento, garantizado por la base de datos.
        Index(
            "uq_documento_una_vigente",
            "documento_id",
            unique=True,
            sqlite_where=text("vigente = 1"),
            postgresql_where=text("vigente"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    documento_id: Mapped[int] = mapped_column(ForeignKey("documentos.id"), nullable=False)
    numero_version: Mapped[int] = mapped_column()
    nombre_archivo: Mapped[str] = mapped_column(String(255))  # nombre original, para mostrar
    archivo_url: Mapped[str] = mapped_column(String(255))     # ruta relativa servida por /uploads

    # Vigencia: True = vigente, False = archivada.
    vigente: Mapped[bool] = mapped_column(default=True)
    vigente_desde: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    vigente_hasta: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    autor_id: Mapped[int] = mapped_column(ForeignKey("personal.id"), nullable=False)
    fecha_subida: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    documento: Mapped["Documento"] = relationship(back_populates="versiones")
    autor: Mapped["Personal"] = relationship()

    @property
    def estado(self) -> EstadoVersion:
        return EstadoVersion.VIGENTE if self.vigente else EstadoVersion.ARCHIVADA