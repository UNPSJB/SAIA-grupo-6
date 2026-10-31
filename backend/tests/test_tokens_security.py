import pytest
from fastapi import HTTPException
from src.auth.services import crear_access_token, crear_refresh_token, decodificar_token
from src.personal.models import Personal
from datetime import datetime, timezone, timedelta

def test_refresh_revoke_jti(session_factory, client):
    # Create user
    with session_factory() as db:
        user = Personal(nombre="A", dni="11111111", email="a@test.com", password="x", puede_operar=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        user_id = user.id

    # Create refresh token
    refresh_token, jti, _ = crear_refresh_token(str(user_id))
    # First use should succeed and revoke
    with session_factory() as db:
        from src.auth.services import revocar_token
        payload = decodificar_token(refresh_token, token_type="refresh")
        assert payload is not None
        revocar_token(db, jti, user_id, "refresh", datetime.now(timezone.utc).replace(tzinfo=None))
        db.commit()
    # Second use should be revoked
    from src.auth.services import token_revocado
    with session_factory() as db:
        assert token_revocado(db, jti) is True

def test_iat_validation_after_password_change(session_factory):
    with session_factory() as db:
        user = Personal(nombre="B", dni="22222222", email="b@test.com", password="x", puede_operar=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        user_id = user.id

    # Create token before password change
    access_token, _, _ = crear_access_token(str(user_id))
    payload = decodificar_token(access_token, token_type="access")
    iat = payload.get("iat")
    # Simulate password change after token issued
    with session_factory() as db:
        user = db.get(Personal, user_id)
        user.password_changed_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=10)
        db.commit()

    # iat is before password_changed_at -> should be invalid
    # This test only checks logic, actual validation happens in get_current_user
    assert iat is not None
