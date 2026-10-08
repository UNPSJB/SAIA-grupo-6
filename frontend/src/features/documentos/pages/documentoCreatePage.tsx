import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box } from "@chakra-ui/react";
import { DocumentoForm } from "../components/documentoForm";
import { useDocumentoABM } from "../hooks/useDocumentoABM";
import type { DocumentoFormValues } from "../types/documento";
import { useDelayedNavigate } from "../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  BannerExito,
  BotonVolver,
  PageHeader,
} from "../../../components/ui/patrones";

export function DocumentoCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, loading, error } = useDocumentoABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: DocumentoFormValues) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/documentos", 1500);
    } catch {
      // el error ya queda guardado en `error` y se muestra abajo
    }
  };

  return (
    <Box p="5" maxW="600px" mx="auto">
      <PageHeader
        title="Nuevo documento"
        description="Cargá un documento con su nombre y tipo; queda como versión 1 vigente."
        actions={
          <BotonVolver onClick={() => navigate("/documentos")}>
            Volver a la lista
          </BotonVolver>
        }
      />

      {error && <BannerError>{error}</BannerError>}

      {exito && (
        <BannerExito>Documento subido correctamente (versión 1, vigente).</BannerExito>
      )}

      <DocumentoForm
        conDatosDelDocumento
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de documento"
        submitLabel="Subir documento"
        onCancel={() => navigate("/documentos")}
      />
    </Box>
  );
}