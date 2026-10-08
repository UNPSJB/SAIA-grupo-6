import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Field,
  HStack,
  IconButton,
  Image,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import {
  LuCalendarClock,
  LuCheck,
  LuChevronDown,
  LuChevronUp,
  LuLock,
  LuPaperclip,
  LuRefreshCw,
  LuX,
} from "react-icons/lu";
import { useChecklist } from "../../hooks/useChecklist";
import type { TareaDelDia, HistorialRegistroTareaItem } from "../../types/checklist";
import { obtenerHistorialRegistro } from "../../services/checklistService";
import { listarOpcionesInsumosQuimicos } from "../../../insumoQuimico/services/insumoQuimicoService";
import type { InsumoQuimicoOpcion } from "../../../insumoQuimico/types/insumoQuimico";
import { listarOpcionesElementosLimpieza } from "../../../elementoLimpieza/services/elementoLimpiezaService";
import type { ElementoLimpiezaOpcion } from "../../../elementoLimpieza/types/elementoLimpieza";
import { useImagenAutenticada } from "../../../../common/hooks/useImagenAutenticada";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../../../components/ui/dialog";
import {
  BadgeEstado,
  BannerError,
  BotonCancelar,
  BotonTexto,
  Celda,
  ColumnaHeader,
  EstadoCargando,
  EstadoVacio,
  FormField,
  FormInput,
  FormNativeSelect,
  LabelFiltro,
  MensajeError,
  PageHeader,
  SelectPlaceholder,
  Tarjeta,
} from "../../../../components/ui/patrones";

// Mismos formatos que acepta el backend (ver EXTENSIONES_EVIDENCIA en
// src/checklist/router.py).
const FORMATOS_PERMITIDOS = ["image/jpeg", "image/png", "image/gif", "image/webp"];

interface GrupoPlan {
  key: string;
  planNombre: string;
  equipoNombre: string;
  tareas: TareaDelDia[];
}

function agruparPorPlan(tareas: TareaDelDia[]): GrupoPlan[] {
  const grupos = new Map<string, GrupoPlan>();
  for (const tarea of tareas) {
    const key = `${tarea.equipo_id}-${tarea.plan_id ?? "sin-plan"}`;
    if (!grupos.has(key)) {
      grupos.set(key, {
        key,
        planNombre: tarea.plan_nombre,
        equipoNombre: tarea.equipo_nombre,
        tareas: [],
      });
    }
    grupos.get(key)!.tareas.push(tarea);
  }
  return Array.from(grupos.values());
}

function fechaLocalISO(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function unidadMedidaLabel(insumo: InsumoQuimicoOpcion): string {
  return insumo.unidad_simbolo ? `(${insumo.unidad_simbolo})` : "";
}

interface FilaTareaProps {
  tarea: TareaDelDia;
  isLoading: boolean;
  insumosQuimicos: InsumoQuimicoOpcion[];
  elementosLimpieza: ElementoLimpiezaOpcion[];
  onToggle: (
    tareaId: number,
    estadoActual: boolean,
    evidencia?: File,
    insumoQuimicoId?: number,
    cantidadConsumida?: number,
    elementoLimpiezaId?: number
  ) => void;
}

function FilaTarea({
  tarea,
  isLoading,
  insumosQuimicos,
  elementosLimpieza,
  onToggle,
}: FilaTareaProps) {
  const [archivoEvidencia, setArchivoEvidencia] = useState<File | null>(null);
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<string>(
    tarea.insumo_quimico_id ? String(tarea.insumo_quimico_id) : ""
  );
  const [cantidadConsumida, setCantidadConsumida] = useState<string>(
    tarea.cantidad_consumida ? String(tarea.cantidad_consumida) : ""
  );
  const [elementoSeleccionado, setElementoSeleccionado] = useState<string>(
    tarea.elemento_limpieza_id ? String(tarea.elemento_limpieza_id) : ""
  );
  const [errorConsumo, setErrorConsumo] = useState<string | null>(null);
  const [mostrarProcedimiento, setMostrarProcedimiento] = useState(false);
  const [mostrarFoto, setMostrarFoto] = useState(false);
  const [previewEvidencia, setPreviewEvidencia] = useState<string | null>(null);
  const [errorEvidencia, setErrorEvidencia] = useState<string | null>(null);
  const [historial, setHistorial] = useState<HistorialRegistroTareaItem[] | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  // La evidencia vive detrás de /uploads, que exige token: no se puede poner la
  // ruta en el src del <img>, hay que bajarla con la sesión.
  //
  // Se pide SOLO con el modal abierto: pasar siempre la ruta hacía que cada
  // fila bajara su foto al renderizarse (30 filas = 30 descargas) aunque nadie
  // haya abierto ninguna. El hook no dispara nada cuando recibe `null`.
  const imagen = useImagenAutenticada(mostrarFoto ? tarea.evidencia_url : null);

  const insumoActual = insumosQuimicos.find(
    (insumo) => insumo.id === Number(insumoSeleccionado)
  );

  const verHistorial = async () => {
    if (tarea.registro_id === 0) return;
    setCargandoHistorial(true);
    try {
      const datos = await obtenerHistorialRegistro(tarea.registro_id);
      setHistorial(datos.eventos);
    } catch {
      setHistorial([]);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const esHistorico = tarea.checklist_estado === "cerrado";
  const esFuturo = tarea.registro_id === 0;
  const esCerrado = esHistorico || esFuturo;

  const idInputEvidencia = `evidencia-${tarea.registro_id}-${tarea.id}`;

  /** Limpia el archivo seleccionado, el preview y el input oculto.
   *  También vacía el value del input para que volver a elegir la misma foto
   *  vuelva a disparar el onChange. */
  const limpiarEvidencia = () => {
    setArchivoEvidencia(null);
    setPreviewEvidencia(null);
    setErrorEvidencia(null);
    const input = document.getElementById(idInputEvidencia) as HTMLInputElement | null;
    if (input) input.value = "";
  };

  const handleEvidenciaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setErrorEvidencia(null);

    if (!file) {
      limpiarEvidencia();
      return;
    }

    if (!FORMATOS_PERMITIDOS.includes(file.type)) {
      setErrorEvidencia(
        "Formato no permitido. Solo se aceptan imágenes (JPEG, PNG, GIF, WebP)."
      );
      limpiarEvidencia();
      return;
    }

    setArchivoEvidencia(file);

    // Leemos el archivo como data URL para mostrarlo sin tener que subirlo.
    const reader = new FileReader();
    reader.onloadend = () => setPreviewEvidencia(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCheckboxClick = () => {
    if (tarea.completado) {
      onToggle(
        tarea.id,
        tarea.completado,
        archivoEvidencia || undefined,
        undefined,
        undefined,
        undefined
      );
      limpiarEvidencia();
      setErrorConsumo(null);
      return;
    }

    const hayProducto = insumoSeleccionado !== "";
    const hayCantidad = cantidadConsumida !== "";

    if (hayProducto !== hayCantidad) {
      setErrorConsumo(
        "Seleccioná el producto químico e indicá la cantidad consumida."
      );
      return;
    }

    let cantidad: number | undefined;
    let insumoId: number | undefined;

    if (hayProducto && hayCantidad) {
      cantidad = Number(cantidadConsumida);
      insumoId = Number(insumoSeleccionado);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        setErrorConsumo("La cantidad consumida debe ser mayor que 0.");
        return;
      }
    }

    const elementoId = elementoSeleccionado ? Number(elementoSeleccionado) : undefined;

    setErrorConsumo(null);
    onToggle(
      tarea.id,
      tarea.completado,
      archivoEvidencia || undefined,
      insumoId,
      cantidad,
      elementoId
    );
    limpiarEvidencia();
  };

  return (
    <>
      <Table.Row
        key={tarea.registro_id > 0 ? `r-${tarea.registro_id}` : `p-${tarea.id}`}
      >
        <Celda opacity={esCerrado ? 0.7 : 1}>
          <Text fontWeight="bold">{tarea.nombre}</Text>

          {tarea.descripcion && (
            <Box mt="1">
              <BotonTexto
                onClick={() => setMostrarProcedimiento((v) => !v)}
                aria-expanded={mostrarProcedimiento}
              >
                {mostrarProcedimiento
                  ? "Ocultar procedimiento"
                  : "Ver procedimiento"}
                {mostrarProcedimiento ? (
                  <LuChevronUp aria-hidden />
                ) : (
                  <LuChevronDown aria-hidden />
                )}
              </BotonTexto>
              {mostrarProcedimiento && (
                <Box
                  mt="2"
                  p="3"
                  bg="bg.subtle"
                  borderWidth="1px"
                  borderColor="brand.200"
                  rounded="md"
                  maxW="500px"
                  whiteSpace="pre-line"
                  fontSize="sm"
                  color="fg"
                >
                  {tarea.descripcion}
                </Box>
              )}
            </Box>
          )}

          {/* Opciones de Insumo Químico y Elemento de Limpieza */}
          {!tarea.completado && !esCerrado && (
            <Box
              mt="3"
              p="3"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="brand.200"
              rounded="md"
              maxW="500px"
            >
              {/* Selector de Elemento de Limpieza */}
              <FormField label="Elemento de limpieza utilizado" mb="4">
                <FormNativeSelect
                  value={elementoSeleccionado}
                  onChange={(e) => setElementoSeleccionado(e.target.value)}
                  maxW="350px"
                >
                  <SelectPlaceholder value="">
                    Sin elemento específico
                  </SelectPlaceholder>
                  {elementosLimpieza.map((elem) => (
                    <option key={elem.id} value={elem.id}>
                      {elem.nombre}
                    </option>
                  ))}
                </FormNativeSelect>
              </FormField>

              {/* Selector de Insumo Químico */}
              <FormField label="Producto químico utilizado" mb="4">
                <FormNativeSelect
                  value={insumoSeleccionado}
                  onChange={(e) => {
                    setInsumoSeleccionado(e.target.value);
                    setCantidadConsumida("");
                    setErrorConsumo(null);
                  }}
                  maxW="350px"
                >
                  <SelectPlaceholder value="">
                    Sin producto químico
                  </SelectPlaceholder>
                  {insumosQuimicos.map((insumo) => (
                    <option key={insumo.id} value={insumo.id}>
                      {insumo.nombre} — {unidadMedidaLabel(insumo)}
                    </option>
                  ))}
                </FormNativeSelect>
              </FormField>

              {insumoSeleccionado && (
                <Box mt="2">
                  <FormField label="Cantidad aproximada consumida" mb="0">
                    <Box display="flex" alignItems="center" gap="2">
                      <FormInput
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={cantidadConsumida}
                        onChange={(e) => {
                          setCantidadConsumida(e.target.value);
                          setErrorConsumo(null);
                        }}
                        placeholder="Ej: 2"
                        w="130px"
                      />
                      {insumoActual && (
                        <Text fontSize="sm" fontWeight="bold" color="brand.fg">
                          {unidadMedidaLabel(insumoActual)}
                        </Text>
                      )}
                    </Box>
                  </FormField>
                </Box>
              )}

              {errorConsumo && <MensajeError>{errorConsumo}</MensajeError>}
            </Box>
          )}

          {/* Adjuntar evidencia */}
          {!tarea.completado && !esCerrado && (
            <Box mt="2">
              <FormInput
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                display="none"
                id={idInputEvidencia}
                onChange={handleEvidenciaChange}
              />
              <Box display="flex" alignItems="center" gap="3">
                <BotonCancelar
                  onClick={() =>
                    document.getElementById(idInputEvidencia)?.click()
                  }
                >
                  <LuPaperclip aria-hidden />
                  Adjuntar evidencia
                </BotonCancelar>
                {archivoEvidencia && (
                  <Text fontSize="sm" color="brand.fg" fontWeight="bold">
                    {archivoEvidencia.name} (lista para enviar)
                  </Text>
                )}
              </Box>

              {errorEvidencia && <MensajeError>{errorEvidencia}</MensajeError>}

              {/* Vista previa de la foto elegida, con opción de quitarla */}
              {previewEvidencia && (
                <Box mt="3" position="relative" display="inline-block">
                  <Image
                    src={previewEvidencia}
                    alt="Vista previa de la evidencia"
                    maxW="160px"
                    maxH="160px"
                    rounded="lg"
                    borderWidth="2px"
                    borderColor="brand.300"
                    display="block"
                  />
                  <IconButton
                    type="button"
                    onClick={limpiarEvidencia}
                    aria-label="Quitar evidencia"
                    position="absolute"
                    top="-2"
                    right="-2"
                    size="xs"
                    rounded="full"
                    colorPalette="red"
                  >
                    <LuX />
                  </IconButton>
                </Box>
              )}
            </Box>
          )}
        </Celda>

        <Celda center>
          {isLoading ? (
            <Spinner size="sm" color="brand.500" />
          ) : esFuturo ? (
            <Text fontSize="sm" color="fg.subtle">
              —
            </Text>
          ) : esHistorico ? (
            <Box
              display="inline-flex"
              color={tarea.completado ? "green.fg" : "red.fg"}
              role="img"
              aria-label={
                tarea.completado
                  ? "Completada (checklist cerrado)"
                  : "No completada (checklist cerrado)"
              }
              title={
                tarea.completado
                  ? "Completada (checklist cerrado)"
                  : "No completada (checklist cerrado)"
              }
            >
              {tarea.completado ? <LuCheck size={22} /> : <LuX size={22} />}
            </Box>
          ) : (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              gap="1"
            >
              {/*
                Era un `<Input type="checkbox">`: la receta `input` del tema le
                pone `appearance: none`, borde de 2px y fondo blanco, así que
                el tilde nunca se dibujaba. `Checkbox` de Chakra trae su propio
                control con el indicador, y sigue siendo controlado por
                `tarea.completado`: si la validación del consumo falla, la
                casilla queda sin marcar.
              */}
              <Checkbox.Root
                checked={tarea.completado}
                onCheckedChange={handleCheckboxClick}
                colorPalette="brand"
                cursor="pointer"
              >
                <Checkbox.HiddenInput
                  aria-label={`Marcar "${tarea.nombre}" como completada`}
                />
                <Checkbox.Control cursor="pointer">
                  <Checkbox.Indicator />
                </Checkbox.Control>
              </Checkbox.Root>
              {tarea.evidencia_url && (
                <BotonTexto onClick={() => setMostrarFoto(true)}>
                  Ver foto
                </BotonTexto>
              )}
              {tarea.registro_id > 0 && (
                <BotonTexto color="fg.muted" onClick={verHistorial}>
                  Historial
                </BotonTexto>
              )}
            </Box>
          )}
        </Celda>
      </Table.Row>

      {/*
        Los dos modales eran `Box position="fixed"` armados a mano, y además
        quedaban dentro del `<tbody>` (un `div` dentro de una tabla). Con
        `Dialog` van en un portal, atrapan el foco y se ven igual que el resto
        de los diálogos de la app.
      */}
      {mostrarFoto && (
        <DialogRoot
          open
          placement="center"
          motionPreset="none"
          closeOnEscape={false}
          closeOnInteractOutside={false}
        >
          <DialogContent
            bg="bg.panel"
            p="6"
            rounded="lg"
            boxShadow="dialog"
            width="auto"
            minW="320px"
            maxW="90vw"
            maxH="90vh"
            alignItems="center"
            gap="4"
          >
            <DialogTitle fontSize="lg" fontWeight="bold" color="fg">
              Evidencia fotográfica
            </DialogTitle>
            {imagen.loading && <EstadoCargando>Cargando imagen...</EstadoCargando>}
            {!imagen.loading && imagen.error && (
              <MensajeError>{imagen.error}</MensajeError>
            )}
            {imagen.src && (
              <Image
                src={imagen.src}
                alt="Evidencia fotográfica"
                maxW="100%"
                maxH="60vh"
                objectFit="contain"
                rounded="lg"
              />
            )}
            <BotonCancelar onClick={() => setMostrarFoto(false)}>
              Cerrar
            </BotonCancelar>
          </DialogContent>
        </DialogRoot>
      )}

      {historial && (
        <DialogRoot
          open
          placement="center"
          motionPreset="none"
          closeOnEscape={false}
          closeOnInteractOutside={false}
        >
          <DialogContent
            bg="bg.panel"
            p="6"
            rounded="lg"
            boxShadow="dialog"
            width="400px"
            maxW="90vw"
            maxH="80vh"
            overflowY="auto"
            textAlign="left"
          >
            <DialogTitle fontSize="lg" fontWeight="bold" color="brand.fg" mb="4">
              Historial de cambios — {tarea.nombre}
            </DialogTitle>
            {cargandoHistorial ? (
              <EstadoCargando>Cargando historial...</EstadoCargando>
            ) : historial.length === 0 ? (
              <Text fontSize="sm" color="fg.muted">
                Sin eventos registrados todavía.
              </Text>
            ) : (
              historial.map((ev) => (
                <Box
                  key={ev.id}
                  borderBottomWidth="1px"
                  borderColor="border.subtle"
                  py="2"
                >
                  <HStack gap="2" align="center" fontSize="sm" fontWeight="bold">
                    <Box
                      as="span"
                      display="inline-flex"
                      color={ev.completado ? "green.fg" : "red.fg"}
                      aria-hidden
                    >
                      {ev.completado ? <LuCheck size={16} /> : <LuX size={16} />}
                    </Box>
                    <Text as="span" color="fg">
                      {ev.completado ? "Marcada" : "Desmarcada"}
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color="fg.muted" mt="1">
                    {new Date(ev.fecha_evento).toLocaleString()}
                    {ev.usuario_nombre ? ` · por ${ev.usuario_nombre}` : ""}
                    {ev.evidencia_url ? " · con foto adjunta" : ""}
                  </Text>
                </Box>
              ))
            )}
            <HStack mt="6">
              <BotonCancelar onClick={() => setHistorial(null)}>
                Cerrar
              </BotonCancelar>
            </HStack>
          </DialogContent>
        </DialogRoot>
      )}
    </>
  );
}

export function ChecklistPage() {
  const hoyISO = fechaLocalISO(new Date());
  const [selectedFecha, setSelectedFecha] = useState<string>(hoyISO);
  const [insumosQuimicos, setInsumosQuimicos] = useState<InsumoQuimicoOpcion[]>([]);
  const [elementosLimpieza, setElementosLimpieza] = useState<ElementoLimpiezaOpcion[]>([]);

  const { tareas, loading, error, actualizandoId, toggleTarea, recargar } =
    useChecklist(selectedFecha);

  useEffect(() => {
    // Usamos los endpoints de "opciones": son los únicos de estos catálogos
    // accesibles para un operario sin permisos de administración.
    const cargarOpciones = async () => {
      try {
        const [datosQuimicos, datosElementos] = await Promise.all([
          listarOpcionesInsumosQuimicos().catch(() => []),
          listarOpcionesElementosLimpieza().catch(() => []),
        ]);
        setInsumosQuimicos(datosQuimicos);
        setElementosLimpieza(datosElementos);
      } catch (err) {
        console.error("Error al cargar opciones auxiliares:", err);
      }
    };
    cargarOpciones();
  }, []);

  const grupos = useMemo(() => agruparPorPlan(tareas), [tareas]);
  const totalTareas = tareas.length;
  const tareasCompletadas = tareas.filter((t) => t.completado).length;
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(
    new Set()
  );

  const toggleGrupo = (key: string) => {
    setGruposExpandidos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(key)) {
        nuevo.delete(key);
      } else {
        nuevo.add(key);
      }
      return nuevo;
    });
  };

  return (
    <Box p="5">
      <PageHeader
        title="Checklist diario de limpieza"
        description="Control, persistencia e historial auditable por fecha, para todos los equipos."
        actions={
          <BotonCancelar onClick={recargar}>
            <LuRefreshCw aria-hidden />
            Actualizar
          </BotonCancelar>
        }
      />

      <Tarjeta p="4" mb="6">
        <Box minW="180px">
          <Field.Root>
            <LabelFiltro>Fecha</LabelFiltro>
            <FormInput
              type="date"
              value={selectedFecha}
              onChange={(e) => setSelectedFecha(e.target.value)}
              w="auto"
            />
          </Field.Root>
        </Box>
      </Tarjeta>

      {error && <BannerError>{error}</BannerError>}

      {loading && <EstadoCargando>Cargando tareas...</EstadoCargando>}

      {!loading && grupos.length === 0 && !error && (
        <EstadoVacio>
          No hay tareas de limpieza programadas para la fecha seleccionada.
        </EstadoVacio>
      )}

      {!loading && grupos.length > 0 && (
        <>
          <Text fontSize="sm" color="fg.muted" mb="4">
            Progreso general: <strong>{tareasCompletadas}</strong> de{" "}
            <strong>{totalTareas}</strong> tareas completadas.
          </Text>

          {grupos.map((grupo) => {
            const colapsado = !gruposExpandidos.has(grupo.key);
            return (
              <Tarjeta key={grupo.key} mb="6">
                {/*
                  Era un `div` con `role="button"`: no respondía al teclado y no
                  se podía enfocar con Tab. Ahora es un `<button>` real, que
                  trae Enter y Espacio de vuelta. `brand.600` para que el
                  blanco llegue a 4.5:1, igual que la franja de las tablas.
                */}
                <Button
                  type="button"
                  onClick={() => toggleGrupo(grupo.key)}
                  aria-expanded={!colapsado}
                  variant="ghost"
                  bg="brand.600"
                  color="white"
                  _hover={{ bg: "brand.700" }}
                  w="100%"
                  h="auto"
                  px="4"
                  py="3"
                  rounded="none"
                  justifyContent="space-between"
                  textAlign="left"
                  cursor="pointer"
                  userSelect="none"
                >
                  <HStack justify="space-between" align="center" w="100%">
                    <HStack align="center" gap="3">
                      <Box
                        color="white"
                        transform={colapsado ? "rotate(-90deg)" : "rotate(0deg)"}
                        transition="transform 0.15s ease"
                        display="inline-flex"
                        aria-hidden
                      >
                        <LuChevronDown size={18} />
                      </Box>
                      <Box>
                        <Text fontSize="md" fontWeight="bold" color="white">
                          {grupo.planNombre}
                        </Text>
                        <Text fontSize="xs" color="brand.50" mt="1">
                          Equipo: {grupo.equipoNombre}
                        </Text>
                      </Box>
                    </HStack>

                    {grupo.tareas[0]?.checklist_estado === "cerrado" && (
                      <BadgeEstado icono={<LuLock size={12} />}>
                        Cerrado (histórico)
                      </BadgeEstado>
                    )}

                    {grupo.tareas[0]?.registro_id === 0 && (
                      <BadgeEstado icono={<LuCalendarClock size={12} />}>
                        Vista previa
                      </BadgeEstado>
                    )}
                  </HStack>
                </Button>

                {!colapsado && (
                  <Table.Root w="100%">
                    <Table.Header>
                      <Table.Row bg="brand.100" borderBottomWidth="2px" borderColor="brand.300">
                        <ColumnaHeader>Tarea</ColumnaHeader>
                        <ColumnaHeader center width="140px">
                          Completada
                        </ColumnaHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {grupo.tareas.map((t) => (
                        <FilaTarea
                          key={
                            t.registro_id > 0
                              ? `r-${t.registro_id}`
                              : `p-${t.id}`
                          }
                          tarea={t}
                          isLoading={actualizandoId === t.id}
                          insumosQuimicos={insumosQuimicos}
                          elementosLimpieza={elementosLimpieza}
                          onToggle={toggleTarea}
                        />
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </Tarjeta>
            );
          })}
        </>
      )}
    </Box>
  );
}