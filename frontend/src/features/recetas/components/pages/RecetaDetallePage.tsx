import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Box, HStack, Table, Text } from "@chakra-ui/react";
import { LuCalculator, LuHistory, LuLock } from "react-icons/lu";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { useAuth } from "../../../../common/context/useAuth";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { formatoFechaHora } from "../../../../common/utils/fechas";
import { cantidadConUnidad } from "../../../../common/utils/numeros";
import {
  BannerError,
  BotonAccion,
  BotonAgregar,
  BotonCancelar,
  BotonVolver,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  FilaEncabezado,
  PageHeader,
  Tarjeta,
} from "../../../../components/ui/patrones";
import { useVersiones } from "../../hooks/useRecetas";
import { obtenerReceta, obtenerVersion } from "../../services/recetaService";
import { VersionDetalleView } from "../VersionDetalleView";

/**
 * E9 – Consultar receta vigente. Muestra por defecto la versión vigente; las
 * anteriores solo se ven con "Ver historial" y en solo lectura. Quien opera
 * la consulta sin poder modificarla.
 */
export function RecetaDetallePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const esAdmin = puedeAdministrar(user);
  const { id } = useParams<{ id: string }>();
  const recetaId = Number(id);

  const { registro: receta, loading, error } = useRegistro({
    cargar: obtenerReceta,
    id: Number.isFinite(recetaId) ? recetaId : null,
    etiqueta: "la receta",
  });
  const { versiones } = useVersiones(recetaId);
  const [verHistorial, setVerHistorial] = useState(false);
  const [elegida, setElegida] = useState<number | null>(null);

  const vigenteId = receta?.version_vigente?.id ?? null;
  const versionId = elegida ?? vigenteId;
  const { registro: version, loading: cargandoVersion, error: errorVersion } = useRegistro({
    cargar: obtenerVersion,
    id: versionId,
    etiqueta: "la versión",
  });
  const esVigente = versionId !== null && versionId === vigenteId;
  const numeroMostrado = versiones.find((v) => v.id === versionId)?.numero ?? version?.numero;

  const cerrarHistorial = () => {
    setVerHistorial(false);
    setElegida(null);
  };

  return (
    <Box p="5" maxW="960px" mx="auto">
      <PageHeader
        title={receta ? `Receta de ${receta.producto_nombre}` : "Receta"}
        description={
          esAdmin
            ? "Cada modificación crea una versión nueva. Las anteriores quedan en solo lectura y los lotes ya producidos siguen apuntando a la versión con la que se elaboraron."
            : "Versión vigente de la receta, para elaborar siempre con la fórmula correcta."
        }
        actions={
          <>
            <BotonVolver onClick={() => navigate("/recetas")}>Volver a la lista</BotonVolver>
            {receta?.version_vigente && (
              <BotonCancelar onClick={() => navigate(`/recetas/${receta.id}/escalar`)}>
                <LuCalculator aria-hidden />
                Escalar a mi lote
              </BotonCancelar>
            )}
            {esAdmin && receta && (
              <BotonAgregar onClick={() => navigate(`/recetas/${receta.id}/nueva-version`)}>
                Nueva versión
              </BotonAgregar>
            )}
          </>
        }
      />

      {loading && <EstadoCargando>Cargando receta...</EstadoCargando>}
      {error && <BannerError>{error}</BannerError>}

      {receta && (
        <Tarjeta p="6">
          <HStack justify="space-between" mb="6" flexWrap="wrap" gap="3">
            <HStack gap="3">
              <Text fontSize="lg" fontWeight="bold" color="fg">
                Versión {numeroMostrado ?? "-"}
              </Text>
              {esVigente ? (
                <Badge colorPalette="green" variant="subtle">
                  Vigente
                </Badge>
              ) : (
                <Badge colorPalette="orange" variant="subtle">
                  Anterior · solo lectura
                </Badge>
              )}
            </HStack>
            {verHistorial ? (
              <BotonCancelar size="sm" onClick={cerrarHistorial}>
                Volver a la versión vigente
              </BotonCancelar>
            ) : (
              <BotonCancelar size="sm" onClick={() => setVerHistorial(true)}>
                <LuHistory aria-hidden />
                Ver historial
              </BotonCancelar>
            )}
          </HStack>

          {verHistorial && (
            <Box mb="6">
              <Tarjeta overflowX="auto">
                <Table.Root variant="outline" w="100%" minW="560px" size="sm">
                  <Table.Header>
                    <FilaEncabezado>
                      <EncabezadoOscuro ancho="angosta">Versión</EncabezadoOscuro>
                      <EncabezadoOscuro>Creada el</EncabezadoOscuro>
                      <EncabezadoOscuro ancho="media">Rendimiento</EncabezadoOscuro>
                      <EncabezadoOscuro center ancho="angosta">Ver</EncabezadoOscuro>
                    </FilaEncabezado>
                  </Table.Header>
                  <Table.Body>
                    {[...versiones].reverse().map((v) => (
                      <Table.Row key={v.id} bg={v.id === versionId ? "bg.muted" : undefined}>
                        <Celda>
                          v{v.numero}
                          {v.id === vigenteId ? " (vigente)" : ""}
                        </Celda>
                        <Celda>{formatoFechaHora(v.creado_en)}</Celda>
                        <Celda>{cantidadConUnidad(v.rendimiento, v.unidad_medida.simbolo)}</Celda>
                        <Celda center>
                          <BotonAccion
                            accion="ver"
                            label={`Ver versión ${v.numero}`}
                            onClick={() => setElegida(v.id)}
                          />
                        </Celda>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Tarjeta>
            </Box>
          )}

          {!esVigente && versionId !== null && (
            <HStack
              gap="2"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.subtle"
              rounded="md"
              px="4"
              py="3"
              mb="6"
              fontSize="sm"
              color="fg.muted"
            >
              <LuLock aria-hidden />
              <Text as="span">Versión anterior: solo lectura. No se usa para lotes nuevos.</Text>
            </HStack>
          )}

          {!receta.version_vigente && (
            <Text color="fg.muted">La receta todavía no tiene versiones.</Text>
          )}
          {cargandoVersion && <EstadoCargando>Cargando versión...</EstadoCargando>}
          {errorVersion && <BannerError>{errorVersion}</BannerError>}
          {version && !cargandoVersion && <VersionDetalleView version={version} />}
        </Tarjeta>
      )}
    </Box>
  );
}
