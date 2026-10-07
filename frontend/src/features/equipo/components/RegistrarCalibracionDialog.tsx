import { useRef, useState } from "react";
import { Box, Button, Field, HStack, Input, Portal, Text } from "@chakra-ui/react";

import {
  BLANCO,
  BORDE_CONTROL,
  ERROR_BORDE,
  ERROR_FONDO,
  ERROR_TEXTO,
  FONDO_NEUTRO,
  GRIS_CLARO,
  TEAL,
  TEAL_CLARO,
  TEXTO_PRIMARIO,
  TEXTO_TENUE,
  estiloInputAncho,
  estiloLabel,
} from "../../../common/theme/tokens";
import type { Equipo } from "../types/equipo";

const FORMATOS_ACEPTADOS = ".pdf,image/*";

interface RegistrarCalibracionDialogProps {
  isOpen: boolean;
  equipo: Equipo | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (fecha: string, archivo: File) => void;
}

export function RegistrarCalibracionDialog({
  isOpen,
  equipo,
  isLoading,
  onClose,
  onConfirm,
}: RegistrarCalibracionDialogProps) {
  const [fecha, setFecha] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // El formulario se limpia en `handleCerrar` y en `handleSubmit`, que son las
  // dos únicas vías por las que este diálogo se cierra. No hace falta un efecto
  // para vigilar `isOpen`: además dispararía un render en cascada.

  // Hoy en zona horaria local, para que el `max` no reste un día por el offset.
  const hoy = new Date();
  const minDate = `${hoy.getFullYear()}-01-01`;
  const maxDate = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);

    if (!fecha) {
      setErrorValidacion("Por favor, ingresá la fecha de realización.");
      return;
    }
    if (fecha > maxDate) {
      setErrorValidacion("La fecha de calibración no puede ser una fecha en el futuro.");
      return;
    }
    if (fecha < minDate) {
      setErrorValidacion(
        `La fecha no puede ser anterior al 1 de enero de ${hoy.getFullYear()}.`
      );
      return;
    }
    if (!archivo) {
      setErrorValidacion(
        "Tenés que adjuntar el documento (PDF o imagen) de la calibración."
      );
      return;
    }

    onConfirm(fecha, archivo);
    // El diálogo sigue abierto mientras la petición corre (lo cierra la
    // página cuando termina bien), así que acá solo se sueltan los campos.
    setFecha("");
    setArchivo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCerrar = () => {
    setFecha("");
    setArchivo(null);
    setErrorValidacion(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  if (!isOpen || !equipo) return null;

  return (
    <Portal>
      <Box
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        {/* `form` puro y no `Box as="form"`: Chakra no le pasa `noValidate`. */}
        <form
          noValidate
          onSubmit={handleSubmit}
          style={{
            backgroundColor: BLANCO,
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            width: "400px",
          }}
        >
          <Box as="h3" style={{ marginTop: 0, color: TEAL, marginBottom: "15px" }}>
            Registrar calibración: <br />
            <strong>{equipo.nombre}</strong>
          </Box>

          {errorValidacion && (
            <Box
              style={{
                backgroundColor: ERROR_FONDO,
                color: ERROR_TEXTO,
                padding: "10px",
                borderRadius: "6px",
                marginBottom: "15px",
                border: `1px solid ${ERROR_BORDE}`,
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              ⚠️ {errorValidacion}
            </Box>
          )}

          <Field.Root style={{ marginBottom: "15px" }}>
            <label style={estiloLabel}>FECHA DE REALIZACIÓN *</label>
            <Input
              type="date"
              style={estiloInputAncho}
              min={minDate}
              max={maxDate}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field.Root>

          <Field.Root style={{ marginBottom: "25px" }}>
            <label style={estiloLabel}>
              CERTIFICADO ADJUNTO (PDF / Imagen) *
            </label>

            <input
              type="file"
              accept={FORMATOS_ACEPTADOS}
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={(e) => {
                const elegido = e.target.files?.[0];
                setArchivo(elegido ?? null);
              }}
            />

            <HStack
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "8px",
                border: `2px dashed ${TEAL_CLARO}`,
                backgroundColor: FONDO_NEUTRO,
                alignItems: "center",
              }}
            >
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  backgroundColor: GRIS_CLARO,
                  color: TEXTO_PRIMARIO,
                  border: `1px solid ${BORDE_CONTROL}`,
                  padding: "6px 12px",
                  borderRadius: "4px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Seleccionar Archivo
              </Button>
              <Text
                fontSize="14px"
                color={archivo ? TEXTO_PRIMARIO : TEXTO_TENUE}
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                flex="1"
              >
                {archivo ? archivo.name : "Ningún archivo seleccionado"}
              </Text>
            </HStack>
          </Field.Root>

          <HStack justify="center" gap="10px">
            <Button
              type="button"
              onClick={handleCerrar}
              disabled={isLoading}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: `1px solid ${BORDE_CONTROL}`,
                backgroundColor: BLANCO,
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={isLoading}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: TEAL,
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Subir y Guardar
            </Button>
          </HStack>
        </form>
      </Box>
    </Portal>
  );
}