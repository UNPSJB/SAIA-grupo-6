import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Heading,
  HStack,
  Input,
  Spinner,
  Text,
  Field,
  Button,
  Table,
  Badge,
} from "@chakra-ui/react";
import { useChecklist } from "../../hooks/useChecklist";
import type { TareaDelDia, HistorialRegistroTareaItem } from "../../types/checklist";
import { obtenerHistorialRegistro } from "../../services/checklistService";
import { TIPOS_TAREA } from "../../../planLimpieza/types/planLimpieza";
import { listarOpcionesInsumosQuimicos } from "../../../insumoQuimico/services/insumoQuimicoService";
import type { InsumoQuimicoOpcion } from "../../../insumoQuimico/types/insumoQuimico";
import { listarOpcionesElementosLimpieza } from "../../../elementoLimpieza/services/elementoLimpiezaService";
import type { ElementoLimpiezaOpcion } from "../../../elementoLimpieza/types/elementoLimpieza";
import { useImagenAutenticada } from "../../../../common/hooks/useImagenAutenticada";
import {
  BLANCO,
  BORDE_SUAVE,
  ERROR_FONDO,
  ERROR_TEXTO,
  EXITO_ALT,
  FONDO_CARD,
  FONDO_TEAL,
  GRIS_CLARO,
  PELIGRO,
  PELIGRO_HOVER,
  PELIGRO_TEXTO,
  TEAL,
  TEAL_CLARO,
  TEXTO_PRIMARIO,
  TEXTO_SECUNDARIO,
  TEXTO_TENUE,
  estiloInputCompacto,
} from "../../../../common/theme/tokens";


// Mismos formatos que acepta el backend (ver EXTENSIONES_EVIDENCIA en
// src/checklist/router.py).
const FORMATOS_PERMITIDOS = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const estiloTarjeta = {
  backgroundColor: BLANCO,
  borderRadius: "10px",
  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
  overflow: "hidden" as const,
};

const estiloHeaderFila = {
  backgroundColor: FONDO_TEAL,
  borderBottom: `2px solid ${TEAL_CLARO}`,
};

const estiloHeaderCelda = {
  color: TEXTO_PRIMARIO,
  fontWeight: "bold" as const,
  fontSize: "13px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.03em",
  padding: "10px 16px",
};

const estiloCelda = {
  color: TEXTO_PRIMARIO,
  fontSize: "14px",
  padding: "10px 16px",
  borderBottom: "1px solid #eee",
  backgroundColor: BLANCO,
};

// Etiqueta y color del badge del tipo de tarea. El label sale de la misma
// lista que usa el formulario del plan (TIPOS_TAREA) para no duplicar textos.
const COLOR_TIPO_TAREA: Record<string, string> = {
  preoperacional: "blue",
  operacional: "green",
  postoperacional: "orange",
};

function etiquetaTipoTarea(tipo: string): string {
  return TIPOS_TAREA.find((opcion) => opcion.value === tipo)?.label ?? tipo;
}

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
  // La evidencia vive detrás de /uploads, que exige token: no se puede poner la
  // ruta en el src del <img>, hay que bajarla con la sesión.
  //
  // Se pide SOLO con el modal abierto: pasar siempre la ruta hacía que cada
  // fila bajara su foto al renderizarse (30 filas = 30 descargas) aunque nadie
  // haya abierto ninguna. El hook no dispara nada cuando recibe `null`.
  const imagen = useImagenAutenticada(mostrarFoto ? tarea.evidencia_url : null);
  const [historial, setHistorial] = useState<HistorialRegistroTareaItem[] | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

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
        <Table.Cell style={{ ...estiloCelda, opacity: esCerrado ? 0.7 : 1 }}>
          <HStack gap="8px" align="center" flexWrap="wrap">
            <Text fontWeight="bold">{tarea.nombre}</Text>
            {tarea.tipo && (
              <Badge
                colorPalette={COLOR_TIPO_TAREA[tarea.tipo] ?? "gray"}
                borderRadius="6px"
                px="8px"
                py="2px"
                fontSize="11px"
              >
                {etiquetaTipoTarea(tarea.tipo)}
              </Badge>
            )}
          </HStack>

          {tarea.observaciones && (
            <Box
              mt="6px"
              fontSize="13px"
              color={TEXTO_SECUNDARIO}
              whiteSpace="pre-line"
            >
              <Text as="span" fontWeight="bold">
                Observaciones:{" "}
              </Text>
              {tarea.observaciones}
            </Box>
          )}

          {tarea.descripcion && (
            <Box mt="4px">
              <button
                type="button"
                onClick={() => setMostrarProcedimiento((v) => !v)}
                style={{
                  fontSize: "11px",
                  color: TEAL,
                  background: "none",
                  border: "none",
                  textDecoration: "underline",
                  fontWeight: "bold",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {mostrarProcedimiento
                  ? "Ocultar procedimiento ▲"
                  : "Ver procedimiento ▾"}
              </button>
              {mostrarProcedimiento && (
                <Box
                  mt="6px"
                  style={{
                    padding: "10px 12px",
                    backgroundColor: FONDO_CARD,
                    border: "1px solid #d8e7e5",
                    borderRadius: "6px",
                    maxWidth: "550px",
                    whiteSpace: "pre-line",
                    fontSize: "13px",
                    color: TEXTO_PRIMARIO,
                  }}
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
              style={{
                padding: "10px",
                backgroundColor: FONDO_CARD,
                border: "1px solid #d8e7e5",
                borderRadius: "6px",
                maxWidth: "550px",
              }}
            >
              {/* Selector de Elemento de Limpieza */}
              <Box mb="10px">
                <Text fontSize="12px" fontWeight="bold" color={TEXTO_SECUNDARIO} mb="4px">
                  Elemento de limpieza utilizado
                </Text>
                <select
                  value={elementoSeleccionado}
                  onChange={(e) => setElementoSeleccionado(e.target.value)}
                  style={{
                    width: "100%",
                    maxWidth: "350px",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1px solid #90BEBB",
                    backgroundColor: "white",
                    fontSize: "13px",
                  }}
                >
                  <option value="">Sin elemento específico</option>
                  {elementosLimpieza.map((elem) => (
                    <option key={elem.id} value={elem.id}>
                      {elem.nombre}
                    </option>
                  ))}
                </select>
              </Box>

              {/* Selector de Insumo Químico */}
              <Text fontSize="12px" fontWeight="bold" color={TEXTO_SECUNDARIO} mb="4px">
                Producto químico utilizado
              </Text>
              <select
                value={insumoSeleccionado}
                onChange={(e) => {
                  setInsumoSeleccionado(e.target.value);
                  setCantidadConsumida("");
                  setErrorConsumo(null);
                }}
                style={{
                  width: "100%",
                  maxWidth: "350px",
                  padding: "7px 10px",
                  borderRadius: "6px",
                  border: "1px solid #90BEBB",
                  backgroundColor: "white",
                  fontSize: "13px",
                }}
              >
                <option value="">Sin producto químico</option>
                {insumosQuimicos.map((insumo) => (
                  <option key={insumo.id} value={insumo.id}>
                    {insumo.nombre} — {unidadMedidaLabel(insumo)}                  
                  </option>
                ))}
              </select>

              {insumoSeleccionado && (
                <Box mt="8px">
                  <Text fontSize="12px" fontWeight="bold" color={TEXTO_SECUNDARIO} mb="4px">
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
                      style={{
                        width: "130px",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #90BEBB",
                        backgroundColor: "white",
                        fontSize: "13px",
                      }}
                    />
                    {insumoActual && (
                      <Text fontSize="13px" fontWeight="bold" color={TEAL}>
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
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ display: "none" }}
                id={idInputEvidencia}
                onChange={handleEvidenciaChange}
              />
              <HStack gap="10px">
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(idInputEvidencia)?.click()
                  }
                  style={{
                    fontSize: "12px",
                    padding: "4px 8px",
                    backgroundColor: BORDE_SUAVE,
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Adjuntar Evidencia
                </button>
                {archivoEvidencia && (
                  <Text fontSize="12px" color={TEAL} fontWeight="bold">
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
                  <img
                    src={previewEvidencia}
                    alt="Vista previa de la evidencia"
                    style={{
                      maxWidth: "160px",
                      maxHeight: "160px",
                      borderRadius: "8px",
                      border: "2px solid #90BEBB",
                      display: "block",
                    }}
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
                    borderRadius="full"
                    bg={PELIGRO}
                    color="white"
                    fontWeight="bold"
                    lineHeight="1"
                    _hover={{ bg: PELIGRO_HOVER }}
                  >
                    ✕
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Table.Cell>

        <Table.Cell style={{ ...estiloCelda, textAlign: "center" }}>
          {isLoading ? (
            <Spinner size="sm" color={TEAL} />
          ) : esFuturo ? (
            <Text fontSize="13px" color="gray.400">
              —
            </Text>
          ) : esHistorico ? (
            <Text
              fontSize="17px"
              fontWeight="bold"
              color={tarea.completado ? EXITO_ALT : PELIGRO_TEXTO}
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
              <input
                type="checkbox"
                checked={tarea.completado}
                onChange={handleCheckboxClick}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              {tarea.evidencia_url && (
                <button
                  type="button"
                  onClick={() => setMostrarFoto(true)}
                  style={{
                    fontSize: "11px",
                    color: TEAL,
                    background: "none",
                    border: "none",
                    textDecoration: "underline",
                    fontWeight: "bold",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Ver foto
                </button>
              )}
              {tarea.registro_id > 0 && (
                <button
                  type="button"
                  onClick={verHistorial}
                  style={{
                    fontSize: "11px",
                    color: TEXTO_TENUE,
                    background: "none",
                    border: "none",
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Historial
                </button>
              )}
            </Box>
          )}
        </Table.Cell>
      </Table.Row>

      {mostrarFoto && (
        <Box
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
          }}
        >
          <Box
            style={{
              backgroundColor: "white",
              padding: "25px",
              borderRadius: "12px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
              maxWidth: "90%",
              maxHeight: "90%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "15px",
            }}
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
              <img
                src={imagen.src}
                alt="Evidencia fotográfica"
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: "8px",
                }}
              />
            )}
            <Button
              onClick={() => setMostrarFoto(false)}
              style={{
                backgroundColor: TEAL,
                color: "white",
                padding: "8px 24px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Volver
            </Button>
          </Box>
        </Box>
      )}

      {historial && (
        <Box
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2100,
            padding: "20px",
          }}
        >
          <Box
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "10px",
              maxWidth: "480px",
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <Text fontWeight="bold" mb="12px">
              Historial de cambios — {tarea.nombre}
            </Text>
            {cargandoHistorial ? (
              <Spinner size="sm" color={TEAL} />
            ) : historial.length === 0 ? (
              <Text fontSize="13px" color="gray.500">
                Sin eventos registrados todavía.
              </Text>
            ) : (
              historial.map((ev) => (
                <Box
                  key={ev.id}
                  style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}
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
            <Button mt="12px" onClick={() => setHistorial(null)}>
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
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px" flexWrap="wrap" gap="15px">
        <Box>
          <Heading as="h2" size="md" fontWeight="bold" color="black">
            Checklist Diario de Limpieza
          </Heading>
          <Text color="gray.600" fontSize="14px" mt="2px">
            Control, persistencia e historial auditable por fecha, para todos los equipos.
          </Text>
        </Box>
        <Button
          bg={GRIS_CLARO}
          color={TEXTO_PRIMARIO}
          fontSize="14px"
          fontWeight="bold"
          height="auto"
          onClick={recargar}
          style={{ padding: "8px 16px", borderRadius: "6px" }}
        >
          Actualizar
        </Button>
      </HStack>

      <Box
        bg="white"
        p="20px"
        borderRadius="10px"
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
              color={TEXTO_SECUNDARIO}
            >
              FECHA
            </Box>
            <Input
              type="date"
              value={selectedFecha}
              onChange={(e) => setSelectedFecha(e.target.value)}
              style={estiloInputCompacto}
            />
          </Field.Root>
        </Box>
      </Box>

      {error && (
        <Box
          style={{
            backgroundColor: ERROR_FONDO,
            color: ERROR_TEXTO,
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #f5c6cb",
            fontWeight: "bold",
          }}
        >
          ⚠️ {error}
        </Box>
      )}

      {loading && (
        <HStack justify="center" p={10}>
          <Spinner size="lg" color={TEAL} />
          <Text color="gray.600">Cargando tareas...</Text>
        </HStack>
      )}

      {!loading && grupos.length === 0 && !error && (
        <Box bg="white" borderRadius="8px" p={10} textAlign="center">
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
              <Box key={grupo.key} style={estiloTarjeta} mb="20px">
                <Box
                  onClick={() => toggleGrupo(grupo.key)}
                  role="button"
                  aria-expanded={!colapsado}
                  style={{
                    backgroundColor: TEAL,
                    padding: "12px 16px",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <HStack justify="space-between">
                    <HStack gap="10px">
                      <Text
                        fontSize="13px"
                        color="white"
                        style={{
                          transform: colapsado
                            ? "rotate(-90deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.15s ease",
                          display: "inline-block",
                        }}
                      >
                        ▾
                      </Text>
                      <Box>
                        <Text fontSize="15px" fontWeight="bold" color="white">
                          {grupo.planNombre}
                        </Text>
                        <Text fontSize="12px" color="#DCEEEC" mt="2px">
                          Equipo: {grupo.equipoNombre}
                        </Text>
                      </Box>
                    </HStack>

                    {grupo.tareas[0]?.checklist_estado === "cerrado" && (
                      <Text
                        fontSize="11px"
                        fontWeight="bold"
                        color="white"
                        style={{
                          backgroundColor: "rgba(0,0,0,0.25)",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        🔒 Cerrado (histórico)
                      </Text>
                    )}

                    {grupo.tareas[0]?.registro_id === 0 && (
                      <Text
                        fontSize="11px"
                        fontWeight="bold"
                        color="white"
                        style={{
                          backgroundColor: "rgba(0,0,0,0.25)",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        📅 Vista previa
                      </Text>
                    )}
                  </HStack>
                </Box>

                {!colapsado && (
                  <Table.Root
                    style={{ width: "100%", borderCollapse: "collapse" }}
                  >
                    <Table.Header>
                      <Table.Row style={estiloHeaderFila}>
                        <Table.ColumnHeader style={estiloHeaderCelda}>
                          Tarea
                        </Table.ColumnHeader>
                        <Table.ColumnHeader
                          style={{
                            ...estiloHeaderCelda,
                            textAlign: "center",
                            width: "140px",
                          }}
                        >
                          Completada
                        </Table.ColumnHeader>
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
              </Box>
            );
          })}
        </>
      )}
    </Box>
  );
}
