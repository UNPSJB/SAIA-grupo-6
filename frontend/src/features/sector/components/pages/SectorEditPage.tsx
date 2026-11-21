import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { Spinner, Stack, Text } from "@chakra-ui/react";
import { SectorForm } from "../SectorForm";
import { useSector } from "../../hooks/useSector";
import { useSectorABM } from "../../hooks/useSectorABM";
import type { Sector } from "../../types/sector";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { LuLayoutGrid } from "react-icons/lu";
import { PaginaAlta } from "../../../../components/ui/formularios";

export function SectorEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const sectorId = Number(id);

  const { sector, loading: cargando, error: errorCarga } = useSector(Number.isFinite(sectorId) ? sectorId : null);
  const { modificar, loading: guardando, error: errorGuardado } = useSectorABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: Omit<Sector, "id" | "activo">) => {
    try {
      await modificar(sectorId, values);
      setExito(true);
      delayedNavigate("/sectores");
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <PaginaAlta
      volver={{ a: "/sectores", etiqueta: "Sectores" }}
      icono={LuLayoutGrid}
      titulo="Editar sector"
      descripcion="Modificá los datos del sector."
    >
      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}
      {cargando && (
        <Stack direction="row" gap="3" align="center" color="fg.muted">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic">Cargando datos del sector...</Text>
        </Stack>
      )}

      {!cargando && !errorCarga && sector && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          <SectorForm
            key={sector.id}
            initialValues={{ nombre: sector.nombre, descripcion: sector.descripcion || "" }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/sectores")}
          />
        </>
      )}

      <DialogoExito isOpen={exito} mensaje="Sector modificado correctamente." />
    </PaginaAlta>
  );
}