"""Los casos que el azar de `cargar_datos_faker.py` no garantiza.

El seed principal produce volumen: reparte estados y motivos al azar. Este
módulo agrega, una vez por sede, lo que falte para que CADA variación de cada
entidad aparezca al menos una vez (todos los estados, motivos, orígenes, altas
incompletas, dados de baja...), y al final deja completo el primer registro de
cada tabla, que es el que se usa de muestra.

Lo que sigue reglas de negocio (planes de acción, reclamos, retiros,
reposiciones, checklist) pasa por los services de la aplicación; lo que es un
dato de catálogo se escribe directo.

Se usa desde `cargar_datos_faker.py`, que pasa su propio módulo como `h` para
reutilizar sus ayudantes sin importarlo dos veces.
"""

from __future__ import annotations

import random
from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy import update as sa_update

from src.alergenos.constants import EVALUACION_INCOMPLETA, EVALUACION_SIN_EVALUAR, GLUTEN_DESCONOCIDO
from src.alergenos.models import Alergeno
from src.aditivos.models import ClaseFuncional
from src.aptitud.models import Aptitud
from src.auditoria.models import AuditLog
from src.checklist.models import Checklist, EstadoChecklist, RegistroTarea
from src.checklist.services import marcado as marcado_services
from src.clientes.models import Cliente
from src.documentos.models import Documento
from src.documentos.constants import TipoDocumento
from src.elementoLimpieza.models import ElementoLimpieza
from src.Equipo.models import Calibracion, Equipo
from src.establecimientos.contexto import sede_efectiva
from src.establecimientos.models import Establecimiento
from src.incidente import services as incidente_services
from src.incidente.constants import EstadoIncidente, TipoIncidente
from src.incidente.models import Incidente
from src.ingredientes.models import Ingrediente
from src.insumos.models import Insumo
from src.insumoQuimico.models import InsumoQuimico, StockInsumoQuimico

from src.lotes.constants import ESTADO_TERMINADO
from src.lotes.models import ChecklistProduccion, ConsumoInsumo, LoteProducto
from src.lotesInsumo.models import LoteInsumo
from src.notificaciones import impacto as impacto_services
from src.notificaciones import riesgo
from src.notificaciones import services as notificaciones_services
from src.notificaciones.invalidacion import asegurar_notificaciones_al_dia, invalidar_notificaciones
from src.notificaciones.models import NotificacionLeida, NotificacionPersistida, SituacionRiesgo
from src.notificaciones.schemas import ImpactoSituacionUpdate
from src.nutricion.constants import FUENTE_PROPIO
from src.nutricion.models import (
    AlimentoReferencia,
    InfoNutricionalProducto,
    ValorLaboratorioProducto,
    ValorNutricionalIngrediente,
)
from src.personal.models import Personal
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.PlanLimpieza.models import PlanLimpieza
from src.planes_accion import schemas as plan_schemas
from src.planes_accion import services as plan_services
from src.planes_accion.constants import EstadoPlan
from src.planes_accion.models import (
    AccionPlan,
    EvidenciaPlan,
    HistorialPlan,
    PlanAccion,
    RiesgoElementoPlan,
    SituacionPlan,
)
from src.productos.models import Producto
from src.proveedores.models import Proveedor
from src.reclamos import services as reclamos_services
from src.reclamos.models import Reclamo
from src.reclamos.schemas import ReclamoCerrar
from src.recetas.models import OrdenManualIngrediente, Receta
from src.reposiciones import services as reposiciones_services
from src.reposiciones.constants import (
    ESTADO_REPOSICION_ANULADA,
    ESTADO_REPOSICION_CUMPLIDA,
    ESTADO_REPOSICION_PARCIAL,
)
from src.reposiciones.models import Reposicion
from src.reposiciones.schemas import ReposicionCumplirRequest
from src.retiros import services as retiros_services
from src.retiros.schemas import RetiroMasivoInsumoCreate
from src.rotulado import services as rotulado_services
from src.rotulado.models import BorradorRotulado, RevisionDeclaracionRotulado
from src.rotulado.schemas import BorradorRotuladoCreate, BorradorRotuladoUpdate
from src.rotulado_frontal import services as rotulado_frontal_services
from src.rotulado_frontal.models import ConfiguracionModuloRotulado, ReglaRotuladoFrontal
from src.rotulado_frontal.schemas import ConfiguracionRotuladoIn, ReglaRotuladoIn
from src.salidas import services as salidas_services
from src.salidas.constants import DISPOSICION_DESECHADA, ESTADO_RECHAZADA
from src.salidas.models import Salida, calcular_cantidades
from src.sector.models import Sector
from src.tareas.constants import TipoTarea
from src.tareas.models import Tarea
from src.transportistas.models import Transportista
from src.unidadMedida.models import UnidadMedida
from src.vencimientoPersonal.models import VencimientoPersonal
from src.vistaPublica.models import ConfiguracionVistaPublica

HOY = date.today()
SIN_AUDITAR = {"auditoria_omitir": True, "synchronize_session": False}

PLANTILLA_BEBIDA = {
    "producto": "Bebida láctea de cacao",
    "unidad": "litro",
    "rendimiento": "10",
    "tareas": ["Calentar la leche y disolver los sólidos", "Homogeneizar, enfriar y envasar"],
    "ingredientes": [
        ("Leche entera", "9", "ingrediente", 0),
        # Pesan lo mismo: el orden de la lista lo decide una persona.
        ("Azúcar común", "0.5", "ingrediente", 0),
        ("Cacao amargo", "0.5", "ingrediente", 0),
    ],
}

PLANTILLA_EN_DESARROLLO = {
    "producto": "Pan con sésamo (en desarrollo)",
    "unidad": "kilogramo",
    "rendimiento": "5",
    "tareas": ["Amasar y hornear"],
    "ingredientes": [("Harina 000", "4", "ingrediente", 0), ("Semillas de sésamo", "1", "ingrediente", 0)],
}

PLANTILLA_DISCONTINUADA = {
    "producto": "Budín discontinuado",
    "unidad": "kilogramo",
    "rendimiento": "5",
    "tareas": ["Mezclar y hornear"],
    "ingredientes": [("Harina 000", "3", "ingrediente", 0), ("Azúcar común", "1", "ingrediente", 0)],
}


# ======================================================================
# Ayudantes
# ======================================================================

def _existe(db, modelo, *condiciones) -> bool:
    return db.scalar(select(func.count()).select_from(modelo).where(*condiciones)) > 0


def _primero(db, modelo):
    return db.scalar(select(modelo).order_by(modelo.id).limit(1))


def _lote_con_saldo(db, producto_id: int, cantidad: Decimal, excluir=frozenset()):
    """Un lote sano del producto del que se puedan sacar `cantidad` unidades."""
    for lote in db.scalars(
        select(LoteProducto).where(
            LoteProducto.producto_id == producto_id,
            LoteProducto.estado == ESTADO_TERMINADO,
            LoteProducto.retirado.is_(False),
            LoteProducto.cantidad_producida > 0,
        ).order_by(LoteProducto.id.desc())
    ):
        if lote.id in excluir or (lote.fecha_vencimiento and lote.fecha_vencimiento < HOY):
            continue
        # Como en la reserva: sin rotulado completo no se vende.
        if rotulado_services.borrador_completo_del_lote(db, lote.id) is None:
            continue
        saldo = calcular_cantidades(lote.cantidad_producida, list(lote.salidas), lote.retirado)["saldo"]
        if Decimal(str(saldo)) >= cantidad:
            return lote
    return None


# ======================================================================
# Personas y catálogos
# ======================================================================

def _personas(db, h, fake, vistos: dict, hash_password: str) -> None:
    """Los perfiles que el sorteo no asegura."""
    casos = [
        # (nombre, apellido, teléfono, operar, administrar, activo, debe cambiar la contraseña)
        ("Administración", "Solamente", True, False, True, True, False),
        ("Operación", None, False, True, False, True, False),
        ("Ingreso", "Reciente", True, True, False, True, True),
        ("Egreso", "Anterior", True, True, False, False, False),
    ]
    for indice, (nombre, apellido, telefono, operar, administrar, activo, cambiar) in enumerate(casos):
        dni = h.unico(lambda: str(random.randint(20_000_000, 45_000_000)), vistos["dni"], largo=8)
        db.add(
            Personal(
                nombre=nombre,
                apellido=apellido,
                dni=dni,
                telefono=f"+54911{random.randint(40_000_000, 49_999_999)}" if telefono else None,
                email=h.email_unico(h.slug(f"{nombre}{apellido or ''}"), 900 + indice, vistos["email"]),
                password=hash_password,
                puede_operar=operar,
                puede_administrar=administrar,
                activo=activo,
                debe_cambiar_password=cambiar,
                password_changed_at=None if cambiar else datetime.now() - timedelta(days=90),
                fecha_creacion=datetime.now() - timedelta(days=100),
            )
        )
    db.flush()


def _catalogos(db, h, vistos: dict) -> None:
    """Altas mínimas (solo lo obligatorio) y dados de baja de cada catálogo."""
    agregar = []
    if not _existe(db, Aptitud, Aptitud.descripcion.is_(None)):
        agregar.append(Aptitud(nombre="Auditoría interna", descripcion=None, activo=True))
    if not _existe(db, Aptitud, Aptitud.activo.is_(False)):
        agregar.append(Aptitud(nombre="Curso discontinuado", descripcion="Ya no se dicta.", activo=False))
    agregar.append(Sector(nombre="Depósito sin uso", descripcion=None, activo=False))
    agregar.append(ElementoLimpieza(nombre="Escurridor sin recambio", activo=True))
    agregar.append(
        ElementoLimpieza(
            nombre="Cepillo en desuso", frecuencia_recambio_dias=30,
            fecha_ultimo_recambio=HOY - timedelta(days=200), activo=False,
        )
    )
    cuits = vistos.setdefault("cliente_doc", set())
    agregar.append(
        Cliente(
            nombre="Comercio cerrado", documento=h.cuit_aleatorio(cuits),
            telefono=h.telefono_aleatorio(), activo=False,
        )
    )
    agregar.append(
        Transportista(
            razon_social="Transportes Retirados SA", telefono=h.telefono_aleatorio(), activo=False,
            cuit=h.cuit_aleatorio(vistos.setdefault("transportista_cuit", set())),
        )
    )
    # Proveedor con lo mínimo (sin CUIT, contacto, domicilio ni rubro) y uno de baja.
    matriculas = vistos.setdefault("matricula", set())
    agregar.append(
        Proveedor(nombre="Proveedor sin datos", matricula=h.cuit_aleatorio(matriculas), es_certificado=False)
    )
    cuit = h.cuit_aleatorio(matriculas)
    agregar.append(
        Proveedor(
            nombre="Proveedor dado de baja", matricula=cuit, cuit=cuit, rubro=h.RUBROS_PROVEEDOR[0],
            es_certificado=False, activo=False,
        )
    )
    db.add_all(agregar)
    db.flush()

    # Documentos: los cuatro tipos (la actividad simulada puede borrar alguno).
    carpeta = h.CARPETA_UPLOADS / "documentos"
    carpeta.mkdir(parents=True, exist_ok=True)
    for tipo in TipoDocumento:
        if _existe(db, Documento, Documento.tipo == tipo.value):
            continue
        nombre = f"Documento de muestra: {tipo.value.replace('_', ' ')}"
        documento = Documento(nombre=nombre, tipo=tipo.value)
        db.add(documento)
        db.flush()
        h._guardar_version(
            db, carpeta, documento, numero_version=1, nombre_documento=nombre,
            autor=db.scalar(select(Personal).where(Personal.puede_administrar.is_(True)).order_by(Personal.id)),
            vigente=True, subida=datetime.now() - timedelta(days=30), vencimiento=None, vigente_hasta=None,
        )

    # Una certificación de proveedor sin fecha de emisión.
    certificado = db.scalar(
        select(Proveedor).where(Proveedor.es_certificado.is_(True)).order_by(Proveedor.id.desc())
    )
    if certificado is not None:
        db.add(
            h.CertificacionProveedor(
                proveedor_id=certificado.id, tipo="RNE", numero="RNE-SIN-EMISION", fecha_emision=None,
                fecha_vencimiento=HOY + timedelta(days=90),
                archivo_url=h._pdf_certificado(
                    "certificaciones_proveedores", "certificacion_proveedor", "RNE", "Certificación de proveedor",
                    "RNE-SIN-EMISION", None, HOY + timedelta(days=90),
                ),
            )
        )

    sector = _primero(db, Sector)
    if not _existe(db, Equipo, Equipo.activo.is_(False)):
        db.add(Equipo(nombre="Equipo retirado", tipo="Conservación", sector_id=sector.id, activo=False))
    unidad = db.scalar(select(UnidadMedida).where(UnidadMedida.tipo == "volumen"))
    if not _existe(db, InsumoQuimico, InsumoQuimico.activo.is_(False)):
        db.add(
            InsumoQuimico(
                nombre="Desinfectante discontinuado", tipo=h.TipoQuimico.DESINFECTANTE,
                unidad_medida_id=unidad.id, activo=False,
            )
        )
    for tipo in h.TipoQuimico:
        if not _existe(db, InsumoQuimico, InsumoQuimico.tipo == tipo, InsumoQuimico.activo.is_(True)):
            db.add(
                InsumoQuimico(
                    nombre=f"{tipo.value.capitalize()} de uso general", tipo=tipo, unidad_medida_id=unidad.id,
                )
            )
    db.flush()


def _limpieza(db, h) -> None:
    """Tareas con lo mínimo y de baja; y una tarea marcada, corregida y desmarcada."""
    plan = db.scalar(select(PlanLimpieza).order_by(PlanLimpieza.id.desc()).limit(1))
    if plan is not None:
        db.add_all([
            Tarea(
                nombre="Tarea sin asignar", frecuencia=7, tipo=TipoTarea.OPERACIONAL.value,
                descripcion=None, observaciones=None, operador_id=None, plan_limpieza_id=plan.id,
            ),
            Tarea(
                nombre="Tarea dada de baja", frecuencia=30, tipo=TipoTarea.POSTOPERACIONAL.value,
                descripcion="Ya no corresponde.", activo=False, plan_limpieza_id=plan.id,
            ),
        ])
        db.commit()

    # Un checklist de hoy ya completo, a la espera del cierre del supervisor.
    if not _existe(db, Checklist, Checklist.estado == EstadoChecklist.COMPLETO):
        for checklist in db.scalars(select(Checklist).where(Checklist.fecha == HOY)):
            if checklist.registros and all(r.completado for r in checklist.registros):
                checklist.estado = EstadoChecklist.COMPLETO
                db.commit()
                break

    # Marcar con un consumo, corregir la cantidad y desmarcar: deja el reverso
    # del consumo en el libro de stock y el desmarcado en el historial.
    quimico = db.scalar(
        select(InsumoQuimico)
        .join(StockInsumoQuimico, StockInsumoQuimico.insumo_quimico_id == InsumoQuimico.id)
        .where(InsumoQuimico.activo.is_(True), StockInsumoQuimico.cantidad_actual > 2)
        .order_by(InsumoQuimico.id)
    )
    elemento = db.scalar(select(ElementoLimpieza).where(ElementoLimpieza.activo.is_(True)))
    registro = db.scalar(
        select(RegistroTarea)
        .join(Checklist, Checklist.id == RegistroTarea.checklist_id)
        .join(Tarea, Tarea.id == RegistroTarea.tarea_id)
        .where(
            Checklist.fecha == HOY,
            Checklist.estado == EstadoChecklist.ABIERTO,
            RegistroTarea.completado.is_(False),
            Tarea.activo.is_(True),
        )
        .order_by(RegistroTarea.id)
    )
    admin = db.scalar(
        select(Personal).where(Personal.activo.is_(True), Personal.puede_administrar.is_(True)).order_by(Personal.id)
    )
    if None in (quimico, elemento, registro, admin):
        return
    datos = dict(
        tarea_id=registro.tarea_id, usuario_id=admin.id,
        usuario_nombre=f"{admin.nombre} {admin.apellido or ''}".strip(),
    )
    quimico_id, elemento_id = quimico.id, elemento.id
    db.info["usuario_id"] = admin.id
    try:
        marcado_services.marcar_tarea(
            db, completado=True, evidencia_url=h._imagen("evidencias", "evidencia"),
            consumos=[(quimico_id, 0.5)], elementos_limpieza_ids=[elemento_id], **datos,
        )
        marcado_services.marcar_tarea(
            db, completado=True, evidencia_url=h._imagen("evidencias", "evidencia"),
            consumos=[(quimico_id, 0.3)], elementos_limpieza_ids=[elemento_id], **datos,
        )
        marcado_services.marcar_tarea(db, completado=False, evidencia_url=None, **datos)
    except HTTPException as error:
        db.rollback()
        print(f"   ⚠️  No se pudo simular el desmarcado de una tarea: {error.detail}")
    finally:
        db.info.pop("usuario_id", None)


# ======================================================================
# Producción: ingredientes, marcas, productos
# ======================================================================

def _produccion(db, h, admins, unidades: dict, ingredientes: dict) -> None:
    autor = admins[0]
    proveedor = db.scalar(select(Proveedor).where(Proveedor.activo.is_(True)).order_by(Proveedor.id))

    sesamo = Ingrediente(
        nombre="Semillas de sésamo", unidad_medida_id=unidades["kilogramo"].id,
        evaluacion_alergenos=EVALUACION_SIN_EVALUAR, gluten=GLUTEN_DESCONOCIDO,
    )
    soja = Ingrediente(
        nombre="Proteína de soja texturizada", unidad_medida_id=unidades["kilogramo"].id,
        evaluacion_alergenos=EVALUACION_INCOMPLETA, gluten=GLUTEN_DESCONOCIDO,
        respaldo_alergenos="Falta la ficha técnica del proveedor.",
        observaciones_alergenos="Se pidió la ficha; sin ella no se puede usar.",
        alergenos_actualizado_en=datetime.now() - timedelta(days=5),
        alergenos_actualizado_por_id=autor.id,
    )
    baja = Ingrediente(
        nombre="Grasa vegetal hidrogenada", unidad_medida_id=unidades["kilogramo"].id, activo=False,
    )
    db.add_all([sesamo, soja, baja])
    db.flush()

    # Un valor propio, sin cita ni autor registrado.
    db.add(
        ValorNutricionalIngrediente(
            ingrediente_id=sesamo.id, nutriente="energia", valor=Decimal("573"),
            valor_fuente=Decimal("573"), fuente=FUENTE_PROPIO, referencia=None, cargado_por_id=None,
        )
    )

    # Marcas en cada estado de homologación.
    ahora = datetime.now()
    proveedores = [proveedor] if proveedor is not None else []
    db.add_all([
        Insumo(
            ingrediente=sesamo, marca="Granel Sur", descripcion="A granel, sin rótulo propio",
            codigo_fabricante="GS-001", sin_rotulo=True, estado_homologacion="aprobada",
            resultado_homologacion="apta", homologado_por_id=autor.id,
            homologado_en=ahora - timedelta(days=10), proveedores=proveedores,
        ),
        Insumo(
            ingrediente=sesamo, marca="Los Álamos", descripcion="Integral", codigo_fabricante="LA-778",
            rotulo_referencia="Rótulo del envase de Los Álamos", estado_homologacion="rechazada",
            resultado_homologacion="rechazada",
            justificacion_homologacion="Declara un alérgeno que el ingrediente no contempla.",
            homologado_por_id=autor.id, homologado_en=ahora - timedelta(days=15), proveedores=proveedores,
        ),
        Insumo(
            ingrediente=soja, marca="Campo Nuevo", rotulo_referencia="Rótulo del envase de Campo Nuevo",
            estado_homologacion="requiere_revision", resultado_homologacion="apta",
            homologado_por_id=autor.id, homologado_en=ahora - timedelta(days=200), proveedores=proveedores,
        ),
        Insumo(
            ingrediente=soja, marca="El Molinero", descripcion="Presentación discontinuada",
            activo=False, proveedores=proveedores,
        ),
        # Homologación aprobada que vence en unos días (riesgo "próxima a vencer").
        Insumo(
            ingrediente=sesamo, marca="Semillas del Valle", descripcion="Tostado",
            codigo_fabricante="SV-120", sin_rotulo=True, estado_homologacion="aprobada",
            resultado_homologacion="apta", homologado_por_id=autor.id,
            homologado_en=ahora - timedelta(days=358), proveedores=proveedores,
        ),
    ])
    db.flush()

    # Un producto líquido: tabla nutricional por mililitros y orden manual de
    # dos ingredientes que pesan lo mismo.
    bebida = Producto(
        nombre=PLANTILLA_BEBIDA["producto"], descripcion=None, conservacion=None,
        unidad_medida_id=unidades["litro"].id, activo=True,
    )
    receta = Receta(producto=bebida, activo=True, creado_en=datetime.now() - timedelta(days=60))
    db.add_all([bebida, receta])
    version = h._agregar_version(
        db, receta, 1, PLANTILLA_BEBIDA, ingredientes, unidades, autor, receta.creado_en,
    )
    for tarea in version.tareas:
        tarea.procedimiento = "Seguir el procedimiento de elaboración de bebidas lácteas."
    db.flush()
    db.add(
        InfoNutricionalProducto(
            producto_id=bebida.id, expresar_en="ml", porcion=Decimal("200"),
            medida_casera="1 vaso", densidad_g_ml=Decimal("1.0300"),
        )
    )
    db.add(
        ValorLaboratorioProducto(
            producto_id=bebida.id, nutriente="energia", valor_100=Decimal("78"),
            referencia="Laboratorio de ejemplo, informe 2026-0777",
            fecha_analisis=HOY - timedelta(days=20), cargado_por_id=autor.id,
        )
    )
    for posicion, nombre in enumerate(("Cacao amargo", "Azúcar común"), start=1):
        db.add(
            OrdenManualIngrediente(
                version_receta_id=version.id, ingrediente_id=ingredientes[nombre].id,
                posicion=posicion, decidido_por_id=autor.id,
            )
        )

    # Todavía no se produce: le faltan la porción y los datos del sésamo, así
    # que su tabla nutricional muestra las advertencias.
    en_desarrollo = Producto(
        nombre=PLANTILLA_EN_DESARROLLO["producto"], descripcion="Receta en prueba.",
        unidad_medida_id=unidades["kilogramo"].id, activo=True,
    )
    receta_desarrollo = Receta(producto=en_desarrollo, activo=True, creado_en=datetime.now() - timedelta(days=15))
    db.add_all([en_desarrollo, receta_desarrollo])
    version = h._agregar_version(
        db, receta_desarrollo, 1, PLANTILLA_EN_DESARROLLO, {**ingredientes, sesamo.nombre: sesamo},
        unidades, autor, receta_desarrollo.creado_en,
    )
    for tarea in version.tareas:
        tarea.procedimiento = "Procedimiento en prueba."

    # Categorías exceptuadas de los octógonos (y productos todavía sin receta).
    for nombre, categoria in (
        ("Aceite fraccionado", "aceites_vegetales"),
        ("Nueces fraccionadas", "frutos_secos"),
        ("Sal fina fraccionada", "sal_comun"),
        ("Azúcar fraccionada", "azucar_comun"),
        ("Infusión fraccionada", "otra_exceptuada"),
    ):
        db.add(
            Producto(
                nombre=nombre, descripcion="Se fracciona, no se elabora.", categoria_rotulado=categoria,
                unidad_medida_id=unidades["kilogramo"].id, activo=True,
            )
        )

    # Producto y receta discontinuados, con la versión en su forma mínima.
    viejo = Producto(
        nombre=PLANTILLA_DISCONTINUADA["producto"], descripcion="Se dejó de elaborar.",
        unidad_medida_id=unidades["kilogramo"].id, activo=False,
    )
    receta_vieja = Receta(producto=viejo, activo=False, creado_en=datetime.now() - timedelta(days=300))
    db.add_all([viejo, receta_vieja])
    version = h._agregar_version(
        db, receta_vieja, 1, PLANTILLA_DISCONTINUADA, ingredientes, unidades, autor, receta_vieja.creado_en,
    )
    version.porcion_descripcion = version.porcion_cantidad = version.porcion_unidad_medida_id = None
    version.vida_util_dias = None
    for tarea in version.tareas:
        tarea.procedimiento = "Procedimiento anterior, ya no vigente."
    db.commit()


def _rotulado(db, h, admins) -> None:
    """Un borrador archivado y uno de un producto importado."""
    usuario = admins[0]
    bebida = db.scalar(select(Producto).where(Producto.nombre == PLANTILLA_BEBIDA["producto"]))
    if bebida is None:
        return
    db.info["usuario_id"] = usuario.id
    receta = db.scalar(select(Receta).where(Receta.producto_id == bebida.id))
    version = receta.versiones[-1] if receta is not None and receta.versiones else None
    if version is None:
        return
    # Sin configurar, la evaluación queda "sin definir".
    rotulado_frontal_services.evaluar(db, bebida.id)
    # Primero a granel (no aplica) y después envasada, como queda.
    for envasado in (False, True):
        rotulado_frontal_services.guardar_configuracion(
            db, bebida.id,
            ConfiguracionRotuladoIn(envasado_sin_cliente=envasado, canal_comercializacion="MINORISTA"),
        )
    # Los demás resultados de la evaluación, cada uno en un producto fraccionado.
    for nombre, canal, envasado in (
        ("Azúcar fraccionada", "MINORISTA", True),
        ("Aceite fraccionado", "MAYORISTA", True),
        ("Nueces fraccionadas", "MAYORISTA_INDUSTRIAL", True),
        ("Infusión fraccionada", "MINORISTA", False),
    ):
        producto = db.scalar(select(Producto).where(Producto.nombre == nombre))
        rotulado_frontal_services.guardar_configuracion(
            db, producto.id,
            ConfiguracionRotuladoIn(
                envasado_sin_cliente=envasado, canal_comercializacion=canal,
                categoria_rotulado=producto.categoria_rotulado,
            ),
        )
    for caso in ("archivado", "importado"):
        borrador_id = rotulado_services.crear_borrador(
            db, bebida.id, BorradorRotuladoCreate(producto_id=bebida.id, version_receta_id=version.id), usuario,
        ).id
        if caso == "importado":
            rotulado_services.actualizar_borrador(
                db, borrador_id,
                BorradorRotuladoUpdate(
                    es_importado=True, importador_razon_social="Importadora Andina SRL",
                    importador_domicilio="Av. Corrientes 1234, Buenos Aires",
                ),
                usuario,
            )
        else:
            db.get(BorradorRotulado, borrador_id).archivado = True
            db.commit()
    db.info.pop("usuario_id", None)


# ======================================================================
# Riesgo: todas las situaciones
# ======================================================================

def _situaciones(db, h, admins, operadores) -> None:
    """Al menos una situación presente de cada tipo, y alguna de criticidad alta."""
    equipos = list(db.scalars(select(Equipo).where(Equipo.activo.is_(True)).order_by(Equipo.id)))
    persona = operadores[0]

    # Documentos vencido y próximo a vencer.
    carpeta = h.CARPETA_UPLOADS / "documentos"
    carpeta.mkdir(parents=True, exist_ok=True)
    for nombre, dias in (("Procedimiento vencido", -12), ("Procedimiento próximo a vencer", 5)):
        documento = Documento(nombre=nombre, tipo=TipoDocumento.PROCEDIMIENTO.value)
        db.add(documento)
        db.flush()
        h._guardar_version(
            db, carpeta, documento, numero_version=1, nombre_documento=nombre, autor=admins[0],
            vigente=True, subida=datetime.now() - timedelta(days=200),
            vencimiento=HOY + timedelta(days=dias), vigente_hasta=None,
        )

    # Aptitudes vencida y próxima.
    for nombre, dias in (("Habilitación vencida", -8), ("Habilitación por vencer", 4)):
        aptitud = Aptitud(nombre=nombre, descripcion="Caso de muestra del motor de riesgo.")
        db.add(aptitud)
        db.flush()
        db.add(
            VencimientoPersonal(
                persona_id=persona.id, aptitud_id=aptitud.id, fecha_vencimiento=HOY + timedelta(days=dias),
            )
        )

    if not _existe(db, VencimientoPersonal, VencimientoPersonal.activo.is_(False)):
        aptitud = Aptitud(nombre="Habilitación anterior", descripcion="Reemplazada por otra.")
        db.add(aptitud)
        db.flush()
        db.add(
            VencimientoPersonal(
                persona_id=operadores[-1].id, aptitud_id=aptitud.id,
                fecha_vencimiento=HOY - timedelta(days=300), activo=False,
            )
        )

    # Calibración y mantenimiento, vencidos y próximos, sobre equipos libres.
    ocupados = {
        (p.equipo_id, p.tipo)
        for p in db.scalars(
            select(PlanCalibracionMantenimiento).where(PlanCalibracionMantenimiento.activo.is_(True))
        )
    }
    for tipo in ("calibracion", "mantenimiento"):
        libres = [e for e in equipos[1:] if (e.id, tipo) not in ocupados]
        for equipo, faltan in zip(libres, (-6, 3)):
            db.add(
                PlanCalibracionMantenimiento(
                    equipo_id=equipo.id, autor_id=admins[0].id, tipo=tipo, periodicidad_dias=30,
                    fecha_ultima_intervencion=HOY - timedelta(days=30 - faltan), activo=True,
                )
            )

    # Un plan de limpieza, uno de mantenimiento y una intervención dados de baja.
    inactivo = equipos[-1]
    if not _existe(db, PlanCalibracionMantenimiento, PlanCalibracionMantenimiento.activo.is_(False)):
        db.add(
            PlanCalibracionMantenimiento(
                equipo_id=inactivo.id, autor_id=admins[0].id, tipo="mantenimiento", periodicidad_dias=365,
                fecha_ultima_intervencion=HOY - timedelta(days=400), activo=False,
            )
        )
    if not _existe(db, PlanLimpieza, PlanLimpieza.activo.is_(False)):
        db.add(
            PlanLimpieza(
                nombre="Plan de limpieza anterior", equipo_id=inactivo.id, autor_id=admins[0].id, activo=False,
                tareas=[
                    Tarea(
                        nombre="Tarea del plan anterior", frecuencia=7, tipo=TipoTarea.OPERACIONAL.value,
                        descripcion="Reemplazada por el plan vigente.",
                    )
                ],
            )
        )
    if not _existe(db, Calibracion, Calibracion.activo.is_(False)):
        hecha = HOY - timedelta(days=500)
        db.add(
            Calibracion(
                equipo_id=inactivo.id, fecha_realizacion=hecha, proximo_vencimiento=hecha + timedelta(days=365),
                certificado_url=h._pdf_certificado(
                    "certificados", f"cal_{inactivo.id}", "Calibración cargada por error",
                    "Certificado de calibración", "CAL-00000", hecha, hecha + timedelta(days=365),
                ),
                tipo="calibracion", activo=False,
            )
        )

    # Recambio vencido y próximo.
    for nombre, pasados in (("Paño recambio vencido", 45), ("Paño recambio próximo", 28)):
        db.add(
            ElementoLimpieza(
                nombre=nombre, frecuencia_recambio_dias=30,
                fecha_ultimo_recambio=HOY - timedelta(days=pasados),
            )
        )

    # Stock por debajo del mínimo.
    stock = db.scalar(
        select(StockInsumoQuimico)
        .join(InsumoQuimico, InsumoQuimico.id == StockInsumoQuimico.insumo_quimico_id)
        .where(InsumoQuimico.activo.is_(True))
        .order_by(StockInsumoQuimico.insumo_quimico_id.desc())
    )
    if stock is not None:
        stock.stock_minimo = Decimal(str(stock.cantidad_actual)) + Decimal("2")

    # Un incidente abierto de cada tipo.
    for indice, (tipo, titulo) in enumerate((
        (TipoIncidente.HIGIENE_CONTAMINACION, "Residuo en superficie de contacto"),
        (TipoIncidente.PLAGAS, "Presencia de insectos en depósito"),
        (TipoIncidente.OTRO, "Señalización faltante"),
    )):
        _incidente(db, titulo, tipo, persona, equipos[indice % len(equipos)], dias=2 + indice)
    # Criticidad alta: la misma falla, repetida en el mismo equipo y sin resolver.
    equipo = equipos[-1]
    for dias in (29, 24, 18, 11, 6, 2):
        _incidente(
            db, f"Falla reiterada del motor {dias}", TipoIncidente.FALLA_EQUIPO, persona, equipo, dias=dias,
        )
    db.commit()


def _incidente(db, titulo, tipo, persona, equipo, dias: int) -> Incidente:
    incidente = Incidente(
        titulo=h_recortar(titulo), descripcion=f"{titulo}: detectado durante la recorrida del turno.",
        tipo=tipo.value, equipo_id=equipo.id if equipo is not None else None, usuario_id=persona.id,
        fecha_reporte=datetime.now() - timedelta(days=dias, hours=2), estado=EstadoIncidente.ABIERTO.value,
    )
    db.add(incidente)
    db.flush()
    return incidente


def h_recortar(texto: str) -> str:
    return texto[:60]


# ======================================================================
# Comercial: reclamos, retiros por insumo, reposiciones, incidentes reabiertos
# ======================================================================

def _comercial(db, h, admins) -> None:
    usuario = admins[0]
    db.info["usuario_id"] = usuario.id
    try:
        _reclamos(db, h, usuario)
        _retiro_por_insumo(db, h, usuario)
        _reposiciones(db, h, usuario)
        _reabrir_incidente(db, usuario)
    finally:
        db.info.pop("usuario_id", None)


def _reclamos(db, h, usuario) -> None:
    """Cerrados (con y sin devolución y reposición), reabierto, pendientes y fuera de plazo."""
    reclamos = list(db.scalars(select(Reclamo).order_by(Reclamo.id)))
    if not reclamos:
        return
    if not any(r.fuera_de_plazo for r in reclamos):
        # Una entrega de hace más de un mes, reclamada hoy.
        salida = db.scalar(
            select(Salida)
            .where(Salida.estado == "ENTREGADO", Salida.fecha_entrega <= HOY - timedelta(days=35))
            .order_by(Salida.id.desc())
        )
        if salida is not None:
            reclamos_services.crear_reclamo(
                db, salida_id=salida.id, motivo="envase_danado", detalle="El cliente avisó tarde.",
                fecha_reclamo=HOY, usuario=usuario,
            )

    def cerrar(reclamo, **datos) -> bool:
        try:
            reclamos_services.cerrar_reclamo(db, reclamo.id, ReclamoCerrar(**datos), usuario)
            return True
        except HTTPException:
            db.rollback()
            return False

    def abierto(reclamo) -> bool:
        return reclamo.incidente is not None and reclamo.incidente.estado == EstadoIncidente.ABIERTO.value

    pendientes = [r.id for r in reclamos if abierto(r)]
    guiones = [
        dict(accion_correctiva="Se repuso el producto y se revisó el envasado.", mercaderia_devuelta=True,
             disposicion_fisica="BAJA", reponer=True),
        dict(accion_correctiva="Producto devuelto y descartado.", mercaderia_devuelta=True,
             disposicion_fisica="BAJA", reponer=True),
        dict(accion_correctiva="Se explicó al cliente la forma de conservación.", reponer=False),
        dict(accion_correctiva="Se acordó una nota de crédito.", reponer=True),
        dict(accion_correctiva="Se cambió la etiqueta.", reponer=False),
    ]
    for reclamo_id, guion in zip(pendientes, guiones):
        reclamo = db.get(Reclamo, reclamo_id)
        datos = dict(guion)
        if datos.get("mercaderia_devuelta"):
            cant_dev = h._en_piezas_enteras(reclamo.salida.cantidad, reclamo.lote.producto.unidad_medida)
            if cant_dev > 0:
                datos["cantidad_devuelta"] = cant_dev
            else:
                datos.pop("mercaderia_devuelta", None)
                datos.pop("disposicion_fisica", None)
        if datos.pop("reponer"):
            cantidad = h._en_piezas_enteras(reclamo.salida.cantidad, reclamo.lote.producto.unidad_medida)
            if cantidad > 0:
                datos.update(generar_reposicion=True, cantidad_a_reponer=cantidad)
        cerrar(reclamo, **datos)
    if len(pendientes) >= 5:
        reclamos_services.reabrir_reclamo(
            db, pendientes[4], "El cliente informó que el problema sigue.", usuario,
        )


def _retiro_por_insumo(db, h, usuario) -> None:
    """Un retiro que nace de un lote de insumo, con una reserva que se cancela."""
    primer_lote = db.scalar(select(func.min(LoteProducto.id)))
    primera_salida = _primero(db, Salida)
    protegidos = {primer_lote, primera_salida.lote_id if primera_salida else None}
    primer_insumo = db.scalar(select(func.min(LoteInsumo.id)))
    filas = db.execute(
        select(ConsumoInsumo.lote_insumo_id, LoteProducto.id)
        .join(ChecklistProduccion, ChecklistProduccion.id == ConsumoInsumo.checklist_produccion_id)
        .join(LoteProducto, LoteProducto.id == ChecklistProduccion.lote_producto_id)
        .where(
            LoteProducto.estado == ESTADO_TERMINADO,
            LoteProducto.retirado.is_(False),
            ConsumoInsumo.lote_insumo_id != primer_insumo,
        )
        .order_by(LoteProducto.id.desc())
    ).all()
    cliente = db.scalar(select(Cliente).where(Cliente.activo.is_(True)).order_by(Cliente.id))
    for lote_insumo_id, lote_id in filas:
        lote = db.get(LoteProducto, lote_id)
        if lote_id in protegidos or not lote.salidas:
            continue
        if lote.fecha_vencimiento is None or lote.fecha_vencimiento < HOY:
            continue
        saldo = Decimal(str(salidas_services.calcular_cantidades_lote(db, lote_id)["saldo"]))
        cantidad = h._en_piezas_enteras(h._q(saldo / 2), lote.producto.unidad_medida)
        if cantidad < 2:
            continue
        try:
            # La reserva pendiente se cancela con el retiro y deja una reposición.
            salidas_services.reservar(db, lote_id, cliente.id, cantidad, HOY, usuario)
            retiros_services.iniciar_retiro_masivo_insumo(
                db,
                RetiroMasivoInsumoCreate(
                    lote_insumo_id=lote_insumo_id, lotes_producto_ids=[lote_id],
                    motivo="Insumo defectuoso", detalle="Aviso del proveedor sobre el lote.",
                    fecha_retiro=HOY, desactivar_insumo=False,
                ),
                usuario,
            )
            db.commit()
            return
        except HTTPException:
            db.rollback()


def _reposiciones(db, h, usuario) -> None:
    """Cada estado y cada origen; la primera, cumplida."""
    # De un rechazo sin resolver.
    salida = db.scalar(
        select(Salida).where(Salida.estado == ESTADO_RECHAZADA, Salida.disposicion.is_(None)).order_by(Salida.id)
    )
    if salida is not None:
        cantidad = h._en_piezas_enteras(salida.cantidad, salida.lote.producto.unidad_medida)
        if cantidad > 0:
            try:
                salidas_services.resolver_rechazo(
                    db, salida.id, DISPOSICION_DESECHADA, "Se descarta y se repone al cliente.", usuario,
                    generar_reposicion=True, cantidad_a_reponer=cantidad,
                )
            except HTTPException:
                db.rollback()

    def cumplir(reposicion_id: int, parte: Decimal) -> bool:
        reposicion = db.get(Reposicion, reposicion_id)
        unidad = reposicion.producto.unidad_medida
        cantidad = h._en_piezas_enteras(h._q(Decimal(reposicion.cantidad_pendiente) * parte), unidad)
        if cantidad <= 0:
            return False
        lote = _lote_con_saldo(db, reposicion.producto_id, cantidad)
        if lote is None:
            return False
        try:
            reposiciones_services.cumplir_reposicion(
                db, reposicion_id, ReposicionCumplirRequest(lote_id=lote.id, cantidad_a_reponer=cantidad), usuario,
            )
            return True
        except HTTPException:
            db.rollback()
            return False

    ids = list(db.scalars(select(Reposicion.id).order_by(Reposicion.id)))
    if not ids:
        return
    # La primera, cumplida entera. Si no queda un lote con qué cubrirla, se da
    # por cumplida (se repuso con producción posterior).
    if not cumplir(ids[0], Decimal("1")):
        primera = db.get(Reposicion, ids[0])
        primera.cantidad_pendiente = Decimal("0")
        primera.estado = ESTADO_REPOSICION_CUMPLIDA
        db.commit()
    resto = ids[1:]
    parcial = next((i for i in resto if cumplir(i, Decimal("0.5"))), None)
    if parcial is None and resto:
        reposicion = db.get(Reposicion, resto[0])
        reposicion.cantidad_pendiente = h._q(Decimal(reposicion.cantidad_original) / 2)
        reposicion.estado = ESTADO_REPOSICION_PARCIAL
        parcial = resto[0]
        db.commit()
    libres = [i for i in resto if i != parcial]
    # Con tres o más libres se anula una; siempre queda alguna pendiente.
    if len(libres) >= 2:
        anulada = db.get(Reposicion, libres[-1])
        anulada.estado = ESTADO_REPOSICION_ANULADA
        anulada.motivo_anulacion = "El cliente prefirió una nota de crédito."
        db.commit()


def _reabrir_incidente(db, usuario) -> None:
    """Un incidente cerrado que se vuelve a abrir (su cierre queda en el historial)."""
    primero = db.scalar(select(func.min(Incidente.id)))
    incidente = db.scalar(
        select(Incidente)
        .where(
            Incidente.estado == EstadoIncidente.CERRADO.value,
            Incidente.tipo.in_([t.value for t in (TipoIncidente.FALLA_EQUIPO, TipoIncidente.OTRO)]),
            Incidente.id != primero,
        )
        .order_by(Incidente.id.desc())
    )
    if incidente is not None:
        incidente_services.reabrir_incidente(db, incidente, usuario, "El problema volvió a aparecer.")
        db.commit()


# ======================================================================
# Configuración
# ======================================================================

def _configuracion(db) -> None:
    # Qué genera riesgo lo decide el administrador: un reclamo por sabor u
    # olor anormal también cuenta (primera fila: con causas elegidas).
    impacto_services.fijar_impacto(
        db, "RECLAMO_CLIENTE",
        ImpactoSituacionUpdate(
            causas=["cuerpo_extrano", "posible_afectacion_salud", "sabor_olor_aspecto"]
        ),
    )
    impacto_services.fijar_impacto(db, "OTROS", 2)
    principal = db.scalar(select(func.min(Establecimiento.id)))
    if sede_efectiva(db) != principal:
        # En otra sede el stock de químicos no genera riesgo (solo avisa); y
        # las plagas exigen plan desde el primer reporte.
        impacto_services.fijar_impacto(db, "STOCK_BAJO", ImpactoSituacionUpdate(activo=False))
        impacto_services.fijar_impacto(
            db, "PLAGAS", ImpactoSituacionUpdate(plan_obligatorio=True)
        )
    plan_services.fijar_observacion(db, "FALLA_EQUIPO", 45)


# ======================================================================
# Planes de acción: los ocho estados
# ======================================================================

def _planes(db, h, admins, operadores) -> None:
    equipos = list(db.scalars(select(Equipo).where(Equipo.activo.is_(True)).order_by(Equipo.id)))
    responsable = operadores[0]
    ejecutor = operadores[-1]
    verificadores = [a for a in admins if a.id not in (responsable.id, ejecutor.id)] or admins
    verificador, creador = verificadores[0], verificadores[-1]
    futuro = HOY + timedelta(days=10)
    db.info["usuario_id"] = creador.id

    def situacion_de(titulo, tipo, equipo, dias=120) -> int:
        incidente = _incidente(db, titulo, tipo, responsable, equipo, dias=dias)
        db.commit()
        invalidar_notificaciones(db)
        asegurar_notificaciones_al_dia(db)
        return db.scalar(
            select(SituacionRiesgo.id).where(
                SituacionRiesgo.clave == f"incidente-{incidente.id}", SituacionRiesgo.resuelta_en.is_(None)
            )
        )

    def accion(descripcion, quien=None):
        return plan_schemas.AccionCrear(
            descripcion=descripcion, responsable_id=(quien or ejecutor).id, plazo=futuro,
        )

    def crear(situacion_id, causa, acciones, **extra):
        return plan_services.crear_plan(
            db,
            plan_schemas.PlanCrear(
                situacion_origen_id=situacion_id, causa=causa,
                objetivo="Eliminar la causa y evitar que se repita.",
                criterio_eficacia="Sin nuevas detecciones durante el período de observación.",
                responsable_id=responsable.id, plazo=futuro, acciones=acciones, **extra,
            ),
            creador,
        )

    def implementar(plan):
        if plan.estado == EstadoPlan.BORRADOR.value:
            plan = plan_services.confirmar_plan(db, plan.id, creador)
        for a in plan.acciones:
            if not a.completada:
                plan = plan_services.completar_accion(
                    db, plan.id, a.id, ejecutor, f"Se completó: {a.descripcion}"
                )
        return plan

    def cerrar_incidente_de(situacion_id):
        """Un incidente se cierra en su ficha antes de darlo por corregido."""
        clave = db.get(SituacionRiesgo, situacion_id).clave
        incidente = db.get(Incidente, int(clave.removeprefix("incidente-")))
        if incidente.estado == EstadoIncidente.ABIERTO.value:
            incidente_services.cerrar_incidente(
                db, incidente, verificador, "Causa corregida con el plan de acción."
            )
            db.commit()
            invalidar_notificaciones(db)
            asegurar_notificaciones_al_dia(db)

    def verificar(plan, *resultados):
        for sp, resultado in zip(plan.situaciones, resultados):
            if resultado == "corregida" and sp.verificacion_manual:
                cerrar_incidente_de(sp.situacion_id)
            plan = plan_services.verificar_situacion(
                db, plan.id, sp.id, verificador,
                descripcion="Se recorrió el sector y se revisaron los registros.", resultado=resultado,
            )
        return plan

    def cerrar(plan):
        """Adelanta el motor hasta el fin de la observación y lleva todo al pasado."""
        detalle = plan_services.obtener_plan(db, plan.id)
        fin = detalle.fecha_fin_observacion
        if fin is not None:
            plan_services.sincronizar_con_motor(db, fin)
        _llevar_al_pasado(db, plan.id, detalle.dias_observacion + 20)

    agua = situacion_de("Agua estancada en rejilla", TipoIncidente.HIGIENE_CONTAMINACION, equipos[0])
    # 1. Cerrado eficaz (el primero: completo, con todas las evidencias).
    eficaz = crear(agua, "Rejilla obstruida por falta de desagote.", [accion("Limpiar y desobstruir la rejilla")])
    plan_services.actualizar_plan(
        db, eficaz.id, plan_schemas.PlanActualizar(objetivo="Que la rejilla no vuelva a acumular agua."), creador,
    )
    eficaz = plan_services.agregar_accion(
        db, eficaz.id, accion("Sumar la rejilla al plan de limpieza", responsable), creador,
    )
    verificar(implementar(eficaz), "corregida")
    for evidencia in db.scalars(select(EvidenciaPlan).where(EvidenciaPlan.plan_id == eficaz.id)):
        evidencia.archivo_url = h._pdf_certificado(
            "planes_accion", f"plan{eficaz.id}", "Evidencia del plan", "Evidencia", f"EV-{evidencia.id:04d}",
            HOY, HOY + timedelta(days=365),
        )
        evidencia.nombre_archivo = "evidencia.pdf"
    db.commit()
    cerrar(eficaz)

    # 2. Cerrado parcialmente eficaz: una de las dos situaciones reaparece.
    otro = equipos[1 % len(equipos)]
    s1 = situacion_de("Fuga en manguera", TipoIncidente.FALLA_EQUIPO, equipos[0])
    s2 = situacion_de("Fuga en manguera de repuesto", TipoIncidente.FALLA_EQUIPO, otro)
    parcial = crear(
        s1, "Mangueras de mala calidad.", [accion("Cambiar las mangueras")],
        situaciones_adicionales=[s2], confirma_causa_compatible=True,
    )
    verificar(implementar(parcial), "corregida", "corregida")
    situacion_de("La fuga volvió a aparecer", TipoIncidente.FALLA_EQUIPO, otro, dias=0)
    cerrar(parcial)

    # 3. Cerrado no eficaz.
    s3 = situacion_de("Roedores en el depósito", TipoIncidente.PLAGAS, None)
    no_eficaz = crear(s3, "Aberturas sin protección.", [accion("Colocar burletes")])
    verificar(implementar(no_eficaz), "no_eficaz")
    cerrar(no_eficaz)

    # 4. En verificación (observación en curso).
    s4 = situacion_de("Superficie con residuos", TipoIncidente.HIGIENE_CONTAMINACION, equipos[2 % len(equipos)], 20)
    verificar(implementar(crear(s4, "Detergente mal dosificado.", [accion("Instalar dosificador")])), "corregida")

    # 5. Implementado (falta verificar).
    s5 = situacion_de("Termostato descalibrado", TipoIncidente.FALLA_EQUIPO, equipos[2 % len(equipos)], 15)
    implementar(crear(s5, "Termostato gastado.", [accion("Reemplazar el termostato")]))

    # 6. En ejecución, con una acción vencida.
    s6 = situacion_de("Puerta que no cierra", TipoIncidente.OTRO, equipos[0], 25)
    ejecucion = plan_services.confirmar_plan(
        db,
        crear(s6, "Bisagra vencida.", [accion("Pedir la bisagra"), accion("Colocar la bisagra")]).id,
        creador,
    )
    plan_services.completar_accion(db, ejecucion.id, ejecucion.acciones[0].id, ejecutor, "Pedido enviado al proveedor.")
    db.get(AccionPlan, ejecucion.acciones[1].id).plazo = HOY - timedelta(days=3)
    db.get(PlanAccion, ejecucion.id).plazo = HOY - timedelta(days=1)
    db.commit()

    # 7. Borrador que continúa al que no fue eficaz.
    s7 = situacion_de("Roedores otra vez en el depósito", TipoIncidente.PLAGAS, None, 3)
    crear(s7, "Los burletes no alcanzaron.", [], plan_anterior_id=no_eficaz.id)

    # 8. Cancelado.
    s8 = situacion_de("Iluminación insuficiente", TipoIncidente.OTRO, equipos[-1], 30)
    cancelado = crear(s8, "Luminaria quemada.", [accion("Cambiar la luminaria")])
    plan_services.cancelar_plan(db, cancelado.id, "Se resolvió con una obra ya prevista.", creador)

    # 9. Sobre una situación que detecta el motor (no un incidente).
    libre = next(
        (
            s for s in plan_services.situaciones_disponibles(db)
            if s.tipo not in riesgo.TIPOS_DE_INCIDENTE
        ),
        None,
    )
    if libre is not None:
        plan_services.confirmar_plan(
            db, crear(libre.situacion_id, "Reposición sin planificar.", [accion("Definir el punto de pedido")]).id, creador,
        )

    # 10. La corrige el motor solo (se hizo el recambio) y después se suma evidencia.
    pano = ElementoLimpieza(
        nombre="Paño recambio tratado", frecuencia_recambio_dias=30,
        fecha_ultimo_recambio=HOY - timedelta(days=50),
    )
    db.add(pano)
    db.commit()
    invalidar_notificaciones(db)
    asegurar_notificaciones_al_dia(db)
    situacion_id = db.scalar(
        select(SituacionRiesgo.id).where(
            SituacionRiesgo.elemento == f"elemento:{pano.id}", SituacionRiesgo.resuelta_en.is_(None)
        )
    )
    if situacion_id is not None:
        plan = implementar(crear(situacion_id, "Sin stock de repuestos.", [accion("Comprar repuestos")]))
        db.get(ElementoLimpieza, pano.id).fecha_ultimo_recambio = HOY
        db.commit()
        invalidar_notificaciones(db)
        plan = plan_services.obtener_plan(db, plan.id)
        if plan.estado == EstadoPlan.EN_VERIFICACION.value:
            plan_services.verificar_situacion(
                db, plan.id, plan.situaciones[0].id, verificador,
                descripcion="Foto del elemento nuevo colocado.",
            )
    db.info.pop("usuario_id", None)


def _llevar_al_pasado(db, plan_id: int, dias: int) -> None:
    """Corre todas las fechas de un plan cerrado: se cerró hace poco, no en el futuro."""
    atras = timedelta(days=dias)

    def correr(modelo, *campos, filtro=None):
        for fila in db.scalars(select(modelo).where(filtro if filtro is not None else modelo.plan_id == plan_id)):
            valores = {c: getattr(fila, c) - atras for c in campos if getattr(fila, c) is not None}
            if valores:
                db.execute(
                    sa_update(modelo).where(modelo.id == fila.id).values(**valores).execution_options(**SIN_AUDITAR)
                )

    correr(
        PlanAccion, "plazo", "fecha_creacion", "fecha_implementado", "fecha_inicio_observacion",
        "fecha_fin_observacion", "fecha_cierre", filtro=PlanAccion.id == plan_id,
    )
    correr(AccionPlan, "plazo", "completada_en")
    correr(SituacionPlan, "agregada_en", "verificada_en")
    correr(EvidenciaPlan, "fecha")
    correr(HistorialPlan, "fecha")
    correr(RiesgoElementoPlan, "fecha")
    db.commit()
    db.expire_all()


def marcar_leidas(db) -> None:
    """Notificaciones leídas y no leídas, y una que se reactivó por empeorar."""
    filas = list(db.scalars(select(NotificacionPersistida).order_by(NotificacionPersistida.id)))
    admins = list(
        db.scalars(
            select(Personal)
            .where(Personal.activo.is_(True), Personal.puede_administrar.is_(True))
            .order_by(Personal.id)
        )
    )
    if not (filas and admins):
        return
    for admin in admins[:2]:
        for fila in filas[:: 3]:
            notificaciones_services.marcar_notificacion_leida(db, fila.id_notificacion, True, admin.id)
    grave = next((f for f in filas[:: 3] if f.criticidad != "baja"), None)
    if grave is not None:
        # Se leyó cuando era baja: hoy figura de nuevo como no leída.
        lectura = db.scalar(
            select(NotificacionLeida).where(
                NotificacionLeida.id_notificacion == grave.id_notificacion,
                NotificacionLeida.usuario_id == admins[0].id,
            )
        )
        if lectura is not None:
            lectura.criticidad_leida = "baja"
            db.commit()


# ======================================================================
# Catálogos de toda la empresa
# ======================================================================

def completar_globales(db) -> None:
    """Lo que no es de una sede. Es idempotente: estas tablas no se vacían."""
    if not _existe(db, Alergeno, Alergeno.activo.is_(False)):
        db.add(Alergeno(codigo="en_desuso", nombre="Alérgeno en desuso", condicionada=False, activo=False))
    if not _existe(db, ClaseFuncional, ClaseFuncional.activo.is_(False)):
        db.add(ClaseFuncional(nombre="Clase en desuso", activo=False))
    if not _existe(db, UnidadMedida, UnidadMedida.activo.is_(False)):
        db.add(UnidadMedida(nombre="Unidad en desuso", simbolo="UD", tipo="unidad", factor_a_base=1, activo=False))
    for alimento in db.scalars(select(AlimentoReferencia).where(AlimentoReferencia.codigo.is_(None))):
        alimento.codigo = f"EJ-{alimento.id:03d}"
    db.commit()

    sede = db.scalar(select(Establecimiento).where(Establecimiento.activo.is_(False)))
    if sede is None:
        sede = Establecimiento(
            nombre="Depósito Centro (cerrado)", direccion="San Martín 450, Rawson", activo=False,
        )
        db.add(sede)
        db.commit()
    if db.get(ConfiguracionModuloRotulado, sede.id) is None:
        db.add(ConfiguracionModuloRotulado(establecimiento_id=sede.id, modulo_activo=False))
    if db.get(ConfiguracionVistaPublica, sede.id) is None:
        db.add(ConfiguracionVistaPublica(establecimiento_id=sede.id, habilitada=False, codigo_publico=None))
    db.commit()

    # Reglas de octógonos: una anterior (no vigente) y una programada.
    if not _existe(db, ReglaRotuladoFrontal, ReglaRotuladoFrontal.programada.is_(True)):
        rotulado_frontal_services.crear_regla(
            db,
            ReglaRotuladoIn(
                vigencia_desde=HOY - timedelta(days=900), norma_origen="Versión anterior (ejemplo)",
                requiere_envasado=False, obliga_azucares=False, obliga_grasas=False, obliga_sodio=False,
                obliga_edulcorantes=False, obliga_cafeina=False, validar_ins_edulcorantes=False,
            ),
        )
        programada = rotulado_frontal_services.crear_regla(
            db,
            ReglaRotuladoIn(
                vigencia_desde=HOY + timedelta(days=365), norma_origen="Próxima actualización (ejemplo)",
            ),
        )
        rotulado_frontal_services.activar_regla(db, programada.id)


# ======================================================================
# Primer registro de cada tabla
# ======================================================================

def completar_primeros(db, h) -> None:
    """Termina de completar el primer registro de cada tabla de la sede.

    El seed ya lo generó en su mejor estado (activo, terminado, entregado,
    aprobado, cerrado...); acá se llenan los datos opcionales que quedaban
    vacíos. Lo que sigue vacío es porque llenarlo sería incorrecto: el motivo
    de cancelación de algo que no se canceló, por ejemplo.
    """
    ahora = datetime.now().replace(microsecond=0)
    ayer = ahora - timedelta(days=1)

    def llenar(modelo, **valores) -> None:
        fila_id = db.scalar(select(func.min(modelo.id)))
        if fila_id is None:
            return
        db.execute(sa_update(modelo).where(modelo.id == fila_id).values(**valores).execution_options(**SIN_AUDITAR))

    admin = db.scalar(
        select(Personal).where(Personal.activo.is_(True), Personal.puede_administrar.is_(True)).order_by(Personal.id)
    )
    # En personal y bitácora hay filas de la empresa (sin sede): se completa la
    # primera de todas y la primera de esta sede.
    for modelo, valores in (
        (Personal, dict(password_changed_at=ahora - timedelta(days=60), fecha_actualizacion=ayer, activo=True)),
        (AuditLog, dict(usuario_id=admin.id)),
    ):
        llenar(modelo, **valores)
        propia = db.scalar(select(func.min(modelo.id)).where(modelo.establecimiento_id.is_not(None)))
        db.execute(
            sa_update(modelo).where(modelo.id == propia).values(**valores).execution_options(**SIN_AUDITAR)
        )
    llenar(Ingrediente, densidad_g_ml=Decimal("0.5500"), peso_unitario_g=Decimal("1000"),
           observaciones_alergenos="Revisado contra la ficha técnica del proveedor.",
           alergenos_actualizado_en=ayer, alergenos_actualizado_por_id=admin.id, activo=True)
    llenar(Insumo, descripcion="Presentación de 25 kg", codigo_fabricante="MOL-0001")
    llenar(VencimientoPersonal, fecha_actualizacion=ayer, activo=True)
    llenar(PlanLimpieza, fecha_actualizacion=ayer, activo=True)
    llenar(PlanCalibracionMantenimiento, fecha_actualizacion=ayer, activo=True)
    llenar(Checklist, fecha_actualizacion=ayer)
    llenar(RevisionDeclaracionRotulado, confirmado_por_id=admin.id, confirmado_en=ayer)
    llenar(Reposicion, fecha_registro=ayer)
    producto_id = db.scalar(select(func.min(InfoNutricionalProducto.producto_id)))
    if producto_id is not None:
        db.execute(
            sa_update(InfoNutricionalProducto)
            .where(InfoNutricionalProducto.producto_id == producto_id)
            .values(densidad_g_ml=Decimal("1.3000"), peso_unidad_g=Decimal("454"))
            .execution_options(**SIN_AUDITAR)
        )
    db.commit()
    db.expire_all()


# ======================================================================
# Entrada
# ======================================================================

def completar(
    db, h, fake, *, vistos: dict, hash_password: str, admins: list, operadores: list,
    unidades: dict, ingredientes: dict,
) -> None:
    """Agrega las variaciones que falten en la sede activa."""
    if _existe(db, ElementoLimpieza, ElementoLimpieza.nombre == "Escurridor sin recambio"):
        # Modo `--agregar` sobre una base que ya las tiene.
        print("   Las variaciones ya estaban cargadas en esta sede.")
        return
    print("⏳ Completando las variaciones de cada entidad...")
    admins = [a for a in admins if a.activo and a.puede_administrar]
    operadores = [o for o in operadores if o.activo and o.puede_operar] or admins
    db.info.pop("usuario_id", None)

    _personas(db, h, fake, vistos, hash_password)
    _catalogos(db, h, vistos)
    db.commit()
    _limpieza(db, h)
    _produccion(db, h, admins, unidades, ingredientes)
    _rotulado(db, h, admins)
    _comercial(db, h, admins)
    _configuracion(db)
    _situaciones(db, h, admins, operadores)
    _planes(db, h, admins, operadores)
    db.commit()
    # En los scripts no está la invalidación automática de la app.
    invalidar_notificaciones(db)
