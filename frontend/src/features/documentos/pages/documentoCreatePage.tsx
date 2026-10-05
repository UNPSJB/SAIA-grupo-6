import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack } from "@chakra-ui/react";
import { DocumentoForm } from "../components/documentoForm";
import { useDocumentoABM } from "../hooks/useDocumentoABM";
import type { DocumentoFormValues } from "../types/documento";

export function DocumentoCreatePage() {
  const navigate = useNavigate();
  const { alta, loading, error } = useDocumentoABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: DocumentoFormValues) => {
    try {
      await alta(values);
      setExito(true);
      setTimeout(() => navigate("/documentos"), 1500);
    } catch {
      // el error ya queda guardado en `error` y se muestra abajo
    }
  };

  return (
    <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Nuevo documento
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
          ✅ Documento subido correctamente (versión 1, vigente).
        </Box>
      )}

      <DocumentoForm
        conDatosDelDocumento
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de documento"
        submitLabel="Subir documento"
      />
    </Box>
  );
}