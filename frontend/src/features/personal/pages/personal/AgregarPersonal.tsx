//aca es donde reutilizamos el componente FormularioPersonal limpio para hacer el alta:

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FormularioPersonal from '../../FormularioPersonal';

export default function AgregarPersonal() {
  const navigate = useNavigate();
  // tengo que crear un estado para guardar el mensaje de error
  const [error, setError] = useState<string | null>(null);

  const manejarGuardar = async (nuevaPersona: any) => {
    setError(null); // limpio los errores anteriores al intentar de nuevo
    try {
      const response = await fetch('http://localhost:8000/personal/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaPersona)
      });
      
      // si FastAPI devuelve un error, ej: 400 por duplicado
      if (!response.ok) {
        const errorData = await response.json();
        // guardo el mensaje que manda FastAPI ("detail") para mostrarlo en pantalla
        setError(errorData.detail || "Ocurrió un error al guardar los datos.");
        return; // corto la ejecución acá para que NO vuelva a la lista
      }

      // si todo ok, recién ahí vuelvo a la lista
      navigate('/personal');
    } catch (error) {
      console.error("Error al guardar:", error);
      setError("Error de conexión con el servidor.");
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Registrar Nuevo Personal</h2>
        <button 
          onClick={() => navigate('/personal')} 
          style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
          Volver a la lista
        </button>
      </div>

      {/* si hay  error, muestro cartelito rojo */}
      {error && (
        <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '12px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #f5c6cb', fontWeight: 'bold' }}>
          ⚠️ {error}
        </div>
      )}

      <FormularioPersonal 
        personaEditando={null} 
        alGuardar={manejarGuardar} 
        alCancelar={() => navigate('/personal')} 
      />
    </div>
  );
}