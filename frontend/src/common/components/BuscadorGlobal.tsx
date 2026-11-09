import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, HStack, Input, Kbd, Spinner, Stack, Text } from "@chakra-ui/react";
import { LuArrowRight, LuSearch } from "react-icons/lu";
import type { IconType } from "react-icons/lib";
import { DialogBody, DialogContent, DialogRoot, DialogTitle } from "../../components/ui/dialog";
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
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <>
      <Button
        type="button"
        variant="outline"
        colorPalette="neutral"
        onClick={() => setAbierto(true)}
        aria-label="Buscar (Ctrl+K)"
        h="10"
        px={{ base: "2.5", md: "3" }}
        minW={{ base: "10", md: "260px" }}
        justifyContent="flex-start"
        color="fg.muted"
        fontWeight="normal"
        borderColor="border"
        bg="bg.subtle"
      >
        <LuSearch aria-hidden />
        <Box as="span" display={{ base: "none", md: "inline" }} flex="1" textAlign="left">
          Buscar lote, equipo, persona...
        </Box>
        <Kbd display={{ base: "none", md: "inline-flex" }} size="sm">
          Ctrl K
        </Kbd>
      </Button>

      <DialogRoot
        open={abierto}
        onOpenChange={(e) => (e.open ? setAbierto(true) : cerrar())}
        placement="top"
        initialFocusEl={() => inputRef.current}
      >
        <DialogContent maxW="640px" w="calc(100vw - 32px)" mt="16" rounded="lg">
          <DialogTitle srOnly>Buscar en SAIA</DialogTitle>
          <HStack px="4" py="3" borderBottomWidth="1px" borderColor="border.subtle" gap="3">
            <Box color="fg.muted" aria-hidden>
              <LuSearch />
            </Box>
            <Input
              ref={inputRef}
              variant="flushed"
              border="none"
              _focusVisible={{ boxShadow: "none" }}
              px="0"
              placeholder="Número de lote, equipo, persona, insumo, sección..."
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
                }
              }}
              aria-label="Buscar"
              aria-controls="resultados-busqueda"
            />
            {buscando && <Spinner size="sm" color="brand.500" />}
          </HStack>

          <DialogBody p="2" maxH="60vh" overflowY="auto" id="resultados-busqueda">
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
          </DialogBody>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
