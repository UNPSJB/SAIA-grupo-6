"""Datos deterministas para los tests de paginación del historial.

Diseño pensado para que un bug de paginación NO pueda pasar desapercibido:

* VARIOS checklists por fecha (2 planes por equipo, 2 equipos con datos): el
  caso donde el desempate por `id` es imprescindible.
* Se insertan en orden de fecha MEZCLADO (semilla fija): así `id` no es
  monótono con la fecha, y ordenar solo por `id` o solo por `fecha` daría un
  orden distinto al esperado.
* 48 checklists en el rango: divisible por 1, 2, 3, 4, 6, 8, 12, 16, 24 y 48
  (última página llena, sin página vacía de más) y NO divisible por 5 o 7
  (última página parcial).
* Un equipo sin checklists y checklists FUERA del rango (para los filtros).
* Cantidades de tareas y completadas variadas: el % general ponderado por
  tareas es distinto del promedio de porcentajes por checklist (se verifica
  al sembrar), así que un cálculo "promedio de la página" no pasa.

El "oráculo" (lo que se espera) se calcula acá, en Python puro y desde los
mismos datos sembrados; nunca llamando a la app.
"""

import random
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import List, Optional

from src.checklist.models import Checklist, EstadoChecklist, RegistroTarea
from src.Equipo.models import Equipo
from src.PlanLimpieza.models import PlanLimpieza
from src.sector.models import Sector

DIAS_EN_RANGO = 12          # HOY-11 ... HOY
PLANES_POR_EQUIPO = 2
EQUIPOS_CON_DATOS = 2       # -> 12 * 2 * 2 = 48 checklists en el rango
TOTAL_EN_RANGO = DIAS_EN_RANGO * PLANES_POR_EQUIPO * EQUIPOS_CON_DATOS
DIAS_FUERA_DE_RANGO = 5     # checklists viejos: HOY-100 ... HOY-96


@dataclass
class CL:
    """Un checklist sembrado, con lo que debería mostrar el historial."""

    id: int
    fecha: date
    equipo_id: int
    equipo_nombre: str
    total: int
    completadas: int
    incumplidas: List[str] = field(default_factory=list)

    @property
    def porcentaje(self) -> float:
        return self.completadas / self.total * 100 if self.total else 0.0


@dataclass
class Seed:
    hoy: date
    equipo_a: int
    equipo_b: int
    equipo_vacio: int
    checklists: List[CL]

    def en_rango(
        self,
        desde: date,
        hasta: date,
        equipo_id: Optional[int] = None,
    ) -> List[CL]:
        """Oráculo: filtra y ordena como debe hacerlo el historial paginado
        (fecha desc, id desc)."""
        filas = [
            c for c in self.checklists
            if desde <= c.fecha <= hasta
            and (equipo_id is None or c.equipo_id == equipo_id)
        ]
        return sorted(filas, key=lambda c: (c.fecha, c.id), reverse=True)

    @staticmethod
    def porcentaje_general(filas: List[CL]) -> float:
        total = sum(c.total for c in filas)
        completadas = sum(c.completadas for c in filas)
        return completadas / total * 100 if total else 0.0

    @property
    def desde(self) -> date:
        return self.hoy - timedelta(days=DIAS_EN_RANGO - 1)

    @property
    def hasta(self) -> date:
        return self.hoy


def sembrar(db, autor_id: int) -> Seed:
    hoy = date.today()
    azar = random.Random(20260101)
    sector = Sector(nombre="Sector de pruebas")
    db.add(sector)
    db.flush()

    # Los equipos exigen un sector (FK sectores.id NOT NULL).
    sector = Sector(nombre="Planta", activo=True)
    db.add(sector)
    db.flush()

    equipos = [
        Equipo(nombre=n, tipo="Envasadora", sector_id=sector.id, activo=True)
        for n in ("Equipo A", "Equipo B", "Equipo Vacío")
    ]
    db.add_all(equipos)
    db.flush()
    eq_a, eq_b, eq_vacio = equipos

    planes = []
    for eq in (eq_a, eq_b):
        for n in range(PLANES_POR_EQUIPO):
            plan = PlanLimpieza(
                nombre=f"Plan {eq.nombre} #{n + 1}",
                activo=True,
                equipo_id=eq.id,
                autor_id=autor_id,
            )
            planes.append((plan, eq))
    db.add_all([p for p, _ in planes])
    db.flush()

    # (plan, equipo, fecha) de TODOS los checklists, en el rango y fuera.
    combinaciones = []
    for plan, eq in planes:
        for d in range(DIAS_EN_RANGO):
            combinaciones.append((plan, eq, hoy - timedelta(days=d)))
        for d in range(100, 100 + DIAS_FUERA_DE_RANGO):
            combinaciones.append((plan, eq, hoy - timedelta(days=d)))

    # Orden de inserción mezclado: `id` deja de correlacionar con `fecha`.
    azar.shuffle(combinaciones)

    estados = [
        EstadoChecklist.ABIERTO,
        EstadoChecklist.COMPLETO,
        EstadoChecklist.OBSERVADO,
        EstadoChecklist.CERRADO,
    ]

    sembrados: List[CL] = []
    for i, (plan, eq, fecha) in enumerate(combinaciones):
        total = 1 + (i * 7) % 6            # 1..6 tareas
        completadas = (i * 5) % (total + 1)  # 0..total

        cl = Checklist(
            equipo_id=eq.id,
            plan_id=plan.id,
            fecha=fecha,
            estado=estados[i % len(estados)],
        )
        db.add(cl)
        db.flush()

        incumplidas = []
        for k in range(total):
            hecho = k < completadas
            nombre = f"Tarea {cl.id}-{k}"
            db.add(
                RegistroTarea(
                    checklist_id=cl.id,
                    tarea_id=None,  # tarea dada de baja: el registro sobrevive
                    nombre_tarea_historico=nombre,
                    completado=hecho,
                )
            )
            if not hecho:
                incumplidas.append(nombre)

        sembrados.append(
            CL(
                id=cl.id,
                fecha=fecha,
                equipo_id=eq.id,
                equipo_nombre=eq.nombre,
                total=total,
                completadas=completadas,
                incumplidas=incumplidas,
            )
        )

    db.commit()

    seed = Seed(
        hoy=hoy,
        equipo_a=eq_a.id,
        equipo_b=eq_b.id,
        equipo_vacio=eq_vacio.id,
        checklists=sembrados,
    )

    # Guardas de la propia siembra: si alguien toca los datos y rompe estas
    # propiedades, los tests dejarían de ser capaces de detectar bugs.
    en_rango = seed.en_rango(seed.desde, seed.hasta)
    assert len(en_rango) == TOTAL_EN_RANGO
    fechas = [c.fecha for c in en_rango]
    assert len(set(fechas)) < len(fechas), "tiene que haber fechas repetidas"
    ids_por_fecha = [c.id for c in sorted(en_rango, key=lambda c: c.fecha, reverse=True)]
    assert ids_por_fecha != sorted(ids_por_fecha, reverse=True), (
        "el orden por fecha no puede coincidir con el orden por id"
    )
    promedio_simple = sum(c.porcentaje for c in en_rango) / len(en_rango)
    assert abs(seed.porcentaje_general(en_rango) - promedio_simple) > 0.5, (
        "el % ponderado debe diferir del promedio de porcentajes"
    )
    return seed
