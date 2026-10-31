import io
from fastapi import status

def test_crear_incidente_con_foto_valida(client, usuarios):
    file_content = b"\xff\xd8\xff\xe0" + b"\x00" * 1024
    files = {"foto": ("incidente.png", file_content, "image/png")}
    data = {
        "titulo": "Prueba",
        "descripcion": "desc",
        "tipo": "otro",
    }
    resp = client.post("/incidentes", data=data, files=files, headers=usuarios["operador"])
    assert resp.status_code == status.HTTP_200_OK
    json_resp = resp.json()
    assert json_resp.get("foto_url") is not None
    assert json_resp["foto_url"].startswith("uploads/incidentes/")

def test_crear_incidente_extension_invalida(client, usuarios):
    file_content = b"hola"
    files = {"foto": ("mal.exe", file_content, "application/octet-stream")}
    data = {
        "titulo": "Prueba",
        "descripcion": "desc",
        "tipo": "otro",
    }
    resp = client.post("/incidentes", data=data, files=files, headers=usuarios["operador"])
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "Formato de imagen no permitido" in resp.json()["detail"]
