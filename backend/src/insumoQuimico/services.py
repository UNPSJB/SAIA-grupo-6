from typing import List
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.exceptions import ConflictoRegistroInactivo
from src.insumoQuimico.models import InsumoQuimico
from src.insumoQuimico import schemas, exceptions

def crear_insumo_quimico(db: Session, datos: schemas.InsumoQuimicoCreate) -> InsumoQuimico:
    existente = db.scalar(
        select(InsumoQuimico).where(InsumoQuimico.nombre == datos.nombre)
    )
    if existente:
        if existente.activo:
            raise exceptions.InsumoQuimicoYaExiste()
        else:
            raise ConflictoRegistroInactivo(
                mensaje=f"El insumo químico '{existente.nombre}' ya existe pero está dado de baja. ¿Querés reactivarlo con estos nuevos datos?",
                entidad_id=existente.id,
                campo="nombre"
            )

    nuevo_insumo = InsumoQuimico(**datos.model_dump())
    db.add(nuevo_insumo)
    db.commit()
    db.refresh(nuevo_insumo)
    return nuevo_insumo

def listar_insumos_quimicos(db: Session, incluir_inactivos: bool = False) -> List[InsumoQuimico]:
    consulta = select(InsumoQuimico).order_by(InsumoQuimico.id)
    if not incluir_inactivos:
        consulta = consulta.where(InsumoQuimico.activo == True)
    return list(db.scalars(consulta).all())

def obtener_insumo_quimico(db: Session, insumo_id: int) -> InsumoQuimico:
    insumo = db.scalar(select(InsumoQuimico).where(InsumoQuimico.id == insumo_id))
    if not insumo:
        raise exceptions.InsumoQuimicoNoEncontrado()
    return insumo

def actualizar_insumo_quimico(db: Session, insumo_id: int, datos: schemas.InsumoQuimicoUpdate) -> InsumoQuimico:
    insumo = obtener_insumo_quimico(db, insumo_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    
    for clave, valor in cambios.items():
        setattr(insumo, clave, valor)

    db.commit()
    db.refresh(insumo)
    return insumo

def eliminar_insumo_quimico(db: Session, insumo_id: int) -> InsumoQuimico:
    insumo = obtener_insumo_quimico(db, insumo_id)
    insumo.activo = False
    db.commit()
    db.refresh(insumo)
    return insumo

