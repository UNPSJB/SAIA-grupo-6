import { useRef, useState } from "react";
import { Button, HStack, Input, Text } from "@chakra-ui/react";

import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
} from "../../../components/ui/patrones";
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
        bg="bg.panel"
        p="6"
        rounded="lg"
        boxShadow="dialog"
        width="400px"
        maxWidth="400px"
      >
        <DialogForm onSubmit={handleSubmit}>
          <DialogTitle
            as="h3"
            mt={0}
            mb="4"
            fontSize="lg"
            fontWeight="bold"
            color="fg"
          >
            Registrar calibración: <br />
            <strong>{equipo.nombre}</strong>
          </DialogTitle>

          {error && <BannerError mb="4">{error}</BannerError>}

          {errorValidacion && (
            <BannerError mb="4">{errorValidacion}</BannerError>
          )}

          <FormField label="Fecha de realización" required mb="4">
            <FormInput
              type="date"
              min={minDate}
              max={maxDate}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </FormField>

          <FormField
            label="Certificado adjunto (PDF / imagen)"
            required
            mb="6"
          >
            {/* El input real queda oculto: lo dispara el botón de abajo, que
                es el que el usuario ve y con el que navega por teclado. Es el
                `Input` de Chakra y no `FormInput` porque sólo éste acepta el
                `ref` que necesita el input de archivo. */}
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
              bg="bg.subtle"
              alignItems="center"
            >
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                colorPalette="neutral"
                size="sm"
              >
                Seleccionar archivo
              </Button>
              <Text
                fontSize="sm"
                color={archivo ? "fg" : "fg.subtle"}
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                flex="1"
              >
                {archivo ? archivo.name : "Ningún archivo seleccionado"}
              </Text>
            </HStack>
          </FormField>

          <AccionesFormulario>
            <BotonGuardar loading={isLoading}>Subir y guardar</BotonGuardar>
            <BotonCancelar onClick={handleCerrar} disabled={isLoading}>
              Cancelar
            </BotonCancelar>
          </AccionesFormulario>
        </DialogForm>
      </DialogContent>
    </DialogRoot>
  );
}
