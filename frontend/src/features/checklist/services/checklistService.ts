import type {
  RegistroTareaResponse,
  TareasDelDiaResponse,
  HistorialRegistroTareaResponse,
} from "../types/checklist";

import type { ConsumoInsumosResponse, HistorialChecklistResponse } from "../types/checklist";


import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";


export async function obtenerTareasDelDia(
  fecha?: string
): Promise<TareasDelDiaResponse> {
  const params = fecha ? `?fecha=${fecha}` : "";

  const response = await apiFetch(
    `${API_URL}/checklist/tareas-del-dia${params}`
  );

  return pedir<TareasDelDiaResponse>(
    response,
    "Error al obtener las tareas del día"
  );
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

  return pedir<RegistroTareaResponse>(
    response,
    "Error al actualizar la tarea"
  );
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

  return pedir<HistorialRegistroTareaResponse>(
    response,
    "Error al obtener el historial de la tarea"
  );
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

  return pedir<HistorialChecklistResponse>(
    response,
    "Error al obtener el historial de checklists"
  );
}


// ---------------------------------------------------------
// CONSUMO DE INSUMOS EN UN RANGO DE FECHAS
// ---------------------------------------------------------
export async function obtenerConsumoInsumos(
  fechaDesde: string,
  fechaHasta: string
): Promise<ConsumoInsumosResponse> {
  const params = new URLSearchParams({
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
  });

  const response = await apiFetch(`${API_URL}/checklist/consumo?${params}`);

  return pedir<ConsumoInsumosResponse>(
    response,
    "Error al obtener el consumo"
  );
}