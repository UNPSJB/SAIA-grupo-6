"""Carga integral de datos de desarrollo generados con Faker.

Orquesta los seeds mantenidos por cada dominio para no duplicar la logica ni
desincronizar las relaciones entre modelos:

* aplica las migraciones actuales del backend;
* carga datos Faker, incluido el circuito comercial y el rotulado con
  declaraciones de alergenos, gluten y conservacion;
* prepara un rotulo demo con lote, tabla nutricional y octogonos;
* completa los universos necesarios para los indicadores de la vista publica;
* inicializa configuraciones globales sin publicar ningun enlace anonimo.

Uso desde ``backend/``:

    .venv\\Scripts\\python.exe cargar_datos_ultimo.py
    .venv\\Scripts\\python.exe cargar_datos_ultimo.py --cantidad 40 --seed 7
    .venv\\Scripts\\python.exe cargar_datos_ultimo.py --agregar
    .venv\\Scripts\\python.exe cargar_datos_ultimo.py --simular-actividad

El modo por defecto reemplaza los datos de dominio como el seeder Faker base,
pero deja la vista publica desactivada: su habilitacion y la seleccion final de
indicadores siguen siendo decisiones administrativas desde la aplicacion.
"""

import argparse
import sys
import traceback
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

# Permite ejecutar el script desde cualquier directorio.
RAIZ = Path(__file__).resolve().parent
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

import src.all_models  # noqa: F401,E402
from src.common.fechas import ahora  # noqa: E402
from src.database import SessionLocal  # noqa: E402
from src.config import settings  # noqa: E402
from src.migrations import crear_tablas_y_migrar  # noqa: E402
from src.insumos.models import Insumo  # noqa: E402
from src.lotes.constants import ESTADO_TERMINADO  # noqa: E402
from src.lotes.models import LoteProducto  # noqa: E402
from src.nutricion.constants import FUENTE_PROPIO  # noqa: E402
from src.nutricion.models import (  # noqa: E402
    InfoNutricionalProducto,
    PerfilNutricionalInsumo,
    ValorNutricionalInsumo,
)
from src.personal.models import Personal  # noqa: E402
from src.productos.models import Producto  # noqa: E402
from src.recetas.models import Receta  # noqa: E402
from src.rotulado import declaraciones_services, services as rotulado_services  # noqa: E402
from src.rotulado.constants import CAMPO_COMPLETO, CAMPO_NO_APLICABLE, ESTADO_COMPLETADO  # noqa: E402
from src.rotulado.declaraciones_schemas import (  # noqa: E402
    ConservacionProducto,
    MarcaAlergeno,
    PerfilInsumoDeclaracion,
    RevisionEsperada,
)
from src.rotulado.models import BorradorRotulado  # noqa: E402
from src.rotulado.schemas import BorradorRotuladoCreate, BorradorRotuladoUpdate  # noqa: E402
from src.rotulado_frontal import constants as frontal_constants  # noqa: E402
from src.rotulado_frontal import services as frontal_services  # noqa: E402
from src.rotulado_frontal.schemas import ConfiguracionRotuladoIn  # noqa: E402
from src.unidadMedida.models import UnidadMedida  # noqa: E402
from src.notificaciones.models import ConfiguracionAlerta  # noqa: E402
from src.notificaciones.invalidacion import (  # noqa: E402
    asegurar_notificaciones_al_dia,
    invalidar_notificaciones,
)
from src.vistaPublica.constants import CATALOGO  # noqa: E402
from src.vistaPublica.models import (  # noqa: E402
    ConfiguracionVistaPublica,
    IndicadorVistaPublica,
)

from scripts import cargar_datos_faker as seed_faker
import cargar_datos_vista_publica as seed_vista_publica  # noqa: E402


CLAVE_DIAS_ALERTA_VENCIMIENTO = "dias_alerta_vencimiento_personal"
DIAS_ALERTA_POR_DEFECTO = 30
PRODUCTO_ROTULO_DEMO = "Galletitas de cacao — demo de rotulado"
LOTE_ROTULO_DEMO = "DEMO-ROTULO-001"


@contextmanager
def argumentos_temporales(argumentos: list[str]) -> Iterator[None]:
    """Ejecuta un seeder existente con argumentos sin alterar el proceso padre."""
    anteriores = sys.argv
    sys.argv = argumentos
    try:
        yield
    finally:
        sys.argv = anteriores


def parsear_argumentos() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Carga integral de datos Faker para todos los dominios de SAIA.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("-c", "--cantidad", type=int, default=20, help="Filas Faker por entidad.")
    parser.add_argument("-s", "--seed", type=int, default=42, help="Semilla reproducible de Faker.")
    parser.add_argument(
        "--password",
        default="12345678",
        help="Contrasena de las cuentas generadas (solo desarrollo/test).",
    )
    parser.add_argument(
        "--dias-checklist",
        type=int,
        default=60,
        help="Dias de checklists Faker; 60 cubre ambos periodos de la vista publica.",
    )
    parser.add_argument("--locale", default="es_AR", help="Locale de Faker.")
    parser.add_argument(
        "--agregar",
        action="store_true",
        help="Conserva datos y configuraciones existentes y agrega nuevos ejemplos.",
    )
    parser.add_argument(
        "--simular-actividad",
        action="store_true",
        help="Simula modificaciones, bajas y eliminaciones para poblar la auditoria.",
    )
    return parser.parse_args()


def argumentos_seed_faker(args: argparse.Namespace) -> list[str]:
    """Traduce los argumentos del orquestador a los del seed generico."""
    argumentos = [
        "cargar_datos_faker.py",
        "--cantidad",
        str(args.cantidad),
        "--seed",
        str(args.seed),
        "--password",
        args.password,
        "--dias-checklist",
        str(args.dias_checklist),
        "--locale",
        args.locale,
    ]
    if args.agregar:
        argumentos.append("--agregar")
    if not args.simular_actividad:
        # Mantiene activos los datos de referencia para que las metricas y las
        # relaciones generadas representen un escenario consistente.
        argumentos.append("--sin-actividad")
    return argumentos


def asegurar_configuraciones(agregar: bool) -> None:
    """Completa los ajustes persistidos que no pertenecen a un CRUD de dominio.

    El seeder Faker tambien genera sesiones e intentos de login de ejemplo.
    La auditoria se crea por los listeners ORM y los servicios de dominio.
    """
    with SessionLocal() as db:
        try:
            alerta = db.get(ConfiguracionAlerta, {"establecimiento_id": 1, "clave": CLAVE_DIAS_ALERTA_VENCIMIENTO})
            if alerta is None:
                db.add(
                    ConfiguracionAlerta(
                        clave=CLAVE_DIAS_ALERTA_VENCIMIENTO,
                        valor=DIAS_ALERTA_POR_DEFECTO,
                    )
                )

            configuracion = db.get(ConfiguracionVistaPublica, 1)
            if configuracion is None:
                configuracion = ConfiguracionVistaPublica(establecimiento_id=1, habilitada=False)
                db.add(configuracion)
            elif not agregar:
                # El seed completo no debe dejar expuesto un enlace que pudo
                # apuntar a datos de una carga anterior.
                configuracion.habilitada = False
                configuracion.codigo_publico = None

            for definicion in CATALOGO:
                indicador = db.get(IndicadorVistaPublica, {"establecimiento_id": 1, "clave": definicion.clave})
                if indicador is None:
                    db.add(
                        IndicadorVistaPublica(
                            clave=definicion.clave,
                            habilitado=definicion.habilitado_por_defecto,
                        )
                    )

            db.commit()
        except Exception:
            db.rollback()
            raise


def crear_lote_rotulo_demo(db: Session, usuario: Personal) -> LoteProducto:
    """Crea los maestros exclusivos del ejemplo, con valores fijos para los sellos."""
    kilogramo = db.scalars(select(UnidadMedida).where(UnidadMedida.simbolo == "kg")).one()
    producto = Producto(
        nombre=PRODUCTO_ROTULO_DEMO,
        descripcion="Producto ficticio para probar la previsualización de rotulado.",
        unidad_medida_id=kilogramo.id,
        conservacion=ConservacionProducto(
            instrucciones="Conservar en lugar fresco y seco.",
        ).model_dump(mode="json"),
    )
    ficha = "Ficha técnica ficticia de la premezcla demo."
    premezcla = Insumo(
        nombre="Premezcla demo (harina de trigo, azúcar, manteca, cacao y sal)",
        unidad_medida_id=kilogramo.id,
        perfil_declaracion=PerfilInsumoDeclaracion(
            evaluacion="evaluada",
            marcas=[
                MarcaAlergeno(codigo="trigo", forma="directa"),
                MarcaAlergeno(codigo="leche", forma="derivado"),
            ],
            gluten="presente",
            respaldo=ficha,
        ).model_dump(mode="json"),
    )
    receta = Receta(producto=producto)
    db.add_all([receta, premezcla])
    db.flush()

    db.add_all([
        InfoNutricionalProducto(
            producto_id=producto.id, expresar_en="g", porcion=Decimal("30"),
            medida_casera="3 galletitas",
        ),
        PerfilNutricionalInsumo(
            insumo_id=premezcla.id, azucares_son_anadidos=True,
            grasas_son_anadidas=True, sodio_es_anadido=True,
        ),
    ])
    # Por 100 g. El cálculo deriva los azúcares añadidos de los azúcares totales.
    nutrientes = {
        "energia": 500,
        "carbohidratos": 60,
        "azucares_totales": 24,
        "proteinas": 8,
        "grasas_totales": 26,
        "grasas_saturadas": 14,
        "grasas_trans": 0,
        "fibra": 3,
        "sodio": 700,
    }
    for nutriente, cantidad in nutrientes.items():
        valor = Decimal(cantidad)
        db.add(ValorNutricionalInsumo(
            insumo_id=premezcla.id, nutriente=nutriente, valor=valor, valor_fuente=valor,
            fuente=FUENTE_PROPIO, referencia=ficha, cargado_por_id=usuario.id,
        ))

    producido_en = ahora() - timedelta(days=2)
    plantilla = {
        "producto": PRODUCTO_ROTULO_DEMO,
        "unidad": "kilogramo",
        "rendimiento": "10",
        "tareas": ["Formar, hornear y envasar las galletitas"],
        "insumos": [(premezcla.nombre, "10", premezcla.tipo, 0)],
    }
    version = seed_faker._agregar_version(
        db, receta, 1, plantilla, {premezcla.nombre: premezcla}, {"kilogramo": kilogramo},
        usuario, producido_en - timedelta(days=1),
    )
    vida_util_dias = 180
    version.vida_util_dias = vida_util_dias
    lote = LoteProducto(
        numero_lote=LOTE_ROTULO_DEMO, producto=producto, version_receta=version,
        estado=ESTADO_TERMINADO, cantidad_objetivo=version.rendimiento,
        cantidad_producida=version.rendimiento, factor_escala=Decimal("1"),
        creado_por_id=usuario.id, fecha_inicio=producido_en,
        fecha_cierre=producido_en + timedelta(hours=4),
        fecha_vencimiento=producido_en.date() + timedelta(days=vida_util_dias),
    )
    db.add(lote)
    db.commit()
    return lote


def asegurar_rotulo_demo(db: Session) -> None:
    usuario = db.scalars(
        select(Personal)
        .where(Personal.activo.is_(True), Personal.puede_administrar.is_(True))
        .order_by(Personal.id)
    ).first()
    if usuario is None:
        raise RuntimeError("Falta un administrador activo para preparar el rótulo demo.")
    db.info["usuario_id"] = usuario.id

    lote = db.scalar(select(LoteProducto).where(LoteProducto.numero_lote == LOTE_ROTULO_DEMO))
    if lote is None:
        lote = crear_lote_rotulo_demo(db, usuario)
    if lote.producto.nombre != PRODUCTO_ROTULO_DEMO or lote.version_receta_id is None:
        raise RuntimeError(f"El lote {LOTE_ROTULO_DEMO} no corresponde al producto demo.")

    frontal_services.guardar_configuracion(db, lote.producto_id, ConfiguracionRotuladoIn(
        canal_comercializacion=frontal_constants.CANAL_MINORISTA,
        envasado_sin_cliente=True,
        categoria_rotulado=None,
    ))

    borrador_id = db.scalars(
        select(BorradorRotulado.id).where(
            BorradorRotulado.producto_id == lote.producto_id,
            BorradorRotulado.lote_producto_id == lote.id,
        ).order_by(BorradorRotulado.id)
    ).first()
    if borrador_id is None:
        borrador_id = rotulado_services.crear_borrador(db, lote.producto_id, BorradorRotuladoCreate(
            producto_id=lote.producto_id, version_receta_id=lote.version_receta_id,
            lote_producto_id=lote.id,
        ), usuario).id

    rotulado_services.autocompletar_borrador(
        db, borrador_id, lote.version_receta_id, lote.id, False, usuario,
    )
    rotulado_services.actualizar_borrador(db, borrador_id, BorradorRotuladoUpdate(
        denominacion_venta="Galletitas de cacao",
        contenido_neto="150 g",
        rnpa_rppa="RNPA DEMO 07-000001",
        razon_social=seed_faker.DATOS_ROTULO["razon_social"],
        domicilio=seed_faker.DATOS_ROTULO["domicilio"],
        fecha_duracion=lote.fecha_vencimiento,
        instrucciones_uso="Listas para consumir.",
    ), usuario)

    declaraciones = declaraciones_services.consultar(db, borrador_id)
    if declaraciones["estado"] != "confirmada" or declaraciones["vigencia"] != "vigente":
        declaraciones_services.confirmar(
            db, borrador_id, RevisionEsperada(revision=declaraciones["revision"]), usuario,
        )

    vista = rotulado_services.previsualizar_borrador(db, borrador_id)
    if vista.completitud.estado_global != CAMPO_COMPLETO:
        pendientes = ", ".join(
            campo.etiqueta for campo in vista.completitud.campos
            if campo.estado not in (CAMPO_COMPLETO, CAMPO_NO_APLICABLE)
        )
        raise RuntimeError(f"El rótulo demo quedó incompleto: {pendientes}.")

    frontal = vista.rotulado_frontal
    sellos = frontal.sellos
    esperados = {definicion["clave"] for definicion in frontal_constants.SELLOS_INICIALES}
    excesos = {resultado.clave for resultado in sellos.resultados if resultado.exceso} if sellos else set()
    if not esperados.issubset(excesos):
        detalle = f"{frontal.estado}, {len(esperados & excesos)} de {len(esperados)} excesos esperados"
        if frontal.regla_version in (None, 1):
            raise RuntimeError(f"El rótulo demo no muestra los octógonos esperados ({detalle}).")
        print(f"Rótulo demo con la regla frontal vigente v{frontal.regla_version} ({detalle}).")

    if vista.borrador.estado != ESTADO_COMPLETADO:
        rotulado_services.actualizar_borrador(
            db, borrador_id, BorradorRotuladoUpdate(estado=ESTADO_COMPLETADO), usuario,
        )
    etiquetas = ", ".join(sellos.excesos) if sellos and sellos.excesos else "sin octógonos"
    print(f"Rótulo demo: {PRODUCTO_ROTULO_DEMO} (borrador {borrador_id}) · {etiquetas}")


def main() -> int:
    args = parsear_argumentos()
    if args.cantidad < 1:
        print("Error: --cantidad debe ser mayor a cero.")
        return 1
    if args.dias_checklist < 60:
        print("Error: --dias-checklist debe ser al menos 60 para la vista publica.")
        return 1

    try:
        if settings.ENV.upper() not in ("DEVELOPMENT", "TEST"):
            print("Error: la carga solo esta permitida en DEVELOPMENT o TEST.")
            return 1
        print("Preparando esquema y migraciones...")
        crear_tablas_y_migrar()
        print("Esquema actualizado con las migraciones actuales del backend.")

        print("Cargando datos Faker de todos los dominios...")
        with argumentos_temporales(argumentos_seed_faker(args)):
            resultado = seed_faker.main(preparar_esquema=False)
        if resultado != 0:
            return resultado

        print("Completando datos para indicadores de vista publica...")
        seed_vista_publica.main(preparar_esquema=False)
        asegurar_configuraciones(args.agregar)
        with SessionLocal() as db:
            asegurar_rotulo_demo(db)
        with SessionLocal() as db:
            invalidar_notificaciones(db)
            asegurar_notificaciones_al_dia(db)

        print("Datos integrales cargados correctamente.")
        if not args.agregar:
            print("La vista publica queda desactivada; configurala desde /vista-publica.")
        return 0
    except Exception:
        print("Error al cargar los datos integrales:")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
