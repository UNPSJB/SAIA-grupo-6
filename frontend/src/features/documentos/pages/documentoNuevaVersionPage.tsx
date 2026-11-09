import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spinner, Text } from "@chakra-ui/react";
import { DocumentoForm } from "../components/documentoForm";
import { useDocumento } from "../hooks/useDocumento";
import { useDocumentoABM } from "../hooks/useDocumentoABM";
import type { DocumentoFormValues } from "../types/documento";
import { useDelayedNavigate } from "../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  DialogoExito,
} from "../../../components/ui/patrones";
import { PaginaFormulario } from "../../../components/ui/plantillas";

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
      delayedNavigate("/documentos");
    } catch {
      // el error ya queda guardado en `error`
    }
  };

  const vigente = documento?.version_vigente;

  return (
    <PaginaFormulario
      volver={{ a: "/documentos", etiqueta: "Documentos" }}
      titulo={`Nueva versión${documento ? `: ${documento.nombre}` : ""}`}
      descripcion="La versión anterior queda archivada: no se borra ni se sobrescribe."
    >
      {cargando && <Spinner color="brand.500" />}
      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}

      {documento && (
        <>
          <Text mb="4" color="fg.muted" fontSize="sm">
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

          <DialogoExito isOpen={exito} mensaje="Nueva versión subida: ahora es la vigente." />

          <DocumentoForm
            conDatosDelDocumento={false}
            onSubmit={handleSubmit}
            isLoading={loading}
            title="Subir nueva versión"
            submitLabel="Subir versión"
            onCancel={() => navigate("/documentos")}
          />
        </>
      )}
    </PaginaFormulario>
  );
}