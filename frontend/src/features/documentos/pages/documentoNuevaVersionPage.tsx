import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Heading, HStack, Spinner, Text } from "@chakra-ui/react";
import { DocumentoForm } from "../components/documentoForm";
import { useDocumento } from "../hooks/useDocumento";
import { useDocumentoABM } from "../hooks/useDocumentoABM";
import type { DocumentoFormValues } from "../types/documento";
import { useDelayedNavigate } from "../../../common/hooks/useDelayedNavigate";
import { BannerError, BannerExito, BotonVolver } from "../../../components/ui/patrones";

export function DocumentoNuevaVersionPage() {
  const { id } = useParams();
  const documentoId = Number(id);
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();

  const { documento, loading: cargando, error: errorCarga } = useDocumento(documentoId);
  const { subirVersion, loading, error } = useDocumentoABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: DocumentoFormValues) => {
    try {
      await subirVersion(documentoId, values);
      setExito(true);
      delayedNavigate("/documentos", 1500);
    } catch {
      // el error ya queda guardado en `error`
    }
  };

  const vigente = documento?.version_vigente;

  return (
    <Box p="5" maxW="600px" mx="auto">
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          Nueva versión{documento ? `: ${documento.nombre}` : ""}
        </Heading>
        <BotonVolver onClick={() => navigate("/documentos")}>
          Volver a la lista
        </BotonVolver>
      </HStack>

      {cargando && <Spinner color="brand.500" />}
      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}

      {documento && (
        <>
          <Text mb="4" color="gray.600">
            Se va a crear la{" "}
            <Text as="span" fontWeight="bold">
              versión {documento.proximo_numero_version}
            </Text>{" "}
            y pasará a ser la{" "}
            <Text as="span" fontWeight="bold">
              vigente
            </Text>
            .
            {vigente
              ? ` La v${vigente.numero_version} quedará archivada (no se borra ni se sobrescribe).`
              : ""}
          </Text>

          {error && <BannerError>{error}</BannerError>}

          {exito && (
            <BannerExito>Nueva versión subida: ahora es la vigente.</BannerExito>
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