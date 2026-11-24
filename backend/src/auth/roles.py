"""Reglas de la jerarquía de roles.

Jerarquía (de mayor a menor):
    super admin  -> de la empresa, sin sede propia: edita a cualquiera
    gerente      -> administra SU sede: edita a admins y operadores de ella
    admin        -> edita a operadores y a sí mismo
    operador     -> solo se edita a sí mismo

Cada usuario tiene como mínimo `puede_operar` y `puede_administrar`. El
gerente además lleva `es_gerente` (y siempre `puede_administrar`, así todo
chequeo de "administra" lo incluye); el flag `es_super_admin` suma el nivel
superior.
"""

from fastapi import HTTPException, status

from src.personal.models import Personal


def es_super_admin(usuario: Personal) -> bool:
    return bool(usuario.es_super_admin)


def es_gerente(usuario: Personal) -> bool:
    return bool(usuario.es_gerente)


def _nivel(usuario: Personal) -> int:
    """3 super admin, 2 gerente, 1 admin, 0 operador."""
    if usuario.es_super_admin:
        return 3
    if usuario.es_gerente:
        return 2
    if usuario.puede_administrar:
        return 1
    return 0


def puede_operar(usuario: Personal) -> bool:
    return bool(usuario.puede_operar or usuario.puede_administrar or usuario.es_super_admin)


def puede_administrar(usuario: Personal) -> bool:
    return bool(usuario.puede_administrar or usuario.es_gerente or usuario.es_super_admin)


def puede_editar_a(actor: Personal, objetivo: Personal) -> bool:
    """True si `actor` puede modificar los datos de `objetivo`."""
    if actor.id == objetivo.id:
        return True

    if es_super_admin(actor):
        return True

    if not puede_administrar(actor):
        return False

    # Gerente y admin trabajan dentro de su sede: nunca sobre otra.
    if actor.establecimiento_id != objetivo.establecimiento_id:
        return False

    # Cada uno toca solo a quien está por debajo: el gerente a admins y
    # operadores, el admin a operadores.
    return _nivel(objetivo) < _nivel(actor)


def puede_modificar_roles(actor: Personal, objetivo: Personal) -> bool:
    if not puede_administrar(actor):
        return False

    # Nadie se concede ni se quita capacidades a sí mismo.
    if actor.id == objetivo.id:
        return False

    if not puede_editar_a(actor, objetivo):
        return False

    if objetivo.es_super_admin and not es_super_admin(actor):
        return False

    return True


def puede_cambiar_rol(actor: Personal, campo: str) -> bool:
    """Qué flags puede conceder o quitar cada nivel.

    super admin y gerente solo los toca el super admin; administrar, quien
    está por encima de un admin (gerente o super admin).
    """
    if campo in ("es_super_admin", "es_gerente"):
        return es_super_admin(actor)
    if campo == "puede_administrar":
        return _nivel(actor) >= 2
    return puede_administrar(actor)


def puede_asignar_roles(
    actor: Personal,
    *,
    es_super_admin_flag: bool = False,
    es_gerente_flag: bool = False,
    puede_administrar_flag: bool = False,
) -> bool:
    """True si `actor` puede crear a una persona con los roles indicados.

    Misma jerarquía que el PUT (`puede_cambiar_rol`): un admin común solo da
    de alta operadores, el gerente también admins, y solo el super admin crea
    gerentes y otros super admins.
    """
    if not puede_administrar(actor):
        return False

    pedidos = {
        "es_super_admin": es_super_admin_flag,
        "es_gerente": es_gerente_flag,
        "puede_administrar": puede_administrar_flag,
    }
    return all(puede_cambiar_rol(actor, campo) for campo, pedido in pedidos.items() if pedido)


def exigir_permiso(condicion: bool, mensaje: str) -> None:
    if not condicion:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=mensaje)


def exige_permiso_para_editar(condicion: bool, mensaje: str) -> None:
    """Alias con nombre de dominio para que los routers lean mejor."""
    exigir_permiso(condicion, mensaje)