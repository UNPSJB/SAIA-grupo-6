import io
from fastapi import status
from datetime import date

def test_registrar_intervencion_con_certificado_valido(client, session_factory, usuarios):
    from src.Equipo.models import Equipo
    from src.sector.models import Sector
    # crear equipo
    with session_factory() as db:
        sector = Sector(nombre="SectorTest", activo=True)
        db.add(sector)
        db.commit()
        db.refresh(sector)
        equipo = Equipo(nombre="EquipoTest", tipo="Tipo", sector_id=sector.id, activo=True)
        db.add(equipo)
        db.commit()
        db.refresh(equipo)
        equipo_id = equipo.id
    file_content = b"%PDF-1.4" + b"\x00" * 1024
    files = {"certificado": ("cert.pdf", file_content, "application/pdf")}
    data = {
        "fecha_realizacion": str(date.today()),
        "tipo": "calibracion",
    }
    resp = client.post(f"/equipos/{equipo_id}/calibraciones", data=data, files=files, headers=usuarios["operador"])
    assert resp.status_code == status.HTTP_201_CREATED
    json_resp = resp.json()
    assert json_resp.get("certificado_url") is not None
    assert json_resp["certificado_url"].startswith("uploads/certificados/")

def test_registrar_intervencion_extension_invalida(client, session_factory, usuarios):
    from src.Equipo.models import Equipo
    from src.sector.models import Sector
    with session_factory() as db:
        sector = Sector(nombre="SectorTest2", activo=True)
        db.add(sector)
        db.commit()
        db.refresh(sector)
        equipo = Equipo(nombre="EquipoTest2", tipo="Tipo", sector_id=sector.id, activo=True)
        db.add(equipo)
        db.commit()
        db.refresh(equipo)
        equipo_id = equipo.id
    file_content = b"hola"
    files = {"certificado": ("mal.exe", file_content, "application/octet-stream")}
    data = {
        "fecha_realizacion": str(date.today()),
        "tipo": "calibracion",
    }
    resp = client.post(f"/equipos/{equipo_id}/calibraciones", data=data, files=files, headers=usuarios["operador"])
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    # mensaje de formato
    assert "Formato" in resp.json()["detail"] or "archivo adjunto" in resp.json()["detail"]
