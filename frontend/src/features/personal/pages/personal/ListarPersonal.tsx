
// aca montola tabla principal, el botón de ADD, los filtros y el ícono de ojo para ver el detalle.

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Persona } from '../../../../types/personal';

export default function ListarPersonal() {
  const [personal, setPersonal] = useState<Persona[]>([]);
  const [filtro, setFiltro] = useState<'todos' | 'operar' | 'administrar'>('todos');
  const navigate = useNavigate();
  // Estado para controlar la confirmación
  const [idABorrar, setIdABorrar] = useState<number | null>(null);
  
  useEffect(() => {
    fetch('http://localhost:8000/personal/')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPersonal(data);
        } else {
          setPersonal([]); 
        }
      })
      .catch(err => console.error("Error al cargar el personal:", err));
  }, []);

  const manejarEliminar = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/personal/${id}`, {
        method: 'DELETE',
      });
      setPersonal(personal.filter(p => p.id !== id));
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  };

  const personalFiltrado = personal.filter(p => {
    if (filtro === 'operar') return p.puede_operar;
    if (filtro === 'administrar') return p.puede_administrar;
    return true;
  });

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Gestión de Personal</h2>
        <Link to="/personal/nuevo" style={estiloBotonAdd}>+ Agregar</Link>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={() => setFiltro('todos')} style={estiloFiltro(filtro === 'todos')}>Todos</button>
        <button onClick={() => setFiltro('operar')} style={estiloFiltro(filtro === 'operar')}>Operadores</button>
        <button onClick={() => setFiltro('administrar')} style={estiloFiltro(filtro === 'administrar')}>Administradores</button>
      </div>

      <table style={{ width: '100%', backgroundColor: 'white', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden' }}>
        <thead>
          <tr style={{ backgroundColor: '#468189', color: 'white', textAlign: 'left' }}>
            <th style={{ padding: '12px' }}>ID</th>
            <th style={{ padding: '12px' }}>Nombre</th>
            <th style={{ padding: '12px' }}>Apellido</th>
            <th style={{ padding: '12px' }}>DNI</th>
            <th style={{ padding: '12px' }}>Permisos</th>
            <th style={{ padding: '12px', textAlign: 'center' }}>Detalle</th>
            <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {personalFiltrado.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px', fontWeight: 'bold', color: '#468189' }}>#{p.id}</td>
              <td style={{ padding: '12px' }}>{p.nombre}</td>
              <td style={{ padding: '12px' }}>{p.apellido || '-'}</td>
              <td style={{ padding: '12px' }}>{p.dni}</td>
              <td style={{ padding: '12px' }}>
                {p.puede_operar && <span style={badgeOperar}>Operador </span>}
                {p.puede_administrar && <span style={badgeAdmin}>Admin</span>}
                {!p.puede_operar && !p.puede_administrar && <span style={{ color: '#aaa' }}>Sin permisos</span>}
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                <button onClick={() => navigate(`/personal/detalle/${p.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }} title="Ver Detalle">
                  👁️
                </button>
              </td>
              <td style={{ padding: '12px', textAlign: 'center', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={() => navigate(`/personal/editar/${p.id}`)} style={estiloBotonAccion('editar')}>Modificar</button>
                {/* Ahora el botón activa el modal en lugar de borrar directamente */}
                <button onClick={() => setIdABorrar(p.id!)} style={estiloBotonAccion('eliminar')}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/*CARTEL DE CONFIRMACIÓN*/}
      {idABorrar !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', width: '350px', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>¿Esta seguro que desea eliminar?</h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                onClick={() => setIdABorrar(null)} 
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
                Cancelar
              </button>
              <button 
                onClick={() => { manejarEliminar(idABorrar); setIdABorrar(null); }} 
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#d9534f', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- ESTILOS ---
const estiloBotonAdd = {
  backgroundColor: '#468189', color: 'white', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold' as const,
};

const estiloFiltro = (activo: boolean) => ({
  padding: '8px 16px', borderRadius: '6px', border: '1px solid #468189',
  backgroundColor: activo ? '#468189' : '#fff',
  color: activo ? '#fff' : '#468189',
  cursor: 'pointer', fontWeight: 'bold' as const, transition: '0.2s'
});

const estiloBotonAccion = (tipo: 'editar' | 'eliminar') => ({
  backgroundColor: tipo === 'editar' ? '#f0ad4e' : '#d9534f', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer',
});

const badgeOperar = { backgroundColor: '#17a2b8', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', marginRight: '4px' };
const badgeAdmin = { backgroundColor: '#6f42c1', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' };