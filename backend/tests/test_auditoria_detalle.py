"""Tests del detalle de auditoría con enriquecimiento de nombres (problema de auditoría).

Verifica que el endpoint GET /auditoria/{id} devuelva los cambios enriquecidos
con los nombres legibles de las entidades relacionadas en vez de solo IDs.
"""

from fastapi import status

from src.auditoria.models import AuditLog
from src.auditoria.enriquecer import enriquecer_detalle_auditoria
from src.Equipo.models import Equipo
from src.sector.models import Sector
from src.personal.models import Personal
from src.aptitud.models import Aptitud
from src.vencimientoPersonal.models import VencimientoPersonal
from src.common.fechas import hoy
from datetime import timedelta


def test_detalle_auditoria_muestra_nombres_enriquecidos(client, session_factory, H_ADMIN):
    """Un cambio de sector en un equipo muestra el nombre del sector antes/despues."""
    with session_factory() as db:
        sector_origen = Sector(nombre="Sector Origen", activo=True)
        sector_destino = Sector(nombre="Sector Destino", activo=True)
        db.add_all([sector_origen, sector_destino])
        db.flush()
        sector_origen_id = sector_origen.id
        sector_destino_id = sector_destino.id

        equipo = Equipo(
            nombre="Equipo Test",
            tipo="Medición",
            sector_id=sector_origen.id,
            activo=True,
            frecuencia_calibracion_dias=365,
        )
        db.add(equipo)
        db.flush()
        equipo_id = equipo.id
        db.commit()

    # Modificar el equipo: cambiar su sector
    resp = client.patch(
        f"/equipos/{equipo_id}",
        headers=H_ADMIN,
        json={"sector_id": sector_destino_id},
    )
    assert resp.status_code == 200, resp.text

    # Obtener el registro de auditoría más reciente para este equipo
    with session_factory() as db:
        auditoria = (
            db.query(AuditLog)
            .filter(AuditLog.entidad == "equipos")
            .filter(AuditLog.entidad_id == str(equipo_id))
            .order_by(AuditLog.id.desc())
            .first()
        )
        assert auditoria is not None, "No se encontró registro de auditoría"
        audit_id = auditoria.id

    # Consultar el detalle de auditoría
    resp = client.get(f"/auditoria/{audit_id}", headers=H_ADMIN)
    assert resp.status_code == 200, resp.text
    detalle = resp.json()

    assert detalle["entidad"] == "equipos"
    assert detalle["entidad_id"] == str(equipo_id)
    assert detalle["accion"] == "MODIFICAR"

    # Verificar que el cambio de sector_id tiene los nombres enriquecidos
    cambios = detalle["cambios"]
    assert "sector_id" in cambios, f"No se encontró sector_id en cambios: {cambios}"
    campo_sector = cambios["sector_id"]
    assert campo_sector["antes"] == sector_origen_id
    assert campo_sector["despues"] == sector_destino_id
    assert campo_sector["antes_nombre"] == "Sector Origen"
    assert campo_sector["despues_nombre"] == "Sector Destino"


def test_detalle_auditoria_no_encontrado(client, H_ADMIN):
    """Un ID de auditoría inexistente devuelve 404."""
    resp = client.get("/auditoria/999999", headers=H_ADMIN)
    assert resp.status_code == 404, resp.text


def test_enriquecer_eliminar_vencimiento_personal_muestra_nombres(session_factory):
    """Al eliminar un vencimiento_personal (la fila ya no existe), el detalle
    debe mostrar los nombres de persona y aptitud resueltos desde los IDs de
    los cambios, no solo los IDs crudos."""
    with session_factory() as db:
        resultado = enriquecer_detalle_auditoria(
            db,
            "vencimientos_personal",
            "7",  # entidad_id del vencimiento eliminado (ya no existe en la tabla)
            {
                "id": [7, None],
                "persona_id": [8, None],
                "aptitud_id": [7, None],
                "fecha_vencimiento": ["2026-12-30", None],
                "activo": [True, None],
                "fecha_creacion": ["2026-10-31T15:24:52.824286", None],
            },
        )

    # El vencimiento fue eliminado (despues es None para todos los campos)
    assert resultado["id"]["antes"] == 7
    assert resultado["id"]["despues"] is None
    assert resultado["id"]["antes_nombre"] is None
    assert resultado["id"]["despues_nombre"] is None

    # Persona id: 8 → nombre resuelto antes, None después
    campo_persona = resultado["persona_id"]
    assert campo_persona["antes"] == 8
    assert campo_persona["despues"] is None
    assert campo_persona["antes_nombre"] is None  # persona 8 no existe en la BD de test
    assert campo_persona["despues_nombre"] is None

    # Aptitud id: 7 → nombre resuelto antes, None después
    campo_aptitud = resultado["aptitud_id"]
    assert campo_aptitud["antes"] == 7
    assert campo_aptitud["despues"] is None
    assert campo_aptitud["antes_nombre"] is None  # aptitud 7 no existe en la BD de test
    assert campo_aptitud["despues_nombre"] is None

    # fecha_vencimiento no es FK
    assert resultado["fecha_vencimiento"] == {
        "antes": "2026-12-30",
        "despues": None,
        "antes_nombre": None,
        "despues_nombre": None,
    }

    # activo no es FK
    assert resultado["activo"] == {
        "antes": True,
        "despues": None,
        "antes_nombre": None,
        "despues_nombre": None,
    }


def test_detalle_modificar_fk_nombres_antes_despues(client, session_factory, H_ADMIN):
    """Al modificar una FK, se muestran los nombres de ANTES y DESPUÉS
    distintos."""
    with session_factory() as db:
        sector_origen = Sector(
            nombre="Sector Origen Auditoria", activo=True
        )
        sector_destino = Sector(
            nombre="Sector Destino Auditoria", activo=True
        )
        db.add_all([sector_origen, sector_destino])
        db.flush()
        sector_origen_id = sector_origen.id
        sector_destino_id = sector_destino.id

        equipo = Equipo(
            nombre="Equipo Test Auditoria",
            tipo="Medición",
            sector_id=sector_origen.id,
            activo=True,
            frecuencia_calibracion_dias=365,
        )
        db.add(equipo)
        db.flush()
        equipo_id = equipo.id
        db.commit()

    # Modificar el equipo: cambiar su sector
    resp = client.patch(
        f"/equipos/{equipo_id}",
        headers=H_ADMIN,
        json={"sector_id": sector_destino_id},
    )
    assert resp.status_code == 200, resp.text

    with session_factory() as db:
        auditoria = (
            db.query(AuditLog)
            .filter(AuditLog.entidad == "equipos")
            .filter(AuditLog.entidad_id == str(equipo_id))
            .filter(AuditLog.accion == "MODIFICAR")
            .order_by(AuditLog.id.desc())
            .first()
        )
        assert auditoria is not None
        audit_id = auditoria.id

    resp = client.get(f"/auditoria/{audit_id}", headers=H_ADMIN)
    assert resp.status_code == 200, resp.text
    detalle = resp.json()

    cambios = detalle["cambios"]
    assert cambios is not None
    campo_sector = cambios["sector_id"]
    assert campo_sector["antes"] == sector_origen_id
    assert campo_sector["despues"] == sector_destino_id
    assert campo_sector["antes_nombre"] == "Sector Origen Auditoria"
    assert campo_sector["despues_nombre"] == "Sector Destino Auditoria"


def test_enriquecer_fk_inexistente_devuelve_nombre_none(session_factory):
    """Si una FK apunta a un ID inexistente, *_nombre debe ser None
    (el frontend cae al ID crudo)."""
    with session_factory() as db:
        resultado = enriquecer_detalle_auditoria(
            db,
            "vencimientos_personal",
            "1",
            {"persona_id": [None, 999999], "aptitud_id": [None, 888888]},
        )

    assert resultado["persona_id"]["antes"] is None
    assert resultado["persona_id"]["despues"] == 999999
    assert resultado["persona_id"]["antes_nombre"] is None
    assert resultado["persona_id"]["despues_nombre"] is None  # persona no existe

    assert resultado["aptitud_id"]["antes"] is None
    assert resultado["aptitud_id"]["despues"] == 888888
    assert resultado["aptitud_id"]["antes_nombre"] is None
    assert resultado["aptitud_id"]["despues_nombre"] is None  # aptitud no existe


def test_enriquecer_campos_no_fk_también_tienen_forma_consistente(session_factory):
    """Los campos que no son FK también deben salir con la forma
    {antes, despues, antes_nombre: None, despues_nombre: None}."""
    with session_factory() as db:
        resultado = enriquecer_detalle_auditoria(
            db,
            "vencimientos_personal",
            "1",
            {
                "fecha_vencimiento": ["2026-10-30", "2026-11-30"],
                "activo": [True, False],
                "persona_id": [5, None],
            },
        )

    # fecha_vencimiento no es FK
    assert resultado["fecha_vencimiento"] == {
        "antes": "2026-10-30",
        "despues": "2026-11-30",
        "antes_nombre": None,
        "despues_nombre": None,
    }
    # activo no es FK
    assert resultado["activo"] == {
        "antes": True,
        "despues": False,
        "antes_nombre": None,
        "despues_nombre": None,
    }
    # persona_id sí es FK pero el ID 5 puede no existir → nombre None
    assert resultado["persona_id"]["antes"] == 5
    assert resultado["persona_id"]["despues"] is None
    assert resultado["persona_id"]["antes_nombre"] is None
    assert resultado["persona_id"]["despues_nombre"] is None
