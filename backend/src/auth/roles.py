"""Reglas de permisos.

Jerarquía:
    admin    -> edita a operadores y a sí mismo
    operador -> solo se edita a sí mismo
"""

from fastapi import HTTPException, status

from src.personal.models import Personal


def puede_operar(usuario: Personal) -> bool:
    return bool(usuario.puede_operar or usuario.puede_administrar)


def puede_administrar(usuario: Personal) -> bool:
    return bool(usuario.puede_administrar)


def nivel_de(usuario: Personal) -> str:
    if usuario.puede_administrar:
        return "admin"
    return "operador"


def puede_editar_a(actor: Personal, objetivo: Personal) -> bool:
    """True si `actor` puede modificar los datos de `objetivo`."""
    if actor.id == objetivo.id:
        return True

    if actor.puede_administrar:
        # Un admin solo toca a operadores: nada de tocar a otro admin.
        return not objetivo.puede_administrar

    return False


def puede_modificar_roles(actor: Personal, objetivo: Personal) -> bool:
    """True si `actor` puede cambiar capacidades o el estado de una persona.

    Hace falta tener poder de administración: editar tu propio perfil no te
    permite darte permisos (ni quitarte) a vos mismo.
    """
    if not puede_administrar(actor):
        return False

    return puede_editar_a(actor, objetivo)


def exigir_permiso(condicion: bool, mensaje: str) -> None:
    if not condicion:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=mensaje)


def exige_permiso_para_editar(condicion: bool, mensaje: str) -> None:
    """Alias con nombre de dominio para que los routers lean mejor."""
    exigir_permiso(condicion, mensaje)