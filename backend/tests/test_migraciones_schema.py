import sys
from datetime import date

from sqlalchemy import create_engine, event, inspect, select, text
from sqlalchemy.orm import sessionmaker

import cargar_datos_faker as seed_faker
import cargar_datos_ultimo as seed_ultimo
import cargar_datos_vista_publica as seed_vista_publica
from src import migrations
from src.Equipo.models import Calibracion, Equipo
from src.models import ModeloBase
from src.personal.models import Personal
from src.sector.models import Sector
from src.tareas.models import Tarea


def crear_motor_temporal(tmp_path):
    motor = create_engine(f"sqlite:///{tmp_path / 'schema.sqlite3'}")

    @event.listens_for(motor, "connect")
    def activar_claves_foraneas(conexion, _):
        conexion.execute("PRAGMA foreign_keys = ON")

    return motor


def crear_esquema_heredado(motor, sin_activo=False, sin_operador=False):
    ModeloBase.metadata.create_all(motor)
    with motor.begin() as conexion:
        if sin_operador:
            # SQLite no permite DROP COLUMN si la definición de FK todavía la
            # nombra. Se recrea solo esta tabla temporal como la versión
            # histórica, después de quitar sus dependientes vacías.
            conexion.execute(text("DROP TABLE historial_registro_tareas"))
            conexion.execute(text("DROP TABLE movimientos_stock_insumos_quimicos"))
            conexion.execute(text("DROP TABLE registro_tareas"))
            conexion.execute(text("DROP TABLE tareas"))
            conexion.execute(
                text(
                    "CREATE TABLE tareas ("
                    "id INTEGER NOT NULL PRIMARY KEY, "
                    "nombre VARCHAR(100) NOT NULL, "
                    "activo BOOLEAN NOT NULL, "
                    "frecuencia INTEGER NOT NULL, "
                    "tipo VARCHAR(30) NOT NULL, "
                    "descripcion TEXT, "
                    "observaciones TEXT, "
                    "plan_limpieza_id INTEGER NOT NULL "
                    "REFERENCES plan_limpieza(id))"
                )
            )
        if sin_activo:
            conexion.execute(text("ALTER TABLE calibraciones DROP COLUMN activo"))


def ejecutar_migracion(monkeypatch, motor):
    monkeypatch.setattr(migrations, "engine", motor)
    migrations.crear_tablas_y_migrar()


def test_migracion_agrega_activo_a_calibraciones_existentes(tmp_path, monkeypatch):
    motor = crear_motor_temporal(tmp_path)
    crear_esquema_heredado(motor, sin_activo=True)

    ejecutar_migracion(monkeypatch, motor)
    columnas = {columna["name"]: columna for columna in inspect(motor).get_columns("calibraciones")}

    assert columnas["activo"]["nullable"] is False
    assert columnas["activo"]["default"] == "1"

    # Una segunda ejecución no vuelve a alterar el esquema.
    ejecutar_migracion(monkeypatch, motor)
    assert "activo" in {c["name"] for c in inspect(motor).get_columns("calibraciones")}


def test_migracion_agrega_operador_a_tareas_existentes(tmp_path, monkeypatch):
    motor = crear_motor_temporal(tmp_path)
    crear_esquema_heredado(motor, sin_operador=True)

    ejecutar_migracion(monkeypatch, motor)
    inspector = inspect(motor)

    assert "operador_id" in {c["name"] for c in inspector.get_columns("tareas")}
    with motor.connect() as conexion:
        claves_foraneas = list(
            conexion.execute(text("PRAGMA foreign_key_list(tareas)")).mappings()
        )
    assert any(
        fk["from"] == "operador_id"
        and fk["table"] == "personal"
        and fk["to"] == "id"
        and fk["on_delete"] == "SET NULL"
        for fk in claves_foraneas
    ), claves_foraneas
    assert "ix_tareas_operador_id" in {
        indice["name"] for indice in inspector.get_indexes("tareas")
    }

    ejecutar_migracion(monkeypatch, motor)
    assert "operador_id" in {c["name"] for c in inspect(motor).get_columns("tareas")}


def test_migracion_no_elimina_activo_en_esquema_nuevo(tmp_path, monkeypatch):
    motor = crear_motor_temporal(tmp_path)
    ModeloBase.metadata.create_all(motor)

    ejecutar_migracion(monkeypatch, motor)
    assert "activo" in {c["name"] for c in inspect(motor).get_columns("calibraciones")}


def test_baja_logica_calibracion_funciona_despues_de_migrar(tmp_path, monkeypatch):
    motor = crear_motor_temporal(tmp_path)
    ejecutar_migracion(monkeypatch, motor)
    sesion = sessionmaker(bind=motor)()

    try:
        sesion.info["sin_auditoria"] = True
        sector = Sector(nombre="Sector de prueba", activo=True)
        persona = Personal(
            nombre="Admin",
            apellido="Prueba",
            dni="99123456",
            email="admin.prueba@test.local",
            password="hash",
            puede_operar=True,
            puede_administrar=True,
            activo=True,
        )
        sesion.add_all([sector, persona])
        sesion.flush()
        equipo = Equipo(nombre="Equipo de prueba", tipo="Medición", sector_id=sector.id)
        sesion.add(equipo)
        sesion.flush()
        calibracion = Calibracion(
            equipo_id=equipo.id,
            fecha_realizacion=date(2026, 1, 1),
            proximo_vencimiento=date(2027, 1, 1),
            certificado_url="uploads/certificados/prueba.pdf",
            tipo="calibracion",
        )
        sesion.add(calibracion)
        sesion.commit()

        calibracion.activo = False
        sesion.commit()

        assert sesion.scalar(
            select(Calibracion.activo).where(Calibracion.id == calibracion.id)
        ) is False
    finally:
        sesion.close()
        motor.dispose()


def test_faker_carga_en_base_temporal_migrada(tmp_path, monkeypatch):
    motor = crear_motor_temporal(tmp_path)
    fabrica_sesiones = sessionmaker(autocommit=False, autoflush=False, bind=motor)
    monkeypatch.setattr(migrations, "engine", motor)
    monkeypatch.setattr(seed_faker, "SessionLocal", fabrica_sesiones)
    monkeypatch.setattr(seed_faker, "CARPETA_UPLOADS", tmp_path / "uploads")
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "cargar_datos_faker.py",
            "--cantidad",
            "2",
            "--dias-checklist",
            "1",
            "--seed",
            "7",
            "--sin-actividad",
        ],
    )

    assert seed_faker.main() == 0

    with fabrica_sesiones() as sesion:
        assert sesion.scalar(select(Tarea.id).limit(1)) is not None
        assert sesion.execute(text("PRAGMA foreign_key_check")).all() == []

    motor.dispose()


def test_cargador_integral_usa_una_base_temporal_migrada(tmp_path, monkeypatch):
    motor = crear_motor_temporal(tmp_path)
    fabrica_sesiones = sessionmaker(autocommit=False, autoflush=False, bind=motor)
    carpeta_uploads = tmp_path / "uploads"

    monkeypatch.setattr(migrations, "engine", motor)
    monkeypatch.setattr(seed_faker, "SessionLocal", fabrica_sesiones)
    monkeypatch.setattr(seed_faker, "CARPETA_UPLOADS", carpeta_uploads)
    monkeypatch.setattr(seed_vista_publica, "SessionLocal", fabrica_sesiones)
    monkeypatch.setattr(seed_vista_publica, "CARPETA_UPLOADS", carpeta_uploads)
    monkeypatch.setattr(seed_ultimo, "SessionLocal", fabrica_sesiones)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "cargar_datos_ultimo.py",
            "--cantidad",
            "1",
            "--dias-checklist",
            "60",
            "--seed",
            "7",
        ],
    )

    assert seed_ultimo.main() == 0

    with fabrica_sesiones() as sesion:
        assert sesion.scalar(select(Tarea.id).limit(1)) is not None
        assert sesion.execute(text("PRAGMA foreign_key_check")).all() == []

    motor.dispose()
