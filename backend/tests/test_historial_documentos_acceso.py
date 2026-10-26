"""Regresión del control de acceso de GET /documentos/{id}/historial.

Antes del fix, la ruta solo exigía `require_operador` y la verificación de
administrador se hacía contra `usuario_id`, un QUERY PARAM controlado por el
cliente: cualquier operador que pasara el id de un administrador obtenía el
historial completo de versiones de cualquier documento (incluidas las
`archivo_url` de versiones archivadas).

Ahora el permiso se verifica contra el usuario del TOKEN (`require_admin`),
igual que el resto de las rutas de gestión del módulo.

Cómo correrlo (desde `backend/`):

    python -m pytest tests/test_historial_documentos_acceso.py -v
"""

import pytest

from src.documentos.models import Documento, VersionDocumento


@pytest.fixture(scope="module")
def documento_id(session_factory, usuarios):
    """Un documento con una versión, y su id. Se borra al terminar."""
    with session_factory() as db:
        documento = Documento(nombre="Manual de BPM (test acceso)", tipo="manual_bpm")
        db.add(documento)
        db.commit()
        db.add(
            VersionDocumento(
                documento_id=documento.id,
                numero_version=1,
                nombre_archivo="x.pdf",
                archivo_url="uploads/documentos/x.pdf",
                autor_id=usuarios["admin_id"],
            )
        )
        db.commit()
        yield documento.id
        for version in db.query(VersionDocumento).filter_by(
            documento_id=documento.id
        ):
            db.delete(version)
        db.delete(db.get(Documento, documento.id))
        db.commit()


def test_el_admin_ve_el_historial(client, H_ADMIN, documento_id):
    respuesta = client.get(f"/documentos/{documento_id}/historial", headers=H_ADMIN)
    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["id"] == documento_id
    assert [v["numero_version"] for v in cuerpo["versiones"]] == [1]


def test_el_operador_recibe_403_ante_el_historial(client, usuarios, documento_id):
    """El historial es de administradores: un operador no puede verlo."""
    respuesta = client.get(
        f"/documentos/{documento_id}/historial", headers=usuarios["operador"]
    )
    assert respuesta.status_code == 403, respuesta.text


def test_el_operador_no_puede_spoofear_usuario_id_del_admin(
    client, usuarios, documento_id
):
    """LA regresión: pasar `?usuario_id=<id de un admin>` no autoriza a nadie.

    Ese parámetro ya ni existe en la ruta (FastAPI ignora query params no
    declarados), pero el test lo manda igual: si alguien reintroduce el
    chequeo contra un dato del cliente, acá vuelve a romper.
    """
    respuesta = client.get(
        f"/documentos/{documento_id}/historial",
        params={"usuario_id": usuarios["admin_id"]},
        headers=usuarios["operador"],
    )
    assert respuesta.status_code == 403, respuesta.text


def test_sin_sesion_da_401(client, documento_id):
    assert (
        client.get(f"/documentos/{documento_id}/historial").status_code == 401
    )
