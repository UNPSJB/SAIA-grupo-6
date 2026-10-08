import { useState, useEffect } from "react";
import {
  Box,
  Button,
  HStack,
  IconButton,
  Image,
  Input,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { LuPaperclip, LuX } from "react-icons/lu";
import type { IncidenteFormValues, TipoIncidente } from "../types/incidente";
import {
  TIPOS_INCIDENTE,
  admiteEquipo,
  requiereEquipoObligatorio,
} from "../types/incidente";
import { listarEquipos } from "../../equipo/services/equipoService";
import type { Equipo } from "../../equipo/types/equipo";
import {
  AccionesFormulario,
  BotonGuardar,
  FormField,
  FormInput,
  FormNativeSelect,
  MensajeError,
  TarjetaFormulario,
  TituloFormulario,
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

const FORMATOS_PERMITIDOS = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Mismo límite que el backend. Acá se avisa al instante; el backend vuelve a
// validarlo porque el chequeo del navegador se puede saltear.
const TAMANO_MAX_FOTO = 5 * 1024 * 1024;

export function IncidenteForm({
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Registrar incidente",
  fullWidth = false,
}: IncidenteFormProps) {
  const [values, setValues] = useState<IncidenteFormValues>(emptyValues);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [cargandoEquipos, setCargandoEquipos] = useState(true);
  const [errorEquipos, setErrorEquipos] = useState<string | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  // Ancho del campo: es layout, no estilo, así que queda como prop.
  const anchoCampo = fullWidth ? undefined : "500px";

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
        setErrorFoto(
          "Formato no permitido. Solo se aceptan imágenes (JPEG, PNG, GIF, WebP)."
        );
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
    if (
      equipoObligatorio &&
      (values.equipo_id === null || values.equipo_id === undefined)
    ) {
      return;
    }
    if (!values.titulo.trim() || !values.descripcion.trim()) {
      return;
    }
    await onSubmit(values, foto ?? undefined);
  };

  return (
    <TarjetaFormulario as="form" onSubmit={handleSubmit}>
      <TituloFormulario>{title}</TituloFormulario>

      <FormField label="Título" required>
        <FormInput
          type="text"
          value={values.titulo}
          onChange={handleTituloChange}
          placeholder="Ej: Termostato de heladera roto"
          maxLength={60}
          maxW={anchoCampo}
        />
      </FormField>

      <FormField label="Tipo de incidente" required>
        <FormNativeSelect
          value={values.tipo}
          onChange={handleTipoChange}
          maxW={anchoCampo}
        >
          {TIPOS_INCIDENTE.map((tipo) => (
            <option key={tipo.value} value={tipo.value}>
              {tipo.label}
            </option>
          ))}
        </FormNativeSelect>
      </FormField>

      {admiteEquipo(values.tipo) && (
        <FormField
          label={equipoObligatorio ? "Equipo" : "Equipo (opcional)"}
          required={equipoObligatorio}
          helper={errorEquipos ?? undefined}
          invalid={Boolean(errorEquipos)}
        >
          <FormNativeSelect
            value={values.equipo_id ?? ""}
            onChange={handleEquipoChange}
            disabled={cargandoEquipos}
            invalid={Boolean(errorEquipos)}
            maxW={anchoCampo}
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
          </FormNativeSelect>
        </FormField>
      )}

      <FormField label="Descripción" required>
        <Textarea
          value={values.descripcion}
          onChange={handleDescripcionChange}
          placeholder="Ej: Describa lo ocurrido"
          rows={4}
          maxW={anchoCampo}
          resize="vertical"
        />
      </FormField>

      <FormField label="Foto (opcional)" invalid={Boolean(errorFoto)} mb="6">
        <Input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          display="none"
          id="foto-incidente"
          onChange={handleFotoChange}
        />
        <HStack gap="3">
          <Button
            type="button"
            onClick={() => document.getElementById("foto-incidente")?.click()}
            variant="outline"
            colorPalette="neutral"
            size="sm"
          >
            <LuPaperclip aria-hidden />
            Adjuntar foto
          </Button>
          {foto && (
            <Text fontSize="sm" color="brand.fg" fontWeight="medium">
              {foto.name}
            </Text>
          )}
        </HStack>

        {errorFoto && <MensajeError>{errorFoto}</MensajeError>}

        {/* Preview de la foto */}
        {fotoPreview && (
          <Box mt="4" position="relative" display="inline-block">
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
            <IconButton
              type="button"
              onClick={handleRemoverFoto}
              aria-label="Quitar foto adjunta"
              position="absolute"
              top="-2"
              right="-2"
              size="xs"
              rounded="full"
              colorPalette="red"
            >
              <LuX />
            </IconButton>
          </Box>
        )}
      </FormField>

      <AccionesFormulario>
        <BotonGuardar loading={isLoading}>{submitLabel}</BotonGuardar>
      </AccionesFormulario>
    </TarjetaFormulario>
  );
}