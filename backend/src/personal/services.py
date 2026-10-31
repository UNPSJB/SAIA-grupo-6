import hmac
import logging
import secrets
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from src.common.listados import ColumnaOrden, filtro_busqueda, paginar_consulta
from src.common.texto import sin_tildes
from src.common.persistence import aplicar_cambios
from src.personal.models import Personal
from src.personal import schemas, exceptions
from src.common.persistence import es_violacion_nulo, es_violacion_unica
from src.exceptions import ConflictoRegistroInactivo
from src.auth.services import hashear_password, verificar_password, es_hash_bcrypt

logger = logging.getLogger(__name__)

# Hash bcrypt válido generado una sola vez para igualar tiempos cuando el DNI no existe
_DUMMY_PASSWORD_HASH = hashear_password("dummy-password")

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

    from datetime import datetime, timezone
    now_utc_naive = datetime.now(timezone.utc).replace(tzinfo=None)

    datos_persona = persona.model_dump(exclude={"password"})
    password_temporal = None
    if not persona.password:
        password_temporal = secrets.token_urlsafe(9)
        password_plain = password_temporal
    else:
        password_plain = persona.password

    datos_persona["password"] = hashear_password(password_plain)
    datos_persona["debe_cambiar_password"] = password_temporal is not None
    datos_persona["password_changed_at"] = now_utc_naive
    _persona = Personal(**datos_persona)
    # Exponer la contraseña temporal una sola vez en la respuesta
    _persona.password_temporal = password_temporal
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


def _mapear_conflicto_persona(mensaje: str) -> Exception:
    """Traduce un IntegrityError del PUT a la excepción de negocio.

    Mismas reglas que tenía el update() de Core: el mensaje del driver
    distingue si el valor duplicado es el DNI o el email.
    """
    if "dni" in mensaje:
        return exceptions.DniDuplicado()
    if "email" in mensaje:
        return exceptions.EmailDuplicado()
    return exceptions.DatoDuplicado()


def modificar_persona(
    db: Session,
    persona_id: int,
    persona: schemas.PersonaUpdate
) -> Personal:

    db_persona = leer_persona(db, persona_id)

    # Solo actualizamos los campos que realmente fueron enviados.
    datos_a_actualizar = persona.model_dump(exclude_unset=True)

    for campo in ("password", "puede_operar", "puede_administrar", "es_super_admin", "activo", "nombre", "dni", "email"):
        if campo in datos_a_actualizar and datos_a_actualizar[campo] is None:
            del datos_a_actualizar[campo]

    if "password" in datos_a_actualizar and datos_a_actualizar["password"]:
        from datetime import datetime, timezone
        datos_a_actualizar["password"] = hashear_password(datos_a_actualizar["password"])
        datos_a_actualizar["password_changed_at"] = datetime.now(timezone.utc).replace(tzinfo=None)

    if not datos_a_actualizar:
        return db_persona

    # Asignación por ORM y no un UPDATE de Core: los UPDATE de Core no
    # disparan eventos del ORM, así que la auditoría no vería el cambio.
    resultante = {
    campo: datos_a_actualizar.get(campo, getattr(db_persona, campo))
        for campo in ("puede_operar", "puede_administrar", "es_super_admin")
    }
    if not any(resultante.values()):
        raise exceptions.DatoInvalido()

    return aplicar_cambios(db, db_persona, datos_a_actualizar, _mapear_conflicto_persona)


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
    
    # Para timing equality, verificamos contra un hash dummy si no existe
    if not persona:
        # Ejecutar verificación contra hash dummy para igualar tiempo
        verificar_password(password, _DUMMY_PASSWORD_HASH)
        raise HTTPException(
            status_code=401,
            detail="DNI o contraseña incorrectos."
        )
    
    # 3. Si el DNI existe, verificar contraseña
    password_ok = verificar_password(password, persona.password)

    # Migración suave: contraseñas viejas guardadas en texto plano se aceptan
    # una vez y se reemplazan por su hash.
    if (
        not password_ok
        and persona.password
        and not es_hash_bcrypt(persona.password)
        and hmac.compare_digest(persona.password.encode(), password.encode())
    ):
        db.info["usuario_id"] = persona.id
        persona.password = hashear_password(password)
        db.commit()
        db.refresh(persona)
        password_ok = True

    if not password_ok:
        raise HTTPException(
            status_code=401,
            detail="DNI o contraseña incorrectos."
        )
    
    # 4. Si la contraseña es correcta, revisamos si está dado de baja
    if not persona.activo:
        raise HTTPException(
            status_code=403, 
            detail="Este usuario se encuentra dado de baja. Comunicate con un administrador para reactivarlo."
        )

    
    
    # 5. Si pasó todos los filtros, lo dejamos entrar
    return persona
