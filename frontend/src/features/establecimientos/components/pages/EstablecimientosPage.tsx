import { useCallback, useState } from "react";
import { HStack, Table, Text } from "@chakra-ui/react";
import { useLista } from "../../../../common/hooks/useLista";
import { useAuth } from "../../../../common/context/useAuth";
import { esSuperAdmin } from "../../../../common/api/permissions";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { BarraFiltros } from "../../../../components/ui/filtros";
import { Pagina } from "../../../../components/ui/plantillas";
import {
  avisarExito,
  BannerError,
  BotonAccion,
  BotonAgregar,
  Celda,
  DatoPrincipal,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  PildoraNeutra,
  Tarjeta,
  ToggleInactivos,
} from "../../../../components/ui/patrones";
import {
  crearEstablecimiento,
  listarEstablecimientos,
  modificarEstablecimiento,
} from "../../services/establecimientoService";
import type { Establecimiento } from "../../types/establecimiento";
import { EstablecimientoDialog } from "../EstablecimientoDialog";
import { useEstadoNavegacion } from "../../../../common/hooks/useEstadoNavegacion";

/** La sede que existía antes del multiestablecimiento: no se da de baja. */
const ID_PRINCIPAL = 1;

/**
 * Sedes de producción de la empresa. Solo el super admin (que es de la
 * empresa, no de una sede) las da de alta, las modifica y las da de baja.
 * Para cargar el gerente de una sede: elegirla en Configuración → Sede de
 * trabajo y darlo de alta desde Personal.
 */
export function EstablecimientosPage() {
  const { user } = useAuth();
  const [verBajas, setVerBajas] = useEstadoNavegacion("EstablecimientosPage.verBajas", false);
  const [editando, setEditando] = useState<Establecimiento | "nuevo" | null>(null);
  const [aDarDeBaja, setADarDeBaja] = useState<Establecimiento | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const cargar = useCallback(() => listarEstablecimientos(verBajas), [verBajas]);
  const { items: todos, loading, error, recargar } = useLista<Establecimiento[]>({
    cargar,
    dependencias: [verBajas],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los establecimientos",
  });
  // "Ver dados de baja": solo los dados de baja (como en el resto de los listados).
  const establecimientos = todos.filter((e) => (verBajas ? !e.activo : e.activo));

  if (!esSuperAdmin(user)) {
    return (
      <Pagina titulo="Establecimientos">
        <BannerError>Solo un super administrador puede administrar los establecimientos.</BannerError>
      </Pagina>
    );
  }

  const cambiarEstado = async (establecimiento: Establecimiento, activo: boolean) => {
    setErrorAccion(null);
    setProcesando(true);
    try {
      await modificarEstablecimiento(establecimiento.id, { activo });
      avisarExito(activo ? "Establecimiento reactivado." : "Establecimiento dado de baja.");
      setADarDeBaja(null);
      await recargar();
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "No se pudo completar la acción.");
      setADarDeBaja(null);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Pagina
      titulo={verBajas ? "Establecimientos dados de baja" : "Establecimientos"}
      descripcion="Sedes de producción de la empresa. Cada una tiene sus propios datos, su personal y su gerente."
      acciones={<BotonAgregar onClick={() => setEditando("nuevo")}>Nuevo establecimiento</BotonAgregar>}
    >
      <BarraFiltros
        herramientas={
          <ToggleInactivos enBarra checked={verBajas} onChange={setVerBajas}>
            Ver dados de baja
          </ToggleInactivos>
        }
      />
      <Text fontSize="sm" color="fg.muted" mb="4" maxW="720px">
        Para cargar el gerente u otro personal de una sede, elegila en Configuración → Sede de
        trabajo y dalo de alta desde Personal.
      </Text>

      {error && <BannerError>{error}</BannerError>}
      {errorAccion && <BannerError>{errorAccion}</BannerError>}
      {loading && <EstadoCargando>Cargando establecimientos...</EstadoCargando>}

      {!loading && !error && establecimientos.length === 0 && (
        <EstadoVacio>No hay establecimientos.</EstadoVacio>
      )}

      {!loading && !error && establecimientos.length > 0 && (
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="560px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Establecimiento</EncabezadoOscuro>
                <EncabezadoOscuro>Dirección</EncabezadoOscuro>
                <EncabezadoOscuro center>Personal activo</EncabezadoOscuro>
                <EncabezadoOscuro center ancho="acciones">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {establecimientos.map((e) => (
                <Table.Row key={e.id} opacity={e.activo ? 1 : 0.65}>
                  <Celda>
                    <DatoPrincipal titulo={e.nombre} />
                  </Celda>
                  <Celda color={e.direccion ? undefined : "fg.muted"}>{e.direccion || "Sin dirección"}</Celda>
                  <Celda center>
                    <PildoraNeutra>{e.personal_activo}</PildoraNeutra>
                  </Celda>
                  <Celda center>
                    <HStack justify="center" gap="2">
                      {e.activo ? (
                        <>
                          <BotonAccion accion="editar" label="Modificar" onClick={() => setEditando(e)} />
                          {e.id !== ID_PRINCIPAL && (
                            <BotonAccion accion="eliminar" label="Dar de baja" onClick={() => setADarDeBaja(e)} />
                          )}
                        </>
                      ) : (
                        <BotonAccion accion="reactivar" label="Reactivar" onClick={() => cambiarEstado(e, true)} />
                      )}
                    </HStack>
                  </Celda>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      )}

      {editando && (
        <EstablecimientoDialog
          establecimiento={editando === "nuevo" ? undefined : editando}
          onCancel={() => setEditando(null)}
          onGuardar={async (datos) => {
            if (editando === "nuevo") await crearEstablecimiento(datos);
            else await modificarEstablecimiento(editando.id, datos);
            avisarExito(
              editando === "nuevo"
                ? "Establecimiento creado. Elegilo en la barra superior para cargar su gerente."
                : "Establecimiento modificado.",
            );
            setEditando(null);
            await recargar();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={aDarDeBaja !== null}
        titulo={`¿Dar de baja "${aDarDeBaja?.nombre ?? ""}"?`}
        mensaje="Su personal no va a poder trabajar en el sistema mientras esté dado de baja. Los datos no se borran y se puede reactivar."
        textoConfirmar="Dar de baja"
        isLoading={procesando}
        onConfirm={() => aDarDeBaja && cambiarEstado(aDarDeBaja, false)}
        onCancel={() => !procesando && setADarDeBaja(null)}
      />
    </Pagina>
  );
}
