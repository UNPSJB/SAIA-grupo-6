"""Carga de datos de ejemplo (15 por entidad) con datos coherentes.

Rellena toda la base con un escenario realista de una planta de alimentos:
personal, equipos de cocina/cámara, aptitudes y sus vencimientos, productos
químicos, elementos de limpieza, planes de limpieza con tareas (tipo
preoperacional/operacional/postoperacional y observaciones), checklists de los
últimos días, incidentes y planes de calibración/mantenimiento.

Es idempotente: borra los datos existentes de todas esas tablas y los vuelve a
crear. La contraseña de TODO el personal es la misma (ver credenciales al
final) para que sea fácil entrar como cualquiera.
"""

from datetime import date, datetime, timedelta

from sqlalchemy import delete

# Importamos configuración y modelos
from src.database import SessionLocal, engine
from src.models import ModeloBase
from src.auth.services import hashear_password
from src.personal.models import Personal
from src.Equipo.models import Equipo, Calibracion
from src.aptitud.models import Aptitud
from src.vencimientoPersonal.models import VencimientoPersonal
from src.unidadMedida.models import UnidadMedida
from src.insumos.models import Insumo
from src.insumoQuimico.models import InsumoQuimico, TipoQuimico
from src.elementoLimpieza.models import ElementoLimpieza
from src.PlanLimpieza.models import PlanLimpieza
from src.tareas.models import Tarea
from src.tareas.constants import TipoTarea
from src.incidente.models import Incidente, HistorialIncidente
from src.incidente.constants import TipoIncidente, EstadoIncidente
from src.checklist.models import (
    Checklist,
    RegistroTarea,
    HistorialRegistroTarea,
    EstadoChecklist,
)
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.documentos.models import Documento, VersionDocumento

# Esto asegura que las tablas existan en la BD antes de insertar
ModeloBase.metadata.create_all(bind=engine)

CONTRASENA = "12345678"
HOY = date.today()

db = SessionLocal()


def _borrar_previamente() -> None:
    """Limpia todas las tablas que el seed va a rellenar (orden: hijos primero)."""
    orden = [
        HistorialRegistroTarea,
        RegistroTarea,
        Checklist,
        VersionDocumento,
        Documento,
        HistorialIncidente,
        Incidente,
        VencimientoPersonal,
        Calibracion,
        PlanCalibracionMantenimiento,
        Tarea,
        PlanLimpieza,
        InsumoQuimico,
        Insumo,
        ElementoLimpieza,
        Aptitud,
        UnidadMedida,
        Equipo,
        Personal,
    ]
    for modelo in orden:
        db.execute(delete(modelo))
    db.flush()


try:
    _borrar_previamente()

    # ------------------------------------------------------------------
    # 1) Unidades de medida
    # ------------------------------------------------------------------
    print("⏳ Cargando unidades de medida...")
    unidades = [
        ("kilogramo", "kg"),
        ("litro", "L"),
        ("unidad", "u"),
        ("gramo", "g"),
        ("mililitro", "mL"),
    ]
    for nombre, simbolo in unidades:
        db.add(UnidadMedida(nombre=nombre, simbolo=simbolo))
    db.flush()
    unidad_por_nombre = {u.nombre: u for u in db.query(UnidadMedida).all()}
    unidad_kg = unidad_por_nombre["kilogramo"]
    unidad_l = unidad_por_nombre["litro"]
    unidad_u = unidad_por_nombre["unidad"]
    unidad_g = unidad_por_nombre["gramo"]
    unidad_ml = unidad_por_nombre["mililitro"]

    # ------------------------------------------------------------------
    # 2) Personal (15): 3 admin + 12 operadores
    # ------------------------------------------------------------------
    print("⏳ Cargando 15 personas...")
    EMAIL = "alimentosdelsur.com.ar"
    personas = [
        # (nombre, apellido, dni, telefono, email, puede_operar, puede_administrar, es_super_admin)
        ("Luciana", "Ferreyra", "30111222", "+5492804551122", f"luciana.ferreyra@{EMAIL}", True, True, True),
        ("Marcos", "Aguirre", "28555666", "+5492804552233", f"marcos.aguirre@{EMAIL}", True, True, False),
        ("Carolina", "Sosa", "32444555", "+5492804553344", f"carolina.sosa@{EMAIL}", True, True, False),
        ("Diego", "Ramírez", "35566777", "+5492804554455", f"diego.ramirez@{EMAIL}", True, False, False),
        ("Julieta", "Moyano", "36777888", "+5492804555566", f"julieta.moyano@{EMAIL}", True, False, False),
        ("Franco", "Paredes", "37888999", "+5492804556677", f"franco.paredes@{EMAIL}", True, False, False),
        ("Agustina", "Castro", "38999000", "+5492804557788", f"agustina.castro@{EMAIL}", True, False, False),
        ("Brian", "Olivera", "40111222", "+5492804558899", f"brian.olivera@{EMAIL}", True, False, False),
        ("Nahuel", "Vera", "41222333", "+5492804559900", f"nahuel.vera@{EMAIL}", True, False, False),
        ("Martina", "Ríos", "42333444", "+5492804560011", f"martina.rios@{EMAIL}", True, False, False),
        ("Tomás", "Ludueña", "43444555", "+5492804561122", f"tomas.luduena@{EMAIL}", True, False, False),
        ("Florencia", "Giménez", "44555666", "+5492804562233", f"florencia.gimenez@{EMAIL}", True, False, False),
        ("Iván", "Páez", "45666777", "+5492804563344", f"ivan.paez@{EMAIL}", True, False, False),
        ("Soledad", "Quiroga", "46777888", "+5492804564455", f"soledad.quiroga@{EMAIL}", True, False, False),
        ("Joaquín", "Báez", "47888999", "+5492804565566", f"joaquin.baez@{EMAIL}", True, False, False),
    ]
    personas_obj = []
    hash_password = hashear_password(CONTRASENA)
    for nombre, apellido, dni, telefono, email, puede_operar, puede_administrar, es_super_admin in personas:
        persona = Personal(
            nombre=nombre,
            apellido=apellido,
            dni=dni,
            telefono=telefono,
            email=email,
            password=hash_password,
            puede_operar=puede_operar,
            puede_administrar=puede_administrar,
            es_super_admin=es_super_admin,
            activo=True,
        )
        db.add(persona)
        personas_obj.append(persona)
    db.flush()
    admins = [p for p in personas_obj if p.puede_administrar]
    operadores = [p for p in personas_obj if not p.puede_administrar]

    # ------------------------------------------------------------------
    # 3) Equipos (15)
    # ------------------------------------------------------------------
    print("⏳ Cargando 15 equipos...")
    equipos = [
        ("Heladera 1", "Refrigeración", "Cocina", None),
        ("Heladera 2", "Refrigeración", "Cocina", None),
        ("Freezer 1", "Conservación", "Cámara", None),
        ("Freezer 2", "Conservación", "Cámara", None),
        ("Cámara de frío", "Conservación", "Cámara", 180),
        ("Horno combinado", "Cocción", "Cocina", None),
        ("Freidora", "Cocción", "Cocina", None),
        ("Anafe industrial", "Cocción", "Cocina", None),
        ("Balanza de precisión", "Medición", "Laboratorio", 180),
        ("Balanza de plataforma", "Medición", "Zona de elaboración", 365),
        ("Termómetro digital", "Medición", "Cocina", 180),
        ("Licuadora industrial", "Procesamiento", "Zona de elaboración", None),
        ("Cortadora de fiambres", "Procesamiento", "Zona de elaboración", None),
        ("Amasadora", "Procesamiento", "Zona de elaboración", None),
        ("Lavavajillas industrial", "Procesamiento", "Lavadero", None),
    ]
    equipos_obj = []
    for nombre, tipo, ubicacion, frecuencia in equipos:
        equipo = Equipo(
            nombre=nombre,
            tipo=tipo,
            ubicacion=ubicacion,
            activo=True,
            frecuencia_calibracion_dias=frecuencia,
        )
        db.add(equipo)
        equipos_obj.append(equipo)
    db.flush()

    # ------------------------------------------------------------------
    # 4) Aptitudes (15)
    # ------------------------------------------------------------------
    print("⏳ Cargando 15 aptitudes...")
    aptitudes = [
        ("Manipulación de Alimentos", "Curso básico de manipulación segura de alimentos."),
        ("Buenas Prácticas de Manufactura", "BPM para elaboración de productos."),
        ("Carnet de Salud", "Carnet sanitario vigente para manipular alimentos."),
        ("Seguridad e Higiene", "Higiene y seguridad en el puesto de trabajo."),
        ("Manejo de Productos Químicos", "Uso correcto de detergentes y desinfectantes."),
        ("Primeros Auxilios", "Asistencia básica ante accidentes laborales."),
        ("Uso de Matafuegos", "Manejo de extintores ante principio de incendio."),
        ("Cuidado de la Cadena de Frío", "Monitoreo de temperaturas en cámaras y heladeras."),
        ("Frío Industrial", "Operación y mantenimiento de frío industrial."),
        ("Riesgo Eléctrico", "Trabajo seguro con equipos conectados a la red."),
        ("Análisis APPCC", "Análisis de puntos críticos de control."),
        ("Operación de Equipos de Cocina", "Uso seguro de hornos, freidoras y anafes."),
        ("Higiene Ambiental", "Limpieza y sanidad del ambiente de trabajo."),
        ("Identificación de Plagas", "Detección temprana de roedores e insectos."),
        ("Elaboración de Comidas", "Preparación de comidas en servicio de buffet."),
    ]
    aptitudes_obj = []
    for nombre, descripcion in aptitudes:
        aptitud = Aptitud(nombre=nombre, descripcion=descripcion, activo=True)
        db.add(aptitud)
        aptitudes_obj.append(aptitud)
    db.flush()
    ap = {a.nombre: a for a in aptitudes_obj}

    # ------------------------------------------------------------------
    # 5) Vencimientos de personal (15): mezcla de próximos y vigentes.
    #    (Futuros: el schema del módulo impide fecha anterior a hoy.)
    # ------------------------------------------------------------------
    print("⏳ Cargando 15 vencimientos de personal...")
    por_dni = {p.dni: p for p in personas_obj}
    vencimientos = [
        ("35566777", "Manipulación de Alimentos", 1),
        ("36777888", "Carnet de Salud", 25),
        ("37888999", "Buenas Prácticas de Manufactura", 12),
        ("38999000", "Seguridad e Higiene", 2),
        ("40111222", "Manejo de Productos Químicos", 40),
        ("41222333", "Primeros Auxilios", 60),
        ("42333444", "Manipulación de Alimentos", 90),
        ("43444555", "Uso de Matafuegos", 8),
        ("44555666", "Carnet de Salud", 30),
        ("45666777", "Riesgo Eléctrico", 15),
        ("46777888", "Cuidado de la Cadena de Frío", 45),
        ("47888999", "Operación de Equipos de Cocina", 7),
        ("30111222", "Buenas Prácticas de Manufactura", 200),
        ("28555666", "Manipulación de Alimentos", 120),
        ("32444555", "Seguridad e Higiene", 180),
    ]
    for dni, aptitud_nombre, dias in vencimientos:
        db.add(
            VencimientoPersonal(
                persona_id=por_dni[dni].id,
                aptitud_id=ap[aptitud_nombre].id,
                fecha_vencimiento=HOY + timedelta(days=dias),
                activo=True,
            )
        )
    db.flush()

    # ------------------------------------------------------------------
    # 6) Insumos químicos (15)
    # ------------------------------------------------------------------
    print("⏳ Cargando 15 insumos químicos...")
    quimicos = [
        ("Lavandina concentrada", TipoQuimico.DESINFECTANTE, unidad_l),
        ("Detergente biodegradable", TipoQuimico.DETERGENTE, unidad_l),
        ("Desengrasante para hornos", TipoQuimico.DESENGRASANTE, unidad_l),
        ("Alcohol 70", TipoQuimico.SANITIZANTE, unidad_l),
        ("Sanitizante para frutas y verduras", TipoQuimico.SANITIZANTE, unidad_l),
        ("Desinfectante de superficies", TipoQuimico.DESINFECTANTE, unidad_l),
        ("Limpiavidrios", TipoQuimico.DETERGENTE, unidad_l),
        ("Quita grasa industrial", TipoQuimico.DESENGRASANTE, unidad_l),
        ("Jabón antibacterial para manos", TipoQuimico.DETERGENTE, unidad_l),
        ("Hipoclorito de sodio", TipoQuimico.DESINFECTANTE, unidad_l),
        ("Desincrustante de acero inoxidable", TipoQuimico.DESENGRASANTE, unidad_ml),
        ("Sanitizante de manos alcohólico", TipoQuimico.SANITIZANTE, unidad_ml),
        ("Desodorante de ambiente", TipoQuimico.DETERGENTE, unidad_ml),
        ("Solución yodada", TipoQuimico.DESINFECTANTE, unidad_l),
        ("Limpiador multiuso", TipoQuimico.DETERGENTE, unidad_l),
    ]
    quimicos_obj = []
    for nombre, tipo, unidad in quimicos:
        quimico = InsumoQuimico(nombre=nombre, tipo=tipo, unidad_medida_id=unidad.id, activo=True)
        db.add(quimico)
        quimicos_obj.append(quimico)
    db.flush()

    # ------------------------------------------------------------------
    # 7) Elementos de limpieza (15)
    # ------------------------------------------------------------------
    print("⏳ Cargando 15 elementos de limpieza...")
    elementos = [
        ("Esponja multiuso", 15, -16),
        ("Trapo de microfibra", 20, -21),
        ("Cepillo de cerdas duras", 30, -10),
        ("Escobillón", 45, -30),
        ("Recogedor", None, None),
        ("Balde de 20 litros", None, None),
        ("Guantes de látex", 10, -5),
        ("Guantes de nitrilo", 10, -8),
        ("Trapeador de piso", 25, -12),
        ("Pulverizador de 1 litro", 30, -15),
        ("Paño de algodón", 15, -7),
        ("Cepillo para vajilla", 20, -9),
        ("Rasquete de piso", 60, -20),
        ("Peine limpiador de juntas", 90, -40),
        ("Escobilla sanitaria", 45, -3),
    ]
    elementos_obj = []
    for nombre, recambio, dias_ultimo in elementos:
        ultimo = HOY + timedelta(days=dias_ultimo) if dias_ultimo is not None else None
        elemento = ElementoLimpieza(
            nombre=nombre,
            frecuencia_recambio_dias=recambio,
            fecha_ultimo_recambio=ultimo,
            activo=True,
        )
        db.add(elemento)
        elementos_obj.append(elemento)
    db.flush()

    # ------------------------------------------------------------------
    # 8) Insumos generales (15)
    # ------------------------------------------------------------------
    print("⏳ Cargando 15 insumos generales...")
    insumos_generales = [
        ("Bolsa de consorcio 60x90", unidad_u),
        ("Bolsa negra 45x60", unidad_u),
        ("Papel film", unidad_u),
        ("Papel manteca", unidad_u),
        ("Rollo de cocina", unidad_u),
        ("Guantes descartables", unidad_u),
        ("Servilletas de papel", unidad_u),
        ("Jabón líquido para vajilla", unidad_l),
        ("Detergente para lavavajillas", unidad_l),
        ("Alcohol en gel", unidad_ml),
        ("Limpia pisos neutro", unidad_l),
        ("Desinfectante de pisos", unidad_l),
        ("Quitamanchas de ropa de trabajo", unidad_l),
        ("Aromatizador de ambientes", unidad_ml),
        ("Desengrasante para campanas", unidad_l),
    ]
    for nombre, unidad in insumos_generales:
        db.add(Insumo(nombre=nombre, unidad_medida_id=unidad.id, activo=True))
    db.flush()

    # ------------------------------------------------------------------
    # 9) Planes de limpieza (15) con tareas (tipo + observaciones)
    # ------------------------------------------------------------------
    print("⏳ Cargando 15 planes de limpieza con sus tareas...")
    autor = admins[0]

    PLANES = [
        (
            "Limpieza diaria de heladeras",
            "Heladera 1",
            [
                ("Verificar temperatura interna", 1, "preoperacional",
                 "1. Abrir la puerta y leer el termómetro.\n2. Registrar la temperatura en la planilla.",
                 "La temperatura debe estar entre 0 y 5 °C."),
                ("Limpiar estantes y bandejas", 1, "operacional",
                 "1. Retirar productos y bandejas.\n2. Limpiar cada estante con detergente y esponja.\n3. Secar con trapo de microfibra.",
                 "No usar agua hirviendo: puede dañar los burletes."),
                ("Sanitizar manijas y burletes", 1, "postoperacional",
                 "1. Mojar un paño con sanitizante.\n2. Pasar por manijas y burletes.\n3. Dejar secar.",
                 "El paño de sanitizado se reemplaza todos los días."),
            ],
        ),
        (
            "Limpieza de heladeras de línea",
            "Heladera 2",
            [
                ("Revisar burletes de las puertas", 1, "preoperacional",
                 "1. Inspeccionar que el burlete selle al cerrar.\n2. Avisar si hay desgaste.",
                 "Un burlete flojo pierde frío y sube el consumo."),
                ("Desinfección interior", 1, "postoperacional",
                 "1. Aplicar solución de lavandina al 1%.\n2. Dejar actuar 5 minutos.\n3. Enjuagar y secar.",
                 "Usar guantes de nitrilo."),
            ],
        ),
        (
            "Limpieza de cámara de frío",
            "Cámara de frío",
            [
                ("Rasquetear hielo de paredes", 7, "preoperacional",
                 "1. Retirar productos de las estanterías cercanas.\n2. Rasquetear el hielo acumulado.\n3. Barrer los restos.",
                 "No usar objetos punzantes: pueden perforar la cámara."),
                ("Lavar y sanitizar estanterías", 7, "operacional",
                 "1. Retirar todas las mercaderías.\n2. Lavar con detergente y cepillo.\n3. Sanitizar y secar.",
                 "Constatar que el drenaje del piso no esté tapado."),
                ("Desinfectar piso y desagüe", 1, "postoperacional",
                 "1. Barrer el piso.\n2. Aplicar lavandina diluida.\n3. Cepillar el desagüe.\n4. Enjuagar.",
                 "Completar el ingreso en la planilla de la cámara."),
            ],
        ),
        (
            "Limpieza de freezer 1",
            "Freezer 1",
            [
                ("Descongelar el equipo", 7, "preoperacional",
                 "1. Desenchufar y retirar los productos a otro freezer.\n2. Dejar descongelar y juntar el agua.",
                 "Mover los productos de forma rápida para no cortar la cadena de frío."),
                ("Limpiar y secar el interior", 7, "postoperacional",
                 "1. Limpiar con detergente y esponja.\n2. Secar por completo.\n3. Reponer los productos.",
                 "Secar bien las uniones para que no se formen bloques de hielo."),
            ],
        ),
        (
            "Limpieza de freezer 2",
            "Freezer 2",
            [
                ("Verificar cierre de puertas", 1, "preoperacional",
                 "1. Revisar que las puertas cierren a la primera.\n2. Reportar si queda luz.",
                 "Registrar en la planilla del equipo."),
                ("Limpieza general interior", 7, "operacional",
                 "1. Retirar cajas y etiquetas sueltas.\n2. Limpiar estantes.\n3. Sanitizar el piso.",
                 "Priorizar el limpiado de los estantes superiores a los inferiores."),
            ],
        ),
        (
            "Limpieza de horno combinado",
            "Horno combinado",
            [
                ("Retirar migas y restos de grasa", 1, "preoperacional",
                 "1. Sacar bandejas y rejillas.\n2. Rasquetear las paredes.\n3. Barrer el interior.",
                 "Dejar enfriar el horno antes de limpiarlo."),
                ("Limpiar puertas de vidrio", 1, "operacional",
                 "1. Aplicar desengrasante.\n2. Esparcir con esponja.\n3. Enjuagar con paño húmedo y secar.",
                 "No usar estropajo metálico sobre el vidrio."),
                ("Sanitizar bandejas y rejillas", 1, "postoperacional",
                 "1. Lavarlas con desengrasante.\n2. Enjuagar y sanitizar.\n3. Guardarlas en su lugar.",
                 "Verificar que no quede detergente antes del próximo uso."),
            ],
        ),
        (
            "Mantenimiento de freidora",
            "Freidora",
            [
                ("Filtrar el aceite usado", 3, "preoperacional",
                 "1. Dejar enfriar el aceite.\n2. Filtrar con colador de acero.\n3. Descartar los residuos.",
                 "El aceite se reemplaza cuando oscurece o despide olor."),
                ("Desengrasar la cuba", 7, "operacional",
                 "1. Vaciar el aceite.\n2. Aplicar desengrasante.\n3. Cepillar paredes y drenaje.\n4. Enjuagar y secar.",
                 "Usar guantes de nitrilo y ventilación."),
                ("Revisar termostato", 30, "postoperacional",
                 "1. Verificar que la temperatura indicada coincide con el termómetro de control.",
                 "Reportar al responsable cualquier desvío mayor a 2 °C."),
            ],
        ),
        (
            "Limpieza de anafe industrial",
            "Anafe industrial",
            [
                ("Retirar parrillas y quemadores", 1, "preoperacional",
                 "1. Destapar el anafe en frío.\n2. Retirar parrillas y quemadores.",
                 "Nunca hacer esto con el anafe encendido."),
                ("Desengrasar y lavar las piezas", 1, "operacional",
                 "1. Remojar en desengrasante.\n2. Cepillar y enjuagar.\n3. Secar antes de reponer.",
                 "Revisar que los orificios del quemador no estén obturados."),
            ],
        ),
        (
            "Puesta a punto de balanza de precisión",
            "Balanza de precisión",
            [
                ("Limpiar el platillo", 1, "preoperacional",
                 "1. Retirar restos y limpiar con paño apenas húmedo.\n2. Secar.",
                 "No usar agua abundante: puede filtrarse al sensor."),
                ("Calibrar con pesa patrón", 1, "operacional",
                 "1. Usar la pesa patrón de 500 g.\n2. Verificar que marque exacto.\n3. Registrar en la planilla.",
                 "Si desvía más de 1 g, avisar al responsable."),
            ],
        ),
        (
            "Limpieza de balanza de plataforma",
            "Balanza de plataforma",
            [
                ("Lavar plataforma y teclado", 1, "preoperacional",
                 "1. Limpiar la plataforma con detergente.\n2. Secar con trapo.",
                 "Cuidado con el cable del display: no debe quedar sobre el piso húmedo."),
                ("Verificar tarado diario", 1, "postoperacional",
                 "1. Pulsar la tecla de tarar en vacío.\n2. Confirmar que marca cero.",
                 "Se tará a diario antes de pesar mercadería."),
            ],
        ),
        (
            "Limpieza de termómetro digital",
            "Termómetro digital",
            [
                ("Sanitizar la sonda", 1, "preoperacional",
                 "1. Mojar un hisopo en alcohol.\n2. Pasar por toda la sonda.\n3. Dejar secar.",
                 "No sumergirlo para no dañar la electrónica."),
                ("Controlar la batería", 7, "postoperacional",
                 "1. Verificar el indicador de carga.\n2. Reemplazar pilas si parpadea.",
                 "Tener pilas de repuesto en el área de medición."),
            ],
        ),
        (
            "Limpieza de licuadora industrial",
            "Licuadora industrial",
            [
                ("Desmontar jarra y cuchillas", 1, "preoperacional",
                 "1. Desenchufar el equipo.\n2. Desmontar la jarra y las cuchillas.",
                 "Manipular las cuchillas con cuidado: son filosas."),
                ("Lavar y sanitizar piezas", 1, "postoperacional",
                 "1. Lavar con detergente.\n2. Sanitizar con solución aprobada.\n3. Secar y armar.",
                 "Verificar el correcto ajuste del anillo de las cuchillas."),
            ],
        ),
        (
            "Limpieza de cortadora de fiambres",
            "Cortadora de fiambres",
            [
                ("Desmontar cuchilla y banda", 1, "preoperacional",
                 "1. Desenchufar.\n2. Retirar cuchilla y banda según manual.",
                 "Cuchilla filosísima: usar el protecto."),
                ("Desengrasar y desinfectar", 1, "postoperacional",
                 "1. Desengrasar cuchilla y cuerpo.\n2. Enjuagar.\n3. Sanitizar y armar.",
                 "Registrar la limpieza en la planilla del sector."),
            ],
        ),
        (
            "Limpieza de amasadora",
            "Amasadora",
            [
                ("Retirar el bollo de masa", 1, "preoperacional",
                 "1. Cortar y retirar la masa.\n2. Retirar el gancho.",
                 "No usar elementos metálicos sobre la cuba."),
                ("Lavar la cuba y el gancho", 1, "postoperacional",
                 "1. Lavar con agua y detergente.\n2. Enjuagar y desinfectar.\n3. Secar y reponer el gancho.",
                 "Asegurarse de que la cuba quede bien calzada."),
            ],
        ),
        (
            "Limpieza de lavavajillas industrial",
            "Lavavajillas industrial",
            [
                ("Retirar y limpiar canastillas", 1, "preoperacional",
                 "1. Sacar las canastillas.\n2. Lavarlas a mano y dejar secar.",
                 "Revisar que los filtros no tengan restos de comida."),
                ("Desincrustar los brazos aspersores", 7, "operacional",
                 "1. Retirar los brazos.\n2. Desobstruir los orificios con palillo.\n3. Reponer y probar.",
                 "Si el enjuague no presiona, revisar el descalcificador."),
                ("Verificar ciclo de enjuague", 1, "postoperacional",
                 "1. Correr un ciclo corto sin vajilla.\n2. Verificar temperatura y presión.",
                 "Registrar cualquier falla en el libro de mantenimiento."),
            ],
        ),
    ]

    planes_obj = []
    for nombre_plan, nombre_equipo, tareas in PLANES:
        equipo = next(e for e in equipos_obj if e.nombre == nombre_equipo)
        plan = PlanLimpieza(nombre=nombre_plan, equipo_id=equipo.id, autor_id=autor.id, activo=True)
        for nombre_tarea, frecuencia, tipo, descripcion, observaciones in tareas:
            plan.tareas.append(
                Tarea(
                    nombre=nombre_tarea,
                    frecuencia=frecuencia,
                    tipo=tipo,
                    descripcion=descripcion,
                    observaciones=observaciones,
                )
            )
        db.add(plan)
        planes_obj.append(plan)
    db.flush()

    # ------------------------------------------------------------------
    # 10) Checklists de los últimos 7 días (hoy incluido)
    # ------------------------------------------------------------------
    print("⏳ Cargando checklists de los últimos 7 días...")
    DETALLE_INSUMO = {i.nombre: i for i in quimicos_obj}
    ELEM = {e.nombre: e for e in elementos_obj}

    def _consumo_para(tarea_nombre: str) -> tuple:
        """Devuelve (insumo, cantidad, elemento) coherentes con la tarea."""
        if "temperatura" in tarea_nombre or "termostato" in tarea_nombre or "tarado" in tarea_nombre:
            return None, None, None
        if "desengrasar" in tarea_nombre or "desengrasante" in tarea_nombre or "quemador" in tarea_nombre:
            return DETALLE_INSUMO["Quita grasa industrial"], 0.5, ELEM["Cepillo de cerdas duras"]
        if "sanitizar" in tarea_nombre or "manijas" in tarea_nombre or "desinfección" in tarea_nombre or "desinfectar" in tarea_nombre:
            return DETALLE_INSUMO["Lavandina concentrada"], 0.25, ELEM["Trapo de microfibra"]
        if "piso" in tarea_nombre or "desagüe" in tarea_nombre:
            return DETALLE_INSUMO["Desinfectante de superficies"], 0.5, ELEM["Trapeador de piso"]
        if "vidrio" in tarea_nombre or "cuchil" in tarea_nombre or "bandeja" in tarea_nombre:
            return DETALLE_INSUMO["Detergente biodegradable"], 0.1, ELEM["Esponja multiuso"]
        if "lavar" in tarea_nombre or "limpiar" in tarea_nombre:
            return DETALLE_INSUMO["Limpiador multiuso"], 0.3, ELEM["Esponja multiuso"]
        return DETALLE_INSUMO["Desinfectante de superficies"], 0.2, ELEM["Paño de algodón"]

    for plan in planes_obj:
        for delta in range(6, -1, -1):
            fecha = HOY - timedelta(days=delta)
            es_hoy = delta == 0
            estado = EstadoChecklist.ABIERTO
            observacion_cabecera = None
            if not es_hoy and delta in (2, 5) and plan.nombre in ("Limpieza diaria de heladeras", "Limpieza de cámara de frío"):
                estado = EstadoChecklist.OBSERVADO
                observacion_cabecera = "Supervisor detectó restos de grasa en la base del equipo."
            elif not es_hoy:
                estado = EstadoChecklist.CERRADO

            cabecera = Checklist(
                equipo_id=plan.equipo_id,
                plan_id=plan.id,
                fecha=fecha,
                estado=estado,
                observaciones=observacion_cabecera,
            )
            db.add(cabecera)
            db.flush()

            abiertas = 0
            completadas = 0
            for tarea in plan.tareas:
                # Hoy queda casi todo sin completar para poder probar el checklist.
                if es_hoy:
                    completado = (delta == 0 and completadas < 1 and tarea.frecuencia == 1)
                else:
                    # En dos checklists históricos se deja una tarea incumplida.
                    incumplida = (not es_hoy and delta in (3, 4) and tarea is plan.tareas[-1])
                    completado = not incumplida
                if completado:
                    completadas += 1
                else:
                    abiertas += 1

                insumo, cantidad, elemento = _consumo_para(tarea.nombre) if completado else (None, None, None)

                registro = RegistroTarea(
                    checklist_id=cabecera.id,
                    tarea_id=tarea.id,
                    nombre_tarea_historico=tarea.nombre,
                    descripcion_tarea_historico=tarea.descripcion,
                    tipo_tarea_historico=tarea.tipo,
                    observaciones_tarea_historico=tarea.observaciones,
                    completado=completado,
                    fecha_completado=datetime.combine(fecha, datetime.min.time()).replace(hour=11) if completado else None,
                    usuario_id=operadores[plan.id % len(operadores)].id if completado else None,
                    insumo_quimico_id=insumo.id if insumo else None,
                    cantidad_consumida=cantidad,
                    elemento_limpieza_id=elemento.id if elemento else None,
                )
                db.add(registro)
                db.flush()

                if completado:
                    db.add(
                        HistorialRegistroTarea(
                            registro_tarea_id=registro.id,
                            completado=True,
                            usuario_id=registro.usuario_id,
                            fecha_evento=registro.fecha_completado or datetime.combine(fecha, datetime.min.time()),
                        )
                    )

            if es_hoy:
                cabecera.estado = EstadoChecklist.COMPLETO if abiertas == 0 else EstadoChecklist.ABIERTO
        db.flush()

    # ------------------------------------------------------------------
    # 11) Incidentes (15)
    # ------------------------------------------------------------------
    print("⏳ Cargando 15 incidentes...")
    incidentes = [
        ("Fuga de agua en cámara", "Se acumula agua sobre el piso de la cámara cerca del evaporador.",
         TipoIncidente.FALLA_EQUIPO, "Cámara de frío", 1, EstadoIncidente.CERRADO, 4, "Se purgó el drenaje y se selló la junta."),
        ("Heladera 2 gotea", "Gotea agua por la puerta de la Heladera 2 durante todo el día.",
         TipoIncidente.FALLA_EQUIPO, "Heladera 2", 2, EstadoIncidente.CERRADO, 3, "Se reemplazó el burlete de la puerta."),
        ("Temperatura fuera de rango", "El termómetro de la Heladera 1 marca 9 °C, sobre el límite de 5 °C.",
         TipoIncidente.HIGIENE_CONTAMINACION, "Heladera 1", 1, EstadoIncidente.ABIERTO, None, None),
        ("Olor a gas en la freidora", "Se siente olor a gas cerca de la freidora al encenderla.",
         TipoIncidente.FALLA_EQUIPO, "Freidora", 2, EstadoIncidente.CERRADO, 5, "Se ajustó la válvula y se verificó con burbujas."),
        ("Balanza de plataforma descalibrada", "Pesada 10 g por encima con la pesa de control de 1 kg.",
         TipoIncidente.FALLA_EQUIPO, "Balanza de plataforma", 3, EstadoIncidente.ABIERTO, None, None),
        ("Luz quemada en zona de elaboración", "Un tubo fluorescente parpadea sobre la mesa de trabajo.",
         TipoIncidente.OTRO, "Horno combinado", 2, EstadoIncidente.CERRADO, 1, "Se reemplazó el tubo y el cebador."),
        ("Devolución de clienta por producto frío", "Cliente devuelve una porción que llegó a temperatura ambiente.",
         TipoIncidente.DEVOLUCION_CLIENTE, None, 3, EstadoIncidente.CERRADO, 3, "Se reforzó el control de temperatura al servir."),
        ("Superficie de corte contaminada", "Se detectó residuo de masa en la mesa de corte sin sanitizar.",
         TipoIncidente.HIGIENE_CONTAMINACION, "Amasadora", 4, EstadoIncidente.CERRADO, 2, "Se reforzó el protocolo de sanitizado cada cambio de turno."),
        ("Roedores en el depósito", "Se ven marcas de roedores cerca de la zona de almacenamiento de secos.",
         TipoIncidente.PLAGAS, None, 1, EstadoIncidente.ABIERTO, None, None),
        ("Horno combinado no calienta", "El horno no supera los 120 °C con el programa seleccionado.",
         TipoIncidente.FALLA_EQUIPO, "Horno combinado", 2, EstadoIncidente.CERRADO, 6, "Se reemplazó la resistencia superior."),
        ("Cortadora de fiambres con cuchilla desafilada", "Cuesta cortar el fiambre y deja la rodaja desprolija.",
         TipoIncidente.FALLA_EQUIPO, "Cortadora de fiambres", 3, EstadoIncidente.CERRADO, 2, "Se afiló la cuchilla."),
        ("Desagüe bloqueado en lavadero", "El agua no drena en la pileta del lavadero.",
         TipoIncidente.OTRO, "Lavavajillas industrial", 4, EstadoIncidente.CERRADO, 1, "Se destapó con sifón y se limpió la trampa."),
        ("Contaminación en bandeja de servicio", "Se encontró pelo dentro de una bandeja lista para servir.",
         TipoIncidente.HIGIENE_CONTAMINACION, None, 4, EstadoIncidente.CERRADO, 2, "Se descartó la bandeja y se recordó el uso de cofia."),
        ("Anafe sin chispa", "Un quemador del anafe no enciende con la chispa.",
         TipoIncidente.FALLA_EQUIPO, "Anafe industrial", 2, EstadoIncidente.CERRADO, 4, "Se limpió el electrodo y ahora enciende normal."),
        ("Frigorífico despide olor", "Olor fuerte a descompuesto dentro del Freezer 2.",
         TipoIncidente.HIGIENE_CONTAMINACION, "Freezer 2", 1, EstadoIncidente.ABIERTO, None, None),
    ]

    incidentes_obj = []
    for i, (titulo, descripcion, tipo, nombre_equipo, idx_operador, estado, dias_cierre, obs_cierre) in enumerate(incidentes):
        equipo = next((e for e in equipos_obj if e.nombre == nombre_equipo), None)
        fecha_reporte = HOY - timedelta(days=10 - i % 8)
        incidente = Incidente(
            titulo=titulo,
            descripcion=descripcion,
            tipo=tipo.value,
            equipo_id=equipo.id if equipo else None,
            usuario_id=operadores[idx_operador % len(operadores)].id,
            fecha_reporte=datetime.combine(fecha_reporte, datetime.min.time()).replace(hour=9 + i % 8),
            estado=estado.value,
            fecha_cierre=(datetime.combine(fecha_reporte + timedelta(days=dias_cierre), datetime.min.time()).replace(hour=17))
            if estado == EstadoIncidente.CERRADO else None,
            observacion_cierre=obs_cierre,
            responsable_cierre_id=admins[(i + 1) % len(admins)].id if estado == EstadoIncidente.CERRADO else None,
        )
        db.add(incidente)
        db.flush()

        if estado == EstadoIncidente.CERRADO:
            db.add(
                HistorialIncidente(
                    incidente_id=incidente.id,
                    estado_anterior=EstadoIncidente.ABIERTO.value,
                    estado_nuevo=EstadoIncidente.CERRADO.value,
                    usuario_id=incidente.responsable_cierre_id,
                    observacion=obs_cierre,
                    fecha_evento=incidente.fecha_cierre,
                )
            )
        incidentes_obj.append(incidente)
    db.flush()

    # ------------------------------------------------------------------
    # 12) Planes de calibración / mantenimiento (15)
    # ------------------------------------------------------------------
    print("⏳ Cargando 15 planes de calibración/mantenimiento...")
    cal_mant = [
        ("Balanza de precisión", "calibracion", 15, 180),
        ("Balanza de plataforma", "calibracion", 20, 365),
        ("Termómetro digital", "calibracion", 10, 180),
        ("Cámara de frío", "mantenimiento", 60, 90),
        ("Freezer 1", "mantenimiento", 40, 120),
        ("Freezer 2", "mantenimiento", 45, 120),
        ("Heladera 1", "mantenimiento", 10, 90),
        ("Heladera 2", "mantenimiento", 12, 90),
        ("Horno combinado", "mantenimiento", 30, 180),
        ("Freidora", "mantenimiento", 8, 90),
        ("Anafe industrial", "mantenimiento", 25, 120),
        ("Licuadora industrial", "mantenimiento", 70, 120),
        ("Cortadora de fiambres", "mantenimiento", 15, 90),
        ("Amasadora", "mantenimiento", 55, 180),
        ("Lavavajillas industrial", "mantenimiento", 5, 60),
    ]
    for nombre_equipo, tipo, dias_desde, periodicidad in cal_mant:
        equipo = next(e for e in equipos_obj if e.nombre == nombre_equipo)
        db.add(
            PlanCalibracionMantenimiento(
                equipo_id=equipo.id,
                autor_id=autor.id,
                tipo=tipo,
                fecha_ultima_intervencion=HOY - timedelta(days=dias_desde),
                periodicidad_dias=periodicidad,
                activo=True,
            )
        )
    db.flush()

    db.commit()
    print("✅ ¡Datos cargados con éxito!")
    print(f"🔑 Contraseña de todo el personal: {CONTRASENA}")
    print("👤 Usuarios administradores (login con DNI):")
    for a in admins:
        print(f"   • {a.nombre} {a.apellido} — DNI {a.dni}")

except Exception as e:
    db.rollback()
    print(f"❌ Error al cargar datos: {e}")
    import traceback
    traceback.print_exc()
    raise

finally:
    db.close()