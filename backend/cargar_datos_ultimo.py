"""Carga integral de datos de desarrollo generados con Faker.

Orquesta los seeds mantenidos por cada dominio para no duplicar la logica ni
desincronizar las relaciones entre modelos:

* aplica las migraciones antes de insertar;
* carga catalogos, personal, equipos, stock, planes, checklists, incidentes,
  documentos y auditoria mediante ``cargar_datos_faker``;
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
from pathlib import Path

# Permite ejecutar el script desde cualquier directorio.
RAIZ = Path(__file__).resolve().parent
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

from src.database import SessionLocal  # noqa: E402
from src.migrations import crear_tablas_y_migrar  # noqa: E402
from src.notificaciones.models import ConfiguracionAlerta  # noqa: E402
from src.vistaPublica.constants import CATALOGO  # noqa: E402
from src.vistaPublica.models import (  # noqa: E402
    ConfiguracionVistaPublica,
    IndicadorVistaPublica,
)

import cargar_datos_faker as seed_faker  # noqa: E402
import cargar_datos_vista_publica as seed_vista_publica  # noqa: E402


CLAVE_DIAS_ALERTA_VENCIMIENTO = "dias_alerta_vencimiento_personal"
DIAS_ALERTA_POR_DEFECTO = 30


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
        help="Conserva datos y configuraciones existentes, agregando solo faltantes.",
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

    Los tokens y los intentos de login no se seed-ean: son estado de seguridad,
    no datos funcionales de demostracion. La auditoria se crea por los listeners
    ORM del seeder Faker.
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
        print("Preparando esquema y migraciones...")
        crear_tablas_y_migrar()

        print("Cargando datos Faker de todos los dominios...")
        with argumentos_temporales(argumentos_seed_faker(args)):
            resultado = seed_faker.main(preparar_esquema=False)
        if resultado != 0:
            return resultado

        print("Completando datos para indicadores de vista publica...")
        seed_vista_publica.main(preparar_esquema=False)
        asegurar_configuraciones(args.agregar)

        print("Datos integrales cargados correctamente.")
        print("La vista publica queda desactivada; configurala desde /vista-publica.")
        return 0
    except Exception:
        print("Error al cargar los datos integrales:")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
