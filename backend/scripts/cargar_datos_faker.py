"""Carga de datos de ejemplo generados con Faker.

Es la alternativa generativa a `cargar_datos.py`: aquel tiene un escenario
curado a mano (15 filas por entidad, pensadas para una demo), este produce
volúmenes configurables y reproducibles, útiles para probar paginación,
filtros y listados en general.

    .venv\\Scripts\\python.exe scripts\\cargar_datos_faker.py
    .venv\\Scripts\\python.exe scripts\\cargar_datos_faker.py --cantidad 40
    .venv\\Scripts\\python.exe scripts\\cargar_datos_faker.py --cantidad 200 --dias-checklist 30
    .venv\\Scripts\\python.exe scripts\\cargar_datos_faker.py --dias-historia 180 --dias-checklist 30  # más rápido
    .venv\\Scripts\\python.exe scripts\\cargar_datos_faker.py --seed 7      # repetible

Faker se usa para lo que le sobra: identidad de las personas (nombre, DNI,
teléfono, email), frases y horas. Para las entidades del dominio (equipos,
productos químicos, tareas, incidentes) se usan vocabularios del rubro
combinados al azar: `fake.word()` devolvería cosas como "Cocina warned" y la
base quedaría inservible para probar la aplicación.

El stock de insumos químicos se arma como un libro coherente: el saldo de cada
producto es la suma de sus ingresos (cada uno con su lote de proveedor), sus
ajustes por conteo y los consumos que informaron los checklists.

También carga la trazabilidad de producción (materias primas, productos con
recetas versionadas, unidades con su tipo y factor e ingredientes con densidad o
peso unitario para la composición porcentual, lotes de insumo por proveedor y lotes de producción con
checklist, consumos reales y desperdicios en los tres estados), la
información nutricional (E11: datos por 100 g de cada materia prima con su
fuente, porción y medida casera de cada producto y un análisis de
laboratorio), la vista pública, sesiones de ejemplo (refresh tokens, revocaciones, intentos de
login) y, al final, recalcula la caché de notificaciones.

Y el circuito comercial: proveedores con CUIT, rubro, certificaciones y los
ingredientes que abastecen; clientes; transportistas con sus certificaciones
(habilitados, vencidos, sin certificar); salidas de producto en todos los
estados (reservada, despachada, entregada, cancelada, rechazada con y sin
resolver), reclamos de clientes, retiros de lote con sus notificaciones y
borradores de rotulado. Las salidas, los reclamos, los retiros y el rotulado
se generan llamando a los services de la aplicación, así los hitos del lote,
los incidentes automáticos y las validaciones quedan igual que en la app.

Los datos con fecha no se reparten parejos: los paneles de cada categoría
grafican su evolución, y una historia uniforme deja todas las curvas planas.
Lotes, incidentes, salidas y checklists siguen un ritmo (`dia_con_ritmo`): más
actividad hacia hoy, olas de varias semanas y fines de semana flojos; y las
categorías (productos, clientes, tipos de incidente, motivos) tienen
favoritos en vez de salir todas por igual. `--dias-historia` y
`--dias-checklist` regulan cuánto se extiende hacia atrás.

Por defecto reemplaza los datos (igual que `cargar_datos.py`); con `--agregar`
conserva lo que hay y agrega nuevas filas sin chocar con los UNIQUE.

Después de las altas, `simular_actividad` opera sobre lo cargado como lo haría
la gente en la app (modificar, dar de baja, reactivar, eliminar, cerrar
incidentes, versionar documentos, consumir stock...) para que la bitácora de
auditoría traiga TODAS las acciones sobre TODAS las entidades. `--sin-actividad`
lo saltea.
"""

import argparse
import math
import os
import random
import re
import secrets
import sys
import unicodedata
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from itertools import chain
from pathlib import Path
from typing import Optional

from faker import Faker
from fastapi import HTTPException
from sqlalchemy import delete, func, inspect, select, text
from sqlalchemy import update as sa_update
from sqlalchemy.exc import IntegrityError

# Permite correr el script desde cualquier directorio.
RAIZ = Path(__file__).resolve().parent.parent
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

# La consola de Windows arranca en cp1252 y no puede codificar los emojis del
# resumen: sin esto el script revienta al final, con datos ya cargados, y el
# error real queda tapado por un UnicodeEncodeError.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError, OSError):
        pass  # salida redireccionada a un archivo: se deja como está

from src.config import settings
from src.database import SessionLocal  # noqa: E402
import src.all_models  # noqa: F401,E402  (registra los modelos)
from src.migrations import crear_tablas_y_migrar  # noqa: E402
from src.auth.services import hashear_password  # noqa: E402
from src.personal.models import Personal  # noqa: E402
from src.auditoria.models import AuditLog  # noqa: E402
from src.sector.models import Sector  # noqa: E402
from src.Equipo.models import Equipo, Calibracion  # noqa: E402
from src.aptitud.models import Aptitud  # noqa: E402
from src.vencimientoPersonal.models import VencimientoPersonal  # noqa: E402
from src.unidadMedida.cantidades import admite_fracciones  # noqa: E402
from src.unidadMedida.constants import equivalencia_conocida  # noqa: E402
from src.unidadMedida.models import UnidadMedida  # noqa: E402
from src.ingredientes.models import Ingrediente  # noqa: E402
from src.aditivos.models import ClaseFuncional  # noqa: E402
from src.aditivos.referencia import ADITIVOS as REFERENCIA_ADITIVOS  # noqa: E402
from src.insumoQuimico.models import (  # noqa: E402
    InsumoQuimico,
    TipoQuimico,
    StockInsumoQuimico,
    LoteStock,
    MovimientoStockInsumoQuimico,
    TipoMovimientoStock,
)
from src.elementoLimpieza.models import ElementoLimpieza  # noqa: E402
from src.PlanLimpieza.models import PlanLimpieza  # noqa: E402
from src.tareas.models import Tarea  # noqa: E402
from src.tareas.constants import TipoTarea  # noqa: E402
from src.incidente.models import Incidente, HistorialIncidente  # noqa: E402
from src.incidente.constants import TipoIncidente, EstadoIncidente  # noqa: E402
from src.checklist.models import (  # noqa: E402
    Checklist,
    RegistroTarea,
    HistorialRegistroTarea,
    EstadoChecklist,
)
from src.PlanCalibracionMantenimiento.models import (  # noqa: E402
    PlanCalibracionMantenimiento,
)
from src.documentos.models import Documento, VersionDocumento  # noqa: E402
from src.documentos.constants import TipoDocumento  # noqa: E402
from src.documentos.pdf_generator import ContextoDocumento, generar_pdf_documento  # noqa: E402
from src.proveedores.models import CertificacionProveedor, Proveedor  # noqa: E402
from src.insumos.models import Insumo, ValorRotuloInsumo, proveedores_insumos  # noqa: E402
from src.alergenos.constants import (  # noqa: E402
    EVALUACION_EVALUADA,
    GLUTEN_AUSENCIA_DECLARADA,
    GLUTEN_PRESENTE,
)
from src.alergenos.models import Alergeno, IngredienteAlergeno, InsumoAlergeno  # noqa: E402
from src.config import CARPETA_UPLOADS  # noqa: E402
from src.notificaciones.models import ConfiguracionAlerta, NotificacionPersistida  # noqa: E402
from src.notificaciones.invalidacion import (  # noqa: E402
    EstadoNotificaciones,
    asegurar_notificaciones_al_dia,
)
from src.productos.models import Producto  # noqa: E402
from src.recetas.models import (  # noqa: E402
    Receta,
    RecetaIngrediente,
    TareaReceta,
    TareaRecetaIngrediente,
    VersionReceta,
)
from src.lotesInsumo.models import BajaLoteInsumo, LoteInsumo  # noqa: E402
from src.lotesInsumo.constants import MOTIVOS_BAJA_INSUMO  # noqa: E402
from src.nutricion.models import (  # noqa: E402
    AlimentoReferencia,
    InfoNutricionalProducto,
    PerfilNutricionalIngrediente,
    ValorLaboratorioProducto,
    ValorNutricionalIngrediente,
)
from src.nutricion.constants import (  # noqa: E402
    CLAVES_NUTRIENTES,
    FUENTE_BASE,
    FUENTE_BIBLIOGRAFIA,
    FUENTE_PROVEEDOR,
)
from src.lotes.models import ChecklistProduccion, ConsumoInsumo, LoteProducto  # noqa: E402
from src.rotulado_frontal.models import (  # noqa: E402
    ConfiguracionRotuladoProducto,
    EvaluacionRotulado,
)
from src.rotulado_frontal import constants as rotulado_frontal_constants  # noqa: E402
from src.rotulado_frontal import services as rotulado_frontal_services  # noqa: E402
from src.rotulado_frontal.schemas import ConfiguracionRotuladoIn  # noqa: E402
from src.lotes.constants import (  # noqa: E402
    ESTADO_CANCELADO,
    ESTADO_EN_PROCESO,
    ESTADO_TERMINADO,
    PREFIJO_NUMERO_LOTE,
    TIPO_CONSUMO_DESPERDICIO,
    TIPO_CONSUMO_REAL,
)
from src.vistaPublica.models import (  # noqa: E402
    ConfiguracionVistaPublica,
    IndicadorVistaPublica,
)
from src.vistaPublica.constants import CATALOGO as CATALOGO_VISTA_PUBLICA  # noqa: E402
from src.auth.models import IntentoLogin, RefreshToken, TokenRevocado  # noqa: E402
from src.common.fechas import hoy as hoy_ar  # noqa: E402
from src.clientes.models import Cliente  # noqa: E402
from src.clientes.schemas import ClienteCreate  # noqa: E402
from src.transportistas.models import Transportista  # noqa: E402
from src.transportistas.schemas import TransportistaCreate  # noqa: E402
from src.certificaciones_transportista.models import CertificacionTransportista  # noqa: E402
from src.certificaciones_transportista.services import normalizar_tipo  # noqa: E402
from src.certificaciones_transportista.estado import (  # noqa: E402
    ESTADO_HABILITADO,
    estado_habilitacion,
)
from src.salidas.models import HitoLote, Salida, SalidaCertificacion  # noqa: E402
from src.salidas import services as salidas_services  # noqa: E402
from src.salidas.constants import (  # noqa: E402
    DISPOSICION_DESECHADA,
    DISPOSICION_REINGRESADA,
    FORMA_ENTREGA_CON_TRANSPORTISTA,
    FORMA_ENTREGA_RETIRA_CLIENTE,
    MOTIVO_RECHAZO_OTRO,
    MOTIVOS_RECHAZO,
)
from src.reclamos.models import Reclamo  # noqa: E402
from src.reclamos import services as reclamos_services  # noqa: E402
from src.reclamos.constants import MOTIVO_RECLAMO_OTRO, MOTIVOS_RECLAMO  # noqa: E402
from src.retiros.models import Retiro, RetiroAfectado  # noqa: E402
from src.retiros import services as retiros_services  # noqa: E402
from src.retiros.constants import (  # noqa: E402
    ESTADO_NOTIFICACION_PENDIENTE,
    MEDIOS_CONTACTO_RETIRO,
    MOTIVOS_RETIRO,
    ORIGEN_RETIRO_MANUAL,
)
from src.rotulado.models import BorradorRotulado, CampoRotuladoEditado  # noqa: E402
from src.rotulado import services as rotulado_services  # noqa: E402
from src.rotulado.schemas import BorradorRotuladoCreate, BorradorRotuladoUpdate  # noqa: E402
from src.rotulado.constants import ESTADO_COMPLETADO  # noqa: E402
from src.rotulado import declaraciones_services  # noqa: E402
from src.rotulado.declaraciones_schemas import (  # noqa: E402
    ConservacionProducto,
    RevisionEsperada,
)
from src.rotulado.models import RevisionDeclaracionRotulado  # noqa: E402

# Contraseña de TODO el personal. Valor acordado con el grupo de desarrollo.
CONTRASENA_POR_DEFECTO = "12345678"
DOMINIO_EMAIL = "alimentosdelsur.com.ar"
HOY = date.today()

# Incidentes que se le asignan al superadmin como reportante: la vista
# "Mis reportes" pagina de a 10, así que con 12 ya hay segunda página.
CANTIDAD_INCIDENTES_SUPERADMIN = 12


# ============================================================
# HELPERS
# ============================================================

# `nombre` de persona, plan y tarea se validan con RE_NOMBRE_SOLO_LETRAS:
# solo letras (con tildes/ñ) y espacios. Ni dígitos ni guiones.
_RE_NO_LETRAS = re.compile(r"[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]")


def solo_letras(valor: str) -> str:
    """Deja solo letras y espacios, como exige RE_NOMBRE_SOLO_LETRAS."""
    return re.sub(r"\s+", " ", _RE_NO_LETRAS.sub(" ", valor or "")).strip()


def recortar(valor: str, largo: int) -> str:
    """Recorta al largo de la columna y quita espacios sobrantes."""
    return (valor or "")[:largo].strip()


def slug(valor: str) -> str:
    """Pasa a ASCII sin acentos, para armar emails válidos."""
    normal = unicodedata.normalize("NFKD", valor or "")
    return re.sub(r"[^a-zA-Z0-9]+", "", normal).lower()


def email_unico(base: str, indice: int, vistos: set) -> str:
    """Arma un email único que cumpla RE_EMAIL y entre en 60 caracteres.

    No se usa `unico()` a propósito: su fallback agrega letras al final, y en
    un email eso lo deja sin dominio (`nombre@dominio abcd`). Acá la
    desambiguación va antes del `@`, así que el resultado siempre es válido.
    """
    for intento in range(1, 1000):
        sufijo = "" if intento == 1 else f".{intento}"
        # Se reserva el lugar del sufijo, la arroba y el dominio.
        disponible = 60 - len(sufijo) - len(DOMINIO_EMAIL) - 1
        correo = f"{base[:disponible]}{sufijo}@{DOMINIO_EMAIL}"
        if correo not in vistos:
            vistos.add(correo)
            return correo
    raise RuntimeError("No se pudo generar un email único")


def unico(generador, vistos: set, largo: int = 0, intentos: int = 500) -> str:
    """Devuelve un valor nuevo cada vez, reintentando si se repite.

    Faker puede repetir (sobre todo con volúmenes altos), y casi todas las
    tablas del dominio tienen UNIQUE. Si se agota la fuente, se desambigua con
    un sufijo de letras, que sigue siendo válido para RE_NOMBRE_SOLO_LETRAS.

    `largo` es el límite de la columna: el sufijo tiene que entrar dentro, así
    que el nombre se recorta ANTES de agregarlo. Sin esto, los nombres que ya
    rozaban el límite se pasaban 5 caracteres por encima de la columna.
    """
    for _ in range(intentos):
        valor = generador()
        if valor and valor not in vistos:
            vistos.add(valor)
            return valor

    # Reserva: agrega letras aleatorias al final hasta salir del conflicto.
    sufijo = " " + "".join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(4))
    while True:
        base = generador()
        if largo:
            base = base[: largo - len(sufijo)].rstrip()
        valor = (base + sufijo).strip()
        if valor not in vistos:
            vistos.add(valor)
            return valor


def hora_aleatoria(dias_atras_max: int = 180, hora_min: int = 6, hora_max: int = 22) -> datetime:
    """Un momento de los últimos días, para `fecha_creacion`.

    Sin esto, `fecha_creacion` caería siempre en hoy y con hora aleatoria,
    lo que deja registros "creados en el futuro" a partir de la medianoche.
    """
    dia = HOY - timedelta(days=random.randint(0, dias_atras_max))
    return datetime.combine(dia, datetime.min.time()).replace(
        hour=random.randint(hora_min, hora_max),
        minute=random.randint(0, 59),
    )


# Desfase de las olas de actividad. Se sortea al usarlo por primera vez, ya
# con la semilla puesta, así cada corrida tiene sus picos en otro lugar.
_FASE_RITMO: Optional[float] = None


def _peso_ritmo(dias_atras: int, dias_max: int) -> float:
    """Cuánta actividad le toca a un día: entre 0 y 1.

    Tres efectos multiplicados: una tendencia que crece hacia hoy (la planta
    produce más que hace un año), olas de unas siete semanas (temporadas) y
    fines de semana con poca actividad.
    """
    global _FASE_RITMO
    if _FASE_RITMO is None:
        _FASE_RITMO = random.uniform(0, 2 * math.pi)
    tendencia = 0.4 + 0.6 * (1 - dias_atras / max(dias_max, 1))
    ola = 1 + 0.5 * math.sin(2 * math.pi * dias_atras / 47 + _FASE_RITMO)
    dia_semana = (HOY - timedelta(days=dias_atras)).weekday()
    semana = 0.2 if dia_semana == 6 else 0.45 if dia_semana == 5 else 1.0
    return tendencia * ola * semana / 1.5


def dia_con_ritmo(dias_max: int, dias_min: int = 0) -> int:
    """Días atrás, sorteados con el ritmo de `_peso_ritmo` en vez de parejos."""
    if dias_max <= dias_min:
        return dias_min
    while True:
        dias = random.randint(dias_min, dias_max)
        if random.random() < _peso_ritmo(dias, dias_max):
            return dias


def pesos_desparejos(n: int) -> list:
    """Pesos para elegir entre `n` opciones con favoritos claros.

    Decaen como una ley de potencias y se mezclan, para que el favorito no
    sea siempre el primero de la lista. Sirven para `random.choices`.
    """
    pesos = [1 / (i + 1) ** 0.9 for i in range(n)]
    random.shuffle(pesos)
    return pesos


def bernoulli(p: float) -> bool:
    return random.random() < p


# ============================================================
# VOCABULARIOS DEL DOMINIO
# ============================================================

# (nombre base, tipo, ubicación)
VOCAB_EQUIPOS = [
    ("Heladera", "Refrigeración", "Cocina"),
    ("Freezer", "Conservación", "Cámara"),
    ("Cámara de frío", "Conservación", "Cámara"),
    ("Horno combinado", "Cocción", "Cocina"),
    ("Freidora", "Cocción", "Cocina"),
    ("Anafe industrial", "Cocción", "Cocina"),
    ("Balanza de precisión", "Medición", "Laboratorio"),
    ("Balanza de plataforma", "Medición", "Zona de elaboración"),
    ("Termómetro digital", "Medición", "Cocina"),
    ("Licuadora industrial", "Procesamiento", "Zona de elaboración"),
    ("Cortadora de fiambres", "Procesamiento", "Zona de elaboración"),
    ("Amasadora", "Procesamiento", "Zona de elaboración"),
    ("Lavavajillas industrial", "Procesamiento", "Lavadero"),
    ("Sobadora", "Procesamiento", "Zona de elaboración"),
    ("Envasadora", "Procesamiento", "Línea deemplace"),
    ("Peladora de papas", "Procesamiento", "Cocina"),
    ("Mesa de acero", "Sanitización", "Zona de elaboración"),
    ("Batea de amasado", "Sanitización", "Zona de elaboración"),
]

VOCAB_APTITUDES = [
    ("Manipulación de Alimentos", "Curso básico de manipulación segura de alimentos."),
    ("Buenas Prácticas de Manufactura", "BPM aplicadas a la elaboración."),
    ("Carnet de Salud", "Carnet sanitario vigente para Manipular alimentos."),
    ("Seguridad e Higiene", "Higiene y seguridad en el puesto de trabajo."),
    ("Manejo de Productos Químicos", "Uso correcto de detergentes y desinfectantes."),
    ("Primeros Auxilios", "Asistencia básica ante accidentes laborales."),
    ("Uso de Matafuegos", "Manejo de extintores ante principio de incendio."),
    ("Cuidado de la Cadena de Frío", "Monitoreo de temperaturas en cámaras y heladeras."),
    ("Frío Industrial", "Operación y mantenimiento de frío industrial."),
    ("Riesgo Eléctrico", "Trabajo seguro con equipos conectados a la red."),
    ("Análisis APPCC", "Puntos críticos de control en el proceso."),
    ("Operación de Equipos de Cocina", "Uso seguro de hornos, freidoras y anafes."),
    ("Higiene Ambiental", "Limpieza y sanidad del ambiente de trabajo."),
    ("Identificación de Plagas", "Detección temprana de roedores e insectos."),
    ("Elaboración de Comidas", "Preparación de comidas en servicio de buffet."),
    ("Trazabilidad de Alimentos", "Registro y seguimiento de lotes elaborated."),
    ("Manejo de Residuos", "Separación y disposición de residuos Hazardosos."),
    ("Prevención de Contaminación Cruzada", "Alérgenos y separación de productos."),
]

# (nombre, tipo químico)
VOCAB_QUIMICOS = [
    ("Lavandina concentrada", TipoQuimico.DESINFECTANTE),
    ("Detergente biodegradable", TipoQuimico.DETERGENTE),
    ("Desengrasante para hornos", TipoQuimico.DESENGRASANTE),
    ("Alcohol 70", TipoQuimico.SANITIZANTE),
    ("Sanitizante para frutas y verduras", TipoQuimico.SANITIZANTE),
    ("Desinfectante de superficies", TipoQuimico.DESINFECTANTE),
    ("Limpiavidrios", TipoQuimico.DETERGENTE),
    ("Quita grasa industrial", TipoQuimico.DESENGRASANTE),
    ("Jabón antibacterial para manos", TipoQuimico.DETERGENTE),
    ("Hipoclorito de sodio", TipoQuimico.DESINFECTANTE),
    ("Desincrustante de acero inoxidable", TipoQuimico.DESENGRASANTE),
    ("Sanitizante de manos alcohólico", TipoQuimico.SANITIZANTE),
    ("Desodorante de ambiente", TipoQuimico.DETERGENTE),
    ("Solución yodada", TipoQuimico.DESINFECTANTE),
    ("Limpiador multiuso", TipoQuimico.DETERGENTE),
    ("Detergente Neutro Concentrado", TipoQuimico.DETERGENTE),
    ("Desinfectante Aniónico", TipoQuimico.DESINFECTANTE),
    ("Enjuague Sanitizante", TipoQuimico.SANITIZANTE),
    ("Removedor de Saratinas", TipoQuimico.DESENGRASANTE),
    ("Cloro Gel", TipoQuimico.DESINFECTANTE),
]

# (nombre, frecuencia de recambio en días o None)
VOCAB_ELEMENTOS = [
    ("Esponja multiuso", 15),
    ("Trapo de microfibra", 20),
    ("Cepillo de cerdas duras", 30),
    ("Escobillón", 45),
    ("Recogedor", None),
    ("Balde de 20 litros", None),
    ("Guantes de látex", 10),
    ("Guantes de nitrilo", 10),
    ("Trapeador de piso", 25),
    ("Pulverizador de un litro", 30),
    ("Paño de algodón", 15),
    ("Cepillo para vajilla", 20),
    ("Rasquete de piso", 60),
    ("Peine limpiador de juntas", 90),
    ("Escobilla sanitaria", 45),
    ("Esponja con fibra abrasiva", 20),
    ("Cubreboca descartable", 7),
    ("Cofia para el pelo", 30),
    ("Cinta de enmascarar", 45),
    ("Bolsa de residuos", None),
]

# Catálogo fijo, no escala con `--cantidad`. Son doce (y no las cinco
# históricas) para que el listado de unidades de medida supere las 10 filas
# de una página y se pueda probar su paginación también.
UNIDADES = [
    ("kilogramo", "kg"),
    ("litro", "L"),
    ("unidad", "u"),
    ("gramo", "g"),
    ("mililitro", "mL"),
    ("tonelada", "t"),
    ("miligramo", "mg"),
    ("centímetro cúbico", "cm³"),
    ("metro", "m"),
    ("centímetro", "cm"),
    ("hora", "h"),
    ("docena", "doc"),
]

# (nombre, clave de unidad, cantidad de tareas que suele tener)
VOCAB_PLANES = [
    ("Limpieza diaria de heladeras", "litro", (2, 4)),
    ("Desinfección de cámara de frío", "litro", (3, 5)),
    ("Mantenimiento de equipos de cocción", "litro", (3, 5)),
    ("Sanitización de zona de elaboración", "mililitro", (3, 6)),
    ("Limpieza de zona deLavadero", "litro", (2, 4)),
    ("Control de cadena de frío", "unidad", (2, 4)),
    ("Limpieza de equipos de medición", "mililitro", (2, 4)),
    ("Higiene de mesas de trabajo", "litro", (2, 4)),
]

VOCAB_TAREAS = [
    "Verificar temperatura interna",
    "Limpiar estantes y bandejas",
    "Sanitizar manijas y burletes",
    "Desinfectar superficies de contacto",
    "Lavar y secar el interior",
    "Revisar el cierre de puertas",
    "Retirar restos y agentes grasosos",
    "Desengrasar componentes internos",
    "Sanitizar filtros y rejillas",
    "Limpiar rodillos y guías",
    "Controlar el estado del cable",
    "Revisar burletes y sellos",
    "Desinfectar piso y desagüe",
    "Limpiar bandejas y rejillas",
    "Verificar el tarado del equipo",
    "Reponer insumos de limpieza",
]

# Palabras clave que definen el producto químico que usa cada tarea.
CONSUMO_POR_PALABRA = [
    (("temperatura", "termostato", "tarado", "verificar"), None),
    (("desengras", "grasa", "horno"), ("Desengrasante para hornos", "Quita grasa industrial")),
    (("sanitiz", "desinfect", "manija"), ("Lavandina concentrada", "Desinfectante de superficies")),
    (("piso", "desagüe", "barrido"), ("Desinfectante de superficies", "Limpiador multiuso")),
    (("lavar", "limpiar", "limpieza"), ("Detergente biodegradable", "Limpiador multiuso")),
]

OBSERVACIONES = [
    "Usar guantes de nitrilo durante toda la operación.",
    "El paño de sanitizado se cambia después de cada uso.",
    "No usar agua hirviendo: daña los sellos.",
    "Prestar atención a las esquinas y debajo de los estantes.",
    "Registrar la operación en la planilla del sector.",
    "Dejar secar completamente antes de reponer los productos.",
    "No mezclar con otros productos químicos.",
    "Verificar la concentración antes de aplicar.",
    "Trabajar con el equipo desenchufado.",
    "El personal debe usar equipo de protección adecuada.",
]


# Cierre de incidentes (se usa al sembrar y al simular el cierre posterior).
OBSERVACIONES_CIERRE = [
    "Se reparó la pieza y se verificó el funcionamiento normal.",
    "Se sanitizó la zona y se reforzó el protocolo.",
    "Se reemplazó el equipo por uno nuevo.",
    "Se capacitó al personal involucrado.",
]

# Observaciones de un supervisor sobre un checklist.
OBSERVACIONES_CHECKLIST = [
    "Se detectó un desvío menor en la ejecución de la tarea.",
    "El supervisor observó falta de evidencia fotográfica.",
    "Se pidió reforzar la sanitización de una superficie.",
]

# Motivos de un egreso de stock de insumos químicos.
MOTIVOS_EGRESO = [
    "Consumo en limpieza de planta",
    "Uso en sanitización de equipos",
    "Reposición en el sector de elaboración",
    "Ajuste por conteo de inventario",
]

# Corrección de un símbolo de unidad de medida ("kg" cargado como "Kg"...).
SIMBOLOS_ALTERNATIVOS = {
    "kg": "Kg", "L": "lt", "u": "un", "g": "gr", "mL": "ml", "t": "tn",
    "mg": "mgr", "cm³": "cc", "m": "mt", "cm": "cms", "h": "hs", "doc": "dz",
}

# ------------------------------------------------------------
# Trazabilidad de producción
# ------------------------------------------------------------

# Materias primas alimentarias (ingredientes que no son aditivos): (nombre, clave de unidad).
# Los descartables y artículos de limpieza no son ingredientes: los químicos van
# en Insumos químicos (con sus lotes) y los elementos, en Elementos de limpieza.
VOCAB_INGREDIENTES = [
    ("Harina 000", "kilogramo"),
    ("Azúcar común", "kilogramo"),
    ("Manteca", "kilogramo"),
    ("Huevo fresco", "unidad"),
    ("Leche entera", "litro"),
    ("Sal fina", "kilogramo"),
    ("Levadura fresca", "gramo"),
    ("Pectina cítrica", "gramo"),
    ("Ácido cítrico", "gramo"),
    ("Sorbato de potasio", "gramo"),
    ("Frutilla fresca", "kilogramo"),
    ("Durazno amarillo", "kilogramo"),
    ("Cacao amargo", "kilogramo"),
    ("Esencia de vainilla", "mililitro"),
    ("Aceite de girasol", "litro"),
    ("Dulce de leche repostero", "kilogramo"),
    ("Tomate triturado", "kilogramo"),
    ("Orégano seco", "gramo"),
    ("Almidón de maíz", "kilogramo"),
    ("Polvo de hornear", "gramo"),
    ("Bicarbonato de sodio", "gramo"),
    ("Coco rallado", "gramo"),
    ("Sucralosa", "gramo"),
    ("Café molido", "gramo"),
]

# Materias primas que son aditivos (E9): nombre del aditivo en la lista de
# referencia que carga la migración (clase funcional, nombre completo, INS).
ADITIVO_DE_INGREDIENTE = {
    "Pectina cítrica": "Pectina",
    "Ácido cítrico": "Ácido cítrico",
    "Sorbato de potasio": "Sorbato de potasio",
    "Esencia de vainilla": "Aroma de vainilla",
    "Polvo de hornear": "Pirofosfato ácido de sodio",
    "Bicarbonato de sodio": "Bicarbonato de sodio",
    "Sucralosa": "Sucralosa",
}

# Porción o unidad de venta por producto: (descripción, cantidad, clave de unidad).
PORCION_POR_PRODUCTO = {
    "Mermelada de frutilla": ("Frasco", "0.454", "kilogramo"),
    "Mermelada de durazno": ("Frasco", "0.454", "kilogramo"),
    "Pan de molde blanco": ("Unidad", "1", "unidad"),
    "Budín de vainilla": ("Unidad", "1", "unidad"),
    "Dulce de leche familiar": ("Pote", "1", "kilogramo"),
    "Salsa de tomate": ("Frasco", "0.34", "kilogramo"),
    "Alfajor de maicena": ("Caja", "12", "unidad"),
    "Galletitas de cacao": ("Paquete", "0.25", "kilogramo"),
}

# E11: datos nutricionales por 100 g de cada materia prima. Valores
# APROXIMADOS para probar la pantalla, no para rotular.
#
#   base          alimento de la base de composición de ejemplo (se toman sus
#                 valores; si la base no lo tiene, se cargan como bibliografía)
#   valores       (energía, carbohidratos, azúcares totales, azúcares añadidos,
#                 proteínas, grasas totales, saturadas, trans, fibra, sodio);
#                 None = sin dato
#   fuente        rótulo del proveedor o bibliografía, con su detalle
#   corregir      {nutriente: valor} cambiado a mano respecto de la fuente
#                 (queda "Modificado" con quién lo hizo)
#   densidad / peso_unidad   se guardan en el Ingrediente (ver `_conversion_ingrediente`)
#   anadidos / aporta        ver PerfilNutricionalIngrediente
#
# Quedan incompletos a propósito el orégano (sin datos) y el coco rallado
# (sin fibra): la salsa de tomate y los alfajores muestran la advertencia.
NUTRICION_INGREDIENTES = {
    "Harina 000": {"base": "Harina de trigo 000", "corregir": {"fibra": "3.1"}},
    "Azúcar común": {"base": "Azúcar blanca", "anadidos": True},
    "Manteca": {"base": "Manteca", "grasas": True},
    "Huevo fresco": {"base": "Huevo entero crudo", "peso_unidad": "50"},
    "Leche entera": {"base": "Leche entera", "densidad": "1.03"},
    "Sal fina": {"base": "Sal fina", "sodio": True},
    "Levadura fresca": {"base": "Levadura fresca"},
    "Aceite de girasol": {"base": "Aceite de girasol", "densidad": "0.92", "grasas": True},
    "Dulce de leche repostero": {"base": "Dulce de leche"},
    "Frutilla fresca": {
        "valores": (32, 7.7, 4.9, 0, 0.7, 0.3, 0, 0, 2.0, 1),
        "fuente": (FUENTE_BIBLIOGRAFIA, "Tabla de composición de alimentos, valores aproximados"),
    },
    "Durazno amarillo": {
        "valores": (39, 9.5, 8.4, 0, 0.9, 0.3, 0, 0, 1.5, 0),
        "fuente": (FUENTE_BIBLIOGRAFIA, "Tabla de composición de alimentos, valores aproximados"),
    },
    "Cacao amargo": {
        "valores": (228, 58, 1.8, 0, 19.6, 13.7, 8.1, 0, 33, 21),
        "fuente": (FUENTE_PROVEEDOR, "Rótulo del proveedor, cacao amargo en polvo"),
    },
    "Tomate triturado": {
        "valores": (24, 4, 3.5, 0, 1.3, 0.2, 0, 0, 1.2, 180),
        "fuente": (FUENTE_PROVEEDOR, "Rótulo del proveedor, tomate triturado"),
        "corregir": {"sodio": "150"},
    },
    "Almidón de maíz": {
        "valores": (381, 91, 0, 0, 0.3, 0.1, 0, 0, 0.9, 9),
        "fuente": (FUENTE_PROVEEDOR, "Rótulo del proveedor, almidón de maíz"),
    },
    "Coco rallado": {
        "valores": (660, 24, 7.4, 0, 6.9, 64.5, 57, 0, None, 37),
        "fuente": (FUENTE_BIBLIOGRAFIA, "Tabla de composición de alimentos, valores aproximados"),
    },
    # Aditivos que aportan sodio de forma relevante: solo energía y sodio.
    "Bicarbonato de sodio": {
        "aporta": True,
        "sodio": True,
        "valores": (0, None, None, None, None, None, None, None, None, 27400),
        "fuente": (FUENTE_BIBLIOGRAFIA, "Ficha técnica del bicarbonato de sodio"),
    },
    "Polvo de hornear": {
        "aporta": True,
        "sodio": True,
        "valores": (53, None, None, None, None, None, None, None, None, 10600),
        "fuente": (FUENTE_PROVEEDOR, "Rótulo del proveedor, polvo de hornear"),
    },
    "Café molido": {
        "cafeina": True,
        "valores": (353, 75, 0, 0, 12, 0.5, 0.2, 0, 0, 2),
        "fuente": (FUENTE_BIBLIOGRAFIA, "Tabla de composición de alimentos, valores aproximados"),
    },
    "Sucralosa": {"edulcorantes": True},
    # Esencia de vainilla, pectina, ácido cítrico y sorbato: aditivos sin
    # datos (no son incompletos); el orégano queda sin cargar.
    "Esencia de vainilla": {"densidad": "0.88"},
}

# Porción y medida casera por producto base (aprox. Anexo I de la Guía de
# Rotulado). `peso_unidad` convierte el rendimiento de las recetas por unidad.
NUTRICION_PRODUCTOS = {
    "Mermelada de frutilla": {"porcion": "20", "medida": "1 cucharada de sopa"},
    "Mermelada de durazno": {"porcion": "20", "medida": "1 cucharada de sopa"},
    "Pan de molde blanco": {"porcion": "50", "medida": "2 rebanadas", "peso_unidad": "600"},
    "Budín de vainilla": {"porcion": "60", "medida": "1 rodaja", "peso_unidad": "450"},
    "Dulce de leche familiar": {"porcion": "20", "medida": "1 cucharada de sopa"},
    "Salsa de tomate": {"porcion": "60", "medida": "1/4 taza"},
    # La receta rinde ~120 g por alfajor (tapas + relleno + coco).
    "Alfajor de maicena": {"porcion": "60", "medida": "1/2 unidad", "peso_unidad": "120"},
    "Galletitas de cacao": {"porcion": "30", "medida": "5 unidades"},
}

# Un análisis de laboratorio, como el sodio de la milanesa de referencia de la
# cátedra: reemplaza al valor calculado y se marca ** en la tabla.
NUTRICION_LABORATORIO = {
    "Dulce de leche familiar": {
        "referencia": "Laboratorio de ejemplo, informe 2026-0412",
        "valores": {"sodio": "95"},
    },
}

# Recetas base. Cada ingrediente es (nombre, cantidad para el rendimiento,
# clasificación, índice de la tarea donde se usa). La cantidad está en la
# unidad del ingrediente, que es la que exige `receta_ingrediente`.
VOCAB_RECETAS = [
    {
        "producto": "Mermelada de frutilla",
        "unidad": "kilogramo",
        "rendimiento": "10",
        "tareas": [
            "Lavar, despalillar y trozar la fruta",
            "Cocinar la fruta con el azúcar y la pectina",
            "Corregir la acidez, conservar y envasar en caliente",
        ],
        "ingredientes": [
            ("Frutilla fresca", "7", "ingrediente", 0),
            ("Azúcar común", "4", "ingrediente", 1),
            ("Pectina cítrica", "50", "aditivo", 1),
            ("Ácido cítrico", "20", "aditivo", 2),
            ("Sorbato de potasio", "10", "aditivo", 2),
        ],
    },
    {
        "producto": "Mermelada de durazno",
        "unidad": "kilogramo",
        "rendimiento": "12",
        "tareas": [
            "Pelar, descarozar y trozar los duraznos",
            "Cocinar con el azúcar hasta punto de gelificación",
            "Envasar en caliente y cerrar al vacío",
        ],
        "ingredientes": [
            ("Durazno amarillo", "8.5", "ingrediente", 0),
            ("Azúcar común", "4.8", "ingrediente", 1),
            ("Pectina cítrica", "60", "aditivo", 1),
            ("Ácido cítrico", "25", "aditivo", 2),
            ("Sucralosa", "5", "aditivo", 2),
        ],
    },
    {
        "producto": "Pan de molde blanco",
        "unidad": "unidad",
        "rendimiento": "20",
        "tareas": [
            "Amasar la harina con la levadura y la sal",
            "Incorporar la manteca y dejar levar en moldes",
            "Hornear, desmoldar y enfriar",
        ],
        "ingredientes": [
            ("Harina 000", "10", "ingrediente", 0),
            ("Levadura fresca", "300", "ingrediente", 0),
            ("Sal fina", "0.2", "ingrediente", 0),
            ("Manteca", "0.5", "ingrediente", 1),
            ("Leche entera", "1.5", "ingrediente", 1),
        ],
    },
    {
        "producto": "Budín de vainilla",
        "unidad": "unidad",
        "rendimiento": "12",
        "tareas": [
            "Batir la manteca con el azúcar",
            "Agregar los huevos y la esencia",
            "Incorporar los secos tamizados",
            "Hornear en moldes enmantecados",
        ],
        "ingredientes": [
            ("Manteca", "1", "ingrediente", 0),
            ("Azúcar común", "1.5", "ingrediente", 0),
            ("Huevo fresco", "24", "ingrediente", 1),
            ("Esencia de vainilla", "30", "aditivo", 1),
            ("Harina 000", "2", "ingrediente", 2),
            ("Polvo de hornear", "60", "aditivo", 2),
        ],
    },
    {
        "producto": "Dulce de leche familiar",
        "unidad": "kilogramo",
        "rendimiento": "8",
        "tareas": [
            "Calentar la leche con el bicarbonato",
            "Agregar el azúcar y reducir revolviendo",
            "Aromatizar, enfriar y envasar",
        ],
        "ingredientes": [
            ("Leche entera", "20", "ingrediente", 0),
            ("Bicarbonato de sodio", "10", "aditivo", 0),
            ("Azúcar común", "4", "ingrediente", 1),
            ("Esencia de vainilla", "20", "aditivo", 2),
        ],
    },
    {
        "producto": "Salsa de tomate",
        "unidad": "kilogramo",
        "rendimiento": "15",
        "tareas": [
            "Calentar el aceite y sofreír los condimentos",
            "Cocinar el tomate a fuego lento",
            "Ajustar la acidez y envasar",
        ],
        "ingredientes": [
            ("Aceite de girasol", "0.5", "ingrediente", 0),
            ("Orégano seco", "50", "ingrediente", 0),
            ("Tomate triturado", "14", "ingrediente", 1),
            ("Sal fina", "0.15", "ingrediente", 1),
            ("Ácido cítrico", "15", "aditivo", 2),
        ],
    },
    {
        "producto": "Alfajor de maicena",
        "unidad": "unidad",
        "rendimiento": "60",
        "tareas": [
            "Preparar la masa y dejar reposar en frío",
            "Estirar, cortar y hornear las tapas",
            "Rellenar con dulce de leche y pasar por coco",
        ],
        "ingredientes": [
            ("Almidón de maíz", "2", "ingrediente", 0),
            ("Harina 000", "1", "ingrediente", 0),
            ("Manteca", "1", "ingrediente", 0),
            ("Azúcar común", "0.8", "ingrediente", 0),
            ("Huevo fresco", "12", "ingrediente", 0),
            ("Polvo de hornear", "30", "aditivo", 1),
            ("Dulce de leche repostero", "2", "ingrediente", 2),
            ("Coco rallado", "200", "ingrediente", 2),
        ],
    },
    {
        "producto": "Galletitas de cacao",
        "unidad": "kilogramo",
        "rendimiento": "6",
        "tareas": [
            "Cremar la manteca con el azúcar",
            "Incorporar huevos, cacao y harina",
            "Formar, hornear y enfriar",
        ],
        "ingredientes": [
            ("Manteca", "1.2", "ingrediente", 0),
            ("Azúcar común", "1.5", "ingrediente", 0),
            ("Huevo fresco", "10", "ingrediente", 1),
            ("Cacao amargo", "0.5", "ingrediente", 1),
            ("Café molido", "100", "ingrediente", 1),
            ("Harina 000", "3", "ingrediente", 1),
            ("Polvo de hornear", "40", "aditivo", 2),
        ],
    },
]

# Sufijos para tener más productos que recetas base con nombres únicos.
VARIANTES_PRODUCTO = [
    "Clásica", "Familiar", "Artesanal", "Premium", "Reducida en azúcar",
    "Sin TACC", "Casera", "Especial", "Línea escolar", "Gastronómica",
]

MOTIVOS_DESPERDICIO = [
    "Derrame durante el pesaje",
    "Producto quemado en la cocción",
    "Envase dañado al abrir",
    "Contaminación por contacto con el piso",
    "Error de dosificación descartado",
]

MOTIVOS_CANCELACION_LOTE = [
    "Corte de energía durante la cocción",
    "Falla del horno: temperatura fuera de rango",
    "Materia prima no conforme detectada en proceso",
    "Pedido cancelado por el cliente",
    "Contaminación cruzada sospechada",
]

OBSERVACIONES_BAJA_INSUMO = [
    "Detectado durante el control de stock.",
    "Producto apartado para descarte.",
    "Baja informada por el proveedor.",
    "Se encontró dañado al revisar el depósito.",
]

# IPs de documentación (RFC 5737): nunca coinciden con quien prueba en local,
# así los intentos de login sembrados no bloquean a nadie de verdad.
IPS_INTENTOS_LOGIN = ["203.0.113.10", "203.0.113.25", "198.51.100.7", "198.51.100.42"]


# --- Circuito comercial: proveedores, clientes, transportistas y salidas ---

RUBROS_PROVEEDOR = [
    "Harinas y cereales", "Lácteos", "Carnes y derivados", "Frutas y verduras",
    "Aceites y grasas", "Aditivos alimentarios", "Envases y embalajes",
    "Productos de limpieza", "Especias y condimentos", "Azúcares y endulzantes",
]

TIPOS_CERTIFICACION_PROVEEDOR = [
    "RNE", "Habilitación municipal", "Certificado SENASA",
    "Buenas Prácticas de Manufactura", "HACCP", "ISO 22000",
]

TIPOS_CERTIFICACION_TRANSPORTISTA = [
    "Habilitación SENASA", "Habilitación municipal", "Verificación técnica vehicular",
    "Seguro de carga", "Libreta sanitaria del chofer",
]

PREFIJOS_TRANSPORTISTA = ["Transportes", "Logística", "Fletes", "Expreso", "Distribuidora"]
SUFIJOS_EMPRESA = ["SA", "SRL", "Hnos", "y Cía"]

MOTIVOS_ANULACION_CERTIFICACION = [
    "Se cargó con el número equivocado.",
    "El comprobante corresponde a otro vehículo.",
    "El organismo emisor la dejó sin efecto.",
]

MOTIVOS_CANCELACION_RESERVA = [
    "El cliente canceló el pedido.",
    "Se reprogramó la entrega para otro lote.",
    "Error al cargar la cantidad reservada.",
    "El cliente no confirmó la compra.",
]

OBSERVACIONES_ENTREGA = [
    "Entrega sin novedades.",
    "Recibido conforme, mercadería en condiciones.",
    "Se entregó en el depósito del cliente.",
    "Se controló la temperatura al recibir.",
]

DETALLES_RECHAZO = [
    "Cajas aplastadas en la base del pallet.",
    "La cámara del camión llegó fuera de temperatura.",
    "El cliente pidió otra presentación.",
    "Envases con pérdida de vacío.",
]

JUSTIFICACIONES_REINGRESO = [
    "Se revisó la mercadería y está en condiciones: vuelve al stock.",
    "El rechazo fue por un error de pedido, el producto no se abrió.",
]

JUSTIFICACIONES_DESECHO = [
    "Se rompió la cadena de frío: no es apta para la venta.",
    "Envases dañados, no se puede garantizar la inocuidad.",
]

DETALLES_RECLAMO = [
    "El cliente informa olor ácido al abrir el envase.",
    "Envase hinchado al momento de recibirlo.",
    "Encontró un fragmento de plástico en el producto.",
    "La etiqueta no indica la fecha de vencimiento.",
    "Refiere malestar después de consumirlo.",
    "La textura no es la habitual.",
]

DETALLES_RETIRO = [
    "Se detectó un desvío en el control de proceso del lote.",
    "Coincide con reclamos recibidos por el mismo lote.",
    "El proveedor informó un problema en la materia prima utilizada.",
    "La etiqueta omite un alérgeno declarado en la receta.",
]

OBSERVACIONES_NOTIFICACION = [
    "Se le pidió que separe la mercadería y no la venda.",
    "Confirmó la recepción del aviso.",
    "Devuelve el producto en la próxima visita.",
    "Informó que ya no tiene unidades en stock.",
]

ACCIONES_CORRECTIVAS = [
    "Se reforzó el control de temperatura en el envasado y se capacitó al turno.",
    "Se cambió de proveedor de la materia prima involucrada y se revisó el ingreso.",
    "Se corrigió el arte de la etiqueta y se agregó una verificación antes de imprimir.",
]

DATOS_ROTULO = {
    "razon_social": "Alimentos del Sur S.A.",
    "domicilio": "Parque Industrial, Trelew, Chubut, Argentina",
    "instrucciones": [
        "Conservar refrigerado entre 2 °C y 8 °C. Una vez abierto, consumir dentro de las 48 horas.",
        "Conservar en lugar fresco y seco. Mantener el envase cerrado.",
        "Mantener congelado a -18 °C. No volver a congelar una vez descongelado.",
    ],
    "contenidos": ["250 g", "500 g", "1 kg", "750 ml", "6 unidades"],
}

CONSERVACIONES_ROTULO = [
    {"instrucciones": "Conservar en lugar fresco y seco. Mantener el envase cerrado."},
    {
        "instrucciones": "Conservar refrigerado entre 2 °C y 8 °C.",
        "temperatura_aplicable": True,
        "temperatura_minima": 2,
        "temperatura_maxima": 8,
    },
    {"instrucciones": "Mantener congelado a -18 °C. No volver a congelar una vez descongelado."},
]


def _preparar_declaraciones_rotulado(db, producto, version) -> None:
    """Completa los maestros mínimos que exige la confirmación de declaraciones.

    Cada ingrediente de la receta queda evaluado: sus alérgenos ya están en
    `ingredientes_alergenos` y el gluten sale de si contiene un cereal con gluten.
    """
    if not producto.conservacion:
        producto.conservacion = random.choice(CONSERVACIONES_ROTULO)
    for linea in version.ingredientes:
        _evaluar_alergenos_ficticio(db, linea.ingrediente)
    db.commit()


def _evaluar_alergenos_ficticio(db, ingrediente) -> None:
    if ingrediente.evaluacion_alergenos == EVALUACION_EVALUADA:
        return
    con_gluten = db.scalar(
        select(IngredienteAlergeno.alergeno_id)
        .join(Alergeno, Alergeno.id == IngredienteAlergeno.alergeno_id)
        .where(
            IngredienteAlergeno.ingrediente_id == ingrediente.id,
            IngredienteAlergeno.nivel == "contiene",
            Alergeno.codigo.in_(CEREALES_CON_GLUTEN),
        )
    )
    ingrediente.evaluacion_alergenos = EVALUACION_EVALUADA
    ingrediente.gluten = GLUTEN_PRESENTE if con_gluten else GLUTEN_AUSENCIA_DECLARADA
    ingrediente.respaldo_alergenos = "Ficha técnica ficticia para datos de desarrollo."


def _descripcion_tarea(equipo_nombre: str) -> str:
    """Arma un procedimiento paso a paso creíble para la tarea."""
    pasos = [
        f"Retirar los productos y las piezas sueltas de {equipo_nombre}.",
        "Aplicar el producto de limpieza diluido según el fabricante.",
        "Frotar con el elemento asignado hasta cubrir toda la superficie.",
        "Enjuagar con agua potable en el caso de superficies de contacto con alimentos.",
        "Sanitizar y dejar secar al aire.",
        "Reponer las piezas en su lugar y registrar la operación.",
    ]
    cantidad = random.randint(3, len(pasos))
    elegidas = random.sample(pasos, cantidad)
    return "\n".join(f"{i}. {p}" for i, p in enumerate(elegidas, start=1))


# (tipo de incidente, título, descripción)
VOCAB_INCIDENTES = [
    (
        TipoIncidente.FALLA_EQUIPO,
        "El equipo no alcanza la temperatura esperada",
        "El termómetro de control marca una diferencia consistente con la lectura del equipo. Se sospecha desgaste del sistema de frío.",
    ),
    (
        TipoIncidente.FALLA_EQUIPO,
        "Goteo de agua en la puerta",
        "Se acumula agua en el piso frente al equipo, con goteo constante por la puerta.",
    ),
    (
        TipoIncidente.HIGIENE_CONTAMINACION,
        "Superficie de contacto sin sanitizar",
        "Se detectó residuo en una superficie que entra en contacto directo con alimentos.",
    ),
    (
        TipoIncidente.HIGIENE_CONTAMINACION,
        "Alimento fuera del rango de temperatura",
        "Se detectó mercadería que conserva fuera del rango de temperatura permitido.",
    ),
    (
        TipoIncidente.PLAGAS,
        "Indicios de actividad de plagas",
        "Se observaron marcas y residuo cerca de la zona de almacenamiento de secos.",
    ),
    (
        TipoIncidente.DEVOLUCION_CLIENTE,
        "Devolución por producto en mal estado",
        "El cliente devolvió el producto por presentación y conservación deficientes.",
    ),
    (
        TipoIncidente.OTRO,
        "Falta de elemento de protección",
        "Se detectó que un elemento de limpieza del plan no está disponible en el sector.",
    ),
    (
        TipoIncidente.OTRO,
        "Desvío de temperatura en cámara",
        "El registro de temperatura de la cámara quedó fuera de rango durante varias horas.",
    ),
]

# (base del nombre, tipo de documento)
VOCAB_DOCUMENTOS = [
    ("Manual de Buenas Prácticas de Manufactura", TipoDocumento.MANUAL_BPM),
    ("Manual de Higiene y Seguridad", TipoDocumento.MANUAL_BPM),
    ("Plan de Capacitación Anual", TipoDocumento.MANUAL_BPM),
    ("Procedimiento de Limpieza y Desinfección", TipoDocumento.PROCEDIMIENTO),
    ("Procedimiento de Manipulación de Alimentos", TipoDocumento.PROCEDIMIENTO),
    ("Procedimiento de Control de Plagas", TipoDocumento.PROCEDIMIENTO),
    ("Procedimiento de Trazabilidad de Lotes", TipoDocumento.PROCEDIMIENTO),
    ("Protocolo de Acción ante Incidentes", TipoDocumento.PROCEDIMIENTO),
    ("Ficha técnica de Heladera", TipoDocumento.FICHA_TECNICA),
    ("Ficha técnica de Cámara de frío", TipoDocumento.FICHA_TECNICA),
    ("Ficha técnica de Horno combinado", TipoDocumento.FICHA_TECNICA),
    ("Ficha técnica de Balanza de precisión", TipoDocumento.FICHA_TECNICA),
    ("Receta de Flan casero", TipoDocumento.RECETA),
    ("Receta de Pan de mesa", TipoDocumento.RECETA),
    ("Receta de Mousse de chocolate", TipoDocumento.RECETA),
]


# ============================================================
# GENERADORES
# ============================================================

def borrar_todo(db) -> None:
    """Limpia las tablas que el seed va a rellenar (orden: hijos primero)."""
    orden = [
        # La bitácora describe filas que se van a borrar y cuyos ids se
        # reutilizan: dejarla mezclaría historias de datos distintos.
        AuditLog,
        # Caché derivada: se recalcula al final con lo recién cargado.
        NotificacionPersistida,
        EstadoNotificaciones,
        # Circuito comercial (hijos primero): cuelga de lotes, productos,
        # incidentes y personal, así que se borra antes que todos ellos.
        CampoRotuladoEditado,
        RevisionDeclaracionRotulado,
        BorradorRotulado,
        RetiroAfectado,
        Retiro,
        Reclamo,
        SalidaCertificacion,
        HitoLote,
        Salida,
        CertificacionTransportista,
        Transportista,
        Cliente,
        CertificacionProveedor,
        proveedores_insumos,
        # Historial de evaluaciones de rotulado: los productos se recrean.
        EvaluacionRotulado,
        # Configuración manual por producto (cuelga de productos).
        ConfiguracionRotuladoProducto,
        # Trazabilidad (hijos primero). El borrado masivo no dispara los
        # eventos del ORM que protegen versiones de receta y lotes cerrados.
        # Información nutricional (E11). La base de composición y los
        # parámetros son de la migración y no se tocan.
        ValorLaboratorioProducto,
        InfoNutricionalProducto,
        ValorNutricionalIngrediente,
        PerfilNutricionalIngrediente,
        ConsumoInsumo,
        BajaLoteInsumo,
        ChecklistProduccion,
        LoteProducto,
        LoteInsumo,
        # Las marcas compradas: cuelgan del ingrediente y las referencian los lotes.
        ValorRotuloInsumo,
        InsumoAlergeno,
        Insumo,
        # Alérgenos de cada ingrediente (el catálogo es de la migración y no se toca).
        IngredienteAlergeno,
        TareaRecetaIngrediente,
        RecetaIngrediente,
        TareaReceta,
        VersionReceta,
        Receta,
        Producto,
        HistorialRegistroTarea,
        HistorialIncidente,
        # Los movimientos pueden referenciar registros y checklists. Los lotes
        # a su vez referencian su movimiento de ingreso, por eso van primero.
        LoteStock,
        MovimientoStockInsumoQuimico,
        RegistroTarea,
        Checklist,
        Incidente,
        VersionDocumento,
        Documento,
        VencimientoPersonal,
        Calibracion,
        StockInsumoQuimico,
        PlanCalibracionMantenimiento,
        Tarea,
        PlanLimpieza,
        InsumoQuimico,
        Ingrediente,
        ElementoLimpieza,
        Aptitud,
        UnidadMedida,
        Equipo,
        Sector,
        Proveedor,
        # Personal NO se borra por defecto (script peligroso en producción).
    ]
    # Tablas legacy de la migración de trazabilidad (sin modelo ORM): siguen
    # referenciando `ingredientes`, así que hay que vaciarlas antes del DELETE.
    existentes = set(inspect(db.get_bind()).get_table_names())
    for tabla_vieja in ("lotes_insumos", "lotes"):
        if tabla_vieja in existentes:
            db.execute(text(f'DELETE FROM "{tabla_vieja}"'))
    for modelo in orden:
        # Borrado masivo a propósito: este seed SÍ audita lo que carga, pero el
        # vaciado previo no es una operación de negocio que deba registrarse.
        db.execute(delete(modelo).execution_options(auditoria_omitir=True))
    db.flush()


def valores_existentes(db, columna) -> set:
    """Valores ya presentes en la columna, para no chocar en modo `--agregar`."""
    return set(db.scalars(select(columna)).all())


def crear_unidades(db, vistos: dict) -> dict:
    """Unidades de medida: catálogo fijo, no escala con `--cantidad`.

    Se crean las doce de `UNIDADES` (menos las que ya existan en modo
    `--agregar`): el resto del seed elige al azar entre ellas para las
    unidades de los ingredientes.
    """
    print("⏳ Cargando unidades de medida...")
    for nombre, simbolo in UNIDADES:
        if nombre in vistos["unidad"]:
            continue
        db.add(UnidadMedida(nombre=nombre, simbolo=simbolo, **(equivalencia_conocida(nombre, simbolo) or {})))
        vistos["unidad"].add(nombre)
    db.flush()
    return {u.nombre: u for u in db.query(UnidadMedida).all()}


def crear_configuracion_alertas(db):
    """Carga valores por defecto de configuración de alertas si no existen."""
    print("⏳ Cargando configuración de alertas...")
    defaults = {
        "vencimiento_proximo_dias": 7,
        "alerta_calibracion_dias": 30,
        "alerta_insumo_bajo_stock": 10,
    }
    for clave, valor in defaults.items():
        existente = db.get(ConfiguracionAlerta, clave)
        if existente is None:
            db.add(ConfiguracionAlerta(clave=clave, valor=valor))
    db.flush()


def crear_personal(db, cantidad: int, fake: Faker, vistos: dict, hash_password: str) -> list:
    """Personas: 1 super admin, ~15% administradores y el resto operadores."""
    print(f"⏳ Cargando {cantidad} personas...")
    personas = []
    emails, dnis = vistos["email"], vistos["dni"]

    for i in range(cantidad):
        nombre = recortar(solo_letras(fake.first_name()), 40)
        apellido = recortar(solo_letras(fake.last_name()), 40)

        es_super_admin = i == 0
        es_admin = es_super_admin or bernoulli(0.15)
        puede_operar = es_super_admin or bernoulli(0.8)
        # La API exige al menos una capacidad por persona (`validar_capacidades`):
        # alguien sin ninguna no se podría volver a crear ni editar por el endpoint.
        if not es_admin and not puede_operar:
            puede_operar = True

        dni = unico(lambda: str(random.randint(20_000_000, 45_000_000)), dnis, largo=8)
        # Armado a mano para que siempre sea único y entre en 60 caracteres.
        base = slug(f"{nombre}{apellido}") or f"usuario{i}"
        email = email_unico(base, i, emails)
        telefono = unico(
            lambda: f"+549{random.randint(11, 292)}{random.randint(10_000_000, 99_999_999)}",
            vistos["telefono"],
            largo=15,
        )

        persona = Personal(
            nombre=nombre,
            apellido=apellido,
            dni=dni,
            telefono=telefono,
            email=email,
            password=hash_password,
            puede_operar=puede_operar,
            puede_administrar=es_admin,
            es_super_admin=es_super_admin,
            # Se mantienen activos los que administran: un admin dado de baja
            # deja la base sin administración para probar.
            activo=bool(es_admin or not bernoulli(0.08)),
            # Es data de prueba con contraseña conocida: no se fuerza el cambio
            # en el primer login.
            debe_cambiar_password=False,
            fecha_creacion=hora_aleatoria(hora_max=20),
        )
        db.add(persona)
        personas.append(persona)

    db.flush()
    return personas


def obtener_o_crear_sector(db, nombre: str) -> Sector:
    """Devuelve el sector con ese nombre, creándolo si no existe.

    La ubicación del equipo pasó a ser su propia entidad (FK
    `equipos.sector_id`, ver src/sector/models.py). En modo `--agregar` los
    sectores ya existentes se reutilizan en vez de chocar con el UNIQUE.
    """
    sector = db.scalar(select(Sector).where(Sector.nombre == nombre))
    if sector is None:
        sector = Sector(nombre=nombre, activo=True)
        db.add(sector)
        db.flush()
    return sector


def crear_equipos(db, cantidad: int, vistos: dict) -> list:
    print(f"⏳ Cargando {cantidad} equipos...")
    equipos = []
    for _ in range(cantidad):
        base, tipo, ubicacion = random.choice(VOCAB_EQUIPOS)
        nombre = unico(lambda: f"{base} {random.randint(1, 30)}", vistos["equipo"], largo=100)
        # Los equipos de medición se calibran; los de proceso, no necesariamente.
        frecuencia = random.choice([None, 90, 180, 365]) if tipo == "Medición" else random.choice(
            [None, None, 180, 365]
        )
        equipos.append(
            Equipo(
                nombre=recortar(nombre, 100),
                tipo=tipo,
                sector_id=obtener_o_crear_sector(db, ubicacion).id,
                activo=not bernoulli(0.06),
                frecuencia_calibracion_dias=frecuencia,
            )
        )
    db.add_all(equipos)
    db.flush()
    return equipos


def crear_aptitudes(db, cantidad: int, vistos: dict) -> list:
    print(f"⏳ Cargando {cantidad} aptitudes...")
    aptitudes = []
    for _ in range(cantidad):
        base, descripcion = random.choice(VOCAB_APTITUDES)
        nombre = unico(
            lambda: recortar(solo_letras(f"{base} {random.choice('ABC')}"), 60),
            vistos["aptitud"],
            largo=60,
        )
        aptitudes.append(
            Aptitud(
                nombre=nombre,
                descripcion=recortar(descripcion, 255),
                activo=not bernoulli(0.06),
            )
        )
    db.add_all(aptitudes)
    db.flush()
    return aptitudes


def crear_vencimientos(db, personas, aptitudes) -> int:
    """Un vencimiento por persona, sobre una aptitud que esa persona no tenga."""
    print(f"⏳ Cargando vencimientos de personal...")
    total = 0
    asignadas: dict = {}

    for persona in personas:
        if not aptitudes or bernoulli(0.15):
            continue
        usadas = asignadas.setdefault(persona.id, set())
        candidatas = [a for a in aptitudes if a.id not in usadas]
        if not candidatas:
            continue
        aptitud = random.choice(candidatas)
        usadas.add(aptitud.id)

        # Mitad vigente, mitad por vencer pronto: da para probar ambos estados.
        dias = random.choice([5, 15, 30, 60, 90, 180, 365, -10, -45])
        db.add(
            VencimientoPersonal(
                persona_id=persona.id,
                aptitud_id=aptitud.id,
                fecha_vencimiento=HOY + timedelta(days=dias),
                activo=not bernoulli(0.05),
            )
        )
        total += 1

    db.flush()
    return total


def crear_quimicos(db, cantidad: int, unidades: dict, vistos: dict) -> list:
    print(f"⏳ Cargando {cantidad} insumos químicos...")
    quimicos = []
    for _ in range(cantidad):
        base, tipo = random.choice(VOCAB_QUIMICOS)
        nombre = unico(
            lambda: recortar(f"{base} {random.randint(1, 999)}", 100),
            vistos["quimico"],
            largo=100,
        )
        unidad = unidades[random.choice(["litro", "mililitro", "kilogramo"])]
        quimicos.append(
            InsumoQuimico(
                nombre=nombre,
                tipo=tipo,
                unidad_medida_id=unidad.id,
                activo=not bernoulli(0.06),
            )
        )
    db.add_all(quimicos)
    db.flush()
    return quimicos


def crear_elementos(db, cantidad: int, vistos: dict) -> list:
    print(f"⏳ Cargando {cantidad} elementos de limpieza...")
    elementos = []
    for _ in range(cantidad):
        base, recambio = random.choice(VOCAB_ELEMENTOS)
        nombre = unico(
            lambda: recortar(solo_letras(f"{base} {random.choice('ABC')}"), 40),
            vistos["elemento"],
            largo=40,
        )
        ultimo = HOY - timedelta(days=random.randint(0, 60)) if recambio else None
        elementos.append(
            ElementoLimpieza(
                nombre=nombre,
                frecuencia_recambio_dias=recambio,
                fecha_ultimo_recambio=ultimo,
                activo=not bernoulli(0.06),
            )
        )
    db.add_all(elementos)
    db.flush()
    return elementos


def crear_planes_y_tareas(
    db, cantidad: int, equipos, admins, vistos: dict, operadores: list
) -> list:
    print(f"⏳ Cargando {cantidad} planes de limpieza con sus tareas...")
    planes = []
    autor = random.choice(admins)

    for i in range(cantidad):
        base, _clave, (min_t, max_t) = random.choice(VOCAB_PLANES)
        # Un plan por equipo: la relación tiene sentido 1 a 1 en la demo.
        equipo = equipos[i % len(equipos)]
        nombre = unico(
            lambda: recortar(solo_letras(f"{base} de {equipo.nombre}"), 60),
            vistos["plan"],
            largo=60,
        )

        plan = PlanLimpieza(
            nombre=nombre,
            equipo_id=equipo.id,
            autor_id=autor.id,
            activo=not bernoulli(0.05),
            fecha_creacion=hora_aleatoria(hora_max=18),
        )

        n_tareas = random.randint(min_t, max_t)
        nombres_usados: set = set()
        for _ in range(n_tareas):
            tarea_base = random.choice(VOCAB_TAREAS)
            tarea_nombre = unico(
                lambda: recortar(solo_letras(tarea_base), 100),
                nombres_usados,
                largo=100,
            )
            # Cada tarea se asigna a un operador responsable por defecto.
            operador_default = random.choice(operadores) if operadores else None
            plan.tareas.append(
                Tarea(
                    nombre=tarea_nombre,
                    # 1 = todos los días; el resto, cada tantos días.
                    frecuencia=random.choice([1, 1, 1, 2, 3, 7, 15, 30]),
                    tipo=random.choice(list(TipoTarea)).value,
                    descripcion=_descripcion_tarea(equipo.nombre),
                    observaciones=random.choice(OBSERVACIONES) if bernoulli(0.6) else None,
                    operador_id=operador_default.id if operador_default else None,
                )
            )
        planes.append(plan)

    db.add_all(planes)
    db.flush()
    return planes


def _consumo_para(nombre_tarea: str, quimicos, elementos):
    """Elige el producto y el elemento coherentes con la tarea."""
    minuscula = nombre_tarea.lower()
    claves_quimico, claves_elemento = None, None

    for palabras, claves in CONSUMO_POR_PALABRA:
        if any(p in minuscula for p in palabras):
            claves_quimico = claves
            break

    if claves_quimico:
        candidatos = [q for q in quimicos if any(k in q.nombre for k in claves_quimico)]
        if candidatos:
            quimico = random.choice(candidatos)
            unidad = random.choice([0.1, 0.25, 0.5, 1.0])
            return quimico, unidad, random.choice(elementos)

    # Sin coincidencias: producto y elemento al azar, pero siempre presentes.
    return random.choice(quimicos), random.choice([0.1, 0.2, 0.5]), random.choice(elementos)


def crear_checklists(
    db,
    planes,
    operadores,
    quimicos,
    elementos,
    dias: int,
) -> int:
    """Genera `dias` checklists por plan, con sus registros e historial.

    Se toman dos decisiones para que la app tenga con qué trabajar:
      * el checklist de hoy queda mayormente abierto, para poder completar tareas;
      * los días pasados quedan cerrados, alguno observado, con algún incumplimiento.

    Los registros se insertan en tanda y se hace un solo flush por checklist:
    insertar fila por fila con flush es de orden cuadrático en la práctica y
    con `--cantidad 200 --dias-checklist 30` el seed se vuelve de minutos.
    """
    print(f"⏳ Cargando checklists de los últimos {dias} días...")
    total_registros = 0

    # El cumplimiento no es parejo: mejora con el tiempo, afloja los lunes y
    # los viernes, tiene días malos sueltos (faltó gente, hubo un corte) y
    # cada plan arrastra su propio nivel. Sin esto la curva es una recta.
    dias_malos = {d for d in range(1, dias) if bernoulli(0.06)}

    for plan in planes:
        flojera_plan = random.choice([0.0, 0.0, 0.02, 0.05, 0.12])
        for delta in range(dias - 1, -1, -1):
            fecha = HOY - timedelta(days=delta)
            es_hoy = delta == 0
            p_incumplir = min(
                0.7,
                0.03
                + 0.12 * (delta / max(dias, 1))
                + flojera_plan
                + (0.06 if fecha.weekday() in (0, 4) else 0.0)
                + (0.30 if delta in dias_malos else 0.0),
            )

            if es_hoy:
                estado = EstadoChecklist.ABIERTO
                observacion = None
            elif bernoulli(0.12):
                estado = EstadoChecklist.OBSERVADO
                observacion = random.choice(OBSERVACIONES_CHECKLIST)
            else:
                estado = EstadoChecklist.CERRADO
                observacion = None

            cabecera = Checklist(
                equipo_id=plan.equipo_id,
                plan_id=plan.id,
                fecha=fecha,
                estado=estado,
                observaciones=observacion,
                supervisor_id=random.choice(operadores).id if bernoulli(0.3) else None,
                fecha_creacion=datetime.combine(fecha, datetime.min.time()).replace(hour=7),
            )
            db.add(cabecera)
            db.flush()

            pendientes = 0
            registros = []
            # Se guardan los datos y se arman los objetos recien después del
            # flush: `HistorialRegistroTarea` expone `registro_tarea_id`, y ese
            # id solo existe una vez insertado el registro.
            for tarea in plan.tareas:
                if es_hoy:
                    # Hoy: la primera tarea queda hecha, el resto pendiente.
                    completado = tarea is plan.tareas[0]
                else:
                    # Pasado: casi todo hecho, con algún incumplimiento suelto.
                    completado = not bernoulli(p_incumplir)

                if not completado:
                    pendientes += 1
                    quimico_usado = cantidad = elemento = None
                else:
                    quimico_usado, cantidad, elemento = _consumo_para(tarea.nombre, quimicos, elementos)

                # Operador asignado: hereda el de la plantilla de la tarea;
                # si la tarea no tiene operador asignado, elige uno al azar.
                operador_id_tarea = tarea.operador_id
                if operador_id_tarea is not None:
                    operador = next(
                        (o for o in operadores if o.id == operador_id_tarea),
                        random.choice(operadores),
                    )
                else:
                    operador = random.choice(operadores)

                # Con baja probabilidad, el operador asignado se ausentó y otro
                # lo cubrió: se registra reemplazado_por_id (estrategia C de
                # cobertura). Si hay cobertura, quien realmente completó la
                # tarea fue quien la cubrió.
                reemplazado_por = None
                if bernoulli(0.10) and len(operadores) > 1:
                    candidatos = [o for o in operadores if o.id != operador.id]
                    if candidatos:
                        reemplazado_por = random.choice(candidatos)

                quien_hizo = (
                    reemplazado_por.id
                    if (completado and reemplazado_por)
                    else (operador.id if completado else None)
                )

                registro = RegistroTarea(
                    checklist_id=cabecera.id,
                    tarea_id=tarea.id,
                    nombre_tarea_historico=tarea.nombre,
                    descripcion_tarea_historico=tarea.descripcion,
                    tipo_tarea_historico=tarea.tipo,
                    observaciones_tarea_historico=tarea.observaciones,
                    completado=completado,
                    fecha_completado=(
                        datetime.combine(fecha, datetime.min.time()).replace(
                            hour=random.randint(7, 19), minute=random.randint(0, 59)
                        )
                        if completado
                        else None
                    ),
                    operador_id=operador.id,
                    reemplazado_por_id=reemplazado_por.id if reemplazado_por else None,
                    usuario_id=quien_hizo,
                    insumo_quimico_id=quimico_usado.id if quimico_usado else None,
                    cantidad_consumida=cantidad,
                    elemento_limpieza_id=elemento.id if elemento else None,
                )
                registros.append(registro)

            # Un flush para los registros (hace falta su id). El historial
            # de cada registro completado se crea después en
            # crear_historial_registro_tarea, para no duplicar filas.
            db.add_all(registros)
            db.flush()
            total_registros += len(registros)

            if es_hoy and pendientes == 0:
                cabecera.estado = EstadoChecklist.COMPLETO

            db.flush()

    return total_registros


def crear_incidentes(
    db, cantidad: int, equipos, personal, admins, operadores, vistos: dict,
    dias_historia: int = 365,
) -> int:
    """Incidentes variados, con la mitad cerrados y con bitácora de cierre.

    Los primeros `CANTIDAD_INCIDENTES_SUPERADMIN` los reporta el superadmin
    (la primera persona creada): la vista "Mis reportes" pagina de a 10 y
    así, al loguearse con él para probar, hay segunda página. Antes el
    reportante salía solo de los operadores y el superadmin quedaba con la
    pestaña vacía.
    """
    print(f"⏳ Cargando {cantidad} incidentes...")
    total = 0

    superadmin = personal[0] if personal else None
    propios = min(CANTIDAD_INCIDENTES_SUPERADMIN, cantidad) if superadmin else 0
    # Hay tipos de incidente y equipos que se repiten mucho más que otros.
    pesos_vocabulario = pesos_desparejos(len(VOCAB_INCIDENTES))
    pesos_equipos = pesos_desparejos(len(equipos))

    for indice in range(cantidad):
        tipo, titulo_base, descripcion_base = random.choices(
            VOCAB_INCIDENTES, weights=pesos_vocabulario
        )[0]
        titulo = unico(
            lambda: recortar(solo_letras(f"{titulo_base} {random.randint(1, 99)}"), 60),
            vistos["incidente"],
            largo=60,
        )
        equipo = random.choices(equipos, weights=pesos_equipos)[0] if bernoulli(0.8) else None
        if indice < propios:
            reportante = superadmin
        else:
            reportante = random.choice(operadores or personal)

        dias_atras = dia_con_ritmo(dias_historia)
        # Los de hoy no pueden tener una hora que todavía no llegó.
        fecha_reporte = min(
            datetime.combine(
                HOY - timedelta(days=dias_atras),
                datetime.min.time(),
            ).replace(hour=random.randint(6, 20), minute=random.randint(0, 59)),
            datetime.now() - timedelta(minutes=random.randint(5, 120)),
        )

        # Los viejos están casi todos resueltos; los recientes, a medias. Y
        # el cierre nunca cae en el futuro.
        dias_hasta_cierre = random.choice([1, 1, 2, 3, 5, 8, 13, 21])
        cerrado = dias_hasta_cierre <= dias_atras and bernoulli(0.92 if dias_atras > 30 else 0.6)
        fecha_cierre = (
            fecha_reporte + timedelta(days=dias_hasta_cierre)
            if cerrado
            else None
        )
        observacion_cierre = random.choice(OBSERVACIONES_CIERRE) if cerrado else None
        responsable = random.choice(admins) if cerrado else None

        incidente = Incidente(
            titulo=titulo,
            descripcion=descripcion_base,
            tipo=tipo.value,
            equipo_id=equipo.id if equipo else None,
            usuario_id=reportante.id,
            fecha_reporte=fecha_reporte,
            estado=(EstadoIncidente.CERRADO if cerrado else EstadoIncidente.ABIERTO).value,
            fecha_cierre=fecha_cierre,
            observacion_cierre=observacion_cierre,
            responsable_cierre_id=responsable.id if responsable else None,
        )
        db.add(incidente)
        db.flush()
        total += 1

    db.flush()
    return total


def crear_documentos(db, cantidad: int, admins, vistos: dict) -> int:
    """Documentos con su versión vigente (y alguna archivada).

    Sin esto, las vistas "Documentos" y "Consultar documentos" quedaban
    vacías al sembrar con Faker. Además:

      * a la mitad se le pone fecha de vencimiento, que alimenta la vista
        "Vencimientos" (tipo DOCUMENTO) y la columna "Vence" del listado;
      * a un tercio se le agrega una versión archivada, para que la columna
        "Archivadas" no salga siempre en cero.

    Los archivos se escriben de verdad en `uploads/documentos/` con el mismo
    criterio de nombres que usa el backend al subir por la API (uuid), así
    que "Abrir documento" funciona en la demo.
    """
    print(f"⏳ Cargando {cantidad} documentos con su versión vigente...")
    carpeta = CARPETA_UPLOADS / "documentos"
    carpeta.mkdir(parents=True, exist_ok=True)
    total = 0

    for i in range(cantidad):
        base, tipo = random.choice(VOCAB_DOCUMENTOS)
        nombre = unico(
            lambda: recortar(f"{base} {random.randint(1, 99)}", 100),
            vistos["documento"],
            largo=100,
        )
        documento = Documento(
            nombre=nombre,
            tipo=tipo.value,
            fecha_creacion=hora_aleatoria(hora_max=18),
        )
        db.add(documento)
        db.flush()

        # Momento de subida de la versión vigente; la archivada (si la hay)
        # es anterior.
        subida = hora_aleatoria(hora_max=18)
        con_archivada = bernoulli(0.33)

        if con_archivada:
            subida_archivada = subida - timedelta(days=random.randint(30, 200))
            _guardar_version(
                db,
                carpeta,
                documento,
                numero_version=1,
                nombre_documento=nombre,
                autor=random.choice(admins),
                vigente=False,
                subida=subida_archivada,
                vencimiento=None,
                # La archivada dejó de regir cuando se subió la vigente.
                vigente_hasta=subida,
            )

        # La mitad vence en plazos variados (algunos ya vencidos, para que
        # el listado muestre el badge rojo y "Vencimientos" tenga variedad).
        vencimiento = (
            HOY + timedelta(days=random.choice([15, 30, 90, 180, 365, -20]))
            if bernoulli(0.5)
            else None
        )
        _guardar_version(
            db,
            carpeta,
            documento,
            numero_version=2 if con_archivada else 1,
            nombre_documento=nombre,
            autor=random.choice(admins),
            vigente=True,
            subida=subida,
            vencimiento=vencimiento,
            vigente_hasta=None,
        )
        total += 1

    db.flush()
    return total


def _guardar_version(
    db,
    carpeta: Path,
    documento: Documento,
    numero_version: int,
    nombre_documento: str,
    autor,
    vigente: bool,
    subida: datetime,
    vencimiento: Optional[date],
    vigente_hasta: Optional[datetime],
) -> None:
    """Escribe el archivo físico (PDF propio de SAIA) y la fila de `VersionDocumento`."""
    nombre_archivo = f"{uuid.uuid4().hex}.pdf"
    if vencimiento and vencimiento < HOY:
        estado = "vencido"
    elif not vigente:
        estado = "archivado"
    else:
        estado = "vigente"
    pdf_bytes = generar_pdf_documento(
        ContextoDocumento(
            nombre=nombre_documento,
            tipo=documento.tipo,
            numero_version=numero_version,
            identificador=f"SAIA-DOC-{documento.id:04d}",
            fecha_emision=subida.date(),
            fecha_vencimiento=vencimiento,
            estado=estado,
            autor=f"{autor.nombre} {autor.apellido or ''}".strip(),
            documento_id=documento.id,
            fecha_subida=subida,
        )
    )
    (carpeta / nombre_archivo).write_bytes(pdf_bytes)

    db.add(
        VersionDocumento(
            documento_id=documento.id,
            numero_version=numero_version,
            nombre_archivo=f"{nombre_documento}.pdf",
            archivo_url=f"uploads/documentos/{nombre_archivo}",
            vigente=vigente,
            vigente_desde=subida,
            vigente_hasta=vigente_hasta,
            # Solo la versión vigente puede estar vencida: una archivada ya
            # no rige, su fecha límite no dice nada.
            fecha_vencimiento=vencimiento if vigente else None,
            autor_id=autor.id,
            fecha_subida=subida,
        )
    )


def crear_planes_cal_mantenimiento(db, cantidad: int, equipos, admins) -> list:
    """Planes de calibración/mantenimiento: a lo sumo UNO por equipo y tipo.

    El backend lo exige al crear por la API (`_verificar_plan_activo_duplicado`):
    un equipo no puede tener dos planes activos del mismo tipo. La versión
    anterior elegía el equipo al azar en cada iteración y sembraba pares
    repetidos, es decir, datos que la aplicación no habría dejado crear.

    Se arman todos los pares (equipo, tipo) posibles y se toman `cantidad`
    sin repetir ninguno. Como los equipos también son `--cantidad`, siempre
    hay pares de sobra (2 × cantidad). Devuelve los planes creados.
    """
    print(f"⏳ Cargando {cantidad} planes de calibración/mantenimiento...")
    planes = []

    pares = [
        (equipo, tipo)
        for equipo in equipos
        for tipo in ("calibracion", "mantenimiento")
    ]
    random.shuffle(pares)

    for equipo, tipo in pares[:cantidad]:
        plan = PlanCalibracionMantenimiento(
            equipo_id=equipo.id,
            autor_id=random.choice(admins).id,
            tipo=tipo,
            fecha_ultima_intervencion=HOY - timedelta(days=random.randint(1, 200)),
            periodicidad_dias=random.choice([5, 15, 30, 60, 90, 180, 365]),
            activo=not bernoulli(0.05),
            fecha_creacion=hora_aleatoria(hora_max=18),
        )
        db.add(plan)
        planes.append(plan)

    db.flush()
    return planes


def cuit_aleatorio(vistos: set, empresa: bool = True) -> str:
    """CUIT de 11 dígitos con su dígito verificador real, sin repetir."""
    pesos = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)
    while True:
        prefijo = random.choice(["30", "33"] if empresa else ["20", "23", "27"])
        cuerpo = f"{prefijo}{random.randint(10_000_000, 99_999_999)}"
        resto = 11 - sum(int(d) * p for d, p in zip(cuerpo, pesos)) % 11
        if resto == 10:
            continue  # combinación sin dígito verificador válido
        cuit = f"{cuerpo}{0 if resto == 11 else resto}"
        if cuit not in vistos:
            vistos.add(cuit)
            return cuit


def telefono_aleatorio() -> str:
    # Sin "+": clientes y transportistas validan el teléfono con el patrón de
    # texto genérico, que no lo admite.
    return f"{random.choice([11, 280, 297, 351, 2965])} {random.randint(4_000_000, 4_999_999)}"


def domicilio_aleatorio(fake: Faker) -> str:
    """Domicilio en un solo renglón (Faker lo devuelve con saltos de línea)."""
    return recortar(f"{fake.street_address()}, {fake.city()}".replace("\n", ", "), 200)


def _pdf_certificado(
    subcarpeta: str, prefijo: str, titulo: str, tipo: str, numero: str,
    emision: Optional[date], vencimiento: date,
) -> str:
    """Escribe el comprobante de una certificación y devuelve su ruta relativa."""
    carpeta = CARPETA_UPLOADS / subcarpeta
    carpeta.mkdir(parents=True, exist_ok=True)
    nombre_archivo = f"{prefijo}_{uuid.uuid4().hex}.pdf"
    pdf_bytes = generar_pdf_documento(
        ContextoDocumento(
            nombre=titulo,
            tipo=tipo,
            numero_version=1,
            identificador=numero,
            fecha_emision=emision,
            fecha_vencimiento=vencimiento,
            estado="vigente" if vencimiento >= HOY else "vencido",
        )
    )
    (carpeta / nombre_archivo).write_bytes(pdf_bytes)
    return f"uploads/{subcarpeta}/{nombre_archivo}"


def crear_proveedores(db, cantidad: int, fake: Faker, vistos: dict) -> list:
    """Proveedores con CUIT, contacto, rubro y, los certificados, sus certificaciones.

    La matrícula repite el CUIT, igual que hace el service al dar de alta.
    Entre los certificados quedan algunos con la certificación vencida, para
    probar el aviso de proveedor no habilitado.
    """
    print(f"⏳ Cargando {cantidad} proveedores...")
    proveedores = []
    cuits = vistos.setdefault("matricula", set())
    for _ in range(cantidad):
        nombre = unico(
            lambda: recortar(solo_letras(fake.company()), 120),
            vistos.setdefault("proveedor", set()),
            largo=120,
        )
        cuit = cuit_aleatorio(cuits)
        proveedores.append(
            Proveedor(
                nombre=nombre,
                matricula=cuit,
                cuit=cuit,
                contacto=recortar(f"{fake.name()} - {telefono_aleatorio()}", 150),
                domicilio=domicilio_aleatorio(fake),
                rubro=random.choice(RUBROS_PROVEEDOR),
                es_certificado=bernoulli(0.6),
                activo=not bernoulli(0.05),
            )
        )
    db.add_all(proveedores)
    db.flush()

    for proveedor in proveedores:
        if not proveedor.es_certificado:
            continue
        tipos = random.sample(TIPOS_CERTIFICACION_PROVEEDOR, random.randint(1, 2))
        # Uno de cada cuatro quedó con todo vencido.
        todo_vencido = bernoulli(0.25)
        for tipo in tipos:
            if todo_vencido:
                vencimiento = HOY - timedelta(days=random.randint(5, 200))
            else:
                vencimiento = HOY + timedelta(days=random.randint(10, 500))
            emision = vencimiento - timedelta(days=random.choice([365, 730]))
            numero = f"{slug(tipo)[:4].upper()}-{random.randint(10000, 99999)}"
            db.add(
                CertificacionProveedor(
                    proveedor_id=proveedor.id,
                    tipo=tipo,
                    numero=numero,
                    fecha_emision=emision,
                    fecha_vencimiento=vencimiento,
                    archivo_url=_pdf_certificado(
                        "certificaciones_proveedores", "certificacion_proveedor",
                        f"{tipo} - {proveedor.nombre}", "Certificación de proveedor",
                        numero, emision, vencimiento,
                    ),
                    fecha_carga=datetime.combine(emision, datetime.min.time())
                    + timedelta(days=random.randint(1, 20), hours=10),
                )
            )
    db.flush()
    return proveedores


# Alérgenos de las materias primas: (código en el catálogo, nivel, forma).
# "puede_contener" son trazas por contacto cruzado en la planta del proveedor;
# "derivado", que lo contiene a través de un derivado (la manteca, de la leche).
# Se evitan los sulfitos: su declaración exige una evaluación con fundamento
# y respaldo, y sin ella el rotulado no se completa.
CEREALES_CON_GLUTEN = ("trigo", "centeno", "cebada", "avena")
ALERGENOS_DE_INGREDIENTE = {
    "Harina 000": [("trigo", "contiene", "directa"), ("soja", "puede_contener", "directa")],
    "Manteca": [("leche", "contiene", "derivado")],
    "Huevo fresco": [("huevo", "contiene", "directa")],
    "Leche entera": [("leche", "contiene", "directa")],
    "Dulce de leche repostero": [("leche", "contiene", "derivado")],
    "Cacao amargo": [("leche", "puede_contener", "directa"), ("avellana", "puede_contener", "directa")],
    "Almidón de maíz": [("trigo", "puede_contener", "directa")],
    "Polvo de hornear": [("trigo", "puede_contener", "directa")],
    "Coco rallado": [("almendra", "puede_contener", "directa"), ("nuez", "puede_contener", "directa")],
    "Levadura fresca": [("trigo", "puede_contener", "directa")],
}


def crear_alergenos_ingredientes(db, ingredientes: dict) -> int:
    """Alérgenos de las materias primas de las recetas. Devuelve cuántos se asignaron."""
    print("⏳ Asignando alérgenos a los ingredientes...")
    catalogo = {a.codigo: a for a in db.scalars(select(Alergeno)).all()}
    asignados = 0
    for nombre, filas in ALERGENOS_DE_INGREDIENTE.items():
        ingrediente = ingredientes.get(nombre)
        if ingrediente is None:
            continue
        for codigo, nivel, forma in filas:
            alergeno = catalogo.get(codigo)
            # Sin el catálogo cargado (base sin migrar) no se asigna nada.
            if alergeno is None:
                continue
            db.add(IngredienteAlergeno(
                ingrediente_id=ingrediente.id, alergeno_id=alergeno.id, nivel=nivel, forma=forma,
            ))
            asignados += 1
    db.flush()
    # Con los alérgenos cargados, las materias primas quedan evaluadas.
    for ingrediente in ingredientes.values():
        _evaluar_alergenos_ficticio(db, ingrediente)
    db.flush()
    return asignados


# Marcas inventadas para los insumos (no son marcas reales).
MARCAS_INSUMO = [
    "Don Ramón", "La Pradera", "Del Valle", "Santa Inés", "Granja Sur",
    "El Molinero", "Sierra Alta", "Campo Nuevo", "Los Álamos", "Río Claro",
]

# Insumos (marcas) ya creados de cada ingrediente durante esta carga.
_INSUMOS_DE: dict[int, list] = {}


def _insumo_para(db, ingrediente, proveedor) -> Insumo:
    """Marca de `ingrediente` que se le compra a `proveedor`.

    Cada ingrediente tiene una o dos marcas. Si el proveedor todavía no vende
    la marca elegida se le asocia, así cada lote recibido es coherente con la
    regla del servicio (el proveedor tiene que vender ese insumo).
    """
    marcas = _INSUMOS_DE.setdefault(id(ingrediente), [])
    if not marcas or (len(marcas) < 2 and bernoulli(0.35)):
        usadas = {i.marca for i in marcas}
        marca = random.choice([m for m in MARCAS_INSUMO if m not in usadas])
        insumo = Insumo(ingrediente=ingrediente, marca=marca, proveedores=[])
        db.add(insumo)
        marcas.append(insumo)
    else:
        insumo = random.choice(marcas)
    if proveedor not in insumo.proveedores:
        insumo.proveedores.append(proveedor)
    return insumo


def homologar_insumos(db, admins: list) -> dict:
    """Rótulo de cada marca y su homologación contra el ingrediente.

    Las marcas con lotes recibidos tienen que estar aprobadas (si no, el
    servicio no habría dejado recibirlos): su rótulo se arma con los valores
    de referencia del ingrediente variados un poco, y los mismos alérgenos.
    Una de cada ocho se aparta más en un nutriente y queda aprobada "con
    observación", con su justificación. De las marcas sin lotes, algunas
    quedan pendientes (sin rótulo), como pasaría con una marca nueva.
    """
    from src.insumos import homologacion

    print("⏳ Homologando los insumos (marcas) contra sus ingredientes...")
    con_lotes = set(db.scalars(select(LoteInsumo.insumo_id).distinct()).all())
    resumen = {"aprobadas": 0, "observadas": 0, "pendientes": 0}
    # Marcas con stock disponible: su homologación queda vigente, así todo lote
    # con saldo se puede consumir.
    from src.lotesInsumo.services import stock_por_lote

    con_stock = {l.insumo_id for l in stock_por_lote(db) if l.saldo > 0 and not l.vencido}
    for insumo in db.scalars(select(Insumo).order_by(Insumo.id)).all():
        if insumo.id not in con_lotes and bernoulli(0.5):
            resumen["pendientes"] += 1
            continue
        referencia = db.scalars(
            select(ValorNutricionalIngrediente).where(ValorNutricionalIngrediente.ingrediente_id == insumo.ingrediente_id)
        ).all()
        apartado = random.choice(referencia).nutriente if referencia and bernoulli(1 / 8) else None
        insumo.rotulo_referencia = f"Rótulo del envase de {insumo.marca}"
        # Uno de cada cuatro rótulos declara por porción (50 g o ml), como
        # muchos envases; el resto, por 100.
        insumo.rotulo_porcion = Decimal("50") if bernoulli(0.25) else None
        valores_rotulo = []
        for v in referencia:
            por_100 = Decimal(v.valor) * Decimal(str(1.35 if v.nutriente == apartado else random.uniform(0.92, 1.08)))
            declarado = _q(por_100 * insumo.rotulo_porcion / 100 if insumo.rotulo_porcion else por_100)
            valores_rotulo.append(
                ValorRotuloInsumo(
                    nutriente=v.nutriente,
                    valor_declarado=declarado,
                    valor_100=homologacion.a_100(declarado, insumo.rotulo_porcion),
                )
            )
        insumo.valores_rotulo = valores_rotulo
        for fila in db.scalars(
            select(IngredienteAlergeno).where(IngredienteAlergeno.ingrediente_id == insumo.ingrediente_id)
        ).all():
            db.add(InsumoAlergeno(insumo_id=insumo.id, alergeno_id=fila.alergeno_id, nivel=fila.nivel))
        db.flush()
        comparacion = homologacion.evaluar(db, insumo)
        insumo.estado_homologacion = "aprobada"
        insumo.resultado_homologacion = comparacion.resultado
        insumo.justificacion_homologacion = (
            "Diferencia aceptada por la profesional de referencia: la marca se usa en poca proporción."
            if comparacion.resultado != "apta"
            else None
        )
        insumo.homologado_por_id = random.choice(admins).id
        # Vigente (12 meses por defecto), salvo algunas marcas sin stock, que
        # quedan vencidas para mostrar el aviso y el bloqueo.
        vencer = insumo.id not in con_stock and bernoulli(1 / 3)
        insumo.homologado_en = _momento(random.randint(370, 420) if vencer else random.randint(20, 330))
        insumo.instantanea_homologacion = comparacion.model_dump(mode="json")
        resumen["observadas" if comparacion.resultado != "apta" else "aprobadas"] += 1
    db.flush()
    return resumen


def crear_marcas_sin_lotes(db, proveedores: list, ingredientes: dict) -> int:
    """Una marca más, todavía sin lotes, para un tercio de los ingredientes.

    Las marcas con lotes ya existen (se crean al recibir cada lote). Estas son
    las que se están por empezar a comprar: la homologación deja algunas
    pendientes, como pasaría con una marca nueva. Devuelve cuántas
    asociaciones proveedor–insumo hay en total.
    """
    print("⏳ Cargando marcas nuevas (sin lotes) de algunos ingredientes...")
    activos = [p for p in proveedores if p.activo] or proveedores
    for ingrediente in ingredientes.values():
        if not bernoulli(1 / 3):
            continue
        usadas = {i.marca for i in ingrediente.insumos}
        libres = [m for m in MARCAS_INSUMO if m not in usadas]
        if not libres:
            continue
        db.add(
            Insumo(
                ingrediente=ingrediente,
                marca=random.choice(libres),
                proveedores=random.sample(activos, min(len(activos), random.randint(1, 2))),
            )
        )
    db.flush()
    return db.scalar(select(func.count()).select_from(proveedores_insumos)) or 0


def crear_clientes(db, cantidad: int, fake: Faker, vistos: dict) -> list:
    """Clientes: comercios (CUIT) y particulares (DNI). Pasan por el schema del alta."""
    print(f"⏳ Cargando {cantidad} clientes...")
    documentos = vistos.setdefault("cliente_doc", set())
    nombres = vistos.setdefault("cliente", set())
    clientes = []
    for _ in range(cantidad):
        if bernoulli(0.6):
            nombre = unico(lambda: recortar(solo_letras(fake.company()), 120), nombres, largo=120)
            documento = cuit_aleatorio(documentos)
        else:
            nombre = unico(
                lambda: recortar(solo_letras(f"{fake.first_name()} {fake.last_name()}"), 120),
                nombres, largo=120,
            )
            documento = unico(lambda: str(random.randint(20_000_000, 45_000_000)), documentos, largo=8)
        datos = ClienteCreate(
            nombre=nombre,
            documento=documento,
            telefono=telefono_aleatorio(),
            email=None if bernoulli(0.2) else f"{(slug(nombre) or 'cliente')[:30]}@correo.com.ar",
            domicilio=None if bernoulli(0.15) else domicilio_aleatorio(fake),
        )
        clientes.append(Cliente(**datos.model_dump(), activo=not bernoulli(0.06)))
    db.add_all(clientes)
    db.flush()
    return clientes


def crear_transportistas(db, cantidad: int, fake: Faker, vistos: dict, admins: list) -> dict:
    """Transportistas con sus certificaciones, en todos los estados de habilitación.

    El estado no se guarda: sale de las certificaciones. Por eso se arma un
    reparto fijo (los dos primeros siempre habilitados, para que haya con quién
    despachar) y el resto al azar entre habilitado, con una certificación
    vencida, sin certificaciones y con la única certificación anulada.
    """
    total = max(4, cantidad // 2)
    print(f"⏳ Cargando {total} transportistas con sus certificaciones...")
    cuits = vistos.setdefault("transportista_cuit", set())
    nombres = vistos.setdefault("transportista", set())
    cuenta = {"transportistas": 0, "certificaciones": 0, "habilitados": 0}
    escenarios = ["habilitado", "habilitado", "vencido", "sin_certificaciones"] + [
        random.choices(
            ["habilitado", "vencido", "sin_certificaciones", "anulada"], weights=[6, 2, 1, 1]
        )[0]
        for _ in range(total - 4)
    ]

    def certificacion(transportista, tipo, vencimiento, *, activa=True, anulada=False, comprobante=True):
        emision = vencimiento - timedelta(days=365)
        numero = f"{slug(tipo)[:3].upper()}-{random.randint(1000, 99999)}"
        fila = CertificacionTransportista(
            transportista_id=transportista.id,
            tipo=tipo,
            tipo_normalizado=normalizar_tipo(tipo),
            numero=numero,
            fecha_emision=emision,
            fecha_vencimiento=vencimiento,
            observaciones=None if bernoulli(0.7) else "Presentó el original en administración.",
            archivo_url=_pdf_certificado(
                "certificaciones_transportista", "certificacion_transportista",
                f"{tipo} - {transportista.razon_social}", "Certificación de transportista",
                numero, emision, vencimiento,
            ) if comprobante else None,
            activa=activa,
            anulada=anulada,
        )
        if anulada:
            fila.motivo_anulacion = random.choice(MOTIVOS_ANULACION_CERTIFICACION)
            fila.anulada_por = random.choice(admins).id
            fila.fecha_anulacion = _momento(random.randint(1, 60))
        db.add(fila)
        cuenta["certificaciones"] += 1

    for indice, escenario in enumerate(escenarios):
        razon_social = unico(
            lambda: recortar(
                f"{random.choice(PREFIJOS_TRANSPORTISTA)} {solo_letras(fake.last_name())} "
                f"{random.choice(SUFIJOS_EMPRESA)}", 200,
            ),
            nombres, largo=200,
        )
        datos = TransportistaCreate(
            razon_social=razon_social,
            cuit=cuit_aleatorio(cuits),
            telefono=telefono_aleatorio(),
            email=None if bernoulli(0.2) else f"{(slug(razon_social) or 'transporte')[:30]}@correo.com.ar",
            domicilio=None if bernoulli(0.2) else domicilio_aleatorio(fake),
            observaciones=None if bernoulli(0.7) else "Trabaja con camión refrigerado.",
        )
        transportista = Transportista(
            **datos.model_dump(),
            # Los dos primeros quedan activos: son los que garantizan el despacho.
            activo=indice < 2 or not bernoulli(0.08),
        )
        db.add(transportista)
        db.flush()
        cuenta["transportistas"] += 1

        tipos = random.sample(TIPOS_CERTIFICACION_TRANSPORTISTA, random.randint(1, 3))
        futuro = lambda: HOY + timedelta(days=random.randint(15, 400))  # noqa: E731
        pasado = lambda: HOY - timedelta(days=random.randint(3, 200))  # noqa: E731
        if escenario == "habilitado":
            for tipo in tipos:
                certificacion(transportista, tipo, futuro())
            # Historial: una renovación deja la anterior como reemplazada.
            if bernoulli(0.5):
                certificacion(transportista, tipos[0], pasado(), activa=False, comprobante=False)
            if transportista.activo:
                cuenta["habilitados"] += 1
        elif escenario == "vencido":
            certificacion(transportista, tipos[0], pasado())
            for tipo in tipos[1:]:
                certificacion(transportista, tipo, futuro())
        elif escenario == "anulada":
            certificacion(
                transportista, tipos[0], futuro(), activa=False, anulada=True, comprobante=False
            )
        # "sin_certificaciones": no se carga ninguna.
    db.flush()
    return cuenta


def _movimiento_stock(
    quimico, cantidad: Decimal, tipo, fecha: datetime, responsable=None,
    motivo: Optional[str] = None, registro=None, checklist=None,
) -> MovimientoStockInsumoQuimico:
    """Renglón del libro de stock, con la foto del producto y del responsable."""
    return MovimientoStockInsumoQuimico(
        insumo_quimico_id=quimico.id,
        cantidad_variacion=cantidad,
        tipo=tipo,
        fecha=fecha,
        motivo=motivo,
        responsable_id=responsable.id if responsable is not None else None,
        responsable_nombre=(
            f"{responsable.nombre} {responsable.apellido or ''}".strip()
            if responsable is not None else None
        ),
        checklist_id=registro.checklist_id if registro is not None else None,
        registro_tarea_id=registro.id if registro is not None else None,
        checklist_fecha=checklist.fecha if checklist is not None else None,
        tarea_nombre=registro.nombre_tarea_historico if registro is not None else None,
        nombre_producto=quimico.nombre,
        unidad_simbolo=quimico.unidad_medida.simbolo if quimico.unidad_medida else None,
    )


def crear_stock_y_movimientos(
    db, quimicos: list, proveedores: list, admins: list, dias_checklist: int, vistos: dict
) -> tuple:
    """Libro de stock de insumos químicos, coherente de punta a punta.

    El saldo de cada producto no se sortea: es la suma de sus movimientos.

      * ingresos: uno o dos por producto, cada uno con su lote de proveedor,
        anteriores a los checklists y suficientes para cubrir lo consumido;
      * consumos automáticos: uno por cada registro de tarea completado que
        informó producto, enlazado a su checklist y a su registro;
      * ajustes por conteo físico, positivos y negativos, en algunos productos.

    El stock mínimo se reparte para ejercitar las alertas: uno de cada cinco
    queda por debajo del mínimo, otros sin mínimo y el resto holgados.

    Tienen saldo los productos activos y los que, aun dados de baja, fueron
    consumidos en un checklist. Devuelve (saldos, lotes, cantidad de movimientos).
    """
    print("⏳ Cargando saldos, ingresos, lotes y movimientos de stock...")
    if not quimicos or not proveedores:
        print("   ⚠️  No hay proveedores o químicos para armar el stock.")
        return [], [], 0

    por_id = {q.id: q for q in quimicos}
    registros = db.scalars(
        select(RegistroTarea)
        .where(
            RegistroTarea.completado.is_(True),
            RegistroTarea.insumo_quimico_id.in_(list(por_id)),
            RegistroTarea.cantidad_consumida.isnot(None),
        )
        .order_by(RegistroTarea.fecha_completado, RegistroTarea.id)
    ).all()
    consumido: dict = {}
    for registro in registros:
        consumido[registro.insumo_quimico_id] = (
            consumido.get(registro.insumo_quimico_id, Decimal("0")) + _q(registro.cantidad_consumida)
        )

    numeros_lote = vistos.setdefault("lote", set())
    activos = [p for p in proveedores if p.activo] or proveedores
    con_stock = [q for q in quimicos if q.activo or q.id in consumido]
    saldos: dict = {}
    lotes: list = []
    movimientos = 0

    for indice, quimico in enumerate(con_stock):
        stock = StockInsumoQuimico(insumo_quimico_id=quimico.id, cantidad_actual=Decimal("0"))
        db.add(stock)
        saldos[quimico.id] = stock

        # Lo ingresado cubre todo lo que después consumen los checklists.
        total = consumido.get(quimico.id, Decimal("0")) + _q(random.uniform(3, 60))
        partes = random.choice([1, 2])
        primera = _q(total / partes)
        for cantidad in ([primera, total - primera] if partes == 2 else [total]):
            fecha = _momento(dias_checklist + random.randint(2, 45), 8, 17)
            movimiento = _movimiento_stock(
                quimico, cantidad, TipoMovimientoStock.INGRESO, fecha,
                responsable=random.choice(admins), motivo="Ingreso de lote de proveedor",
            )
            db.add(movimiento)
            db.flush()  # el lote necesita el id de su movimiento de ingreso
            lote = LoteStock(
                proveedor_id=random.choice(activos).id,
                insumo_quimico_id=quimico.id,
                numero_lote=unico(
                    lambda: f"LOTE-{random.randint(10000, 999999)}", numeros_lote, largo=100
                ),
                cantidad_producto=cantidad,
                fecha_ingreso=fecha,
                creado_en=fecha,
                movimiento_ingreso_id=movimiento.id,
            )
            db.add(lote)
            lotes.append(lote)
            stock.cantidad_actual += cantidad
            stock.actualizado_en = max(stock.actualizado_en or fecha, fecha)
            movimientos += 1

        # Ajustes por conteo físico: nunca dejan el saldo en negativo, porque
        # lo ingresado ya supera lo consumido en al menos 3 unidades.
        ajuste = {0: Decimal("1.000"), 1: Decimal("-0.500")}.get(indice % 5)
        if ajuste is not None:
            db.add(_movimiento_stock(
                quimico, ajuste,
                TipoMovimientoStock.AJUSTE_POSITIVO if ajuste > 0 else TipoMovimientoStock.AJUSTE_NEGATIVO,
                _momento(1, 8, 17), responsable=random.choice(admins),
                motivo="Ajuste por conteo físico.",
            ))
            stock.cantidad_actual += ajuste
            movimientos += 1

    for registro in registros:
        quimico = por_id[registro.insumo_quimico_id]
        cantidad = _q(registro.cantidad_consumida)
        fecha = registro.fecha_completado or datetime.now()
        db.add(_movimiento_stock(
            quimico, -cantidad, TipoMovimientoStock.CONSUMO_AUTOMATICO, fecha,
            responsable=db.get(Personal, registro.usuario_id) if registro.usuario_id else None,
            motivo="Consumo informado en checklist.",
            registro=registro, checklist=db.get(Checklist, registro.checklist_id),
        ))
        stock = saldos[quimico.id]
        stock.cantidad_actual -= cantidad
        stock.actualizado_en = max(stock.actualizado_en or fecha, fecha)
        movimientos += 1

    for indice, stock in enumerate(saldos.values()):
        if indice % 5 == 0:
            stock.stock_minimo = stock.cantidad_actual + Decimal("1.000")  # bajo mínimo
        elif indice % 4 == 0:
            stock.stock_minimo = None
        else:
            stock.stock_minimo = _q(max(Decimal("0.500"), stock.cantidad_actual / 2))

    db.flush()
    return list(saldos.values()), lotes, movimientos


def crear_calibraciones(db, equipos: list, dias_historia: int = 365) -> list:
    """Calibraciones de los equipos de medición, con su historial.

    Además de la vigente, cada equipo trae las anteriores, separadas por su
    frecuencia de calibración: así el panel de equipos tiene intervenciones
    repartidas en el tiempo y no una sola por equipo.
    """
    print("⏳ Cargando calibraciones de equipos...")
    calibraciones = []
    equipos_medicion = [e for e in equipos if e.tipo == "Medición" and e.activo]
    for equipo in equipos_medicion:
        frecuencia = equipo.frecuencia_calibracion_dias or 365
        fecha_real = HOY - timedelta(days=random.randint(1, min(180, frecuencia)))
        primera = True
        while (HOY - fecha_real).days <= dias_historia:
            calibracion = Calibracion(
                equipo_id=equipo.id,
                fecha_realizacion=fecha_real,
                proximo_vencimiento=fecha_real + timedelta(days=frecuencia),
                certificado_url=f"uploads/certificados/cal_{equipo.id}_{uuid.uuid4().hex[:8]}.pdf",
                tipo="calibracion",
                activo=not bernoulli(0.05) if primera else True,
            )
            db.add(calibracion)
            calibraciones.append(calibracion)
            primera = False
            # La anterior se hizo un ciclo antes, unos días más o menos.
            fecha_real -= timedelta(days=frecuencia + random.randint(-10, 10))
    db.flush()
    return calibraciones


def _tipo_movimiento_salida():
    """Tipo con el que la actividad simulada registra una baja manual de stock.

    Los consumos de checklist tienen su propio tipo (CONSUMO_AUTOMATICO); lo
    que una persona descuenta a mano es un ajuste negativo.
    """
    return TipoMovimientoStock.AJUSTE_NEGATIVO


def crear_historial_registro_tarea(db) -> int:
    """Historial de registros de tarea: uno por cada registro completado."""
    print("⏳ Cargando historial de registros de tarea...")
    total = 0
    registros = db.scalars(
        select(RegistroTarea).where(RegistroTarea.completado == True)
    ).all()
    for r in registros:
        db.add(
            HistorialRegistroTarea(
                registro_tarea_id=r.id,
                completado=True,
                usuario_id=r.usuario_id,
                evidencia_url=r.evidencia_url,
                fecha_evento=r.fecha_completado or hora_aleatoria(hora_max=12),
            )
        )
        total += 1
    db.flush()
    return total


def crear_historial_incidente(db, admins: list) -> int:
    """Historial de incidentes: uno por cada incidente cerrado."""
    print("⏳ Cargando historial de incidentes...")
    total = 0
    incidentes_cerrados = db.scalars(
        select(Incidente).where(Incidente.estado == EstadoIncidente.CERRADO.value)
    ).all()
    for i in incidentes_cerrados:
        db.add(
            HistorialIncidente(
                incidente_id=i.id,
                estado_anterior=EstadoIncidente.ABIERTO.value,
                estado_nuevo=EstadoIncidente.CERRADO.value,
                usuario_id=i.responsable_cierre_id or random.choice(admins).id,
                observacion=i.observacion_cierre,
                fecha_evento=i.fecha_cierre or hora_aleatoria(hora_max=17),
            )
        )
        total += 1
    db.flush()
    return total


# ============================================================
# MAIN
# ============================================================

# ============================================================
# TRAZABILIDAD DE PRODUCCIÓN
# ============================================================

_MILESIMA = Decimal("0.001")


def _q(valor) -> Decimal:
    """Cantidad con tres decimales, como `Numeric(14, 3)`."""
    return Decimal(valor).quantize(_MILESIMA)


def _variar(valor: Decimal, minimo: float, maximo: float) -> Decimal:
    """Multiplica por un factor al azar en [minimo, maximo]."""
    return _q(Decimal(valor) * Decimal(str(round(random.uniform(minimo, maximo), 4))))


def _en_piezas_enteras(cantidad: Decimal, unidad) -> Decimal:
    """La cantidad redondeada hacia abajo a piezas enteras si la unidad cuenta
    piezas (no hay 66,1 panes; 1,5 docenas sí, son 18). Si no, sin cambios."""
    if admite_fracciones(unidad):
        return cantidad
    factor = Decimal(str(unidad.factor_a_base or 1))
    piezas = (Decimal(cantidad) * factor).to_integral_value(rounding="ROUND_FLOOR")
    return _q(piezas / factor)


def _momento(dias_atras: int, hora_min: int = 6, hora_max: int = 18) -> datetime:
    """Fecha y hora de jornada laboral `dias_atras` días antes de hoy."""
    base = datetime.combine(HOY - timedelta(days=dias_atras), datetime.min.time())
    return base + timedelta(hours=random.randint(hora_min, hora_max), minutes=random.randint(0, 59))


def _conversion_ingrediente(nombre: str) -> dict:
    """Densidad (g/ml) y peso unitario (g) del ingrediente, para llevarlo a gramos.

    El servicio de ingredientes las exige según el tipo de unidad (volumen -> densidad,
    unidad -> peso) y las usan la composición porcentual y la tabla nutricional.
    Los valores están en `NUTRICION_INGREDIENTES`.
    """
    datos = NUTRICION_INGREDIENTES.get(nombre, {})
    conversion = {}
    if "densidad" in datos:
        conversion["densidad_g_ml"] = Decimal(datos["densidad"])
    if "peso_unidad" in datos:
        conversion["peso_unitario_g"] = Decimal(datos["peso_unidad"])
    return conversion


def crear_ingredientes(db, unidades: dict, vistos: dict) -> dict:
    """Materias primas alimentarias que usan las recetas.

    En modo `--agregar` reutiliza las que ya existen con el mismo nombre.
    Devuelve {nombre: Ingrediente}.
    """
    print("⏳ Cargando materias primas para recetas...")
    existentes = {
        i.nombre: i
        for i in db.scalars(
            select(Ingrediente).where(Ingrediente.nombre.in_([n for n, _ in VOCAB_INGREDIENTES]))
        ).all()
    }
    # Clase e INS de cada aditivo, de la lista de referencia (Codex / CAA).
    clases = {c.nombre: c for c in db.scalars(select(ClaseFuncional)).all()}
    referencia_por_nombre = {nombre: (clase, ins) for clase, nombre, ins in REFERENCIA_ADITIVOS}
    for nombre, clave_unidad in VOCAB_INGREDIENTES:
        conversion = _conversion_ingrediente(nombre)
        if nombre in existentes:
            # `--agregar` sobre una base cargada antes de la composición
            # porcentual: se completa lo que falte, sin pisar lo cargado.
            ingrediente = existentes[nombre]
            for campo, valor in conversion.items():
                if getattr(ingrediente, campo) is None:
                    setattr(ingrediente, campo, valor)
            continue
        clase_nombre, ins = referencia_por_nombre.get(ADITIVO_DE_INGREDIENTE.get(nombre, ""), (None, None))
        clase = clases.get(clase_nombre) if clase_nombre else None
        ingrediente = Ingrediente(
            nombre=nombre,
            unidad_medida_id=unidades[clave_unidad].id,
            # Sin las clases cargadas (base sin migrar) no queda como aditivo.
            es_aditivo=clase is not None,
            clase_funcional=clase,
            numero_ins=ins if clase is not None else None,
            **conversion,
        )
        db.add(ingrediente)
        existentes[nombre] = ingrediente
        vistos["ingrediente"].add(nombre)
    db.flush()
    return existentes



# Vida útil (días) de cada producto de las plantillas: va en la versión de la
# receta y fija el vencimiento de cada lote al cerrarlo.
VIDA_UTIL_POR_PRODUCTO = {
    "Mermelada de frutilla": 365,
    "Mermelada de durazno": 365,
    "Pan de molde blanco": 7,
    "Budín de vainilla": 30,
    "Dulce de leche familiar": 180,
    "Salsa de tomate": 540,
    "Alfajor de maicena": 60,
    "Galletitas de cacao": 120,
}

# Procedimiento de cada etapa de las recetas: lo que lee quien la ejecuta en
# el lote. La clave es la descripción de la tarea en la plantilla.
PROCEDIMIENTO_TAREA = {
    "Lavar, despalillar y trozar la fruta": (
        "1. Lavar la fruta en agua potable y escurrir.\n"
        "2. Quitar cabitos, hojas y piezas dañadas.\n"
        "3. Trozar en cuartos y pesar antes de pasar a cocción."
    ),
    "Cocinar la fruta con el azúcar y la pectina": (
        "1. Volcar la fruta y el azúcar en la paila y llevar a hervor revolviendo.\n"
        "2. Mezclar la pectina con parte del azúcar e incorporarla en lluvia.\n"
        "3. Cocinar hasta 65 °Brix, controlando con refractómetro."
    ),
    "Corregir la acidez, conservar y envasar en caliente": (
        "1. Medir el pH y agregar ácido cítrico hasta pH 3,0–3,3.\n"
        "2. Incorporar el conservante disuelto en agua caliente.\n"
        "3. Envasar a más de 85 °C, tapar e invertir los frascos 5 minutos."
    ),
    "Pelar, descarozar y trozar los duraznos": (
        "1. Escaldar los duraznos 1 minuto y enfriar en agua para pelarlos.\n"
        "2. Descarozar y descartar las piezas golpeadas.\n"
        "3. Trozar en cubos de 2 cm."
    ),
    "Cocinar con el azúcar hasta punto de gelificación": (
        "1. Cocinar la fruta con el azúcar a fuego medio revolviendo.\n"
        "2. Espumar durante la cocción.\n"
        "3. Retirar al llegar a 65 °Brix o cuando una gota en plato frío no se corra."
    ),
    "Envasar en caliente y cerrar al vacío": (
        "1. Llenar los frascos esterilizados dejando 1 cm de espacio libre.\n"
        "2. Cerrar enseguida y pasar por el túnel de vacío.\n"
        "3. Verificar el sellado y rotular con el número de lote."
    ),
    "Amasar la harina con la levadura y la sal": (
        "1. Tamizar la harina con la sal.\n"
        "2. Disolver la levadura en agua tibia (30 °C) e incorporar.\n"
        "3. Amasar 10 minutos hasta obtener una masa lisa y elástica."
    ),
    "Incorporar la manteca y dejar levar en moldes": (
        "1. Agregar la manteca pomada y amasar hasta integrar.\n"
        "2. Dividir, bollar y colocar en moldes enmantecados.\n"
        "3. Levar 60 minutos a 28 °C, hasta duplicar el volumen."
    ),
    "Hornear, desmoldar y enfriar": (
        "1. Hornear a 190 °C durante 35 minutos.\n"
        "2. Desmoldar en caliente sobre rejilla.\n"
        "3. Enfriar a temperatura ambiente antes de cortar y envasar."
    ),
    "Batir la manteca con el azúcar": (
        "1. Llevar la manteca a punto pomada.\n"
        "2. Batir con el azúcar a velocidad media 5 minutos.\n"
        "3. Seguir hasta que la mezcla esté clara y cremosa."
    ),
    "Agregar los huevos y la esencia": (
        "1. Incorporar los huevos de a uno, batiendo después de cada uno.\n"
        "2. Agregar la esencia de vainilla.\n"
        "3. Raspar el bowl para que no queden grumos de manteca."
    ),
    "Incorporar los secos tamizados": (
        "1. Tamizar la harina con el polvo de hornear.\n"
        "2. Incorporar en tres veces, con movimientos envolventes.\n"
        "3. No batir de más: mezclar solo hasta integrar."
    ),
    "Hornear en moldes enmantecados": (
        "1. Enmantecar y enharinar los moldes.\n"
        "2. Llenar hasta 3/4 de la altura.\n"
        "3. Hornear a 175 °C 40 minutos; controlar con palillo antes de retirar."
    ),
    "Calentar la leche con el bicarbonato": (
        "1. Volcar la leche en la paila y encender el agitador.\n"
        "2. Disolver el bicarbonato en un poco de leche fría e incorporarlo.\n"
        "3. Calentar hasta 80 °C sin dejar de revolver."
    ),
    "Agregar el azúcar y reducir revolviendo": (
        "1. Incorporar el azúcar de a poco, con el agitador en marcha.\n"
        "2. Reducir a fuego medio revolviendo para que no se pegue.\n"
        "3. Cocinar hasta 70 °Brix y color caramelo."
    ),
    "Aromatizar, enfriar y envasar": (
        "1. Apagar el fuego y agregar la esencia de vainilla.\n"
        "2. Enfriar revolviendo hasta 60 °C.\n"
        "3. Envasar, tapar y rotular con el número de lote."
    ),
    "Calentar el aceite y sofreír los condimentos": (
        "1. Calentar el aceite en la marmita a fuego medio.\n"
        "2. Agregar cebolla y ajo y sofreír 5 minutos sin dorar.\n"
        "3. Incorporar las especias y mezclar 1 minuto."
    ),
    "Cocinar el tomate a fuego lento": (
        "1. Agregar el tomate triturado y llevar a hervor.\n"
        "2. Bajar el fuego y cocinar 40 minutos revolviendo cada 10.\n"
        "3. Controlar la consistencia: debe cubrir el dorso de la cuchara."
    ),
    "Ajustar la acidez y envasar": (
        "1. Medir el pH y corregir con ácido cítrico hasta pH menor a 4,2.\n"
        "2. Ajustar la sal.\n"
        "3. Envasar en caliente y tapar de inmediato."
    ),
    "Preparar la masa y dejar reposar en frío": (
        "1. Batir la manteca con el azúcar y agregar las yemas.\n"
        "2. Incorporar la maicena y la harina tamizadas con el polvo de hornear.\n"
        "3. Envolver en film y reposar 30 minutos en heladera."
    ),
    "Estirar, cortar y hornear las tapas": (
        "1. Estirar la masa a 5 mm sobre mesa enharinada.\n"
        "2. Cortar con cortante de 5 cm y acomodar en placas.\n"
        "3. Hornear a 170 °C 10 minutos, sin que se doren."
    ),
    "Rellenar con dulce de leche y pasar por coco": (
        "1. Dejar enfriar las tapas por completo.\n"
        "2. Rellenar con dulce de leche repostero y unir de a dos.\n"
        "3. Pasar el borde por coco rallado y envasar."
    ),
    "Cremar la manteca con el azúcar": (
        "1. Llevar la manteca a punto pomada.\n"
        "2. Cremar con el azúcar a velocidad media.\n"
        "3. Batir hasta que la mezcla esté aireada."
    ),
    "Incorporar huevos, cacao y harina": (
        "1. Agregar los huevos y batir hasta integrar.\n"
        "2. Tamizar el cacao con la harina.\n"
        "3. Incorporar los secos y mezclar solo hasta formar la masa."
    ),
    "Formar, hornear y enfriar": (
        "1. Formar bolitas de 15 g y aplastarlas en las placas.\n"
        "2. Hornear a 180 °C 12 minutos.\n"
        "3. Enfriar sobre rejilla antes de envasar."
    ),
}

def _agregar_version(
    db, receta: Receta, numero: int, plantilla: dict, ingredientes: dict,
    unidades: dict, autor: Personal, creada_en: datetime, ajuste: Optional[tuple] = None,
) -> VersionReceta:
    """Crea una versión completa (ingredientes, tareas y reparto) a partir de la plantilla.

    `ajuste` = (mínimo, máximo) varía las cantidades: así la versión 2 difiere
    de la 1 como pasaría al corregir una receta.
    """
    porcion = PORCION_POR_PRODUCTO.get(plantilla["producto"])
    version = VersionReceta(
        receta=receta,
        numero=numero,
        rendimiento=_q(plantilla["rendimiento"]),
        unidad_medida_id=unidades[plantilla["unidad"]].id,
        porcion_descripcion=porcion[0] if porcion else None,
        porcion_cantidad=_q(porcion[1]) if porcion else None,
        porcion_unidad_medida_id=unidades[porcion[2]].id if porcion else None,
        # Sin vida útil, un lote cerrado desde la app queda sin vencimiento.
        vida_util_dias=VIDA_UTIL_POR_PRODUCTO.get(plantilla["producto"], 180),
        creado_por_id=autor.id,
        creado_en=creada_en,
    )
    tareas = [
        TareaReceta(
            version=version, orden=i, descripcion=descripcion,
            procedimiento=PROCEDIMIENTO_TAREA.get(descripcion),
        )
        for i, descripcion in enumerate(plantilla["tareas"], start=1)
    ]
    for nombre, cantidad, _clasificacion, indice_tarea in plantilla["ingredientes"]:
        ingrediente = ingredientes[nombre]
        total = _q(cantidad) if ajuste is None else _variar(Decimal(cantidad), *ajuste)
        receta_ingrediente = RecetaIngrediente(
            version=version,
            ingrediente=ingrediente,
            cantidad=total,
            unidad_medida_id=ingrediente.unidad_medida_id,
            # Como el service: si es aditivo sale del maestro de ingredientes.
            es_aditivo=ingrediente.es_aditivo,
        )
        # Todo el ingrediente va a la tarea indicada: el reparto suma el total,
        # que es lo que valida el service al crear la versión.
        TareaRecetaIngrediente(tarea=tareas[indice_tarea], receta_ingrediente=receta_ingrediente, cantidad=total)
    db.add(version)
    return version


def crear_productos_y_recetas(
    db, cantidad: int, ingredientes: dict, unidades: dict, admins: list, vistos: dict
) -> tuple[list, dict]:
    """Productos con su receta: v1 para todos, v2 para ~40% (la v1 queda de solo lectura).

    Devuelve (productos, {producto_id: [versiones ordenadas]}).
    """
    print(f"⏳ Cargando {cantidad} productos con sus recetas versionadas...")
    productos = []
    versiones: dict = {}
    for i in range(cantidad):
        plantilla = VOCAB_RECETAS[i % len(VOCAB_RECETAS)]
        base = plantilla["producto"]
        nombre = (
            base
            if base not in vistos["producto"]
            else unico(lambda: f"{base} {random.choice(VARIANTES_PRODUCTO)}", vistos["producto"], largo=120)
        )
        vistos["producto"].add(nombre)
        producto = Producto(
            nombre=nombre,
            conservacion=ConservacionProducto(
                instrucciones="Conservar en lugar fresco y seco.",
            ).model_dump(mode="json"),
            descripcion=f"Elaborado según la receta de {base.lower()}.",
            unidad_medida_id=unidades[plantilla["unidad"]].id,
            activo=not bernoulli(0.07),
        )
        receta = Receta(producto=producto, activo=True, creado_en=_momento(random.randint(200, 240)))
        lista = [
            _agregar_version(
                db, receta, 1, plantilla, ingredientes, unidades,
                random.choice(admins), receta.creado_en,
            )
        ]
        if bernoulli(0.4):
            lista.append(
                _agregar_version(
                    db, receta, 2, plantilla, ingredientes, unidades,
                    random.choice(admins), _momento(random.randint(30, 90)), ajuste=(0.85, 1.15),
                )
            )
        db.add_all([producto, receta])
        productos.append(producto)
        versiones[producto] = lista
    db.flush()
    return productos, {p.id: versiones[p] for p in productos}


def crear_datos_nutricionales(db, ingredientes: dict, productos: list, admins: list) -> dict:
    """E11: datos por 100 g de las materias primas, porción de cada producto y
    un análisis de laboratorio.

    Escribe las mismas filas que la pantalla de datos nutricionales: cada valor
    con su fuente, fecha y autor; los corregidos a mano quedan "Modificado".
    En modo `--agregar` no pisa lo que ya estaba cargado.
    """
    print("⏳ Cargando información nutricional...")
    alimentos = {a.nombre: a for a in db.scalars(select(AlimentoReferencia)).all()}
    con_datos = set(db.scalars(select(ValorNutricionalIngrediente.ingrediente_id).distinct()).all())
    con_perfil = set(db.scalars(select(PerfilNutricionalIngrediente.ingrediente_id)).all())
    resumen = {"ingredientes": 0, "valores": 0, "modificados": 0, "productos": 0, "laboratorio": 0}

    for nombre, datos in NUTRICION_INGREDIENTES.items():
        ingrediente = ingredientes.get(nombre)
        if ingrediente is None:
            continue
        autor = random.choice(admins)
        cargado_en = _momento(random.randint(20, 120))
        if ingrediente.id not in con_perfil:
            db.add(PerfilNutricionalIngrediente(
                # La densidad y el peso por unidad van en el ingrediente
                # (`_conversion_ingrediente`), no en el perfil.
                ingrediente_id=ingrediente.id,
                aporta_energia_sodio=bool(datos.get("aporta")),
                azucares_son_anadidos=bool(datos.get("anadidos")),
                grasas_son_anadidas=bool(datos.get("grasas")),
                sodio_es_anadido=bool(datos.get("sodio")),
                contiene_edulcorantes=bool(datos.get("edulcorantes")),
                contiene_cafeina=bool(datos.get("cafeina")),
            ))
        if ingrediente.id in con_datos:
            continue

        alimento = alimentos.get(datos.get("base", ""))
        if alimento is not None:
            valores = {clave: getattr(alimento, clave) for clave in CLAVES_NUTRIENTES}
            fuente, referencia = FUENTE_BASE, f"{alimento.base}: {alimento.nombre}"[:300]
        elif "valores" in datos or "base" in datos:
            # Sin la base de ejemplo (se reemplazó por otra): bibliografía.
            crudos = datos.get("valores") or ()
            valores = dict(zip(CLAVES_NUTRIENTES, crudos))
            fuente, referencia = datos.get(
                "fuente", (FUENTE_BIBLIOGRAFIA, "Tabla de composición de alimentos, valores aproximados")
            )
        else:
            continue
        if ingrediente.es_aditivo:
            valores = {k: v for k, v in valores.items() if k in ("energia", "sodio")}
        if datos.get("anadidos"):
            # Se calculan desde sus azúcares totales: no se cargan aparte.
            valores.pop("azucares_anadidos", None)

        cargados = 0
        for clave, valor in valores.items():
            if valor is None:
                continue
            valor_fuente = Decimal(str(valor))
            corregido = datos.get("corregir", {}).get(clave)
            valor_final = Decimal(corregido) if corregido is not None else valor_fuente
            modificado = valor_final != valor_fuente
            db.add(ValorNutricionalIngrediente(
                ingrediente_id=ingrediente.id,
                nutriente=clave,
                valor=valor_final,
                fuente=fuente,
                referencia=referencia,
                alimento_referencia_id=alimento.id if alimento is not None else None,
                valor_fuente=valor_fuente,
                cargado_en=cargado_en,
                cargado_por_id=autor.id,
                modificado=modificado,
                modificado_en=cargado_en + timedelta(days=random.randint(1, 10)) if modificado else None,
                modificado_por_id=random.choice(admins).id if modificado else None,
            ))
            cargados += 1
            resumen["modificados"] += int(modificado)
        resumen["valores"] += cargados
        resumen["ingredientes"] += int(cargados > 0)

    # Porción declarada: casi todos los productos; ~10 % queda sin declarar
    # para que se vea el aviso de "falta la porción".
    for producto in productos:
        base = next((b for b in NUTRICION_PRODUCTOS if producto.nombre.startswith(b)), None)
        if base is None or db.get(InfoNutricionalProducto, producto.id) is not None:
            continue
        if producto.nombre != base and bernoulli(0.1):
            continue
        datos = NUTRICION_PRODUCTOS[base]
        db.add(InfoNutricionalProducto(
            producto_id=producto.id,
            expresar_en="g",
            porcion=Decimal(datos["porcion"]),
            medida_casera=datos["medida"],
            peso_unidad_g=Decimal(datos["peso_unidad"]) if "peso_unidad" in datos else None,
        ))
        resumen["productos"] += 1

        analisis = NUTRICION_LABORATORIO.get(producto.nombre)
        if analisis:
            for clave, valor in analisis["valores"].items():
                db.add(ValorLaboratorioProducto(
                    producto_id=producto.id,
                    nutriente=clave,
                    valor_100=Decimal(valor),
                    referencia=analisis["referencia"],
                    fecha_analisis=HOY - timedelta(days=random.randint(10, 60)),
                    cargado_en=_momento(random.randint(1, 9)),
                    cargado_por_id=random.choice(admins).id,
                ))
                resumen["laboratorio"] += 1
    db.flush()
    return resumen


def crear_lotes_insumo(
    db, ingredientes: dict, proveedores: list, admins: list, vistos: dict,
    dias_historia: int = 365,
) -> list:
    """Entre 2 y 4 lotes recibidos por materia prima, de proveedores activos.

    Las cantidades son holgadas; si la producción simulada agota un lote, se
    registra una reposición (ver `_lote_para_consumir`).
    """
    print("⏳ Cargando lotes de insumo recibidos...")
    _INSUMOS_DE.clear()
    activos = [p for p in proveedores if p.activo] or proveedores
    lotes = []
    for nombre, ingrediente in ingredientes.items():
        clave_unidad = next(c for n, c in VOCAB_INGREDIENTES if n == nombre)
        # Cantidad recibida típica según la unidad (g y mL vienen en bolsas grandes).
        escala = {"gramo": (2000, 10000), "mililitro": (500, 3000), "unidad": (180, 720)}.get(
            clave_unidad, (25, 120)
        )
        for _ in range(random.randint(3, 6)):
            ingreso = HOY - timedelta(days=dia_con_ritmo(dias_historia + 20, 5))
            lotes.append(
                _nuevo_lote_insumo(
                    db, ingrediente, random.choice(activos), ingreso,
                    _q(random.randint(*escala)), random.choice(admins), vistos,
                )
            )
    db.add_all(lotes)
    db.flush()
    return lotes


def _nuevo_lote_insumo(
    db, ingrediente, proveedor, ingreso: date, cantidad: Decimal, autor, vistos: dict
) -> LoteInsumo:
    numero = unico(
        lambda: f"{slug(proveedor.nombre)[:3].upper()}-{ingreso:%y%m}-{random.randint(100, 9999)}",
        vistos["lote_insumo"],
        largo=100,
    )
    return LoteInsumo(
        insumo=_insumo_para(db, ingrediente, proveedor),
        ingrediente=ingrediente,
        proveedor=proveedor,
        numero_lote=numero,
        cantidad_recibida=cantidad,
        fecha_ingreso=ingreso,
        # Unos pocos sin vencimiento (ingredientes no perecederos).
        fecha_vencimiento=None if bernoulli(0.1) else ingreso + timedelta(days=random.randint(45, 365)),
        creado_por_id=autor.id,
        creado_en=datetime.combine(ingreso, datetime.min.time()) + timedelta(hours=9),
    )


def _lote_para_consumir(
    db, ingrediente, cuando: date, necesario: Decimal, saldos: dict, lotes: list,
    proveedores: list, admins: list, vistos: dict,
) -> list[tuple]:
    """Elige de qué lotes sale `necesario`, por FEFO (primero el que vence antes).

    Solo considera lotes ya recibidos en esa fecha y no vencidos. Si el saldo
    no alcanza, el resto sale de una reposición recibida días antes, como
    pasaría en la planta. Devuelve [(lote, cantidad)].
    """
    candidatos = sorted(
        (
            l for l in lotes
            if l.ingrediente is ingrediente
            and l.fecha_ingreso <= cuando
            and (l.fecha_vencimiento is None or l.fecha_vencimiento >= cuando)
            and saldos[l] > 0
        ),
        key=lambda l: (l.fecha_vencimiento or date.max, l.fecha_ingreso),
    )
    partes = []
    pendiente = necesario
    for lote in candidatos:
        if pendiente <= 0:
            break
        toma = min(pendiente, saldos[lote])
        partes.append((lote, toma))
        saldos[lote] -= toma
        pendiente -= toma
    if pendiente > 0:
        activos = [p for p in proveedores if p.activo] or proveedores
        reposicion = _nuevo_lote_insumo(
            db, ingrediente, random.choice(activos), cuando - timedelta(days=random.randint(1, 6)),
            _q(pendiente * random.randint(4, 10)), random.choice(admins), vistos,
        )
        db.add(reposicion)
        lotes.append(reposicion)
        saldos[reposicion] = reposicion.cantidad_recibida - pendiente
        partes.append((reposicion, pendiente))
    return partes


def crear_lotes_produccion(
    db, cantidad: int, productos: list, versiones: dict, lotes_insumo: list,
    proveedores: list, admins: list, operadores: list, vistos: dict,
    dias_historia: int = 365,
) -> dict:
    """Lotes de producto con checklist y consumos, en los tres estados.

    Sigue las reglas del service: el lote fija la versión vigente a su fecha,
    el checklist tiene una fila por tarea, los consumos salen de lotes de
    ingrediente por FEFO y los lotes terminados/cancelados quedan de solo lectura.
    Se inserta `en_proceso` y se cierra después, porque los eventos del ORM
    rechazan checklist o consumos sobre un lote ya cerrado.
    """
    print(f"⏳ Cargando {cantidad} lotes de producción con checklist y consumos...")
    cuenta = {"lotes": 0, "items": 0, "consumos": 0, "desperdicios": 0}
    saldos: dict = {}
    for lote in lotes_insumo:
        consumido = db.scalar(
            select(func.coalesce(func.sum(ConsumoInsumo.cantidad), 0)).where(
                ConsumoInsumo.lote_insumo_id == lote.id
            )
        )
        saldos[lote] = _q(lote.cantidad_recibida) - _q(consumido)

    con_receta = [p for p in productos if versiones.get(p.id)]
    if not con_receta:
        return cuenta
    # Vida útil en días de cada producto: la misma para todos sus lotes.
    vida_util: dict = {}

    # Fechas de más vieja a más nueva, así el FEFO consume en orden.
    # Los más recientes (últimos 3 días) quedan en proceso: siempre hay
    # algunos para probar el checklist y el registro de consumos.
    recientes = min(cantidad, max(2, min(6, cantidad // 8)))
    dias = sorted(
        [dia_con_ritmo(dias_historia, 4) for _ in range(cantidad - recientes)]
        + [random.randint(0, 3) for _ in range(recientes)],
        reverse=True,
    )
    # Unos pocos productos concentran la mayor parte de la producción.
    pesos_productos = pesos_desparejos(len(con_receta))
    for dias_atras in dias:
        producto = random.choices(con_receta, weights=pesos_productos)[0]
        inicio = _momento(dias_atras, 6, 12)
        vigentes = [v for v in versiones[producto.id] if v.creado_en <= inicio]
        version = (vigentes or versiones[producto.id][:1])[-1]

        if dias_atras <= 3:
            estado = ESTADO_EN_PROCESO
        else:
            estado = ESTADO_CANCELADO if bernoulli(0.1) else ESTADO_TERMINADO

        objetivo = _en_piezas_enteras(
            _q(Decimal(version.rendimiento) * Decimal(random.choice(["0.5", "1", "1.5", "2", "3"]))),
            producto.unidad_medida,
        )
        if objetivo <= 0:
            objetivo = _en_piezas_enteras(_q(version.rendimiento), producto.unidad_medida)
        factor = (objetivo / Decimal(version.rendimiento)).quantize(Decimal("0.000001"))
        # `LP-AAAAMMDD-NNN` con contador diario, como `generar_numero_lote`.
        correlativo = 1
        while (numero := f"{PREFIJO_NUMERO_LOTE}-{inicio:%Y%m%d}-{correlativo:03d}") in vistos["lote_producto"]:
            correlativo += 1
        vistos["lote_producto"].add(numero)
        lote = LoteProducto(
            numero_lote=numero,
            producto=producto,
            version_receta=version,
            estado=ESTADO_EN_PROCESO,
            cantidad_objetivo=objetivo,
            factor_escala=factor,
            creado_por_id=random.choice(admins).id,
            fecha_inicio=inicio,
        )
        db.add(lote)

        tareas = sorted(version.tareas, key=lambda t: t.orden)
        if estado == ESTADO_TERMINADO:
            hechas = len(tareas)
        elif estado == ESTADO_CANCELADO:
            hechas = random.randint(0, max(0, len(tareas) - 1))
        else:
            hechas = random.randint(0, len(tareas))

        # Asignación como la hace quien administra: la mayoría de los lotes
        # tienen responsable (todas sus tareas), alguna tarea se reasigna a
        # otra persona y el resto de los lotes quedan sin asignar (cualquiera).
        responsable = random.choice(operadores) if bernoulli(0.7) else None
        momento = inicio
        for indice, tarea in enumerate(tareas):
            asignado = responsable
            if responsable is not None and len(operadores) > 1 and bernoulli(0.15):
                asignado = random.choice([o for o in operadores if o.id != responsable.id])
            # `db.add` explícito: en SQLAlchemy 2.0 asignar `lote=` no mete el
            # objeto en la sesión (el lote ya estaba agregado).
            item = ChecklistProduccion(
                lote=lote, tarea=tarea, asignado_a_id=asignado.id if asignado else None
            )
            db.add(item)
            cuenta["items"] += 1
            if indice >= hechas:
                continue
            momento += timedelta(minutes=random.randint(25, 150))
            # La hace quien la tiene asignada; si estaba libre, cualquiera.
            operador = asignado or random.choice(operadores)
            item.completado_por_id = operador.id
            item.completado_en = momento
            for reparto in tarea.ingredientes:
                ingrediente = reparto.receta_ingrediente.ingrediente
                planificado = _q(Decimal(reparto.cantidad) * factor)
                # Como mínimo lo que pide la receta: si no, el service no deja completar la tarea.
                real = max(planificado, _variar(planificado, 1.0, 1.08))
                for lote_insumo, parte in _lote_para_consumir(
                    db, ingrediente, momento.date(), real, saldos, lotes_insumo,
                    proveedores, admins, vistos,
                ):
                    db.add(ConsumoInsumo(
                        checklist=item, lote_insumo=lote_insumo, cantidad=parte,
                        tipo=TIPO_CONSUMO_REAL, registrado_por_id=operador.id,
                        registrado_en=momento,
                    ))
                    cuenta["consumos"] += 1
                if bernoulli(0.12):
                    perdida = max(_variar(planificado, 0.02, 0.05), _MILESIMA)
                    for lote_insumo, parte in _lote_para_consumir(
                        db, ingrediente, momento.date(), perdida, saldos, lotes_insumo,
                        proveedores, admins, vistos,
                    ):
                        db.add(ConsumoInsumo(
                            checklist=item, lote_insumo=lote_insumo, cantidad=parte,
                            tipo=TIPO_CONSUMO_DESPERDICIO, motivo=random.choice(MOTIVOS_DESPERDICIO),
                            registrado_por_id=operador.id, registrado_en=momento,
                        ))
                        cuenta["desperdicios"] += 1
        db.flush()

        # Cierre: recién ahora, con el checklist y los consumos ya en la base.
        if estado == ESTADO_TERMINADO:
            lote.estado = ESTADO_TERMINADO
            producida = _en_piezas_enteras(_variar(objetivo, 0.9, 1.02), producto.unidad_medida)
            lote.cantidad_producida = producida if producida > 0 else objetivo
            lote.fecha_cierre = momento + timedelta(minutes=random.randint(10, 60))
            # Se carga junto con el cierre: un lote terminado ya no se edita.
            # Con vidas útiles cortas quedan lotes vencidos, que la app no
            # deja reservar ni despachar.
            dias_vida = version.vida_util_dias or vida_util.setdefault(
                producto.id, random.choice([60, 120, 180, 365, 365, 540])
            )
            lote.fecha_vencimiento = lote.fecha_cierre.date() + timedelta(days=dias_vida)
        elif estado == ESTADO_CANCELADO:
            lote.estado = ESTADO_CANCELADO
            lote.motivo_cancelacion = random.choice(MOTIVOS_CANCELACION_LOTE)
            lote.fecha_cierre = momento + timedelta(minutes=random.randint(10, 60))
        db.flush()
        cuenta["lotes"] += 1

    # Ajustes de stock: algunos lotes viejos se dan de baja (vencidos o
    # descartados). La baja es lógica: los consumos ya registrados se conservan.
    for lote in lotes_insumo:
        vencido = lote.fecha_vencimiento is not None and lote.fecha_vencimiento < HOY
        if (vencido and bernoulli(0.6)) or bernoulli(0.04):
            lote.activo = False
            lote.motivo_baja = "vencido" if vencido else random.choice(MOTIVOS_BAJA_INSUMO)
            if vencido:
                lote.fecha_baja = datetime.combine(
                    lote.fecha_vencimiento, datetime.min.time()
                ) + timedelta(days=1, hours=10)
            else:
                lote.fecha_baja = _momento(dia_con_ritmo(60, 1), 8, 17)
    db.flush()
    cuenta["lotes_insumo"] = len(lotes_insumo)
    return cuenta


def crear_bajas_lote_insumo(db, lotes_insumo: list, admins: list) -> dict:
    """Historial de bajas de lotes de insumo.

    Acompaña a los lotes que la simulación dejó inactivos (baja total del
    saldo restante) y agrega algunas bajas parciales sobre lotes activos,
    para que la pantalla muestre ambos casos.
    """
    cuenta = {"totales": 0, "parciales": 0, "cantidad": Decimal("0")}
    if not admins or not lotes_insumo:
        return cuenta
    print("⏳ Cargando bajas de lotes de insumo...")

    ids = [lote.id for lote in lotes_insumo]
    consumos = dict(
        db.execute(
            select(ConsumoInsumo.lote_insumo_id, func.sum(ConsumoInsumo.cantidad))
            .where(ConsumoInsumo.lote_insumo_id.in_(ids))
            .group_by(ConsumoInsumo.lote_insumo_id)
        ).all()
    )
    bajas_previas = dict(
        db.execute(
            select(BajaLoteInsumo.lote_insumo_id, func.sum(BajaLoteInsumo.cantidad))
            .where(BajaLoteInsumo.lote_insumo_id.in_(ids))
            .group_by(BajaLoteInsumo.lote_insumo_id)
        ).all()
    )

    for lote in lotes_insumo:
        saldo = (
            _q(lote.cantidad_recibida)
            - _q(consumos.get(lote.id, 0))
            - _q(bajas_previas.get(lote.id, 0))
        )
        if saldo <= 0:
            continue
        if lote.activo:
            if not bernoulli(0.08):
                continue
            cantidad = _q(saldo * Decimal(random.choice(["0.05", "0.1", "0.2"])))
            if cantidad <= 0:
                continue
            motivo = random.choice(MOTIVOS_BAJA_INSUMO)
            registrado_en = _momento(dia_con_ritmo(180, 1), 8, 17)
            cuenta["parciales"] += 1
        else:
            if lote.id in bajas_previas:
                continue
            cantidad = saldo
            motivo = (
                lote.motivo_baja
                if lote.motivo_baja in MOTIVOS_BAJA_INSUMO
                else random.choice(MOTIVOS_BAJA_INSUMO)
            )
            lote.motivo_baja = motivo
            registrado_en = lote.fecha_baja or _momento(30, 8, 17)
            cuenta["totales"] += 1

        db.add(
            BajaLoteInsumo(
                lote_insumo_id=lote.id,
                motivo=motivo,
                observaciones=random.choice(OBSERVACIONES_BAJA_INSUMO)
                if bernoulli(0.5)
                else None,
                cantidad=cantidad,
                registrado_por_id=random.choice(admins).id,
                registrado_en=registrado_en,
            )
        )
        cuenta["cantidad"] += cantidad

    db.flush()
    return cuenta


def simular_actividad_trazabilidad(db, admins: list, productos: list, lotes_insumo: list) -> dict:
    """Historia en la bitácora para productos y lotes de insumo.

    Las versiones de receta y los lotes cerrados son inmutables, así que su
    "modificación" ya quedó registrada como alta de una versión nueva o como
    cierre/cancelación. Acá se cubre lo editable: producto (modificar, baja y
    reactivación) y la baja lógica de lotes de insumo.
    """
    cuenta = {"modificados": 0, "bajas": 0, "reactivados": 0}

    def commit(clave: str) -> None:
        db.info["usuario_id"] = random.choice(admins).id
        db.commit()
        cuenta[clave] += 1

    for producto in random.sample(productos, min(3, len(productos))):
        db.refresh(producto)
        producto.descripcion = recortar(f"{producto.descripcion or ''} Presentación revisada.", 500)
        commit("modificados")
    activos = [p for p in productos if p.activo]
    for producto in random.sample(activos, min(2, len(activos))):
        db.refresh(producto)
        producto.activo = False
        commit("bajas")
        db.refresh(producto)
        producto.activo = True
        commit("reactivados")
    disponibles = [l for l in lotes_insumo if l.activo]
    for lote in random.sample(disponibles, min(2, len(disponibles))):
        db.refresh(lote)
        lote.activo = False
        lote.motivo_baja = random.choice(MOTIVOS_BAJA_INSUMO)
        lote.fecha_baja = datetime.now().replace(microsecond=0)
        commit("bajas")
    return cuenta


# ============================================================
# VISTA PÚBLICA, NOTIFICACIONES Y SESIONES
# ============================================================

def simular_actividad_comercial(db, fake: Faker, admins: list, clientes: list, transportistas: list) -> dict:
    """Historia en la bitácora para clientes y transportistas.

    Corre ANTES del circuito de salidas, así que todavía nadie los referencia:
    se pueden modificar, dar de baja, reactivar y hasta borrar.
    """
    cuenta = {"modificados": 0, "bajas": 0, "reactivados": 0, "eliminados": 0, "omitidos": 0}
    if not admins:
        return cuenta

    def commit(clave: str) -> None:
        db.info["usuario_id"] = random.choice(admins).id
        db.commit()
        cuenta[clave] += 1

    def muestra(lista: list, n: int):
        for objeto in random.sample(lista, min(n, len(lista))):
            db.refresh(objeto)
            yield objeto

    n = max(1, len(clientes) // 5)
    for cliente in muestra(clientes, n):
        cliente.telefono = telefono_aleatorio()
        cliente.domicilio = domicilio_aleatorio(fake)
        commit("modificados")
    dados_de_baja = []
    for cliente in muestra([c for c in clientes if c.activo], n):
        cliente.activo = False
        commit("bajas")
        dados_de_baja.append(cliente)
    for cliente in dados_de_baja[: max(1, len(dados_de_baja) // 2)]:
        db.refresh(cliente)
        cliente.activo = True
        commit("reactivados")
    # Una carga errónea que se borra. Solo si sobran: el circuito los necesita.
    if len(clientes) > 5:
        victima = random.choice(clientes)
        db.info["usuario_id"] = random.choice(admins).id
        db.delete(victima)
        db.commit()
        clientes.remove(victima)
        cuenta["eliminados"] += 1

    # Los dos primeros transportistas no se tocan: garantizan el despacho.
    resto = transportistas[2:]
    for transportista in muestra(resto, max(1, len(resto) // 3)):
        transportista.telefono = telefono_aleatorio()
        transportista.observaciones = "Actualizó los datos de contacto."
        commit("modificados")
    for transportista in muestra([t for t in resto if t.activo], 1):
        transportista.activo = False
        commit("bajas")
        if bernoulli(0.5):
            db.refresh(transportista)
            transportista.activo = True
            commit("reactivados")
    return cuenta


def _fecha_entre(desde: date, hasta: date) -> date:
    """Fecha al azar entre las dos, ambas incluidas (si se cruzan, `desde`)."""
    return desde + timedelta(days=random.randint(0, max(0, (hasta - desde).days)))


def rotular_lote(db, lote_id: int, fecha_duracion: date, usuario) -> int:
    """Borrador de rotulado completo del lote, por los services (como en la app).

    Sin él la reserva no deja vender el lote. El autocompletado trae la
    denominación, los ingredientes, la nutrición y los datos del lote, y la
    propuesta de declaraciones; a mano van los que no salen de ningún lado.
    """
    lote = db.get(LoteProducto, lote_id)
    # Antes del borrador: la propuesta de declaraciones sale de estos maestros
    # (conservación del producto y alérgenos evaluados de cada ingrediente).
    _preparar_declaraciones_rotulado(
        db, db.get(Producto, lote.producto_id), db.get(VersionReceta, lote.version_receta_id)
    )
    borrador_id = rotulado_services.crear_borrador(
        db, lote.producto_id,
        BorradorRotuladoCreate(
            producto_id=lote.producto_id, version_receta_id=lote.version_receta_id, lote_producto_id=lote_id
        ),
        usuario,
    ).id
    rotulado_services.autocompletar_borrador(db, borrador_id, lote.version_receta_id, lote_id, False, usuario)
    rotulado_services.actualizar_borrador(
        db, borrador_id,
        BorradorRotuladoUpdate(
            contenido_neto=random.choice(DATOS_ROTULO["contenidos"]),
            rnpa_rppa=f"RNPA 07-{random.randint(100000, 999999)}",
            razon_social=DATOS_ROTULO["razon_social"],
            domicilio=DATOS_ROTULO["domicilio"],
            instrucciones_uso=random.choice(DATOS_ROTULO["instrucciones"]),
            fecha_duracion=fecha_duracion,
        ),
        usuario,
    )
    # Completo exige las declaraciones de alérgenos confirmadas (HU106).
    declaracion = declaraciones_services.consultar(db, borrador_id)
    declaraciones_services.confirmar(
        db, borrador_id, RevisionEsperada(revision=declaracion["revision"]), usuario
    )
    rotulado_services.actualizar_borrador(
        db, borrador_id, BorradorRotuladoUpdate(estado=ESTADO_COMPLETADO), usuario
    )
    return borrador_id


def crear_circuito_comercial(db, fake: Faker, cantidad: int) -> dict:
    """Salidas de producto, reclamos y retiros, generados con los services.

    Se llama a los mismos services que usan los endpoints: cada paso valida lo
    que valida la app y deja su hito en la línea de tiempo del lote, y los
    rechazos, reclamos y retiros abren su incidente automático. Solo cambian
    las fechas de negocio (reserva, despacho, entrega...), repartidas hacia
    atrás; el momento de registro es el de la carga.

    Los primeros destinos están fijados para que, aun con `--cantidad` chica,
    haya al menos una salida en cada estado.
    """
    cuenta = {
        "salidas": 0, "reservadas": 0, "despachadas": 0, "entregadas": 0,
        "canceladas": 0, "rechazadas": 0, "resueltas": 0, "reclamos": 0,
        "retiros": 0, "retiros_cerrados": 0, "notificados": 0,
    }
    hoy = hoy_ar()
    admins = [
        p for p in db.scalars(select(Personal).where(Personal.activo.is_(True))).all()
        if p.puede_administrar
    ]
    clientes = list(db.scalars(select(Cliente).where(Cliente.activo.is_(True))).all())
    habilitados = [
        t for t in db.scalars(select(Transportista).where(Transportista.activo.is_(True))).all()
        if estado_habilitacion(t.certificaciones, fecha_referencia=hoy) == ESTADO_HABILITADO
    ]
    lotes = list(db.scalars(
        select(LoteProducto).where(
            LoteProducto.estado == ESTADO_TERMINADO,
            LoteProducto.retirado.is_(False),
            LoteProducto.cantidad_producida > 0,
        )
    ).all())
    # Lotes ya vencidos: también se vendieron, mientras estaban vigentes. Los
    # services validan el vencimiento contra HOY y no dejarían reservarlos, así
    # que durante la carga se les quita la fecha y al final se les devuelve.
    # Sus salidas se fechan antes del vencimiento y nunca quedan pendientes.
    vencidos = {
        lote.id: lote.fecha_vencimiento for lote in lotes
        if lote.fecha_vencimiento is not None and lote.fecha_vencimiento < hoy
    }
    if not (admins and clientes and lotes):
        print("⚠️  Sin lotes vigentes, clientes o administradores: no se generan salidas.")
        return cuenta
    print("⏳ Generando salidas de producto, reclamos y retiros...")

    def actor():
        usuario = random.choice(admins)
        db.info["usuario_id"] = usuario.id
        return usuario

    # Los services fechan todo "ahora": los hitos del lote, los incidentes
    # automáticos y los momentos de auditoría de la salida. Con eso la línea
    # de tiempo de cada lote y la curva de incidentes quedarían amontonadas en
    # el día de la carga. Después de cada paso se llevan esos momentos a la
    # fecha de negocio del paso (reserva, despacho, entrega, reclamo, retiro).
    ahora_mismo = datetime.now()
    ultimo = {
        "hito": db.scalar(select(func.coalesce(func.max(HitoLote.id), 0))),
        "incidente": db.scalar(select(func.coalesce(func.max(Incidente.id), 0))),
        "historial": db.scalar(select(func.coalesce(func.max(HistorialIncidente.id), 0))),
    }
    sin_auditar = {"auditoria_omitir": True, "synchronize_session": False}

    def momento_de(dia: date, despues_de: Optional[datetime] = None) -> datetime:
        """Un momento de la jornada de `dia`, posterior a `despues_de` y no futuro."""
        momento = datetime.combine(dia, datetime.min.time()) + timedelta(
            hours=random.randint(8, 17), minutes=random.randint(0, 59)
        )
        if despues_de is not None and momento <= despues_de:
            momento = despues_de + timedelta(minutes=random.randint(20, 90))
        return min(momento, ahora_mismo)

    def fechar(momento: datetime, tabla=None, fila_id=None, **campos) -> None:
        """Lleva a `momento` lo que el último paso registró con la hora actual."""
        db.execute(
            sa_update(HitoLote).where(HitoLote.id > ultimo["hito"])
            .values(fecha_hora=momento).execution_options(**sin_auditar)
        )
        db.execute(
            sa_update(Incidente).where(Incidente.id > ultimo["incidente"])
            .values(fecha_reporte=momento).execution_options(**sin_auditar)
        )
        db.execute(
            sa_update(HistorialIncidente).where(HistorialIncidente.id > ultimo["historial"])
            .values(fecha_evento=momento).execution_options(**sin_auditar)
        )
        if tabla is not None and campos:
            db.execute(
                sa_update(tabla).where(tabla.id == fila_id)
                .values(**campos).execution_options(**sin_auditar)
            )
        db.commit()
        db.expire_all()
        ultimo["hito"] = db.scalar(select(func.coalesce(func.max(HitoLote.id), 0)))
        ultimo["incidente"] = db.scalar(select(func.coalesce(func.max(Incidente.id), 0)))
        ultimo["historial"] = db.scalar(select(func.coalesce(func.max(HistorialIncidente.id), 0)))

    # Clientes y transportistas con habituales, motivos con favoritos.
    pesos_clientes = pesos_desparejos(len(clientes))
    pesos_transporte = pesos_desparejos(len(habilitados))
    pesos_rechazo = pesos_desparejos(len(MOTIVOS_RECHAZO))
    pesos_reclamo = pesos_desparejos(len(MOTIVOS_RECLAMO))

    destinos_fijos = [
        "entregada", "entregada", "reservada", "despachada", "cancelada",
        "rechazada", "rechazada_reingresada", "rechazada_desechada", "entregada",
    ]
    entregadas: list = []   # (salida_id, lote_id, fecha_entrega)
    con_salidas: set = set()

    def quitar_vencimientos(valores: dict) -> None:
        for lote_id, fecha in valores.items():
            db.execute(
                sa_update(LoteProducto).where(LoteProducto.id == lote_id)
                .values(fecha_vencimiento=fecha).execution_options(**sin_auditar)
            )
        db.commit()
        db.expire_all()

    # Primero los vigentes: los destinos fijos incluyen reservas y despachos
    # pendientes, que solo tienen sentido sobre un lote que no venció.
    elegidos = random.sample(lotes, min(len(lotes), max(4, cantidad * 5)))
    elegidos.sort(key=lambda lote: lote.id in vencidos)
    elegidos = [
        (lote.id, (lote.fecha_cierre or lote.fecha_inicio).date(), lote.producto.unidad_medida)
        for lote in elegidos
    ]
    quitar_vencimientos({lote_id: None for lote_id in vencidos})

    try:
        for lote_id, cierre, unidad in elegidos:
            vencimiento = vencidos.get(lote_id)
            # Sin rotulado completo el lote no se vende.
            rotular_lote(db, lote_id, vencimiento or cierre + timedelta(days=180), actor())
            cuenta["rotulados"] = cuenta.get("rotulados", 0) + 1
            for _ in range(random.randint(1, 4)):
                saldo = salidas_services.calcular_cantidades_lote(db, lote_id)["saldo"]
                cantidad_salida = _en_piezas_enteras(
                    _q(Decimal(saldo) * Decimal(random.choice(["0.1", "0.15", "0.2", "0.25"]))), unidad
                )
                if cantidad_salida <= 0:
                    break
                if vencimiento is not None:
                    # Lote vencido: todo lo suyo ya terminó, de una forma u otra.
                    destino = random.choices(
                        ["entregada", "cancelada", "rechazada_desechada", "rechazada"],
                        weights=[76, 10, 9, 5],
                    )[0]
                elif destinos_fijos:
                    destino = destinos_fijos.pop(0)
                else:
                    destino = random.choices(
                        ["entregada", "reservada", "despachada", "cancelada",
                         "rechazada", "rechazada_reingresada", "rechazada_desechada"],
                        weights=[60, 6, 7, 9, 5, 7, 6],
                    )[0]
                # Lo que queda pendiente (reservado o despachado) es reciente; el
                # resto se vendió en las semanas siguientes a la elaboración, y no
                # en cualquier momento hasta hoy.
                if destino in ("reservada", "despachada"):
                    reserva = max(cierre, hoy - timedelta(days=random.randint(0, 6)))
                else:
                    limite = min(hoy, cierre + timedelta(days=30))
                    if vencimiento is not None:
                        # Con margen para despachar y entregar antes de que venza.
                        limite = max(cierre, min(limite, vencimiento - timedelta(days=10)))
                    reserva = _fecha_entre(cierre, limite)
                salida_id = salidas_services.reservar(
                    db, lote_id, random.choices(clientes, weights=pesos_clientes)[0].id,
                    cantidad_salida, reserva, actor(),
                ).id
                m_reserva = momento_de(reserva)
                fechar(m_reserva, Salida, salida_id, creado_en=m_reserva)
                cuenta["salidas"] += 1
                con_salidas.add(lote_id)

                if destino == "reservada":
                    cuenta["reservadas"] += 1
                    continue
                if destino == "cancelada":
                    salidas_services.cancelar(
                        db, salida_id, random.choice(MOTIVOS_CANCELACION_RESERVA), actor()
                    )
                    m_cancelacion = momento_de(
                        min(hoy, reserva + timedelta(days=random.randint(0, 4))), m_reserva
                    )
                    fechar(m_cancelacion, Salida, salida_id, fecha_cancelacion=m_cancelacion)
                    cuenta["canceladas"] += 1
                    continue

                despacho = _fecha_entre(reserva, min(hoy, reserva + timedelta(days=5)))
                if habilitados and bernoulli(0.65):
                    forma = FORMA_ENTREGA_CON_TRANSPORTISTA
                    transportista_id = random.choices(habilitados, weights=pesos_transporte)[0].id
                else:
                    forma, transportista_id = FORMA_ENTREGA_RETIRA_CLIENTE, None
                salidas_services.despachar(db, salida_id, forma, transportista_id, despacho, actor())
                m_despacho = momento_de(despacho, m_reserva)
                fechar(m_despacho, Salida, salida_id, despachado_en=m_despacho)
                if destino == "despachada":
                    cuenta["despachadas"] += 1
                    continue

                llegada = _fecha_entre(despacho, min(hoy, despacho + timedelta(days=3)))
                m_llegada = momento_de(llegada, m_despacho)
                if destino == "entregada":
                    salidas_services.entregar(
                        db, salida_id, llegada,
                        random.choice(OBSERVACIONES_ENTREGA) if bernoulli(0.5) else None,
                        actor(),
                        recibido_por=recortar(fake.name(), 100) if bernoulli(0.7) else None,
                    )
                    fechar(m_llegada, Salida, salida_id, entregado_en=m_llegada)
                    cuenta["entregadas"] += 1
                    entregadas.append((salida_id, lote_id, llegada))
                    continue

                motivo = random.choices(MOTIVOS_RECHAZO, weights=pesos_rechazo)[0]
                detalle = (
                    random.choice(DETALLES_RECHAZO)
                    if motivo == MOTIVO_RECHAZO_OTRO or bernoulli(0.6) else None
                )
                salidas_services.rechazar(db, salida_id, motivo, detalle, llegada, actor())
                fechar(m_llegada)
                cuenta["rechazadas"] += 1
                if destino in ("rechazada_reingresada", "rechazada_desechada"):
                    reingresa = destino == "rechazada_reingresada"
                    salida = salidas_services.resolver_rechazo(
                        db, salida_id,
                        DISPOSICION_REINGRESADA if reingresa else DISPOSICION_DESECHADA,
                        random.choice(JUSTIFICACIONES_REINGRESO if reingresa else JUSTIFICACIONES_DESECHO),
                        actor(),
                    )
                    incidente_id = salida.incidente_id
                    m_decision = momento_de(
                        min(hoy, llegada + timedelta(days=random.randint(0, 5))), m_llegada
                    )
                    fechar(m_decision, Salida, salida_id, fecha_disposicion=m_decision)
                    # El incidente del rechazo se cerró al decidir, no al cargar.
                    if incidente_id is not None:
                        db.execute(
                            sa_update(Incidente)
                            .where(Incidente.id == incidente_id, Incidente.fecha_cierre.isnot(None))
                            .values(fecha_cierre=m_decision).execution_options(**sin_auditar)
                        )
                        db.commit()
                        db.expire_all()
                    cuenta["resueltas"] += 1
    finally:
        # Pase lo que pase, los lotes vencidos recuperan su vencimiento.
        db.rollback()
        quitar_vencimientos(vencidos)

    # Reclamos: sobre la primera entrega siempre, y sobre casi una de cada tres
    # del resto. Las entregas viejas quedan fuera del plazo de referencia.
    reclamos: list = []   # (reclamo_id, lote_id, fecha_reclamo)
    for indice, (salida_id, lote_id, entrega) in enumerate(entregadas):
        if indice and not bernoulli(0.3):
            continue
        motivo = random.choices(MOTIVOS_RECLAMO, weights=pesos_reclamo)[0]
        # La mayoría reclama a los pocos días; alguno, mucho después (y queda
        # fuera del plazo de referencia).
        fecha = min(hoy, entrega + timedelta(days=random.choice([0, 1, 1, 2, 3, 5, 8, 15, 40])))
        reclamo = reclamos_services.crear_reclamo(
            db,
            salida_id=salida_id,
            motivo=motivo,
            detalle=(
                random.choice(DETALLES_RECLAMO)
                if motivo == MOTIVO_RECLAMO_OTRO or bernoulli(0.7) else None
            ),
            fecha_reclamo=fecha,
            usuario=actor(),
        )
        reclamo_id = reclamo.id
        m_reclamo = momento_de(fecha)
        fechar(m_reclamo, Reclamo, reclamo_id, fecha_registro=m_reclamo)
        reclamos.append((reclamo_id, lote_id, fecha))
        cuenta["reclamos"] += 1

    # Retiros: uno nacido de un reclamo, con todos los afectados notificados y
    # cerrado; y varios manuales repartidos en el tiempo: los primeros también
    # cerrados, uno a medio notificar y el último recién iniciado.
    def retirar(lote_id: int, motivo: str, desde: date, reclamo_id=None) -> tuple:
        fecha_retiro = min(hoy, desde + timedelta(days=random.randint(0, 20)))
        retiro_id = retiros_services.iniciar_retiro(
            db, lote_id, motivo, random.choice(DETALLES_RETIRO), fecha_retiro,
            actor(), ORIGEN_RETIRO_MANUAL, reclamo_id=reclamo_id,
        ).id
        db.commit()
        m_retiro = momento_de(fecha_retiro)
        fechar(m_retiro, Retiro, retiro_id, fecha_registro=m_retiro)
        cuenta["retiros"] += 1
        return retiro_id, fecha_retiro, m_retiro

    def notificar(retiro_id: int, fecha_retiro: date, m_retiro: datetime, proporcion: float) -> datetime:
        """Notifica esa proporción de afectados; devuelve el momento del último aviso."""
        pendientes = list(db.scalars(
            select(RetiroAfectado.id).where(
                RetiroAfectado.retiro_id == retiro_id,
                RetiroAfectado.estado_notificacion == ESTADO_NOTIFICACION_PENDIENTE,
            )
        ).all())
        ultimo_aviso = m_retiro
        for afectado_id in pendientes[: round(len(pendientes) * proporcion)]:
            fecha_aviso = min(hoy, fecha_retiro + timedelta(days=random.randint(0, 4)))
            retiros_services.notificar_afectado(
                db, retiro_id, afectado_id, fecha_aviso,
                random.choice(MEDIOS_CONTACTO_RETIRO),
                random.choice(OBSERVACIONES_NOTIFICACION) if bernoulli(0.6) else None,
                actor(),
            )
            db.commit()
            m_aviso = momento_de(fecha_aviso, m_retiro)
            fechar(m_aviso)
            ultimo_aviso = max(ultimo_aviso, m_aviso)
            cuenta["notificados"] += 1
        return ultimo_aviso

    def cerrar(retiro_id: int, ultimo_aviso: datetime) -> None:
        retiros_services.cerrar_retiro(
            db, retiro_id, random.choice(ACCIONES_CORRECTIVAS), actor()
        )
        db.commit()
        m_cierre = min(ahora_mismo, ultimo_aviso + timedelta(days=random.randint(1, 6)))
        fechar(m_cierre, Retiro, retiro_id, fecha_cierre=m_cierre)
        cuenta["retiros_cerrados"] += 1

    retirados: set = set()
    if reclamos:
        reclamo_id, lote_id, fecha = reclamos[0]
        retiro_id, fecha_retiro, m_retiro = retirar(
            lote_id, "Reclamos de clientes", fecha, reclamo_id=reclamo_id
        )
        retirados.add(lote_id)
        cerrar(retiro_id, notificar(retiro_id, fecha_retiro, m_retiro, 1.0))

    motivos_manuales = [m for m in MOTIVOS_RETIRO if m != "Reclamos de clientes"]
    candidatos = sorted(con_salidas - retirados)
    random.shuffle(candidatos)
    manuales = candidatos[: max(2, cantidad // 4)]
    for indice, lote_id in enumerate(manuales):
        lote = db.get(LoteProducto, lote_id)
        desde = (lote.fecha_cierre or lote.fecha_inicio).date() + timedelta(days=random.randint(3, 40))
        retiro_id, fecha_retiro, m_retiro = retirar(
            lote_id, random.choice(motivos_manuales), min(hoy, desde)
        )
        # El último queda recién iniciado y el anterior a medio notificar.
        if indice == len(manuales) - 1:
            continue
        if indice == len(manuales) - 2:
            notificar(retiro_id, fecha_retiro, m_retiro, 0.5)
            continue
        cerrar(retiro_id, notificar(retiro_id, fecha_retiro, m_retiro, 1.0))

    db.info.pop("usuario_id", None)
    return cuenta


def crear_rotulado(db, cantidad: int, productos: list) -> dict:
    """Borradores de rotulado: autocompletados, a medio completar y completados.

    También por los services: el autocompletado toma la denominación, los
    ingredientes y la información nutricional de la receta y del lote, y cada
    dato que se escribe a mano deja su rastro en el historial de ediciones.
    """
    cuenta = {"borradores": 0, "completados": 0}
    admins = [
        p for p in db.scalars(select(Personal).where(Personal.activo.is_(True))).all()
        if p.puede_administrar
    ]
    productos = [producto for producto in productos if producto.activo]
    if not (admins and productos):
        return cuenta
    print("⏳ Generando borradores de rotulado...")

    for producto in random.sample(productos, min(len(productos), max(3, cantidad // 2))):
        producto_id = producto.id
        version = db.scalar(
            select(VersionReceta)
            .join(Receta, Receta.id == VersionReceta.receta_id)
            .where(Receta.producto_id == producto_id)
            .order_by(VersionReceta.numero.desc())
        )
        if version is None:
            continue
        version_id = version.id
        lote = db.scalar(
            select(LoteProducto)
            .where(
                LoteProducto.producto_id == producto_id,
                LoteProducto.version_receta_id == version_id,
                LoteProducto.estado == ESTADO_TERMINADO,
            )
            .order_by(LoteProducto.fecha_inicio.desc())
        )
        lote_id = lote.id if lote is not None else None
        vencimiento_lote = lote.fecha_vencimiento if lote is not None else None

        usuario = random.choice(admins)
        db.info["usuario_id"] = usuario.id
        _preparar_declaraciones_rotulado(db, producto, version)
        borrador_id = rotulado_services.crear_borrador(
            db, producto_id,
            BorradorRotuladoCreate(
                producto_id=producto_id, version_receta_id=version_id, lote_producto_id=lote_id
            ),
            usuario,
        ).id
        rotulado_services.autocompletar_borrador(db, borrador_id, version_id, lote_id, False, usuario)
        cuenta["borradores"] += 1

        # Un tercio queda solo autocompletado; el resto recibe los datos que
        # no salen de ningún lado (RNPA, elaborador, contenido neto...).
        if bernoulli(0.33):
            continue
        completo = bernoulli(0.6)
        cambios = {
            "contenido_neto": random.choice(DATOS_ROTULO["contenidos"]),
            "rnpa_rppa": f"RNPA 07-{random.randint(100000, 999999)}",
            "razon_social": DATOS_ROTULO["razon_social"],
            "domicilio": DATOS_ROTULO["domicilio"],
            "instrucciones_uso": random.choice(DATOS_ROTULO["instrucciones"]),
        }
        # Solo los campos que se tocan: el service aplica todo lo que venga
        # en el cuerpo, y un `estado=None` explícito pisaría el estado.
        if completo:
            cambios["fecha_duracion"] = vencimiento_lote or HOY + timedelta(days=180)
        rotulado_services.actualizar_borrador(
            db, borrador_id, BorradorRotuladoUpdate(**cambios), usuario
        )
        if completo:
            declaracion = declaraciones_services.consultar(db, borrador_id)
            if declaracion["vigencia"] == "vigente" and not declaracion["pendientes"]:
                try:
                    declaraciones_services.confirmar(
                        db, borrador_id, RevisionEsperada(revision=declaracion["revision"]), usuario
                    )
                except HTTPException as error:
                    if error.status_code not in (409, 422):
                        raise
                    db.rollback()
                    continue
                rotulado_services.actualizar_borrador(
                    db, borrador_id, BorradorRotuladoUpdate(estado=ESTADO_COMPLETADO), usuario
                )
                cuenta["completados"] += 1

    db.info.pop("usuario_id", None)
    return cuenta


def _fechar_evaluaciones_rotulado(db, producto_id: int) -> None:
    """Reparte las evaluaciones viejas en el último año y deja la más nueva."""
    filas = list(
        db.scalars(
            select(EvaluacionRotulado)
            .where(EvaluacionRotulado.producto_id == producto_id)
            .order_by(EvaluacionRotulado.id)
        ).all()
    )
    if len(filas) <= 1:
        return
    dias = sorted(random.sample(range(1, 360), len(filas) - 1))
    for fila, dias_atras in zip(filas[:-1], dias):
        fecha = _momento(dias_atras, 8, 17)
        fila.evaluado_en = fecha
        instantanea = dict(fila.instantanea)
        instantanea["evaluado_en"] = fecha.isoformat()
        fila.instantanea = instantanea
    db.commit()


def crear_rotulado_frontal(db, cantidad: int) -> dict:
    """Configuración por producto e historial de evaluaciones de octógonos.

    Cubre los estados de la pantalla: aplica, corregido a mano, canal no
    minorista, sin envasado, categoría exceptuada, sin definir y módulo
    inactivo. Usa los services para que el snapshot quede igual que en la app.
    """
    cuenta = {
        "configurados": 0,
        "evaluaciones": 0,
        "omitidos": 0,
        "estados": set(),
    }
    admins = [
        p for p in db.scalars(select(Personal).where(Personal.activo.is_(True))).all()
        if p.puede_administrar
    ]
    productos = list(db.scalars(select(Producto).where(Producto.activo.is_(True))).all())
    if not (admins and productos):
        return cuenta
    print("⏳ Generando configuración y evaluaciones de rotulado frontal...")

    escenarios = [
        {"nombre": "aplica", "canal": rotulado_frontal_constants.CANAL_MINORISTA, "envasado": True},
        {
            "nombre": "corregido",
            "canal": rotulado_frontal_constants.CANAL_MINORISTA,
            "envasado": True,
            "marcas": {
                "azucares_agregados": True,
                "grasas_agregadas": False,
                "sodio_agregado": True,
            },
        },
        {
            "nombre": "industrial",
            "canal": rotulado_frontal_constants.CANAL_MAYORISTA_INDUSTRIAL,
            "envasado": True,
        },
        {
            "nombre": "mayorista",
            "canal": rotulado_frontal_constants.CANAL_MAYORISTA,
            "envasado": True,
        },
        {
            "nombre": "no_envasado",
            "canal": rotulado_frontal_constants.CANAL_MINORISTA,
            "envasado": False,
        },
        {
            "nombre": "exceptuado",
            "canal": rotulado_frontal_constants.CANAL_MINORISTA,
            "envasado": True,
            "categoria": "azucar_comun",
        },
        {"nombre": "sin_definir"},
    ]
    elegidos = random.sample(
        productos, min(len(productos), max(len(escenarios), cantidad // 2))
    )

    for indice, producto in enumerate(elegidos):
        escenario = escenarios[indice % len(escenarios)]
        try:
            if escenario["nombre"] != "sin_definir":
                datos = {
                    "envasado_sin_cliente": escenario["envasado"],
                    "canal_comercializacion": escenario["canal"],
                }
                datos.update(escenario.get("marcas", {}))
                if escenario.get("categoria"):
                    datos["categoria_rotulado"] = escenario["categoria"]
                respuesta = rotulado_frontal_services.guardar_configuracion(
                    db, producto.id, ConfiguracionRotuladoIn(**datos)
                )
                cuenta["configurados"] += 1
                cuenta["evaluaciones"] += 1
                cuenta["estados"].add(respuesta.estado)
            for _ in range(random.randint(1, 2)):
                respuesta = rotulado_frontal_services.evaluar(db, producto.id)
                cuenta["evaluaciones"] += 1
                cuenta["estados"].add(respuesta.estado)
            _fechar_evaluaciones_rotulado(db, producto.id)
        except Exception:
            db.rollback()
            cuenta["omitidos"] += 1

    objetivo = elegidos[0]
    try:
        rotulado_frontal_services.actualizar_modulo(db, False)
        respuesta = rotulado_frontal_services.evaluar(db, objetivo.id)
        cuenta["evaluaciones"] += 1
        cuenta["estados"].add(respuesta.estado)
        _fechar_evaluaciones_rotulado(db, objetivo.id)
    except Exception:
        db.rollback()
        cuenta["omitidos"] += 1
    finally:
        try:
            rotulado_frontal_services.actualizar_modulo(db, True)
        except Exception:
            db.rollback()

    return cuenta


def crear_vista_publica(db) -> int:
    """Habilita la vista pública con un código y elige qué indicadores publicar.

    Respeta lo que ya exista (no pisa un código vigente ni preferencias).
    Devuelve la cantidad de indicadores agregados.
    """
    print("⏳ Cargando configuración de la vista pública...")
    if db.get(ConfiguracionVistaPublica, 1) is None:
        db.add(
            ConfiguracionVistaPublica(
                id=1, habilitada=True, codigo_publico=secrets.token_urlsafe(32)
            )
        )
    agregados = 0
    for definicion in CATALOGO_VISTA_PUBLICA:
        if db.get(IndicadorVistaPublica, definicion.clave) is not None:
            continue
        db.add(IndicadorVistaPublica(clave=definicion.clave, habilitado=bernoulli(0.75)))
        agregados += 1
    db.flush()
    return agregados


def crear_sesiones_auth(db, personal: list) -> dict:
    """Refresh tokens, tokens revocados e intentos de login de ejemplo.

    Son filas de bookkeeping: los `jti` son aleatorios y no corresponden a
    ningún JWT firmado, así que no abren sesión. Los intentos de login usan IPs
    de documentación para no bloquear a nadie que pruebe en local.
    """
    print("⏳ Cargando sesiones, revocaciones e intentos de login...")
    ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)
    cuenta = {"refresh": 0, "revocados": 0, "intentos": 0}
    activos = [p for p in personal if p.activo] or personal
    for persona in random.sample(activos, max(1, len(activos) // 3)):
        familia = uuid.uuid4().hex
        # Una familia rotada: tokens viejos usados y el último vigente.
        for paso in range(random.randint(1, 3)):
            creado = ahora_utc - timedelta(days=random.randint(0, 6), hours=paso)
            db.add(
                RefreshToken(
                    jti=uuid.uuid4().hex,
                    usuario_id=persona.id,
                    familia=familia,
                    usado=paso > 0,
                    expira=creado + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
                    creado_en=creado,
                )
            )
            cuenta["refresh"] += 1
        if bernoulli(0.5):
            db.add(
                TokenRevocado(
                    jti=uuid.uuid4().hex,
                    usuario_id=persona.id,
                    tipo=random.choice(["access", "refresh"]),
                    expira=ahora_utc + timedelta(minutes=random.randint(5, 30)),
                    revocado_en=ahora_utc - timedelta(minutes=random.randint(1, 120)),
                )
            )
            cuenta["revocados"] += 1
    for persona in random.sample(activos, min(4, len(activos))):
        ip = random.choice(IPS_INTENTOS_LOGIN)
        contador = random.randint(1, settings.LOGIN_MAX_INTENTOS)
        db.merge(
            IntentoLogin(
                ip=ip,
                dni=persona.dni,
                ultimo_intento=ahora_utc - timedelta(minutes=random.randint(1, 30)),
                contador=contador,
                bloqueado_hasta=(
                    ahora_utc + timedelta(minutes=settings.LOGIN_VENTANA_MINUTOS)
                    if contador >= settings.LOGIN_MAX_INTENTOS
                    else None
                ),
            )
        )
        cuenta["intentos"] += 1
    db.flush()
    return cuenta


def simular_actividad(
    db,
    fake: Faker,
    vistos: dict,
    password: str,
    admins: list,
    personal: list,
    equipos: list,
    aptitudes: list,
    quimicos: list,
    elementos: list,
    ingredientes: list,
    proveedores: Optional[list] = None,
    stocks: Optional[list] = None,
    lotes: Optional[list] = None,
    calibraciones: Optional[list] = None,
    planes: Optional[list] = None,
    planes_cal: Optional[list] = None,
    unidades: Optional[dict] = None,
) -> dict:
    """Genera historia en la bitácora: modificaciones, bajas, reactivaciones y bajas físicas.

    Las altas ya quedaron registradas al cargar los datos. Acá se opera sobre
    lo recién creado como lo haría la gente en la app: cada cambio es un
    commit propio, hecho por un administrador al azar (`session.info`), así la
    bitácora trae acciones MODIFICAR / BAJA / REACTIVAR / ELIMINAR con actores
    distintos. Se hace por el ORM (nunca con UPDATE/DELETE masivos) porque son
    los eventos del ORM los que alimentan la auditoría.

    Cubre todas las entidades auditadas con operaciones propias de cada una:

      * catálogos (equipos, aptitudes, ingredientes, elementos, químicos, sectores,
        unidades de medida, proveedores, configuración de alertas);
      * stock: consumos que bajan el saldo y dejan su movimiento de egreso,
        cambios del stock mínimo, corrección y borrado de lotes;
      * personal y vencimientos (renovación, baja, reactivación, borrado);
      * calibraciones y planes de calibración/mantenimiento;
      * planes de limpieza y sus tareas;
      * incidentes (reclasificación, cierre con su historial, borrado de
        cargas erróneas);
      * documentos (renombrar, renovar vencimiento, nueva versión que archiva
        la vigente, borrado de versiones archivadas y de documentos);
      * checklists (observación del supervisor, cierre).

    Solo se BORRA lo que nadie referencia: el resto se da de baja. Si aun así
    una FK lo impide, el borrado se deshace y se cuenta como `omitidos`.
    """
    print("⏳ Simulando actividad (modificaciones, bajas, reactivaciones y eliminaciones)...")
    cuenta = {"modificados": 0, "bajas": 0, "reactivados": 0, "eliminados": 0, "omitidos": 0}
    proveedores = list(proveedores or [])
    stocks = list(stocks or [])
    lotes = list(lotes or [])
    calibraciones = list(calibraciones or [])
    planes = list(planes or [])
    planes_cal = list(planes_cal or [])
    unidades = unidades or {}
    por_tipo = max(1, len(equipos) // 3)
    tipo_salida = _tipo_movimiento_salida()

    def como_admin_commit(clave: str, actor=None) -> None:
        """Un evento de negocio = un commit hecho por un administrador (al azar o el dado)."""
        db.info["usuario_id"] = (actor or random.choice(admins)).id
        db.commit()
        cuenta[clave] += 1

    def eliminar(*objetos) -> bool:
        """Borra los objetos en orden (hijos primero) y commitea como un solo evento.

        Si una FK lo impide se deshace y se sigue: no es un error del seed, solo
        una fila que la aplicación tampoco dejaría borrar.
        """
        db.info["usuario_id"] = random.choice(admins).id
        try:
            for objeto in objetos:
                db.delete(objeto)
                db.flush()
            db.commit()
        except IntegrityError:
            db.rollback()
            cuenta["omitidos"] += 1
            return False
        cuenta["eliminados"] += 1
        return True

    def muestra(lista: list, n: int = por_tipo):
        """Elige `n` objetos y los entrega de a uno, recargados.

        Cada commit expira todos los objetos de la sesión. Sobre un objeto
        expirado, asignar un campo no conoce el valor anterior y el diff de la
        bitácora saldría como [null, nuevo]. Recargarlo justo antes de
        tocarlo deja el "antes" correcto (en la app pasa igual: se lee y luego
        se modifica).
        """
        for objeto in random.sample(lista, min(n, len(lista))):
            db.refresh(objeto)
            yield objeto

    def muestra_por_id(modelo, condicion=None, n: int = por_tipo):
        """Como `muestra`, pero para tablas grandes: se sortean ids y se cargan de a uno.

        Sirve para checklists, incidentes o documentos, donde traer todas las
        filas solo para elegir unas pocas sería caro (`--cantidad 200` x días).
        """
        consulta = select(modelo.id)
        if condicion is not None:
            consulta = consulta.where(condicion)
        ids = list(db.scalars(consulta).all())
        for id_ in random.sample(ids, min(n, len(ids))):
            objeto = db.get(modelo, id_)
            if objeto is not None:
                db.refresh(objeto)
                yield objeto

    quimico_por_id = {q.id: q for q in quimicos}

    try:
        # ---------------- MODIFICAR ----------------
        for equipo in muestra(equipos):
            equipo.frecuencia_calibracion_dias = random.choice(
                [d for d in (90, 180, 365) if d != equipo.frecuencia_calibracion_dias]
            )
            _, _, ubicacion = random.choice(VOCAB_EQUIPOS)
            equipo.sector_id = obtener_o_crear_sector(db, ubicacion).id
            como_admin_commit("modificados")

        # Sectores: se renombran DESPUÉS de reasignar equipos, que busca el
        # sector por su nombre original.
        for sector in muestra_por_id(Sector):
            base = sector.nombre
            sector.nombre = unico(
                lambda: f"{base} {random.choice(['Norte', 'Sur', 'Principal', 'Auxiliar'])}",
                vistos["sector"],
                largo=40,
            )
            como_admin_commit("modificados")

        for elemento in muestra(elementos):
            elemento.frecuencia_recambio_dias = random.choice([15, 30, 60, 90])
            elemento.fecha_ultimo_recambio = HOY - timedelta(days=random.randint(0, 20))
            como_admin_commit("modificados")

        for aptitud in muestra(aptitudes):
            aptitud.descripcion = recortar(fake.sentence(nb_words=8), 255)
            como_admin_commit("modificados")

        for persona in muestra(personal):
            persona.telefono = unico(
                lambda: f"+549{random.randint(11, 292)}{random.randint(10_000_000, 99_999_999)}",
                vistos["telefono"],
                largo=15,
            )
            como_admin_commit("modificados")

        ids_personal = [p.id for p in personal]
        vencimientos = list(
            db.scalars(
                select(VencimientoPersonal).where(VencimientoPersonal.persona_id.in_(ids_personal))
            ).all()
        )
        for vencimiento in muestra(vencimientos):
            # Renovación: se corre la fecha de vencimiento hacia adelante.
            vencimiento.fecha_vencimiento = vencimiento.fecha_vencimiento + timedelta(
                days=random.choice([90, 180, 365])
            )
            como_admin_commit("modificados")

        # Cambio de contraseña: se audita que cambió, pero redactado ("***").
        # Un hash nuevo (otra sal) para que haya un cambio neto de verdad.
        hash_nuevo = hashear_password(password)
        for persona in muestra([p for p in personal if not p.es_super_admin], 2):
            persona.password = hash_nuevo
            como_admin_commit("modificados")

        # Proveedores: cambia la razón social o los datos de contacto.
        for proveedor in muestra(proveedores):
            if bernoulli(0.5):
                base = proveedor.nombre
                proveedor.nombre = unico(
                    lambda: recortar(
                        solo_letras(f"{base} {random.choice(['SA', 'SRL', 'Hnos', 'y Cía'])}"), 120
                    ),
                    vistos["proveedor"],
                    largo=120,
                )
            else:
                proveedor.contacto = recortar(f"{fake.name()} - {telefono_aleatorio()}", 150)
                proveedor.rubro = random.choice(RUBROS_PROVEEDOR)
            como_admin_commit("modificados")

        # Stock de insumos químicos: la mayoría de las veces es un consumo, que
        # baja el saldo y deja el movimiento de egreso que lo explica; el resto
        # son ajustes del stock mínimo.
        for stock in muestra(stocks):
            actor = random.choice(admins)
            actual = float(stock.cantidad_actual or 0)
            quimico = quimico_por_id.get(stock.insumo_quimico_id)
            if tipo_salida is not None and quimico is not None and actual > 0 and bernoulli(0.7):
                consumo = round(min(actual, random.uniform(1, 30)), 3)
                stock.cantidad_actual = round(actual - consumo, 3)
                movimiento = MovimientoStockInsumoQuimico(
                    insumo_quimico_id=quimico.id,
                    cantidad_variacion=-consumo,
                    tipo=tipo_salida,
                    fecha=datetime.now(),
                    motivo=random.choice(MOTIVOS_EGRESO),
                    nombre_producto=quimico.nombre,
                    unidad_simbolo=quimico.unidad_medida.simbolo
                    if quimico.unidad_medida
                    else None,
                )
                movimiento.responsable_id = actor.id
                movimiento.responsable_nombre = f"{actor.nombre} {actor.apellido or ''}".strip()
                db.add(movimiento)
            else:
                stock.stock_minimo = round(random.uniform(5, 50), 3)
            stock.actualizado_en = datetime.now()
            como_admin_commit("modificados", actor)

        # Lotes: se corrige un número de lote cargado a mano.
        for lote in muestra(lotes):
            lote.numero_lote = unico(
                lambda: f"LOTE-{random.randint(10000, 999999)}", vistos["lote"], largo=100
            )
            como_admin_commit("modificados")

        # Calibraciones: se corrige la fecha del próximo vencimiento.
        for calibracion in muestra(calibraciones):
            calibracion.proximo_vencimiento = calibracion.proximo_vencimiento + timedelta(
                days=random.choice([30, 90, 180])
            )
            como_admin_commit("modificados")

        # Planes de calibración/mantenimiento: se registra una intervención reciente.
        for plan_cal in muestra(planes_cal):
            plan_cal.fecha_ultima_intervencion = HOY - timedelta(days=random.randint(0, 30))
            if bernoulli(0.4):
                plan_cal.periodicidad_dias = random.choice(
                    [d for d in (30, 60, 90, 180, 365) if d != plan_cal.periodicidad_dias]
                )
            como_admin_commit("modificados")

        # Planes de limpieza: se renombran (solo letras, como exige el schema).
        for plan in muestra(planes):
            base = plan.nombre[:48].rstrip()
            plan.nombre = unico(
                lambda: recortar(
                    solo_letras(f"{base} {random.choice(['revisado', 'ajustado', 'vigente'])}"), 60
                ),
                vistos["plan"],
                largo=60,
            )
            como_admin_commit("modificados")

        # Tareas de esos planes: cambia la frecuencia y la observación.
        tareas = [t for p in planes for t in p.tareas]
        for tarea in muestra(tareas):
            tarea.frecuencia = random.choice([d for d in (1, 2, 3, 7, 15, 30) if d != tarea.frecuencia])
            tarea.observaciones = random.choice(OBSERVACIONES)
            como_admin_commit("modificados")

        # Unidades de medida: se corrige el símbolo de alguna.
        for unidad in muestra(list(unidades.values())):
            nuevo = SIMBOLOS_ALTERNATIVOS.get(unidad.simbolo)
            if nuevo and nuevo != unidad.simbolo:
                unidad.simbolo = nuevo
                como_admin_commit("modificados")

        # Configuración de alertas: un administrador ajusta los umbrales.
        for clave, opciones in (
            ("vencimiento_proximo_dias", (3, 5, 10, 15)),
            ("alerta_calibracion_dias", (15, 45, 60)),
            ("alerta_insumo_bajo_stock", (5, 15, 20)),
        ):
            config = db.get(ConfiguracionAlerta, clave)
            if config is not None:
                db.refresh(config)
                config.valor = random.choice([v for v in opciones if v != config.valor])
                como_admin_commit("modificados")

        # Documentos: se renombran y se renueva el vencimiento de la versión vigente.
        for documento in muestra_por_id(Documento):
            base = documento.nombre[:85].rstrip()
            documento.nombre = unico(
                lambda: recortar(f"{base} rev {random.randint(2, 9)}", 100),
                vistos["documento"],
                largo=100,
            )
            como_admin_commit("modificados")

        for version in muestra_por_id(
            VersionDocumento,
            VersionDocumento.vigente.is_(True) & VersionDocumento.fecha_vencimiento.is_not(None),
        ):
            version.fecha_vencimiento = HOY + timedelta(days=random.choice([90, 180, 365]))
            como_admin_commit("modificados")

        # Nueva versión: la vigente pasa a archivada y se sube otra. Es un
        # MODIFICAR (la archivada) más un CREAR (la nueva) en el mismo evento.
        carpeta_docs = CARPETA_UPLOADS / "documentos"
        carpeta_docs.mkdir(parents=True, exist_ok=True)
        for documento in muestra_por_id(Documento):
            vigente = db.scalar(
                select(VersionDocumento).where(
                    VersionDocumento.documento_id == documento.id,
                    VersionDocumento.vigente.is_(True),
                )
            )
            if vigente is None:
                continue
            ultimo = db.scalar(
                select(func.max(VersionDocumento.numero_version)).where(
                    VersionDocumento.documento_id == documento.id
                )
            )
            actor = random.choice(admins)
            ahora = datetime.now()
            # El actor tiene que estar en la sesión antes del flush que audita el UPDATE.
            db.info["usuario_id"] = actor.id
            vigente.vigente = False
            vigente.vigente_hasta = ahora
            vigente.fecha_vencimiento = None  # una archivada ya no rige
            db.flush()  # archivar antes de insertar la nueva (una sola vigente)
            _guardar_version(
                db,
                carpeta_docs,
                documento,
                numero_version=(ultimo or 0) + 1,
                nombre_documento=documento.nombre,
                autor=actor,
                vigente=True,
                subida=ahora,
                vencimiento=(
                    HOY + timedelta(days=random.choice([90, 180, 365])) if bernoulli(0.6) else None
                ),
                vigente_hasta=None,
            )
            como_admin_commit("modificados", actor)

        # Incidentes abiertos: se reclasifican y se cierran (con su historial).
        for incidente in muestra_por_id(
            Incidente, Incidente.estado == EstadoIncidente.ABIERTO.value
        ):
            opciones = [v for v in VOCAB_INCIDENTES if v[2] != incidente.descripcion]
            tipo, _, descripcion = random.choice(opciones)
            incidente.tipo = tipo.value
            incidente.descripcion = descripcion
            como_admin_commit("modificados")

        for incidente in muestra_por_id(
            Incidente, Incidente.estado == EstadoIncidente.ABIERTO.value
        ):
            responsable = random.choice(admins)
            ahora = datetime.now()
            observacion = random.choice(OBSERVACIONES_CIERRE)
            incidente.estado = EstadoIncidente.CERRADO.value
            incidente.fecha_cierre = ahora
            incidente.observacion_cierre = observacion
            incidente.responsable_cierre_id = responsable.id
            db.add(
                HistorialIncidente(
                    incidente_id=incidente.id,
                    estado_anterior=EstadoIncidente.ABIERTO.value,
                    estado_nuevo=EstadoIncidente.CERRADO.value,
                    usuario_id=responsable.id,
                    observacion=observacion,
                    fecha_evento=ahora,
                )
            )
            como_admin_commit("modificados", responsable)

        # Checklists: el supervisor observa uno cerrado, cierra uno observado
        # y cierra uno completo.
        for checklist in muestra_por_id(Checklist, Checklist.estado == EstadoChecklist.CERRADO):
            checklist.estado = EstadoChecklist.OBSERVADO
            checklist.observaciones = random.choice(OBSERVACIONES_CHECKLIST)
            checklist.supervisor_id = random.choice(admins).id
            como_admin_commit("modificados")

        for checklist in muestra_por_id(Checklist, Checklist.estado == EstadoChecklist.OBSERVADO):
            checklist.estado = EstadoChecklist.CERRADO
            como_admin_commit("modificados")

        for checklist in muestra_por_id(Checklist, Checklist.estado == EstadoChecklist.COMPLETO):
            checklist.estado = EstadoChecklist.CERRADO
            checklist.supervisor_id = random.choice(admins).id
            como_admin_commit("modificados")

        # ---------------- BAJA ----------------
        # A los administradores no se los da de baja: son los actores del resto.
        candidatos_baja = [
            p for p in personal if not p.puede_administrar and not p.es_super_admin
        ]
        grupos = [
            equipos, ingredientes, quimicos, elementos, aptitudes, vencimientos, candidatos_baja,
            proveedores, calibraciones, planes, planes_cal,
        ]
        for grupo in grupos:
            for objeto in muestra([o for o in grupo if o.activo]):
                objeto.activo = False
                como_admin_commit("bajas")

        # ---------------- REACTIVAR ----------------
        # Mezcla de lo que se acaba de dar de baja y de lo que ya nació inactivo.
        for grupo in grupos:
            inactivos = [o for o in grupo if not o.activo]
            for objeto in muestra(inactivos, max(1, len(inactivos) // 2)):
                objeto.activo = True
                como_admin_commit("reactivados")

        # ---------------- ELIMINAR ----------------
        # Solo se borra lo que nadie referencia: el resto se da de baja. Un
        # vencimiento no lo referencia nadie (los ingredientes están en recetas).
        for objeto in muestra(vencimientos):
            db.delete(objeto)
            como_admin_commit("eliminados")

        # Lotes cargados por error (el movimiento de ingreso queda como historia).
        for lote in muestra(lotes, max(1, len(lotes) // 6)):
            eliminar(lote)

        # Proveedores que no tienen ningún lote (ni de químicos ni de ingredientes).
        con_lotes = set(db.scalars(select(LoteStock.proveedor_id)).all()) | set(
            db.scalars(select(LoteInsumo.proveedor_id)).all()
        )
        sin_lotes = [p for p in proveedores if p.id not in con_lotes]
        for proveedor in random.sample(sin_lotes, min(por_tipo, len(sin_lotes))):
            eliminar(proveedor)

        # Se borra a lo sumo la mitad: con pocas calibraciones (una por equipo
        # de medición) borrar `por_tipo` dejaba la tabla vacía.
        for objeto in chain(
            muestra(calibraciones, len(calibraciones) // 2), muestra(planes_cal)
        ):
            eliminar(objeto)

        # Incidentes abiertos cargados por error. Los del superadmin se conservan:
        # son los que dan segunda página a "Mis reportes".
        superadmin_id = personal[0].id if personal else None
        for incidente in muestra_por_id(
            Incidente,
            (Incidente.estado == EstadoIncidente.ABIERTO.value)
            & (Incidente.usuario_id != superadmin_id),
        ):
            eliminar(incidente)

        # Versiones archivadas, y algún documento entero (sus versiones primero).
        for version in muestra_por_id(VersionDocumento, VersionDocumento.vigente.is_(False)):
            eliminar(version)
        for documento in muestra_por_id(Documento, n=max(1, por_tipo // 3)):
            versiones = list(
                db.scalars(
                    select(VersionDocumento).where(VersionDocumento.documento_id == documento.id)
                ).all()
            )
            eliminar(*versiones, documento)

        # Unidades sin uso. El catálogo tiene que seguir por encima de las 10
        # filas de una página (ver `UNIDADES`), así que solo se borra el excedente.
        usadas = set(db.scalars(select(Ingrediente.unidad_medida_id)).all()) | set(
            db.scalars(select(InsumoQuimico.unidad_medida_id)).all()
        )
        sin_uso = [u for u in unidades.values() if u.id not in usadas]
        total_unidades = db.scalar(select(func.count()).select_from(UnidadMedida)) or 0
        borrables = min(por_tipo, len(sin_uso), max(0, total_unidades - 11))
        for unidad in random.sample(sin_uso, borrables):
            eliminar(unidad)
    finally:
        db.info.pop("usuario_id", None)

    return cuenta


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Carga datos de ejemplo generados con Faker.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("-c", "--cantidad", type=int, default=15, help="Filas por entidad.")
    p.add_argument(
        "-s",
        "--seed",
        type=int,
        default=0,
        help="Semilla de Faker. 0 = aleatoria; un número fijo hace el resultado reproducible.",
    )
    p.add_argument("--password", default=CONTRASENA_POR_DEFECTO, help="Contraseña de todo el personal.")
    p.add_argument(
        "--dias-checklist",
        type=int,
        default=365,
        help="Días hacia atrás que se generan para cada plan de limpieza.",
    )
    p.add_argument(
        "--dias-historia",
        type=int,
        default=365,
        help=(
            "Días hacia atrás que abarcan los lotes de producción, los ingresos "
            "de ingredientes, los incidentes y las calibraciones."
        ),
    )
    p.add_argument("--locale", default="es_AR", help="Locale de Faker.")
    p.add_argument(
        "--sin-actividad",
        action="store_true",
        help=(
            "Solo altas: no simula modificaciones, bajas, reactivaciones ni "
            "eliminaciones (por defecto la bitácora trae todas las acciones)."
        ),
    )
    p.add_argument(
        "--agregar",
        action="store_true",
        help="No borra lo existente: agrega filas nuevas evitando duplicados.",
    )
    return p.parse_args()


def main(preparar_esquema: bool = True) -> int:
    args = parse_args()

    if args.cantidad < 1:
        print("❌ --cantidad tiene que ser mayor a cero.")
        return 1
    if args.dias_checklist < 1:
        print("❌ --dias-checklist tiene que ser mayor a cero.")
        return 1
    if args.dias_historia < 30:
        print("❌ --dias-historia tiene que ser de al menos 30 días.")
        return 1

    random.seed(args.seed or None)
    Faker.seed(args.seed or None)
    fake = Faker(args.locale)

    db = SessionLocal()
    # Auditar el seed para que la vista de auditoría muestre todas las entidades.
    # db.info["sin_auditoria"] = True
    try:
        # Guarda por entorno: abortar en producción y mostrar la base objetivo.
        entorno = settings.ENV.upper()
        print(f"📦 Base de datos objetivo: {settings.DB_URL}")
        print(f"   Entorno: {entorno}")
        if entorno == "PRODUCTION":
            print("❌ Abortando: no se puede cargar datos en entorno PRODUCTION.")
            return 1
        if entorno not in ("DEVELOPMENT", "TEST"):
            print(f"❌ Abortando: entorno no soportado para carga de datos: {entorno}.")
            return 1

        if preparar_esquema:
            crear_tablas_y_migrar()

        if not args.agregar:
            borrar_todo(db)
        else:
            print("➕ Modo agregar: se conserva lo que ya estaba cargado.")

        # Valores ya usados, para no violar ningún UNIQUE en modo agregar.
        vistos = {
            "dni": valores_existentes(db, Personal.dni),
            "email": valores_existentes(db, Personal.email),
            "telefono": set(),
            "incidente": set(db.scalars(select(Incidente.titulo)).all()),
            "equipo": set(db.scalars(select(Equipo.nombre)).all()),
            "aptitud": set(db.scalars(select(Aptitud.nombre)).all()),
            "plan": set(db.scalars(select(PlanLimpieza.nombre)).all()),
            "quimico": set(db.scalars(select(InsumoQuimico.nombre)).all()),
            "elemento": set(db.scalars(select(ElementoLimpieza.nombre)).all()),
            "ingrediente": set(db.scalars(select(Ingrediente.nombre)).all()),
            "unidad": set(db.scalars(select(UnidadMedida.nombre)).all()),
            "documento": set(db.scalars(select(Documento.nombre)).all()),
            "proveedor": set(db.scalars(select(Proveedor.nombre)).all()),
            "matricula": set(db.scalars(select(Proveedor.matricula)).all()),
            "lote": set(db.scalars(select(LoteStock.numero_lote)).all()),
            "sector": set(db.scalars(select(Sector.nombre)).all()),
            "producto": set(db.scalars(select(Producto.nombre)).all()),
            "lote_insumo": set(db.scalars(select(LoteInsumo.numero_lote)).all()),
            "lote_producto": set(db.scalars(select(LoteProducto.numero_lote)).all()),
            "cliente": set(db.scalars(select(Cliente.nombre)).all()),
            "cliente_doc": set(db.scalars(select(Cliente.documento)).all()),
            "transportista": set(db.scalars(select(Transportista.razon_social)).all()),
            "transportista_cuit": set(db.scalars(select(Transportista.cuit)).all()),
        }

        # Un solo hash para todo el personal: bcrypt es lento (~0,3 s por
        # hash) y con --cantidad 500 la diferencia es de varios minutos.
        print("🔐 Hasheando la contraseña...")
        hash_password = hashear_password(args.password)

        unidades = crear_unidades(db, vistos)
        crear_configuracion_alertas(db)
        personal = crear_personal(db, args.cantidad, fake, vistos, hash_password)
        proveedores = crear_proveedores(db, args.cantidad, fake, vistos)
        equipos = crear_equipos(db, args.cantidad, vistos)
        calibraciones = crear_calibraciones(db, equipos, args.dias_historia)
        aptitudes = crear_aptitudes(db, args.cantidad, vistos)

        admins = [p for p in personal if p.puede_administrar]
        operadores = [p for p in personal if not p.puede_administrar and p.puede_operar]
        # Sin admins no se puede crear nada: el plan necesita un autor.
        if not admins:
            admins = personal[:1]
        if not operadores:
            operadores = admins

        vencimientos = crear_vencimientos(db, personal, aptitudes)
        quimicos = crear_quimicos(db, args.cantidad, unidades, vistos)
        elementos = crear_elementos(db, args.cantidad, vistos)
        planes = crear_planes_y_tareas(db, args.cantidad, equipos, admins, vistos, operadores)
        registros = crear_checklists(db, planes, operadores, quimicos, elementos, args.dias_checklist)
        # Después de los checklists: el saldo descuenta lo que ellos consumieron.
        stocks, lotes, movimientos_stock = crear_stock_y_movimientos(
            db, quimicos, proveedores, admins, args.dias_checklist, vistos
        )
        historial_registros = crear_historial_registro_tarea(db)
        # Cinco veces la cantidad: con menos, la evolución mensual por tipo
        # queda en ceros y unos.
        incidentes = crear_incidentes(
            db, args.cantidad * 5, equipos, personal, admins, operadores, vistos,
            args.dias_historia,
        )
        historial_incidentes = crear_historial_incidente(db, admins)
        documentos = crear_documentos(db, args.cantidad, admins, vistos)
        cal_mantenimiento = crear_planes_cal_mantenimiento(db, args.cantidad, equipos, admins)
        clientes = crear_clientes(db, args.cantidad, fake, vistos)
        transporte = crear_transportistas(db, args.cantidad, fake, vistos, admins)

        # Trazabilidad: productos -> recetas versionadas -> lotes de insumo ->
        # lotes de producción con checklist y consumos.
        ingredientes = crear_ingredientes(db, unidades, vistos)
        alergenos_asignados = crear_alergenos_ingredientes(db, ingredientes)
        productos, versiones = crear_productos_y_recetas(
            db, args.cantidad, ingredientes, unidades, admins, vistos
        )
        nutricion = crear_datos_nutricionales(db, ingredientes, productos, admins)
        lotes_insumo = crear_lotes_insumo(
            db, ingredientes, proveedores, admins, vistos, args.dias_historia
        )
        produccion = crear_lotes_produccion(
            db, args.cantidad * 8, productos, versiones, lotes_insumo,
            proveedores, admins, operadores, vistos, args.dias_historia,
        )
        asociaciones = crear_marcas_sin_lotes(db, proveedores, ingredientes)
        homologaciones = homologar_insumos(db, admins)
        indicadores_vp = crear_vista_publica(db)

        db.commit()

        # Las altas ya están commiteadas (como "sistema"). Sobre ellas se simula
        # lo que haría la gente en la app, para que la bitácora tenga historia.
        actividad: dict = {}
        if not args.sin_actividad:
            actividad = simular_actividad(
                db, fake, vistos, args.password, admins, personal, equipos,
                aptitudes, quimicos, elementos, list(ingredientes.values()),
                proveedores=proveedores, stocks=stocks, lotes=lotes,
                calibraciones=calibraciones, planes=planes,
                planes_cal=cal_mantenimiento, unidades=unidades,
            )
            for clave, n in simular_actividad_trazabilidad(
                db, admins, productos, lotes_insumo
            ).items():
                actividad[clave] += n
            for clave, n in simular_actividad_comercial(
                db, fake, admins, clientes,
                list(db.scalars(select(Transportista).order_by(Transportista.id)).all()),
            ).items():
                actividad[clave] += n

        bajas_insumo = crear_bajas_lote_insumo(db, lotes_insumo, admins)

        # Circuito comercial y rotulado: van después de la actividad simulada
        # (que reclasifica y borra incidentes al azar) porque sus incidentes
        # automáticos no se pueden editar. Cada service hace su propio commit.
        db.info.pop("usuario_id", None)
        comercial = crear_circuito_comercial(db, fake, args.cantidad)
        rotulado = crear_rotulado(db, args.cantidad, productos)
        rotulado_frontal = crear_rotulado_frontal(db, args.cantidad)

        # Sesiones de ejemplo, después de la actividad (que puede borrar personas).
        sesiones = crear_sesiones_auth(db, list(db.scalars(select(Personal)).all()))
        db.commit()

        # La caché de notificaciones se recalcula sobre los datos finales, igual
        # que en la primera lectura de la app.
        print("⏳ Calculando notificaciones...")
        asegurar_notificaciones_al_dia(db)
        notificaciones = db.scalar(select(func.count()).select_from(NotificacionPersistida))

        # --------------------------------------------------------------
        # Resumen
        # --------------------------------------------------------------
        print()
        print("✅ ¡Datos cargados con éxito!")
        print(f"   Semilla: {args.seed or 'aleatoria'} · Locale: {args.locale}")
        print(f"   Personal: {len(personal)} · Equipos: {len(equipos)} · Aptitudes: {len(aptitudes)}")
        print(f"   Proveedores: {len(proveedores)} · Vencimientos: {vencimientos} · Planes de limpieza: {len(planes)}")
        print(
            f"   Stock insumos: {len(stocks)} · Lotes stock: {len(lotes)} · "
            f"Movimientos de stock: {movimientos_stock} · Calibraciones: {len(calibraciones)}"
        )
        print(f"   Registros de tarea: {registros} · Historial registros: {historial_registros} · Incidentes: {incidentes}")
        print(f"   Historial incidentes: {historial_incidentes} · Documentos: {documentos}")
        print(f"   Planes calibración/mantenimiento: {len(cal_mantenimiento)}")
        print(
            f"   Productos: {len(productos)} · Versiones de receta: "
            f"{sum(len(v) for v in versiones.values())} · Materias primas: {len(ingredientes)}"
        )
        print(
            f"   Lotes de insumo: {produccion.get('lotes_insumo', len(lotes_insumo))} · "
            f"Lotes de producción: {produccion['lotes']} · Ítems de checklist: {produccion['items']}"
        )
        print(
            f"   Bajas de lotes de insumo: {bajas_insumo['totales']} totales · "
            f"{bajas_insumo['parciales']} parciales"
        )
        print(
            f"   Consumos reales: {produccion['consumos']} · Desperdicios: {produccion['desperdicios']}"
        )
        print(
            f"   Información nutricional: {nutricion['ingredientes']} materias primas con "
            f"{nutricion['valores']} valores ({nutricion['modificados']} corregidos a mano) · "
            f"{nutricion['productos']} productos con porción · "
            f"{nutricion['laboratorio']} valores de laboratorio"
        )
        print(
            f"   Proveedores certificados: {sum(1 for p in proveedores if p.es_certificado)} · "
            f"Insumos asociados a proveedores: {asociaciones} · Alérgenos asignados: {alergenos_asignados}"
            f"\n   Homologación de insumos: {homologaciones['aprobadas']} aprobados, "
            f"{homologaciones['observadas']} aprobados con observación, {homologaciones['pendientes']} pendientes"
        )
        print(
            f"   Clientes: {len(clientes)} · Transportistas: {transporte['transportistas']} "
            f"({transporte['habilitados']} habilitados) · "
            f"Certificaciones de transporte: {transporte['certificaciones']}"
        )
        # Estado final leído de la base: un retiro cancela las reservas de su
        # lote, así que no coincide con lo que se fue generando.
        salidas_por_estado = dict(
            db.execute(select(Salida.estado, func.count()).group_by(Salida.estado)).all()
        )
        print(
            f"   Salidas generadas: {comercial['salidas']} · En la base: "
            + " · ".join(f"{estado} {n}" for estado, n in sorted(salidas_por_estado.items()))
            + f" ({comercial['resueltas']} rechazos resueltos)"
        )
        print(
            f"   Reclamos: {comercial['reclamos']} · Retiros de lote: {comercial['retiros']} "
            f"({comercial['retiros_cerrados']} cerrados, {comercial['notificados']} afectados notificados) · "
            f"Borradores de rotulado: {rotulado['borradores']} ({rotulado['completados']} completados)"
        )
        print(
            f"   Rotulado frontal: {rotulado_frontal['configurados']} productos configurados · "
            f"{rotulado_frontal['evaluaciones']} evaluaciones · estados: "
            f"{', '.join(sorted(rotulado_frontal['estados'])) or 'sin evaluaciones'}"
        )
        print(
            f"   Vista pública: {indicadores_vp} indicadores · Notificaciones: {notificaciones}"
        )
        print(
            f"   Sesiones: {sesiones['refresh']} refresh tokens · {sesiones['revocados']} revocados · "
            f"{sesiones['intentos']} intentos de login"
        )
        if actividad:
            print(
                "   Actividad simulada: "
                f"{actividad['modificados']} modificaciones · {actividad['bajas']} bajas · "
                f"{actividad['reactivados']} reactivaciones · {actividad['eliminados']} eliminaciones"
            )
            if actividad["omitidos"]:
                print(
                    f"   (se omitieron {actividad['omitidos']} borrados que una FK impedía)"
                )
        por_accion = dict(
            db.execute(select(AuditLog.accion, func.count()).group_by(AuditLog.accion)).all()
        )
        print(
            "   Bitácora: "
            + " · ".join(f"{accion} {n}" for accion, n in sorted(por_accion.items()))
        )
        print()
        print(f"🔑 Contraseña de todo el personal: {args.password}")
        print("👤 Usuarios administradores (el login es con DNI):")
        for a in admins[:5]:
            print(f"   • {a.nombre} {a.apellido} — DNI {a.dni}")
        if len(admins) > 5:
            print(f"   … y {len(admins) - 5} más")

        return 0

    except Exception:
        db.rollback()
        print("❌ Error al cargar datos:")
        import traceback

        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
