from typing import Optional

from pydantic import BaseModel

from src.personal.schemas import Persona


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Persona


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str
    # Opcional: si no se envía, se usa el del header Authorization.
    access_token: Optional[str] = None


class BootstrapStatus(BaseModel):
    """Estado de instalación, para la pantalla de registro.

    `permite_super_admin` es True únicamente cuando el sistema todavía no tiene
    ningún administrador: es el único caso en que un usuario puede crearse a sí
    mismo como super admin. Con cualquier administrador en la base, el registro
    queda limitado a capacidades y el rol se concede desde "Personal".
    """

    hay_personas: bool
    hay_administradores: bool
    permite_super_admin: bool