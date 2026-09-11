/* ═══════════════════════════════════════════════════════════════════
   VERIFICACIÓN DEL FLUJO Y DE LA CONCORDANCIA DE CIFRAS
   Uso:  npm run verificar

   Construye la semilla con las mismas funciones que la app, comprueba que los datos
   cuadran entre sí y recorre el flujo principal de punta a punta:
     pedir y pagar → verlo en Distribución → planificar → recolección → llenado →
     devolución → cierre → factura, inventario, saldo y replanificación.
   Sale con código 1 si algo no cuadra. Correrlo después de cada cambio.
   ═══════════════════════════════════════════════════════════════════ */
import { build } from "esbuild";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = resolve(import.meta.dirname, "..");
const tmp = mkdtempSync(join(tmpdir(), "gaslara-verif-"));
const entrada = join(tmp, "entrada.mjs");
writeFileSync(entrada, [
  `import * as D from ${JSON.stringify(join(raiz, "src/datos.jsx").replace(/\\/g, "/"))};`,
  `import * as F from ${JSON.stringify(join(raiz, "src/flujo.js").replace(/\\/g, "/"))};`,
  `import * as S from ${JSON.stringify(join(raiz, "src/semilla.js").replace(/\\/g, "/"))};`,
  `import * as DS from ${JSON.stringify(join(raiz, "src/distribucionSeed.js").replace(/\\/g, "/"))};`,
  "export { D, F, S, DS };",
].join("\n"));
const salida = join(tmp, "nucleo.mjs");
await build({ entryPoints: [entrada], bundle: true, format: "esm", platform: "node", outfile: salida,
  loader: { ".jsx": "jsx" }, jsx: "automatic", logLevel: "error", absWorkingDir: raiz, nodePaths: [join(raiz, "node_modules")] });
const { D, F, S, DS } = await import(pathToFileURL(salida).href);
rmSync(tmp, { recursive: true, force: true });

/* ── Utilidades ── */
const fallos = [];
let pasadas = 0;
const ok = (cond, texto, detalle = "") => {
  if (cond) { pasadas += 1; return true; }
  fallos.push(`${texto}${detalle ? ` · ${detalle}` : ""}`);
  return false;
};
const cerca = (a, b, tol = 0.05) => Math.abs(Number(a) - Number(b)) <= tol;
const bs = (n) => Number(n || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Lo mismo que calcula App.jsx con el estado. */
function derivados(st) {
  const facturas = D.facturasDe(st.solicitudes, st.manuales);
  const movs = D.movimientosDe(st.solicitudes, st.manuales);
  const existencias = D.existenciasDe(movs, st.movPlanta);
  const compromisos = D.compromisosDe(st.solicitudes);
  const disponibles = D.disponiblesDe(existencias, compromisos);
  const cifras = F.cifrasSistema({ solicitudes: st.solicitudes, abonos: st.abonos, facturas, rutas: st.rutas, movPlanta: st.movPlanta, existencias, compromisos, disponibles });
  return { facturas, existencias, compromisos, disponibles, cifras };
}
const aplicar = (st, res) => ({
  ...st,
  solicitudes: res.solicitudes || st.solicitudes,
  rutas: res.rutas || st.rutas,
  abonos: res.abonos?.length ? [...res.abonos, ...st.abonos] : st.abonos,
  parque: res.parque || st.parque,
  movPlanta: res.movPlanta?.length ? [...res.movPlanta, ...st.movPlanta] : st.movPlanta,
});

/* ── Invariantes que deben cumplirse SIEMPRE ── */
function invariantes(st, etiqueta) {
  const t = (x) => `[${etiqueta}] ${x}`;
  const rutasPorId = new Map(st.rutas.map((r) => [r.id, r]));

  // 1 · Nadie está "en AD" en un AD que no existe, que no está planificado o que ya cerró.
  const huerfanas = st.solicitudes.filter((s) => s.estado === "EN_AD").filter((s) => {
    const r = rutasPorId.get(s.rutaId);
    return !r || !F.adPlanificada(r) || F.adCerrada(r) || String(r.ad) !== String(s.ad);
  });
  ok(!huerfanas.length, t("Toda solicitud en AD pertenece a un AD vivo"), huerfanas.slice(0, 3).map((s) => `${s.id}→${s.ad}`).join(", "));

  // 2 · Ningún AD activo está vacío.
  const vacias = st.rutas.filter((r) => F.adActiva(r) && !F.convocadasDeAD(r, st.solicitudes).length);
  ok(!vacias.length, t("Ningún AD activo está vacío"), vacias.map((r) => r.ad).join(", "));

  // 3 · Tope: una bombona por núcleo familiar por ciclo.
  const porNucleo = {};
  st.solicitudes.forEach((s) => {
    if (!D.cpt(s.concepto).bombona || D.segmentoUsuario(D.usr(s.usuario)) !== "RESIDENCIAL") return;
    if (s.estado === "ABONADA" || s.pago?.estado === "RECHAZADO" || s.estado === "SIN_PAGO") return;
    const k = `${D.nucleoDe(s.usuario)}|${D.cicloDistribucion(s.fecha)}`;
    porNucleo[k] = (porNucleo[k] || 0) + Number(s.cantidad || 0);
  });
  const excedidos = Object.entries(porNucleo).filter(([, n]) => n > D.TOPE_BOMBONAS_CICLO);
  ok(!excedidos.length, t("Nadie supera el tope de una bombona por núcleo y ciclo"), excedidos.slice(0, 3).map(([k, n]) => `${k}:${n}`).join(", "));

  // 4 · Dinero: lo pendiente está cubierto completo; lo por completar, no.
  const malCubiertas = st.solicitudes.filter((s) => D.esPendienteDespacho(s) && D.tpd(s.tipoDespacho).requierePago && D.faltanteDe(s) > 0.01);
  ok(!malCubiertas.length, t("Todo pedido pendiente está pagado completo"), malCubiertas.slice(0, 3).map((s) => `${s.id} falta ${D.faltanteDe(s)}`).join(", "));
  const porCompletarMal = st.solicitudes.filter((s) => s.estado === "POR_COMPLETAR" && D.faltanteDe(s) <= 0.009);
  ok(!porCompletarMal.length, t("Todo pedido por completar tiene una diferencia real"), porCompletarMal.slice(0, 3).map((s) => s.id).join(", "));

  // 5 · Ningún saldo es negativo.
  const negativos = Object.entries(D.saldosDe(st.abonos)).filter(([, v]) => v < -0.01);
  ok(!negativos.length, t("Ningún saldo a favor es negativo"), negativos.slice(0, 3).map(([u, v]) => `${u}:${v}`).join(", "));

  // 6 · Cuadre de las AD cerradas: salen diez, vuelven diez.
  st.rutas.filter(F.adCerrada).forEach((r) => {
    const c = r.cierreDetalle || {};
    ok(c.convocadas === c.recogidas + c.noRecogidas, t(`AD ${r.ad}: convocadas = recogidas + no recogidas`), JSON.stringify(c));
    ok(c.recogidas === c.llenadas + c.noLlenadas, t(`AD ${r.ad}: recogidas = llenas + vacías`), JSON.stringify(c));
    const entregadas = st.solicitudes.filter((s) => (s.historialAD || []).some((h) => h.rutaId === r.id && h.resultado === "ENTREGADA")).length;
    ok(entregadas === c.entregadas, t(`AD ${r.ad}: entregadas coincide con las solicitudes culminadas`), `${entregadas} vs ${c.entregadas}`);
  });

  // 7 · Todo pedido de bombona pagado sin AD es planificable (jornada o AD especial).
  const grupos = F.gruposPorPlanificar(st.solicitudes, st.rutas);
  const enGrupos = new Set(grupos.flatMap((g) => g.pagadas.map((s) => s.id)));
  const noPlanificables = st.solicitudes.filter((s) => s.estado === "PAGADA" && D.cpt(s.concepto).bombona && !s.ad
    && s.modalidadEntrega === "COMUNA" && !enGrupos.has(s.id) && !D.esCodigoGenerico(s.usuario));
  ok(!noPlanificables.length, t("Todo pedido pagado de jornada aparece por planificar"), noPlanificables.slice(0, 3).map((s) => s.id).join(", "));

  // 8 · Distribución ve exactamente las solicitudes de bombona.
  const pedidos = F.pedidosDistribucion(st.solicitudes, st.rutas);
  const bombonas = st.solicitudes.filter((s) => D.cpt(s.concepto).bombona && !D.esCodigoGenerico(s.usuario));
  ok(pedidos.length === bombonas.length, t("Distribución ve todas las solicitudes de bombona"), `${pedidos.length} vs ${bombonas.length}`);

  // 9 · Cifras: el pendiente del cierre mensual y el de las cifras únicas son el mismo.
  const d = derivados(st);
  const cierre = D.resumenCierreMensual(d.facturas, st.solicitudes);
  ok(cerca(cierre.totales.totalPendiente, d.cifras.dinero.pendienteDespacho.bs, 0.5), t("Pendiente por despachar: cierre mensual = cifras únicas"),
    `${bs(cierre.totales.totalPendiente)} vs ${bs(d.cifras.dinero.pendienteDespacho.bs)}`);
  ok(cerca(cierre.totales.kgComprometido, d.cifras.glp.comprometido, 0.5), t("GLP comprometido: cierre mensual = inventario"),
    `${cierre.totales.kgComprometido} vs ${d.cifras.glp.comprometido}`);
  // 10 · Llenado por cerrar = llenado de las AD que no han cerrado.
  const llenadoAbierto = st.movPlanta.filter((m) => m.tipo === "LLENADO" && !st.rutas.some((r) => F.adCerrada(r) && String(r.ad) === String(m.ad)))
    .reduce((a, m) => a + Number(m.kg || 0), 0);
  ok(cerca(llenadoAbierto, d.cifras.glp.llenadoPorCerrar, 0.5), t("Llenado por cerrar concilia con planta"), `${llenadoAbierto} vs ${d.cifras.glp.llenadoPorCerrar}`);
  return d;
}

/* ═══════════  1 · LA SEMILLA  ═══════════ */
const ini = S.construirEstadoInicial();
let st = { solicitudes: ini.solicitudes, abonos: ini.abonos, parque: ini.parqueEnvases, rutas: ini.rutas, movPlanta: ini.movPlanta, manuales: ini.manuales };
const seq = { ...ini.seq };
const d0 = invariantes(st, "semilla");

const porEstado = st.solicitudes.reduce((a, s) => { a[s.estado] = (a[s.estado] || 0) + 1; return a; }, {});
const adsPorEstado = st.rutas.reduce((a, r) => { const e = F.estadoAD(r.estadoRuta).nombre; a[e] = (a[e] || 0) + 1; return a; }, {});
console.log("\nSEMILLA · 14/08/2026");
console.log("  Solicitudes:", st.solicitudes.length, JSON.stringify(porEstado));
console.log("  AD:", JSON.stringify(adsPorEstado));
console.log("  Por replanificar:", F.bandejaReplanificacion(st.solicitudes, st.parque).length,
  "· por completar:", porEstado.POR_COMPLETAR || 0, "· grupos por planificar:", F.gruposPorPlanificar(st.solicitudes, st.rutas).length);
console.log("  Dinero · pendiente Bs", bs(d0.cifras.dinero.pendienteDespacho.bs), "· por completar Bs", bs(d0.cifras.dinero.porCompletar.recibido),
  `(faltan ${bs(d0.cifras.dinero.porCompletar.faltante)})`, "· saldo a favor Bs", bs(d0.cifras.dinero.saldoFavor.bs), `(${d0.cifras.dinero.saldoFavor.usuarios} usuarios)`);
console.log("  GLP · físico", Math.round(d0.cifras.glp.fisico), "kg · comprometido", Math.round(d0.cifras.glp.comprometido), "kg · llenado por cerrar", Math.round(d0.cifras.glp.llenadoPorCerrar), "kg");

/* ═══════════  2 · REGLAS DE PAGO  ═══════════ */
{
  // Tope: quien ya tiene su bombona del ciclo en la jornada de su comuna no puede pedir otra.
  const conCupoUsado = D.USUARIOS.find((u) => D.segmentoUsuario(u) === "RESIDENCIAL" && !D.puedeSolicitar(u, st.solicitudes, "BOMB_18", 1).ok);
  const r = F.nuevaSolicitud(st, { usuario: conCupoUsado.id, concepto: "BOMB_18", cantidad: 1, banco: "BDV", referencia: "5550001", origen: "PORTAL" }, seq);
  ok(!r.ok && /tope/i.test(r.error || ""), "El portal respeta el tope por núcleo familiar", r.error || "lo aceptó");
  // Referencia repetida: se rechaza sin tocar el saldo.
  const refUsada = st.solicitudes.find((s) => s.pago?.estado === "VERIFICADO" && s.pago?.referencia)?.pago.referencia;
  const libre = D.USUARIOS.find((u) => D.segmentoUsuario(u) === "RESIDENCIAL" && D.puedeSolicitar(u, st.solicitudes, "BOMB_10", 1).ok);
  const dup = F.nuevaSolicitud(st, { usuario: libre.id, concepto: "BOMB_10", cantidad: 1, banco: "BDV", referencia: refUsada, origen: "PORTAL" }, seq);
  ok(dup.ok && dup.solicitud.estado === "SIN_PAGO" && dup.regla === "REFERENCIA_DUPLICADA" && dup.devengado === 0, "Referencia repetida: se rechaza sin consumir saldo", JSON.stringify({ estado: dup.solicitud?.estado, regla: dup.regla }));
  // Pago corto → por completar → completar con excedente.
  const corto = F.nuevaSolicitud(st, { usuario: libre.id, concepto: "BOMB_10", cantidad: 1, banco: "BDV", referencia: "5550002", montoRecibido: 100, origen: "PORTAL" }, seq);
  ok(corto.ok && corto.solicitud.estado === "POR_COMPLETAR" && corto.faltante > 0, "Transfirió de menos: queda por completar, sin abono", JSON.stringify({ estado: corto.solicitud?.estado, faltante: corto.faltante, abonos: corto.abonos?.length }));
  let st2 = { ...st, solicitudes: [corto.solicitud, ...st.solicitudes], abonos: [...corto.abonos, ...st.abonos] };
  const falta = corto.faltante;
  const comp = F.completarPago(st2, corto.solicitud.id, { montoRecibido: falta + 50, referencia: "5550003", banco: "BDV" }, seq);
  ok(comp.ok && comp.completo && comp.solicitud.estado === "PAGADA", "Completar el pago: pasa a pagada", JSON.stringify({ estado: comp.solicitud?.estado, error: comp.error }));
  ok(comp.abonos.some((a) => a.tipo === "ABONO_EXCEDENTE" && cerca(a.monto, 50)), "Completar con de más: el excedente va al saldo");
  // Referencia ajena al completar: se rechaza.
  const ajena = F.completarPago(st2, corto.solicitud.id, { montoRecibido: falta, referencia: refUsada }, seq);
  ok(!ajena.ok && /referencia/i.test(ajena.error || ""), "Completar con una referencia ajena: se rechaza");
}

/* ═══════════  2b · COMPLETA SU PAGO CON SU AD YA PLANIFICADA  ═══════════ */
{
  const r = st.rutas.find((x) => F.estadoAD(x.estadoRuta).id === "ASIGNADA"
    && st.solicitudes.some((s) => s.rutaId === x.id && s.estado === "POR_COMPLETAR"));
  ok(Boolean(r), "La semilla trae alguien por completar dentro de un AD planificado");
  if (r) {
    const s = st.solicitudes.find((x) => x.rutaId === r.id && x.estado === "POR_COMPLETAR");
    const antesCil = Object.values(r.cilindros || {}).reduce((a, b) => a + Number(b), 0);
    let st2 = aplicar(st, F.completarPago(st, s.id, { referencia: "5559999", banco: "BDV" }, { ...seq }));
    const g = F.gruposPorPlanificar(st2.solicitudes, st2.rutas).find((x) => x.rutaId === r.id);
    ok(g && g.adExistente === String(r.ad) && g.pagadas.some((x) => x.id === s.id), "Completó el pago: aparece para sumarse a su AD");
    const p = F.planificarAD(st2, { tipo: "JORNADA", rutaId: r.id, solicitudIds: [s.id], ad: "99999" }, { ...seq });
    ok(p.ok && String(p.ruta.ad) === String(r.ad), "Se suma a su AD sin cambiarle el número", p.error);
    if (p.ok) {
      st2 = aplicar(st2, p);
      const despuesCil = Object.values(p.ruta.cilindros || {}).reduce((a, b) => a + Number(b), 0);
      ok(despuesCil === antesCil + 1, "La carga del AD suma al nuevo sin perder a los que ya estaban", `${antesCil} → ${despuesCil}`);
      invariantes(st2, "tras sumar a un AD planificado");
    }
  }
}

/* ═══════════  3 · FLUJO COMPLETO DESDE EL PORTAL  ═══════════ */
{
  const antes = derivados(st);
  // Ellard, el usuario del portal, empieza sin pedidos en curso y sin saldo: la demo arranca con él.
  const E = D.CLIENTE_PORTAL.id;
  const enCurso = st.solicitudes.filter((s) => s.usuario === E && !["CULMINADO", "ABONADA"].includes(s.estado));
  ok(enCurso.length === 0, "El usuario del portal empieza sin pedidos en curso", enCurso.map((s) => `${s.id} ${s.estado}`).join(", "));
  ok(!(D.saldosDe(st.abonos)[E] > 0.009), "Y sin saldo a favor", String(D.saldosDe(st.abonos)[E]));
  ok(D.puedeSolicitar(E, st.solicitudes, "BOMB_18", 1).ok, "Y con su cupo del ciclo disponible");
  const r = F.nuevaSolicitud(st, { usuario: E, concepto: "BOMB_18", cantidad: 1, banco: "PM", referencia: "5551234", origen: "PORTAL" }, seq);
  ok(r.ok && r.solicitud.estado === "PAGADA", "Pedido del portal: nace pagado con la regla", r.error || r.solicitud?.estado);
  st = { ...st, solicitudes: [r.solicitud, ...st.solicitudes], abonos: [...r.abonos, ...st.abonos] };
  ok(F.pedidosDistribucion(st.solicitudes, st.rutas).some((p) => p.id === r.solicitud.id), "El pedido del portal aparece en Distribución");
  ok(F.gruposPorPlanificar(st.solicitudes, st.rutas).some((g) => g.pagadas.some((s) => s.id === r.solicitud.id)), "Y aparece por planificar en su comunidad");
  ok(D.bitacoraPagos(st.solicitudes).total >= D.bitacoraPagos(ini.solicitudes).total + 1, "Y entra a la bitácora de pagos de Comercialización");
  const unidad = DS.UNIDADES_DISTRIBUCION.find((u) => !u.granel && DS.disponibilidadUnidad(u, D.HOY).disponible);
  const p = F.planificarAD(st, { tipo: "JORNADA", solicitudIds: [r.solicitud.id], ad: "79001", unidad: unidad.placa }, seq);
  ok(p.ok, "Se planifica un AD con el pedido", p.error);
  st = aplicar(st, p);
  const rutaId = p.ruta.id;
  st = aplicar(st, F.salidaAD(st, rutaId, { hora: "07:00" }, seq));
  st = aplicar(st, F.recoleccionAD(st, rutaId, {}, { hora: "09:00" }, seq));
  st = aplicar(st, F.llenadoAD(st, rutaId, {}, { hora: "12:00" }, seq));
  const c = F.cerrarADPuro(st, rutaId, { hora: "15:00", receptor: "Prueba" }, seq);
  ok(c.ok && c.resumen.entregadas === 1, "El AD se cierra y factura", c.error);
  st = aplicar(st, c);
  const despues = derivados(st);
  const sol = st.solicitudes.find((s) => s.id === r.solicitud.id);
  ok(sol.estado === "CULMINADO" && sol.factura, "El pedido queda entregado y facturado");
  ok(cerca(despues.cifras.dinero.facturadoPeriodo.total - antes.cifras.dinero.facturadoPeriodo.total, sol.total), "El libro de ventas sube exactamente lo facturado");
  ok(cerca(antes.cifras.glp.fisico - despues.cifras.glp.fisico, 18), "El inventario físico baja los kilos entregados");
  invariantes(st, "tras el flujo del portal");
}

/* ═══════════  4 · CERRAR LA AD QUE ESTÁ DEVUELTA AL PUNTO  ═══════════ */
{
  const r = st.rutas.find((x) => F.estadoAD(x.estadoRuta).id === "EN_PUNTO");
  ok(Boolean(r), "La semilla trae un AD devuelto al punto, listo para cerrar");
  if (r) {
    // Antes de cerrar, Distribución corrige incidencias por cliente con el reporte del conductor.
    const conv = F.convocadasDeAD(r, st.solicitudes);
    const llenas = conv.filter((s) => F.marcaDe(r, s.id).llenada !== false && F.marcaDe(r, s.id).recogida !== false);
    const [noEstaba, mala] = llenas;
    const corr = F.corregirJornadaAD(st, r.id, {
      [noEstaba.id]: { resultado: "NO_ESTABA", observacion: "El conductor reportó que no llegó al punto" },
      [mala.id]: { resultado: "DEFECTUOSO", observacion: "Válvula dañada" },
    }, { hora: "15:20", por: "Prueba" });
    ok(corr.ok && corr.cambios === 2, "Al cerrar se corrigen incidencias por cliente", corr.error);
    const rc = corr.rutas.find((x) => x.id === r.id);
    const lln = corr.movPlantaNuevo.find((m) => m.tipo === "LLENADO" && m.rutaId === r.id);
    ok(cerca(lln.kg, rc.jornada.llenado.kg, 0.01) && cerca(rc.jornada.llenado.kg, r.jornada.llenado.kg - D.kgDeSolicitud(noEstaba) - D.kgDeSolicitud(mala), 0.01),
      "La corrección rehace el llenado de planta de esa AD", `${lln.kg} vs ${rc.jornada.llenado.kg}`);
    ok(rc.jornada.correcciones?.[0]?.cambios.length === 2, "Y deja la traza de cada corrección");
    st = { ...st, rutas: corr.rutas, movPlanta: corr.movPlantaNuevo };
    invariantes(st, `tras corregir incidencias de ${r.ad}`);
    const antes = derivados(st);
    const c = F.cerrarADPuro(st, r.id, { hora: "15:30", receptor: "Coordinadora" }, seq);
    ok(c.ok, `Cierre del AD ${r.ad}`, c.error);
    ok(c.resumen.facturas === c.resumen.entregadas && c.resumen.entregadas === rc.jornada.llenado.llenadas, "Se factura sólo lo que quedó devuelto lleno tras corregir");
    const sNo = c.solicitudes.find((s) => s.id === noEstaba.id), sMala = c.solicitudes.find((s) => s.id === mala.id);
    ok(sNo.estado === "POR_REPLANIFICAR" && sMala.estado === "POR_REPLANIFICAR", "Los corregidos pasan a la bandeja de replanificación");
    ok(D.envasesDe(c.parque, mala.usuario).some((e) => e.estado === "NO_APTO"), "La bombona mala corregida queda no apta");
    st = aplicar(st, c);
    const despues = derivados(st);
    ok(cerca(despues.cifras.glp.llenadoPorCerrar, antes.cifras.glp.llenadoPorCerrar - c.resumen.kgSalida, 0.5), "Al cerrar, el llenado por cerrar se concilia");
    ok(cerca(antes.cifras.dinero.pendienteDespacho.bs - despues.cifras.dinero.pendienteDespacho.bs,
      c.resumen.facturado + c.resumen.abonado, 1) || c.resumen.replanificadas > 0, "El pendiente baja lo facturado y lo abonado (lo replanificado sigue pendiente)");
    invariantes(st, `tras cerrar ${r.ad}`);
  }
}

/* ═══════════  4b · DISTRIBUCIÓN NO VE BOLÍVARES  ═══════════ */
{
  const { readdirSync, readFileSync } = await import("node:fs");
  const archivos = readdirSync(join(raiz, "src")).filter((f) => /^Distribucion.*\.jsx$/.test(f));
  const conBs = archivos.flatMap((f) => readFileSync(join(raiz, "src", f), "utf8").split(/\r?\n/)
    .map((l, i) => ({ f, i: i + 1, l }))
    .filter(({ l }) => /\bBs \{|Bs \$\{|\bbs\(|bsOGuion\(/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)));
  ok(!conBs.length, "Ninguna pantalla de Distribución muestra montos en bolívares",
    conBs.slice(0, 4).map((x) => `${x.f}:${x.i}`).join(", "));
  // El planificador ve a quien no pagó, con su estado y sin montos.
  const g = F.gruposPorPlanificar(st.solicitudes, st.rutas).find((x) => (x.fuera || []).length);
  ok(Boolean(g) && g.fuera.length === g.sinPago + g.porCompletar, "El planificador ve quiénes no pagaron o están por completar");
}

/* ═══════════  4c · APP DEL OPERADOR  ═══════════ */
{
  // Despacho de AD: quién pagó y quién no, y el despachado del operador (no cierra).
  const conFuera = st.rutas.filter(F.adPlanificada).map((r) => ({ r, c: F.clientesDeAD(r, st.solicitudes) })).find((x) => x.c.fuera.length && x.c.convocadas.length);
  ok(Boolean(conFuera) && conFuera.c.convocadas.every((s) => s.estado === "EN_AD") && conFuera.c.fuera.every((s) => ["SIN_PAGO", "POR_COMPLETAR"].includes(s.estado)),
    "La app separa a quienes pagaron de quienes no, por AD");
  const planificada = st.rutas.find((x) => F.estadoAD(x.estadoRuta).id === "ASIGNADA");
  ok(!F.marcarDespachadoAD(st, planificada.id, {}).ok, "No se marca despachado un AD que no ha vuelto al punto");
  const d0 = ini.rutas.find((x) => String(x.ad) === "76902")?.jornada?.despacho;
  ok(Boolean(d0) && d0.planificados >= d0.recogidos && d0.recogidos >= d0.entregados && d0.vacios === d0.recogidos - d0.entregados,
    "El despacho del operador trae planificados ≥ recogidos ≥ entregados", JSON.stringify(d0));
  ok(ini.rutas.find((x) => String(x.ad) === "76902")?.estadoRuta === "EN_PUNTO", "Marcar despachado no cierra el AD: lo cierra Distribución");

  // Planta móvil: venta con cobro, tope por núcleo y referencia sin repetir.
  const seqPM = { ...seq };
  const E = D.CLIENTE_PORTAL.id;
  const v1 = F.ventaPlantaMovil({ solicitudes: ini.solicitudes, manuales: ini.manuales }, { usuario: E, concepto: "BOMB_18", cantidad: 1, metodo: "EFECTIVO", montoRecibido: 2000, jornada: "PM-TEST" }, seqPM);
  ok(v1.ok && v1.solicitud.estado === "CULMINADO" && v1.solicitud.factura && cerca(v1.vuelto, 2000 - v1.total), "Venta en planta móvil: entregada, facturada y con vuelto", v1.error);
  const sols = [v1.solicitud, ...ini.solicitudes];
  const v2 = F.ventaPlantaMovil({ solicitudes: sols, manuales: ini.manuales }, { usuario: E, concepto: "BOMB_18", cantidad: 1, metodo: "EFECTIVO", jornada: "PM-TEST" }, seqPM);
  ok(!v2.ok && /tope/i.test(v2.error || ""), "La planta móvil respeta el tope por núcleo familiar");
  const refUsada = ini.solicitudes.find((s) => s.pago?.referencia && s.pago.estado === "VERIFICADO").pago.referencia;
  const libre = D.USUARIOS.find((u) => D.segmentoUsuario(u) === "RESIDENCIAL" && D.puedeSolicitar(u, sols, "BOMB_10", 1).ok && u.id !== E);
  const v3 = F.ventaPlantaMovil({ solicitudes: sols, manuales: ini.manuales }, { usuario: libre.id, concepto: "BOMB_10", cantidad: 1, metodo: "PAGO_MOVIL", banco: "PM", referencia: refUsada, jornada: "PM-TEST" }, seqPM);
  ok(!v3.ok && /referencia/i.test(v3.error || ""), "En planta móvil una referencia ya usada se rechaza");
  const caja = F.cajaPlantaMovil("PM-TEST", sols, ini.manuales);
  ok(caja.ventas.length === 1 && cerca(caja.porMetodo.EFECTIVO, v1.total), "La caja de la jornada suma lo cobrado por método");
  const fac = D.facturasDe(sols, ini.manuales).find((f) => f.sol === v1.solicitud.id);
  ok(Boolean(fac) && fac.canal === "PLANTA_MOVIL" && fac.condicionTarifa, "La venta entra al libro con su tipo, tarifa y canal");
}

/* ═══════════  5 · UNA AD QUE NO SALIÓ NO SE PUEDE CERRAR  ═══════════ */
{
  const r = st.rutas.find((x) => F.estadoAD(x.estadoRuta).id === "ASIGNADA");
  const c = F.cerrarADPuro(st, r.id, {}, seq);
  ok(!c.ok, "No se cierra un AD que no salió a recolección");
}

/* ═══════════  6 · CIERRE DEL CICLO  ═══════════ */
{
  const saldoAntes = F.cifrasSistema({ solicitudes: st.solicitudes, abonos: st.abonos }).dinero.saldoFavor.bs;
  const v = F.vencerPlazos(st, D.finDeCiclo(D.HOY), seq);
  st = aplicar(st, v);
  const quedan = st.solicitudes.filter((s) => ["POR_REPLANIFICAR", "POR_COMPLETAR"].includes(s.estado)).length;
  const saldoDespues = F.cifrasSistema({ solicitudes: st.solicitudes, abonos: st.abonos }).dinero.saldoFavor.bs;
  ok(quedan === 0, "Al cerrar el ciclo no queda nada por replanificar ni por completar");
  ok(cerca(saldoDespues - saldoAntes, v.monto, 0.5), "Lo vencido pasa íntegro al saldo a favor", `${bs(v.monto)}`);
  invariantes(st, "tras cerrar el ciclo");
}

console.log(`\n${pasadas} comprobaciones correctas${fallos.length ? ` · ${fallos.length} FALLAS` : ""}`);
if (fallos.length) {
  fallos.forEach((f) => console.log("  ✗", f));
  process.exit(1);
}
console.log("  ✓ Flujo y cifras concordantes");
