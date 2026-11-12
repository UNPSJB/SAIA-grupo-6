from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.common.fechas import ahora
from src.models import ModeloBase

_FUENTES_SQL = "('base_referencia', 'rotulo_proveedor', 'bibliografia', 'valor_propio')"


class ParametroNutriente(ModeloBase):
    """Cómo se expresa cada nutriente: VD, redondeo y umbral "no significativo".

    Son parámetros y no constantes porque la norma (y lo que acuerde el/la
    profesional de referencia) puede cambiar sin tocar el código.
    """

    __tablename__ = "parametros_nutrientes"

    clave: Mapped[str] = mapped_column(String(30), primary_key=True)
    nombre: Mapped[str] = mapped_column(String(60))
    unidad: Mapped[str] = mapped_column(String(10))
    orden: Mapped[int] = mapped_column(Integer)
    # Valor Diario de referencia; sin valor, la tabla muestra "VD no establecido".
    valor_diario: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    # Por porción: si el valor es menor o igual, se declara "0" (no significativo).
    umbral_no_significativo: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 3), nullable=True
    )
    decimales_menor_10: Mapped[int] = mapped_column(Integer, default=1)
    decimales_desde_10: Mapped[int] = mapped_column(Integer, default=0)


class ParametroNutricion(ModeloBase):
    """Parámetros generales (factor kcal→kJ, leyendas) como clave/valor."""

    __tablename__ = "parametros_nutricion"

    clave: Mapped[str] = mapped_column(String(40), primary_key=True)
    valor: Mapped[str] = mapped_column(String(1000))


class AlimentoReferencia(ModeloBase):
    """Alimento de una base de composición (SARA 2 u otra), por 100 g."""

    __tablename__ = "alimentos_referencia"
    __table_args__ = (
        UniqueConstraint("base", "nombre", name="uq_alimentos_referencia_base_nombre"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    base: Mapped[str] = mapped_column(String(100), index=True)
    codigo: Mapped[str | None] = mapped_column(String(40), nullable=True)
    nombre: Mapped[str] = mapped_column(String(200), index=True)
    energia: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    carbohidratos: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    azucares_totales: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    azucares_anadidos: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    proteinas: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    grasas_totales: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    grasas_saturadas: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    grasas_trans: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    fibra: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    sodio: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    importado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora)


class PerfilNutricionalInsumo(ModeloBase):
    """Datos del insumo que necesita el cálculo además de los nutrientes.

    * Equivalencias para pasar la cantidad de la receta a gramos: peso por
      unidad (insumos en "un") y densidad (insumos en litros o ml).
    * Para aditivos: si aportan energía o sodio de forma relevante. Un aditivo
      sin esa marca no exige datos nutricionales.
    """

    __tablename__ = "perfiles_nutricionales_insumo"
    __table_args__ = (
        CheckConstraint(
            "peso_unidad_g IS NULL OR peso_unidad_g > 0", name="ck_perfil_insumo_peso"
        ),
        CheckConstraint(
            "densidad_g_ml IS NULL OR densidad_g_ml > 0", name="ck_perfil_insumo_densidad"
        ),
    )

    insumo_id: Mapped[int] = mapped_column(
        ForeignKey("insumos.id", ondelete="CASCADE"), primary_key=True
    )
    peso_unidad_g: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    densidad_g_ml: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    aporta_energia_sodio: Mapped[bool] = mapped_column(Boolean, default=False)
    # Ingredientes cuyo azúcar es añadido (azúcar, miel, jarabes, dulce de leche):
    # sus azúcares añadidos son sus azúcares totales.
    azucares_son_anadidos: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0"
    )
    # E12: marcas que alimentan la aplicabilidad del rotulado frontal. Se
    # guardan para cualquier insumo; la receta decide cuáles llegan al producto.
    grasas_son_anadidas: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0"
    )
    sodio_es_anadido: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0"
    )
    contiene_edulcorantes: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0"
    )
    contiene_cafeina: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0"
    )


class ValorNutricionalInsumo(ModeloBase):
    """Un nutriente de un insumo, por 100 g, con su fuente y su historia.

    `valor_fuente` es lo que dijo la fuente al cargarlo: si después alguien
    escribe otro número, `modificado` queda en True y se registra quién y cuándo.
    """

    __tablename__ = "valores_nutricionales_insumo"
    __table_args__ = (
        UniqueConstraint("insumo_id", "nutriente", name="uq_valor_nutricional_insumo"),
        CheckConstraint("valor >= 0", name="ck_valor_nutricional_no_negativo"),
        CheckConstraint(f"fuente IN {_FUENTES_SQL}", name="ck_valor_nutricional_fuente"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    insumo_id: Mapped[int] = mapped_column(
        ForeignKey("insumos.id", ondelete="CASCADE"), index=True
    )
    nutriente: Mapped[str] = mapped_column(ForeignKey("parametros_nutrientes.clave"))
    valor: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    fuente: Mapped[str] = mapped_column(String(30))
    # Detalle de la fuente: proveedor y producto, cita bibliográfica...
    referencia: Mapped[str | None] = mapped_column(String(300), nullable=True)
    alimento_referencia_id: Mapped[int | None] = mapped_column(
        ForeignKey("alimentos_referencia.id", ondelete="SET NULL"), nullable=True
    )
    valor_fuente: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    cargado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora)
    cargado_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )
    modificado: Mapped[bool] = mapped_column(Boolean, default=False)
    modificado_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    modificado_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )

    alimento_referencia: Mapped["AlimentoReferencia | None"] = relationship()
    cargado_por: Mapped["Personal | None"] = relationship(foreign_keys=[cargado_por_id])
    modificado_por: Mapped["Personal | None"] = relationship(
        foreign_keys=[modificado_por_id]
    )


class InfoNutricionalProducto(ModeloBase):
    """Lo que el producto declara en la tabla: porción, medida casera, g o ml.

    `densidad_g_ml` y `peso_unidad_g` convierten el rendimiento de la receta
    cuando no está en la misma magnitud que la tabla (p. ej. rendimiento en
    unidades y tabla por 100 g).
    """

    __tablename__ = "info_nutricional_producto"
    __table_args__ = (
        CheckConstraint("expresar_en IN ('g', 'ml')", name="ck_info_nutricional_expresar"),
        CheckConstraint("porcion IS NULL OR porcion > 0", name="ck_info_nutricional_porcion"),
        CheckConstraint(
            "densidad_g_ml IS NULL OR densidad_g_ml > 0", name="ck_info_nutricional_densidad"
        ),
        CheckConstraint(
            "peso_unidad_g IS NULL OR peso_unidad_g > 0", name="ck_info_nutricional_peso"
        ),
    )

    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", ondelete="CASCADE"), primary_key=True
    )
    expresar_en: Mapped[str] = mapped_column(String(2), default="g")
    porcion: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    medida_casera: Mapped[str | None] = mapped_column(String(100), nullable=True)
    densidad_g_ml: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    peso_unidad_g: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora, onupdate=ahora)


class ValorLaboratorioProducto(ModeloBase):
    """Nutriente del producto determinado por análisis de laboratorio.

    Reemplaza al valor calculado desde los ingredientes (la cátedra pide poder
    combinar datos de ingredientes con análisis). Por 100 g o 100 ml.
    """

    __tablename__ = "valores_laboratorio_producto"
    __table_args__ = (
        UniqueConstraint("producto_id", "nutriente", name="uq_valor_laboratorio_producto"),
        CheckConstraint("valor_100 >= 0", name="ck_valor_laboratorio_no_negativo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", ondelete="CASCADE"), index=True
    )
    nutriente: Mapped[str] = mapped_column(ForeignKey("parametros_nutrientes.clave"))
    valor_100: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    # Laboratorio, número de informe...
    referencia: Mapped[str | None] = mapped_column(String(300), nullable=True)
    fecha_analisis: Mapped[date | None] = mapped_column(Date, nullable=True)
    cargado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora)
    cargado_por_id: Mapped[int | None] = mapped_column(ForeignKey("personal.id"), nullable=True)

    cargado_por: Mapped["Personal | None"] = relationship()
