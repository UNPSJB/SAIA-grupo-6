import {
  Children,
  Fragment,
  isValidElement,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Box, Button, Input, Stack, Text } from "@chakra-ui/react";
import { LuChevronDown, LuSearch } from "react-icons/lu";
import { DialogContent, DialogRoot, DialogTitle } from "./dialog";

/*
 * Selector con búsqueda para listas largas.
 *
 * `FormNativeSelect` lo usa solo cuando sus <option> son muchas: en vez del
 * desplegable nativo (una lista de 40 ingredientes que hay que recorrer a
 * ojo), muestra un botón con el mismo aspecto que abre un popup con la lista
 * ordenada alfabéticamente y un buscador. Las pantallas no cambian: siguen
 * pasando sus <option> y su `onChange(e)` recibe `e.target.value` como antes.
 */

/** A partir de cuántas opciones (sin contar el placeholder) se usa el popup. */
export const UMBRAL_SELECT_BUSCABLE = 12;

export interface OpcionSelect {
  valor: string;
  etiqueta: string;
  grupo?: string;
  deshabilitada: boolean;
}

function texto(nodo: ReactNode): string {
  if (nodo === null || nodo === undefined || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(texto).join("");
  if (isValidElement<{ children?: ReactNode }>(nodo)) return texto(nodo.props.children);
  return "";
}

/**
 * Las opciones de los hijos de un <select>, o `null` si hay algo que no se
 * sabe leer (entonces se queda el select nativo, que siempre funciona).
 */
export function leerOpciones(children: ReactNode, grupo?: string): OpcionSelect[] | null {
  const opciones: OpcionSelect[] = [];
  let entendible = true;
  Children.forEach(children, (hijo) => {
    if (!entendible || hijo === null || hijo === undefined || typeof hijo === "boolean") return;
    if (!isValidElement(hijo)) {
      entendible = false;
      return;
    }
    const elemento = hijo as ReactElement<{
      value?: string | number;
      disabled?: boolean;
      label?: string;
      children?: ReactNode;
    }>;
    if (elemento.type === Fragment) {
      const internas = leerOpciones(elemento.props.children, grupo);
      if (internas === null) entendible = false;
      else opciones.push(...internas);
      return;
    }
    if (elemento.type === "optgroup") {
      const internas = leerOpciones(elemento.props.children, elemento.props.label ?? grupo);
      if (internas === null) entendible = false;
      else opciones.push(...internas);
      return;
    }
    if (elemento.type === "option") {
      const etiqueta = texto(elemento.props.children);
      opciones.push({
        valor: String(elemento.props.value ?? etiqueta),
        etiqueta,
        grupo,
        deshabilitada: Boolean(elemento.props.disabled),
      });
      return;
    }
    // Un componente que envuelve una <option> deshabilitada (SelectPlaceholder):
    // es el texto que se muestra mientras no hay nada elegido.
    if (typeof elemento.type === "function") {
      opciones.push({
        valor: String(elemento.props.value ?? 0),
        etiqueta: texto(elemento.props.children),
        grupo,
        deshabilitada: true,
      });
      return;
    }
    entendible = false;
  });
  return entendible ? opciones : null;
}

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface SelectBuscableProps {
  opciones: OpcionSelect[];
  value?: string | number | readonly string[];
  onChange?: (evento: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  name?: string;
  ariaLabel?: string;
  w?: unknown;
  maxW?: unknown;
  minW?: unknown;
  mt?: unknown;
  mb?: unknown;
}

export function SelectBuscable({
  opciones,
  value,
  onChange,
  disabled,
  invalid,
  id,
  name,
  ariaLabel,
  ...caja
}: SelectBuscableProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resaltada, setResaltada] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);

  const actual = value === undefined || value === null ? "" : String(value);
  const elegida = opciones.find((o) => o.valor === actual);

  // La opción vacía ("Todos los ingredientes") va siempre primera; el resto,
  // por orden alfabético dentro de su grupo, y los grupos en su orden original.
  const { vacia, ordenadas } = useMemo(() => {
    const vacia = opciones.find((o) => o.valor === "" && !o.deshabilitada) ?? null;
    const grupos: string[] = [];
    for (const o of opciones) if (!grupos.includes(o.grupo ?? "")) grupos.push(o.grupo ?? "");
    const ordenadas = opciones
      .filter((o) => !o.deshabilitada && o !== vacia)
      .sort(
        (a, b) =>
          grupos.indexOf(a.grupo ?? "") - grupos.indexOf(b.grupo ?? "") ||
          a.etiqueta.localeCompare(b.etiqueta, "es", { sensitivity: "base" }),
      );
    return { vacia, ordenadas };
  }, [opciones]);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const filtradas = q ? ordenadas.filter((o) => normalizar(o.etiqueta).includes(q)) : ordenadas;
    return vacia && !q ? [vacia, ...filtradas] : filtradas;
  }, [busqueda, ordenadas, vacia]);

  const abrir = () => {
    if (disabled) return;
    setBusqueda("");
    setResaltada(Math.max(0, visiblesIniciales()));
    setAbierto(true);
  };
  // Al abrir, queda resaltada la opción elegida.
  const visiblesIniciales = () => {
    const lista = vacia ? [vacia, ...ordenadas] : ordenadas;
    return lista.findIndex((o) => o.valor === actual);
  };

  const elegir = (opcion: OpcionSelect) => {
    setAbierto(false);
    if (opcion.valor === actual) return;
    // Las pantallas leen `e.target.value`, como con el select nativo.
    const evento = { target: { value: opcion.valor, name }, currentTarget: { value: opcion.valor, name } };
    onChange?.(evento as unknown as ChangeEvent<HTMLSelectElement>);
  };

  const mover = (delta: number) => {
    setResaltada((i) => {
      const siguiente = Math.min(Math.max(i + delta, 0), visibles.length - 1);
      listaRef.current?.querySelector<HTMLElement>(`[data-indice="${siguiente}"]`)?.scrollIntoView({ block: "nearest" });
      return siguiente;
    });
  };

  const teclado = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      mover(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      mover(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opcion = visibles[resaltada];
      if (opcion) elegir(opcion);
    }
  };

  const titulo = ariaLabel || (vacia?.etiqueta ?? "Elegí una opción");
  const textoBoton = elegida?.etiqueta || opciones.find((o) => o.deshabilitada)?.etiqueta || "Seleccioná una opción";

  return (
    <Box w={(caja.w as string) ?? "100%"} maxW={caja.maxW as string} minW={caja.minW as string} mt={caja.mt as string} mb={caja.mb as string}>
      <Button
        type="button"
        id={id}
        name={name}
        aria-label={ariaLabel ? `${ariaLabel}: ${textoBoton}` : undefined}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={abrir}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            abrir();
          }
        }}
        variant="outline"
        w="100%"
        h="10"
        px="3"
        justifyContent="space-between"
        fontWeight="normal"
        fontSize="sm"
        bg="bg.panel"
        color={elegida ? "fg" : "fg.muted"}
        borderWidth="2px"
        borderColor={invalid ? "red.500" : "brand.300"}
        borderRadius="lg"
        _hover={!disabled ? { borderColor: "brand.400", bg: "bg.panel" } : undefined}
        _focusVisible={{ borderColor: "brand.500", boxShadow: "0 0 0 3px var(--chakra-colors-brand-300)" }}
        _disabled={{ opacity: 0.6, cursor: "not-allowed" }}
      >
        <Text as="span" truncate minW="0">
          {textoBoton}
        </Text>
        <LuChevronDown aria-hidden style={{ flexShrink: 0 }} />
      </Button>

      {abierto && (
        <DialogRoot
          open
          placement="center"
          motionPreset="none"
          onOpenChange={(d) => {
            if (!d.open) setAbierto(false);
          }}
        >
          <DialogContent bg="bg.panel" p="5" rounded="lg" boxShadow="dialog" width="420px" maxW="calc(100vw - 32px)">
            <DialogTitle as="h3" mt={0} mb="3" fontSize="md" fontWeight="bold" color="fg">
              {titulo}
            </DialogTitle>
            <Box position="relative" mb="3">
              <Box position="absolute" left="3" top="50%" transform="translateY(-50%)" color="fg.muted" pointerEvents="none">
                <LuSearch size={16} aria-hidden />
              </Box>
              <Input
                autoFocus
                ps="9"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setResaltada(0);
                }}
                onKeyDown={teclado}
                placeholder="Buscar..."
                aria-label="Buscar en la lista"
                role="combobox"
                aria-expanded
                aria-controls="lista-select-buscable"
                aria-activedescendant={visibles[resaltada] ? `opcion-select-${resaltada}` : undefined}
              />
            </Box>
            <Box
              ref={listaRef}
              id="lista-select-buscable"
              role="listbox"
              aria-label={titulo}
              maxH="min(60vh, 420px)"
              overflowY="auto"
              mx="-1"
            >
              {visibles.length === 0 ? (
                <Text fontSize="sm" color="fg.muted" px="2" py="3">
                  No hay coincidencias.
                </Text>
              ) : (
                <Stack gap="0">
                  {visibles.map((opcion, i) => {
                    const encabezado =
                      opcion.grupo && opcion.grupo !== visibles[i - 1]?.grupo ? opcion.grupo : null;
                    const esElegida = opcion.valor === actual;
                    return (
                      <Fragment key={`${opcion.grupo ?? ""}|${opcion.valor}`}>
                        {encabezado && (
                          <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" px="3" pt="3" pb="1">
                            {encabezado}
                          </Text>
                        )}
                        <Box
                          as="div"
                          id={`opcion-select-${i}`}
                          data-indice={i}
                          role="option"
                          aria-selected={esElegida}
                          px="3"
                          py="2"
                          mx="1"
                          rounded="md"
                          fontSize="sm"
                          cursor="pointer"
                          fontWeight={esElegida ? "semibold" : "normal"}
                          color={opcion.valor === "" ? "fg.muted" : "fg"}
                          bg={i === resaltada ? "brand.subtle" : undefined}
                          onMouseEnter={() => setResaltada(i)}
                          onClick={() => elegir(opcion)}
                        >
                          {opcion.etiqueta}
                        </Box>
                      </Fragment>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </DialogContent>
        </DialogRoot>
      )}
    </Box>
  );
}
