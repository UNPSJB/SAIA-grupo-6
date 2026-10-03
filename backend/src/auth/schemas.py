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