from datetime import date
from pydantic import BaseModel


class VencimientoConsolidadoResponse(BaseModel):
    id_vencimiento: str
    tipo: str  # PERSONAL | CALIBRACION | MANTENIMIENTO
    entidad_id: int
    sujeto_id: int
    detalle: str  # qué vence: la aptitud, o "Calibración" / "Mantenimiento"
    sujeto: str  # de quién o de qué: la persona o el equipo
    fecha_vencimiento: date
    dias_restantes: int  # negativo = ya venció
    estado: str  # VENCIDO | PROXIMO | VIGENTE
    link_destino: str