import os
import shutil
import uuid
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, File, Form, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from src.database import get_db
from src.Equipo.models import Equipo, Calibracion
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.auth.dependencies import require_admin

router = APIRouter(prefix="/equipos", tags=["equipos"], dependencies=[Depends(require_admin)])

class EquipoResponse(BaseModel):
    id: int
    nombre: str
    tipo: str
    ubicacion: str
    activo: bool

    model_config = ConfigDict(from_attributes=True)

class EquipoCreate(BaseModel):
    nombre: str
    tipo: str
    ubicacion: str

class EquipoUpdate(BaseModel):
    nombre: str | None = None
    tipo: str | None = None
    ubicacion: str | None = None
    activo: bool | None = None

class CalibracionResponse(BaseModel):
    id: int
    fecha_realizacion: date
    proximo_vencimiento: date | None = None
    certificado_url: str

    model_config = ConfigDict(from_attributes=True)

@router.get("", response_model=list[EquipoResponse])
def listar_equipos(incluir_inactivos: bool = False, db: Session = Depends(get_db)):
    consulta = select(Equipo).order_by(Equipo.id)
    if not incluir_inactivos:
        consulta = consulta.where(Equipo.activo == True)
    return list(db.scalars(consulta).all())

@router.post("", response_model=EquipoResponse)
def crear_equipo(datos: EquipoCreate, db: Session = Depends(get_db)):
    nuevo = Equipo(**datos.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.put("/{equipo_id}", response_model=EquipoResponse)
def modificar_equipo(equipo_id: int, datos: EquipoUpdate, db: Session = Depends(get_db)):
    equipo = db.scalar(select(Equipo).where(Equipo.id == equipo_id))
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    
    cambios = datos.model_dump(exclude_unset=True)
    for clave, valor in cambios.items():
        setattr(equipo, clave, valor)
        
    db.commit()
    db.refresh(equipo)
    return equipo

@router.delete("/{equipo_id}")
def eliminar_equipo(equipo_id: int, db: Session = Depends(get_db)):
    equipo = db.scalar(select(Equipo).where(Equipo.id == equipo_id))
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    
    equipo.activo = False
    db.commit()
    return {"mensaje": "Equipo dado de baja lógicamente"}

@router.post("/{equipo_id}/calibraciones")
def registrar_calibracion(
    equipo_id: int,
    fecha: date = Form(...),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    equipo = db.scalar(select(Equipo).where(Equipo.id == equipo_id))
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    # 1. Buscamos el plan activo de calibración para este equipo
    plan = db.scalar(
        select(PlanCalibracionMantenimiento).where(
            PlanCalibracionMantenimiento.equipo_id == equipo_id,
            PlanCalibracionMantenimiento.tipo == "calibracion",
            PlanCalibracionMantenimiento.activo == True
        )
    )

    # 2. Guardamos el archivo físicamente
    extension = archivo.filename.split('.')[-1]
    nombre_archivo = f"eq{equipo_id}_{uuid.uuid4().hex[:8]}.{extension}"
    os.makedirs("uploads/certificados", exist_ok=True)
    ruta_guardado = f"uploads/certificados/{nombre_archivo}"

    with open(ruta_guardado, "wb") as buffer:
        shutil.copyfileobj(archivo.file, buffer)

    # 3. Calculamos el próximo vencimiento para el historial
    proximo_venc = None
    if plan:
        proximo_venc = fecha + timedelta(days=plan.periodicidad_dias)

    # 4. Registramos tu historial de auditoría
    nueva_calibracion = Calibracion(
        equipo_id=equipo_id,
        fecha_realizacion=fecha,
        proximo_vencimiento=proximo_venc,
        certificado_url=f"/uploads/certificados/{nombre_archivo}"
    )
    db.add(nueva_calibracion)

    # 5. INTEGRACIÓN: Actualizamos el plan para que recalcule las alertas
    if plan and fecha >= plan.fecha_ultima_intervencion:
        plan.fecha_ultima_intervencion = fecha

    db.commit()
    return {"mensaje": "Calibración registrada con éxito"}

@router.get("/{equipo_id}/calibraciones", response_model=list[CalibracionResponse])
def ver_historial_calibraciones(equipo_id: int, db: Session = Depends(get_db)):
    equipo = db.scalar(select(Equipo).where(Equipo.id == equipo_id))
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    calibraciones = db.scalars(
        select(Calibracion)
        .where(Calibracion.equipo_id == equipo_id)
        .order_by(Calibracion.fecha_realizacion.desc())
    ).all()

    return list(calibraciones)