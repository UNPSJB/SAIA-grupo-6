import sqlalchemy as sa
from datetime import datetime
from typing import Optional
from src.common.fechas import ahora
from src.models import AUDITORIA_REDACTAR, ModeloBase
from src.establecimientos.models import DatosDeEstablecimientoOpcional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, DateTime

class Personal(DatosDeEstablecimientoOpcional, ModeloBase):
    __tablename__ = "personal"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    nombre: Mapped[str] = mapped_column(String(40),index=True)
    apellido: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    dni: Mapped[str] = mapped_column(String(8), unique=True, index=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    email: Mapped[str] = mapped_column(String(60), unique=True, index=True)

    # --- CAMPO NUEVO ---
    password: Mapped[str] = mapped_column(
        String(255), nullable=False, info=AUDITORIA_REDACTAR
    )
    # -------------------

    puede_operar: Mapped[bool] = mapped_column(Boolean, default=False)
    puede_administrar: Mapped[bool] = mapped_column(Boolean, default=False)

    # Jerarquía de roles:
    #   super admin -> de la empresa (sin sede): administra todo y edita a cualquiera
    #   gerente     -> administra su sede: edita a admins y operadores de ella
    #   admin       -> administra todo, pero solo edita a operadores y a sí mismo
    #   operador    -> solo se edita a sí mismo
    es_super_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Gerente: administrador máximo de su establecimiento y único (junto al
    # super admin) que ve el tablero comparativo entre sedes. Siempre lleva
    # también `puede_administrar` y `puede_operar`.
    es_gerente: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default=sa.false()
    )

    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    debe_cambiar_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default=sa.false())

    password_changed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    planes: Mapped[list["PlanLimpieza"]] = relationship(
        back_populates="autor"
    )

    # - Opcional , esta bueno
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=ahora)
    fecha_actualizacion: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, onupdate=ahora
    )

    # - A futuro la entidad tendria una conexion con documentos, los cuales seran otra tabla aparte
    # - Y seria una relacion de uno a muchos, la cual condicionaria si el personal puede operar y si puede administrar.
    # - documentos: Mapped[Optional[List["Documento"]]] = relationship("Documento", back_populates="persona")