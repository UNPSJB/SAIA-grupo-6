import type { Persona } from "../types/personal";
import { ConflictoInactivoError } from "../../../common/api/errors";



const API_URL = "http://localhost:8000";

type PersonaInput = Omit<Persona, "id" | "activo" | "fecha_creacion" | "fecha_actualizacion">;

export async function listarPersonal(incluirInactivos = false): Promise<Persona[]> {
    const query = incluirInactivos ? "?incluir_inactivos=true" : "";
    const response = await fetch(`${API_URL}/personal${query}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al obtener el personal");
    }
    return response.json();
}

export async function obtenerPersona(id: number): Promise<Persona> {
    const response = await fetch(`${API_URL}/personal/${id}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al obtener la persona");
    }
    return response.json();
}

export async function crearPersona(persona: PersonaInput): Promise<Persona> {
    const response = await fetch(`${API_URL}/personal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(persona),
    });

    if (response.status === 409) {
        const errorData = await response.json().catch(() => null);
        const detail = errorData?.detail;
        if (detail && typeof detail === "object" && detail.tipo === "inactivo") {
            throw new ConflictoInactivoError(detail.mensaje, detail.id, detail.campo);
        }
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al crear el registro");
    }

    return response.json();
}

export async function modificarPersona(id: number, persona: PersonaInput): Promise<Persona> {
    const response = await fetch(`${API_URL}/personal/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(persona),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        let mensajeError = "Error al modificar el registro";
        
        if (errorData?.detail) {
            if (Array.isArray(errorData.detail)) {
                mensajeError = errorData.detail.map((d: any) => {
                    const campo = d.loc[d.loc.length - 1];
                    let mensaje = d.msg;
                    
                    // Traductor amigable de errores técnicos
                    if (mensaje === "Field required") mensaje = "Este dato es obligatorio.";
                    if (mensaje.includes("valid email")) mensaje = "El formato del correo es inválido.";
                    
                    // Formateamos el nombre del campo para que se lea mejor
                    const nombreCampo = campo === "password" ? "Contraseña" : campo.toString().toUpperCase();
                    
                    return `${nombreCampo}: ${mensaje}`;
                }).join(" | ");
            } else if (typeof errorData.detail === 'string') {
                mensajeError = errorData.detail;
            }
        }
        
        throw new Error(mensajeError);
    }
    
    return response.json();
}

// Reactiva a alguien dado de baja, pisando sus datos con los valores nuevos.
// No es un endpoint nuevo: reusa el PUT /personal/{id} de siempre, solo que
// le manda `activo: true` además de los campos del formulario (PersonaUpdate
// ya soporta ese campo).
export async function reactivarPersona(id: number, persona: PersonaInput): Promise<Persona> {
    const response = await fetch(`${API_URL}/personal/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...persona, activo: true }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al reactivar el personal");
    }
    return response.json();
}

export async function eliminarPersona(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/personal/${id}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al eliminar el registro");
    }
}
