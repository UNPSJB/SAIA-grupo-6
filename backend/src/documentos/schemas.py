from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from src.documentos.constants import EstadoVersion, TipoDocumento


class AutorResponse(BaseModel):
    id: int
    nombre: str
    apellido: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VersionDocumento(BaseModel):
    id: int
    numero_version: int
    nombre_archivo: str
    archivo_url: str
    estado: EstadoVersion
    vigente_desde: datetime
    vigente_hasta: Optional[datetime] = None
    fecha_subida: datetime
    autor: AutorResponse

    model_config = ConfigDict(from_attributes=True)


class Documento(BaseModel):
    """Vista de GESTIÓN (administrador): la vigente + un resumen. No lista las archivadas."""

    id: int
    nombre: str
    tipo: TipoDocumento
    fecha_creacion: datetime
    version_vigente: Optional[VersionDocumento] = None
    cantidad_archivadas: int
    proximo_numero_version: int

    model_config = ConfigDict(from_attributes=True)


class DocumentoVigente(BaseModel):
    """Vista de CONSULTA (historia 3): solo la versión vigente."""

    id: int
    nombre: str
    tipo: TipoDocumento
    version_vigente: VersionDocumento

    model_config = ConfigDict(from_attributes=True)


class HistorialDocumento(BaseModel):
    """Vista de HISTORIAL (historia 4): todas las versiones, de la más nueva a la más vieja."""

    id: int
    nombre: str
    tipo: TipoDocumento
    versiones: list[VersionDocumento]

    model_config = ConfigDict(from_attributes=True)