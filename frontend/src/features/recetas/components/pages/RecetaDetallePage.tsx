import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Box, HStack, Table, Text } from "@chakra-ui/react";
import { LuCalculator, LuHistory } from "react-icons/lu";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { useAuth } from "../../../../common/context/useAuth";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { formatoFechaHora } from "../../../../common/utils/fechas";
import { cantidadConUnidad } from "../../../../common/utils/numeros";
import { AvisoSoloLectura, PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";
import {
  BannerError,
  BotonAccion,
  BotonAgregar,
  BotonCancelar,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  FilaEncabezado,
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
  // Mientras se cargan las versiones de otra receta, `versiones` todavía
  // tiene las de la anterior: no se ofrece el historial hasta que lleguen.
  const { versiones, loading: cargandoVersiones } = useVersiones(recetaId);
  const [verHistorial, setVerHistorial] = useState(false);
  const [elegida, setElegida] = useState<number | null>(null);

  /*
   * Al pasar de una receta a otra (enlace "Receta usada" de un lote, atrás /
   * adelante del navegador) React reusa este componente: sin esto, el
   * historial abierto y la versión elegida de la receta anterior seguían
   * aplicándose a la nueva. Se ajusta el estado durante el render, el patrón
   * que React documenta para "resetear al cambiar una prop".
   */
  const [recetaMostrada, setRecetaMostrada] = useState(recetaId);
  if (recetaMostrada !== recetaId) {
    setRecetaMostrada(recetaId);
    setVerHistorial(false);
    setElegida(null);
  }

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
    <PaginaDetalle
      volver={{ a: "/recetas", etiqueta: "Recetas" }}
      titulo={receta ? `Receta de ${receta.producto_nombre}` : "Receta"}
      descripcion={
        esAdmin
          ? "Cada modificación crea una versión nueva. Las anteriores quedan en solo lectura y los lotes ya producidos siguen apuntando a la versión con la que se elaboraron."
          : "Versión vigente de la receta, para elaborar siempre con la fórmula correcta."
      }
      acciones={
          <>
            {receta?.version_vigente && (
              <BotonCancelar onClick={() => navigate(`/lotes/nuevo?receta=${receta.id}`)}>
                <LuCalculator aria-hidden />
                Escalar e iniciar lote
              </BotonCancelar>
            )}
            {esAdmin && receta && (
              <BotonAgregar onClick={() => navigate(`/recetas/${receta.id}/nueva-version`)}>
                Nueva versión
              </BotonAgregar>
            )}
          </>
      }
    >
      {loading && <EstadoCargando>Cargando receta...</EstadoCargando>}
      {error && <BannerError>{error}</BannerError>}

      {receta && (
        <SeccionDetalle
          titulo={
            <HStack as="span" gap="3">
              Versión {numeroMostrado ?? "-"}
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
          }
          /*
           * Con una sola versión no hay historial que ver: antes el botón
           * abría una tabla con una única fila (la vigente) y parecía que las
           * versiones anteriores no se estaban mostrando.
           */
          acciones={
            verHistorial ? (
              <BotonCancelar size="sm" onClick={cerrarHistorial}>
                Volver a la versión vigente
              </BotonCancelar>
            ) : cargandoVersiones ? undefined : versiones.length > 1 ? (
              <BotonCancelar size="sm" onClick={() => setVerHistorial(true)}>
                <LuHistory aria-hidden />
                Ver historial ({versiones.length} versiones)
              </BotonCancelar>
            ) : versiones.length === 1 ? (
              <Text fontSize="sm" color="fg.muted">
                Única versión: todavía no se modificó
              </Text>
            ) : undefined
          }
        >

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
            <AvisoSoloLectura>Versión anterior: solo lectura. No se usa para lotes nuevos.</AvisoSoloLectura>
          )}

          {!receta.version_vigente && (
            <Text color="fg.muted">La receta todavía no tiene versiones.</Text>
          )}
          {cargandoVersion && <EstadoCargando>Cargando versión...</EstadoCargando>}
          {errorVersion && <BannerError>{errorVersion}</BannerError>}
          {version && !cargandoVersion && <VersionDetalleView version={version} />}
        </SeccionDetalle>
      )}
    </PaginaDetalle>
  );
}
