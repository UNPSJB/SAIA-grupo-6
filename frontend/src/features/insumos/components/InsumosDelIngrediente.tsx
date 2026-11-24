import { avisarExito } from "../../../components/ui/patrones";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { ConfirmDialog } from "../../../common/components/ConfirmDialog";
import {
  BannerError,
  BotonAgregar,
  BotonFila,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EtiquetaEstado,
  FilaEncabezado,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";
import { useLista } from "../../../common/hooks/useLista";
import { formatoFecha } from "../../../common/utils/fechas";
import { useProveedores } from "../../proveedores/hooks/useProveedores";
import { crearInsumo, darDeBajaInsumo, listarInsumos, modificarInsumo } from "../services/insumoService";
import { ETIQUETA_ESTADO_HOMOLOGACION, TONO_ESTADO_HOMOLOGACION, type Insumo } from "../types/insumo";
import { InsumoDialog, type DatosInsumoDialog } from "./InsumoDialog";

/**
 * Insumos (marcas) de un ingrediente, en su ficha.
 *
 * La receta y la tabla nutricional usan el ingrediente; lo que se recibe en
 * Stock de insumos es una de estas marcas, de alguno de sus proveedores.
 */
export function InsumosDelIngrediente({ ingredienteId, ingrediente }: { ingredienteId: number; ingrediente: string }) {
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [editando, setEditando] = useState<Insumo | "nuevo" | null>(null);
  const [aBaja, setABaja] = useState<Insumo | null>(null);
  const [procesando, setProcesando] = useState(false);
  const navigate = useNavigate();
  const { proveedores } = useProveedores(false);

  const cargarInsumos = useCallback(() => listarInsumos({ ingredienteId }), [ingredienteId]);
  const {
    items: insumos,
    loading: cargando,
    error: errorCarga,
    recargar: cargar,
  } = useLista<Insumo[]>({
    cargar: cargarInsumos,
    dependencias: [ingredienteId],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los insumos.",
  });
  const error = errorAccion ?? errorCarga;

  const guardar = async (datos: DatosInsumoDialog) => {
    if (editando === "nuevo") {
      await crearInsumo({ ingrediente_id: ingredienteId, ...datos });
    } else if (editando) {
      await modificarInsumo(editando.id, datos);
    }
    avisarExito(editando === "nuevo" ? "Insumo agregado correctamente." : "Insumo modificado correctamente.");
    setEditando(null);
    await cargar();
  };

  const confirmarBaja = async () => {
    if (!aBaja) return;
    setProcesando(true);
    try {
      await darDeBajaInsumo(aBaja.id);
      avisarExito("Insumo dado de baja correctamente.");
      setABaja(null);
      await cargar();
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : "No se pudo dar de baja el insumo.");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <TarjetaFormulario mt="6" mb="0">
      <HStack justify="space-between" align="flex-start" gap="4" flexWrap="wrap" mb="4">
        <Box>
          <TituloFormulario mb="1">Insumos (marcas que se compran)</TituloFormulario>
          <Text fontSize="sm" color="fg.muted">
            Cada lote que se recibe es de una de estas marcas y de uno de sus proveedores. Solo se reciben
            y consumen lotes de las marcas con la homologación aprobada y vigente (su rótulo comparado con este
            ingrediente).
          </Text>
        </Box>
        <BotonAgregar onClick={() => setEditando("nuevo")}>Nuevo insumo</BotonAgregar>
      </HStack>

      {error && <BannerError mb="4">{error}</BannerError>}
      {cargando && <EstadoCargando>Cargando insumos...</EstadoCargando>}

      {!cargando && insumos.length === 0 && (
        <Text fontSize="sm" color="fg.muted">
          Todavía no hay insumos. Cargá al menos uno para poder recibir lotes de este ingrediente.
        </Text>
      )}

      {!cargando && insumos.length > 0 && (
        <Box overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="720px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Marca</EncabezadoOscuro>
                <EncabezadoOscuro>Proveedores</EncabezadoOscuro>
                <EncabezadoOscuro center width="170px">Homologación</EncabezadoOscuro>
                <EncabezadoOscuro center width="300px">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {insumos.map((insumo) => (
                <Table.Row key={insumo.id}>
                  <Celda>
                    <Stack gap="0">
                      <Text fontWeight="medium">{insumo.nombre}</Text>
                      {insumo.codigo_fabricante && (
                        <Text fontSize="xs" color="fg.muted">Código {insumo.codigo_fabricante}</Text>
                      )}
                    </Stack>
                  </Celda>
                  <Celda>
                    {insumo.proveedores.length
                      ? insumo.proveedores.map((p) => p.nombre).join(", ")
                      : <Text as="span" color="fg.muted">Sin proveedores</Text>}
                  </Celda>
                  <Celda center>
                    <Stack gap="1" align="center">
                      {insumo.homologacion_vencida ? (
                        <EtiquetaEstado tono="peligro">Vencida</EtiquetaEstado>
                      ) : (
                        <EtiquetaEstado tono={TONO_ESTADO_HOMOLOGACION[insumo.estado_homologacion]}>
                          {ETIQUETA_ESTADO_HOMOLOGACION[insumo.estado_homologacion]}
                        </EtiquetaEstado>
                      )}
                      {insumo.homologacion_vigente_hasta && (
                        <Text fontSize="xs" color="fg.muted">
                          {insumo.homologacion_vencida ? "venció el" : "hasta el"}{" "}
                          {formatoFecha(insumo.homologacion_vigente_hasta)}
                        </Text>
                      )}
                    </Stack>
                  </Celda>
                  <Celda center>
                    <HStack justify="center" gap="2">
                      <BotonFila onClick={() => navigate(`/insumos/${insumo.id}/homologacion`)}>
                        Homologar
                      </BotonFila>
                      <BotonFila onClick={() => setEditando(insumo)}>Modificar</BotonFila>
                      <BotonFila onClick={() => setABaja(insumo)}>Dar de baja</BotonFila>
                    </HStack>
                  </Celda>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}

      {editando && (
        <InsumoDialog
          insumo={editando === "nuevo" ? undefined : editando}
          ingrediente={ingrediente}
          proveedores={proveedores}
          onGuardar={guardar}
          onCancel={() => setEditando(null)}
        />
      )}

      <ConfirmDialog
        isOpen={aBaja !== null}
        titulo={`Dar de baja ${aBaja?.nombre ?? ""}`}
        mensaje="Ya no se van a poder recibir lotes de esta marca. Los lotes recibidos se conservan."
        textoConfirmar="Dar de baja"
        isLoading={procesando}
        onConfirm={confirmarBaja}
        onCancel={() => setABaja(null)}
      />
    </TarjetaFormulario>
  );
}
