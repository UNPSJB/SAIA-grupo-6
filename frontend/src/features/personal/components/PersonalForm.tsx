import { useState } from "react";
import { Box, Button, Field, HStack, Input, Text } from "@chakra-ui/react";
import type { PersonaInput } from "../types/personal";
import {
  BLANCO,
  BORDE_CONTROL,
  ERROR_FONDO,
  ERROR_TEXTO,
  FONDO_NEUTRO,
  GRIS_CLARO,
  TEAL,
  TEXTO_PRIMARIO,
  estiloInputAncho,
  estiloLabel,
} from "../../../common/theme/tokens";

// Alias local por compatibilidad con la firma del form; la forma real la
// define PersonaInput en types/personal.ts (los flags de capacidad son
// opcionales porque el form los quita cuando el usuario no puede tocarlos).
type PersonalFormValues = PersonaInput;

interface PersonalFormProps {
  initialValues?: PersonalFormValues;
  onSubmit: (values: PersonalFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
  esMiPerfil?: boolean; // Muestra la sección de cambiar la contraseña propia
  requierePassword?: boolean; // Alta de persona: la contraseña es obligatoria
  // Jerarquía de roles: solo quien puede tocar capacidades las ve, y el flag
  // de super admin únicamente lo muestra un super admin.
  puedeEditarCapacidades?: boolean;
  puedeAsignarSuperAdmin?: boolean;
}

const emptyValues: PersonalFormValues = { nombre: "", apellido: "", dni: "", email: "", telefono: "", puede_operar: false, puede_administrar: false, es_super_admin: false };

export function PersonalForm({ initialValues = emptyValues, onSubmit, isLoading = false, submitLabel = "Guardar", title = "Formulario de Personal", onCancel, esMiPerfil = false, requierePassword = false, puedeEditarCapacidades = false, puedeAsignarSuperAdmin = false }: PersonalFormProps) {
  const [values, setValues] = useState<PersonalFormValues>(initialValues);
  const [errorCapacidades, setErrorCapacidades] = useState<string | null>(null);
  const [errorPassword, setErrorPassword] = useState<string | null>(null);
  
  // Guardamos la nueva contraseña aparte para no pisar accidentalmente la actual
  const [nuevaPassword, setNuevaPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!values.nombre.trim()) return;

      if (!values.puede_operar && !values.puede_administrar && !values.es_super_admin) {
          setErrorCapacidades("Debés seleccionar al menos una capacidad (Operar o Administrar).");
          return;
      }
      setErrorCapacidades(null);

      // En el alta la contraseña es obligatoria: el backend la exige.
      if (requierePassword && nuevaPassword.trim().length < 4) {
          setErrorPassword("La contraseña es obligatoria y debe tener al menos 4 caracteres.");
          return;
      }
      setErrorPassword(null);

      // El tipo ya modela `password` y `activo` (PersonaInput), asi que ya no
      // hace falta castear: antes el `as` escondido que el form realmente
      // mandaba `password`/`activo`, algo que la firma no permitia expresar.
      const datosEnviar: PersonaInput = {
        ...values,
        apellido: values.apellido || null,
        telefono: values.telefono || null,
      };

      // Quien no puede tocar roles no los manda: evita enviar flags que el
      // backend va a rechazar igual (y ensucia el PUT).
      if (!puedeEditarCapacidades) {
          delete datosEnviar.puede_operar;
          delete datosEnviar.puede_administrar;
      }
      if (!puedeAsignarSuperAdmin) {
          delete datosEnviar.es_super_admin;
      }

      // En el alta mandamos la contraseña; al editar tu perfil, solo si la cambiaste.
      if (requierePassword) {
          datosEnviar.password = nuevaPassword;
      } else if (esMiPerfil && nuevaPassword.trim() !== "") {
          datosEnviar.password = nuevaPassword;
      }

      onSubmit(datosEnviar);
  };

  return (
    <Box as="form" onSubmit={handleSubmit} style={{ backgroundColor: BLANCO, padding: "30px", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", marginBottom: "30px" }}>
      <Box as="h3" style={{ marginTop: 0, fontSize: "22px", color: TEAL, marginBottom: "20px" }}>{title}</Box>

      <HStack gap="20px" mb="20px">
        <Field.Root required>
          <Box as="label" style={estiloLabel}>NOMBRE *</Box>
          <Input value={values.nombre} onChange={(e) => setValues({ ...values, nombre: e.target.value })} style={estiloInputAncho} />
        </Field.Root>
        <Field.Root>
          <Box as="label" style={estiloLabel}>APELLIDO</Box>
          <Input value={values.apellido || ""} onChange={(e) => setValues({ ...values, apellido: e.target.value })} style={estiloInputAncho} />
        </Field.Root>
      </HStack>

      <HStack gap="20px" mb="20px">
        <Field.Root required>
          <Box as="label" style={estiloLabel}>DNI (7 u 8 dígitos)*</Box>
          <Input value={values.dni} maxLength={8} onChange={(e) => setValues({ ...values, dni: e.target.value })} style={estiloInputAncho} />
        </Field.Root>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>EMAIL *</Box>
          <Input type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} style={estiloInputAncho} />
        </Field.Root>
      </HStack>

      <Box mb="20px">
        <Field.Root>
          <Box as="label" style={estiloLabel}>TELÉFONO</Box>
          <Input value={values.telefono || ""} onChange={(e) => setValues({ ...values, telefono: e.target.value })} style={estiloInputAncho} />
        </Field.Root>
      </Box>
      
      {errorCapacidades && (
      <Box style={{ backgroundColor: ERROR_FONDO, color: ERROR_TEXTO, padding: "12px", borderRadius: "6px", marginBottom: "20px", border: "1px solid #f5c6cb", fontWeight: "bold" }}>
        ⚠️ {errorCapacidades}
      </Box>
      )}

      {/* Capacidades y rol: solo visibles para quien puede modificarlos */}
      {puedeEditarCapacidades && (
        <>
          <HStack gap="25px" mb="25px">
            <label style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input type="checkbox" checked={values.puede_operar} onChange={(e) => setValues({ ...values, puede_operar: e.target.checked })} style={{ width: "18px", height: "18px" }} /> Operar
            </label>
            <label style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input type="checkbox" checked={values.puede_administrar} onChange={(e) => setValues({ ...values, puede_administrar: e.target.checked })} style={{ width: "18px", height: "18px" }} /> Administrar
            </label>
          </HStack>

          {/* El super admin es el nivel más alto: solo otro super admin lo asigna */}
          {puedeAsignarSuperAdmin && (
            <Box mb="25px" p="15px" style={{ backgroundColor: "#fff8e1", border: "1px dashed #e0c36a", borderRadius: "8px" }}>
              <label style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "bold" }}>
                <input type="checkbox" checked={Boolean(values.es_super_admin)} onChange={(e) => setValues({ ...values, es_super_admin: e.target.checked })} style={{ width: "18px", height: "18px" }} /> Super administrador
              </label>
              <Text fontSize="13px" color="gray.600" fontStyle="italic" style={{ marginTop: "6px" }}>
                Un super administrador puede editar a cualquier persona del sistema y
                asignar ese mismo rol.
              </Text>
            </Box>
          )}
        </>
      )}

      {/* En el alta la contraseña es obligatoria */}
      {requierePassword && (
        <Box mb="25px" p="15px" style={{ backgroundColor: FONDO_NEUTRO, border: `1px dashed ${BORDE_CONTROL}`, borderRadius: "8px" }}>
          <Box as="label" style={{...estiloLabel, color: TEAL}}>CONTRASEÑA *</Box>
          <Input
            type="password"
            placeholder="Contraseña de acceso al sistema"
            value={nuevaPassword}
            onChange={(e) => setNuevaPassword(e.target.value)}
            style={{...estiloInputAncho, marginBottom: "5px"}}
          />
          <Text fontSize="13px" color="gray.500" fontStyle="italic">Mínimo 4 caracteres. Se guarda encriptada.</Text>
          {errorPassword && (
            <Box style={{ backgroundColor: ERROR_FONDO, color: ERROR_TEXTO, padding: "10px", borderRadius: "6px", marginTop: "10px", border: "1px solid #f5c6cb", fontWeight: "bold" }}>
              ⚠️ {errorPassword}
            </Box>
          )}
        </Box>
      )}

      {/* SECCIÓN ESPECIAL: Solo visible si estás editando tu propio perfil */}
      {esMiPerfil && (
        <Box mb="25px" p="15px" style={{ backgroundColor: FONDO_NEUTRO, border: `1px dashed ${BORDE_CONTROL}`, borderRadius: "8px" }}>
          <Box as="label" style={{...estiloLabel, color: TEAL}}>CAMBIAR MI CONTRASEÑA</Box>
          <Input 
            type="password"
            placeholder="Escribí una nueva si querés cambiarla..." 
            value={nuevaPassword} 
            onChange={(e) => setNuevaPassword(e.target.value)} 
            style={{...estiloInputAncho, marginBottom: "5px"}} 
          />
          <Text fontSize="13px" color="gray.500" fontStyle="italic">Dejá este campo vacío para mantener tu contraseña actual.</Text>
        </Box>
      )}

      <HStack style={{ gap: "15px" }}>
        <Button type="submit" loading={isLoading} style={{ backgroundColor: TEAL, color: "white", padding: "12px 24px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" onClick={onCancel} style={{ backgroundColor: GRIS_CLARO, color: TEXTO_PRIMARIO, padding: "12px 24px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
            Cancelar
          </Button>
        )}
      </HStack>
    </Box>
  );
}