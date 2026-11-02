from datetime import date, datetime
from sqlalchemy import DateTime, Date, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models import ModeloBase


class ConfiguracionAlerta(ModeloBase):
    """Ajustes de las alertas que el usuario puede cambiar desde la app."""

    __tablename__ = "configuracion_alertas"

    clave: Mapped[str] = mapped_column(String(60), primary_key=True)
    valor: Mapped[int] = mapped_column(Integer)


class NotificacionPersistida(ModeloBase):
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
    id_notificacion: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
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
    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )