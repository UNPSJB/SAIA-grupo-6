from typing import List
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.exceptions import ConflictoRegistroInactivo
from src.unidadMedida.models import UnidadMedida
from src.unidadMedida import schemas, exceptions


def crear_unidad_medida(db: Session, datos: schemas.UnidadMedidaCreate) -> UnidadMedida:
    existente_nombre = db.scalar(
        select(UnidadMedida).where(UnidadMedida.nombre == datos.nombre)
    )
    if existente_nombre:
        if existente_nombre.activo:
            raise exceptions.UnidadMedidaYaExiste()
        else:
            raise ConflictoRegistroInactivo(
                mensaje=f"La unidad de medida '{existente_nombre.nombre}' ya existe pero está dada de baja. ¿Querés reactivarla con estos nuevos datos?",
                entidad_id=existente_nombre.id,
                campo="nombre"
            )

    existente_simbolo = db.scalar(
        select(UnidadMedida).where(UnidadMedida.simbolo == datos.simbolo)
    )
    if existente_simbolo:
        if existente_simbolo.activo:
            raise exceptions.SimboloYaExiste()
        else:
            raise ConflictoRegistroInactivo(
                mensaje=f"El símbolo '{existente_simbolo.simbolo}' ya existe pero está dado de baja. ¿Querés reactivarlo con estos nuevos datos?",
                entidad_id=existente_simbolo.id,
                campo="simbolo"
            )

    nueva_unidad = UnidadMedida(**datos.model_dump())
    db.add(nueva_unidad)
    db.commit()
    db.refresh(nueva_unidad)
    return nueva_unidad


def listar_unidades_medida(db: Session, incluir_inactivos: bool = False) -> List[UnidadMedida]:
    consulta = select(UnidadMedida).order_by(UnidadMedida.id)
    if not incluir_inactivos:
        consulta = consulta.where(UnidadMedida.activo == True)
    return list(db.scalars(consulta).all())


def obtener_unidad_medida(db: Session, unidad_id: int) -> UnidadMedida:
    unidad = db.scalar(select(UnidadMedida).where(UnidadMedida.id == unidad_id))
    if not unidad:
        raise exceptions.UnidadMedidaNoEncontrada()
    return unidad


def actualizar_unidad_medida(db: Session, unidad_id: int, datos: schemas.UnidadMedidaUpdate) -> UnidadMedida:
    unidad = obtener_unidad_medida(db, unidad_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)

    for clave, valor in cambios.items():
        setattr(unidad, clave, valor)

    db.commit()
    db.refresh(unidad)
    return unidad


def eliminar_unidad_medida(db: Session, unidad_id: int) -> UnidadMedida:
    from src.insumos.models import Insumo
    from src.insumoQuimico.models import InsumoQuimico

    unidad = obtener_unidad_medida(db, unidad_id)

    # Validar que no esté en uso por insumos activos
    insumo_en_uso = db.scalar(
        select(Insumo).where(Insumo.unidad_medida_id == unidad_id, Insumo.activo == True)
    )
    if insumo_en_uso:
        raise exceptions.UnidadMedidaEnUso(
            mensaje=f"La unidad de medida '{unidad.nombre}' está en uso por el insumo '{insumo_en_uso.nombre}'."
        )

    # Validar que no esté en uso por insumos químicos activos
    insumo_quimico_en_uso = db.scalar(
        select(InsumoQuimico).where(InsumoQuimico.unidad_medida_id == unidad_id, InsumoQuimico.activo == True)
    )
    if insumo_quimico_en_uso:
        raise exceptions.UnidadMedidaEnUso(
            mensaje=f"La unidad de medida '{unidad.nombre}' está en uso por el insumo químico '{insumo_quimico_en_uso.nombre}'."
        )

    unidad.activo = False
    db.commit()
    db.refresh(unidad)
    return unidad
