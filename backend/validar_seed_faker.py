"""Verifica que los datos generados por `cargar_datos_faker.py` sean válidos.

Ejecutar desde `backend/`:

    .venv\\Scripts\\python.exe validar_seed_faker.py

Abre la base que apunta `DB_URL` (setealo antes para no tocar la tuya) y
contrasta lo generado contra las MISMAS validaciones que usan los schemas de
la API: si un nombre tiene dígitos, el PUT de esa fila va a responder 400 y
el seed no sirve para probar la aplicación.
"""

import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

# La consola de Windows arranca en cp1252 y rompe con los acentos del informe.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError, OSError):
        pass

from sqlalchemy import func, select

from src.database import SessionLocal
import src.all_models  # noqa: F401
from src.common.validators import RE_DNI, RE_EMAIL, RE_NOMBRE_SOLO_LETRAS
from src.personal.models import Personal
from src.Equipo.models import Equipo
from src.aptitud.models import Aptitud
from src.vencimientoPersonal.models import VencimientoPersonal
from src.unidadMedida.models import UnidadMedida
from src.insumos.models import Insumo
from src.insumoQuimico.models import InsumoQuimico
from src.elementoLimpieza.models import ElementoLimpieza
from src.PlanLimpieza.models import PlanLimpieza
from src.tareas.models import Tarea
from src.tareas.constants import TipoTarea
from src.checklist.models import Checklist, RegistroTarea, HistorialRegistroTarea, EstadoChecklist
from src.incidente.models import Incidente, HistorialIncidente
from src.incidente.constants import TipoIncidente, EstadoIncidente
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento

fallas = []


def check(desc, cond, detalle=""):
    if cond:
        print(f"  ok    {desc}")
    else:
        print(f"  FALLA {desc} {detalle}")
        fallas.append(desc)


db = SessionLocal()

print("==Volumen por tabla ==")
for modelo in (
    Personal, Equipo, Aptitud, VencimientoPersonal, UnidadMedida, Insumo,
    InsumoQuimico, ElementoLimpieza, PlanLimpieza, Tarea, Checklist,
    RegistroTarea, HistorialRegistroTarea, Incidente, HistorialIncidente,
    PlanCalibracionMantenimiento,
):
    n = db.scalar(select(func.count()).select_from(modelo))
    print(f"  {n:>5}  {modelo.__tablename__}")

print()
print("==Personas: patrones que exige la API ==")
personas = db.scalars(select(Personal)).all()
check("DNI válido (7-8 dígitos)", all(re.match(RE_DNI, p.dni) for p in personas))
check("email válido", all(re.match(RE_EMAIL, p.email) for p in personas))
check("email dentro de 60 chars", all(len(p.email) <= 60 for p in personas))
check("nombre solo letras/espacios", all(re.match(RE_NOMBRE_SOLO_LETRAS, p.nombre) for p in personas))
check("apellido solo letras/espacios", all(re.match(RE_NOMBRE_SOLO_LETRAS, p.apellido) for p in personas))
check("nombre dentro de 40 chars", all(len(p.nombre) <= 40 for p in personas))
check("teléfono dentro de 15 chars", all(len(p.telefono or "") <= 15 for p in personas))
check("DNI únicos", len({p.dni for p in personas}) == len(personas))
check("email únicos", len({p.email for p in personas}) == len(personas))
check("hay al menos un super admin", sum(p.es_super_admin for p in personas) >= 1)
check("el super admin puede administrar", all(p.puede_administrar for p in personas if p.es_super_admin))
check("hay al menos un administrador activo", any(p.puede_administrar and p.activo for p in personas))
check("todo mundo tiene alguna capacidad",
      all(p.es_super_admin or p.puede_operar or p.puede_administrar for p in personas))

print()
print("==Planes y tareas ==")
planes = db.scalars(select(PlanLimpieza)).all()
tareas = db.scalars(select(Tarea)).all()
check("nombre de plan solo letras", all(re.match(RE_NOMBRE_SOLO_LETRAS, pl.nombre) for pl in planes))
check("nombre de plan <= 60 chars", all(len(pl.nombre) <= 60 for pl in planes))
check("nombres de plan únicos", len({pl.nombre for pl in planes}) == len(planes))
check("nombre de tarea solo letras", all(re.match(RE_NOMBRE_SOLO_LETRAS, t.nombre) for t in tareas))
check("nombre de tarea <= 100 chars", all(len(t.nombre) <= 100 for t in tareas))
check("frecuencia > 0", all(t.frecuencia > 0 for t in tareas))
check("tipo de tarea válido", all(t.tipo in {x.value for x in TipoTarea} for t in tareas))
check("todo plan tiene al menos una tarea", all(len(pl.tareas) > 0 for pl in planes))
check("todo plan tiene autor", all(pl.autor_id for pl in planes))

print()
print("==Checklists ==")
checklists = db.scalars(select(Checklist)).all()
registros = db.scalars(select(RegistroTarea)).all()
historiales = db.scalars(select(HistorialRegistroTarea)).all()
check("un checklist por plan y fecha (UNIQUE)", len({(c.plan_id, c.fecha) for c in checklists}) == len(checklists))
check("un registro por checklist y tarea (UNIQUE)",
      len({(r.checklist_id, r.tarea_id) for r in registros}) == len(registros))
check("estado de checklist válido", all(c.estado in {e.value for e in EstadoChecklist} for c in checklists))
check("todo registro pertenece a un checklist existente",
      all(r.checklist_id in {c.id for c in checklists} for r in registros))
check("todo checklist tiene registros", all(len(c.registros) > 0 for c in checklists))
check("tarea completada tiene fecha", all(r.fecha_completado for r in registros if r.completado))
check("tarea pendiente sin fecha", all(not r.fecha_completado for r in registros if not r.completado))
check("historial solo de registros completados",
      all(h.completado for h in historiales))
check("todo registro completado tiene historial",
      {h.registro_tarea_id for h in historiales} == {r.id for r in registros if r.completado})
check("consumo con producto químico trae cantidad",
      all(r.cantidad_consumida is not None for r in registros if r.completado and r.insumo_quimico_id))

print()
print("==Incidentes ==")
incidentes = db.scalars(select(Incidente)).all()
check("tipo válido", all(i.tipo in {t.value for t in TipoIncidente} for i in incidentes))
check("estado válido", all(i.estado in {e.value for e in EstadoIncidente} for i in incidentes))
check("cerrados tienen fecha de cierre", all(i.fecha_cierre for i in incidentes if i.estado == "cerrado"))
check("abiertos sin fecha de cierre", all(not i.fecha_cierre for i in incidentes if i.estado == "abierto"))
check("cerrados tienen responsable", all(i.responsable_cierre_id for i in incidentes if i.estado == "cerrado"))
check("fecha de reporte no futura", all(i.fecha_reporte.date() <= date.today() for i in incidentes))
check("descripción no vacía", all((i.descripcion or "").strip() for i in incidentes))
check("bitácora solo de cerrados",
      {h.incidente_id for h in db.scalars(select(HistorialIncidente)).all()}
      == {i.id for i in incidentes if i.estado == "cerrado"})

print()
print("==Referencias (sin FK huérfanas) ==")
ids_persona = {p.id for p in personas}
ids_equipo = {e.id for e in db.scalars(select(Equipo)).all()}
ids_quimico = {q.id for q in db.scalars(select(InsumoQuimico)).all()}
ids_elemento = {el.id for el in db.scalars(select(ElementoLimpieza)).all()}
check("toda tarea pertenece a un plan", all(t.plan_limpieza_id for t in tareas))
check("ningún registro con producto inexistente", all(r.insumo_quimico_id in ids_quimico for r in registros if r.insumo_quimico_id))
check("ningún registro con elemento inexistente", all(r.elemento_limpieza_id in ids_elemento for r in registros if r.elemento_limpieza_id))
check("ningún registro con usuario inexistente", all(r.usuario_id in ids_persona for r in registros if r.usuario_id))
check("ningún checklist con equipo inexistente", all(c.equipo_id in ids_equipo for c in checklists))
check("ningún incidente con equipo inexistente", all(i.equipo_id in ids_equipo for i in incidentes if i.equipo_id))

print()
print("==Distribución (que los datos no sean todos iguales) ==")
estados = Counter(c.estado for c in checklists)
print(f"  estados de checklist: {dict(estados)}")
# Con muy pocos checklists no puede haber variedad: solo se exige cuando hay
# volumen como para que la distribución signifique algo.
if len(checklists) >= 10:
    check("hay variedad en el estado de checklists", len(estados) >= 2)
tipos_inc = Counter(i.tipo for i in incidentes)
print(f"  tipos de incidente: {dict(tipos_inc)}")
if len(incidentes) >= 10:
    check("hay variedad en tipos de incidente", len(tipos_inc) >= 3)
dnis = Counter(p.dni for p in personas)
check("ningún DNI repetido", all(v == 1 for v in dnis.values()))

print()
print("==Contraseña ==")
from src.auth.services import verificar_password  # noqa: E402
check("el hash del seed verifica con la contraseña del script",
      verificar_password("12345678", personas[0].password))

db.close()

print()
print("==Fechas coherentes ==")
hoy = date.today()
check("ningún fecha_creacion en el futuro",
      all(p.fecha_creacion.date() <= hoy for p in personas))
check("fecha_creacion dentro del último año y medio",
      all((hoy - p.fecha_creacion.date()).days <= 200 for p in personas))
check("ningún checklist en el futuro", all(c.fecha <= hoy for c in checklists))
check("ningún fecha_completado en el futuro",
      all(r.fecha_completado.date() <= hoy for r in registros if r.fecha_completado))
check("historial en la misma fecha que su registro",
      all(h.fecha_evento.date() <= hoy for h in historiales))

print()
print(f"\n{'TODO OK' if not fallas else str(len(fallas)) + ' FALLAS'}")
for f in fallas:
    print("  -", f)
sys.exit(1 if fallas else 0)
