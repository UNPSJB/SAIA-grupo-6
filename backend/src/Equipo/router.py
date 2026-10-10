from datetime import date, timedelta
import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from werkzeug.utils import secure_filename

from src.auth.dependencies import require_admin, require_operador
from src.config import CARPETA_UPLOADS
from src.database import get_db
from src.PlanCalibracionMantenimiento.services import (
    asentar_ultima_intervencion_por_calibracion,
)
from . import schemas, services
from .models import Calibracion, Equipo

# Sin dependencia global: cada endpoint declara lo que necesita.
# Leer la lista de equipos es parte de lo operativo (por ejemplo, para
# reportar un incidente), pero modificar el maestro es solo del administrador.
router = APIRouter(
    prefix="/equipos",
    tags=["Equipos"],
)

@router.post(
    "",
    response_model=schemas.EquipoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)]
)
def crear_equipo(
    datos: schemas.EquipoCreate,
    db: Session = Depends(get_db)
):
    return services.crear_equipo(db, datos)

@router.get(
    "",
    response_model=list[schemas.EquipoResponse],
    dependencies=[Depends(require_operador)]
)
def listar_equipos(
    incluir_inactivos: bool = False,
    db:Session = Depends(get_db)
):
    return services.listar_equipos(db, incluir_inactivos)

@router.get(
    "/{equipo_id}",
    response_model=schemas.EquipoResponse,
    dependencies=[Depends(require_operador)]
)
def obtener_equipo(
    equipo_id: int,
    db: Session = Depends(get_db)
):
    return services.obtener_equipo(db, equipo_id)

@router.patch(
    "/{equipo_id}",
    response_model=schemas.EquipoResponse,
    dependencies=[Depends(require_admin)]
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
    response_model=schemas.EquipoResponse,
    dependencies=[Depends(require_admin)]
)
def dar_de_baja_equipo(
    equipo_id: int,
    db: Session = Depends(get_db)
):
    return services.dar_de_baja_equipo(
        db,
        equipo_id
    )

# Extensiones y tamaño del certificado. Mismo criterio que las fotos de
# incidentes: el MIME que manda el navegador no alcanza, se valida acá.
EXTENSIONES_CERTIFICADO = {".pdf", ".jpg", ".jpeg", ".png"}
TAMANO_MAX_CERTIFICADO = 10 * 1024 * 1024  # 10 MB


@router.post(
    "/{equipo_id}/calibraciones",
    status_code=status.HTTP_201_CREATED,
    response_model=schemas.CalibracionResponse,
    dependencies=[Depends(require_operador)]
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
    #
    #    `secure_filename` recorta la ruta que venga en el nombre del archivo
    #    para que no se pueda escribir fuera de la carpeta de certificados.
    extension = os.path.splitext(secure_filename(certificado.filename or ""))[1].lower()
    if extension not in EXTENSIONES_CERTIFICADO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "El certificado debe ser PDF o imagen. "
                f"Formatos válidos: {', '.join(sorted(EXTENSIONES_CERTIFICADO))}."
            ),
        )

    # 3. Tope de tamaño antes de escribir nada en disco.
    contenido = certificado.file.read()
    if len(contenido) > TAMANO_MAX_CERTIFICADO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "El certificado supera el máximo de "
                f"{TAMANO_MAX_CERTIFICADO // (1024 * 1024)} MB."
            ),
        )

    # 4. Guardar el archivo con un nombre único para que dos certificados del
    #    mismo equipo no se pisen. Va anclado a CARPETA_UPLOADS y no al CWD del
    #    proceso: arrancar el server desde otra carpeta guardaba (y dejaba de
    #    servir) los archivos en otro lado.
    nombre_archivo = f"eq{equipo_id}_{uuid.uuid4().hex[:8]}{extension}"
    carpeta = CARPETA_UPLOADS / "certificados"
    os.makedirs(carpeta, exist_ok=True)
    (carpeta / nombre_archivo).write_bytes(contenido)

    # La ruta se guarda CON el prefijo "uploads/" y sin "/" inicial, que es lo
    # que espera el endpoint /uploads para resolverla dentro de CARPETA_UPLOADS.
    ruta_relativa = f"uploads/certificados/{nombre_archivo}"

    # 5. Calcular próximo vencimiento (Criterio de Aceptación)
    # Si el equipo no tiene frecuencia definida, le ponemos 365 días por defecto
    dias_frecuencia = equipo.frecuencia_calibracion_dias or 365
    fecha_vencimiento = fecha_realizacion + timedelta(days=dias_frecuencia)

    # 6. Guardar el registro en la base de datos
    nueva_calibracion = Calibracion(
        equipo_id=equipo_id,
        fecha_realizacion=fecha_realizacion,
        proximo_vencimiento=fecha_vencimiento,
        certificado_url=ruta_relativa
    )
    
    db.add(nueva_calibracion)

    # 7. Asentar la calibración sobre el plan de calibración activo del equipo.
    #    Avanza la última intervención (solo planes de calibración, nunca de
    #    mantenimiento) usando la fecha de realización; las fechas viejas no
    #    atrasan el plan.
    asentar_ultima_intervencion_por_calibracion(db, equipo_id, fecha_realizacion)

    db.commit()
    db.refresh(nueva_calibracion)

    return nueva_calibracion


@router.get(
    "/{equipo_id}/calibraciones",
    response_model=list[schemas.CalibracionResponse],
    dependencies=[Depends(require_operador)]
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