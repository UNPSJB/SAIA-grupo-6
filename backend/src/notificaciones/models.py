from datetime import date, datetime
from sqlalchemy import DateTime, Date, Float, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from src.models import ModeloBase
from src.establecimientos.models import DatosDeEstablecimiento, columna_sede_pk


class ConfiguracionAlerta(DatosDeEstablecimiento, ModeloBase):
    """Ajustes de las alertas que el usuario puede cambiar desde la app.

    Una fila por sede y clave: cada establecimiento ajusta los suyos.
    """

    __tablename__ = "configuracion_alertas"

    establecimiento_id: Mapped[int] = columna_sede_pk()
    clave: Mapped[str] = mapped_column(String(60), primary_key=True)
    valor: Mapped[int] = mapped_column(Integer)


class ConfiguracionImpacto(DatosDeEstablecimiento, ModeloBase):
    """Impacto base (1 bajo, 2 medio, 3 alto) que el administrador de este
    establecimiento le asigna a un tipo de situación.

    Solo se guardan los tipos que se modificaron: lo que no figura usa el
    impacto sugerido por SAIA (`riesgo.TIPOS_SITUACION`). Borrar la fila
    restaura el valor sugerido.
    """

    __tablename__ = "configuracion_impacto"

    establecimiento_id: Mapped[int] = columna_sede_pk()
    tipo: Mapped[str] = mapped_column(String(40), primary_key=True)
    impacto: Mapped[int] = mapped_column(Integer, nullable=False)


class SituacionRiesgo(DatosDeEstablecimiento, ModeloBase):
    """Historial de situaciones del motor de riesgos.

    Una situación es una instancia concreta: tipo + elemento + fecha de
    detección. Está PRESENTE mientras el motor la detecta (`resuelta_en` es
    NULL). Cuando el motor deja de detectarla se completa `resuelta_en` y queda
    en el historial: sigue contando para la recurrencia hasta salir de la
    ventana. Si el problema vuelve, se registra una situación NUEVA.

    Es información derivada de las fuentes, pero NO se puede reconstruir desde
    ellas (cuándo empezó y cuándo terminó cada cosa), por eso se conserva.
    """

    __tablename__ = "situaciones_riesgo"
    __audit__ = False  # Bitácora propia del motor: no requiere auditoría

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    #: Tipo de situación (clave de `riesgo.TIPOS_SITUACION`).
    tipo: Mapped[str] = mapped_column(String(40), nullable=False)
    #: Identifica la cosa concreta que se detecta (la `clave` de la alerta).
    clave: Mapped[str] = mapped_column(String(100), nullable=False)
    #: Elemento sobre el que se detecta (`grupo_clave`: "equipo:3", ...).
    elemento: Mapped[str] = mapped_column(String(100), nullable=False)
    detectada_en: Mapped[date] = mapped_column(Date, nullable=False)
    resuelta_en: Mapped[date | None] = mapped_column(Date, nullable=True)

    __table_args__ = (
        Index("ix_situaciones_tipo_clave", "tipo", "clave"),
        Index("ix_situaciones_tipo_elemento_detectada", "tipo", "elemento", "detectada_en"),
        Index("ix_situaciones_resuelta", "resuelta_en"),
    )


class NotificacionPersistida(DatosDeEstablecimiento, ModeloBase):
    """Notificación calculada y persistida para evitar recalcular en cada request.

    La tabla se sincroniza como diff (insert/update/delete de lo que cambió) en
    `invalidacion.asegurar_notificaciones_al_dia`, solo si está sucia o es de otro día. Las lecturas (`obtener_todas_notificaciones`)
    leen de acá en lugar de volver a consultar las 5 fuentes de origen.

    Almacena el resultado del motor de criticidad: notificaciones clásicas
    (elementos, vencimientos, stock, documentos, planes) más incidentes
    abiertos y checklists incumplidos, ya con las reglas de elevación
    aplicadas.
    """

    __tablename__ = "notificaciones_persistidas"
    __audit__ = False  # Tabla de caché derivada: no requiere bitácora de auditoría

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_notificacion: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    tipo: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    entidad_id: Mapped[int] = mapped_column(Integer, nullable=False)
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    mensaje: Mapped[str] = mapped_column(String(500), nullable=False)
    nivel: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    link_destino: Mapped[str] = mapped_column(String(200), nullable=False)
    fecha_referencia: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    grupo_clave: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    criticidad: Mapped[str] = mapped_column(String(10), nullable=False, default="baja", index=True)
    motivo: Mapped[str] = mapped_column(String(300), nullable=False)
    plazo: Mapped[str | None] = mapped_column(String(60), nullable=True)
    recambio_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Evaluación de riesgo de la situación (ver `riesgo.py`).
    impacto: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    recurrencia: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    persistencia: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    probabilidad: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    #: Riesgo individual: impacto × probabilidad, de 1 a 9.
    puntaje: Mapped[float] = mapped_column(Float, nullable=False, default=1.0, index=True)
    detectada_en: Mapped[date | None] = mapped_column(Date, nullable=True)

    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


# Únicos por establecimiento: cada sede tiene su propio catálogo, así que dos
# sedes pueden repetir el valor (ver src/establecimientos).
Index("uq_notificaciones_persistidas_establecimiento_id_notificacion", NotificacionPersistida.establecimiento_id, NotificacionPersistida.id_notificacion, unique=True)
