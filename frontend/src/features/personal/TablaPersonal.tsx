import type { Persona } from '../../types/personal';

interface Props {
  listaPersonal: Persona[];
  alEditar: (persona: Persona) => void;
  alBorrar: (id: number) => void;
}

export default function TablaPersonal({ listaPersonal, alEditar, alBorrar }: Props) {
  return (
    <div style={{ 
      backgroundColor: '#fff', 
      borderRadius: '12px', 
      boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
      overflowX: 'auto' 
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '15px' }}>
        <thead>
          <tr style={{ backgroundColor: '#90BEBB', color: '#2b4d52' }}>
            <th style={{ padding: '15px 15px', fontWeight: 'bold' }}>ID</th>
            <th style={{ padding: '15px 15px', fontWeight: 'bold' }}>NOMBRE Y APELLIDO</th>
            <th style={{ padding: '15px 15px', fontWeight: 'bold' }}>DNI</th>
            <th style={{ padding: '15px 15px', fontWeight: 'bold' }}>CONTACTO</th>
            <th style={{ padding: '15px 15px', fontWeight: 'bold' }}>CAPACIDADES</th>
            <th style={{ padding: '15px 15px', fontWeight: 'bold', textAlign: 'right' }}>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {listaPersonal.map((p, index) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '15px 15px', color: '#666' }}>{index + 1}</td>
              <td style={{ padding: '15px 15px', fontWeight: '500' }}>
                {p.nombre} {p.apellido || ''}
              </td>
              <td style={{ padding: '15px 15px', color: '#555' }}>{p.dni}</td>
              <td style={{ padding: '15px 15px', color: '#555', fontSize: '14px' }}>
                <div>📧 {p.email}</div>
                {p.telefono && <div>📞 {p.telefono}</div>}
              </td>
            <td style={{ padding: '15px 15px' }}>
                <span style={{ 
                  backgroundColor: '#f5f5f5', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  display: 'inline-block',
                  fontSize: '13px'
                }}>
                  {p.puede_operar && "Operar"}
                  {p.puede_operar && p.puede_administrar && " | "}
                  {p.puede_administrar && "Administrar"}
                  {(!p.puede_operar && !p.puede_administrar) && "Ninguna"}
                </span>
              </td>
              <td style={{ padding: '15px 15px', textAlign: 'right' }}>
                <button 
                  onClick={() => alEditar(p)} 
                  style={{ 
                    backgroundColor: '#e2e8f0', 
                    color: '#333',
                    border: 'none',
                    borderRadius: '6px', 
                    padding: '8px 12px', 
                    marginRight: '8px', 
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}>
                  Modificar
                </button>
                <button 
                  onClick={() => alBorrar(p.id)} 
                  style={{ 
                    backgroundColor: '#7A0000', 
                    color: 'white', 
                    border: 'none',
                    borderRadius: '6px', 
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}>
                  Borrar
                </button>
              </td>
            </tr>
          ))}
          {listaPersonal.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                No hay personal registrado aún. Usa el formulario de arriba para agregar uno.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}