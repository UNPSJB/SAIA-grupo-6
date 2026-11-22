from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.database import get_db
from src.auth.dependencies import get_current_user
from src.insumos import homologacion, schemas, services
from src.personal.models import Personal

router = APIRouter(prefix="/insumos", tags=["insumos"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[schemas.InsumoResponse])
def listar_insumos(
    ingrediente_id: Optional[int] = Query(None, ge=1),
    proveedor_id: Optional[int] = Query(None, ge=1),
    buscar: Optional[str] = Query(None, max_length=100),
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
):
    insumos = services.listar_insumos(db, ingrediente_id, proveedor_id, buscar, incluir_inactivos)
    meses = homologacion.vigencia_meses(db)
    return [services.a_respuesta(i, meses) for i in insumos]


@router.post("", response_model=schemas.InsumoResponse, status_code=status.HTTP_201_CREATED)
def crear_insumo(datos: schemas.InsumoCreate, db: Session = Depends(get_db)):
    return services.a_respuesta(services.crear_insumo(db, datos), homologacion.vigencia_meses(db))


@router.get("/{insumo_id}", response_model=schemas.InsumoResponse)
def obtener_insumo(insumo_id: int, db: Session = Depends(get_db)):
    return services.a_respuesta(services.obtener_insumo(db, insumo_id), homologacion.vigencia_meses(db))


@router.put("/{insumo_id}", response_model=schemas.InsumoResponse)
def actualizar_insumo(insumo_id: int, datos: schemas.InsumoUpdate, db: Session = Depends(get_db)):
    return services.a_respuesta(services.actualizar_insumo(db, insumo_id, datos), homologacion.vigencia_meses(db))


@router.delete("/{insumo_id}", response_model=schemas.InsumoResponse)
def dar_de_baja(insumo_id: int, db: Session = Depends(get_db)):
    return services.a_respuesta(services.dar_de_baja(db, insumo_id), homologacion.vigencia_meses(db))


@router.get("/{insumo_id}/homologacion", response_model=schemas.HomologacionInsumo)
def obtener_homologacion(insumo_id: int, db: Session = Depends(get_db)):
    """Rótulo del insumo, comparación con su ingrediente y estado."""
    return homologacion.obtener_homologacion(db, insumo_id)


@router.put("/{insumo_id}/rotulo", response_model=schemas.HomologacionInsumo)
def guardar_rotulo(insumo_id: int, datos: schemas.RotuloInsumoIn, db: Session = Depends(get_db)):
    return homologacion.guardar_rotulo(db, insumo_id, datos)


@router.post("/{insumo_id}/homologacion", response_model=schemas.HomologacionInsumo)
def decidir_homologacion(
    insumo_id: int,
    datos: schemas.DecisionHomologacionIn,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user),
):
    return homologacion.decidir(db, insumo_id, datos, usuario)
