import type {
  RegistroTareaResponse,
  TareasDelDiaResponse,
  HistorialRegistroTareaResponse,
} from "../types/checklist";

import type { HistorialChecklistResponse } from "../types/checklist";


import { apiFetch, API_URL } from "../../../common/api/apiClient";


export async function obtenerTareasDelDia(
  fecha?: string
): Promise<TareasDelDiaResponse> {
  const params = fecha ? `?fecha=${fecha}` : "";

  const response = await apiFetch(
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
  evidencia?: File,
  fecha?: string,
  insumoQuimicoId?: number,
  cantidadConsumida?: number,
  elementoLimpiezaId?: number
): Promise<RegistroTareaResponse> {

  const params = fecha ? `?fecha=${fecha}` : "";

  // FormData permite enviar tanto datos normales como archivos.
  const formData = new FormData();

  formData.append(
    "completado",
    String(completado)
  );

  // El usuario que completa la tarea lo determina el backend a partir del
  // token de sesión: no se envía desde el cliente para que no se pueda
  // atribuir la tarea a otra persona.

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
  
  // Elemento Limpieza utilizado
  if (elementoLimpiezaId !== undefined){
    formData.append(
      "elemento_limpieza_id",
      String(elementoLimpiezaId)
    );
  } 


  const response = await apiFetch(
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

  const response = await apiFetch(
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

  const response = await apiFetch(`${API_URL}/checklist/historial?${params}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener el historial de checklists");
  }

  return response.json();
}