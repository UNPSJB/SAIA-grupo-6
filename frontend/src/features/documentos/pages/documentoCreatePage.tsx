import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DocumentoForm } from "../components/documentoForm";
import { useDocumentoABM } from "../hooks/useDocumentoABM";
import type { DocumentoFormValues } from "../types/documento";
import { useDelayedNavigate } from "../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  DialogoExito,
} from "../../../components/ui/patrones";
import { LuFileText } from "react-icons/lu";
import { PaginaAlta } from "../../../components/ui/formularios";

export function DocumentoCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, loading, error } = useDocumentoABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: DocumentoFormValues) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/documentos");
    } catch {
      // el error ya queda guardado en `error` y se muestra abajo
    }
  };

  return (
    <PaginaAlta
      volver={{ a: "/documentos", etiqueta: "Documentos" }}
      icono={LuFileText}
      titulo="Nuevo documento"
      descripcion="Cargá un documento con su nombre y tipo; queda como versión 1 vigente."
    >
      {error && <BannerError>{error}</BannerError>}

      <DialogoExito isOpen={exito} mensaje="Documento subido correctamente (versión 1, vigente)." />

      <DocumentoForm
        conDatosDelDocumento
        onSubmit={handleSubmit}
        isLoading={loading}
        submitLabel="Subir documento"
        onCancel={() => navigate("/documentos")}
      />
    </PaginaAlta>
  );
}