import io
from fastapi import status

def test_marcar_tarea_con_evidencia_valida(client, session_factory, usuarios):
    from src.tareas.models import Tarea
    from src.PlanLimpieza.models import PlanLimpieza
    from src.Equipo.models import Equipo
    from src.sector.models import Sector
    with session_factory() as db:
        sector = Sector(nombre="SectorC", activo=True)
        db.add(sector)
        db.flush()
        equipo = Equipo(nombre="EqC", tipo="Tipo", sector_id=sector.id, activo=True)
        db.add(equipo)
        db.flush()
        plan = PlanLimpieza(nombre="PlanC", activo=True, equipo_id=equipo.id, autor_id=usuarios["admin_id"])
        db.add(plan)
        db.flush()
        tarea = Tarea(nombre="TareaC", plan_limpieza_id=plan.id, frecuencia=1, activo=True)
        db.add(tarea)
        db.commit()
        tarea_id = tarea.id
    # Crear evidencia válida
    file_content = b"\xff\xd8\xff\xe0" + b"\x00" * 1024  # pequeño jpg
    files = {"evidencia": ("foto.jpg", file_content, "image/jpeg")}
    form = {
        "completado": "true",
    }
    resp = client.patch(f"/checklist/tarea/{tarea_id}", data=form, files=files, headers=usuarios["operador"])
    assert resp.status_code == status.HTTP_200_OK
    # Verifica que el registro tenga evidencia_url
    json_resp = resp.json()
    assert json_resp.get("evidencia_url") is not None
    assert json_resp["evidencia_url"].startswith("uploads/evidencias/")

def test_marcar_tarea_extension_invalida(client, session_factory, usuarios):
    from src.tareas.models import Tarea
    from src.PlanLimpieza.models import PlanLimpieza
    from src.Equipo.models import Equipo
    from src.sector.models import Sector
    with session_factory() as db:
        sector = Sector(nombre="SectorC2", activo=True)
        db.add(sector)
        db.flush()
        equipo = Equipo(nombre="EqC2", tipo="Tipo", sector_id=sector.id, activo=True)
        db.add(equipo)
        db.flush()
        plan = PlanLimpieza(nombre="PlanC2", activo=True, equipo_id=equipo.id, autor_id=usuarios["admin_id"])
        db.add(plan)
        db.flush()
        tarea = Tarea(nombre="TareaC2", plan_limpieza_id=plan.id, frecuencia=1, activo=True)
        db.add(tarea)
        db.commit()
        tarea_id = tarea.id
    file_content = b"hola"
    files = {"evidencia": ("archivo.txt", file_content, "text/plain")}
    form = {"completado": "true"}
    resp = client.patch(f"/checklist/tarea/{tarea_id}", data=form, files=files, headers=usuarios["operador"])
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "Formato de imagen no permitido" in resp.json()["detail"]
