"""Verificación de los fixes del backend.

Ejecutar desde `backend/`:

    .venv\\Scripts\\python.exe verificar.py

No necesita pytest ni dependencias extra: usa la base SQLite en memoria para
los services y una base temporal para las migraciones. Cubre los tres grupos
de cambios:

  * schemas: un `null` explicito ya no rompe con 500, y los `*Update` validan
    lo que antes se guardaba sin chequear;
  * services: un duplicado en un PUT devuelve la excepcion de negocio en vez de
    un 500, y un `NOT NULL` ya no se reporta como "ya existe";
  * migraciones: el bootstrap de super admin corre una sola vez.
"""

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, ".")

fallos = []


def check(desc, cond):
    if cond:
        print(f"  ok  {desc}")
    else:
        fallos.append(desc)
        print(f"  FALLA {desc}")


def check_raises(desc, fn, exc):
    try:
        fn()
    except exc:
        check(desc, True)
        return
    except Exception as e:  # noqa: BLE001
        check(desc, False)
        print(f"        (lanzó {type(e).__name__}: {e})")
        return
    check(desc, False)
    print("        (no lanzó)")


print("== schemas: null explícitos y validaciones ==")
from src.tareas import schemas as tareas, exceptions as ta_exc  # noqa: E402
from src.PlanLimpieza import schemas as planes, exceptions as pl_exc  # noqa: E402
from src.personal import schemas as personal, exceptions as pe_exc  # noqa: E402
from src.unidadMedida import schemas as um, exceptions as um_exc  # noqa: E402
from src.aptitud import schemas as apt, exceptions as apt_exc  # noqa: E402

check("TareaUpdate tolera null", tareas.TareaUpdate.model_validate(
    {"nombre": None, "frecuencia": None, "descripcion": None}))
check("PlanLimpiezaUpdate tolera null", planes.PlanLimpiezaUpdate.model_validate(
    {"nombre": None, "equipo_id": None, "autor_id": None, "tareas": None}))
check("PersonaUpdate tolera null", personal.PersonaUpdate.model_validate(
    {"nombre": None, "dni": None, "email": None}))
check("UnidadMedidaUpdate tolera null", um.UnidadMedidaUpdate.model_validate(
    {"nombre": None, "simbolo": None}))
check("AptitudUpdate tolera null", apt.AptitudUpdate.model_validate({"nombre": None}))

check_raises("TareaUpdate nombre vacío", lambda: tareas.TareaUpdate.model_validate({"nombre": ""}), ta_exc.NombreInvalido)
check_raises("TareaUpdate frecuencia 0", lambda: tareas.TareaUpdate.model_validate({"frecuencia": 0}), ta_exc.FrecuenciaInvalida)
check_raises("PersonaUpdate dni inválido", lambda: personal.PersonaUpdate.model_validate({"dni": "abc"}), pe_exc.DniInvalido)
check_raises("PersonaUpdate email inválido", lambda: personal.PersonaUpdate.model_validate({"email": "x"}), pe_exc.EmailInvalido)
check_raises("UnidadMedidaUpdate símbolo vacío", lambda: um.UnidadMedidaUpdate.model_validate({"simbolo": ""}), um_exc.SimboloVacio)
check_raises("AptitudUpdate nombre vacío", lambda: apt.AptitudUpdate.model_validate({"nombre": ""}), apt_exc.NombreVacio)
check_raises("PlanLimpiezaUpdate tareas vacías", lambda: planes.PlanLimpiezaUpdate.model_validate({"tareas": []}), pl_exc.TareasVacias)
check_raises("PlanLimpiezaUpdate autor_id 0", lambda: planes.PlanLimpiezaUpdate.model_validate({"autor_id": 0}), pl_exc.AutorIdInvalido)
check("PersonaUpdate no exige capacidades", bool(personal.PersonaUpdate.model_validate(
    {"puede_operar": False, "puede_administrar": False, "es_super_admin": False})))

print()
print("== clasificación de IntegrityError ==")
from src.common.persistence import (  # noqa: E402
    es_violacion_nulo,
    es_violacion_unica,
    mapa_por_campo,
)
check("UNIQUE detectado", es_violacion_unica("unique constraint failed: aptitudes.nombre"))
check("NOT NULL detectado", es_violacion_nulo("not null constraint failed: personal.dni"))
check("NOT NULL NO es duplicado", not es_violacion_unica("not null constraint failed: personal.dni"))
mapeo = mapa_por_campo(("personal.dni", pe_exc.DniDuplicado), por_defecto=pe_exc.DatoDuplicado)
check("mapea dni duplicado", isinstance(mapeo("unique constraint failed: personal.dni"), pe_exc.DniDuplicado))
check("NOT NULL cae al default, no a DniDuplicado",
      isinstance(mapeo("not null constraint failed: personal.dni"), pe_exc.DatoDuplicado))

print()
print("== services contra base real ==")
from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402
from src.exceptions import ConflictoRegistroInactivo  # noqa: E402
import src.all_models  # noqa: F401,E402
from src.models import ModeloBase  # noqa: E402

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
ModeloBase.metadata.create_all(engine)
db = sessionmaker(bind=engine)()

from src.aptitud import services as apt_srv, schemas as apt_sch  # noqa: E402
from src.aptitud import exceptions as apt_e  # noqa: E402
from src.unidadMedida import services as um_srv, schemas as um_sch  # noqa: E402
from src.unidadMedida import exceptions as um_e  # noqa: E402
from src.unidadMedida.models import UnidadMedida  # noqa: E402
from src.common.persistence import comparar_texto  # noqa: E402

a1 = apt_srv.crear_aptitud(db, apt_sch.AptitudCreate(nombre="Altura"))
a2 = apt_srv.crear_aptitud(db, apt_sch.AptitudCreate(nombre="Profundidad"))
check_raises("alta duplicada", lambda: apt_srv.crear_aptitud(db, apt_sch.AptitudCreate(nombre="Altura")), apt_e.AptitudYaExiste)
check_raises("PUT duplicado (no 500)", lambda: apt_srv.actualizar_aptitud(db, a2.id, apt_sch.AptitudUpdate(nombre="Altura")), apt_e.AptitudYaExiste)
check("el PUT fallido no ensució", db.get(type(a2), a2.id).nombre == "Profundidad")
apt_srv.eliminar_aptitud(db, a1.id)
check_raises("reactivar dada de baja da 409", lambda: apt_srv.crear_aptitud(db, apt_sch.AptitudCreate(nombre="Altura")), ConflictoRegistroInactivo)
check("listar oculta dadas de baja", all(x.activo for x in apt_srv.listar_aptitudes(db)))
check("incluir_inactivos las trae", len(apt_srv.listar_aptitudes(db, True)) == 2)

um_srv.crear_unidad_medida(db, um_sch.UnidadMedidaCreate(nombre="Litros", simbolo="L"))
u2 = um_srv.crear_unidad_medida(db, um_sch.UnidadMedidaCreate(nombre="Gramos", simbolo="G"))
check_raises("nombre repetido", lambda: um_srv.crear_unidad_medida(db, um_sch.UnidadMedidaCreate(nombre="Litros", simbolo="X")), um_e.UnidadMedidaYaExiste)
check_raises("símbolo repetido", lambda: um_srv.crear_unidad_medida(db, um_sch.UnidadMedidaCreate(nombre="Metros", simbolo="L")), um_e.SimboloYaExiste)
check_raises("PUT símbolo repetido", lambda: um_srv.actualizar_unidad_medida(db, u2.id, um_sch.UnidadMedidaUpdate(simbolo="L")), um_e.SimboloYaExiste)
check("PUT símbolo válido", um_srv.actualizar_unidad_medida(db, u2.id, um_sch.UnidadMedidaUpdate(simbolo="gr")).simbolo == "GR")

um_srv.crear_unidad_medida(db, um_sch.UnidadMedidaCreate(nombre="DetergenteX", simbolo="DX"))
check("comodín % no matchea filas ajenas",
      db.scalar(select(UnidadMedida).where(comparar_texto(UnidadMedida.nombre, "Detergente%"))) is None)
check("comodín _ no matchea filas ajenas",
      db.scalar(select(UnidadMedida).where(comparar_texto(UnidadMedida.nombre, "Detergente_"))) is None)
db.close()

print()
print("== migraciones y arranque ==")
tmpdir = tempfile.mkdtemp()
os.environ["DB_URL"] = f"sqlite:///{Path(tmpdir) / 't.db'}"
from src.config import settings  # noqa: E402

settings.DB_URL = os.environ["DB_URL"]
import src.migrations as migrations  # noqa: E402
from src.database import engine as eng  # noqa: E402
from sqlalchemy import text  # noqa: E402

migrations.crear_tablas_y_migrar()
with eng.begin() as c:
    tablas = set(c.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).scalars())
check("tablas creadas", {"personal", "checklists", "schema_migrations"} <= tablas)
migrations.crear_tablas_y_migrar()
with eng.begin() as c:
    c.execute(text("INSERT INTO personal (nombre, apellido, dni, telefono, email, password, "
                   "puede_operar, puede_administrar, es_super_admin, activo, fecha_creacion) "
                   "VALUES ('Ana','P','12345678',NULL,'a@b.com','x',1,0,0,1,CURRENT_TIMESTAMP)"))
migrations.crear_tablas_y_migrar()
with eng.begin() as c:
    check("bootstrap promueve una vez", c.execute(text("SELECT es_super_admin FROM personal")).scalar() == 1)
with eng.begin() as c:
    c.execute(text("UPDATE personal SET es_super_admin = 0"))
migrations.crear_tablas_y_migrar()
with eng.begin() as c:
    check("degradar no se revierte al reiniciar",
          c.execute(text("SELECT es_super_admin FROM personal")).scalar() == 0)

print()
print(f"\n{'TODO OK' if not fallos else str(len(fallos)) + ' FALLAS'}")
for f in fallos:
    print("  -", f)
sys.exit(1 if fallos else 0)