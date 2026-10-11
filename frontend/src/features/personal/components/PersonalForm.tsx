import { useState } from "react";
import { Box, Checkbox, HStack, Stack, Text } from "@chakra-ui/react";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";
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
    <Box as="form" onSubmit={handleSubmit}>
      <TarjetaFormulario>
        <TituloFormulario>{title}</TituloFormulario>

        <Stack direction={{ base: "column", md: "row" }} gap="4" mb="6" align="start">
          <FormField label="Nombre" required mb="0">
            <FormInput
              value={values.nombre}
              onChange={(e) => setValues({ ...values, nombre: e.target.value })}
              w="100%"
            />
          </FormField>
          <FormField label="Apellido" mb="0">
            <FormInput
              value={values.apellido || ""}
              onChange={(e) => setValues({ ...values, apellido: e.target.value })}
              w="100%"
            />
          </FormField>
        </Stack>

        <Stack direction={{ base: "column", md: "row" }} gap="4" mb="6" align="start">
          <FormField label="DNI (7 u 8 dígitos)" required mb="0">
            <FormInput
              value={values.dni}
              maxLength={8}
              onChange={(e) => setValues({ ...values, dni: e.target.value })}
              w="100%"
            />
          </FormField>
          <FormField label="Email" required mb="0">
            <FormInput
              type="email"
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
              w="100%"
            />
          </FormField>
        </Stack>

        <FormField label="Teléfono" mb="6">
          <FormInput
            value={values.telefono || ""}
            onChange={(e) => setValues({ ...values, telefono: e.target.value })}
            w="100%"
          />
        </FormField>

        {errorCapacidades && <BannerError>{errorCapacidades}</BannerError>}

        {/* Capacidades y rol: solo visibles para quien puede modificarlos */}
        {puedeEditarCapacidades && (
          <>
            <HStack gap="6" mb="6">
              <Checkbox.Root
                checked={Boolean(values.puede_operar)}
                onCheckedChange={(e) => setValues({ ...values, puede_operar: !!e.checked })}
                fontWeight="medium"
                color="fg.muted"
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
                <Checkbox.Label>Operar</Checkbox.Label>
              </Checkbox.Root>
              <Checkbox.Root
                checked={Boolean(values.puede_administrar)}
                onCheckedChange={(e) => setValues({ ...values, puede_administrar: !!e.checked })}
                fontWeight="medium"
                color="fg.muted"
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
                <Checkbox.Label>Administrar</Checkbox.Label>
              </Checkbox.Root>
            </HStack>

            {/* El super admin es el nivel más alto: solo otro super admin lo asigna */}
            {puedeAsignarSuperAdmin && (
              <Box
                mb="6"
                p="4"
                bg="yellow.50"
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
                <Text fontSize="xs" color="fg.muted" fontStyle="italic" mt="1">
                  Un super administrador puede editar a cualquier persona del sistema y
                  asignar ese mismo rol.
                </Text>
              </Box>
            )}
          </>
        )}

        {/* En el alta la contraseña es obligatoria */}
        {requierePassword && (
          <Box
            mb="6"
            p="4"
            bg="bg.subtle"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="border"
            rounded="lg"
          >
            <FormField label="Contraseña" required mb="2">
              <FormInput
                type="password"
                placeholder="Contraseña de acceso al sistema"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                w="100%"
              />
            </FormField>
            <Text fontSize="xs" color="fg.subtle" fontStyle="italic">
              Mínimo 4 caracteres. Se guarda encriptada.
            </Text>
            {errorPassword && (
              <Box mt="2">
                <BannerError mb="0">{errorPassword}</BannerError>
              </Box>
            )}
          </Box>
        )}

        {/* SECCIÓN ESPECIAL: Solo visible si estás editando tu propio perfil */}
        {esMiPerfil && (
          <Box
            mb="6"
            p="4"
            bg="bg.subtle"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="border"
            rounded="lg"
          >
            <FormField label="Cambiar mi contraseña" mb="2">
              <FormInput
                type="password"
                placeholder="Escribí una nueva si querés cambiarla..."
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                w="100%"
              />
            </FormField>
            <Text fontSize="xs" color="fg.subtle" fontStyle="italic">
              Dejá este campo vacío para mantener tu contraseña actual.
            </Text>
          </Box>
        )}

        <AccionesFormulario>
          <BotonGuardar loading={isLoading}>{submitLabel}</BotonGuardar>
          {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
        </AccionesFormulario>
      </TarjetaFormulario>
    </Box>
  );
}