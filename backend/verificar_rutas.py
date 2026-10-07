"""Verifica la cobertura de seguridad y de endpoints del backend.

Ejecutar desde `backend/`:

    .venv\\Scripts\\python.exe verificar_rutas.py

Comprueba tres cosas:

  1. que todo endpoint fuera de `/auth/*` exija token;
  2. que `/auth/*` sea justamente lo público (login, refresh y bootstrap), y no
     se haya colado algún endpoint nuevo;
  3. que los catálogos con baja lógica expongan el verbo DELETE — el
     `PlanCalibracionMantenimiento` era el único sin él, aunque su modelo
     tuviera `activo`.

Nota: los endpoints de `/documentos` ahora requieren autenticación
(`require_operador` para lectura, `require_admin` para escritura), así que
ya no aparecen como públicos.
"""

import sys

sys.path.insert(0, ".")

import src.main as m  # noqa: E402

spec = m.app.openapi()

# Los endpoints que por diseño no llevan token: el token es lo que se pide ahí.
PUBLICOS_ESPERADOS = {
    ("GET", "/auth/bootstrap"),
    ("POST", "/auth/login"),
    ("POST", "/auth/logout"),
    ("POST", "/auth/refresh"),
}

# Catálogos con baja lógica: deben exponer DELETE.
CATALOGOS = {
    "/equipos": "/equipos/{equipo_id}",
    "/aptitudes": "/aptitudes/{aptitud_id}",
    "/insumos": "/insumos/{insumo_id}",
    "/unidades-medida": "/unidades-medida/{unidad_id}",
    "/insumos-quimicos": "/insumos-quimicos/{insumo_id}",
    "/elementos-limpieza": "/elementos-limpieza/{elemento_id}",
    "/planes-limpieza": "/planes-limpieza/{plan_id}",
    "/planes-calibracion-mantenimiento": "/planes-calibracion-mantenimiento/{plan_id}",
    "/tareas": "/tareas/{tarea_id}",
    "/personal": "/personal/{persona_id}",
    "/vencimientos-personal": "/vencimientos-personal/{vencimiento_id}",
}

fallos = []

print("1) endpoints públicos")
publicos = {
    (verb.upper(), ruta)
    for ruta, ops in spec["paths"].items()
    for verb, op in ops.items()
    if not op.get("security")
}
for p in sorted(publicos):
    print(f"   {p[0]:6} {p[1]}")
if publicos != PUBLICOS_ESPERADOS:
    print("   FALLA: el conjunto de endpoints públicos cambió")
    print(f"     inesperados: {sorted(publicos - PUBLICOS_ESPERADOS)}")
    print(f"     faltantes:    {sorted(PUBLICOS_ESPERADOS - publicos)}")
    fallos.append("conjunto de endpoints públicos")
else:
    print("   ok  solo /auth/* está público")

print()
print("2) verbos de baja lógica")
for prefijo, ruta_id in CATALOGOS.items():
    ops = spec["paths"].get(ruta_id, {})
    tiene = "delete" in ops
    marca = "ok " if tiene else "FALTA"
    print(f"   {marca} DELETE {ruta_id}")
    if not tiene:
        fallos.append(f"falta DELETE en {ruta_id}")

print()
if fallos:
    print(f"{len(fallos)} FALLAS")
    for f in fallos:
        print("  -", f)
    sys.exit(1)

print("TODO OK")