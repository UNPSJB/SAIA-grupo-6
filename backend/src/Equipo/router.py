from fastapi import UploadFile, File, Form, HTTPException
from datetime import date, timedelta
import shutil
import uuid
import os
from pydantic import BaseModel
from sqlalchemy import select
from .models import Equipo, Calibracion
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.database import get_db
from . import schemas, services

class CalibracionResponse(BaseModel):
    id: int
    fecha_realizacion: date
    proximo_vencimiento: date
    certificado_url: str

    class Config:
        from_attributes = True

router = APIRouter(
    prefix="/equipos",
    tags=["Equipos"]
)

@router.post(
    "",
    response_model=schemas.EquipoResponse,
    status_code=status.HTTP_201_CREATED
)
def crear_equipo(
    datos: schemas.EquipoCreate,
    db: Session = Depends(get_db)
):
    return services.crear_equipo(db, datos)

@router.get(
    "",
    response_model=list[schemas.EquipoResponse]
)
def listar_equipo(
    incluir_inactivos: bool = False,
    db:Session = Depends(get_db)
):
    return services.listar_equipos(db, incluir_inactivos)

@router.get(
    "/{equipo_id}",
    response_model=schemas.EquipoResponse
)
def obtener_equipo(
    equipo_id: int,
    db: Session = Depends(get_db)
):
    return services.obtener_equipo(db, equipo_id)

@router.patch(
    "/{equipo_id}",
    response_model=schemas.EquipoResponse
)
def actualizar_equipo(
    equipo_id: int,
    datos: schemas.EquipoUpdate,
    db: Session = Depends(get_db)
):
    return services.actualizar_equipo(
        db,
        equipo_id,
        datos
    )

@router.delete(
    "/{equipo_id}",
    response_model=schemas.EquipoResponse
)
def dar_de_baja_equipo(
    equipo_id: int,
    db: Session = Depends(get_db)
):
    return services.dar_de_baja_equipo(
        db,
        equipo_id
    )

@router.post(
    "/{equipo_id}/calibraciones",
    status_code=status.HTTP_201_CREATED
)
def registrar_calibracion_con_certificado(
    equipo_id: int,
    fecha_realizacion: date = Form(...),
    certificado: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # 1. Buscar que el equipo exista
    equipo = db.scalar(select(Equipo).where(Equipo.id == equipo_id))
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    # 2. Validar que sea PDF o Imagen (Criterio de Aceptación)
    extension = certificado.filename.split('.')[-1].lower()
    if extension not in ['pdf', 'jpg', 'jpeg', 'png']:
        raise HTTPException(status_code=400, detail="El archivo debe ser PDF o Imagen")

    # 3. Guardar el archivo físicamente con un nombre único para que no se pisen
    nombre_archivo = f"eq{equipo_id}_{uuid.uuid4().hex[:8]}.{extension}"
    ruta_guardado = f"uploads/certificados/{nombre_archivo}"
    
    # <-- LÍNEA NUEVA: Le decimos a Python que cree la carpeta si no existe
    os.makedirs("uploads/certificados", exist_ok=True)
    
    with open(ruta_guardado, "wb") as buffer:
        shutil.copyfileobj(certificado.file, buffer)

    # 4. Calcular próximo vencimiento (Criterio de Aceptación)
    # Si el equipo no tiene frecuencia definida, le ponemos 365 días por defecto
    dias_frecuencia = equipo.frecuencia_calibracion_dias or 365
    fecha_vencimiento = fecha_realizacion + timedelta(days=dias_frecuencia)

    # 5. Guardar el registro en la base de datos
    nueva_calibracion = Calibracion(
        equipo_id=equipo_id,
        fecha_realizacion=fecha_realizacion,
        proximo_vencimiento=fecha_vencimiento,
        certificado_url=f"/{ruta_guardado}"
    )
    
    db.add(nueva_calibracion)
    db.commit()
    db.refresh(nueva_calibracion)

    return {
        "mensaje": "Calibración registrada exitosamente",
        "proximo_vencimiento": fecha_vencimiento,
        "certificado_url": nueva_calibracion.certificado_url
    }
    
@router.get(
    "/{equipo_id}/calibraciones",
    response_model=list[CalibracionResponse]
)
def ver_historial_calibraciones(
    equipo_id: int,
    db: Session = Depends(get_db)
):
    equipo = db.scalar(select(Equipo).where(Equipo.id == equipo_id))
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    # Buscamos las calibraciones ordenadas por fecha descendente
    calibraciones = db.scalars(
        select(Calibracion)
        .where(Calibracion.equipo_id == equipo_id)
        .order_by(Calibracion.fecha_realizacion.desc())
    ).all()

    return list(calibraciones)