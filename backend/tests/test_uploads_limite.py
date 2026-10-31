"""Tests del límite real de tamaño de subida (problema 9).

El middleware ASGI rechaza con 413 cuando el `Content-Length` supera el
máximo y corta el stream si el cliente no lo envía o miente.
"""

from fastapi import FastAPI, Request
from starlette.testclient import TestClient

from src.common.archivos import LimiteTamanoSubidaMiddleware


def _app_con_limite(limite_bytes: int = 100) -> FastAPI:
    app = FastAPI()
    app.add_middleware(LimiteTamanoSubidaMiddleware, limite_bytes=limite_bytes)

    @app.post("/subir")
    async def subir(request: Request):
        await request.body()
        return {"ok": True}

    return app


def test_subida_bajo_limite_pasa():
    app = _app_con_limite(limite_bytes=100)
    client = TestClient(app)
    resp = client.post("/subir", content=b"x" * 50, headers={"Content-Length": "50"})
    assert resp.status_code == 200, resp.text


def test_subida_sobre_limite_recibe_413():
    app = _app_con_limite(limite_bytes=100)
    client = TestClient(app)
    resp = client.post(
        "/subir",
        content=b"x" * 200,
        headers={"Content-Length": "200"},
    )
    assert resp.status_code == 413, resp.text
    assert "máximo" in resp.text.lower()


def test_sin_content_length_y_body_grande_recibe_413():
    """El cliente no envía Content-Length: el stream se lee y se corta."""
    app = _app_con_limite(limite_bytes=100)
    client = TestClient(app)
    resp = client.post("/subir", content=b"x" * 200)
    assert resp.status_code == 413, resp.text


def test_content_length_falso_no_evade():
    """Content-Length pequeño pero cuerpo real grande: no evade el control."""
    app = _app_con_limite(limite_bytes=100)
    client = TestClient(app)
    resp = client.post(
        "/subir",
        content=b"x" * 300,
        headers={"Content-Length": "10"},
    )
    assert resp.status_code == 413, resp.text
