// Verifica `pedir` contra Responses reales, que es donde estaba el bug:
// un body de Response solo se puede leer una vez.
function esDetalleInactivo(detail) {
  if (typeof detail !== "object" || detail === null) return false;
  const d = detail;
  return (
    d.tipo === "inactivo" &&
    typeof d.mensaje === "string" &&
    typeof d.id === "number" &&
    typeof d.campo === "string"
  );
}

function mensajeDesdeDetalle(detail, porDefecto) {
  if (typeof detail === "string" && detail.trim() !== "") return detail;
  if (Array.isArray(detail)) {
    const primero = detail[0];
    if (primero && typeof primero.msg === "string" && primero.msg.trim() !== "") {
      return primero.msg;
    }
  }
  return porDefecto;
}

class ConflictoInactivoError extends Error {
  constructor(message, entidadId, campo) {
    super(message);
    this.entidadId = entidadId;
    this.campo = campo;
  }
}

async function leerCuerpo(response) {
  return (await response.json().catch(() => null)) ?? null;
}

async function pedir(response, mensajePorDefecto) {
  if (response.status === 409) {
    const cuerpo = await leerCuerpo(response);
    const detail = cuerpo?.detail;
    if (esDetalleInactivo(detail)) {
      throw new ConflictoInactivoError(detail.mensaje, detail.id, detail.campo);
    }
    throw new Error(mensajeDesdeDetalle(detail, mensajePorDefecto));
  }
  if (!response.ok) {
    const cuerpo = await leerCuerpo(response);
    throw new Error(mensajeDesdeDetalle(cuerpo?.detail, mensajePorDefecto));
  }
  if (response.status === 204 || response.status === 205) return undefined;
  return await response.json();
}

const json = (cuerpo, status) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let ok = 0;
const fallos = [];
function check(desc, fn, esperado) {
  try {
    const r = fn();
    if (JSON.stringify(r) === JSON.stringify(esperado)) ok++;
    else fallos.push(`${desc}: devolvió ${JSON.stringify(r)}, esperado ${JSON.stringify(esperado)}`);
  } catch (e) {
    if (e instanceof ConflictoInactivoError) {
      if (e.entidadId === 7 && e.campo === "nombre") ok++;
      else fallos.push(`${desc}: ConflictoInactivoError con ${e.entidadId}/${e.campo}`);
    } else if (esperado instanceof Error) {
      if (e.message === esperado.message) ok++;
      else fallos.push(`${desc}: "${e.message}", esperado "${esperado.message}"`);
    } else {
      fallos.push(`${desc}: lanzó ${e.name}: ${e.message}`);
    }
  }
}

async function main() {
  // 1. el caso que rompía: 200 con array
  const lista = await pedir(json([{ id_notificacion: "elem-1" }], 200));
  check("200 array devuelve los datos", () => lista, [{ id_notificacion: "elem-1" }]);

  // 2. objeto suelto
  const persona = await pedir(json({ id: 1, nombre: "Ana" }, 200));
  check("200 objeto", () => persona.nombre, "Ana");

  // 3. array vacio (sin notificaciones)
  const vacio = await pedir(json([], 200));
  check("200 array vacio", () => vacio.length, 0);

  // 4. 204 delete
  const borrado = await pedir(new Response(null, { status: 204 }), "x");
  check("204 devuelve undefined", () => borrado === undefined, true);

  // 5. 401 con detail string
  await checkAsync("401 con detail", () => pedir(json({ detail: "Token inválido" }, 401), "x"), "Token inválido");
  // 6. 422 validacion (el caso del [object Object])
  await checkAsync(
    "422 muestra msg, no [object Object]",
    () => pedir(json({ detail: [{ loc: ["body", "dni"], msg: "El DNI es inválido" }] }, 422), "x"),
    "El DNI es inválido",
  );
  // 7. 409 inactivo
  await checkAsync(
    "409 inactivo",
    () => pedir(json({ detail: { tipo: "inactivo", mensaje: "Reactivar?", id: 7, campo: "nombre" } }, 409), "x"),
    "Reactivar?",
  );
  // 8. 500 con body HTML (no JSON)
  await checkAsync(
    "500 con HTML cae al mensaje por defecto",
    () => pedir(new Response("<html>error</html>", { status: 500 }), "Error genérico"),
    "Error genérico",
  );
  // 9. error sin detail
  await checkAsync("422 sin detail", () => pedir(json({}, 400), "Por defecto"), "Por defecto");

  console.log(`${ok} ok, ${fallos.length} fallos`);
  for (const f of fallos) console.log("  FALLA:", f);
  process.exit(fallos.length ? 1 : 0);
}

async function checkAsync(desc, fn, esperado) {
  try {
    const r = await fn();
    fallos.push(`${desc}:_no_lanzó_ (devolvió ${JSON.stringify(r)})`);
  } catch (e) {
    if (e.message === esperado) ok++;
    else fallos.push(`${desc}: "${e.message}", esperado "${esperado}"`);
  }
}

main();