import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spinner, Stack, Text } from "@chakra-ui/react";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";
import { useCliente } from "../../hooks/useCliente";
import { useClienteABM } from "../../hooks/useClienteABM";
import type { Cliente } from "../../types/cliente";
import { ClienteForm } from "../ClienteForm";

export function ClienteEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const clienteId = Number(id);

  const { cliente, loading: cargando, error: errorCarga } = useCliente(
    Number.isFinite(clienteId) ? clienteId : null
  );
  const { modificar, loading: guardando, error: errorGuardado } = useClienteABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: Omit<Cliente, "id" | "activo">) => {
    try {
      await modificar(clienteId, values);
      setExito(true);
      delayedNavigate("/clientes");
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <PaginaFormulario
      volver={{ a: "/clientes", etiqueta: "Clientes" }}
      titulo="Editar cliente"
    >
      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}
      {cargando && (
        <Stack direction="row" gap="3" align="center" color="fg.muted">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic">Cargando datos del cliente...</Text>
        </Stack>
      )}

      {!cargando && !errorCarga && cliente && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          <ClienteForm
            key={cliente.id}
            initialValues={{
              nombre: cliente.nombre,
              documento: cliente.documento,
              telefono: cliente.telefono,
              email: cliente.email ?? "",
              domicilio: cliente.domicilio ?? "",
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar cliente"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/clientes")}
          />
        </>
      )}

      <DialogoExito isOpen={exito} mensaje="Cliente modificado correctamente." />
    </PaginaFormulario>
  );
}
