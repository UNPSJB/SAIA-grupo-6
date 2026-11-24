from typing import Optional

from sqlalchemy import Boolean, String, text
from sqlalchemy.orm import Mapped, mapped_column

from src.establecimientos.models import DatosDeEstablecimiento, columna_sede_pk
from src.models import AUDITORIA_REDACTAR, ModeloBase


class ConfiguracionVistaPublica(DatosDeEstablecimiento, ModeloBase):
    """Estado de publicación de cada establecimiento.

    Cada sede tiene su propio enlace: el código público identifica a la sede,
    así que la vista anónima sabe de quién mostrar los indicadores.
    """

    __tablename__ = "configuracion_vista_publica"

    # Una fila por sede.
    establecimiento_id: Mapped[int] = columna_sede_pk()
    habilitada: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("0")
    )
    # Es un identificador opaco de acceso. La bitácora registra el cambio, no
    # el valor que permitiría reconstruir enlaces ya invalidados.
    codigo_publico: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        unique=True,
        info=AUDITORIA_REDACTAR,
    )


class IndicadorVistaPublica(DatosDeEstablecimiento, ModeloBase):
    """Preferencia de publicación de un indicador agregado.

    La fila ausente se interpreta con el default del catálogo
    (`constants.CATALOGO`). Así una instalación nueva no necesita seed y la
    configuración sobrevive a desactivar/reactivar la vista pública.
    """

    __tablename__ = "indicadores_vista_publica"

    establecimiento_id: Mapped[int] = columna_sede_pk()
    clave: Mapped[str] = mapped_column(String(60), primary_key=True)
    habilitado: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("0")
    )
