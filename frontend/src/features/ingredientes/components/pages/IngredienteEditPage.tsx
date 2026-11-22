import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spinner, Stack, Text } from "@chakra-ui/react";
import { IngredienteForm } from "../../components/IngredienteForm";
import { useIngrediente } from "../../hooks/useIngrediente";
import { useIngredienteABM } from "../../hooks/useIngredienteABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { IngredienteInput } from "../../types/ingrediente";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { LuWheat } from "react-icons/lu";
import { PaginaAlta } from "../../../../components/ui/formularios";
import { InsumosDelIngrediente } from "../../../insumos/components/InsumosDelIngrediente";
import { AlergenosDelIngrediente } from "../../../alergenos/components/AlergenosDelIngrediente";

export function IngredienteEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const ingredienteId = Number(id);

  const {
    ingrediente,
    loading: cargando,
    error: errorCarga,
  } = useIngrediente(Number.isFinite(ingredienteId) ? ingredienteId : null);
  const {
    modificar,
    loading: guardando,
    error: errorGuardado,
  } = useIngredienteABM();

  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: IngredienteInput) => {
    try {
      await modificar(ingredienteId, values);
      setExito(true);
      // Espera para que el usuario lea el cartel antes de volver al listado.
      delayedNavigate("/ingredientes");
    } catch {
      // El error ya queda reflejado en useIngredienteABM().error
    }
  };

  return (
    <PaginaAlta
      volver={{ a: "/ingredientes", etiqueta: "Ingredientes" }}
      icono={LuWheat}
      titulo="Editar ingrediente"
      descripcion="Modificá la materia prima, su unidad de medida y si es un aditivo."
    >
      {cargando && (
        <Stack direction="row" gap="3" align="center" color="fg.muted">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic" fontSize="sm">
            Cargando datos del ingrediente...
          </Text>
        </Stack>
      )}

      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}

      {!cargando && !errorCarga && ingrediente && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          <IngredienteForm
            key={ingrediente.id}
            initialValues={{
              nombre: ingrediente.nombre,
              unidad_medida_id: ingrediente.unidad_medida_id,
              es_aditivo: ingrediente.es_aditivo,
              clase_funcional_id: ingrediente.clase_funcional_id,
              numero_ins: ingrediente.numero_ins ?? "",
              densidad_g_ml: String(ingrediente.densidad_g_ml ?? ""),
              peso_unitario_g: String(ingrediente.peso_unitario_g ?? ""),
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/ingredientes")}
          />

          <AlergenosDelIngrediente ingredienteId={ingrediente.id} />

          <InsumosDelIngrediente ingredienteId={ingrediente.id} ingrediente={ingrediente.nombre} />
        </>
      )}

      <DialogoExito
        isOpen={exito}
        mensaje="Ingrediente modificado correctamente."
      />
    </PaginaAlta>
  );
}