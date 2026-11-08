import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Badge, Box, Button, Flex, Input, Spinner, Table, Text } from '@chakra-ui/react';
import { BannerError, Paginacion, Tarjeta, EncabezadoOscuro, FilaEncabezado, FormField, FormNativeSelect } from '../../../../components/ui/patrones';
import { ChipsFiltros, chipsDeFiltros } from '../../../../components/ui/filtros';
import { useAuditoria } from '../../hooks/useAuditoria';
import { exportarAuditoria, listarEntidades, type FormatoExportacion } from '../../services/auditoriaService';
import type { AccionAuditoria } from '../../types/auditoria';
import { Pagina } from "../../../../components/ui/plantillas";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const TZ = 'America/Argentina/Buenos_Aires';

// Columnas de la tabla (la primera es el botón de expandir).
const COLUMNAS = 8;

// Texto con el que el backend reemplaza las columnas sensibles (p. ej. password).
const MASCARA = '***';

// Espera (ms) tras la última modificación de un filtro antes de consultar.
// Evita una consulta por cada tecla en los campos de texto.
const DEBOUNCE_FILTROS_MS = 400;

// Campos que, si existen, sirven para nombrar al registro en el resumen.
const CAMPOS_IDENTIFICADORES = ['nombre', 'descripcion', 'titulo', 'codigo', 'apellido', 'email'];

const COLOR_ACCION: Record<AccionAuditoria, string> = {
  CREAR: 'green',
  MODIFICAR: 'blue',
  BAJA: 'orange',
  REACTIVAR: 'teal',
  ELIMINAR: 'red',
};

const ETIQUETA_ACCION: Record<AccionAuditoria, string> = {
  CREAR: 'Alta',
  MODIFICAR: 'Modificación',
  BAJA: 'Baja',
  REACTIVAR: 'Reactivación',
  ELIMINAR: 'Eliminación',
};

type ItemAuditoria = ReturnType<typeof useAuditoria>['items'][number];
type Cambios = Record<string, [unknown, unknown]> | null;
type CambiosDetalle = Record<string, { antes: unknown; despues: unknown; antes_nombre?: string | null; despues_nombre?: string | null }> | null;

/** Etiqueta de campo sin sufijo "id" para campos FK (p. ej. "Persona" en vez de "Persona id"). */
const SIGLAS: Record<string, string> = { dni: 'DNI', cuil: 'CUIL', cuit: 'CUIT' };

function etiquetaCampo(campo: string): string {
  const base = campo.replace(/_id$/, '');
  return SIGLAS[base] ?? humanizar(base);
}

interface Filtros {
  accion: AccionAuditoria | '';
  entidad: string;
  entidadId: string;
  usuarioId: string;
  desde: string;
  hasta: string;
}

const FILTROS_VACIOS: Filtros = {
  accion: '',
  entidad: '',
  entidadId: '',
  usuarioId: '',
  desde: '',
  hasta: '',
};

/* ------------------------------------------------------------------ */
/* Formato                                                             */
/* ------------------------------------------------------------------ */

/**
 * El backend guarda las fechas en UTC "naive": llegan sin "Z" ni offset.
 * Sin sufijo el navegador las interpreta como hora local y el cambio de
 * zona horaria las muestra corridas 3 horas. Acá se fuerza UTC.
 */
function parsearFecha(iso: string): Date | null {
  const tieneZona = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  const d = new Date(tieneZona ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatearSoloFecha(iso: string): string {
  const d = parsearFecha(iso);
  if (!d) return iso;
  return d.toLocaleDateString('es-AR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatearSoloHora(iso: string): string {
  const d = parsearFecha(iso);
  if (!d) return '';
  return d.toLocaleTimeString('es-AR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

function mismosFiltros(a: Filtros, b: Filtros): boolean {
  return (Object.keys(a) as (keyof Filtros)[]).every((k) => a[k] === b[k]);
}

function formatearFechaLarga(iso: string): string {
  const d = parsearFecha(iso);
  if (!d) return iso;
  return d.toLocaleString('es-AR', {
    timeZone: TZ,
    dateStyle: 'full',
    timeStyle: 'long',
  });
}

/** "unidades_medida" / "insumoQuimico" -> "Unidades medida" / "Insumo quimico". */
function humanizar(texto: string): string {
  const t = texto
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Valor listo para mostrar; null significa "vacío". */
function formatearValor(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor === MASCARA) return '•••••• (dato protegido)';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

function valorCorto(valor: unknown, max = 40): string {
  const t = formatearValor(valor) ?? 'vacío';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/** Nombre del registro (p. ej. `nombre "Balanza 3"`) si algún campo lo permite. */
function identificador(cambios: Cambios | CambiosDetalle, lado: 0 | 1): string | null {
  const esEnriquecido = (c: Cambios | CambiosDetalle) =>
    c && Object.values(c).some((v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v) && 'antes' in v);
  const det = esEnriquecido(cambios) ? (cambios as CambiosDetalle) : null;
  for (const clave of CAMPOS_IDENTIFICADORES) {
    const campo = det?.[clave] ?? cambios?.[clave];
    if (!campo) continue;
    const valor = lado === 0 ? (Array.isArray(campo) ? campo[0] : campo.antes) : (Array.isArray(campo) ? campo[1] : campo.despues);
    const nombre = lado === 0 ? (Array.isArray(campo) ? undefined : campo.antes_nombre) : (Array.isArray(campo) ? undefined : campo.despues_nombre);
    if (formatearValor(valor)) {
      return nombre ? `${nombre} (#${valor})` : `${humanizar(clave).toLowerCase()} "${valorCorto(valor, 30)}"`;
    }
  }
  return null;
}

/** Nombres de las entidades relacionadas (FKs resueltas) de un evento, unidos con " · ". */
function nombresRelacionados(cambios: Cambios | CambiosDetalle, lado: 0 | 1): string | null {
  if (!cambios) return null;
  const nombres = Object.values(cambios)
    .map((v) => (Array.isArray(v) ? null : lado === 0 ? v?.antes_nombre : v?.despues_nombre))
    .filter(Boolean);
  return nombres.length > 0 ? nombres.join(' · ') : null;
}

function resumenModificacion(campos: [string, [unknown, unknown]][] | [string, { antes: unknown; despues: unknown; antes_nombre?: string | null; despues_nombre?: string | null }][]): string {
  const visibles = campos.filter(([, v]) => {
    const a = Array.isArray(v) ? v[0] : v.antes;
    const d = Array.isArray(v) ? v[1] : v.despues;
    return a !== d;
  });
  if (visibles.length === 0) return 'Sin cambios visibles';
  const partes = visibles.slice(0, 2).map(([campo, v]) => {
    const antes = Array.isArray(v) ? v[0] : v.antes;
    const despues = Array.isArray(v) ? v[1] : v.despues;
    const antesNom = Array.isArray(v) ? undefined : v.antes_nombre;
    const despuesNom = Array.isArray(v) ? undefined : v.despues_nombre;
    const aTexto = antesNom ? `${antesNom} (#${antes})` : valorCorto(antes, 24);
    const dTexto = despuesNom ? `${despuesNom} (#${despues})` : valorCorto(despues, 24);
    return `${etiquetaCampo(campo)}: ${aTexto} → ${dTexto}`;
  });
  const resto = visibles.length - partes.length;
  return partes.join(' · ') + (resto > 0 ? ` · +${resto} más` : '');
}

/** Resumen de UNA línea para la tabla; el detalle completo está en la fila expandida. */
function resumenCambios(
  cambios: Cambios | CambiosDetalle,
  accion: AccionAuditoria,
  etiqueta?: string | null,
): string {
  if (!cambios || Object.keys(cambios).length === 0) return 'Sin detalle';
  const campos = Object.entries(cambios);

  switch (accion) {
    case 'CREAR': {
      const id = etiqueta ?? identificador(cambios, 1) ?? nombresRelacionados(cambios, 1);
      return `Alta${id ? ` de ${id}` : ''} · ${plural(campos.length, 'campo', 'campos')}`;
    }
    case 'ELIMINAR': {
      const id = etiqueta ?? identificador(cambios, 0) ?? nombresRelacionados(cambios, 0);
      return `Eliminación${id ? ` de ${id}` : ''} · ${plural(campos.length, 'campo', 'campos')}`;
    }
    case 'BAJA':
    case 'REACTIVAR': {
      const base = `${accion === 'BAJA' ? 'Baja lógica' : 'Reactivación'}${etiqueta ? ` de ${etiqueta}` : ''}`;
      const otros = campos.filter(([campo]) => campo !== 'activo');
      return otros.length === 0 ? base : `${base} · ${resumenModificacion(otros)}`;
    }
    default:
      return etiqueta
        ? `${etiqueta} · ${resumenModificacion(campos)}`
        : resumenModificacion(campos);
  }
}

function nombreUsuario(item: ItemAuditoria): string | null {
  if (item.usuario_nombre) return item.usuario_nombre;
  if (item.usuario_id) return `Usuario #${item.usuario_id}`;
  return null;
}

/* ------------------------------------------------------------------ */
/* Piezas de la fila                                                   */
/* ------------------------------------------------------------------ */


function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <Box minW="150px">
      <Text fontSize="xs" color="fg.muted" mb="0.5">
        {etiqueta}
      </Text>
      <Text as="div" fontSize="sm" fontWeight="medium">
        {children}
      </Text>
    </Box>
  );
}

function DetalleEvento({
  item,
  onVerRegistro,
  onVerUsuario,
}: {
  item: ItemAuditoria;
  onVerRegistro: () => void;
  onVerUsuario: () => void;
}) {
  const cambiosDetalle = item.cambios_detalle;
  const camposRaw = cambiosDetalle
    ? Object.entries(cambiosDetalle)
    : item.cambios
      ? Object.entries(item.cambios)
      : [];
  const mostrarAntes = item.accion !== 'CREAR';
  const mostrarDespues = item.accion !== 'ELIMINAR';
  const usuario = nombreUsuario(item);

  return (
    <Box>
      <Flex gap="6" flexWrap="wrap" mb="4">
        <Dato etiqueta="Evento">#{item.id}</Dato>
        <Dato etiqueta="Fecha y hora">{formatearFechaLarga(item.fecha)}</Dato>
        <Dato etiqueta="Realizado por">
          {usuario ?? 'Sistema o script (sin usuario)'}
        </Dato>
        <Dato etiqueta="Entidad">{humanizar(item.entidad)}</Dato>
        <Dato etiqueta="ID del registro">
          <Text as="span" fontFamily="mono">
            {item.entidad_id}
          </Text>
        </Dato>
        <Dato etiqueta="Acción">
          <Badge colorPalette={COLOR_ACCION[item.accion]} variant="subtle">
            {ETIQUETA_ACCION[item.accion]}
          </Badge>
        </Dato>
      </Flex>

      {item.registro && (item.registro.etiqueta || item.registro.datos.length > 0) && (
        <Box mb="4" p="3" bg="bg" borderWidth="1px" borderRadius="md">
          <Text fontSize="xs" color="fg.muted" mb="1">
            Registro afectado
          </Text>
          {item.registro.etiqueta && (
            <Text fontSize="md" fontWeight="semibold" mb={item.registro.datos.length > 0 ? '2' : '0'}>
              {item.registro.etiqueta}
            </Text>
          )}
          {item.registro.datos.length > 0 && (
            <Flex gap="6" flexWrap="wrap">
              {item.registro.datos.map((d) => (
                <Dato key={d.campo} etiqueta={etiquetaCampo(d.campo)}>
                  {d.valor_nombre
                    ? `${d.valor_nombre} (#${d.valor})`
                    : (formatearValor(d.valor) ?? '—')}
                </Dato>
              ))}
            </Flex>
          )}
        </Box>
      )}

      <Flex gap="2" flexWrap="wrap" mb="4">
        <Button size="xs" variant="outline" onClick={onVerRegistro}>
          Ver historial de este registro
        </Button>
        {item.usuario_id ? (
          <Button size="xs" variant="outline" onClick={onVerUsuario}>
            Ver cambios de este usuario
          </Button>
        ) : null}
      </Flex>

      {camposRaw.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          Este evento no tiene campos registrados.
        </Text>
      ) : (
        <Box overflowX="auto" bg="bg" borderWidth="1px" borderRadius="md">
          <Table.Root size="sm" tableLayout="fixed" w="100%" minW="600px">
            <colgroup>
              <col style={{ width: '220px' }} />
              {mostrarAntes && <col />}
              {mostrarDespues && <col />}
            </colgroup>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Campo</Table.ColumnHeader>
                {mostrarAntes && (
                  <Table.ColumnHeader>{mostrarDespues ? 'Antes' : 'Valor eliminado'}</Table.ColumnHeader>
                )}
                {mostrarDespues && (
                  <Table.ColumnHeader>{mostrarAntes ? 'Después' : 'Valor inicial'}</Table.ColumnHeader>
                )}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {camposRaw.map(([campo, v]) => {
                const esEnriquecido = !Array.isArray(v) && typeof v === 'object' && v !== null && 'antes' in v;
                const antes = esEnriquecido ? (v as { antes: unknown }).antes : (v as [unknown, unknown])[0];
                const despues = esEnriquecido ? (v as { despues: unknown }).despues : (v as [unknown, unknown])[1];
                const antesNombre = esEnriquecido ? (v as { antes_nombre?: string }).antes_nombre : undefined;
                const despuesNombre = esEnriquecido ? (v as { despues_nombre?: string }).despues_nombre : undefined;

                return (
                  <Table.Row key={campo}>
                    <Table.Cell fontWeight="medium" verticalAlign="top">
                      {etiquetaCampo(campo)}
                    </Table.Cell>
                    {mostrarAntes && (
                      <Table.Cell verticalAlign="top">
                        <ValorConNombre valor={antes} nombre={antesNombre} color={mostrarDespues ? 'red.fg' : undefined} />
                      </Table.Cell>
                    )}
                    {mostrarDespues && (
                      <Table.Cell verticalAlign="top">
                        <ValorConNombre valor={despues} nombre={despuesNombre} color={mostrarAntes ? 'green.fg' : undefined} />
                      </Table.Cell>
                    )}
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
    </Box>
  );
}

/** Valor con nombre opcional: si hay nombre, muestra "Nombre (#id)"; si no, solo el valor. */
function ValorConNombre({ valor, nombre, color }: { valor: unknown; nombre?: string | null; color?: string }) {
  const base = formatearValor(valor);
  if (base === null) {
    return (
      <Text as="span" fontSize="sm" color="fg.subtle" fontStyle="italic">
        vacío
      </Text>
    );
  }
  const mostrarNombre = Boolean(nombre);
  return (
    <Text as="span" fontSize="xs" fontFamily="mono" whiteSpace="pre-wrap" wordBreak="break-word" color={color}>
      {mostrarNombre ? `${nombre} (#${valor})` : base}
    </Text>
  );
}

interface FilaProps {
  item: ItemAuditoria;
  abierto: boolean;
  onToggle: () => void;
  onVerRegistro: () => void;
  onVerUsuario: () => void;
}

function FilaAuditoria({ item, abierto, onToggle, onVerRegistro, onVerUsuario }: FilaProps) {
  const resumen = resumenCambios(item.cambios_detalle ?? item.cambios, item.accion, item.registro?.etiqueta);
  const usuario = nombreUsuario(item);
  const fecha = formatearSoloFecha(item.fecha);
  const hora = formatearSoloHora(item.fecha);
  const entidad = humanizar(item.entidad);

  return (
    <Fragment>
      <Table.Row
        h="12"
        cursor="pointer"
        onClick={onToggle}
        bg={abierto ? 'bg.subtle' : undefined}
        _hover={{ bg: 'bg.muted' }}
      >
        <Table.Cell px="2" textAlign="center">
          <Button
            size="xs"
            variant="ghost"
            aria-label={abierto ? 'Ocultar detalle' : 'Ver detalle'}
            aria-expanded={abierto}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {abierto ? '▾' : '▸'}
          </Button>
        </Table.Cell>
        <Table.Cell>
          <Text fontSize="sm" truncate title={fecha} fontVariantNumeric="tabular-nums">
            {fecha}
          </Text>
        </Table.Cell>
        <Table.Cell>
          <Text fontSize="sm" truncate title={hora} fontVariantNumeric="tabular-nums">
            {hora}
          </Text>
        </Table.Cell>
        <Table.Cell>
          {usuario ? (
            <Text fontSize="sm" truncate title={usuario}>
              {usuario}
            </Text>
          ) : (
            <Badge variant="outline" colorPalette="gray">
              Sistema
            </Badge>
          )}
        </Table.Cell>
        <Table.Cell>
          <Text fontSize="sm" truncate title={item.entidad}>
            {entidad}
          </Text>
        </Table.Cell>
        <Table.Cell>
          <Text fontSize="sm" fontFamily="mono" truncate title={item.entidad_id}>
            {item.entidad_id}
          </Text>
        </Table.Cell>
        <Table.Cell>
          <Badge colorPalette={COLOR_ACCION[item.accion]} variant="subtle">
            {ETIQUETA_ACCION[item.accion]}
          </Badge>
        </Table.Cell>
        <Table.Cell>
          <Text fontSize="sm" color="fg.muted" truncate title={resumen}>
            {resumen}
          </Text>
        </Table.Cell>
      </Table.Row>

      {abierto && (
        <Table.Row>
          <Table.Cell colSpan={COLUMNAS} bg="bg.subtle" px="6" py="4">
            <DetalleEvento item={item} onVerRegistro={onVerRegistro} onVerUsuario={onVerUsuario} />
          </Table.Cell>
        </Table.Row>
      )}
    </Fragment>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export function AuditoriaPage() {
  const { items, total, loading, error, cargar } = useAuditoria();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  // `borrador` es lo que se está tipeando; `filtros` es lo que se aplicó.
  // Los filtros se aplican solos: al cambiar `borrador` se espera un instante
  // (debounce) y recién ahí se actualiza `filtros`, que dispara la consulta.
  const [borrador, setBorrador] = useState<Filtros>(FILTROS_VACIOS);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [entidades, setEntidades] = useState<string[]>([]);
  const [abiertoId, setAbiertoId] = useState<number | null>(null);
  const [exportando, setExportando] = useState<FormatoExportacion | null>(null);
  const [errorExport, setErrorExport] = useState<string | null>(null);

  const exportar = async (formato: FormatoExportacion) => {
    setExportando(formato);
    setErrorExport(null);
    try {
      await exportarAuditoria(
        {
          accion: filtros.accion || undefined,
          entidad: filtros.entidad || undefined,
          entidad_id: filtros.entidadId || undefined,
          usuario_id: filtros.usuarioId ? Number(filtros.usuarioId) : undefined,
          desde: filtros.desde || undefined,
          hasta: filtros.hasta || undefined,
        },
        formato,
      );
    } catch (e) {
      setErrorExport(e instanceof Error ? e.message : 'Error al exportar la auditoría');
    } finally {
      setExportando(null);
    }
  };

  useEffect(() => {
    listarEntidades().then(setEntidades).catch(() => setEntidades([]));
  }, []);

  useEffect(() => {
    cargar({
      page,
      page_size: pageSize,
      accion: filtros.accion || undefined,
      entidad: filtros.entidad || undefined,
      entidad_id: filtros.entidadId || undefined,
      usuario_id: filtros.usuarioId ? Number(filtros.usuarioId) : undefined,
      desde: filtros.desde || undefined,
      hasta: filtros.hasta || undefined,
    });
  }, [page, pageSize, filtros, cargar]);

  // Al cambiar de página o de filtros se cierra el detalle abierto.
  const [itemsPrevios, setItemsPrevios] = useState(items);
  if (items !== itemsPrevios) {
    setItemsPrevios(items);
    setAbiertoId(null);
  }

  const actualizar = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) =>
    setBorrador((prev) => ({ ...prev, [campo]: valor }));

  const rangoInvalido = !!borrador.desde && !!borrador.hasta && borrador.desde > borrador.hasta;

  // Aplicación automática de los filtros.
  useEffect(() => {
    if (rangoInvalido) return;
    const nuevos = { ...borrador, entidadId: borrador.entidadId.trim() };
    if (mismosFiltros(nuevos, filtros)) return;
    const t = setTimeout(() => {
      setFiltros(nuevos);
      setPage(1);
    }, DEBOUNCE_FILTROS_MS);
    return () => clearTimeout(t);
  }, [borrador, filtros, rangoInvalido]);

  // Enter dentro de un campo aplica de inmediato, sin esperar al debounce.
  const aplicar = () => {
    if (rangoInvalido) return;
    const nuevos = { ...borrador, entidadId: borrador.entidadId.trim() };
    if (mismosFiltros(nuevos, filtros)) return;
    setFiltros(nuevos);
    setPage(1);
  };

  const limpiar = () => {
    setBorrador(FILTROS_VACIOS);
    setFiltros(FILTROS_VACIOS);
    setPage(1);
  };

  const filtrarPor = (parcial: Partial<Filtros>) => {
    const nuevos = { ...FILTROS_VACIOS, ...parcial };
    setBorrador(nuevos);
    setFiltros(nuevos);
    setPage(1);
  };

  const quitarFiltro = (campo: keyof Filtros) => {
    setBorrador((prev) => ({ ...prev, [campo]: '' }));
    setFiltros((prev) => ({ ...prev, [campo]: '' }));
    setPage(1);
  };

  const fechaChip = (iso: string) => iso.split('-').reverse().join('/');

  const chips = chipsDeFiltros([
    {
      clave: 'entidad',
      etiqueta: 'Entidad',
      valor: filtros.entidad ? humanizar(filtros.entidad) : '',
      onQuitar: () => quitarFiltro('entidad'),
    },
    {
      clave: 'entidadId',
      etiqueta: 'ID Entidad',
      valor: filtros.entidadId,
      recortar: true,
      onQuitar: () => quitarFiltro('entidadId'),
    },
    {
      clave: 'usuarioId',
      etiqueta: 'Usuario ID',
      valor: filtros.usuarioId,
      onQuitar: () => quitarFiltro('usuarioId'),
    },
    {
      clave: 'accion',
      etiqueta: 'Acción',
      valor: filtros.accion ? ETIQUETA_ACCION[filtros.accion] : '',
      onQuitar: () => quitarFiltro('accion'),
    },
    {
      clave: 'desde',
      etiqueta: 'Desde',
      valor: filtros.desde ? fechaChip(filtros.desde) : '',
      onQuitar: () => quitarFiltro('desde'),
    },
    {
      clave: 'hasta',
      etiqueta: 'Hasta',
      valor: filtros.hasta ? fechaChip(filtros.hasta) : '',
      onQuitar: () => quitarFiltro('hasta'),
    },
  ]);

  const primero = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const ultimo = Math.min(page * pageSize, total);
  const hayFiltrosAplicados = Object.values(filtros).some(Boolean);

  return (
    <Pagina
      titulo="Auditoría"
      descripcion="Bitácora de cambios de todas las entidades del sistema. Requiere rol de administrador."
    >
      {error && <BannerError mb="4">{error}</BannerError>}
      {errorExport && <BannerError mb="4">{errorExport}</BannerError>}

      <Tarjeta p="4" mb="4">
        <Box
          as="form"
          onSubmit={(e) => {
            e.preventDefault();
            aplicar();
          }}
        >
          <Flex gap="4" flexWrap="wrap" align="end">
            <Box maxW="220px" w="100%">
              <FormField label="Entidad" mb="4">
                <FormNativeSelect value={borrador.entidad} onChange={(e) => actualizar('entidad', e.target.value)}>
                  <option value="">Todas</option>
                  {entidades.map((e) => (
                    <option key={e} value={e}>
                      {humanizar(e)}
                    </option>
                  ))}
                </FormNativeSelect>
              </FormField>
            </Box>
            <Box maxW="200px" w="100%">
              <FormField label="ID Entidad" mb="4">
                <Input
                  value={borrador.entidadId}
                  onChange={(e) => actualizar('entidadId', e.target.value)}
                  placeholder="PK"
                />
              </FormField>
            </Box>
            <Box maxW="200px" w="100%">
              <FormField label="Usuario ID" mb="4">
                <Input
                  value={borrador.usuarioId}
                  inputMode="numeric"
                  onChange={(e) => actualizar('usuarioId', e.target.value.replace(/\D/g, ''))}
                  placeholder="opcional"
                />
              </FormField>
            </Box>
            <Box maxW="160px" w="100%">
              <FormField label="Acción" mb="4">
                <FormNativeSelect
                  value={borrador.accion}
                  onChange={(e) => actualizar('accion', e.target.value as AccionAuditoria | '')}
                >
                  <option value="">Todas</option>
                  <option value="CREAR">Alta</option>
                  <option value="MODIFICAR">Modificación</option>
                  <option value="BAJA">Baja</option>
                  <option value="REACTIVAR">Reactivación</option>
                  <option value="ELIMINAR">Eliminación</option>
                </FormNativeSelect>
              </FormField>
            </Box>
            <Box maxW="180px" w="100%">
              <FormField label="Desde" mb="4">
                <Input type="date" value={borrador.desde} onChange={(e) => actualizar('desde', e.target.value)} />
              </FormField>
            </Box>
            <Box maxW="180px" w="100%">
              <FormField label="Hasta" mb="4">
                <Input type="date" value={borrador.hasta} onChange={(e) => actualizar('hasta', e.target.value)} />
              </FormField>
            </Box>
            <Flex gap="2" mb="4">
              {(['csv', 'pdf'] as const).map((f) => (
                <Button
                  key={f}
                  type="button"
                  variant="outline"
                  onClick={() => exportar(f)}
                  loading={exportando === f}
                  disabled={total === 0 || exportando !== null}
                >
                  Exportar {f === 'csv' ? 'CSV' : 'PDF'}
                </Button>
              ))}
            </Flex>
          </Flex>
          {rangoInvalido && (
            <Text fontSize="sm" color="red.fg">
              La fecha «Desde» no puede ser posterior a «Hasta».
            </Text>
          )}
        </Box>
      </Tarjeta>

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiar} />

      <Flex justify="space-between" align="center" mb="2" minH="6" gap="3">
        <Text fontSize="sm" color="fg.muted">
          {total > 0
            ? `Mostrando ${primero}–${ultimo} de ${plural(total, 'registro', 'registros')}`
            : loading
              ? 'Cargando…'
              : ''}
        </Text>
        {loading && items.length > 0 && <Spinner size="sm" />}
      </Flex>

      <Tarjeta overflowX="auto" opacity={loading && items.length > 0 ? 0.6 : 1} transition="opacity 0.15s">
        <Table.Root variant="outline" w="100%" minW="1000px" tableLayout="fixed">
          <colgroup>
            <col style={{ width: '56px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '180px' }} />
            <col style={{ width: '160px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '130px' }} />
            <col />
          </colgroup>
          <Table.Header>
            <FilaEncabezado>
              <EncabezadoOscuro>{'\u00A0'}</EncabezadoOscuro>
              <EncabezadoOscuro>Fecha</EncabezadoOscuro>
              <EncabezadoOscuro>Hora</EncabezadoOscuro>
              <EncabezadoOscuro>Usuario</EncabezadoOscuro>
              <EncabezadoOscuro>Entidad</EncabezadoOscuro>
              <EncabezadoOscuro>ID</EncabezadoOscuro>
              <EncabezadoOscuro>Acción</EncabezadoOscuro>
              <EncabezadoOscuro>Cambios</EncabezadoOscuro>
            </FilaEncabezado>
          </Table.Header>
          <Table.Body>
            {items.length === 0 && (
              <Table.Row h="24">
                <Table.Cell colSpan={COLUMNAS} textAlign="center">
                  {loading ? (
                    <Spinner />
                  ) : (
                    <Text color="fg.muted">
                      {hayFiltrosAplicados
                        ? 'No hay registros que coincidan con los filtros.'
                        : 'No hay registros.'}
                    </Text>
                  )}
                </Table.Cell>
              </Table.Row>
            )}
            {items.map((i) => (
              <FilaAuditoria
                key={i.id}
                item={i}
                abierto={abiertoId === i.id}
                onToggle={() => setAbiertoId((actual) => (actual === i.id ? null : i.id))}
                onVerRegistro={() => filtrarPor({ entidad: i.entidad, entidadId: i.entidad_id })}
                onVerUsuario={() => filtrarPor({ usuarioId: String(i.usuario_id ?? '') })}
              />
            ))}
          </Table.Body>
        </Table.Root>
      </Tarjeta>

      {total > 0 && (
        <Box mt="4">
          <Flex justify="space-between" align="center" gap="4" flexWrap="wrap">
            <Paginacion count={total} pageSize={pageSize} page={page} onPageChange={setPage} />
            <FormNativeSelect
              w="140px"
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} por página
                </option>
              ))}
            </FormNativeSelect>
          </Flex>
        </Box>
      )}
    </Pagina>
  );
}
