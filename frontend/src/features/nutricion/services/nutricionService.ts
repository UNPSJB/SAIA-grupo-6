import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  AlimentoReferencia,
  ConfiguracionProducto,
  ConfiguracionProductoInput,
  DatosNutricionales,
  DatosNutricionalesInput,
  InfoNutricional,
  LaboratorioInput,
  ValorLaboratorio,
  Parametros,
  ResultadoImportacion,
} from "../types/nutricion";

const BASE = `${API_URL}/nutricion`;

function json(method: string, datos: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  };
}

// ── Parámetros ─────────────────────────────────────────────────────────────

export async function obtenerParametros(): Promise<Parametros> {
  return pedir<Parametros>(await apiFetch(`${BASE}/parametros`), "Error al obtener los parámetros");
}

export async function guardarParametros(datos: Parametros): Promise<Parametros> {
  return pedir<Parametros>(
    await apiFetch(`${BASE}/parametros`, json("PUT", datos)),
    "No se pudieron guardar los parámetros",
  );
}

// ── Base de composición ────────────────────────────────────────────────────

export async function buscarAlimentos(buscar = "", base = ""): Promise<AlimentoReferencia[]> {
  const params = new URLSearchParams();
  if (buscar.trim()) params.set("buscar", buscar.trim());
  if (base) params.set("base", base);
  return pedir<AlimentoReferencia[]>(
    await apiFetch(`${BASE}/alimentos?${params.toString()}`),
    "Error al buscar en la base de composición",
  );
}

export async function listarBases(): Promise<string[]> {
  return pedir<string[]>(await apiFetch(`${BASE}/alimentos/bases`), "Error al obtener las bases");
}

export async function importarAlimentos(base: string, archivo: File): Promise<ResultadoImportacion> {
  const datos = new FormData();
  datos.append("base", base);
  datos.append("archivo", archivo);
  return pedir<ResultadoImportacion>(
    await apiFetch(`${BASE}/alimentos/importar`, { method: "POST", body: datos }),
    "No se pudo importar el archivo",
  );
}

// ── Insumos ────────────────────────────────────────────────────────────────

export async function obtenerDatosInsumo(insumoId: number): Promise<DatosNutricionales> {
  return pedir<DatosNutricionales>(
    await apiFetch(`${BASE}/insumos/${insumoId}`),
    "Error al obtener los datos nutricionales",
  );
}

export async function guardarDatosInsumo(
  insumoId: number,
  datos: DatosNutricionalesInput,
): Promise<DatosNutricionales> {
  return pedir<DatosNutricionales>(
    await apiFetch(`${BASE}/insumos/${insumoId}`, json("PUT", datos)),
    "No se pudieron guardar los datos nutricionales",
  );
}

// ── Productos ──────────────────────────────────────────────────────────────

export async function obtenerInfoNutricional(productoId: number): Promise<InfoNutricional> {
  return pedir<InfoNutricional>(
    await apiFetch(`${BASE}/productos/${productoId}`),
    "Error al calcular la información nutricional",
  );
}

export async function guardarConfiguracionProducto(
  productoId: number,
  datos: ConfiguracionProductoInput,
): Promise<ConfiguracionProducto> {
  return pedir<ConfiguracionProducto>(
    await apiFetch(`${BASE}/productos/${productoId}/configuracion`, json("PUT", datos)),
    "No se pudieron guardar los datos del producto",
  );
}

export async function guardarLaboratorio(
  productoId: number,
  datos: LaboratorioInput,
): Promise<ValorLaboratorio[]> {
  return pedir<ValorLaboratorio[]>(
    await apiFetch(`${BASE}/productos/${productoId}/laboratorio`, json("PUT", datos)),
    "No se pudieron guardar los resultados de laboratorio",
  );
}

export async function descargarPdf(productoId: number, nombre: string): Promise<void> {
  const response = await apiFetch(`${BASE}/productos/${productoId}/pdf`);
  if (!response.ok) {
    const detalle = await response.json().catch(() => null);
    throw new Error((detalle as { detail?: string })?.detail || "No se pudo generar el PDF");
  }
  const enlace = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = enlace;
  a.download = `info_nutricional_${nombre.replace(/[^\p{L}\p{N}]+/gu, "_")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(enlace);
}
