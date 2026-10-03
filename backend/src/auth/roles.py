"""Reglas de la jerarquía de roles.

Jerarquía:
    super admin  -> edita a cualquiera
    admin        -> edita a operadores y a sí mismo
    operador     -> solo se edita a sí mismo

Cada usuario tiene como mínimo `puede_operar` y `puede_administrar`; el flag
`es_super_admin` suma el nivel superior.
"""

from fastapi import HTTPException, status

from src.personal.models import Personal


class Rol:
    OPERADOR = "operador"
    ADMIN = "admin"
    SUPER_ADMIN = "super admin"


def es_super_admin(usuario: Personal) -> bool:
    return bool(usuario.es_super_admin)


def puede_operar(usuario: Personal) -> bool:
    return bool(usuario.puede_operar or usuario.puede_administrar or usuario.es_super_admin)


def puede_administrar(usuario: Personal) -> bool:
    return bool(usuario.puede_administrar or usuario.es_super_admin)


def nivel_de(usuario: Personal) -> str:
    if usuario.es_super_admin:
        return Rol.SUPER_ADMIN
    if usuario.puede_administrar:
        return Rol.ADMIN
    return Rol.OPERADOR


def puede_editar_a(actor: Personal, objetivo: Personal) -> bool:
    """True si `actor` puede modificar los datos de `objetivo`."""
    if actor.id == objetivo.id:
        return True

    if es_super_admin(actor):
        return True

    if actor.puede_administrar:
        # Un admin solo toca a operadores: nada de tocar a otro admin ni a un
        # super admin.
        return not (objetivo.puede_administrar or objetivo.es_super_admin)

    return False


def puede_modificar_roles(actor: Personal, objetivo: Personal) -> bool:
    """True si `actor` puede cambiar capacidades o el flag de super admin.

    Hace falta tener poder de administración: editar tu propio perfil no te
    permite darte permisos (ni quite) a vos mismo.
    """
    if not puede_administrar(actor):
        return False

    if not puede_editar_a(actor, objetivo):
        return False

    # El flag de super admin solo lo mueve otro super admin.
    if objetivo.es_super_admin and not es_super_admin(actor):
        return False

    return True


def exigir_permiso(condicion: bool, mensaje: str) -> None:
    if not condicion:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=mensaje)


def exige_permiso_para_editar(condicion: bool, mensaje: str) -> None:
    """Alias con nombre de dominio para que los routers lean mejor."""
    exigir_permiso(condicion, mensaje)