from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.auditoria.models import AuditLog
from src.config import settings
from src.nutricion.schemas import FuenteCalculo
from src.nutricion.services import calcular_info_nutricional
from src.recetas.composicion_services import calcular_composicion
from src.recetas.services import obtener_version
from src.pyme.pdf import cabecera_desde_db
from src.rotulado import declaraciones_services, pdf, schemas, services


def exportar_borrador_pdf(db: Session, borrador_id: int, usuario) -> bytes:
    usuario_id = usuario.id
    declaraciones_services._reservar_escritura(db)
    vista = services.previsualizar_borrador(db, borrador_id)
    version_id = vista.origen.version_id
    if version_id is None:
        raise HTTPException(
            status_code=409,
            detail=vista.origen.motivo or "Vinculá una versión de receta verificable antes de exportar.",
        )

    receta = obtener_version(db, version_id)
    composicion = calcular_composicion(db, version_id)
    fuentes: list[FuenteCalculo] = []
    nutricion = calcular_info_nutricional(
        db, vista.borrador.producto_id, version_id, inicializar_parametros=False, fuentes=fuentes,
    )
    actual = schemas.InstantaneaNutricional.model_validate_json(services._serializar_nutricion(nutricion))
    guardada = vista.nutricion.tabla
    coincide = guardada is not None and actual.model_dump(exclude={"calculado_en"}) == guardada.model_dump(
        exclude={"calculado_en"},
    )
    generado = datetime.now(ZoneInfo(settings.ZONA_HORARIA))
    contenido = pdf.generar_pdf(
        vista,
        receta,
        composicion,
        nutricion,
        fuentes,
        coincide,
        generado,
        cabecera=cabecera_desde_db(db),
        usuario=usuario,
    )
    db.add(AuditLog(
        fecha=generado.astimezone(timezone.utc).replace(tzinfo=None),
        usuario_id=usuario_id,
        entidad="borradores_rotulado",
        entidad_id=str(borrador_id),
        accion="EXPORTAR",
        cambios={
            "formato": [None, "PDF"],
            "generado_en": [None, generado.isoformat(timespec="seconds")],
            "version_receta_id": [None, receta.id],
            "version_receta_numero": [None, receta.numero],
            "version_regla_e12": [None, vista.rotulado_frontal.regla_version],
        },
    ))
    db.commit()
    return contenido
