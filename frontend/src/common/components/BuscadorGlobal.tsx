import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, HStack, Input, Spinner, Stack, Text } from "@chakra-ui/react";
import { LuArrowRight, LuSearch } from "react-icons/lu";
import type { IconType } from "react-icons/lib";
import { useAuth } from "../context/useAuth";
import { puedeAdministrar, puedeOperar } from "../api/permissions";
import { useValorDebounced } from "../hooks/useValorDebounced";
import { TODAS_LAS_ENTRADAS, esVisibleEntrada } from "./menuEntradas";
import { listarLotes } from "../../features/lotes/services/loteService";
import { listarRecetas } from "../../features/recetas/services/recetaService";
import { listarEquiposPaginados } from "../../features/equipo/services/equipoService";
import { listarPersonal } from "../../features/personal/services/personalService";
import { listarInsumos } from "../../features/insumos/services/insumoService";
import { listarProveedores } from "../../features/proveedores/services/proveedorService";
import { listarIncidentesPaginados } from "../../features/incidente/services/incidenteService";

interface Resultado {
  clave: string;
  grupo: string;
  titulo: string;
  detalle?: string;
  destino: string;
  icono?: IconType;
}

const POR_GRUPO = 5;

function contiene(texto: string | null | undefined, consulta: string) {
  return (texto ?? "").toLocaleLowerCase("es").includes(consulta);
}

/**
 * Busca en paralelo en lo que el usuario puede ver. Lotes y recetas se filtran
 * acá (el backend los devuelve completos); el resto usa el `buscar` del
 * backend. Si una fuente falla, las otras se muestran igual.
 */
async function buscar(consulta: string, esAdmin: boolean, esOperador: boolean): Promise<Resultado[]> {
  const q = consulta.toLocaleLowerCase("es");
  const tareas: Promise<Resultado[]>[] = [];

  if (esOperador) {
    tareas.push(
      listarLotes().then((lotes) =>
        lotes
          .filter((l) => contiene(l.numero_lote, q) || contiene(l.producto_nombre, q))
          .slice(0, POR_GRUPO)
          .map((l) => ({
            clave: `lote-${l.id}`,
            grupo: "Lotes de producción",
            titulo: l.numero_lote,
            detalle: l.producto_nombre,
            destino: `/lotes/${l.id}`,
          })),
      ),
      listarRecetas().then((recetas) =>
        recetas
          .filter((r) => contiene(r.producto_nombre, q))
          .slice(0, POR_GRUPO)
          .map((r) => ({
            clave: `receta-${r.id}`,
            grupo: "Recetas",
            titulo: r.producto_nombre,
            detalle: r.version_vigente ? `Versión ${r.version_vigente.numero}` : "Sin versiones",
            destino: `/recetas/${r.id}`,
          })),
      ),
    );
  }

  if (esAdmin) {
    tareas.push(
      listarEquiposPaginados(1, POR_GRUPO, { buscar: consulta }).then((p) =>
        p.items.map((e) => ({
          clave: `equipo-${e.id}`,
          grupo: "Equipos",
          titulo: e.nombre,
          detalle: `${e.tipo} · ${e.sector.nombre}`,
          destino: `/equipos/detalle/${e.id}`,
        })),
      ),
      listarPersonal(1, POR_GRUPO, { buscar: consulta }).then((p) =>
        p.items.map((persona) => ({
          clave: `persona-${persona.id}`,
          grupo: "Personal",
          titulo: `${persona.nombre} ${persona.apellido ?? ""}`.trim(),
          detalle: `DNI ${persona.dni}`,
          destino: `/personal/detalle/${persona.id}`,
        })),
      ),
      listarInsumos(1, POR_GRUPO, { buscar: consulta }).then((p) =>
        p.items.map((i) => ({
          clave: `insumo-${i.id}`,
          grupo: "Insumos",
          titulo: i.nombre,
          detalle: i.unidad_medida?.nombre,
          destino: `/insumos/${i.id}/editar`,
        })),
      ),
      listarProveedores(false, consulta).then((lista) =>
        lista.slice(0, POR_GRUPO).map((p) => ({
          clave: `proveedor-${p.id}`,
          grupo: "Proveedores",
          titulo: p.nombre,
          detalle: `Matrícula ${p.matricula}`,
          destino: `/proveedores/${p.id}/editar`,
        })),
      ),
      listarIncidentesPaginados(1, POR_GRUPO, { buscar: consulta }).then((p) =>
        p.items.map((i) => ({
          clave: `incidente-${i.id}`,
          grupo: "Incidentes",
          titulo: i.titulo,
          detalle: `#${i.id} · ${i.estado === "cerrado" ? "Cerrado" : "Abierto"}`,
          destino: `/incidentes/${i.id}`,
        })),
      ),
    );
  }

  const respuestas = await Promise.allSettled(tareas);
  return respuestas.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

/**
 * Buscador de la barra superior (también con Ctrl+K / ⌘K).
 *
 * Con ~30 secciones, ir por el menú a buscar un lote o un equipo lleva varios
 * clics. Acá se escribe el número de lote, el nombre de un equipo o de una
 * persona y se salta directo a la ficha. También encuentra secciones del menú
 * ("stock", "vencimientos"). Flechas para moverse, Enter para abrir.
 *
 * En la barra es solo la lupa: al hacer clic se despliega el campo de texto
 * en el mismo lugar y los resultados caen debajo. Se cierra con Escape, al
 * hacer clic afuera o al elegir un resultado.
 */
export function BuscadorGlobal(): ReactElement | null {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [seleccion, setSeleccion] = useState(0);
  const aplicada = useValorDebounced(consulta.trim(), 250);
  const pedido = useRef(0);
  const contenedorRef = useRef<HTMLDivElement>(null);

  const esAdmin = puedeAdministrar(user);
  const esOperador = puedeOperar(user);

  // Atajo de teclado global.
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto(true);
      }
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, []);

  // Secciones del menú que coinciden: no necesitan backend.
  const secciones = useMemo<Resultado[]>(() => {
    const q = aplicada.toLocaleLowerCase("es");
    if (q.length < 2) return [];
    return TODAS_LAS_ENTRADAS.filter((e) => esVisibleEntrada(e, user) && contiene(e.label, q))
      .slice(0, POR_GRUPO)
      .map((e) => ({
        clave: `seccion-${e.to}`,
        grupo: "Ir a",
        titulo: e.label,
        destino: e.to,
        icono: e.icon,
      }));
  }, [aplicada, user]);

  useEffect(() => {
    if (aplicada.length < 2) return;
    const numero = ++pedido.current;
    let vigente = true;
    // El setState va diferido, igual que en `useLista`, para no setear estado
    // de forma síncrona dentro del efecto.
    const inicio = setTimeout(() => setBuscando(true), 0);
    buscar(aplicada, esAdmin, esOperador)
      .then((lista) => {
        if (vigente && numero === pedido.current) {
          setResultados(lista);
          setSeleccion(0);
        }
      })
      .finally(() => {
        if (vigente && numero === pedido.current) setBuscando(false);
      });
    return () => {
      vigente = false;
      clearTimeout(inicio);
    };
  }, [aplicada, esAdmin, esOperador]);

  // Clic fuera del buscador: se pliega.
  useEffect(() => {
    if (!abierto) return;
    const alApretar = (e: MouseEvent) => {
      if (!contenedorRef.current?.contains(e.target as Node)) {
        setAbierto(false);
        setConsulta("");
        setResultados([]);
        setSeleccion(0);
      }
    };
    document.addEventListener("mousedown", alApretar);
    return () => document.removeEventListener("mousedown", alApretar);
  }, [abierto]);

  const todos = aplicada.length < 2 ? [] : [...secciones, ...resultados];

  const cerrar = () => {
    setAbierto(false);
    setConsulta("");
    setResultados([]);
    setSeleccion(0);
  };

  const ir = (r: Resultado) => {
    cerrar();
    navigate(r.destino);
  };

  if (!user) return null;

  // Agrupado conservando el orden de llegada.
  const grupos: { nombre: string; items: { r: Resultado; indice: number }[] }[] = [];
  todos.forEach((r, indice) => {
    let g = grupos.find((x) => x.nombre === r.grupo);
    if (!g) {
      g = { nombre: r.grupo, items: [] };
      grupos.push(g);
    }
    g.items.push({ r, indice });
  });

  const hayTexto = consulta.trim().length > 0;

  return (
    <Box
      ref={contenedorRef}
      position="relative"
      flexShrink={0}
      h="10"
      // Plegado mide lo que la lupa. Desplegado, en escritorio crece en el
      // lugar (empuja el menú); en celular no hay espacio, así que el campo
      // se dibuja por encima de la barra (ver `position` más abajo).
      w={abierto ? { base: "10", md: "300px" } : "10"}
      transition="width 0.18s ease"
      onBlur={(e) => {
        // Salir con Tab también lo pliega.
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) cerrar();
      }}
    >
      {!abierto ? (
        <Button
          type="button"
          variant="outline"
          colorPalette="neutral"
          onClick={() => setAbierto(true)}
          aria-label="Buscar (Ctrl+K)"
          title="Buscar (Ctrl+K)"
          aria-expanded={false}
          boxSize="10"
          minW="10"
          p="0"
          color="white"
          borderColor="whiteAlpha.500"
          bg="whiteAlpha.200"
          _hover={{ bg: "whiteAlpha.300" }}
          _focusVisible={{ outline: "2px solid", outlineColor: "white", outlineOffset: "2px" }}
        >
          <LuSearch aria-hidden />
        </Button>
      ) : (
        <HStack
          role="search"
          position={{ base: "absolute", md: "static" }}
          right="0"
          top="0"
          zIndex="dropdown"
          w={{ base: "min(260px, calc(100vw - 130px))", md: "full" }}
          h="10"
          px="3"
          gap="2"
          bg="white"
          color="fg"
          rounded="md"
          borderWidth="1px"
          borderColor="white"
        >
          <Box color="fg.muted" flexShrink={0} aria-hidden>
            <LuSearch />
          </Box>
          <Input
            autoFocus
            variant="flushed"
            border="none"
            _focusVisible={{ boxShadow: "none" }}
            h="full"
            px="0"
            fontSize="sm"
            placeholder="Buscar lote, equipo, persona..."
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSeleccion((s) => Math.min(s + 1, Math.max(todos.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSeleccion((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && todos[seleccion]) {
                e.preventDefault();
                ir(todos[seleccion]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                cerrar();
              }
            }}
            aria-label="Buscar en SAIA"
            aria-controls="resultados-busqueda"
          />
          {buscando && <Spinner size="sm" color="brand.500" flexShrink={0} />}
        </HStack>
      )}

      {abierto && hayTexto && (
        <Box
          id="resultados-busqueda"
          // En celular ocupa el ancho de la pantalla, debajo de la barra.
          position={{ base: "fixed", md: "absolute" }}
          top={{ base: "68px", md: "calc(100% + 8px)" }}
          left={{ base: "3", md: "auto" }}
          right={{ base: "3", md: "0" }}
          w={{ base: "auto", md: "440px" }}
          maxH="70vh"
          overflowY="auto"
          zIndex="dropdown"
          p="2"
          bg="bg.panel"
          color="fg"
          rounded="lg"
          borderWidth="1px"
          borderColor="border.subtle"
          boxShadow="lg"
          // Que el clic en un resultado no le saque el foco al campo.
          onMouseDown={(e) => e.preventDefault()}
        >
          {aplicada.length < 2 && (
            <Text fontSize="sm" color="fg.muted" p="3">
              Escribí al menos 2 letras. Por ejemplo, un número de lote ("LP-2026"), un equipo
              ("heladera") o una sección ("stock").
            </Text>
          )}
          {aplicada.length >= 2 && !buscando && todos.length === 0 && (
            <Text fontSize="sm" color="fg.muted" p="3">
              No se encontró nada para "{aplicada}".
            </Text>
          )}
          {grupos.map((g) => (
            <Box key={g.nombre} mb="2">
              <Text fontSize="xs" fontWeight="semibold" color="fg.subtle" px="3" pt="2" pb="1">
                {g.nombre}
              </Text>
              <Stack gap="0" role="listbox" aria-label={g.nombre}>
                {g.items.map(({ r, indice }) => {
                  const activo = indice === seleccion;
                  const Icono = r.icono;
                  return (
                    <HStack
                      key={r.clave}
                      role="option"
                      aria-selected={activo}
                      as="button"
                      textAlign="left"
                      w="100%"
                      gap="3"
                      px="3"
                      py="2.5"
                      rounded="md"
                      bg={activo ? "brand.50" : "transparent"}
                      _hover={{ bg: "brand.50" }}
                      cursor="pointer"
                      onMouseEnter={() => setSeleccion(indice)}
                      onClick={() => ir(r)}
                    >
                      {Icono && (
                        <Box color="fg.muted" aria-hidden>
                          <Icono />
                        </Box>
                      )}
                      <Box flex="1" minW="0">
                        <Text fontSize="sm" fontWeight="medium" color="fg" lineClamp={1}>
                          {r.titulo}
                        </Text>
                        {r.detalle && (
                          <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                            {r.detalle}
                          </Text>
                        )}
                      </Box>
                      {activo && (
                        <Box color="brand.fg" aria-hidden>
                          <LuArrowRight />
                        </Box>
                      )}
                    </HStack>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
