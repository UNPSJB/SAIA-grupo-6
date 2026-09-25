from sqlalchemy import select
from sqlalchemy.orm import Session
from datetime import date

from src.exceptions import ConflictoRegistroInactivo
from .exceptions import ElementoLimpiezaNoEncontrado, ElementoLimpiezaYaExiste
from .models import ElementoLimpieza
from .schemas import ElementoLimpiezaCreate, ElementoLimpiezaUpdate

def crear_elemento_limpieza(db: Session, datos: ElementoLimpiezaCreate) -> ElementoLimpieza:

  consulta_existente = select(ElementoLimpieza).where( ElementoLimpieza.nombre.ilike(datos.nombre.strip()))
  existente = db.scalars(consulta_existente).first()

  if existente:
    if existente.activo: 
      raise ElementoLimpiezaYaExiste()
    
    raise ConflictoRegistroInactivo( 
       mensaje=f"El elemento de limpieza '{existente.nombre}' ya existe pero está dado de baja. ¿Querés reactivarlo con estos nuevos datos?", 
       entidad_id=existente.id, 
       campo="nombre" 
    )
  
  nuevo_elementoLimpieza = datos.model_dump()

  # Si no se envía fecha de último recambio, se establece la fecha actual por defecto
  if nuevo_elementoLimpieza.get("fecha_ultimo_recambio") is None:
    nuevo_elementoLimpieza["fecha_ultimo_recambio"] = date.today()

  
  instancia = ElementoLimpieza(**nuevo_elementoLimpieza) 
  db.add(instancia) 
  db.commit() 
  db.refresh(instancia) 
  return instancia


def listar_elementos_limpieza( db: Session, incluir_inactivos: bool = False) -> list[ElementoLimpieza]:
  consulta = select(ElementoLimpieza).order_by(ElementoLimpieza.id)
  if not incluir_inactivos:
    consulta = consulta.where(ElementoLimpieza.activo.is_(True))
  return list(db.scalars(consulta).all())


def obtener_elemento_limpieza(db: Session, elemento_id: int) -> ElementoLimpieza:
  elemento: ElementoLimpieza = db.get(ElementoLimpieza, elemento_id)

  if elemento is None:
    raise ElementoLimpiezaNoEncontrado(elemento_id)

  return elemento

def actualizar_elemento_limpieza(db: Session, elemento_id: int, datos: ElementoLimpiezaUpdate) -> ElementoLimpieza:
    elemento = obtener_elemento_limpieza(db, elemento_id)

    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)

    # Validar si el nombre está ocupado
    if "nombre" in cambios: 
      existente = db.scalar( 
        select(ElementoLimpieza).where( 
          ElementoLimpieza.nombre.ilike(cambios["nombre"].strip()), 
          ElementoLimpieza.id != elemento_id ) ) 
      if existente: 
        raise ElementoLimpiezaYaExiste()

    for atributo, valor in cambios.items():
        setattr(elemento, atributo, valor)

    db.commit()
    db.refresh(elemento)

    return elemento
  


def dar_de_baja_elemento_limpieza(db: Session, elemento_id: int) -> ElementoLimpieza:
  elemento = obtener_elemento_limpieza(db, elemento_id)

  elemento.activo = False

  db.commit()
  db.refresh(elemento)

  return elemento


# Función adicional específica para el reset de alerta del elemento de limpieza
def registrar_recambio_elemento( db: Session, elemento_id: int) -> ElementoLimpieza:
  elemento = obtener_elemento_limpieza(db, elemento_id)

  elemento.fecha_ultimo_recambio = date.today()

  db.commit()
  db.refresh(elemento)

  return elemento
