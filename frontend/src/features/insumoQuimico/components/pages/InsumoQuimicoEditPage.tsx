import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { InsumoQuimicoForm } from "../InsumoQuimicoForm";
import { useInsumoQuimico } from "../../hooks/useInsumoQuimico";
import { useInsumoQuimicoABM } from "../../hooks/useInsumoQuimicoABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { InsumoQuimicoFormValues } from "../../types/insumoQuimico";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  PageHeader,
} from "../../../../components/ui/patrones";

export function InsumoQuimicoEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const insumoId = Number(id);

  const {
    insumoQuimico,
    loading: cargando,
    error: errorCarga,
  } = useInsumoQuimico(Number.isFinite(insumoId) ? insumoId : null);

  const {
    modificar,
    loading: guardando,
    error: errorGuardado,
  } = useInsumoQuimicoABM();

  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: InsumoQuimicoFormValues) => {
    try {
      await modificar(insumoId, values);
      setExito(true);

      delayedNavigate("/insumos-quimicos");
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box p="5" maxW="600px" mx="auto">
      <PageHeader
        title="Editar insumo químico"
        actions={
          <BotonVolver onClick={() => navigate("/insumos-quimicos")}>
            Volver a la lista
          </BotonVolver>
        }
      />

      {cargando && (
        <Stack direction="row" gap="3" align="center" color="fg.muted">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic" fontSize="sm">
            Cargando datos del insumo químico...
          </Text>
        </Stack>
      )}

      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}

      {!cargando && !errorCarga && insumoQuimico && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          <InsumoQuimicoForm
            key={insumoQuimico.id}
            initialValues={{
              nombre: insumoQuimico.nombre,
              tipo: insumoQuimico.tipo,
              unidad_medida_id: insumoQuimico.unidad_medida_id,
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar insumo químico"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/insumos-quimicos")}
          />
        </>
      )}

      <DialogoExito
        isOpen={exito}
        mensaje="Insumo químico modificado correctamente."
      />
    </Box>
  );
}
