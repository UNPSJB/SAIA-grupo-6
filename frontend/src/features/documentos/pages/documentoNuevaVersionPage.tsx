import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Heading, HStack, Spinner, Text } from "@chakra-ui/react";
import { DocumentoForm } from "../components/documentoForm";
import { useDocumento } from "../hooks/useDocumento";
import { useDocumentoABM } from "../hooks/useDocumentoABM";
import type { DocumentoFormValues } from "../types/documento";

export function DocumentoNuevaVersionPage() {
  const { id } = useParams();
  const documentoId = Number(id);
  const navigate = useNavigate();

  const { documento, loading: cargando, error: errorCarga } = useDocumento(documentoId);
  const { subirVersion, loading, error } = useDocumentoABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: DocumentoFormValues) => {
    try {
      await subirVersion(documentoId, values);
      setExito(true);
      setTimeout(() => navigate("/documentos"), 1500);
    } catch {
      // el error ya queda guardado en `error`
    }
  };

  const vigente = documento?.version_vigente;

  return (
    <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Nueva versión{documento ? `: ${documento.nombre}` : ""}
        </Heading>
        <Button
          bg="#6c757d"
          color="white"
          fontSize="16px"
          fontWeight="normal"
          height="auto"
          minW="auto"
          style={{ border: "none", padding: "8px 16px", borderRadius: "6px" }}
          _hover={{ bg: "#6c757d" }}
          onClick={() => navigate("/documentos")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {cargando && <Spinner />}
      {!cargando && errorCarga && <Text color="red.500">{errorCarga}</Text>}

      {documento && (
        <>
          <Text style={{ marginBottom: "16px", color: "#555" }}>
            Se va a crear la <b>versión {documento.proximo_numero_version}</b> y pasará a ser la{" "}
            <b>vigente</b>.
            {vigente
              ? ` La v${vigente.numero_version} quedará archivada (no se borra ni se sobrescribe).`
              : ""}
          </Text>

          {error && (
            <Box
              style={{
                backgroundColor: "#f8d7da",
                color: "#721c24",
                padding: "12px",
                borderRadius: "6px",
                marginBottom: "20px",
                border: "1px solid #f5c6cb",
                fontWeight: "bold",
              }}
            >
              ⚠️ {error}
            </Box>
          )}

          {exito && (
            <Box
              style={{
                backgroundColor: "#d4edda",
                color: "#155724",
                padding: "12px",
                borderRadius: "6px",
                marginBottom: "20px",
                border: "1px solid #c3e6cb",
                fontWeight: "bold",
              }}
            >
              ✅ Nueva versión subida: ahora es la vigente.
            </Box>
          )}

          <DocumentoForm
            conDatosDelDocumento={false}
            onSubmit={handleSubmit}
            isLoading={loading}
            title="Subir nueva versión"
            submitLabel="Subir versión"
          />
        </>
      )}
    </Box>
  );
}