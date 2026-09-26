from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.consumoInsumoQuimico import schemas, services


router = APIRouter(
    prefix="/consumos-insumos-quimicos",
    tags=["Consumo de Insumos Químicos"]
)


@router.post(
    "/registro/{registro_tarea_id}",
    response_model=schemas.ConsumoInsumoQuimicoResponse
)
def registrar_consumo_insumo_quimico(
    registro_tarea_id: int,
    datos: schemas.ConsumoInsumoQuimicoCreate,
    db: Session = Depends(get_db)
):
    return services.registrar_consumo_insumo_quimico(
        db,
        registro_tarea_id,
        datos
    )


@router.get(
    "/acumulado",
    response_model=list[
        schemas.ConsumoInsumoQuimicoAcumuladoResponse
    ]
)
def obtener_consumo_acumulado(
    db: Session = Depends(get_db)
):
    return services.obtener_consumo_acumulado(db)