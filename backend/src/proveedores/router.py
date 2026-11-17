from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session
from src.auth.dependencies import require_admin
from src.common.archivos import guardar_archivo
from src.config import settings
from src.database import get_db
from src.proveedores import schemas, services

router = APIRouter(prefix="/proveedores", tags=["Proveedores"], dependencies=[Depends(require_admin)])

@router.post("", response_model=schemas.ProveedorResponse, status_code=status.HTTP_201_CREATED)
def crear_proveedor(datos: schemas.ProveedorCreate, db: Session = Depends(get_db)):
    return services.crear_proveedor(db, datos)

@router.get("", response_model=list[schemas.ProveedorResponse])
def listar_proveedores(incluir_inactivos: bool = False, buscar: Optional[str] = None, db: Session = Depends(get_db)):
    return services.listar_proveedores(db, incluir_inactivos, buscar)

@router.get("/{proveedor_id}", response_model=schemas.ProveedorResponse)
def obtener_proveedor(proveedor_id: int, db: Session = Depends(get_db)):
    return services.obtener_proveedor(db, proveedor_id)

@router.put("/{proveedor_id}", response_model=schemas.ProveedorResponse)
def actualizar_proveedor(proveedor_id: int, datos: schemas.ProveedorUpdate, db: Session = Depends(get_db)):
    return services.actualizar_proveedor(db, proveedor_id, datos)

@router.delete("/{proveedor_id}", response_model=schemas.ProveedorResponse)
def eliminar_proveedor(proveedor_id: int, db: Session = Depends(get_db)):
    return services.eliminar_proveedor(db, proveedor_id)

@router.put("/{proveedor_id}/insumos", response_model=schemas.ProveedorResponse)
def actualizar_insumos(proveedor_id: int, datos: schemas.AsociarInsumos, db: Session = Depends(get_db)):
    return services.asociar_insumos(db, proveedor_id, datos.insumo_ids)

@router.post("/{proveedor_id}/certificaciones", response_model=schemas.ProveedorResponse)
def cargar_certificacion(
    proveedor_id: int,
    tipo: str = Form(...),
    numero: str = Form(...),
    fecha_vencimiento: date = Form(...),
    fecha_emision: date | None = Form(None),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    datos = schemas.CertificacionCreate(
        tipo=tipo, numero=numero,
        fecha_vencimiento=fecha_vencimiento, fecha_emision=fecha_emision,
    )
    ruta = guardar_archivo(
        archivo, {".pdf"}, settings.MAX_UPLOAD_SIZE_BYTES,
        "certificacion_proveedor", "certificaciones_proveedores",
    )
    return services.registrar_certificacion(db, proveedor_id, datos, ruta)
