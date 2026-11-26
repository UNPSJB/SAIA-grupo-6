import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, HStack, Table, Text } from "@chakra-ui/react";
import { useAuth } from "../../../../common/context/useAuth";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { TarjetaImpactoPlanes } from "../../../dashboard/components/TarjetaImpactoPlanes";
import { useMatrizRiesgo } from "../../../dashboard/hooks/useMatrizRiesgo";
import { usePlanes } from "../../hooks/usePlanes";
import { EtiquetaEstadoPlan, EtiquetaVencido } from "../EtiquetasPlan";
import { ESTADOS_PLAN, estadoPlanLabel, type EstadoPlan, type GrupoPlan } from "../../types/planAccion";
import { formatoFecha } from "../../../../common/utils/fechas";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import {
  BannerError,
  BotonAgregar,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  FilaClickeable,
  FilaEncabezado,
  Paginacion,
  Tarjeta,
  TextoTruncado,
} from "../../../../components/ui/patrones";
import { Pagina } from "../../../../components/ui/plantillas";

const PAGE_SIZE = 10;

const GRUPOS: { valor: GrupoPlan; etiqueta: string }[] = [
  { valor: "activos", etiqueta: "En curso" },
  { valor: "finalizados", etiqueta: "Cerrados y cancelados" },
];

export function PlanesAccionListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // El impacto sale de la criticidad de Notificaciones, que es solo de administración.
  const veImpacto = puedeAdministrar(user);
  const {
    real,
    proyectado,
    sinPlanes,
    corregidas,
    loading: cargandoImpacto,
    error: errorImpacto,
  } = useMatrizRiesgo(veImpacto, { conCorregidas: true });

  // Lo que importa a diario es lo que está en curso.
  const [grupo, setGrupo] = useState<GrupoPlan | "">("activos");
  const [estado, setEstado] = useState("");
  const [soloVencidos, setSoloVencidos] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const { planes, total, page, setPage, hayVariasPaginas, loading, error } = usePlanes(
    { grupo, estado, vencidos: soloVencidos, buscar: busqueda },
    PAGE_SIZE,
  );

  const hayFiltros = estado !== "" || soloVencidos || busqueda.trim() !== "" || grupo !== "activos";

  const limpiarTodo = () => {
    setGrupo("activos");
    setEstado("");
    setSoloVencidos(false);
    setBusqueda("");
  };

  const chips = chipsDeFiltros([
    { clave: "busqueda", etiqueta: "Búsqueda", valor: busqueda, recortar: true, onQuitar: () => setBusqueda("") },
    {
      clave: "grupo",
      etiqueta: "Mostrar",
      valor: GRUPOS.find((g) => g.valor === grupo)?.etiqueta ?? "Todos",
      // "En curso" es el filtro de apertura: no cuenta como aplicado.
      visible: grupo !== "activos",
      onQuitar: () => setGrupo("activos"),
    },
    {
      clave: "estado",
      etiqueta: "Estado",
      valor: estado ? estadoPlanLabel(estado as EstadoPlan) : "",
      onQuitar: () => setEstado(""),
    },
    {
      clave: "vencidos",
      etiqueta: "Plazo",
      valor: soloVencidos ? "Vencidos" : "",
      onQuitar: () => setSoloVencidos(false),
    },
  ]);

  return (
    <Pagina
      titulo="Planes de acción"
      descripcion="Tratamiento de las situaciones de riesgo: qué se hace, quién lo hace y si funcionó."
      acciones={
        <BotonAgregar onClick={() => navigate("/planes-accion/nuevo")}>Nuevo plan</BotonAgregar>
      }
    >
      {veImpacto && (
        <TarjetaImpactoPlanes
          real={real}
          proyectado={proyectado}
          sinPlanes={sinPlanes}
          corregidas={corregidas}
          cargando={cargandoImpacto}
          error={errorImpacto}
        />
      )}

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar por objetivo, causa o número..."
          />
        }
        filtros={
          <>
            <FiltroSelect
              label="Mostrar"
              valor={grupo}
              onCambio={(valor) => {
                setGrupo(valor as GrupoPlan | "");
                setEstado("");
              }}
              opciones={GRUPOS.map((g) => ({ valor: g.valor, etiqueta: g.etiqueta }))}
              todos="Todos los planes"
            />
            <FiltroSelect
              label="Estado"
              valor={estado}
              onCambio={setEstado}
              opciones={ESTADOS_PLAN.map((e) => ({ valor: e.value, etiqueta: e.label }))}
              todos="Todos los estados"
            />
            <Box minW="160px">
              <Text fontSize="sm" fontWeight="medium" color="fg.muted" mb="1">
                Plazo
              </Text>
              <HStack
                as="label"
                gap="2"
                h="10"
                px="3"
                borderWidth="2px"
                borderColor="brand.300"
                rounded="lg"
                bg="bg.panel"
                cursor="pointer"
                fontSize="sm"
              >
                <input
                  type="checkbox"
                  checked={soloVencidos}
                  onChange={(e) => setSoloVencidos(e.target.checked)}
                />
                Solo vencidos
              </HStack>
            </Box>
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {loading && <EstadoCargando pagina>Cargando planes...</EstadoCargando>}
      {!loading && error && <BannerError>{error}</BannerError>}

      {!loading && !error && (
        <>
          {planes.length === 0 ? (
            hayFiltros ? (
              <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
                No hay planes que coincidan con los filtros aplicados.
              </EstadoVacioFiltrado>
            ) : (
              <Tarjeta p="8" textAlign="center">
                <Text color="fg.muted">
                  No hay planes en curso. Podés crear uno desde una situación del centro de
                  notificaciones o con “Nuevo plan”.
                </Text>
              </Tarjeta>
            )
          ) : (
            <Tarjeta overflowX="auto">
              <Table.Root variant="outline" w="100%" minW="900px">
                <Table.Header>
                  <FilaEncabezado>
                    <EncabezadoOscuro width="70px">N.º</EncabezadoOscuro>
                    <EncabezadoOscuro>Plan</EncabezadoOscuro>
                    <EncabezadoOscuro width="210px">Estado</EncabezadoOscuro>
                    <EncabezadoOscuro width="170px">Responsable</EncabezadoOscuro>
                    <EncabezadoOscuro center width="110px">Acciones</EncabezadoOscuro>
                    <EncabezadoOscuro center width="110px">Situaciones</EncabezadoOscuro>
                    <EncabezadoOscuro width="120px">Plazo</EncabezadoOscuro>
                  </FilaEncabezado>
                </Table.Header>
                <Table.Body>
                  {planes.map((plan) => (
                    <FilaClickeable
                      key={plan.id}
                      onAbrir={() => navigate(`/planes-accion/${plan.id}`)}
                    >
                      <Celda fontWeight="semibold">#{plan.id}</Celda>
                      <Celda>
                        <TextoTruncado texto={plan.objetivo} max={110} fontWeight="medium" />
                        <Text fontSize="xs" color="fg.muted" mt="0.5">
                          {plan.tipo_etiqueta}
                          {plan.plan_anterior_id ? ` · continúa el plan #${plan.plan_anterior_id}` : ""}
                        </Text>
                      </Celda>
                      <Celda>
                        <HStack gap="2" flexWrap="wrap">
                          <EtiquetaEstadoPlan estado={plan.estado} />
                          {plan.vencido && <EtiquetaVencido />}
                        </HStack>
                      </Celda>
                      <Celda>{plan.responsable_nombre}</Celda>
                      <Celda center>
                        {plan.acciones_completadas}/{plan.acciones_total}
                      </Celda>
                      <Celda center>{plan.situaciones_total}</Celda>
                      <Celda whiteSpace="nowrap">{formatoFecha(plan.plazo)}</Celda>
                    </FilaClickeable>
                  ))}
                </Table.Body>
              </Table.Root>
            </Tarjeta>
          )}

          {hayVariasPaginas && (
            <Paginacion count={total} pageSize={PAGE_SIZE} page={page} onPageChange={setPage} />
          )}
        </>
      )}
    </Pagina>
  );
}
