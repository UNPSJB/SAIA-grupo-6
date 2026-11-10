from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.database import get_db
from src.nutricion import pdf, schemas, services
from src.personal.models import Personal

# Toda la épica es de "persona con permiso de administrar".
router = APIRouter(
    prefix="/nutricion",
    tags=["Información nutricional"],
    dependencies=[Depends(require_admin)],
)


# ── Parámetros de cálculo ──────────────────────────────────────────────────


@router.get("/parametros", response_model=schemas.ParametrosResponse)
def obtener_parametros(db: Session = Depends(get_db)):
    return services.obtener_parametros(db)


@router.put("/parametros", response_model=schemas.ParametrosResponse)
def actualizar_parametros(datos: schemas.ParametrosUpdate, db: Session = Depends(get_db)):
    return services.actualizar_parametros(db, datos)


# ── Base de composición ────────────────────────────────────────────────────


@router.get("/alimentos", response_model=list[schemas.AlimentoReferenciaResponse])
def listar_alimentos(
    buscar: Optional[str] = Query(None, max_length=100),
    base: Optional[str] = Query(None, max_length=100),
    limite: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return services.listar_alimentos(db, buscar, base, limite)


@router.get("/alimentos/bases", response_model=list[str])
def listar_bases(db: Session = Depends(get_db)):
    return services.listar_bases(db)


@router.post("/alimentos/importar", response_model=schemas.ResultadoImportacion)
async def importar_alimentos(
    base: str = Form(..., max_length=100),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    contenido = await archivo.read()
    return services.importar_alimentos(db, base, contenido)


# ── Datos nutricionales del insumo ─────────────────────────────────────────


@router.get("/insumos/{insumo_id}", response_model=schemas.DatosNutricionalesResponse)
def obtener_datos_insumo(insumo_id: int, db: Session = Depends(get_db)):
    return services.obtener_datos_insumo(db, insumo_id)


@router.put("/insumos/{insumo_id}", response_model=schemas.DatosNutricionalesResponse)
def guardar_datos_insumo(
    insumo_id: int,
    datos: schemas.DatosNutricionalesIn,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    return services.guardar_datos_insumo(db, insumo_id, datos, usuario)


# ── Información nutricional del producto ───────────────────────────────────


@router.get("/productos/{producto_id}", response_model=schemas.InfoNutricionalResponse)
def calcular_info_nutricional(
    producto_id: int,
    version_id: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
):
    return services.calcular_info_nutricional(db, producto_id, version_id)


@router.put(
    "/productos/{producto_id}/configuracion", response_model=schemas.ConfiguracionProducto
)
def guardar_configuracion(
    producto_id: int,
    datos: schemas.ConfiguracionProductoIn,
    db: Session = Depends(get_db),
):
    return services.guardar_configuracion(db, producto_id, datos)


@router.put(
    "/productos/{producto_id}/laboratorio", response_model=list[schemas.ValorLaboratorio]
)
def guardar_laboratorio(
    producto_id: int,
    datos: schemas.LaboratorioIn,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    """Resultados de un análisis del producto: reemplazan al valor calculado."""
    return services.guardar_laboratorio(db, producto_id, datos, usuario)


@router.get("/productos/{producto_id}/pdf")
def exportar_pdf(
    producto_id: int,
    version_id: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
):
    info = services.calcular_info_nutricional(db, producto_id, version_id)
    nombre = "".join(ch if ch.isalnum() else "_" for ch in info.producto)[:60]
    return Response(
        content=pdf.generar_pdf(info),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="info_nutricional_{nombre}.pdf"'
        },
    )
