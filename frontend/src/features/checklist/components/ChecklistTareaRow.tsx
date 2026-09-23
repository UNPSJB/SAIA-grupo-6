import { HStack, Table, Text, Spinner, Box, Button } from "@chakra-ui/react";
import { useState, useRef } from "react";
import type { ChecklistTareaItem } from "../types/checklist";

interface ChecklistTareaRowProps {
  tarea: ChecklistTareaItem;
  isLoading: boolean;
  onToggle: (tareaId: number, estadoActual: boolean, evidencia?: File) => void;
}

const TEAL = "#468189";

export function ChecklistTareaRow({
  tarea,
  isLoading,
  onToggle,
}: ChecklistTareaRowProps) {
  // Estado local para guardar la foto seleccionada y el modal de visualización
  const [archivoEvidencia, setArchivoEvidencia] = useState<File | null>(null);
  const [imagenModalUrl, setImagenModalUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const horaCompletado = tarea.fecha_completado
    ? new Date(tarea.fecha_completado).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const handleCheckboxClick = () => {
    onToggle(tarea.id, tarea.completado, archivoEvidencia || undefined);
    setArchivoEvidencia(null);
  };

  const urlFoto = tarea.evidencia_url
    ? `http://localhost:8000/${tarea.evidencia_url.replace(/\\/g, "/")}`
    : null;

  return (
    <>
      <Table.Row
        style={{
          borderBottom: "1px solid #eee",
          backgroundColor: tarea.completado ? "#f8fff9" : "transparent",
          transition: "background-color 0.2s",
        }}
      >
        <Table.Cell width="60px" textAlign="center" style={{ padding: "12px" }}>
          {isLoading ? (
            <Spinner size="xs" color={TEAL} />
          ) : (
            <input
              type="checkbox"
              checked={tarea.completado}
              onChange={handleCheckboxClick}
              style={{
                width: "18px",
                height: "18px",
                cursor: "pointer",
                accentColor: TEAL,
              }}
            />
          )}
        </Table.Cell>
        <Table.Cell
          style={{
            padding: "12px",
            textDecoration: tarea.completado ? "line-through" : "none",
            color: tarea.completado ? "#777" : "#333",
            fontWeight: 500,
          }}
        >
          {tarea.nombre}
          
          {/* INPUT DE FOTO Y PREVISUALIZACIÓN */}
          {!tarea.completado && (
            <Box mt="8px">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={(e) => setArchivoEvidencia(e.target.files?.[0] || null)}
              />
              <HStack gap="10px">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    fontSize: "12px",
                    padding: "4px 8px",
                    backgroundColor: "#e2e8f0",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Adjuntar Evidencia
                </button>
                {archivoEvidencia && (
                  <Text fontSize="12px" color={TEAL} fontWeight="bold">
                    {archivoEvidencia.name} (Lista para enviar)
                  </Text>
                )}
              </HStack>
            </Box>
          )}
        </Table.Cell>
        <Table.Cell style={{ padding: "12px", textAlign: "right" }}>
          {tarea.completado ? (
            <Box display="flex" flexDirection="column" alignItems="flex-end" gap="4px">
              <HStack justify="flex-end" gap="6px">
                <Text fontSize="13px" color="#28a745" fontWeight="bold">
                  ✓ Completada
                </Text>
                {horaCompletado && (
                  <Text fontSize="12px" color="#888">
                    ({horaCompletado})
                  </Text>
                )}
              </HStack>
              {/* Botón para abrir la foto en la misma página */}
              {urlFoto && (
                <button
                  type="button"
                  onClick={() => setImagenModalUrl(urlFoto)}
                  style={{
                    fontSize: "11px",
                    color: TEAL,
                    background: "none",
                    border: "none",
                    textDecoration: "underline",
                    fontWeight: "bold",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Ver foto adjunta
                </button>
              )}
            </Box>
          ) : (
            <Text fontSize="13px" color="#888">
              Pendiente
            </Text>
          )}
        </Table.Cell>
      </Table.Row>

      {/* MODAL / VENTANA FLOTANTE PARA VER LA FOTO EN LA MISMA PÁGINA */}
      {imagenModalUrl && (
        <Box
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
          }}
        >
          <Box
            style={{
              backgroundColor: "white",
              padding: "25px",
              borderRadius: "12px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
              maxWidth: "90%",
              maxHeight: "90%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "15px",
            }}
          >
            <img
              src={imagenModalUrl}
              alt="Evidencia fotográfica"
              style={{
                maxWidth: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                borderRadius: "8px",
              }}
            />
            <Button
              onClick={() => setImagenModalUrl(null)}
              style={{
                backgroundColor: TEAL,
                color: "white",
                padding: "8px 24px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Volver
            </Button>
          </Box>
        </Box>
      )}
    </>
  );
}