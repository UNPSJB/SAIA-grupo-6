from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from src.database import get_db
from src.vencimientoPersonal import schemas, services
from src.auth.dependencies import require_admin


router = APIRouter(
    prefix="/vencimientos-personal",
    tags=["Vencimientos de Personal"],
    dependencies=[Depends(require_admin)],
)


@router.post("", response_model=schemas.VencimientoPersonalResponse, status_code=status.HTTP_201_CREATED)
def crear_vencimiento(datos: schemas.VencimientoPersonalCreate, db: Session = Depends(get_db)):
    return services.crear_vencimiento(db, datos)


@router.get("/persona/{persona_id}", response_model=List[schemas.VencimientoPersonalResponse])
def listar_vencimientos_de_persona(persona_id: int, db: Session = Depends(get_db)):
    return services.listar_vencimientos_de_persona(db, persona_id)


@router.get("/{vencimiento_id}", response_model=schemas.VencimientoPersonalResponse)
def obtener_vencimiento(vencimiento_id: int, db: Session = Depends(get_db)):
    return services.obtener_vencimiento(db, vencimiento_id)


@router.put("/{vencimiento_id}", response_model=schemas.VencimientoPersonalResponse)
def actualizar_vencimiento(
    vencimiento_id: int, datos: schemas.VencimientoPersonalUpdate, db: Session = Depends(get_db)
):
    return services.actualizar_vencimiento(db, vencimiento_id, datos)


@router.delete("/{vencimiento_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_vencimiento(vencimiento_id: int, db: Session = Depends(get_db)):
    services.eliminar_vencimiento(db, vencimiento_id)
