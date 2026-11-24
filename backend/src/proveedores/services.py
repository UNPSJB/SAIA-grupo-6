import logging
from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from src.common.texto import contiene_texto
from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    verificar_disponibilidad,
)
from src.insumos.models import Insumo
from src.proveedores import exceptions, schemas
from src.proveedores.models import Proveedor, CertificacionProveedor

logger = logging.getLogger(__name__)

def _cuit_normalizado(valor: str | None):
    return "".join(ch for ch in (valor or "") if ch.isdigit()) or None

def _consulta_proveedor():
    return select(Proveedor).options(
        selectinload(Proveedor.insumos).selectinload(Insumo.ingrediente),
        selectinload(Proveedor.certificaciones),
    )

def crear_proveedor(db: Session, datos: schemas.ProveedorCreate) -> Proveedor:
    valores = datos.model_dump()
    if valores.get("matricula"):
        verificar_disponibilidad(
            db, Proveedor, "matricula", valores["matricula"],
            ya_existe=exceptions.MatriculaYaExiste, etiqueta="proveedor",
        )
    cuit = _cuit_normalizado(valores.get("cuit") or valores.get("matricula"))
    if db.scalar(select(Proveedor).where(Proveedor.nombre.ilike(valores["nombre"]))):
        raise exceptions.NombreProveedorDuplicado()
    if cuit:
        if valores.get("cuit") and len(cuit) != 11:
            raise exceptions.CuitInvalido()
        duplicado = db.scalar(select(Proveedor).where(Proveedor.cuit == cuit))
        if duplicado:
            raise exceptions.CuitDuplicado()
    valores["cuit"] = cuit
    valores["matricula"] = valores.get("matricula") or cuit
    proveedor = Proveedor(**valores)
    db.add(proveedor)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    return db.scalar(_consulta_proveedor().where(Proveedor.id == proveedor.id))

def listar_proveedores(db: Session, incluir_inactivos=False, buscar=None):
    consulta = _consulta_proveedor()
    if buscar:
        termino = buscar.strip()
        # Sin tildes ni mayúsculas, como el resto de las búsquedas.
        consulta = consulta.where(
            contiene_texto(Proveedor.nombre, termino) |
            contiene_texto(Proveedor.cuit, termino) |
            contiene_texto(Proveedor.matricula, termino) |
            contiene_texto(Proveedor.rubro, termino)
        )
    if not incluir_inactivos:
        consulta = consulta.where(Proveedor.activo.is_(True))
    return list(db.scalars(consulta.order_by(Proveedor.nombre)).unique().all())

def obtener_proveedor(db: Session, proveedor_id: int) -> Proveedor:
    proveedor = db.scalar(_consulta_proveedor().where(Proveedor.id == proveedor_id))
    if proveedor is None:
        raise exceptions.ProveedorNoEncontrado()
    return proveedor

def actualizar_proveedor(db: Session, proveedor_id: int, datos: schemas.ProveedorUpdate):
    proveedor = obtener_proveedor(db, proveedor_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    if "nombre" in cambios:
        duplicado_nombre = db.scalar(select(Proveedor).where(
            Proveedor.nombre.ilike(cambios["nombre"]), Proveedor.id != proveedor_id
        ))
        if duplicado_nombre:
            raise exceptions.NombreProveedorDuplicado()
    if "matricula" in cambios:
        duplicado_matricula = db.scalar(select(Proveedor).where(
            Proveedor.matricula == cambios["matricula"], Proveedor.id != proveedor_id
        ))
        if duplicado_matricula:
            raise exceptions.MatriculaYaExiste()
        if "cuit" not in cambios:
            cambios["cuit"] = _cuit_normalizado(cambios["matricula"])
    if "cuit" in cambios:
        cuit = _cuit_normalizado(cambios["cuit"])
        if cuit and len(cuit) != 11:
            raise exceptions.CuitInvalido()
        duplicado = db.scalar(select(Proveedor).where(Proveedor.cuit == cuit, Proveedor.id != proveedor_id))
        if duplicado:
            raise exceptions.CuitDuplicado()
        cambios["cuit"] = cuit
        cambios["matricula"] = cuit
    elif "matricula" in cambios and "cuit" not in cambios:
        cambios["matricula"] = cambios["matricula"]
    return aplicar_cambios(db, proveedor, cambios)

def eliminar_proveedor(db: Session, proveedor_id: int):
    return baja_logica(db, obtener_proveedor(db, proveedor_id))

def asociar_insumos(db: Session, proveedor_id: int, insumo_ids: list[int]):
    proveedor = obtener_proveedor(db, proveedor_id)
    ids = set(insumo_ids)
    insumos = list(db.scalars(select(Insumo).where(Insumo.id.in_(ids), Insumo.activo.is_(True))).all()) if ids else []
    if len(insumos) != len(ids):
        raise exceptions.InsumosNoValidos()
    proveedor.insumos = insumos
    db.commit()
    return obtener_proveedor(db, proveedor_id)

def registrar_certificacion(db: Session, proveedor_id: int, datos: schemas.CertificacionCreate, archivo_url: str):
    proveedor = obtener_proveedor(db, proveedor_id)
    if not proveedor.activo:
        raise exceptions.ProveedorNoEncontrado()
    certificacion = CertificacionProveedor(
        proveedor_id=proveedor_id, **datos.model_dump(), archivo_url=archivo_url
    )
    db.add(certificacion)
    proveedor.es_certificado = True
    db.commit()
    return obtener_proveedor(db, proveedor_id)

def obtener_certificacion_vigente(db: Session, proveedor_id: int, fecha: date):
    return db.scalar(
        select(CertificacionProveedor)
        .where(
            CertificacionProveedor.proveedor_id == proveedor_id,
            CertificacionProveedor.fecha_vencimiento >= fecha,
            (CertificacionProveedor.fecha_emision.is_(None) | (CertificacionProveedor.fecha_emision <= fecha)),
        )
        .order_by(CertificacionProveedor.fecha_vencimiento.desc(), CertificacionProveedor.id.desc())
    )
