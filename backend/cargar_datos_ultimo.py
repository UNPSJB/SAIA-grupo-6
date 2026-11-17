"""Carga integral de datos de desarrollo generados con Faker.

Orquesta los seeds mantenidos por cada dominio para no duplicar la logica ni
desincronizar las relaciones entre modelos:

* aplica las migraciones antes de insertar, incluidas las de
  ``tareas.operador_id``, ``registro_tareas.operador_id``,
  ``registro_tareas.reemplazado_por_id``, ``calibraciones.activo`` y el
  bootstrap idempotente de ``configuracion_vista_publica``;
* carga catalogos, personal, equipos, stock, planes, checklists, incidentes,
  documentos y auditoria mediante ``cargar_datos_faker``;
* completa los universos necesarios para los indicadores de la vista publica;
* carga clientes, transportistas con certificaciones y salidas con reclamos,
  retiros, incidentes e hitos mediante los servicios actuales del backend;
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

from faker import Faker
from sqlalchemy import delete, select

# Permite ejecutar el script desde cualquier directorio.
RAIZ = Path(__file__).resolve().parent
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

import src.all_models  # noqa: F401,E402
from src.database import SessionLocal  # noqa: E402
from src.config import settings  # noqa: E402
from src.common.fechas import hoy  # noqa: E402
from src.clientes.models import Cliente  # noqa: E402
from src.transportistas.models import Transportista  # noqa: E402
from src.certificaciones_transportista.models import CertificacionTransportista  # noqa: E402
from src.salidas.models import Salida, SalidaCertificacion, HitoLote  # noqa: E402
from src.salidas import services as salidas  # noqa: E402
from src.reclamos.models import Reclamo  # noqa: E402
from src.reclamos.services import crear_reclamo  # noqa: E402
from src.retiros.models import Retiro, RetiroAfectado  # noqa: E402
from src.retiros.services import iniciar_retiro  # noqa: E402
from src.lotes.models import LoteProducto  # noqa: E402
from src.lotes.constants import ESTADO_TERMINADO  # noqa: E402
from src.personal.models import Personal  # noqa: E402
from src.rotulado.models import BorradorRotulado, CampoRotuladoEditado  # noqa: E402
from src.proveedores.models import CertificacionProveedor  # noqa: E402
from src.migrations import crear_tablas_y_migrar  # noqa: E402
from src.notificaciones.models import ConfiguracionAlerta  # noqa: E402
from src.notificaciones.invalidacion import asegurar_notificaciones_al_dia  # noqa: E402
from src.vistaPublica.constants import CATALOGO  # noqa: E402
from src.vistaPublica.models import (  # noqa: E402
    ConfiguracionVistaPublica,
    IndicadorVistaPublica,
)

from scripts import cargar_datos_faker as seed_faker
import cargar_datos_vista_publica as seed_vista_publica  # noqa: E402


CLAVE_DIAS_ALERTA_VENCIMIENTO = "dias_alerta_vencimiento_personal"
DIAS_ALERTA_POR_DEFECTO = 30


@contextmanager
def limpieza_actualizada() -> Iterator[None]:
    """Extiende la limpieza base dentro de su misma transaccion."""
    original = seed_faker.borrar_todo

    def borrar(db):
        for modelo in (
            RetiroAfectado, Retiro, Reclamo, SalidaCertificacion, HitoLote,
            Salida, CertificacionTransportista, Transportista, Cliente,
            CampoRotuladoEditado, BorradorRotulado, CertificacionProveedor,
        ):
            db.execute(delete(modelo).execution_options(auditoria_omitir=True))
        original(db)

    seed_faker.borrar_todo = borrar
    try:
        yield
    finally:
        seed_faker.borrar_todo = original


def cargar_distribucion(args: argparse.Namespace) -> None:
    """Crea datos relacionados usando las mismas transiciones que la API."""
    fake = Faker(args.locale)
    fake.seed_instance(args.seed)
    fecha = hoy()
    with SessionLocal() as db:
        usuario = next(
            p for p in db.scalars(select(Personal).where(Personal.activo.is_(True)))
            if p.puede_administrar
        )
        documentos = set(db.scalars(select(Cliente.documento)))
        cuits = set(db.scalars(select(Transportista.cuit)))
        clientes, transportistas = [], []
        for indice in range(args.cantidad):
            documento = seed_faker.unico(lambda: fake.numerify("########"), documentos)
            cuit = seed_faker.unico(lambda: fake.numerify("30#########"), cuits)
            cliente = Cliente(
                nombre=fake.company()[:120], documento=documento,
                telefono=fake.numerify("11########"), email=fake.email(),
                domicilio=fake.address()[:200],
            )
            transportista = Transportista(
                razon_social=fake.company()[:200], cuit=cuit,
                telefono=fake.numerify("11########"), email=fake.email(),
                domicilio=fake.address()[:200],
            )
            db.add_all([cliente, transportista])
            db.flush()
            db.add(CertificacionTransportista(
                transportista_id=transportista.id, tipo="Habilitacion sanitaria",
                tipo_normalizado="habilitacion sanitaria", numero=f"HAB-{cuit}",
                fecha_emision=fecha - timedelta(days=30),
                fecha_vencimiento=fecha + timedelta(days=180),
            ))
            clientes.append(cliente)
            transportistas.append(transportista)
        db.commit()

        lotes = list(db.scalars(select(LoteProducto).where(
            LoteProducto.estado == ESTADO_TERMINADO,
            LoteProducto.retirado.is_(False),
        ).order_by(LoteProducto.id)))
        creadas = 0
        for lote in lotes:
            if (lote.fecha_vencimiento and lote.fecha_vencimiento < fecha
                    or lote.fecha_inicio and lote.fecha_inicio.date() > fecha):
                continue
            saldo = salidas.calcular_cantidades_lote(db, lote.id)["saldo"]
            cantidad = (saldo / 4).quantize(Decimal("0.001"))
            if cantidad <= 0:
                continue
            indice = creadas % args.cantidad
            salida = salidas.reservar(
                db, lote.id, clientes[indice].id, cantidad, fecha, usuario,
            )
            estado = creadas % 4
            if estado != 0:
                salidas.despachar(db, salida.id, "CON_TRANSPORTISTA",
                                  transportistas[indice].id, fecha, usuario)
            if estado in (2, 3):
                salidas.entregar(db, salida.id, fecha, "Entrega de demostracion", usuario)
            if estado == 3:
                reclamo = crear_reclamo(
                    db, salida_id=salida.id, motivo="envase_danado",
                    detalle="Envase danado detectado al recibir el producto.",
                    fecha_reclamo=fecha, usuario=usuario,
                )
                iniciar_retiro(
                    db, lote.id, "Reclamos de clientes", "Retiro de demostracion",
                    fecha, usuario, "RECLAMO", reclamo_id=reclamo.id,
                )
            db.commit()
            creadas += 1
        print(f"Distribucion: {len(clientes)} clientes, {len(transportistas)} "
              f"transportistas con certificacion y {creadas} salidas.")
        asegurar_notificaciones_al_dia(db)


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
            alerta = db.get(ConfiguracionAlerta, CLAVE_DIAS_ALERTA_VENCIMIENTO)
            if alerta is None:
                db.add(
                    ConfiguracionAlerta(
                        clave=CLAVE_DIAS_ALERTA_VENCIMIENTO,
                        valor=DIAS_ALERTA_POR_DEFECTO,
                    )
                )

            configuracion = db.get(ConfiguracionVistaPublica, 1)
            if configuracion is None:
                configuracion = ConfiguracionVistaPublica(id=1, habilitada=False)
                db.add(configuracion)
            elif not agregar:
                # El seed completo no debe dejar expuesto un enlace que pudo
                # apuntar a datos de una carga anterior.
                configuracion.habilitada = False
                configuracion.codigo_publico = None

            for definicion in CATALOGO:
                indicador = db.get(IndicadorVistaPublica, definicion.clave)
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
        with limpieza_actualizada(), argumentos_temporales(argumentos_seed_faker(args)):
            resultado = seed_faker.main(preparar_esquema=False)
        if resultado != 0:
            return resultado

        print("Completando datos para indicadores de vista publica...")
        seed_vista_publica.main(preparar_esquema=False)
        cargar_distribucion(args)
        asegurar_configuraciones(args.agregar)

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
