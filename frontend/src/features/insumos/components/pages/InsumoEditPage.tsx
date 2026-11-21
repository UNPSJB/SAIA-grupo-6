import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spinner, Stack, Text } from "@chakra-ui/react";
import { InsumoForm } from "../../components/InsumoForm";
import { useInsumo } from "../../hooks/useInsumo";
import { useInsumoABM } from "../../hooks/useInsumoABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { InsumoInput } from "../../types/insumo";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { LuWheat } from "react-icons/lu";
import { PaginaAlta } from "../../../../components/ui/formularios";

export function InsumoEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const insumoId = Number(id);

  const {
    insumo,
    loading: cargando,
    error: errorCarga,
  } = useInsumo(Number.isFinite(insumoId) ? insumoId : null);
  const {
    modificar,
    loading: guardando,
    error: errorGuardado,
  } = useInsumoABM();

  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: InsumoInput) => {
    try {
      await modificar(insumoId, values);
      setExito(true);
      // Espera para que el usuario lea el cartel antes de volver al listado.
      delayedNavigate("/insumos");
    } catch {
      // El error ya queda reflejado en useInsumoABM().error
    }
  };

  return (
    <PaginaAlta
      volver={{ a: "/insumos", etiqueta: "Insumos" }}
      icono={LuWheat}
      titulo="Editar insumo"
      descripcion="Modificá la materia prima, su unidad de medida y su tipo."
    >
      {cargando && (
        <Stack direction="row" gap="3" align="center" color="fg.muted">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic" fontSize="sm">
            Cargando datos del insumo...
          </Text>
        </Stack>
      )}

      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}

      {!cargando && !errorCarga && insumo && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          <InsumoForm
            key={insumo.id}
            initialValues={{
              nombre: insumo.nombre,
              unidad_medida_id: insumo.unidad_medida_id,
              tipo: insumo.tipo,
              aditivo_id: insumo.aditivo_id,
              densidad_g_ml: String(insumo.densidad_g_ml ?? ""),
              peso_unitario_g: String(insumo.peso_unitario_g ?? ""),
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/insumos")}
          />
        </>
      )}

      <DialogoExito
        isOpen={exito}
        mensaje="Insumo modificado correctamente."
      />
    </PaginaAlta>
  );
}