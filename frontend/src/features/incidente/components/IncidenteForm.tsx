import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Field,
  HStack,
  Image,
  Input,
  NativeSelect,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type { IncidenteFormValues, TipoIncidente } from "../types/incidente";
import { TIPOS_INCIDENTE, admiteEquipo, requiereEquipoObligatorio } from "../types/incidente";
import { listarEquipos } from "../../equipo/services/equipoService";
import type { Equipo } from "../../equipo/types/equipo";
import {
  AccionesFormulario,
  BotonGuardar,
} from "../../../components/ui/patrones";

interface IncidenteFormProps {
  onSubmit: (values: IncidenteFormValues, foto?: File) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  fullWidth?: boolean;
}

const emptyValues: IncidenteFormValues = {
  titulo: "",
  descripcion: "",
  tipo: "otro",
  equipo_id: null,
};

/**
 * Props del `NativeSelect.Field` de este formulario.
 *
 * `NativeSelect.Field` no consume la receta `input` del tema, así que hay que
 * darle a mano el mismo borde que llevan los `<Input>` de la app.
 */
const SELECT_BASE = {
  bg: "white",
  borderWidth: "2px",
  borderColor: "brand.300",
  borderRadius: "lg",
  fontSize: "md",
} as const;

const FORMATOS_PERMITIDOS = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Mismo límite que el backend. Acá se avisa al instante; el backend vuelve a
// validarlo porque el chequeo del navegador se puede saltear.
const TAMANO_MAX_FOTO = 5 * 1024 * 1024;

export function IncidenteForm({
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Registrar Incidente",
  fullWidth = false,
}: IncidenteFormProps) {
  const [values, setValues] = useState<IncidenteFormValues>(emptyValues);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [cargandoEquipos, setCargandoEquipos] = useState(true);
  const [errorEquipos, setErrorEquipos] = useState<string | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  const maxInputWidth = fullWidth ? "720px" : "500px";

  useEffect(() => {
    const cargarEquipos = async () => {
      try {
        const data = await listarEquipos(false);
        setEquipos(data);
      } catch (err) {
        console.error("Error al cargar equipos:", err);
        // Sin este aviso el select quedaba vacío sin explicación y era
        // indistinguible de "no hay equipos cargados".
        setErrorEquipos(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los equipos."
        );
      } finally {
        setCargandoEquipos(false);
      }
    };
    cargarEquipos();
  }, []);

  const handleTituloChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, titulo: e.target.value }));

  const handleDescripcionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setValues((prev) => ({ ...prev, descripcion: e.target.value }));

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tipo = e.target.value as TipoIncidente;
    setValues((prev) => ({
      ...prev,
      tipo,
      // Si el nuevo tipo no admite equipo, se limpia para no dejar
      // un equipo fantasma asociado a un incidente que no lo necesita.
      equipo_id: admiteEquipo(tipo) ? prev.equipo_id : null,
    }));
  };

  const handleEquipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setValues((prev) => ({
      ...prev,
      equipo_id: val === "" ? null : Number(val),
    }));
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setErrorFoto(null);

    if (file) {
      if (!FORMATOS_PERMITIDOS.includes(file.type)) {
        setErrorFoto("Formato no permitido. Solo se aceptan imágenes (JPEG, PNG, GIF, WebP).");
        setFoto(null);
        setFotoPreview(null);
        return;
      }
      if (file.size > TAMANO_MAX_FOTO) {
        setErrorFoto("La foto supera el máximo de 5 MB.");
        setFoto(null);
        setFotoPreview(null);
        return;
      }
      setFoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFoto(null);
      setFotoPreview(null);
    }
  };

  const handleRemoverFoto = () => {
    setFoto(null);
    setFotoPreview(null);
    setErrorFoto(null);
  };

  const equipoObligatorio = requiereEquipoObligatorio(values.tipo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (equipoObligatorio && (values.equipo_id === null || values.equipo_id === undefined)) {
      return;
    }
    if (!values.titulo.trim() || !values.descripcion.trim()) {
      return;
    }
    await onSubmit(values, foto ?? undefined);
  };

  return (
    <Box
      as="form"
      onSubmit={handleSubmit}
      bg="white"
      p="8"
      rounded="xl"
      boxShadow="card"
      mb="8"
    >
      <Box
        as="h3"
        mt={0}
        fontSize="2xl"
        fontWeight="bold"
        color="brand.500"
        mb="6"
      >
        {title}
      </Box>

      {/* Título */}
      <Field.Root required mb="5">
        <Field.Label color="gray.600">TÍTULO *</Field.Label>
        <Input
          type="text"
          value={values.titulo}
          onChange={handleTituloChange}
          placeholder="Ej: Termostato de heladera roto"
          maxLength={60}
          maxW={maxInputWidth}
        />
      </Field.Root>

      {/* Tipo de Incidente */}
      <Field.Root required mb="5">
        <Field.Label color="gray.600">TIPO DE INCIDENTE *</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={values.tipo}
            onChange={handleTipoChange}
            maxW={maxInputWidth}
            {...SELECT_BASE}
          >
            {TIPOS_INCIDENTE.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {tipo.label}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>

      {admiteEquipo(values.tipo) && (
        <Field.Root required={equipoObligatorio} mb="5">
          <Field.Label color="gray.600">
            {equipoObligatorio ? "EQUIPO *" : "EQUIPO (OPCIONAL)"}
          </Field.Label>
          <NativeSelect.Root disabled={cargandoEquipos}>
            <NativeSelect.Field
              value={values.equipo_id ?? ""}
              onChange={handleEquipoChange}
              maxW={maxInputWidth}
              {...SELECT_BASE}
            >
              <option value="">
                {cargandoEquipos
                  ? "Cargando..."
                  : equipoObligatorio
                    ? "Seleccionar equipo"
                    : "Seleccionar equipo (opcional)"}
              </option>
              {equipos.map((equipo) => (
                <option key={equipo.id} value={equipo.id}>
                  {equipo.nombre}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>

          {errorEquipos && (
            <Text fontSize="xs" color="red.600" mt="1" fontWeight="bold">
              ⚠️ {errorEquipos}
            </Text>
          )}
        </Field.Root>
      )}

      {/* Descripción */}
      <Field.Root required mb="5">
        <Field.Label color="gray.600">DESCRIPCIÓN *</Field.Label>
        <Textarea
          value={values.descripcion}
          onChange={handleDescripcionChange}
          placeholder="Ej: Describa lo ocurrido"
          rows={4}
          maxW={maxInputWidth}
          resize="vertical"
        />
      </Field.Root>

      <Field.Root mb="6">
        <Field.Label color="gray.600">FOTO (OPCIONAL)</Field.Label>
        <Input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          display="none"
          id="foto-incidente"
          onChange={handleFotoChange}
        />
        <HStack gap="2.5">
          <Button
            type="button"
            onClick={() => document.getElementById("foto-incidente")?.click()}
            variant="outline"
            colorPalette="gray"
            bg="gray.200"
            color="gray.800"
            px="4"
            py="2"
            rounded="md"
            fontSize="sm"
            fontWeight="bold"
            _hover={{ bg: "gray.300" }}
          >
            Adjuntar Foto
          </Button>
          {foto && (
            <Text fontSize="sm" color="brand.500" fontWeight="bold">
              {foto.name}
            </Text>
          )}
        </HStack>

        {errorFoto && (
          <Text fontSize="xs" color="red.600" mt="1" fontWeight="bold">
            ⚠️ {errorFoto}
          </Text>
        )}

        {/* Preview de la foto */}
        {fotoPreview && (
          <Box mt="3" position="relative" display="inline-block">
            <Image
              src={fotoPreview}
              alt="Vista previa de la foto adjunta"
              maxW="200px"
              maxH="200px"
              rounded="lg"
              borderWidth="2px"
              borderColor="brand.300"
              display="block"
            />
            <Button
              type="button"
              onClick={handleRemoverFoto}
              aria-label="Quitar foto adjunta"
              position="absolute"
              top="-8px"
              right="-8px"
              size="sm"
              minW="22px"
              height="22px"
              padding="0"
              rounded="full"
              bg="red.600"
              color="white"
              fontWeight="bold"
              lineHeight="1"
              _hover={{ bg: "red.700" }}
            >
              ✕
            </Button>
          </Box>
        )}
      </Field.Root>

      {/* Botones */}
      <AccionesFormulario>
        <BotonGuardar loading={isLoading}>{submitLabel}</BotonGuardar>
      </AccionesFormulario>
    </Box>
  );
}