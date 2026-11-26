import { useState } from "react";
import { Box, Button, ButtonGroup, Flex, HStack, SimpleGrid, Text } from "@chakra-ui/react";
import { LuShieldCheck } from "react-icons/lu";
import { MensajeError, Tarjeta } from "../../../components/ui/patrones";
import { PALETA_ZONA, contarPorNivel, type MatrizRiesgo } from "../types/matrizRiesgo";
import { TEMAS_AREA } from "../types/temasArea";
import { GrillaMatrizRiesgo } from "./GrillaMatrizRiesgo";
import { EncabezadoTarjeta } from "./TarjetaHoy";

const NIVELES = [
  { clave: "alto", etiqueta: "Alto" },
  { clave: "medio", etiqueta: "Medio" },
  { clave: "bajo", etiqueta: "Bajo" },
] as const;

type Vista = "estimado" | "logrado";

function Situaciones({ n }: { n: number }) {
  return <>{n === 1 ? "1 situación" : `${n} situaciones`}</>;
}

function Columna({
  titulo,
  bajada,
  matriz,
  contraste,
  resumen,
}: {
  titulo: string;
  bajada: string;
  matriz: MatrizRiesgo;
  contraste?: MatrizRiesgo;
  resumen: string;
}) {
  return (
    <Flex direction="column" h="13rem" minW="0">
      <Box mb="2">
        <Text fontSize="sm" fontWeight="semibold">
          {titulo}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {bajada}
        </Text>
      </Box>
      <GrillaMatrizRiesgo matriz={matriz} resumen={resumen} contraste={contraste} />
    </Flex>
  );
}

/** Cuántas situaciones hay de cada nivel, antes → después. */
function ResumenNiveles({ antes, despues }: { antes: MatrizRiesgo; despues: MatrizRiesgo }) {
  const a = contarPorNivel(antes);
  const d = contarPorNivel(despues);
  return (
    <HStack mt="4" gap="2" wrap="wrap">
      {NIVELES.map(({ clave, etiqueta }) => {
        const paleta = PALETA_ZONA[clave];
        return (
          <Box
            key={clave}
            px="3"
            py="1.5"
            rounded="md"
            bg={`${paleta}.subtle`}
            color={`${paleta}.fg`}
            borderWidth="1px"
            borderColor={`${paleta}.border`}
            fontSize="sm"
            title={`Riesgo ${etiqueta.toLowerCase()}: de ${a[clave]} a ${d[clave]}`}
          >
            <Text as="span" fontWeight="semibold">
              {etiqueta}
            </Text>{" "}
            <Text as="span" fontVariantNumeric="tabular-nums">
              {a[clave]} → {d[clave]}
            </Text>
          </Box>
        );
      })}
    </HStack>
  );
}

interface TarjetaImpactoPlanesProps {
  /** Riesgo real: todas las situaciones abiertas, con o sin plan. */
  real: MatrizRiesgo;
  /** Si los planes son eficaces: sin lo que un plan verificado controla ni lo
   *  que ya está en un plan activo. */
  proyectado: MatrizRiesgo;
  /** Hoy más lo que los planes corrigieron en los últimos 30 días. */
  sinPlanes: MatrizRiesgo;
  /** Cuántas situaciones corrigieron los planes en los últimos 30 días. */
  corregidas: number;
  cargando: boolean;
  error: string | null;
}

/**
 * Impacto de los planes de acción, en dos vistas de la misma matriz de riesgo:
 *
 * - "Si los planes son eficaces" (ESTIMADO): hoy contra hoy sin lo que ya está
 *   en un plan, en curso o verificado. Es el mejor caso: un plan en curso
 *   todavía puede no ser eficaz.
 * - "Lo que ya bajaron" (LOGRADO): cómo estaría hoy sin lo que los planes
 *   corrigieron en los últimos 30 días, contra hoy. Cada situación corregida
 *   vuelve a la celda que ocupaba con el último riesgo que se le midió.
 *
 * Las dos son cuentas sobre lo que calcula el motor: el riesgo real no se toca.
 */
export function TarjetaImpactoPlanes({
  real,
  proyectado,
  sinPlanes,
  corregidas,
  cargando,
  error,
}: TarjetaImpactoPlanesProps) {
  const tema = TEMAS_AREA.calidad;
  const [vista, setVista] = useState<Vista>("estimado");
  const controladas = real.controladas;
  const enCurso = real.enPlanActivo;
  const salen = controladas + enCurso;

  const bajada =
    cargando && real.total === 0
      ? "Cargando…"
      : vista === "estimado"
        ? salen === 0
          ? "Todavía ninguna situación abierta está en un plan"
          : `${salen} de ${real.total} situaciones abiertas están en un plan`
        : corregidas === 0
          ? "Ningún plan corrigió situaciones en los últimos 30 días"
          : `Los planes corrigieron ${corregidas} ${corregidas === 1 ? "situación" : "situaciones"} en los últimos 30 días`;

  return (
    <Tarjeta p={{ base: "4", md: "5" }}>
      <Flex justify="space-between" align="flex-start" gap="3" wrap="wrap">
        <EncabezadoTarjeta
          icono={LuShieldCheck}
          fondoIcono={tema.fondo[1]}
          colorIcono={tema.acento}
          titulo="Impacto de los planes de acción"
          bajada={bajada}
        />
        <ButtonGroup size="xs" attached variant="outline" colorPalette="brand" role="group" aria-label="Qué comparar">
          <Button
            variant={vista === "estimado" ? "solid" : "outline"}
            aria-pressed={vista === "estimado"}
            onClick={() => setVista("estimado")}
          >
            Si los planes son eficaces
          </Button>
          <Button
            variant={vista === "logrado" ? "solid" : "outline"}
            aria-pressed={vista === "logrado"}
            onClick={() => setVista("logrado")}
          >
            Lo que ya bajaron (30 días)
          </Button>
        </ButtonGroup>
      </Flex>

      {error ? (
        <MensajeError>{error}</MensajeError>
      ) : vista === "estimado" ? (
        real.total === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            No hay situaciones abiertas con puntaje para comparar.
          </Text>
        ) : (
          <>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={{ base: "5", md: "8" }}>
              <Columna
                titulo="Hoy"
                bajada="Riesgo real, tal como lo calcula el motor"
                matriz={real}
                resumen={`Riesgo real: ${real.total} situaciones abiertas, repartidas por impacto y probabilidad.`}
              />
              <Columna
                titulo="Si los planes son eficaces"
                bajada="Estimado: sin lo que ya está en un plan, en curso o verificado"
                matriz={proyectado}
                contraste={real}
                resumen={`Estimado si los planes son eficaces: ${proyectado.total} situaciones abiertas, ${salen} menos que hoy.`}
              />
            </SimpleGrid>
            <ResumenNiveles antes={real} despues={proyectado} />
            <Text mt="3" fontSize="xs" color="fg.muted">
              {salen === 0 ? (
                <>Cuando se armen planes, acá se ve cuánto bajaría el riesgo si resultan eficaces. </>
              ) : (
                <>
                  Salen <Situaciones n={enCurso} /> por planes en curso
                  {controladas > 0 ? (
                    <>
                      {" "}y <Situaciones n={controladas} /> por planes ya verificados
                    </>
                  ) : null}
                  . Es el mejor caso: un plan en curso todavía puede no ser eficaz.{" "}
                </>
              )}
              El riesgo real no se modifica.
            </Text>
          </>
        )
      ) : corregidas === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          Cuando un plan corrija situaciones, acá se ve en qué celdas estaban y cuánto bajó el riesgo.
          Se cuenta lo verificado en los últimos 30 días.
        </Text>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={{ base: "5", md: "8" }}>
            <Columna
              titulo="Sin los planes"
              bajada="Hoy, más lo que los planes corrigieron en 30 días"
              matriz={sinPlanes}
              resumen={`Sin los planes: ${sinPlanes.total} situaciones, ${corregidas} más que hoy.`}
            />
            <Columna
              titulo="Hoy"
              bajada="Riesgo real, tal como lo calcula el motor"
              matriz={real}
              contraste={sinPlanes}
              resumen={`Riesgo real hoy: ${real.total} situaciones abiertas, ${corregidas} menos gracias a los planes.`}
            />
          </SimpleGrid>
          <ResumenNiveles antes={sinPlanes} despues={real} />
          <Text mt="3" fontSize="xs" color="fg.muted">
            Los planes corrigieron <Situaciones n={corregidas} /> en los últimos 30 días: ya no se
            detectan. Cada una vuelve a la celda que ocupaba con el último riesgo que se le midió. No
            cuenta lo que después resultó no eficaz ni lo de planes cancelados.
          </Text>
        </>
      )}
    </Tarjeta>
  );
}
