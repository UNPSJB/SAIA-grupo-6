import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Field,
  HStack,
  Input,
  NativeSelect,
  Text,
} from "@chakra-ui/react";
import type { IncidenteFormValues, TipoIncidente } from "../types/incidente";
import { TIPOS_INCIDENTE } from "../types/incidente";
import { listarEquipos } from "../../equipo/services/equipoService";
import type { Equipo } from "../../equipo/types/equipo";

interface IncidenteFormProps {
  onSubmit: (values: IncidenteFormValues, foto?: File) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
}

const emptyValues: IncidenteFormValues = {
  descripcion: "",
  tipo: "otro",
  equipo_id: null,
  foto_url: null,
};

const estiloInput = {
  backgroundColor: "#fff",
  padding: "12px",
  width: "100%",
  maxWidth: "500px",
  borderRadius: "8px",
  border: "2px solid #90BEBB",
  fontSize: "16px",
  outline: "none",
  color: "#333",
};

const estiloSelect = {
  ...estiloInput,
  boxSizing: "border-box" as const,
  colorScheme: "light" as const,
  height: "auto" as const,
  lineHeight: "normal" as const,
};

const estiloLabel = {
  display: "block",
  fontSize: "14px",
  fontWeight: "bold" as const,
  marginBottom: "8px",
  color: "#555",
};

const FORMATOS_PERMITIDOS = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export function IncidenteForm({
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Registrar Incidente",
}: IncidenteFormProps) {
  const [values, setValues] = useState<IncidenteFormValues>(emptyValues);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [cargandoEquipos, setCargandoEquipos] = useState(true);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  useEffect(() => {
    const cargarEquipos = async () => {
      try {
        const data = await listarEquipos(false);
        setEquipos(data);
      } catch (err) {
        console.error("Error al cargar equipos:", err);
      } finally {
        setCargandoEquipos(false);
      }
    };
    cargarEquipos();
  }, []);

  const handleDescripcionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setValues((prev) => ({ ...prev, descripcion: e.target.value }));

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({
      ...prev,
      tipo: e.target.value as TipoIncidente,
    }));

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values, foto ?? undefined);
  };

  return (
    <Box
      as="form"
      onSubmit={handleSubmit}
      style={{
        backgroundColor: "#ffffff",
        padding: "30px",
        borderRadius: "12px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
        marginBottom: "30px",
      }}
    >
      <Box
        as="h3"
        style={{
          marginTop: 0,
          fontSize: "22px",
          color: "#468189",
        }}
      >
        {title}
      </Box>

      {/* Descripción */}
      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            DESCRIPCIÓN *
          </Box>
          <textarea
            value={values.descripcion}
            onChange={handleDescripcionChange}
            placeholder="Ej: Se rompió el termostato de la heladera"
            rows={4}
            style={{
              ...estiloInput,
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </Field.Root>
      </Box>

      {/* Tipo de Incidente */}
      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            TIPO DE INCIDENTE *
          </Box>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={values.tipo}
              onChange={handleTipoChange}
              style={estiloSelect}
            >
              {TIPOS_INCIDENTE.map((tipo) => (
                <option
                  key={tipo.value}
                  value={tipo.value}
                  style={{
                    backgroundColor: "#fff",
                    color: "#333",
                  }}
                >
                  {tipo.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
      </Box>

      {/* Equipo (opcional) */}
      <Box style={{ marginBottom: "20px" }}>
        <Field.Root>
          <Box as="label" style={estiloLabel}>
            EQUIPO (OPCIONAL)
          </Box>
          <NativeSelect.Root disabled={cargandoEquipos}>
            <NativeSelect.Field
              value={values.equipo_id ?? ""}
              onChange={handleEquipoChange}
              style={estiloSelect}
            >
              <option value="">
                {cargandoEquipos ? "Cargando..." : "Seleccionar equipo (opcional)"}
              </option>
              {equipos.map((equipo) => (
                <option
                  key={equipo.id}
                  value={equipo.id}
                  style={{
                    backgroundColor: "#fff",
                    color: "#333",
                  }}
                >
                  {equipo.nombre}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
      </Box>

      {/* Foto (opcional) */}
      <Box style={{ marginBottom: "25px" }}>
        <Box as="label" style={estiloLabel}>
          FOTO (OPCIONAL)
        </Box>
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          style={{ display: "none" }}
          id="foto-incidente"
          onChange={handleFotoChange}
        />
        <HStack gap="10px">
          <Button
            type="button"
            onClick={() => document.getElementById("foto-incidente")?.click()}
            style={{
              backgroundColor: "#e2e8f0",
              color: "#333",
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            Adjuntar Foto
          </Button>
          {foto && (
            <Text fontSize="14px" color="#468189" fontWeight="bold">
              {foto.name}
            </Text>
          )}
        </HStack>

        {errorFoto && (
          <Text fontSize="13px" color="red.500" mt="6px" fontWeight="bold">
            ⚠️ {errorFoto}
          </Text>
        )}

        {/* Preview de la foto */}
        {fotoPreview && (
          <Box mt="12px" position="relative" display="inline-block">
            <img
              src={fotoPreview}
              alt="Preview"
              style={{
                maxWidth: "200px",
                maxHeight: "200px",
                borderRadius: "8px",
                border: "2px solid #90BEBB",
              }}
            />
            <Button
              type="button"
              onClick={handleRemoverFoto}
              position="absolute"
              top="-8px"
              right="-8px"
              size="sm"
              borderRadius="full"
              bg="#d9534f"
              color="white"
              _hover={{ bg: "#c9302c" }}
            >
              ✕
            </Button>
          </Box>
        )}
      </Box>

      {/* Botones */}
      <HStack style={{ gap: "15px" }}>
        <Button
          type="submit"
          loading={isLoading}
          style={{
            backgroundColor: "#468189",
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontSize: "15px",
            fontWeight: "bold",
          }}
        >
          {submitLabel}
        </Button>
      </HStack>
    </Box>
  );
}
