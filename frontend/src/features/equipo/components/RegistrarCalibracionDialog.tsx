import { useState, useRef } from "react";
import { Box, Button, Portal, Input, Field, HStack, Text } from "@chakra-ui/react";
import type { Equipo } from "../types/equipo";

interface RegistrarCalibracionDialogProps {
  isOpen: boolean;
  equipo: Equipo | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (fecha: string, archivo: File) => void;
}

export function RegistrarCalibracionDialog({ isOpen, equipo, isLoading, onClose, onConfirm }: RegistrarCalibracionDialogProps) {
  const [fecha, setFecha] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !equipo) return null;

  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const minDate = `${anioActual}-01-01`;
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
    if (fecha < minDate) {
      setErrorValidacion(`La fecha no puede ser anterior al 1 de enero de ${anioActual}.`);
      return;
    }
    if (fecha > maxDate) {
      setErrorValidacion("La fecha de calibración no puede ser una fecha en el futuro.");
      return;
    }
    if (!archivo) {
      setErrorValidacion("Tenés que adjuntar el documento (PDF o imagen) de la calibración.");
      return;
    }

    onConfirm(fecha, archivo);
    setFecha("");
    setArchivo(null);
    setErrorValidacion(null);
  };

  const handleCerrar = () => {
    setFecha("");
    setArchivo(null);
    setErrorValidacion(null);
    onClose();
  };

  return (
    <Portal>
      <Box style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
        
        {/* Cambiamos el <Box as="form"> por un <form> puro para que TypeScript acepte noValidate */}
        <form noValidate onSubmit={handleSubmit} style={{ backgroundColor: "white", padding: "25px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.2)", width: "400px" }}>
          
          <Box as="h3" style={{ marginTop: 0, color: "#468189", marginBottom: "15px" }}>
            Registrar calibración: <br/><strong>{equipo.nombre}</strong>
          </Box>

          {errorValidacion && (
            <Box style={{ backgroundColor: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "6px", marginBottom: "15px", border: "1px solid #f5c6cb", fontSize: "14px", fontWeight: "bold" }}>
              ⚠️ {errorValidacion}
            </Box>
          )}

          <Field.Root style={{ marginBottom: "15px" }}>
            <Box as="label" style={{ display: "block", fontSize: "14px", fontWeight: "bold", color: "#555", marginBottom: "8px" }}>
              FECHA DE REALIZACIÓN *
            </Box>
            <Input 
              type="date" 
              lang="es-AR"
              min={minDate}
              max={maxDate}
              value={fecha} 
              onChange={(e) => setFecha(e.target.value)} 
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "2px solid #90BEBB" }} 
            />
          </Field.Root>

          <Field.Root style={{ marginBottom: "25px" }}>
            <Box as="label" style={{ display: "block", fontSize: "14px", fontWeight: "bold", color: "#555", marginBottom: "8px" }}>
              CERTIFICADO ADJUNTO (PDF / Imagen) *
            </Box>
            
            <input 
              type="file" 
              accept=".pdf, image/*" 
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setArchivo(e.target.files[0]);
                }
              }} 
            />

            <HStack 
              style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "2px dashed #90BEBB", backgroundColor: "#f9f9f9", alignItems: "center" }}
            >
              <Button 
                type="button" 
                onClick={() => fileInputRef.current?.click()} 
                style={{ backgroundColor: "#e0e0e0", color: "#333", border: "1px solid #ccc", padding: "6px 12px", borderRadius: "4px", fontSize: "14px", cursor: "pointer" }}
              >
                Seleccionar Archivo
              </Button>
              <Text fontSize="14px" color={archivo ? "#333" : "#888"} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" flex="1">
                {archivo ? archivo.name : "Ningún archivo seleccionado"}
              </Text>
            </HStack>
          </Field.Root>

          <HStack justify="center" gap="10px">
            <Button type="button" onClick={handleCerrar} disabled={isLoading} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #ccc", backgroundColor: "#fff", cursor: "pointer", fontWeight: "bold" }}>
              Cancelar
            </Button>
            <Button type="submit" loading={isLoading} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", backgroundColor: "#468189", color: "white", cursor: "pointer", fontWeight: "bold" }}>
              Subir y Guardar
            </Button>
          </HStack>

        {/* Cerramos el form correctamente */}
        </form>

      </Box>
    </Portal>
  );
}