import type {
  RegistroTareaResponse,
  TareasDelDiaResponse,
  HistorialRegistroTareaResponse,
} from "../types/checklist";

import type { HistorialChecklistResponse } from "../types/checklist";


const API_URL = "http://localhost:8000";

export async function obtenerTareasDelDia(
  fecha?: string
): Promise<TareasDelDiaResponse> {
  const params = fecha ? `?fecha=${fecha}` : "";

  const response = await fetch(
    `${API_URL}/checklist/tareas-del-dia${params}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || "Error al obtener las tareas del día"
    );
  }

  return response.json();
}


// ---------------------------------------------------------
// MARCAR / DESMARCAR UNA TAREA
// ---------------------------------------------------------
export async function marcarTarea(
  tareaId: number,
  completado: boolean,
  usuarioId: number,
  evidencia?: File,
  fecha?: string,
  insumoQuimicoId?: number,
  cantidadConsumida?: number
): Promise<RegistroTareaResponse> {

  const params = fecha ? `?fecha=${fecha}` : "";

  // FormData permite enviar tanto datos normales como archivos.
  const formData = new FormData();

  formData.append(
    "completado",
    String(completado)
  );

  formData.append(
    "usuario_id",
    String(usuarioId)
  );

  // Evidencia fotográfica
  if (evidencia) {
    formData.append(
      "evidencia",
      evidencia
    );
  }

  // Producto químico utilizado
  if (insumoQuimicoId !== undefined) {
    formData.append(
      "insumo_quimico_id",
      String(insumoQuimicoId)
    );
  }

  // Cantidad aproximada consumida
  if (cantidadConsumida !== undefined) {
    formData.append(
      "cantidad_consumida",
      String(cantidadConsumida)
    );
  }

  const response = await fetch(
    `${API_URL}/checklist/tarea/${tareaId}${params}`,
    {
      method: "PATCH",

      // No agregamos Content-Type manualmente.
      // fetch lo configura automáticamente para FormData.
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => null);

    throw new Error(
      errorData?.detail ||
      "Error al actualizar la tarea"
    );
  }

  return response.json();
}


// ---------------------------------------------------------
// HISTORIAL DE UNA TAREA
// ---------------------------------------------------------
export async function obtenerHistorialRegistro(
  registroId: number
): Promise<HistorialRegistroTareaResponse> {

  const response = await fetch(
    `${API_URL}/checklist/registro/${registroId}/historial`
  );

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => null);

    throw new Error(
      errorData?.detail ||
      "Error al obtener el historial de la tarea"
    );
  }

  return response.json();
}


export async function obtenerHistorialChecklists(
  fechaDesde: string,
  fechaHasta: string,
  equipoId?: number
): Promise<HistorialChecklistResponse> {
  const params = new URLSearchParams({
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
  });
  if (equipoId !== undefined) params.append("equipo_id", String(equipoId));

  const response = await fetch(`${API_URL}/checklist/historial?${params}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener el historial de checklists");
  }

  return response.json();
}