import pytest
from fastapi import status

def test_uploads_header_nosniff(client, usuarios):
    # Create a dummy file
    import os
    from src.config import CARPETA_UPLOADS
    test_path = CARPETA_UPLOADS / "evidencias" / "test.txt"
    test_path.parent.mkdir(parents=True, exist_ok=True)
    test_path.write_text("hola")
    try:
        resp = client.get("/uploads/evidencias/test.txt", headers=usuarios["operador"])
        assert resp.status_code == 200
        assert resp.headers.get("x-content-type-options") == "nosniff"
    finally:
        if test_path.exists():
            test_path.unlink()

def test_uploads_documentos_requires_operador(client, session_factory):
    from datetime import datetime
    from src.personal.models import Personal
    from src.auth.services import crear_access_token
    from src.documentos.constants import TipoDocumento
    from src.documentos.models import Documento, VersionDocumento

    # El archivo debe corresponder a una versión conocida para llegar a la
    # comprobación de permisos (y no terminar antes con 404).
    with session_factory() as db:
        user = Personal(nombre="SinOp", dni="99999999", email="sinop@test.com", password="x", puede_operar=False, puede_administrar=False)
        db.add(user)
        db.flush()
        documento = Documento(nombre="Documento de prueba", tipo=TipoDocumento.MANUAL_BPM.value)
        documento.versiones.append(VersionDocumento(
            numero_version=1,
            nombre_archivo="archivo.pdf",
            archivo_url="uploads/documentos/archivo.pdf",
            vigente=True,
            vigente_desde=datetime.utcnow(),
            fecha_subida=datetime.utcnow(),
            autor_id=user.id,
        ))
        db.add(documento)
        db.commit()
        db.refresh(user)
        token, _, _ = crear_access_token(str(user.id))
        headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/uploads/documentos/archivo.pdf", headers=headers)
    assert resp.status_code == 403
