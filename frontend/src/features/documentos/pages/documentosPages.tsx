import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, Button, HStack, Spinner, Table, Text } from "@chakra-ui/react";
import {
  BannerError,
  BotonAccion,
  BotonTexto,
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  PageHeader,
  Paginacion,
  Tarjeta,
  TextoTruncado,
} from "../../../components/ui/patrones";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EncabezadoOrdenable,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../components/ui/filtros";
import { useDocumentos } from "../hooks/useDocumentos";
import type { ColumnaOrdenDocumento } from "../services/documentoService";
import { useOrdenTabla } from "../../../common/hooks/useOrdenTabla";
import { useValorDebounced } from "../../../common/hooks/useValorDebounced";
import { abrirArchivo } from "../services/documentoService";
import { ESTADOS_DOCUMENTO, TIPOS_DOCUMENTO } from "../types/documento";
import type { EstadoDocumentoFiltro, TipoDocumento } from "../types/documento";
import { etiquetaTipo, fechaCorta } from "../utils/formato";

const PAGE_SIZE = 10;

const ETIQUETAS_ORDEN: Record<ColumnaOrdenDocumento, string> = {
  nombre: "Documento",
  tipo: "Tipo",
  estado: "Estado",
};

export function DocumentosPage() {
  const navigate = useNavigate();

  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);
  const [tipo, setTipo] = useState<TipoDocumento | "">("");
  const [estado, setEstado] = useState<EstadoDocumentoFiltro | "">("");
  const orden = useOrdenTabla<ColumnaOrdenDocumento, "nombre_asc">(
    "nombre_asc"
  );

  const {
    documentos,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
  } = useDocumentos(
    {
      buscar: busquedaAplicada,
      tipo,
      estado,
      orden: orden.orden,
    },
    PAGE_SIZE
  );

  const limpiarTodo = () => {
    setBusqueda("");
    setTipo("");
    setEstado("");
    orden.reiniciar();
  };

  const hayFiltros =
    busqueda.trim() !== "" ||
    tipo !== "" ||
    estado !== "" ||
    !orden.esPorDefecto;

  const chips = chipsDeFiltros([
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda,
      recortar: true,
      onQuitar: () => setBusqueda(""),
    },
    {
      clave: "tipo",
      etiqueta: "Tipo",
      valor: etiquetaTipo(tipo),
      onQuitar: () => setTipo(""),
    },
    {
      clave: "estado",
      etiqueta: "Estado",
      valor: ESTADOS_DOCUMENTO.find((e) => e.value === estado)?.label ?? estado,
      onQuitar: () => setEstado(""),
    },
    {
      clave: "orden",
      etiqueta: "Orden",
      valor:
        orden.columna !== null
          ? `${ETIQUETAS_ORDEN[orden.columna]} ${
              orden.direccion === "asc" ? "↑" : "↓"
            }`
          : "",
      visible: !orden.esPorDefecto && orden.columna !== null,
      onQuitar: orden.reiniciar,
    },
  ]);

  return (
    <Box p="5">
      <PageHeader
        title="Documentos"
        description="Manuales, procedimientos y registros del sistema de calidad."
        actions={
          <Button colorPalette="brand" onClick={() => navigate("/documentos/nuevo")}>
            + Agregar
          </Button>
        }
      />

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar por nombre o tipo..."
          />
        }
        filtros={
          <>
            <FiltroSelect
              label="Tipo"
              valor={tipo}
              onCambio={(valor) => setTipo(valor as TipoDocumento | "")}
              opciones={TIPOS_DOCUMENTO.map((t) => ({
                valor: t.value,
                etiqueta: t.label,
              }))}
              todos="Todos los tipos"
              minW="200px"
            />
            <FiltroSelect
              label="Estado"
              valor={estado}
              onCambio={(valor) =>
                setEstado(valor as EstadoDocumentoFiltro | "")
              }
              opciones={ESTADOS_DOCUMENTO.map((e) => ({
                valor: e.value,
                etiqueta: e.label,
              }))}
              todos="Todos los estados"
              minW="190px"
            />
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {loading && <Spinner color="brand.500" />}
      {!loading && error && <BannerError>{error}</BannerError>}

      {!loading && !error && documentos.length === 0 && (
        hayFiltros ? (
          <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
            No hay documentos que coincidan con los filtros aplicados.
          </EstadoVacioFiltrado>
        ) : (
          <Tarjeta p="6" textAlign="center">
            <Text color="fg.muted">Todavía no hay documentos cargados.</Text>
          </Tarjeta>
        )
      )}

      {!loading && !error && documentos.length > 0 && (
        <>
          <Tarjeta overflowX="auto">
            <Table.Root variant="outline" w="100%" minW="1080px">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOrdenable columna="nombre" orden={orden}>
                    Documento
                  </EncabezadoOrdenable>
                  <EncabezadoOrdenable columna="tipo" orden={orden} ancho="media">
                    Tipo
                  </EncabezadoOrdenable>
                  <EncabezadoOscuro ancho="media">Versión vigente</EncabezadoOscuro>
                  <EncabezadoOrdenable
                    columna="estado"
                    orden={orden}
                    ancho="media"
                  >
                    Estado
                  </EncabezadoOrdenable>
                  <EncabezadoOscuro ancho="media">Archivadas</EncabezadoOscuro>
                  <EncabezadoOscuro center ancho="accionesAnchas">
                    Acciones
                  </EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {documentos.map((doc) => {
                  const vigente = doc.version_vigente;
                  return (
                    <Table.Row key={doc.id}>
                      <Celda p="3">
                        <TextoTruncado texto={doc.nombre} />
                      </Celda>
                      <Celda p="3">{etiquetaTipo(doc.tipo)}</Celda>
                      <Celda p="3">
                        {vigente ? (
                          <>
                            <BotonTexto
                              onClick={() =>
                                abrirArchivo(vigente.archivo_url).catch(() =>
                                  alert("No se pudo abrir el documento"),
                                )
                              }
                            >
                              v{vigente.numero_version}
                            </BotonTexto>{" "}
                            <Text as="span" color="fg.muted" fontSize="xs">
                              (desde {fechaCorta(vigente.vigente_desde)})
                            </Text>
                          </>
                        ) : (
                          <Text as="span" color="fg.subtle">
                            Sin vigente
                          </Text>
                        )}
                      </Celda>
                      <Celda p="3">
                        {vigente ? (
                          <Badge
                            colorPalette={
                              vigente.estado === "vencido"
                                ? "red"
                                : "green"
                            }
                            rounded="full"
                            px="2"
                            py="1"
                            fontSize="xs"
                            fontWeight="bold"
                          >
                            {vigente.estado === "vencido" ? "Vencido" : "Vigente"}
                          </Badge>
                        ) : (
                          <Badge
                            colorPalette="gray"
                            rounded="full"
                            px="2"
                            py="1"
                            fontSize="xs"
                            fontWeight="bold"
                          >
                            Archivado
                          </Badge>
                        )}

                        {vigente?.fecha_vencimiento && (
                          <Text color="fg.muted" fontSize="xs" mt="1">
                            Vence: {fechaCorta(vigente.fecha_vencimiento)}
                          </Text>
                        )}
                      </Celda>
                      <Celda p="3">{doc.cantidad_archivadas}</Celda>
                      <Celda p="3" center>
                        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
                          <BotonAccion
                            accion="historial"
                            label="Ver historial de versiones"
                            onClick={() => navigate(`/documentos/${doc.id}/historial`)}
                          />
                          <BotonAccion
                            accion="subir"
                            label="Subir nueva versión"
                            onClick={() => navigate(`/documentos/${doc.id}/nueva-version`)}
                          />
                        </HStack>
                      </Celda>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </Tarjeta>

          {hayVariasPaginas && (
            <Paginacion
              count={total}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </Box>
  );
}
