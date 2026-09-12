import { useState, useEffect } from "react";
import FormularioPersonal from "./FormularioPersonal";
import TablaPersonal from "./TablaPersonal";
import type { Persona } from "../../types/personal";

export default function GestionPersonal() {
  const [personal, setPersonal] = useState<Persona[]>([]);
  const [personaEditando, setPersonaEditando] = useState<Persona | null>(null);

  // Cargamos el personal desde el backend al abrir la página
  useEffect(() => {
    fetch("http://localhost:8000/personal")
      .then((res) => res.json())
      .then((data) => setPersonal(data))
      .catch((err) => console.error("Error al cargar el personal:", err));
  }, []);

  const manejarGuardado = async (personaGuardada: any) => {
    try {
      const url = personaEditando
        ? `http://localhost:8000/personal/${personaEditando.id}`
        : "http://localhost:8000/personal";

      const metodo = personaEditando ? "PUT" : "POST";

      const respuesta = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(personaGuardada),
      });

      if (respuesta.ok) {
        const personaActualizada = await respuesta.json();
        if (personaEditando) {
          setPersonal(
            personal.map((p) =>
              p.id === personaActualizada.id ? personaActualizada : p,
            ),
          );
          setPersonaEditando(null);
        } else {
          setPersonal([...personal, personaActualizada]);
        }
      } else {
        const errorData = await respuesta.json();
        alert(`Error al guardar: ${errorData.detail || "Verifica los datos"}`);
      }
    } catch (error) {
      console.error("La API está apagada o hubo un error de red:", error);
    }
  };

  const manejarBorrado = async (id: number) => {
    try {
      const respuesta = await fetch(`http://localhost:8000/personal/${id}`, {
        method: "DELETE",
      });

      if (respuesta.ok) {
        // Como hicimos baja lógica en el backend, filtramos para sacarlo de la vista
        setPersonal(personal.filter((p) => p.id !== id));
      } else {
        alert("No se pudo dar de baja al personal.");
      }
    } catch (error) {
      console.error("Error al conectar con la API:", error);
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "1000px", margin: "0 auto" }}>
      <FormularioPersonal
        key={personaEditando ? personaEditando.id : "nuevo"}
        personaEditando={personaEditando}
        alGuardar={manejarGuardado}
        alCancelar={() => setPersonaEditando(null)}
      />

      <TablaPersonal
        listaPersonal={personal}
        alEditar={(persona) => setPersonaEditando(persona)}
        alBorrar={manejarBorrado}
      />
    </div>
  );
}
