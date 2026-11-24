import { useState, type ReactNode } from "react";
import { Checkbox, HStack, Text } from "@chakra-ui/react";
import {
  BannerError,
  FormField,
  FormInput,
} from "../../../components/ui/patrones";
import {
  AccionesAlta,
  CeldaCompleta,
  FormularioAlta,
  GrillaFormulario,
  SeccionFormulario,
} from "../../../components/ui/formularios";
import type { PersonaInput } from "../types/personal";

// Alias local por compatibilidad con la firma del form; la forma real la
// define PersonaInput en types/personal.ts (los flags de capacidad son
// opcionales porque el form los quita cuando el usuario no puede tocarlos).
type PersonalFormValues = PersonaInput;

interface PersonalFormProps {
  initialValues?: PersonalFormValues;
  onSubmit: (values: PersonalFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  /**
   * Contenido extra antes de la barra de acciones (ej. vencimientos). Va
   * directo en el formulario: que sea una `SeccionFormulario`.
   */
  extra?: ReactNode;
  esMiPerfil?: boolean; // Muestra la sección de cambiar la contraseña propia
  // Jerarquía de roles: solo quien puede tocar capacidades las ve, y el flag
  // de super admin únicamente lo muestra un super admin.
  puedeEditarCapacidades?: boolean;
  puedeAsignarSuperAdmin?: boolean;
  /** Dar o quitar "Administrar": el gerente de la sede o el super admin. */
  puedeAsignarAdministrar?: boolean;
  /** Designar gerentes: solo el super admin. */
  puedeAsignarGerente?: boolean;
}

const emptyValues: PersonalFormValues = { nombre: "", apellido: "", dni: "", email: "", telefono: "", puede_operar: false, puede_administrar: false, es_super_admin: false, es_gerente: false };

export function PersonalForm({ initialValues = emptyValues, onSubmit, isLoading = false, submitLabel = "Guardar", onCancel, extra, esMiPerfil = false, puedeEditarCapacidades = false, puedeAsignarSuperAdmin = false, puedeAsignarAdministrar = false, puedeAsignarGerente = false }: PersonalFormProps) {
  const [values, setValues] = useState<PersonalFormValues>(initialValues);
  const [errorCapacidades, setErrorCapacidades] = useState<string | null>(null);
  
  // Guardamos la nueva contraseña aparte para no pisar accidentalmente la actual
  const [nuevaPassword, setNuevaPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!values.nombre.trim()) return;

      // La validación de capacidades solo aplica si la sección se muestra: quien
      // no puede editar capacidades no tiene los checkboxes a la vista, así que
      // exigirle una capacidad lo dejaba sin poder guardar sin saber por qué.
      if (
          puedeEditarCapacidades &&
          !values.puede_operar &&
          !values.puede_administrar &&
          !values.es_super_admin
      ) {
          setErrorCapacidades("Debés seleccionar al menos una capacidad (Operar o Administrar).");
          return;
      }
      setErrorCapacidades(null);

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
      if (!puedeAsignarAdministrar) {
          delete datosEnviar.puede_administrar;
      }
      if (!puedeAsignarGerente) {
          delete datosEnviar.es_gerente;
      }

      // Al editar tu propio perfil, la contraseña solo se manda si la cambiaste.
      if (esMiPerfil && nuevaPassword.trim() !== "") {
          datosEnviar.password = nuevaPassword;
      }

      onSubmit(datosEnviar);
  };

  return (
    <FormularioAlta onSubmit={handleSubmit}>
      <SeccionFormulario titulo="Datos personales">
        <GrillaFormulario>
          <FormField label="Nombre" required>
            <FormInput
              value={values.nombre}
              onChange={(e) => setValues({ ...values, nombre: e.target.value })}
            />
          </FormField>
          <FormField label="Apellido">
            <FormInput
              value={values.apellido || ""}
              onChange={(e) => setValues({ ...values, apellido: e.target.value })}
            />
          </FormField>

          <FormField label="DNI" required helper="7 u 8 dígitos, sin puntos.">
            <FormInput
              value={values.dni}
              maxLength={8}
              onChange={(e) => setValues({ ...values, dni: e.target.value })}
            />
          </FormField>
          <FormField label="Email" required>
            <FormInput
              type="email"
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
            />
          </FormField>

          <FormField label="Teléfono">
            <FormInput
              value={values.telefono || ""}
              onChange={(e) => setValues({ ...values, telefono: e.target.value })}
            />
          </FormField>
        </GrillaFormulario>
      </SeccionFormulario>

      {/* Capacidades y rol: solo visibles para quien puede modificarlos */}
      {(puedeEditarCapacidades || errorCapacidades) && (
        <SeccionFormulario titulo="Permisos" ayuda="Qué puede hacer esta persona en el sistema.">
          <GrillaFormulario>
            {errorCapacidades && (
              <CeldaCompleta>
                <BannerError mb="0">{errorCapacidades}</BannerError>
              </CeldaCompleta>
            )}

            {puedeEditarCapacidades && (
              <CeldaCompleta>
                <HStack gap="6">
                  <Checkbox.Root
                    checked={Boolean(values.puede_operar)}
                    // El gerente siempre opera y administra.
                    disabled={Boolean(values.es_gerente)}
                    onCheckedChange={(e) => setValues({ ...values, puede_operar: !!e.checked })}
                    fontWeight="medium"
                    color="fg"
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>Operar</Checkbox.Label>
                  </Checkbox.Root>
                  {/* Un admin común solo da de alta operadores: "Administrar"
                      lo asigna el gerente de la sede o el super admin. */}
                  {puedeAsignarAdministrar && (
                    <Checkbox.Root
                      checked={Boolean(values.puede_administrar)}
                      disabled={Boolean(values.es_gerente)}
                      onCheckedChange={(e) => setValues({ ...values, puede_administrar: !!e.checked })}
                      fontWeight="medium"
                      color="fg"
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label>Administrar</Checkbox.Label>
                    </Checkbox.Root>
                  )}
                </HStack>
              </CeldaCompleta>
            )}

            {puedeEditarCapacidades && puedeAsignarGerente && (
              <CeldaCompleta p="4" bg="bg.muted" borderWidth="1px" rounded="lg">
                <Checkbox.Root
                  checked={Boolean(values.es_gerente)}
                  onCheckedChange={(e) =>
                    setValues({
                      ...values,
                      es_gerente: !!e.checked,
                      // Gerente implica operar y administrar.
                      ...(e.checked ? { puede_operar: true, puede_administrar: true } : {}),
                    })
                  }
                  fontWeight="medium"
                  color="fg"
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>Gerente del establecimiento</Checkbox.Label>
                </Checkbox.Root>
                <Text fontSize="xs" color="fg.muted" mt="1">
                  Administra todo su establecimiento (incluidos los administradores) y ve el
                  tablero que compara su sede con el resto de la empresa.
                </Text>
              </CeldaCompleta>
            )}

            {/* El super admin es el nivel más alto: solo otro super admin lo asigna */}
            {puedeEditarCapacidades && puedeAsignarSuperAdmin && (
              <CeldaCompleta
                p="4"
                bg="yellow.subtle"
                borderWidth="1px"
                borderStyle="dashed"
                borderColor="yellow.400"
                rounded="lg"
              >
                <Checkbox.Root
                  checked={Boolean(values.es_super_admin)}
                  onCheckedChange={(e) => setValues({ ...values, es_super_admin: !!e.checked })}
                  fontWeight="medium"
                  color="yellow.fg"
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>Super administrador</Checkbox.Label>
                </Checkbox.Root>
                <Text fontSize="xs" color="fg.muted" mt="1">
                  Un super administrador puede editar a cualquier persona del sistema y
                  asignar ese mismo rol.
                </Text>
              </CeldaCompleta>
            )}
          </GrillaFormulario>
        </SeccionFormulario>
      )}

      {/* SECCIÓN ESPECIAL: Solo visible si estás editando tu propio perfil */}
      {esMiPerfil && (
        <SeccionFormulario titulo="Contraseña">
          <GrillaFormulario>
            <FormField
              label="Cambiar mi contraseña"
              opcional
              helper="Dejá este campo vacío para mantener tu contraseña actual."
            >
              <FormInput
                type="password"
                placeholder="Escribí una nueva si querés cambiarla..."
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
              />
            </FormField>
          </GrillaFormulario>
        </SeccionFormulario>
      )}

      {extra}

      <AccionesAlta etiqueta={submitLabel} guardando={isLoading} onCancelar={onCancel} />
    </FormularioAlta>
  );
}
