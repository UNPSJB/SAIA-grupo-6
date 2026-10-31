import logging
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from src.common.listados import ColumnaOrden, filtro_busqueda, paginar_consulta
from src.common.texto import sin_tildes
from src.personal.models import Personal
from src.personal import schemas, exceptions
from src.common.persistence import es_violacion_nulo, es_violacion_unica
from src.exceptions import ConflictoRegistroInactivo
from src.auth.services import hashear_password, verificar_password, es_hash_bcrypt

logger = logging.getLogger(__name__)

# Claves del query string -> expresión de orden. La columna "Nombre" de la
# tabla muestra nombre y apellido juntos, así que ordena por ambos.
_ORDENES = {
    "nombre_asc": ColumnaOrden(
        (sin_tildes(Personal.nombre), sin_tildes(Personal.apellido)),
        nulos_al_final=True,
    ),
    "nombre_desc": ColumnaOrden(
        (sin_tildes(Personal.nombre), sin_tildes(Personal.apellido)),
        descendente=True,
        nulos_al_final=True,
    ),
    "dni_asc": ColumnaOrden((Personal.dni,)),
    "dni_desc": ColumnaOrden((Personal.dni,), descendente=True),
}

# Filtro por rol. Son excluyentes: "administrador" no incluye a los super
# admin y "operador" no incluye a quien además administra.
_ROLES = {
    "super_admin": Personal.es_super_admin.is_(True),
    "administrador": Personal.es_super_admin.is_(False)
    & Personal.puede_administrar.is_(True),
    "operador": Personal.es_super_admin.is_(False)
    & Personal.puede_administrar.is_(False)
    & Personal.puede_operar.is_(True),
}

# ==========================================
# OPERACIONES CRUD PARA PERSONAL
# ==========================================


def _verificar_disponibilidad(db: Session, campo: str, valor: str) -> None:
    """
    Chequea si `valor` (dni o email) ya está en uso, solo para el ALTA.

    - Si pertenece a alguien ACTIVO -> error de negocio normal.
    - Si pertenece a alguien INACTIVO -> conflicto para ofrecer reactivación.
    - Si no existe -> el valor está disponible.
    """
    columna = getattr(Personal, campo)
    existente = db.scalar(select(Personal).where(columna == valor))

    if existente is None:
        return

    if existente.activo:
        if campo == "dni":
            raise exceptions.DniDuplicado()
        raise exceptions.EmailDuplicado()

    nombre_completo = f"{existente.nombre} {existente.apellido or ''}".strip()

    raise ConflictoRegistroInactivo(
        mensaje=(
            f"Ya existe una persona dada de baja con este {campo.upper()} "
            f"({nombre_completo}). ¿Querés reactivarla con estos datos?"
        ),
        entidad_id=existente.id,
        campo=campo,
    )


def crear_persona(
    db: Session,
    persona: schemas.PersonaCreate
) -> Personal:

    # Verificamos previamente si DNI/email ya están utilizados.
    _verificar_disponibilidad(db, "dni", persona.dni)
    _verificar_disponibilidad(db, "email", persona.email)

    datos_persona = persona.model_dump()
    # Contraseña inicial: la que vino explícita o, por defecto, el DNI.
    # Nadie elige la contraseña de otra persona: se cambia desde "Mi perfil".
    datos_persona["password"] = hashear_password(datos_persona["password"] or persona.dni)
    _persona = Personal(**datos_persona)
    db.add(_persona)

    try:
        db.commit()
        db.refresh(_persona)
        return _persona

    except IntegrityError as e:
        db.rollback()

        # Dejamos este manejo como respaldo por si la BD
        # detecta una restricción de integridad que no verificamos antes.
        # Ojo: el substring match anterior era tan laxo que un
        # "NOT NULL constraint failed: personal.dni" se le reportaba al
        # usuario como "ese DNI ya está registrado". Solo una violación
        # UNIQUE es un duplicado; el resto se propaga como error real.
        mensaje_error = str(e.orig).lower()

        if es_violacion_nulo(mensaje_error):
            raise exceptions.DatoInvalido()

        if not es_violacion_unica(mensaje_error):
            raise

        if "dni" in mensaje_error:
            raise exceptions.DniDuplicado()

        if "email" in mensaje_error:
            raise exceptions.EmailDuplicado()

        raise exceptions.DatoDuplicado()


def _consulta_personas(
    incluir_inactivos: bool,
    buscar: Optional[str],
    rol: Optional[str],
):
    """Consulta base compartida por el listado completo y el paginado."""
    consulta = select(Personal)

    filtros = [
        filtro
        for filtro in (
            filtro_busqueda(
                (
                    Personal.nombre,
                    Personal.apellido,
                    Personal.dni,
                    Personal.email,
                ),
                buscar,
            ),
            _ROLES.get(rol) if rol else None,
        )
        if filtro is not None
    ]
    if filtros:
        consulta = consulta.where(*filtros)

    if not incluir_inactivos:
        consulta = consulta.where(Personal.activo.is_(True))

    return consulta


def listar_personas(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
    rol: Optional[str] = None,
) -> List[Personal]:

    logger.info(
        "Listando personal desde services (incluir_inactivos=%s)",
        incluir_inactivos
    )

    consulta = _consulta_personas(incluir_inactivos, buscar, rol).order_by(
        Personal.id
    )
    return list(db.scalars(consulta).all())


def listar_personas_paginado(
    db: Session,
    incluir_inactivos: bool,
    page: int,
    page_size: int,
    buscar: Optional[str] = None,
    rol: Optional[str] = None,
    orden: str = "nombre_asc",
) -> tuple[List[Personal], int]:
    """Mismo filtro que `listar_personas`, recortado en la base: página + total.

    `paginar_consulta` agrega el desempate por `id`: sin un orden
    determinista, OFFSET/LIMIT puede repetir u omitir filas entre páginas.
    """
    logger.info(
        "Listando personal paginado desde services (incluir_inactivos=%s, page=%s)",
        incluir_inactivos,
        page,
    )

    return paginar_consulta(
        db,
        _consulta_personas(incluir_inactivos, buscar, rol),
        modelo=Personal,
        orden=orden,
        ordenes=_ORDENES,
        por_defecto="nombre_asc",
        page=page,
        page_size=page_size,
    )


def leer_persona(
    db: Session,
    persona_id: int
) -> Personal:

    db_persona = db.scalar(
        select(Personal).where(Personal.id == persona_id)
    )

    if db_persona is None:
        raise exceptions.PersonaNoEncontrada()

    return db_persona


def modificar_persona(
    db: Session,
    persona_id: int,
    persona: schemas.PersonaUpdate
) -> Personal:

    db_persona = leer_persona(db, persona_id)

    # Solo actualizamos los campos que realmente fueron enviados.
    datos_a_actualizar = persona.model_dump(exclude_unset=True)

    if "password" in datos_a_actualizar and datos_a_actualizar["password"]:
        datos_a_actualizar["password"] = hashear_password(datos_a_actualizar["password"])

    if datos_a_actualizar:
        try:
            db.execute(
                update(Personal)
                .where(Personal.id == persona_id)
                .values(**datos_a_actualizar)
            )

            db.commit()
            db.refresh(db_persona)

        except IntegrityError as e:
            db.rollback()

            mensaje_error = str(e.orig).lower()

            if "dni" in mensaje_error:
                raise exceptions.DniDuplicado()

            elif "email" in mensaje_error:
                raise exceptions.EmailDuplicado()

            else:
                raise exceptions.DatoDuplicado()

    return db_persona


def eliminar_persona(
    db: Session,
    persona_id: int
) -> Personal:

    db_persona = leer_persona(db, persona_id)

    # BAJA LÓGICA
    db_persona.activo = False

    db.commit()
    db.refresh(db_persona)

    return db_persona

def autenticar_persona(db: Session, dni: str, password: str):
    # 1. Buscamos a la persona SOLO por su DNI
    persona = db.scalar(
        select(Personal).where(Personal.dni == dni)
    )
    
    # 2. Si no encontramos a nadie con ese DNI, tiramos el error específico
    if not persona:
        raise HTTPException(
            status_code=404, 
            detail="El DNI ingresado no está registrado en el sistema."
        )
    
    # 3. Si el DNI existe, pero la contraseña está mal
    password_ok = verificar_password(password, persona.password)

    # Migración suave: contraseñas viejas guardadas en texto plano se aceptan
    # una vez y se reemplazan por su hash.
    if not password_ok and not es_hash_bcrypt(persona.password) and persona.password == password:
        persona.password = hashear_password(password)
        db.commit()
        db.refresh(persona)
        password_ok = True

    if not password_ok:
        raise HTTPException(
            status_code=401,
            detail="La contraseña es incorrecta."
        )
    
    # 4. Si la contraseña es correcta, revisamos si está dado de baja
    if not persona.activo:
        raise HTTPException(
            status_code=403, 
            detail="Este usuario se encuentra dado de baja. Comunicate con un administrador para reactivarlo."
        )
    
    # 5. Si pasó todos los filtros, lo dejamos entrar
    return persona