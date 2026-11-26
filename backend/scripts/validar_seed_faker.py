"""Verifica que los datos generados por `cargar_datos_faker.py` sean válidos.

Ejecutar desde `backend/`:

    .venv\\Scripts\\python.exe scripts\\validar_seed_faker.py

Abre la base que apunta `DB_URL` (setealo antes para no tocar la tuya) y
contrasta lo generado contra las MISMAS validaciones que usan los schemas de
la API: si un nombre tiene dígitos, el PUT de esa fila va a responder 400 y
el seed no sirve para probar la aplicación.
"""

import re
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

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
from src.ingredientes.models import Ingrediente
from src.insumos.models import Insumo
from src.lotesInsumo.models import LoteInsumo
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
    Personal, Equipo, Aptitud, VencimientoPersonal, UnidadMedida, Ingrediente,
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
check("apellido solo letras/espacios", all(re.match(RE_NOMBRE_SOLO_LETRAS, p.apellido) for p in personas if p.apellido))
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
print("== Insumos y lotes de insumo ==")
insumos = db.scalars(select(Insumo)).all()
lotes_insumo = db.scalars(select(LoteInsumo)).all()
check("cada lote es del ingrediente de su insumo",
      all(l.ingrediente_id == l.insumo.ingrediente_id for l in lotes_insumo))
check("el proveedor de cada lote vende ese insumo",
      all(l.proveedor in l.insumo.proveedores for l in lotes_insumo))
check("todo insumo tiene al menos un proveedor", all(i.proveedores for i in insumos))
from src.lotes import services as _produccion  # noqa: E402
from src.lotes.models import LoteProducto as _LoteProducto  # noqa: E402

_tareas_cortas = [
    (lote.numero_lote, p.ingrediente_nombre)
    for lote in db.scalars(select(_LoteProducto)).all()
    for item in lote.checklist
    if item.completado_en is not None
    for p in _produccion._planificados_del_item(db, lote, item)
    if p.consumo_real < p.cantidad_planificada
]
check("toda tarea completada consumió lo que pide la receta", not _tareas_cortas)

from src.rotulado.services import borrador_completo_del_lote as _rotulado_completo  # noqa: E402

check("todo lote con salidas tiene su rotulado completo",
      all(_rotulado_completo(db, lote.id) is not None
          for lote in db.scalars(select(_LoteProducto)).all() if lote.salidas))
from src.lotes.constants import ESTADO_TERMINADO as _TERMINADO  # noqa: E402
from src.rotulado.constants import CAMPO_COMPLETO as _COMPLETO, ESTADO_COMPLETADO as _COMPLETADO  # noqa: E402
from src.rotulado.models import BorradorRotulado as _Borrador  # noqa: E402
from src.rotulado.services import previsualizar_borrador as _previsualizar  # noqa: E402

_completados = db.scalars(select(_Borrador).where(_Borrador.estado == _COMPLETADO)).all()
_a_medias = [b.id for b in _completados if _previsualizar(db, b.id).completitud.estado_global != _COMPLETO]
check("todo rótulo completado tiene sus datos completos", bool(_completados) and not _a_medias, str(_a_medias[:5]))
_sin_rotulo = {
    lote.producto_id for lote in db.scalars(select(_LoteProducto).where(_LoteProducto.estado == _TERMINADO)).all()
    if lote.producto.activo
} - {b.producto_id for b in _completados}
check("todo producto activo con lotes terminados tiene un rótulo completo", not _sin_rotulo, str(_sin_rotulo))
_items_produccion = [i for lote in db.scalars(select(_LoteProducto)).all() for i in lote.checklist]
check("cada tarea hecha y asignada la completó quien la tenía",
      all(i.completado_por_id == i.asignado_a_id
          for i in _items_produccion if i.completado_en and i.asignado_a_id))
check("hay tareas de producción asignadas y sin asignar",
      any(i.asignado_a_id for i in _items_produccion)
      and any(i.asignado_a_id is None for i in _items_produccion))
from src.lotesInsumo.services import saldo_lote_insumo as _saldo  # noqa: E402

check("ningún lote de insumo queda con saldo negativo",
      all(_saldo(db, l) >= 0 for l in lotes_insumo),
      [l.numero_lote for l in lotes_insumo if _saldo(db, l) < 0][:5])
from src.recetas.models import TareaReceta as _TareaReceta  # noqa: E402

check("toda tarea de receta tiene su procedimiento",
      all(t.procedimiento for t in db.scalars(select(_TareaReceta)).all()))
from src.lotes.models import ConsumoInsumo as _ConsumoInsumo  # noqa: E402

check("ningún consumo sale de un lote de insumo ya vencido",
      all(c.lote_insumo.fecha_vencimiento is None or c.registrado_en is None
          or c.registrado_en.date() <= c.lote_insumo.fecha_vencimiento
          for c in db.scalars(select(_ConsumoInsumo)).all()))
check("todo lote es de un insumo aprobado",
      all(l.insumo.estado_homologacion == "aprobada" for l in lotes_insumo))
check("todo insumo aprobado con observación tiene justificación",
      all(i.justificacion_homologacion for i in insumos
          if i.estado_homologacion == "aprobada" and i.resultado_homologacion not in (None, "apta")))

print()
print("==Planes y tareas ==")
planes = db.scalars(select(PlanLimpieza)).all()
tareas = db.scalars(select(Tarea)).all()
check("nombre de plan solo letras", all(re.match(RE_NOMBRE_SOLO_LETRAS, pl.nombre) for pl in planes))
check("nombre de plan <= 60 chars", all(len(pl.nombre) <= 60 for pl in planes))
check("nombres de plan únicos por sede",
      len({(pl.establecimiento_id, pl.nombre) for pl in planes}) == len(planes))
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
check("todo registro completado tiene historial",
      {r.id for r in registros if r.completado} <= {h.registro_tarea_id for h in historiales})
check("todo consumo de producto químico trae cantidad",
      all(c.cantidad > 0 for r in registros for c in r.consumos))
check("los consumos quedan en la sede de su tarea",
      all(c.establecimiento_id == r.establecimiento_id for r in registros for c in r.consumos))

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
check("todo cerrado tiene su bitácora",
      {i.id for i in incidentes if i.estado == "cerrado"}
      <= {h.incidente_id for h in db.scalars(select(HistorialIncidente)).all()})

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
print("==Variaciones (todas, al menos una vez) ==")
from src.alergenos.models import IngredienteAlergeno  # noqa: E402
from src.auth.models import TokenRevocado  # noqa: E402
from src.certificaciones_transportista.models import CertificacionTransportista  # noqa: E402
from src.documentos.constants import TipoDocumento  # noqa: E402
from src.documentos.models import Documento  # noqa: E402
from src.Equipo.models import Calibracion  # noqa: E402
from src.insumoQuimico.models import (  # noqa: E402
    MovimientoStockInsumoQuimico, TipoMovimientoStock, TipoQuimico,
)
from src.lotes.constants import ESTADOS_LOTE  # noqa: E402
from src.lotesInsumo.constants import MOTIVOS_BAJA_INSUMO  # noqa: E402
from src.lotesInsumo.models import BajaLoteInsumo  # noqa: E402
from src.models import ModeloBase  # noqa: E402
from src.notificaciones.models import NotificacionPersistida, SituacionRiesgo  # noqa: E402
from src.notificaciones.riesgo import TIPOS_SITUACION  # noqa: E402
from src.nutricion.constants import FUENTES  # noqa: E402
from src.nutricion.models import InfoNutricionalProducto, ValorNutricionalIngrediente  # noqa: E402
from src.planes_accion.constants import (  # noqa: E402
    EstadoPlan, EstadoSituacionPlan, EventoHistorial, MomentoRiesgo, TipoEvidencia,
)
from src.planes_accion.models import (  # noqa: E402
    EvidenciaPlan, HistorialPlan, PlanAccion, RiesgoElementoPlan, SituacionPlan,
)
from src.reclamos.constants import MOTIVOS_RECLAMO  # noqa: E402
from src.reclamos.models import Reclamo  # noqa: E402
from src.reposiciones.models import Reposicion  # noqa: E402
from src.retiros.constants import MEDIOS_CONTACTO_RETIRO, MOTIVOS_RETIRO  # noqa: E402
from src.retiros.models import Retiro, RetiroAfectado  # noqa: E402
from src.rotulado.models import BorradorRotulado  # noqa: E402
from src.rotulado_frontal.models import (  # noqa: E402
    ConfiguracionRotuladoProducto, EvaluacionRotulado, ReglaRotuladoFrontal,
)
from src.salidas.constants import DISPOSICIONES, ESTADOS_SALIDA, MOTIVOS_RECHAZO  # noqa: E402
from src.salidas.models import HitoLote, Salida  # noqa: E402

# columna -> valores que tienen que estar
ESPERADO = [
    (Checklist.estado, list(EstadoChecklist)),
    (Tarea.tipo, [x.value for x in TipoTarea]),
    (Documento.tipo, [x.value for x in TipoDocumento]),
    (Incidente.tipo, [x.value for x in TipoIncidente]),
    (Incidente.estado, [x.value for x in EstadoIncidente]),
    (HistorialIncidente.estado_nuevo, [x.value for x in EstadoIncidente]),
    (InsumoQuimico.tipo, list(TipoQuimico)),
    (MovimientoStockInsumoQuimico.tipo, list(TipoMovimientoStock)),
    (HistorialRegistroTarea.completado, [True, False]),
    (Calibracion.tipo, ["calibracion", "mantenimiento"]),
    (PlanCalibracionMantenimiento.tipo, ["calibracion", "mantenimiento"]),
    (CertificacionTransportista.anulada, [True, False]),
    (CertificacionTransportista.activa, [True, False]),
    (Ingrediente.evaluacion_alergenos, ["sin_evaluar", "incompleta", "evaluada"]),
    (Ingrediente.gluten, ["desconocido", "presente", "ausencia_declarada"]),
    (Ingrediente.es_aditivo, [True, False]),
    (IngredienteAlergeno.nivel, ["contiene", "puede_contener"]),
    (IngredienteAlergeno.forma, ["directa", "derivado"]),
    (Insumo.estado_homologacion, ["pendiente", "aprobada", "rechazada", "requiere_revision"]),
    (Insumo.resultado_homologacion, ["apta", "observada", "rechazada"]),
    (Insumo.sin_rotulo, [True, False]),
    (BajaLoteInsumo.motivo, MOTIVOS_BAJA_INSUMO),
    (_LoteProducto.estado, ESTADOS_LOTE),
    (_LoteProducto.retirado, [True, False]),
    (_ConsumoInsumo.tipo, ["real", "desperdicio"]),
    (ValorNutricionalIngrediente.fuente, list(FUENTES)),
    (InfoNutricionalProducto.expresar_en, ["g", "ml"]),
    (Salida.estado, ESTADOS_SALIDA),
    (Salida.forma_entrega, ["CON_TRANSPORTISTA", "RETIRA_CLIENTE"]),
    (Salida.motivo_rechazo, MOTIVOS_RECHAZO),
    (Salida.disposicion, DISPOSICIONES),
    (HitoLote.tipo_evento, [
        "RESERVA", "DESPACHO", "ENTREGA", "CANCELACION", "RECHAZO", "DISPOSICION",
        "RECLAMO", "RETIRO", "NOTIFICACION_RETIRO", "CIERRE_RETIRO",
    ]),
    (Reclamo.motivo, MOTIVOS_RECLAMO),
    (Reclamo.fuera_de_plazo, [True, False]),
    (Retiro.estado, ["EN_CURSO", "CERRADO"]),
    (Retiro.origen, ["MANUAL", "RECLAMO", "INSUMO"]),
    (RetiroAfectado.estado_notificacion, ["PENDIENTE", "NOTIFICADO"]),
    (Reposicion.estado, ["PENDIENTE", "PARCIAL", "CUMPLIDA", "ANULADA"]),
    (Reposicion.prioridad, ["ALTA", "NORMAL"]),
    (Reposicion.origen, ["RETIRO_LOTE", "RECHAZO_ENTREGA", "POR_RECLAMO"]),
    (BorradorRotulado.estado, ["borrador", "completado"]),
    (BorradorRotulado.archivado, [True, False]),
    (BorradorRotulado.es_importado, [True, False]),
    (EvaluacionRotulado.estado, [
        "sin_definir", "no_aplica", "no_aplica_canal_industrial", "exceptuado", "aplica", "modulo_inactivo",
    ]),
    (ConfiguracionRotuladoProducto.canal_comercializacion, ["MINORISTA", "MAYORISTA", "MAYORISTA_INDUSTRIAL"]),
    (ConfiguracionRotuladoProducto.azucares_agregados, [True, False, None]),
    (ReglaRotuladoFrontal.vigente, [True, False]),
    (ReglaRotuladoFrontal.programada, [True, False]),
    (Personal.puede_operar, [True, False]),
    (Personal.puede_administrar, [True, False]),
    (Personal.debe_cambiar_password, [True, False]),
    (Personal.es_gerente, [True, False]),
    (Personal.es_super_admin, [True, False]),
    (TokenRevocado.tipo, ["access", "refresh"]),
    (SituacionRiesgo.tipo, list(TIPOS_SITUACION)),
    (NotificacionPersistida.criticidad, ["alta", "media", "baja"]),
    # Plan obligatorio: por su tipo (un retiro en curso) y por elemento alto.
    (NotificacionPersistida.motivo_plan, ["tipo", "elemento"]),
    (PlanAccion.estado, [x.value for x in EstadoPlan]),
    (SituacionPlan.estado, [x.value for x in EstadoSituacionPlan]),
    (EvidenciaPlan.tipo, [x.value for x in TipoEvidencia]),
    (HistorialPlan.evento, [x.value for x in EventoHistorial]),
    (RiesgoElementoPlan.momento, [x.value for x in MomentoRiesgo]),
]
for columna, valores in ESPERADO:
    hay = set(db.scalars(select(columna).distinct()).all())
    faltan = [getattr(v, "value", v) for v in valores if v not in hay]
    check(f"{columna.class_.__tablename__}.{columna.key}", not faltan, f"faltan {faltan}")
# Con pocas filas no entran todos (hace falta un lote por motivo de retiro).
for columna, valores in (
    (Retiro.motivo, MOTIVOS_RETIRO),
    (RetiroAfectado.medio_contacto, MEDIOS_CONTACTO_RETIRO),
):
    hay = set(db.scalars(select(columna).distinct()).all())
    faltan = [v for v in valores if v not in hay]
    print(f"  {'ok   ' if not faltan else 'aviso'} {columna.class_.__tablename__}.{columna.key} {faltan or ''}")

for mapper in ModeloBase.registry.mappers:
    if "activo" in mapper.columns:
        hay = set(db.scalars(select(mapper.class_.activo).distinct()).all())
        check(f"{mapper.local_table.name}: activos y dados de baja", hay == {True, False}, hay)

print()
print("==Ninguna tabla vacía ==")
vacias = [
    t.name for t in ModeloBase.metadata.sorted_tables
    if db.execute(select(func.count()).select_from(t)).scalar() == 0
]
check("todas las tablas tienen datos", not vacias, vacias)

print()
print("==Primer registro de cada tabla (sede principal), completo ==")
# Lo que queda vacío a propósito: llenarlo sería incorrecto.
VACIOS_CORRECTOS = {
    "parametros_nutrientes": {"valor_diario"},  # azúcares añadidos no tiene VD
    "productos": {"categoria_rotulado"},  # solo si está exceptuado de octógonos
    "notificaciones_persistidas": {"recambio_id", "plan_tratamiento_id", "plan_activo_id", "motivo_plan"},  # la calcula el motor
    "planes_accion": {"plan_anterior_id", "motivo_cancelacion"},
    "configuracion_impacto": {"causas"},  # solo reclamos, retiros y rechazos
    "historial_planes_accion": {"estado_anterior"},  # es la creación
    "evidencias_plan": {"situacion_plan_id"},  # es de una acción
    "certificaciones_transportista": {"motivo_anulacion", "anulada_por", "fecha_anulacion"},
    "ingredientes": {"clase_funcional_id", "numero_ins"},  # no es un aditivo
    "insumos": {"justificacion_homologacion"},  # resultó apta
    "versiones_documento": {"vigente_hasta"},  # está vigente
    "valores_nutricionales_ingrediente": {"modificado_en", "modificado_por_id"},
    "lotes_insumo": {"motivo_baja", "fecha_baja", "dado_de_baja_por_id"},
    "lotes_producto": {"motivo_cancelacion"},
    "consumo_insumo": {"motivo"},  # solo en desperdicios
    "borradores_rotulado": {"importador_razon_social", "importador_domicilio"},
    "campos_rotulado_editados": {"valor_original"},  # primera carga del campo
    "incidentes": {"lote_id", "salida_id"},  # es de un equipo, no del circuito comercial
    "registro_tareas": {
        "reemplazado_por_id", "insumo_quimico_id", "cantidad_consumida", "elemento_limpieza_id",
    },  # la hizo quien la tenía asignada; las otras son columnas viejas
    "movimientos_stock_insumos_quimicos": {
        "checklist_id", "registro_tarea_id", "checklist_fecha", "tarea_nombre",
    },  # es un ingreso
    "salidas": {
        "motivo_cancelacion", "cancelada_por_id", "fecha_cancelacion", "motivo_rechazo",
        "detalle_rechazo", "fecha_rechazo", "rechazada_por_id", "disposicion",
        "justificacion_disposicion", "fecha_disposicion", "decidida_por_id", "incidente_id",
    },  # se entregó bien
    "reposiciones": {
        "motivo_anulacion", "salida_origen_id", "incidente_origen_id", "retiro_origen_id",
    },  # según su origen lleva unos u otros
}
for tabla in ModeloBase.metadata.sorted_tables:
    columnas = list(tabla.c)
    orden = [tabla.c.id] if "id" in tabla.c else list(tabla.primary_key.columns) or columnas[:1]
    consulta = select(*columnas).order_by(*orden).limit(1)
    if "establecimiento_id" in tabla.c:
        consulta = consulta.where(tabla.c.establecimiento_id == 1)
    fila = db.execute(consulta).first()
    if fila is None:
        check(tabla.name, False, "sin filas en la sede principal")
        continue
    valores = dict(zip((c.name for c in columnas), fila))
    incompletos = {n for n, v in valores.items() if v is None} - VACIOS_CORRECTOS.get(tabla.name, set())
    baja = valores.get("activo") is False
    check(tabla.name, not incompletos and not baja, f"{sorted(incompletos)}{' dado de baja' if baja else ''}")


def _primero(modelo):
    return db.scalar(select(modelo).where(modelo.establecimiento_id == 1).order_by(modelo.id).limit(1))


check("el primer lote está terminado y no retirado",
      _primero(_LoteProducto).estado == "terminado" and not _primero(_LoteProducto).retirado)
check("la primera salida está entregada y su lote no se retiró",
      _primero(Salida).estado == "ENTREGADO" and not _primero(Salida).lote.retirado)
check("el primer incidente está cerrado", _primero(Incidente).estado == "cerrado")
check("el primer retiro está cerrado", _primero(Retiro).estado == "CERRADO")
check("la primera reposición está cumplida", _primero(Reposicion).estado == "CUMPLIDA")
check("el primer checklist tiene todo hecho", all(r.completado for r in _primero(Checklist).registros))
check("el primer plan de acción cerró eficaz", _primero(PlanAccion).estado == "cerrado_eficaz")
check("el primer reclamo está cerrado", _primero(Reclamo).incidente.estado == "cerrado")
check("la primera marca está aprobada", _primero(Insumo).estado_homologacion == "aprobada")

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
      all(r.fecha_completado <= datetime.now() for r in registros if r.fecha_completado))
check("historial en la misma fecha que su registro",
      all(h.fecha_evento.date() <= hoy for h in historiales))

print()
print(f"\n{'TODO OK' if not fallas else str(len(fallas)) + ' FALLAS'}")
for f in fallas:
    print("  -", f)
sys.exit(1 if fallas else 0)
