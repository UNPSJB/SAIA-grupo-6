from typing import Optional

from fastapi import UploadFile
from sqlalchemy.orm import Session

from src.common.archivos import guardar_archivo
from src.common.persistence import guardar
from src.pyme.models import ConfiguracionPyme

ID_CONFIGURACION_UNICA = 1

LOGO_EXTENSIONES = {".png", ".jpg", ".jpeg", ".webp"}
LOGO_TAMANO_MAXIMO = 2 * 1024 * 1024
CARPETA_LOGO = "pyme"


def obtener_configuracion(db: Session) -> Optional[ConfiguracionPyme]:
    """Devuelve la configuración única, o `None` si todavía no se cargó."""
    return db.get(ConfiguracionPyme, ID_CONFIGURACION_UNICA)


def obtener_o_crear(db: Session) -> ConfiguracionPyme:
    """Devuelve la fila única, creándola vacía si es la primera vez."""
    configuracion = obtener_configuracion(db)
    if configuracion is None:
        configuracion = ConfiguracionPyme(id=ID_CONFIGURACION_UNICA)
        db.add(configuracion)
        db.flush()
    return configuracion


def actualizar_configuracion(db: Session, cambios: dict) -> ConfiguracionPyme:
    configuracion = obtener_o_crear(db)
    for clave, valor in cambios.items():
        setattr(configuracion, clave, valor)
    return guardar(db, configuracion)


def guardar_logo(db: Session, archivo: UploadFile) -> ConfiguracionPyme:
    ruta = guardar_archivo(
        archivo,
        LOGO_EXTENSIONES,
        LOGO_TAMANO_MAXIMO,
        prefijo="logo",
        subcarpeta=CARPETA_LOGO,
    )
    configuracion = obtener_o_crear(db)
    configuracion.logo_url = ruta
    return guardar(db, configuracion)


def eliminar_logo(db: Session) -> ConfiguracionPyme:
    configuracion = obtener_o_crear(db)
    configuracion.logo_url = None
    return guardar(db, configuracion)
