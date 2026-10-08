import { useRef, useState } from "react";
import { Button, Field, HStack, Input, Text } from "@chakra-ui/react";

import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import { BannerError } from "../../../components/ui/patrones";
import { DialogForm } from "../../../common/components/DialogForm";
import type { Equipo } from "../types/equipo";

const FORMATOS_ACEPTADOS = ".pdf,image/*";

interface RegistrarCalibracionDialogProps {
  isOpen: boolean;
  equipo: Equipo | null;
  isLoading?: boolean;
  /** Error de la mutación, para poder reintentar sin perder los datos. */
  error?: string | null;
  onClose: () => void;
  onConfirm: (fecha: string, archivo: File) => void;
}

export function RegistrarCalibracionDialog({
  isOpen,
  equipo,
  isLoading,
  error,
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

    // El diálogo sigue abierto mientras la petición corre y lo cierra la
    // página cuando termina bien. Los campos NO se sueltan acá: si el POST
    // falla, el operador necesita ver la fecha y el archivo que ya eligió
    // para poder reintentar sin repetirlos. El reset ocurre en
    // `handleCerrar`, que es la otra vía por la que se vacía el formulario.
    onConfirm(fecha, archivo);
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
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={false}
      closeOnInteractOutside={false}
    >
      <DialogContent
        bg="white"
        p="6"
        rounded="l2"
        boxShadow="dialog"
        width="400px"
        maxWidth="400px"
      >
        <DialogForm onSubmit={handleSubmit}>
          <DialogTitle
            as="h3"
            mt={0}
            mb="4"
            fontWeight="bold"
            color="brand.500"
          >
            Registrar calibración: <br />
            <strong>{equipo.nombre}</strong>
          </DialogTitle>

          {error && <BannerError mb="4">{error}</BannerError>}

          {errorValidacion && (
            <BannerError mb="4">{errorValidacion}</BannerError>
          )}

          <Field.Root mb="4">
            <Field.Label color="gray.600">FECHA DE REALIZACIÓN *</Field.Label>
            <Input
              type="date"
              min={minDate}
              max={maxDate}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field.Root>

          <Field.Root mb="6">
            <Field.Label color="gray.600">
              CERTIFICADO ADJUNTO (PDF / Imagen) *
            </Field.Label>

            {/* El input real queda oculto: lo dispara el botón de abajo, que
                es el que el usuario ve y con el que navega por teclado. */}
            <Input
              type="file"
              accept={FORMATOS_ACEPTADOS}
              ref={fileInputRef}
              display="none"
              onChange={(e) => {
                const elegido = e.target.files?.[0];
                setArchivo(elegido ?? null);
              }}
            />

            <HStack
              w="100%"
              p="2"
              rounded="lg"
              borderWidth="2px"
              borderStyle="dashed"
              borderColor="brand.300"
              bg="gray.50"
              alignItems="center"
            >
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                colorPalette="gray"
                size="sm"
                h="auto"
                minW="auto"
                px="3"
                py="1.5"
                rounded="md"
                fontWeight="bold"
              >
                Seleccionar Archivo
              </Button>
              <Text
                fontSize="sm"
                color={archivo ? "gray.800" : "gray.400"}
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                flex="1"
              >
                {archivo ? archivo.name : "Ningún archivo seleccionado"}
              </Text>
            </HStack>
          </Field.Root>

          <HStack justify="center" gap="3">
            <Button
              type="button"
              onClick={handleCerrar}
              disabled={isLoading}
              variant="outline"
              colorPalette="gray"
              h="auto"
              minW="auto"
              px="4"
              py="2"
              rounded="md"
              fontWeight="bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={isLoading}
              colorPalette="brand"
              variant="solid"
              h="auto"
              minW="auto"
              px="4"
              py="2"
              rounded="md"
              fontWeight="bold"
            >
              Subir y Guardar
            </Button>
          </HStack>
        </DialogForm>
      </DialogContent>
    </DialogRoot>
  );
}
