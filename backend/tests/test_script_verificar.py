"""Ejecuta `scripts/verificar.py`, que prueba las migraciones contra una base
con el esquema viejo (p. ej. equipos con `ubicacion` NULL)."""

import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def test_verificar_script_pasa():
    resultado = subprocess.run(
        [sys.executable, str(RAIZ / "scripts" / "verificar.py")],
        cwd=RAIZ,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    assert resultado.returncode == 0, resultado.stdout[-2000:] + resultado.stderr[-2000:]
