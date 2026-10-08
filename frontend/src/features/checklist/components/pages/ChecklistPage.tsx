import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Field,
  Heading,
  HStack,
  Image,
  Input,
  NativeSelect,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import { useChecklist } from "../../hooks/useChecklist";
import type { TareaDelDia, HistorialRegistroTareaItem } from "../../types/checklist";
import { obtenerHistorialRegistro } from "../../services/checklistService";
import { listarOpcionesInsumosQuimicos } from "../../../insumoQuimico/services/insumoQuimicoService";
import type { InsumoQuimicoOpcion } from "../../../insumoQuimico/types/insumoQuimico";
import { listarOpcionesElementosLimpieza } from "../../../elementoLimpieza/services/elementoLimpiezaService";
import type { ElementoLimpiezaOpcion } from "../../../elementoLimpieza/types/elementoLimpieza";
import { useImagenAutenticada } from "../../../../common/hooks/useImagenAutenticada";
import {
  BadgeEstado,
  BotonTexto,
  Celda,
  ColumnaHeader,
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
            <Box mt="4px">
              <BotonTexto onClick={() => setMostrarProcedimiento((v) => !v)}>
                {mostrarProcedimiento
                  ? "Ocultar procedimiento ▲"
                  : "Ver procedimiento ▾"}
              </BotonTexto>
              {mostrarProcedimiento && (
                <Box
                  mt="6px"
                  p="10px 12px"
                  bg="gray.50"
                  border="1px solid"
                  borderColor="brand.200"
                  rounded="md"
                  maxW="550px"
                  whiteSpace="pre-line"
                  fontSize="13px"
                  color="gray.800"
                >
                  {tarea.descripcion}
                </Box>
              )}
            </Box>
          )}

          {/* Opciones de Insumo Químico y Elemento de Limpieza */}
          {!tarea.completado && !esCerrado && (
            <Box
              mt="10px"
              p="10px"
              bg="gray.50"
              border="1px solid"
              borderColor="brand.200"
              rounded="md"
              maxW="550px"
            >
              {/* Selector de Elemento de Limpieza */}
              <Box mb="10px">
                <Text fontSize="12px" fontWeight="bold" color="gray.600" mb="4px">
                  Elemento de limpieza utilizado
                </Text>
                <NativeSelect.Root
                  w="100%"
                  maxW="350px"
                  rounded="md"
                >
                  <NativeSelect.Field
                    value={elementoSeleccionado}
                    onChange={(e) => setElementoSeleccionado(e.target.value)}
                    p="7px 10px"
                    borderWidth={1}
                    borderColor="brand.300"
                    bg="white"
                    fontSize="13px"
                  >
                    <option value="">Sin elemento específico</option>
                    {elementosLimpieza.map((elem) => (
                      <option key={elem.id} value={elem.id}>
                        {elem.nombre}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Box>

              {/* Selector de Insumo Químico */}
              <Text fontSize="12px" fontWeight="bold" color="gray.600" mb="4px">
                Producto químico utilizado
              </Text>
              <NativeSelect.Root
                w="100%"
                maxW="350px"
                rounded="md"
              >
                <NativeSelect.Field
                  value={insumoSeleccionado}
                  onChange={(e) => {
                    setInsumoSeleccionado(e.target.value);
                    setCantidadConsumida("");
                    setErrorConsumo(null);
                  }}
                  p="7px 10px"
                  borderWidth={1}
                  borderColor="brand.300"
                  bg="white"
                  fontSize="13px"
                >
                  <option value="">Sin producto químico</option>
                  {insumosQuimicos.map((insumo) => (
                    <option key={insumo.id} value={insumo.id}>
                      {insumo.nombre} — {unidadMedidaLabel(insumo)}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>

              {insumoSeleccionado && (
                <Box mt="8px">
                  <Text fontSize="12px" fontWeight="bold" color="gray.600" mb="4px">
                    Cantidad aproximada consumida
                  </Text>
                  <HStack gap="8px">
                    <Input
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
                      p="6px 8px"
                      rounded="md"
                      borderWidth={1}
                      borderColor="brand.300"
                      bg="white"
                      fontSize="13px"
                    />
                    {insumoActual && (
                      <Text fontSize="13px" fontWeight="bold" color="brand.500">
                        {unidadMedidaLabel(insumoActual)}
                      </Text>
                    )}
                  </HStack>
                </Box>
              )}

              {errorConsumo && (
                <Text
                  fontSize="12px"
                  color="red.500"
                  mt="6px"
                  fontWeight="bold"
                >
                  ⚠️ {errorConsumo}
                </Text>
              )}
            </Box>
          )}

          {/* Adjuntar evidencia */}
          {!tarea.completado && !esCerrado && (
            <Box mt="8px">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                display="none"
                id={idInputEvidencia}
                onChange={handleEvidenciaChange}
              />
              <HStack gap="10px">
                <Button
                  type="button"
                  size="xs"
                  bg="gray.200"
                  border="none"
                  rounded="4px"
                  onClick={() =>
                    document.getElementById(idInputEvidencia)?.click()
                  }
                >
                  Adjuntar Evidencia
                </Button>
                {archivoEvidencia && (
                  <Text fontSize="12px" color="brand.500" fontWeight="bold">
                    {archivoEvidencia.name} (Lista para enviar)
                  </Text>
                )}
              </HStack>

              {errorEvidencia && (
                <Text fontSize="12px" color="red.500" mt="6px" fontWeight="bold">
                  ⚠️ {errorEvidencia}
                </Text>
              )}

              {/* Vista previa de la foto elegida, con opción de quitarla */}
              {previewEvidencia && (
                <Box mt="10px" position="relative" display="inline-block">
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
                  <Button
                    type="button"
                    onClick={limpiarEvidencia}
                    aria-label="Quitar evidencia"
                    position="absolute"
                    top="-8px"
                    right="-8px"
                    size="xs"
                    minW="22px"
                    height="22px"
                    padding="0"
                    rounded="full"
                    bg="red.600"
                    color="white"
                    fontWeight="bold"
                    lineHeight="1"
                    _hover={{ bg: "red.700" }}
                  >
                    ✕
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Celda>

        <Celda center>
          {isLoading ? (
            <Spinner size="sm" color="brand.500" />
          ) : esFuturo ? (
            <Text fontSize="13px" color="gray.400">
              —
            </Text>
          ) : esHistorico ? (
            <Text
              fontSize="17px"
              fontWeight="bold"
              color={tarea.completado ? "green.600" : "red.700"}
              title={
                tarea.completado
                  ? "Completada (checklist cerrado)"
                  : "No completada (checklist cerrado)"
              }
            >
              {tarea.completado ? "✔" : "✕"}
            </Text>
          ) : (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              gap="4px"
            >
              <Input
                type="checkbox"
                checked={tarea.completado}
                onChange={handleCheckboxClick}
                w="18px"
                h="18px"
                cursor="pointer"
              />
              {tarea.evidencia_url && (
                <BotonTexto onClick={() => setMostrarFoto(true)}>
                  Ver foto
                </BotonTexto>
              )}
              {tarea.registro_id > 0 && (
                <BotonTexto color="gray.400" onClick={verHistorial}>
                  Historial
                </BotonTexto>
              )}
            </Box>
          )}
        </Celda>
      </Table.Row>

      {mostrarFoto && (
        <Box
          position="fixed"
          inset={0}
          bg="blackAlpha.700"
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          zIndex={2000}
          p="20px"
        >
          <Box
            bg="white"
            p="25px"
            rounded="xl"
            boxShadow="0 10px 25px rgba(0,0,0,0.3)"
            maxW="90%"
            maxH="90%"
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap="15px"
          >
            {imagen.loading && (
              <Text fontSize="14px" color="gray.500">
                Cargando imagen...
              </Text>
            )}
            {!imagen.loading && imagen.error && (
              <Text fontSize="14px" color="red.500">
                {imagen.error}
              </Text>
            )}
            {imagen.src && (
              <Image
                src={imagen.src}
                alt="Evidencia fotográfica"
                maxW="100%"
                maxH="70vh"
                objectFit="contain"
                rounded="lg"
              />
            )}
            <Button
              onClick={() => setMostrarFoto(false)}
              colorPalette="brand"
              p="8px 24px"
              rounded="md"
              fontWeight="bold"
              height="auto"
            >
              Volver
            </Button>
          </Box>
        </Box>
      )}

      {historial && (
        <Box
          position="fixed"
          inset={0}
          bg="blackAlpha.700"
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          zIndex={2100}
          p="20px"
        >
          <Box
            bg="white"
            p="20px"
            rounded="10px"
            maxW="480px"
            w="100%"
            maxH="80vh"
            overflowY="auto"
          >
            <Text fontWeight="bold" mb="12px">
              Historial de cambios — {tarea.nombre}
            </Text>
            {cargandoHistorial ? (
              <Spinner size="sm" color="brand.500" />
            ) : historial.length === 0 ? (
              <Text fontSize="13px" color="gray.500">
                Sin eventos registrados todavía.
              </Text>
            ) : (
              historial.map((ev) => (
                <Box
                  key={ev.id}
                  borderBottom="1px solid"
                  borderColor="gray.100"
                  p="8px 0"
                >
                  <Text fontSize="13px">
                    {ev.completado ? "✔ Marcada" : "✕ Desmarcada"} —{" "}
                    {new Date(ev.fecha_evento).toLocaleString()}
                    {ev.usuario_nombre ? ` · por ${ev.usuario_nombre}` : ""}
                    {ev.evidencia_url ? " · con foto adjunta" : ""}
                  </Text>
                </Box>
              ))
            )}
            <Button mt="12px" colorPalette="brand" onClick={() => setHistorial(null)}>
              Cerrar
            </Button>
          </Box>
        </Box>
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
    <Box p="20px">
      <HStack justify="space-between" mb="20px" flexWrap="wrap" gap="15px">
        <Box>
          <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
            Checklist Diario de Limpieza
          </Heading>
          <Text color="gray.600" fontSize="14px" mt="2px">
            Control, persistencia e historial auditable por fecha, para todos los equipos.
          </Text>
        </Box>
        <Button
          bg="gray.200"
          color="gray.800"
          fontSize="14px"
          fontWeight="bold"
          height="auto"
          onClick={recargar}
          p="8px 16px"
          rounded="md"
          _hover={{ bg: "gray.300" }}
        >
          Actualizar
        </Button>
      </HStack>

      <Box
        bg="white"
        p="20px"
        rounded="10px"
        boxShadow="0 2px 6px rgba(0,0,0,0.05)"
        mb="25px"
      >
        <Box minW="180px">
          <Field.Root>
            <Box
              as="label"
              display="block"
              fontSize="14px"
              fontWeight="bold"
              mb="6px"
              color="gray.600"
            >
              FECHA
            </Box>
            <Input
              type="date"
              value={selectedFecha}
              onChange={(e) => setSelectedFecha(e.target.value)}
              p="10px 14px"
              rounded="lg"
              borderWidth={2}
              borderColor="brand.300"
              fontSize="15px"
              w="auto"
            />
          </Field.Root>
        </Box>
      </Box>

      {error && (
        <Box
          bg="red.100"
          color="red.800"
          p="12px"
          rounded="lg"
          mb="20px"
          border="1px solid"
          borderColor="red.200"
          fontWeight="bold"
        >
          ⚠️ {error}
        </Box>
      )}

      {loading && (
        <HStack justify="center" p={10}>
          <Spinner size="lg" color="brand.500" />
          <Text color="gray.600">Cargando tareas...</Text>
        </HStack>
      )}

      {!loading && grupos.length === 0 && !error && (
        <Box bg="white" rounded="lg" p={10} textAlign="center">
          <Text fontSize="16px" color="gray.600">
            No hay tareas de limpieza programadas para la fecha seleccionada.
          </Text>
        </Box>
      )}

      {!loading && grupos.length > 0 && (
        <>
          <HStack justify="space-between" mb="16px">
            <Text fontSize="14px" color="gray.600">
              Progreso general: <strong>{tareasCompletadas}</strong> de{" "}
              <strong>{totalTareas}</strong> tareas completadas.
            </Text>
          </HStack>

          {grupos.map((grupo) => {
            const colapsado = !gruposExpandidos.has(grupo.key);
            return (
              <Tarjeta key={grupo.key} mb="20px">
                <Box
                  onClick={() => toggleGrupo(grupo.key)}
                  role="button"
                  aria-expanded={!colapsado}
                  bg="brand.500"
                  p="12px 16px"
                  cursor="pointer"
                  userSelect="none"
                >
                  <HStack justify="space-between">
                    <HStack gap="10px">
                      <Text
                        fontSize="13px"
                        color="white"
                        transform={colapsado ? "rotate(-90deg)" : "rotate(0deg)"}
                        transition="transform 0.15s ease"
                        display="inline-block"
                      >
                        ▾
                      </Text>
                      <Box>
                        <Text fontSize="15px" fontWeight="bold" color="white">
                          {grupo.planNombre}
                        </Text>
                        <Text fontSize="12px" color="brand.100" mt="2px">
                          Equipo: {grupo.equipoNombre}
                        </Text>
                      </Box>
                    </HStack>

                    {grupo.tareas[0]?.checklist_estado === "cerrado" && (
                      <BadgeEstado>🔒 Cerrado (histórico)</BadgeEstado>
                    )}

                    {grupo.tareas[0]?.registro_id === 0 && (
                      <BadgeEstado>📅 Vista previa</BadgeEstado>
                    )}
                  </HStack>
                </Box>

                {!colapsado && (
                  <Table.Root w="100%">
                    <Table.Header>
                      <Table.Row bg="brand.100" borderBottom="2px solid" borderColor="brand.300">
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
