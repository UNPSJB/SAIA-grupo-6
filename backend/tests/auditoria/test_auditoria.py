"""Tests de la bitácora de auditoría automática.

Cubren los listeners del ORM (`src/auditoria/listeners.py`) y el endpoint
`GET /auditoria`. Usan las fixtures de `tests/database.py`: `db_session`
crea todas las tablas por test (incluida `audit_log`) y `client` expone la
app con `get_db` sobre esa misma sesión.
"""

import json
from datetime import date, datetime, timedelta
from typing import Optional

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import String, delete, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column

from src.Equipo.models import Equipo
from src.Equipo.schemas import EquipoCreate, EquipoUpdate
from src.Equipo.services import actualizar_equipo, crear_equipo, dar_de_baja_equipo
from src.auditoria.listeners import BitacoraInmutableError, DmlMasivoSinAuditoriaError
from src.auditoria.models import AuditLog
from src.auth.models import TokenRevocado
from src.auth.services import crear_access_token
from src.checklist.models import HistorialRegistroTarea, RegistroTarea
from src.config import settings
from src.database import get_db
from src.main import app
from src.models import AUDITORIA_REDACTAR, ModeloBase
from src.personal.models import Personal
from src.personal.schemas import PersonaCreate, PersonaUpdate
from src.personal.services import autenticar_persona, crear_persona, modificar_persona
from src.unidadMedida.models import UnidadMedida
from tests.seed_checklists import sembrar

# noqa: F401 — fixtures de tests/database.py resueltas por pytest.
from tests.database import client, db_session, sector


class _PkCompuesta(ModeloBase):
    """Modelo descartable del test: PK compuesta y columnas sensibles."""

    __tablename__ = "tmp_auditoria_pk_compuesta"

    a: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    b: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    nombre: Mapped[str] = mapped_column(String(20))
    # Redactada por la marca explícita en la columna.
    pin: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True, info=AUDITORIA_REDACTAR
    )
    # Redactada por la red de seguridad: el nombre sugiere un secreto.
    client_secret: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)


@pytest.fixture
def client_auth_real(db_session):
    """App con la autenticación REAL: solo se reemplaza `get_db`.

    A diferencia de `client` (que saltea `require_admin` / `require_operador`),
    acá `get_current_user` corre de verdad y es quien deja el actor en la sesión.
    """

    def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def _auditoria(db_session, **filtros):
    """Filas de la bitácora que cumplen los filtros, ordenadas por id."""
    consulta = select(AuditLog)
    for campo, valor in filtros.items():
        consulta = consulta.where(getattr(AuditLog, campo) == valor)
    return list(db_session.scalars(consulta.order_by(AuditLog.id)).all())


def _crear_equipo(db_session, sector, nombre):
    return crear_equipo(
        db_session, EquipoCreate(nombre=nombre, sector_id=sector.id, tipo="Balanza")
    )


# --------------------------------------------------------------------------
# Listeners: qué se registra y qué no
# --------------------------------------------------------------------------

def test_crear_un_equipo_genera_un_registro_CREAR(db_session, sector):
    equipo = _crear_equipo(db_session, sector, "Balanza-01")

    registros = _auditoria(db_session, entidad="equipos", entidad_id=str(equipo.id))
    assert len(registros) == 1
    registro = registros[0]
    assert registro.accion == "CREAR"
    # Nadie inició sesión: el actor es el sistema.
    assert registro.usuario_id is None
    # Valores finales de la fila nueva; en un alta no hay "antes".
    assert registro.cambios["nombre"] == [None, "Balanza-01"]
    assert registro.cambios["activo"] == [None, True]


def test_modificar_un_campo_registra_antes_y_despues(db_session, sector):
    equipo = _crear_equipo(db_session, sector, "Balanza-01")

    actualizar_equipo(db_session, equipo.id, EquipoUpdate(nombre="Balanza-02"))

    registros = _auditoria(db_session, entidad="equipos", accion="MODIFICAR")
    assert len(registros) == 1
    assert registros[0].cambios["nombre"] == ["Balanza-01", "Balanza-02"]
    # Lo que no cambió no entra al diff.
    assert "tipo" not in registros[0].cambios
    assert "sector_id" not in registros[0].cambios


def test_baja_logica_genera_BAJA(db_session, sector):
    equipo = _crear_equipo(db_session, sector, "Balanza-01")

    dar_de_baja_equipo(db_session, equipo.id)

    registros = _auditoria(db_session, entidad="equipos", accion="BAJA")
    assert len(registros) == 1
    assert registros[0].cambios == {"activo": [True, False]}


def test_modificar_password_no_expone_el_hash(db_session):
    persona = crear_persona(
        db_session,
        PersonaCreate(
            nombre="Ana",
            dni="30111222",
            email="ana@test.local",
            puede_operar=True,
            password="secreta-vieja",
        ),
    )
    hash_viejo = persona.password

    modificar_persona(db_session, persona.id, PersonaUpdate(password="secreta-nueva"))
    hash_nuevo = persona.password  # refrescado por el service

    registro = _auditoria(db_session, entidad="personal", accion="MODIFICAR")[0]
    # El cambio de password SÍ se audita, pero redactado.
    assert registro.cambios["password"] == ["***", "***"]

    # Ni el hash viejo ni el nuevo aparecen en ningún registro de personal.
    bitacora = json.dumps(
        [r.cambios for r in _auditoria(db_session, entidad="personal")],
        ensure_ascii=False,
    )
    assert hash_viejo not in bitacora
    assert hash_nuevo not in bitacora


def test_la_sesion_deja_el_actor_del_cambio(db_session, sector):
    actor = crear_persona(
        db_session,
        PersonaCreate(
            nombre="Ada",
            dni="28555666",
            email="ada@test.local",
            puede_administrar=True,
        ),
    )

    db_session.info["usuario_id"] = actor.id
    equipo = _crear_equipo(db_session, sector, "Freezer-01")

    registro = _auditoria(db_session, entidad="equipos", entidad_id=str(equipo.id))[0]
    assert registro.usuario_id == actor.id


def test_sesion_sin_auditoria_no_registra_nada(db_session, sector):
    db_session.info["sin_auditoria"] = True

    equipo = _crear_equipo(db_session, sector, "Anafe-01")
    equipo_id = str(equipo.id)
    db_session.delete(equipo)
    db_session.commit()

    # Ni el alta ni el borrado entraron a la bitácora.
    assert _auditoria(db_session, entidad="equipos", entidad_id=equipo_id) == []


def test_commit_fallido_no_deja_registros(db_session):
    # Dos filas con el mismo nombre UNIQUE: la primera entra y ya dejó su
    # fila de auditoría, la segunda revienta el flush. Como la auditoría
    # comparte la transacción del cambio, el rollback se lleva ambas.
    db_session.add(UnidadMedida(nombre="Litros", simbolo="L"))
    db_session.add(UnidadMedida(nombre="Litros", simbolo="X"))

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    assert _auditoria(db_session, entidad="unidades_medida") == []


# --------------------------------------------------------------------------
# Endpoint GET /auditoria
# --------------------------------------------------------------------------

def test_get_auditoria_filtra_y_pagina(db_session, client, sector):
    for nombre in ("Balanza-01", "Balanza-02", "Balanza-03"):
        _crear_equipo(db_session, sector, nombre)

    respuesta = client.get(
        "/auditoria", params={"entidad": "equipos", "page": 1, "page_size": 2}
    )
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 3
    assert cuerpo["page"] == 1
    assert cuerpo["page_size"] == 2
    assert cuerpo["total_paginas"] == 2
    # Orden fecha desc (+ id desc como desempate): el último creado primero.
    assert [item["entidad_id"] for item in cuerpo["items"]] == ["3", "2"]
    assert cuerpo["items"][0]["cambios"]["nombre"] == [None, "Balanza-03"]

    # La página 2 trae el restante.
    respuesta = client.get(
        "/auditoria", params={"entidad": "equipos", "page": 2, "page_size": 2}
    )
    assert [item["entidad_id"] for item in respuesta.json()["items"]] == ["1"]

    # Filtro por acción.
    respuesta = client.get(
        "/auditoria",
        params={"entidad": "equipos", "accion": "CREAR", "page_size": 10},
    )
    cuerpo = respuesta.json()
    assert len(cuerpo["items"]) == 3
    assert all(item["accion"] == "CREAR" for item in cuerpo["items"])

    # Filtro por fila auditada.
    respuesta = client.get("/auditoria", params={"entidad_id": "2", "page_size": 10})
    assert [item["entidad_id"] for item in respuesta.json()["items"]] == ["2"]

    # Filtro por actor: la bitácora queda con el usuario de la sesión.
    actor = crear_persona(
        db_session,
        PersonaCreate(
            nombre="Omar",
            dni="41222333",
            email="omar@test.local",
            puede_operar=True,
        ),
    )
    db_session.info["usuario_id"] = actor.id
    respuesta = client.post(
        "/equipos",
        json={"nombre": "Balanza-04", "sector_id": sector.id, "tipo": "Balanza"},
    )
    assert respuesta.status_code == 201

    respuesta = client.get(
        "/auditoria", params={"usuario_id": actor.id, "page_size": 10}
    )
    items = respuesta.json()["items"]
    assert [item["entidad_id"] for item in items] == ["4"]
    assert all(item["usuario_id"] == actor.id for item in items)

    # Filtro por rango de fechas: un día para cada lado cubre la zona horaria.
    desde = (date.today() - timedelta(days=1)).isoformat()
    hasta = (date.today() + timedelta(days=1)).isoformat()
    respuesta = client.get(
        "/auditoria",
        params={"entidad": "equipos", "desde": desde, "hasta": hasta, "page_size": 10},
    )
    assert respuesta.json()["total"] == 4

    respuesta = client.get(
        "/auditoria",
        params={
            "entidad": "equipos",
            "hasta": (date.today() - timedelta(days=2)).isoformat(),
            "page_size": 10,
        },
    )
    assert respuesta.json()["total"] == 0


# --------------------------------------------------------------------------
# Acciones que faltaban cubrir: ELIMINAR, REACTIVAR y PK compuesta
# --------------------------------------------------------------------------

def test_eliminar_registra_ELIMINAR_con_la_instantanea(db_session, sector):
    equipo = _crear_equipo(db_session, sector, "Balanza-01")
    equipo_id = str(equipo.id)

    db_session.delete(equipo)
    db_session.commit()

    registros = _auditoria(db_session, entidad="equipos", accion="ELIMINAR")
    assert len(registros) == 1
    assert registros[0].entidad_id == equipo_id
    # En un borrado "despues" es null: la fila dejó de existir.
    assert registros[0].cambios["nombre"] == ["Balanza-01", None]


def test_reactivar_genera_REACTIVAR(db_session, sector):
    equipo = _crear_equipo(db_session, sector, "Balanza-01")
    dar_de_baja_equipo(db_session, equipo.id)

    actualizar_equipo(db_session, equipo.id, EquipoUpdate(activo=True))

    registros = _auditoria(db_session, entidad="equipos", accion="REACTIVAR")
    assert len(registros) == 1
    assert registros[0].cambios == {"activo": [False, True]}


def test_pk_compuesta_se_une_con_guion_y_redacta_secretos(db_session):
    db_session.add(
        _PkCompuesta(a=3, b=7, nombre="x", pin="1234", client_secret="s3cr3to")
    )
    db_session.commit()

    registro = _auditoria(db_session, entidad="tmp_auditoria_pk_compuesta")[0]
    assert registro.entidad_id == "3-7"
    assert registro.cambios["nombre"] == [None, "x"]
    # Ni la columna marcada ni la de nombre sospechoso filtran su contenido.
    assert registro.cambios["pin"] == [None, "***"]
    assert registro.cambios["client_secret"] == [None, "***"]

    fila = db_session.get(_PkCompuesta, (3, 7))
    fila.pin = "9999"
    fila.client_secret = "otro"
    db_session.commit()

    cambio = _auditoria(db_session, entidad="tmp_auditoria_pk_compuesta")[1]
    assert cambio.cambios == {"pin": ["***", "***"], "client_secret": ["***", "***"]}
    assert "9999" not in json.dumps(cambio.cambios)


# --------------------------------------------------------------------------
# Guarda contra DML masivo: lo que esquivaría los listeners se rechaza
# --------------------------------------------------------------------------

def test_update_y_delete_masivos_sobre_entidad_auditada_se_rechazan(db_session, sector):
    equipo = _crear_equipo(db_session, sector, "Balanza-01")

    with pytest.raises(DmlMasivoSinAuditoriaError):
        db_session.execute(
            update(Equipo).where(Equipo.id == equipo.id).values(nombre="Otro")
        )
    # También por la tabla de Core: es el mismo hueco con otra sintaxis.
    with pytest.raises(DmlMasivoSinAuditoriaError):
        db_session.execute(delete(Equipo.__table__).where(Equipo.id == equipo.id))
    with pytest.raises(DmlMasivoSinAuditoriaError):
        db_session.execute(
            insert(Equipo),
            [{"nombre": "X", "tipo": "T", "sector_id": sector.id, "activo": True}],
        )

    # Nada se aplicó.
    db_session.refresh(equipo)
    assert equipo.nombre == "Balanza-01"


def test_dml_masivo_permitido_con_sin_auditoria_o_con_la_opcion(db_session, sector):
    equipo = _crear_equipo(db_session, sector, "Balanza-01")

    # Por sentencia, a propósito.
    db_session.execute(
        update(Equipo)
        .where(Equipo.id == equipo.id)
        .values(nombre="Balanza-02")
        .execution_options(auditoria_omitir=True)
    )

    # Por sesión (seeds y scripts de carga).
    db_session.info["sin_auditoria"] = True
    db_session.execute(
        update(Equipo).where(Equipo.id == equipo.id).values(nombre="Balanza-03")
    )
    db_session.commit()

    db_session.refresh(equipo)
    assert equipo.nombre == "Balanza-03"


def test_dml_masivo_sobre_entidad_no_auditada_pasa(db_session):
    # `TokenRevocado` tiene `__audit__ = False`: purgarla no es un hueco.
    db_session.execute(delete(TokenRevocado).where(TokenRevocado.jti == "inexistente"))


# --------------------------------------------------------------------------
# La bitácora es de solo agregado
# --------------------------------------------------------------------------

def test_la_bitacora_no_se_modifica_ni_se_borra(db_session, sector):
    _crear_equipo(db_session, sector, "Balanza-01")
    cantidad = len(_auditoria(db_session))
    registro = _auditoria(db_session)[0]

    registro.accion = "ELIMINAR"
    with pytest.raises(BitacoraInmutableError):
        db_session.commit()
    db_session.rollback()

    registro = _auditoria(db_session)[0]
    db_session.delete(registro)
    with pytest.raises(BitacoraInmutableError):
        db_session.commit()
    db_session.rollback()

    # Tampoco por DML masivo, ni siquiera con `sin_auditoria` (esa bandera es
    # para los seeds, no para tocar la bitácora).
    db_session.info["sin_auditoria"] = True
    with pytest.raises(BitacoraInmutableError):
        db_session.execute(delete(AuditLog))
    assert len(_auditoria(db_session)) == cantidad

    # Una purga por retención se pide a propósito.
    db_session.execute(delete(AuditLog).execution_options(auditoria_omitir=True))
    assert _auditoria(db_session) == []


# --------------------------------------------------------------------------
# Actor: sale del token real, y el rehash de contraseña se atribuye a la persona
# --------------------------------------------------------------------------

def test_el_actor_sale_de_la_autenticacion_real(db_session, client_auth_real, sector):
    operador = crear_persona(
        db_session,
        PersonaCreate(
            nombre="Omar",
            dni="41222333",
            email="omar@test.local",
            puede_administrar=True,  # POST /equipos exige administrar
        ),
    )
    token, _, _ = crear_access_token(str(operador.id))

    respuesta = client_auth_real.post(
        "/equipos",
        json={"nombre": "Balanza-09", "sector_id": sector.id, "tipo": "Balanza"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert respuesta.status_code == 201

    registro = _auditoria(db_session, entidad="equipos", accion="CREAR")[0]
    assert registro.usuario_id == operador.id


def test_el_rehash_de_password_legacy_se_atribuye_a_la_persona(db_session):
    # Una contraseña vieja en texto plano: el login la acepta y la reemplaza
    # por su hash. Ese cambio lo provoca la propia persona, no "el sistema".
    persona = Personal(
        nombre="Leo",
        dni="30999888",
        email="leo@test.local",
        password="plano123",
        puede_operar=True,
    )
    db_session.add(persona)
    db_session.commit()

    autenticar_persona(db_session, "30999888", "plano123")

    registros = _auditoria(db_session, entidad="personal", accion="MODIFICAR")
    assert len(registros) == 1
    assert registros[0].usuario_id == persona.id
    assert registros[0].cambios == {"password": ["***", "***"]}


# --------------------------------------------------------------------------
# Endpoint: nombre del actor y días en zona local
# --------------------------------------------------------------------------

def test_get_auditoria_trae_el_nombre_del_actor(db_session, client, sector):
    actor = crear_persona(
        db_session,
        PersonaCreate(
            nombre="Ada",
            apellido="Lovelace",
            dni="28555666",
            email="ada@test.local",
            puede_administrar=True,
        ),
    )
    db_session.info["usuario_id"] = actor.id
    _crear_equipo(db_session, sector, "Freezer-01")

    items = client.get(
        "/auditoria", params={"usuario_id": actor.id, "page_size": 10}
    ).json()["items"]

    assert items[0]["usuario_nombre"] == "Ada Lovelace"
    # Un cambio del sistema no inventa un nombre.
    sistema = client.get(
        "/auditoria", params={"entidad": "personal", "page_size": 10}
    ).json()["items"]
    assert sistema[0]["usuario_nombre"] is None


def test_los_filtros_de_fecha_son_dias_del_calendario_local(
    db_session, client, monkeypatch
):
    monkeypatch.setattr(settings, "ZONA_HORARIA", "America/Argentina/Buenos_Aires")
    # 01:30 UTC del 29 son las 22:30 del 28 en UTC-3.
    db_session.add(
        AuditLog(
            fecha=datetime(2026, 10, 29, 1, 30),
            entidad="equipos",
            entidad_id="1",
            accion="CREAR",
            cambios={},
        )
    )
    db_session.commit()

    def total(dia: str) -> int:
        return client.get(
            "/auditoria", params={"desde": dia, "hasta": dia, "page_size": 10}
        ).json()["total"]

    assert total("2026-10-28") == 1
    assert total("2026-10-29") == 0


# --------------------------------------------------------------------------
# HistorialRegistroTarea es la fuente de verdad del marcado de tareas
# --------------------------------------------------------------------------

def test_el_marcado_de_tareas_no_se_audita_dos_veces(db_session):
    autor = crear_persona(
        db_session,
        PersonaCreate(
            nombre="Ana", dni="30111222", email="ana@test.local", puede_operar=True
        ),
    )
    sembrar(db_session, autor.id)

    registro = db_session.scalars(select(RegistroTarea)).first()
    registro.completado = True
    db_session.add(HistorialRegistroTarea(registro_tarea_id=registro.id, completado=True))
    db_session.commit()

    # El rastro de cada marcado es el historial: ni el estado actual ni el
    # propio historial se repiten en la bitácora genérica.
    assert _auditoria(db_session, entidad="registro_tareas") == []
    assert _auditoria(db_session, entidad="historial_registro_tareas") == []
    # El resto de las entidades siguen auditadas.
    assert _auditoria(db_session, entidad="checklists")
