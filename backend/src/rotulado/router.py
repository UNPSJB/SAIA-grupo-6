from typing import Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.database import get_db
from src.personal.models import Personal
from src.rotulado import exportacion, schemas, services
from src.rotulado.exceptions import ProductoNoEncontrado

router = APIRouter(
    prefix="/rotulado",
    tags=["Rotulado"],
    dependencies=[Depends(require_admin)],
)


@router.get(
    "/productos/{producto_id}/borradores",
    response_model=list[schemas.BorradorRotuladoListado],
)
def listar_borradores_por_producto(
    producto_id: int,
    con_completitud: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Lista todos los borradores de rotulado de un producto.

    Con `con_completitud` dice además si cada uno tiene sus datos completos.
    """
    producto = db.get(__import__("src.productos.models", fromlist=["Producto"]).Producto, producto_id)
    if producto is None:
        raise ProductoNoEncontrado()
    return services.listar_borradores(db, producto_id, con_completitud)


@router.post(
    "/productos/{producto_id}/borradores",
    response_model=schemas.BorradorRotuladoOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_borrador(
    producto_id: int,
    datos: schemas.BorradorRotuladoCreate,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    """Crea un nuevo borrador de rotulado para un producto."""
    return services.crear_borrador(db, producto_id, datos, usuario)


@router.get(
    "/productos/{producto_id}/autocompletar/preview",
    response_model=schemas.VistaPreviaAutocompletado,
)
def preview_autocompletado(
    producto_id: int,
    version_id: Optional[int] = Query(None, gt=0),
    db: Session = Depends(get_db),
):
    """Devuelve una vista previa de datos autocompletados para un producto.

    No guarda nada en la base de datos. Solo consulta producto, receta,
    versión, composición (E10) y nutrición (E11) para proponer valores
    al formulario de creación de borrador.
    """
    return services.preview_autocompletado(db, producto_id, version_id)


@router.get(
    "/borradores/{borrador_id}",
    response_model=schemas.BorradorRotuladoOut,
)
def obtener_borrador(
    borrador_id: int,
    db: Session = Depends(get_db),
):
    """Obtiene un borrador de rotulado por su ID. Solo consulta, no crea."""
    return services.obtener_borrador(db, borrador_id)


@router.patch(
    "/borradores/{borrador_id}",
    response_model=schemas.BorradorRotuladoOut,
)
def actualizar_borrador(
    borrador_id: int,
    datos: schemas.BorradorRotuladoUpdate,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    """Actualiza parcialmente un borrador de rotulado (PATCH)."""
    return services.actualizar_borrador(db, borrador_id, datos, usuario)


@router.delete(
    "/borradores/{borrador_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def eliminar_borrador(
    borrador_id: int,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    """Elimina un borrador de rotulado."""
    services.eliminar_borrador(db, borrador_id)
    return None


@router.post(
    "/borradores/{borrador_id}/autocompletar",
    response_model=schemas.BorradorRotuladoOut,
)
def autocompletar_borrador(
    borrador_id: int,
    datos: schemas.AutocompletarIn,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    """Llena campos vacíos del borrador desde E10, E11 y E8.

    No sobrescribe valores ya cargados a menos que `forzar` sea true.
    """
    return services.autocompletar_borrador(
        db,
        borrador_id,
        datos.version_id,
        datos.lote_id,
        datos.forzar,
        usuario,
    )


@router.post(
    "/borradores/{borrador_id}/nutricion/recalcular",
    response_model=schemas.BorradorRotuladoOut,
)
def recalcular_nutricion_borrador(
    borrador_id: int,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    return services.recalcular_nutricion_borrador(db, borrador_id, usuario)


@router.get(
    "/borradores/{borrador_id}/completitud",
    response_model=schemas.CompletitudRotulado,
)
def consultar_completitud(
    borrador_id: int,
    db: Session = Depends(get_db),
):
    """Devuelve el indicador de completitud del borrador."""
    return services.calcular_completitud(db, borrador_id)


@router.get(
    "/borradores/{borrador_id}/historial-ediciones",
    response_model=list[schemas.CampoEditadoOut],
)
def consultar_historial_ediciones(
    borrador_id: int,
    db: Session = Depends(get_db),
):
    """Devuelve la trazabilidad de modificaciones del borrador."""
    return services.obtener_historial_ediciones(db, borrador_id)


# HU106: todo el router contin?a protegido por require_admin.
from src.rotulado import declaraciones_services as declaraciones
from src.rotulado.declaraciones_schemas import (
    EditarDeclaraciones, RegenerarDeclaraciones, RevisionEsperada, DeclaracionesOut,
)
from src.alergenos.constants import VERSION_REGLAS
from src.alergenos.services import listar_alergenos


@router.get("/catalogo-alergenos")
def catalogo_alergenos(db: Session = Depends(get_db)):
    """Sustancias que se pueden declarar: el catálogo de alérgenos activos."""
    return {
        "version_reglas": VERSION_REGLAS,
        "sustancias": [
            {"codigo": a.codigo, "nombre": a.nombre, "condicionada": a.condicionada}
            for a in listar_alergenos(db)
        ],
    }


@router.get("/borradores/{borrador_id}/declaraciones", response_model=DeclaracionesOut)
def consultar_declaraciones(borrador_id: int, db: Session = Depends(get_db)):
    return declaraciones.consultar(db, borrador_id)


@router.get("/borradores/{borrador_id}/declaraciones/historial", response_model=list[DeclaracionesOut])
def historial_declaraciones(borrador_id: int, db: Session = Depends(get_db)):
    from sqlalchemy import select
    from src.rotulado.models import RevisionDeclaracionRotulado
    borrador = declaraciones.borrador_por_id(db, borrador_id)
    revisiones = db.scalars(select(RevisionDeclaracionRotulado).where(
        RevisionDeclaracionRotulado.borrador_id == borrador_id
    ).order_by(RevisionDeclaracionRotulado.numero.desc())).all()
    return [declaraciones.revision_salida(db, borrador, revision) for revision in revisiones]


@router.post("/borradores/{borrador_id}/declaraciones/regenerar", response_model=DeclaracionesOut)
def regenerar_declaraciones(borrador_id: int, datos: RegenerarDeclaraciones,
                           db: Session = Depends(get_db), usuario: Personal = Depends(require_admin)):
    return declaraciones.regenerar(db, borrador_id, datos, usuario)


@router.patch("/borradores/{borrador_id}/declaraciones", response_model=DeclaracionesOut)
def editar_declaraciones(borrador_id: int, datos: EditarDeclaraciones,
                        db: Session = Depends(get_db), usuario: Personal = Depends(require_admin)):
    return declaraciones.editar(db, borrador_id, datos, usuario)


@router.post("/borradores/{borrador_id}/declaraciones/confirmar", response_model=DeclaracionesOut)
def confirmar_declaraciones(borrador_id: int, datos: RevisionEsperada,
                           db: Session = Depends(get_db), usuario: Personal = Depends(require_admin)):
    return declaraciones.confirmar(db, borrador_id, datos, usuario)



@router.get("/borradores/{borrador_id}/previsualizacion", response_model=schemas.PrevisualizacionRotulado)
def previsualizar_borrador(borrador_id: int, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return services.previsualizar_borrador(db, borrador_id)


@router.post(
    "/borradores/{borrador_id}/exportar-pdf",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def exportar_borrador_pdf(
    borrador_id: int,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    contenido = exportacion.exportar_borrador_pdf(db, borrador_id, usuario.id)
    return Response(
        content=contenido,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="borrador-rotulo-{borrador_id}.pdf"',
            "Cache-Control": "private, no-store",
        },
    )
