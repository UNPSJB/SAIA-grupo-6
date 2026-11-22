import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ElementoLimpiezaForm } from "../../components/ElementoLimpiezaForm";
import { useElementoLimpieza } from "../../hooks/useElementoLimpieza";
import { useElementoLimpiezaABM } from "../../hooks/useElementoLimpiezaABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { ElementoLimpiezaFormValues } from "../../types/elementoLimpieza";
import {
  BannerError,
  DialogoExito,
  EstadoCargando,
} from "../../../../components/ui/patrones";
import { LuSprayCan } from "react-icons/lu";
import { PaginaAlta } from "../../../../components/ui/formularios";

export function ElementoLimpiezaEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const elementoId = Number(id);

  const {
    elementoLimpieza,
    loading: cargando,
    error: errorCarga,
  } = useElementoLimpieza(Number.isFinite(elementoId) ? elementoId : null);

  const {
    modificar,
    loading: guardando,
    error: errorGuardado,
  } = useElementoLimpiezaABM();

  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: ElementoLimpiezaFormValues) => {
    try {
      await modificar(elementoId, values);
      setExito(true);
      // Espera 2 segundos para que el usuario vea el mensaje antes de redirigir
      delayedNavigate("/elementos-limpieza");
    } catch {
      // El error queda reflejado en useElementoLimpiezaABM().error
    }
  };

  return (
    <PaginaAlta
      volver={{ a: "/elementos-limpieza", etiqueta: "Elementos de limpieza" }}
      icono={LuSprayCan}
      titulo="Editar elemento de limpieza"
      descripcion="Modificá el elemento y cada cuánto se recambia."
    >
      {cargando && (
        <EstadoCargando>
          Cargando datos del elemento de limpieza...
        </EstadoCargando>
      )}

      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}

      {!cargando && !errorCarga && elementoLimpieza && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          <ElementoLimpiezaForm
            key={elementoLimpieza.id}
            initialValues={{
              nombre: elementoLimpieza.nombre,
              fecha_ultimo_recambio: elementoLimpieza.fecha_ultimo_recambio,
              frecuencia_recambio_dias:
                elementoLimpieza.frecuencia_recambio_dias,
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/elementos-limpieza")}
          />
        </>
      )}

      <DialogoExito
        isOpen={exito}
        mensaje="Elemento modificado correctamente."
      />
    </PaginaAlta>
  );
}