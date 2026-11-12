from copy import deepcopy
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from src.common.fechas import ahora
from src.models import ModeloBase
from src.rotulado_frontal import constants as c


class ReglaRotuladoFrontal(ModeloBase):
    """Versión de las reglas que deciden si corresponde el rotulado frontal.

    Las reglas son datos, no código: se crea una versión nueva y se activa.
    Las versiones anteriores no se editan, así una evaluación pasada puede
    explicarse con la regla que estaba vigente en ese momento.
    """

    __tablename__ = "reglas_rotulado_frontal"
    __table_args__ = (
        CheckConstraint("version > 0", name="ck_reglas_rotulado_version_positiva"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    version: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    vigente: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    vigencia_desde: Mapped[date] = mapped_column(Date)
    norma_origen: Mapped[str] = mapped_column(String(200))
    requiere_envasado: Mapped[bool] = mapped_column(Boolean, default=True)
    obliga_azucares: Mapped[bool] = mapped_column(Boolean, default=True)
    obliga_grasas: Mapped[bool] = mapped_column(Boolean, default=True)
    obliga_sodio: Mapped[bool] = mapped_column(Boolean, default=True)
    obliga_edulcorantes: Mapped[bool] = mapped_column(Boolean, default=True)
    obliga_cafeina: Mapped[bool] = mapped_column(Boolean, default=True)
    # Clases funcionales que marcan "contiene edulcorantes" en un aditivo.
    clases_edulcorante: Mapped[list[str]] = mapped_column(
        JSON, default=lambda: list(c.CLASES_EDULCORANTE_INICIAL)
    )
    # Si está activo, además de la clase funcional se exige que el INS del
    # aditivo esté en `ins_edulcorantes` (salvo que el aditivo no declare INS).
    validar_ins_edulcorantes: Mapped[bool] = mapped_column(Boolean, default=True)
    ins_edulcorantes: Mapped[list[str]] = mapped_column(
        JSON, default=lambda: list(c.INS_EDULCORANTES_INICIAL)
    )
    # Materias primas que aportan cafeína intrínseca al producto.
    ingredientes_cafeina: Mapped[list[str]] = mapped_column(
        JSON, default=lambda: list(c.INGREDIENTES_CON_CAFEINA_INICIAL)
    )
    # Parámetros normativos del módulo de octógonos: umbrales de sellos y
    # factores de fórmula. Son datos versionados, no constantes de código.
    umbrales_sellos: Mapped[list[dict]] = mapped_column(
        JSON,
        default=lambda: [dict(parametro) for parametro in c.UMBRALES_SELLOS_INICIALES],
    )
    formulas_nutricionales: Mapped[list[dict]] = mapped_column(
        JSON,
        default=lambda: [
            dict(parametro) for parametro in c.FORMULAS_NUTRICIONALES_INICIALES
        ],
    )
    # Motor de aplicabilidad: canales de consumo final, categorías exceptuadas
    # y condiciones ordenadas que el servicio evalúa sin conocer los casos.
    reglas_aplicabilidad: Mapped[dict] = mapped_column(
        JSON, default=lambda: deepcopy(c.REGLAS_APLICABILIDAD_INICIALES)
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora)


class ConfiguracionModuloRotulado(ModeloBase):
    """Interruptor global del módulo de octógonos.

    Es independiente de la versión de la regla para que apagar el módulo no
    obligue a crear ni activar otra versión normativa. La fila única es id=1.
    """

    __tablename__ = "configuracion_modulo_rotulado"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    modulo_activo: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="1"
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=ahora, onupdate=ahora
    )


class EvaluacionRotulado(ModeloBase):
    """Historial inmutable de evaluaciones de rotulado frontal.

    Guarda el snapshot completo para que un resultado pasado pueda
    reconstruirse aunque después se active otra regla o cambie la receta.
    No tiene claves foráneas a producto ni regla: el historial no debe
    desaparecer si se elimina alguno de esos datos.
    """

    __tablename__ = "evaluaciones_rotulado"
    __audit__ = False

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    producto_id: Mapped[int] = mapped_column(Integer, index=True)
    producto_nombre: Mapped[str] = mapped_column(String(200))
    receta_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    version_receta_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    regla_id: Mapped[int] = mapped_column(Integer, index=True)
    regla_version: Mapped[int] = mapped_column(Integer)
    norma_origen: Mapped[str] = mapped_column(String(200))
    estado: Mapped[str] = mapped_column(String(40), index=True)
    mensaje: Mapped[str] = mapped_column(String(1000))
    evaluado_en: Mapped[datetime] = mapped_column(DateTime, index=True)
    instantanea: Mapped[dict] = mapped_column(JSON)


class ConfiguracionRotuladoProducto(ModeloBase):
    """Respuesta y correcciones manuales de un producto para E12.1.

    Un `None` significa "no hay corrección": la marca se deduce de la receta.
    `True`/`False` son una decisión explícita de quien administra y prevalecen
    sobre lo detectado en ingredientes y aditivos.
    """

    __tablename__ = "configuracion_rotulado_producto"
    __table_args__ = (
        CheckConstraint(
            "canal_comercializacion IN "
            "('MINORISTA', 'MAYORISTA', 'MAYORISTA_INDUSTRIAL')",
            name="ck_configuracion_rotulado_canal_valido",
        ),
    )

    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", ondelete="CASCADE"), primary_key=True
    )
    envasado_sin_cliente: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    azucares_agregados: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    grasas_agregadas: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    sodio_agregado: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    edulcorantes: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    cafeina: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    canal_comercializacion: Mapped[str] = mapped_column(
        String(30),
        default=c.CANAL_MINORISTA,
        server_default=c.CANAL_MINORISTA,
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=ahora, onupdate=ahora
    )
