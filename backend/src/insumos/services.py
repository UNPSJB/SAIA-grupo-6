from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from src.common.listados import filtro_busqueda
from src.ingredientes.models import Ingrediente
from src.insumos import exceptions, schemas
from src.insumos.models import Insumo
from src.proveedores.models import Proveedor


def _consulta():
    return select(Insumo).options(
        selectinload(Insumo.ingrediente).selectinload(Ingrediente.unidad_medida),
        selectinload(Insumo.proveedores),
    )


def a_respuesta(insumo: Insumo, meses: Optional[int] = None) -> schemas.InsumoResponse:
    """`meses`: vigencia de la homologación; sin ella no se informa el vencimiento."""
    from src.common.fechas import hoy
    from src.insumos.homologacion import vigente_hasta

    vence = vigente_hasta(insumo, meses) if meses is not None else None
    return schemas.InsumoResponse(
        id=insumo.id,
        ingrediente_id=insumo.ingrediente_id,
        ingrediente_nombre=insumo.ingrediente.nombre,
        unidad=insumo.ingrediente.unidad_medida.simbolo,
        marca=insumo.marca,
        descripcion=insumo.descripcion,
        codigo_fabricante=insumo.codigo_fabricante,
        nombre=insumo.nombre,
        activo=insumo.activo,
        sin_rotulo=insumo.sin_rotulo,
        proveedores=[schemas.ProveedorResumen.model_validate(p) for p in insumo.proveedores],
        estado_homologacion=insumo.estado_homologacion,
        homologacion_vigente_hasta=vence,
        homologacion_vencida=vence is not None and vence < hoy(),
    )


def obtener_insumo(db: Session, insumo_id: int) -> Insumo:
    insumo = db.scalar(_consulta().where(Insumo.id == insumo_id))
    if insumo is None:
        raise exceptions.InsumoNoEncontrado()
    return insumo


def listar_insumos(
    db: Session,
    ingrediente_id: Optional[int] = None,
    proveedor_id: Optional[int] = None,
    buscar: Optional[str] = None,
    incluir_inactivos: bool = False,
) -> list[Insumo]:
    consulta = _consulta().join(Insumo.ingrediente)
    if ingrediente_id is not None:
        consulta = consulta.where(Insumo.ingrediente_id == ingrediente_id)
    if proveedor_id is not None:
        consulta = consulta.where(Insumo.proveedores.any(Proveedor.id == proveedor_id))
    filtro = filtro_busqueda((Insumo.marca, Insumo.descripcion, Ingrediente.nombre), buscar)
    if filtro is not None:
        consulta = consulta.where(filtro)
    if not incluir_inactivos:
        consulta = consulta.where(Insumo.activo.is_(True))
    return list(db.scalars(consulta.order_by(Ingrediente.nombre, Insumo.marca, Insumo.id)).all())


def _proveedores(
    db: Session, ids: list[int], ya_asociados: list[Proveedor] | None = None
) -> list[Proveedor]:
    """Proveedores activos con esos ids.

    Uno dado de baja solo se acepta si ya estaba asociado: si no, el insumo no
    se podría modificar después de dar de baja a uno de sus proveedores.
    """
    unicos = set(ids)
    if not unicos:
        return []
    previos = {p.id for p in ya_asociados or []}
    proveedores = [
        p
        for p in db.scalars(select(Proveedor).where(Proveedor.id.in_(unicos))).all()
        if p.activo or p.id in previos
    ]
    if len(proveedores) != len(unicos):
        raise exceptions.ProveedoresNoValidos()
    return proveedores


def _verificar_unico(
    db: Session,
    ingrediente_id: int,
    marca: str,
    descripcion: Optional[str],
    excepto_id: Optional[int] = None,
) -> None:
    """Un ingrediente no puede tener dos insumos con la misma marca y descripción."""
    consulta = select(Insumo.id).where(
        Insumo.ingrediente_id == ingrediente_id,
        func.lower(Insumo.marca) == marca.lower(),
        func.lower(func.coalesce(Insumo.descripcion, "")) == (descripcion or "").lower(),
    )
    if excepto_id is not None:
        consulta = consulta.where(Insumo.id != excepto_id)
    if db.scalar(consulta) is not None:
        raise exceptions.InsumoYaExiste()


def crear_insumo(db: Session, datos: schemas.InsumoCreate) -> Insumo:
    ingrediente = db.get(Ingrediente, datos.ingrediente_id)
    if ingrediente is None or not ingrediente.activo:
        raise exceptions.IngredienteNoValido()
    _verificar_unico(db, ingrediente.id, datos.marca, datos.descripcion)
    insumo = Insumo(
        ingrediente_id=ingrediente.id,
        marca=datos.marca,
        descripcion=datos.descripcion,
        codigo_fabricante=datos.codigo_fabricante,
        sin_rotulo=datos.sin_rotulo,
        proveedores=_proveedores(db, datos.proveedor_ids),
    )
    db.add(insumo)
    db.commit()
    return obtener_insumo(db, insumo.id)


def actualizar_insumo(db: Session, insumo_id: int, datos: schemas.InsumoUpdate) -> Insumo:
    insumo = obtener_insumo(db, insumo_id)
    cambios = {
        campo: valor
        for campo, valor in datos.model_dump(exclude_unset=True).items()
        # `None` en marca, activo o proveedores significa "no cambiar".
        if valor is not None or campo in ("descripcion", "codigo_fabricante")
    }
    if "marca" in cambios or "descripcion" in cambios:
        _verificar_unico(
            db,
            insumo.ingrediente_id,
            cambios.get("marca", insumo.marca),
            cambios.get("descripcion", insumo.descripcion),
            excepto_id=insumo.id,
        )
    if "proveedor_ids" in cambios:
        insumo.proveedores = _proveedores(db, cambios.pop("proveedor_ids"), insumo.proveedores)
    cambia_rotulo = "sin_rotulo" in cambios and cambios["sin_rotulo"] != insumo.sin_rotulo
    for campo, valor in cambios.items():
        setattr(insumo, campo, valor)
    if cambia_rotulo:
        from src.insumos.homologacion import cambiar_sin_rotulo

        cambiar_sin_rotulo(db, insumo)
    db.commit()
    return obtener_insumo(db, insumo.id)


def dar_de_baja(db: Session, insumo_id: int) -> Insumo:
    """Baja lógica: los lotes ya recibidos conservan la referencia."""
    insumo = obtener_insumo(db, insumo_id)
    insumo.activo = False
    db.commit()
    return obtener_insumo(db, insumo.id)
