import React, { useMemo, useState } from "react";
import {
  Search, Download, Printer, Save, X, Check, CheckCircle2, AlertTriangle, Wallet,
  Landmark, UserCog, Tag as TagIcon, ShoppingBag, Clock3, ShieldCheck, History,
  TrendingUp, TrendingDown, Minus, FileSpreadsheet, Users, CircleDollarSign,
  UserPlus, Power,
} from "lucide-react";
import {
  EMPRESA, PERIODO, HOY, IVA, CDTS, CONCEPTOS, COMUNAS, USUARIOS,
  cdtOf, comunaOf, cpt, usr, banco, segmentoUsuario,
  bs, num, fecha, fechaCorta, fechaGuion, descargar, csv, kgALitros,
  LISTA_PRECIOS, PERIODOS_PRECIO, etiquetaPeriodo, variacionPrecio, RESOLUCIONES_PRECIO, precioVigente,
  CONDICIONES_PAGO, CONDICIONES_TARIFA, condicionPago, condicionTarifa, tarifaVigenteDe,
  DIAS_INACTIVIDAD, estadoCuentaAbono, tipoAbono, TIPOS_ABONO,
  MOTIVOS_ESTADO_PADRON, motivoEstadoPadron,
  CODIGOS_GENERICOS, TOPE_UNIDADES_GENERICO, UMBRAL_ALERTA_GENERICO,
  kgDeSolicitud, esAbonada,
} from "./datos.jsx";

/* ════════════════════════════════════════════════════════════════
   LIBRO DE VENTAS DIGITAL
   Soporte contable oficial de los ingresos por ventas.
   Se alimenta de las facturas, que nacen del cierre del AD — nunca del pago.
   ════════════════════════════════════════════════════════════════ */

export function LibroVentas({ facturas = [], cdtF = "TODOS", periodoCerrado = false }) {
  const [mes, setMes] = useState(`${PERIODO.anio}-${String(PERIODO.mes).padStart(2, "0")}`);
  const [q, setQ] = useState("");
  const [origen, setOrigen] = useState("TODOS");

  const periodos = useMemo(() => {
    const set = new Set(facturas.filter((f) => f.fecha).map((f) => `${f.fecha.getFullYear()}-${String(f.fecha.getMonth()).padStart(2, "0")}`));
    return [...set].sort().reverse();
  }, [facturas]);

  const delPeriodo = useMemo(() => facturas
    .filter((f) => f.fecha && `${f.fecha.getFullYear()}-${String(f.fecha.getMonth()).padStart(2, "0")}` === mes)
    .sort((a, b) => (a.fecha - b.fecha) || String(a.serie).localeCompare(String(b.serie))),
  [facturas, mes]);

  const filtradas = delPeriodo.filter((f) => {
    const u = usr(f.usuario);
    const okO = origen === "TODOS" || f.origen === origen;
    const okQ = !q || `${f.serie} ${f.control} ${u.nombre} ${u.doc} ${cpt(f.concepto).nombre}`.toLowerCase().includes(q.toLowerCase());
    return okO && okQ;
  });

  const t = filtradas.reduce((a, f) => ({
    base: a.base + Number(f.exento ? 0 : f.base || 0),
    exento: a.exento + Number(f.exento ? f.base || 0 : 0),
    iva: a.iva + Number(f.iva || 0),
    total: a.total + Number(f.total || 0),
  }), { base: 0, exento: 0, iva: 0, total: 0 });

  // Control de correlativo: un hueco en la numeración se presume ocultamiento de ingresos.
  const correlativo = useMemo(() => {
    const nums = delPeriodo.filter((f) => /^U-/.test(String(f.serie))).map((f) => Number(String(f.serie).replace(/\D/g, ""))).sort((a, b) => a - b);
    if (nums.length < 2) return { huecos: [], desde: nums[0] || null, hasta: nums[0] || null, total: nums.length };
    const huecos = [];
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] > 1) huecos.push(`${nums[i - 1] + 1}–${nums[i] - 1}`);
    }
    return { huecos, desde: nums[0], hasta: nums[nums.length - 1], total: nums.length };
  }, [delPeriodo]);

  function exportar() {
    descargar(`libro-ventas-${mes}.csv`, csv([
      ["LIBRO DE VENTAS"], [EMPRESA.nombre, `Rif: ${EMPRESA.rif}`],
      ["Período", etiquetaPeriodo(mes)], ["Alcance", cdtF === "TODOS" ? "Todos los CDT" : cdtOf(cdtF).nombre],
      ["Emitido", fechaGuion(HOY)], ["Estado", periodoCerrado ? "PERÍODO CERRADO" : "PRELIMINAR"], [],
      ["Fecha", "Serie", "Nro. control", "Origen", "Rif / CI", "Razón social", "Contrato", "Concepto",
       "Cantidad", "Base imponible Bs", "Exento Bs", `IVA ${IVA * 100}% Bs`, "Total Bs", "AD", "Banco", "Referencia"],
      ...filtradas.map((f) => {
        const u = usr(f.usuario);
        return [fechaGuion(f.fecha), f.serie, f.control, etiquetaOrigen(f.origen), u.rifFactura || u.doc, u.nombre,
          u.contrato, cpt(f.concepto).nombre, f.cantidad,
          (f.exento ? 0 : f.base).toFixed(2), (f.exento ? f.base : 0).toFixed(2), Number(f.iva || 0).toFixed(2),
          Number(f.total || 0).toFixed(2), f.ad || "", f.pago?.banco ? banco(f.pago.banco).nombre : "", f.pago?.referencia || ""];
      }),
      [], ["TOTALES", "", "", "", "", "", "", "", filtradas.reduce((a, f) => a + Number(f.cantidad || 0), 0),
        t.base.toFixed(2), t.exento.toFixed(2), t.iva.toFixed(2), t.total.toFixed(2)],
      [], ["CONTROL DE CORRELATIVO"],
      ["Documentos asentados", correlativo.total],
      ["Rango", correlativo.desde ? `U-${String(correlativo.desde).padStart(8, "0")} a U-${String(correlativo.hasta).padStart(8, "0")}` : "—"],
      ["Huecos detectados", correlativo.huecos.length ? correlativo.huecos.join(" · ") : "Ninguno"],
    ]));
  }

  return (
    <div className="cg2">
      <GestionStyles />
      <div className="cg2-hero">
        <div>
          <span>SOPORTE CONTABLE OFICIAL DE INGRESOS POR VENTAS</span>
          <h2>Libro de Ventas Digital</h2>
          <p>Se alimenta únicamente de facturas emitidas al cierre del AD. Un pago sin entrega no genera
             asiento: aparece como recaudación pendiente o como saldo a favor, nunca como venta.</p>
        </div>
        <div className="cg2-hero-side">
          <div className={`cg2-pill ${periodoCerrado ? "closed" : ""}`}>
            <ShieldCheck size={14} />{periodoCerrado ? "Período cerrado" : "Período abierto"}
          </div>
          <small>{EMPRESA.nombre} · Rif: {EMPRESA.rif}</small>
        </div>
      </div>

      <div className="cg2-kpis">
        <G2K label="Documentos asentados" value={num(filtradas.length)} note={etiquetaPeriodo(mes)} />
        <G2K label="Base imponible" value={`Bs ${bs(t.base)}`} note="operaciones gravadas" />
        <G2K label="Ventas exentas" value={`Bs ${bs(t.exento)}`} note="residencial exonerado de IVA" />
        <G2K label="Débito fiscal IVA" value={`Bs ${bs(t.iva)}`} note={`alícuota ${IVA * 100}%`} tone="warn" />
        <G2K label="Total del libro" value={`Bs ${bs(t.total)}`} note="ingresos por ventas del período" tone="money" />
      </div>

      <div className={`cg2-correlativo ${correlativo.huecos.length ? "bad" : "ok"}`}>
        {correlativo.huecos.length ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
        <div>
          <b>{correlativo.huecos.length ? `Correlativo con ${correlativo.huecos.length} salto(s)` : "Correlativo continuo"}</b>
          <span>
            {correlativo.desde
              ? `${correlativo.total} documentos automáticos, de U-${String(correlativo.desde).padStart(8, "0")} a U-${String(correlativo.hasta).padStart(8, "0")}.`
              : "Sin documentos automáticos en el período."}
            {correlativo.huecos.length ? ` Faltantes: ${correlativo.huecos.join(" · ")}.` : " No hay números faltantes."}
          </span>
        </div>
      </div>

      <section className="card">
        <div className="card-h">
          <div>
            <h2>Relación de operaciones <span className="cnt">{filtradas.length}</span></h2>
            <span className="card-note">Ordenadas por fecha y número de documento, como exige el asiento.</span>
          </div>
          <div className="toolbar">
            <select value={mes} onChange={(e) => setMes(e.target.value)}>
              {periodos.map((p) => <option key={p} value={p}>{etiquetaPeriodo(p)}</option>)}
            </select>
            <select value={origen} onChange={(e) => setOrigen(e.target.value)}>
              <option value="TODOS">Todo origen</option>
              <option value="AUTOMATICA">Cierre de AD</option>
              <option value="MANUAL">Talonario CDT</option>
              <option value="SIN_CONTRATO">Sin contrato</option>
            </select>
            <div className="search"><Search size={14} /><input placeholder="Buscar serie, control, cliente o concepto" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="btn sm" onClick={exportar}><Download size={14} /> CSV</button>
            <button className="btn sm primary" onClick={() => window.print()}><Printer size={14} /> Imprimir</button>
          </div>
        </div>

        <div className="scroll">
          <table className="tbl cg2-libro">
            <thead>
              <tr>
                <th>Fecha</th><th>Serie</th><th>Nro. control</th><th>Origen</th>
                <th>Rif / CI</th><th>Razón social</th><th>Concepto</th>
                <th className="r">Cant.</th><th className="r">Base Bs</th><th className="r">Exento Bs</th>
                <th className="r">IVA Bs</th><th className="r">Total Bs</th><th>AD</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f) => {
                const u = usr(f.usuario);
                return (
                  <tr key={f.id}>
                    <td className="muted">{fechaCorta(f.fecha)}</td>
                    <td className="mono strong">{f.serie}</td>
                    <td className="mono muted">{f.control}</td>
                    <td><span className={`tag ${f.origen === "AUTOMATICA" ? "" : f.origen === "SIN_CONTRATO" ? "alt" : "warn"}`}>{etiquetaOrigen(f.origen)}</span></td>
                    <td className="mono">{u.rifFactura || u.doc}</td>
                    <td><div className="u-name sm">{u.nombre}</div><div className="u-doc">{u.contrato}</div></td>
                    <td className="c-name">{cpt(f.concepto).nombre}</td>
                    <td className="r mono">{num(f.cantidad)}</td>
                    <td className="r mono">{f.exento ? <span className="muted">—</span> : bs(f.base)}</td>
                    <td className="r mono">{f.exento ? bs(f.base) : <span className="muted">—</span>}</td>
                    <td className="r mono">{f.exento ? <span className="muted">—</span> : bs(f.iva)}</td>
                    <td className="r mono strong">{bs(f.total)}</td>
                    <td className="mono muted">{f.ad || "—"}</td>
                  </tr>
                );
              })}
              {!filtradas.length && <tr><td colSpan={13} className="cg2-empty">Sin operaciones asentadas en este período.</td></tr>}
            </tbody>
            <tfoot>
              <tr className="tot">
                <td colSpan={7}>TOTALES DEL LIBRO · {etiquetaPeriodo(mes)}</td>
                <td className="r mono">{num(filtradas.reduce((a, f) => a + Number(f.cantidad || 0), 0))}</td>
                <td className="r mono">{bs(t.base)}</td>
                <td className="r mono">{bs(t.exento)}</td>
                <td className="r mono">{bs(t.iva)}</td>
                <td className="r mono strong">{bs(t.total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="cg2-nota">
          <FileSpreadsheet size={15} />
          <span>El asiento debe cuadrar con la declaración de IVA del período. Las correcciones se hacen
            con nota de crédito o débito: un documento asentado no se modifica ni se elimina.</span>
        </div>
      </section>
    </div>
  );
}

const etiquetaOrigen = (o) => o === "AUTOMATICA" ? "Cierre de AD" : o === "SIN_CONTRATO" ? "Sin contrato" : "Talonario CDT";

/* ════════════════════════════════════════════════════════════════
   SALDOS A FAVOR
   Diferencia los tres estados del dinero del usuario.
   ════════════════════════════════════════════════════════════════ */

export function SaldosAFavor({ abonos = [], saldos = {}, solicitudes = [], onRegistrar }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [modal, setModal] = useState(null);

  const conSaldo = Object.entries(saldos)
    .filter(([, v]) => Math.abs(v) > 0.009)
    .map(([id, saldo]) => ({ id, saldo, u: usr(id), movimientos: abonos.filter((a) => a.usuario === id).length }))
    .sort((a, b) => b.saldo - a.saldo);

  const visibles = conSaldo.filter((x) => !q || `${x.u.nombre} ${x.u.doc} ${x.id}`.toLowerCase().includes(q.toLowerCase()));

  const totalAbonado = conSaldo.reduce((a, x) => a + x.saldo, 0);
  const generadoPorNoCompra = abonos.filter((a) => a.tipo === "ABONO_NO_COMPRA").reduce((a, x) => a + Number(x.monto || 0), 0);
  const generadoPorExcedente = abonos.filter((a) => a.tipo === "ABONO_EXCEDENTE").reduce((a, x) => a + Number(x.monto || 0), 0);
  const devengado = abonos.filter((a) => a.tipo === "CONSUMO").reduce((a, x) => a + Number(x.monto || 0), 0);

  // Los tres estados del dinero, que la Gerencia pidió diferenciar con claridad.
  const entregado = solicitudes.filter((s) => s.estado === "CULMINADO" && s.factura).reduce((a, s) => a + Number(s.total || 0), 0);
  const pendienteDespacho = solicitudes
    .filter((s) => !esAbonada(s) && s.estado !== "CULMINADO" && s.pago?.estado === "VERIFICADO")
    .reduce((a, s) => a + Number(s.total || 0), 0);
  const kgLiberado = solicitudes.filter(esAbonada).reduce((a, s) => a + kgDeSolicitud(s), 0);

  function exportar() {
    descargar("saldos-a-favor.csv", csv([
      ["SALDOS A FAVOR DE USUARIOS"], [EMPRESA.nombre, `Rif: ${EMPRESA.rif}`], ["Corte", fechaGuion(HOY)],
      ["Naturaleza", "Pasivo con el usuario. Abono nominal en bolívares, no indexado."], [],
      ["Código", "Usuario", "Cédula / RIF", "Comuna", "Movimientos", "Saldo disponible Bs"],
      ...conSaldo.map((x) => [x.id, x.u.nombre, x.u.doc, x.u.comuna ? comunaOf(x.u.comuna).nombre : "—", x.movimientos, x.saldo.toFixed(2)]),
      [], ["TOTAL PASIVO POR ABONOS", "", "", "", "", totalAbonado.toFixed(2)],
      [], ["MOVIMIENTOS"],
      ["Movimiento", "Fecha", "Usuario", "Tipo", "Referencia", "Detalle", "Monto Bs", "Signo"],
      ...abonos.map((a) => [a.id, fechaGuion(a.fecha), usr(a.usuario).nombre, tipoAbono(a.tipo).nombre,
        a.referencia || "", a.detalle || "", Number(a.monto || 0).toFixed(2), tipoAbono(a.tipo).signo > 0 ? "ABONO" : "CARGO"]),
    ]));
  }

  return (
    <div className="cg2">
      <GestionStyles />

      <div className="cg2-tres">
        <div className="cg2-estado ok">
          <span>1 · Entregado y facturado</span>
          <b>Bs {bs(entregado)}</b>
          <small>Operación cerrada. Ya está en el libro de ventas.</small>
        </div>
        <div className="cg2-estado warn">
          <span>2 · Recaudado pendiente de despacho</span>
          <b>Bs {bs(pendienteDespacho)}</b>
          <small>Pagado, con GLP comprometido y jornada por delante.</small>
        </div>
        <div className="cg2-estado money">
          <span>3 · Saldo a favor del usuario</span>
          <b>Bs {bs(totalAbonado)}</b>
          <small>Sin servicio pendiente. Disponible para una compra futura.</small>
        </div>
      </div>

      <div className="cg2-regla">
        <Wallet size={17} />
        <div>
          <b>El que no compra en el AD no queda con servicio pendiente.</b>
          <span>Queda con dinero abonado a su código. El abono es <b>nominal en bolívares</b>: si abonó
            Bs 1.300,00 cuando la bombona costaba Bs 1.700,00 y vuelve cuando cuesta Bs 2.600,00,
            devenga sus Bs 1.300,00 y transfiere la diferencia. Al convertirse en abono, el GLP deja de estar
            comprometido y regresa a disponible real — hoy son <b>{num(kgLiberado)} kg</b> liberados.</span>
        </div>
      </div>

      <div className="cg2-kpis">
        <G2K label="Pasivo total por abonos" value={`Bs ${bs(totalAbonado)}`} note={`${conSaldo.length} usuarios con saldo`} tone="money" />
        <G2K label="Generado por no compra en AD" value={`Bs ${bs(generadoPorNoCompra)}`} note="estaban planificados y no retiraron" tone="warn" />
        <G2K label="Generado por excedente de pago" value={`Bs ${bs(generadoPorExcedente)}`} note="transfirieron de más" />
        <G2K label="Devengado en compras" value={`Bs ${bs(devengado)}`} note="ya aplicado a nuevas solicitudes" tone="ok" />
      </div>

      <section className="card">
        <div className="card-h">
          <div><h2>Usuarios con saldo disponible <span className="cnt">{visibles.length}</span></h2>
            <span className="card-note">Cada saldo es una obligación de la empresa con el usuario.</span></div>
          <div className="toolbar">
            <div className="search"><Search size={14} /><input placeholder="Buscar usuario o cédula" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="btn sm" onClick={() => setModal("registrar")}><Wallet size={14} /> Registrar movimiento</button>
            <button className="btn sm" onClick={exportar}><Download size={14} /> CSV</button>
          </div>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Código</th><th>Usuario</th><th>Comuna</th><th className="r">Movimientos</th><th className="r">Saldo disponible Bs</th><th>Equivale a</th><th></th></tr></thead>
            <tbody>
              {visibles.map((x) => {
                const precio10 = precioVigente("BOMB_10", HOY);
                const equiv = precio10 ? Math.floor(x.saldo / precio10) : 0;
                return (
                  <tr key={x.id}>
                    <td className="mono muted">{x.id}</td>
                    <td><div className="u-name">{x.u.nombre}</div><div className="u-doc">{x.u.doc}</div></td>
                    <td className="c-name">{x.u.comuna ? comunaOf(x.u.comuna).nombre : "—"}</td>
                    <td className="r mono">{x.movimientos}</td>
                    <td className="r mono strong cg2-money">{bs(x.saldo)}</td>
                    <td className="muted">{equiv > 0 ? `${equiv} bombona(s) de 10 kg a precio de hoy` : "menos de una bombona"}</td>
                    <td className="r"><button className="btn sm" onClick={() => setSel(x)}>Estado de cuenta</button></td>
                  </tr>
                );
              })}
              {!visibles.length && <tr><td colSpan={7} className="cg2-empty">Ningún usuario tiene saldo a favor.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {sel && <EstadoCuenta x={sel} abonos={abonos} onClose={() => setSel(null)} />}
      {modal === "registrar" && <ModalAbono onClose={() => setModal(null)} onSave={(d) => { onRegistrar?.(d); setModal(null); }} />}
    </div>
  );
}

function EstadoCuenta({ x, abonos, onClose }) {
  const movs = estadoCuentaAbono(abonos, x.id);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cg2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div><div className="mh-eyebrow">Saldo a favor</div><h3>{x.u.nombre}</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-b">
          <div className="cg2-saldo-head">
            <div><span>Código</span><b>{x.id}</b></div>
            <div><span>Documento</span><b>{x.u.doc}</b></div>
            <div className="big"><span>Saldo disponible</span><b>Bs {bs(x.saldo)}</b></div>
          </div>

          <div className="scroll cg2-cuenta">
            <table className="tbl">
              <thead><tr><th>Fecha</th><th>Movimiento</th><th>Referencia</th><th>Detalle</th><th className="r">Abono</th><th className="r">Cargo</th><th className="r">Saldo</th></tr></thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id} className={m.anulado ? "cg2-anulado" : ""}>
                    <td className="muted">{fechaCorta(m.fecha)}</td>
                    <td><b className="c-name">{tipoAbono(m.tipo).nombre}</b></td>
                    <td className="mono muted">{m.referencia || "—"}</td>
                    <td className="c-name">
                      {m.detalle || "—"}
                      {m.anulado && <div className="cg2-anul-nota">Anulado por {m.anuladoPor} · {m.detalleAnulacion}</div>}
                    </td>
                    <td className="r mono cg2-money">{m.signo > 0 ? bs(m.monto) : <span className="muted">—</span>}</td>
                    <td className="r mono cg2-cargo">{m.signo < 0 ? bs(m.monto) : <span className="muted">—</span>}</td>
                    <td className="r mono strong">{bs(m.saldoResultante)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cg2-regla-saldo">
            <Landmark size={15} />
            <div>
              <b>Este saldo no se devuelve en efectivo</b>
              <span>La empresa no hace reembolsos. Todo lo que el usuario transfiere queda abonado a su
                código y sólo se descarga contra un despacho posterior: al facturar se devenga primero el
                saldo y el usuario transfiere la diferencia. Por eso el saldo no vence ni se pierde.</span>
            </div>
          </div>
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function ModalAbono({ onClose, onSave }) {
  const [d, setD] = useState({ usuario: USUARIOS[1].id, tipo: "ABONO_EXCEDENTE", monto: "", referencia: "", detalle: "" });
  const ok = Number(d.monto) > 0 && d.detalle.trim().length > 4;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><div><div className="mh-eyebrow">Saldos a favor</div><h3>Registrar movimiento</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-b">
          <label className="campo"><span>Usuario</span>
            <select value={d.usuario} onChange={(e) => setD({ ...d, usuario: e.target.value })}>
              {USUARIOS.map((u) => <option key={u.id} value={u.id}>{u.nombre} — {u.contrato}</option>)}
            </select></label>
          <label className="campo"><span>Tipo de movimiento</span>
            <select value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>
              {Object.entries(TIPOS_ABONO).map(([k, v]) => <option key={k} value={k}>{v.nombre} · {v.desc}</option>)}
            </select></label>
          <div className="row2">
            <label className="campo"><span>Monto Bs</span>
              <input inputMode="decimal" value={d.monto} onChange={(e) => setD({ ...d, monto: e.target.value.replace(/[^\d.]/g, "") })} /></label>
            <label className="campo"><span>Referencia</span>
              <input value={d.referencia} onChange={(e) => setD({ ...d, referencia: e.target.value })} placeholder="AD, operación bancaria o soporte" /></label>
          </div>
          <label className="campo"><span>Detalle</span>
            <textarea rows={3} value={d.detalle} onChange={(e) => setD({ ...d, detalle: e.target.value })} placeholder="Motivo del movimiento" /></label>
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={!ok} onClick={() => onSave({ ...d, monto: Number(d.monto) })}><Save size={14} /> Registrar</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   LISTA DE PRECIOS CON VIGENCIA
   ════════════════════════════════════════════════════════════════ */

export function ListaPrecios() {
  const actual = PERIODOS_PRECIO[PERIODOS_PRECIO.length - 1];
  const [mes, setMes] = useState(actual);
  const [grupo, setGrupo] = useState("TODOS");

  const conceptos = CONCEPTOS.filter((c) => grupo === "TODOS" || c.grupo === grupo);
  const tabla = LISTA_PRECIOS[mes] || {};
  const ultimos = PERIODOS_PRECIO.slice(-6);

  function exportar() {
    descargar(`lista-precios-${mes}.csv`, csv([
      ["LISTA DE PRECIOS"], [EMPRESA.nombre, `Rif: ${EMPRESA.rif}`],
      ["Período de vigencia", etiquetaPeriodo(mes)],
      ["Respaldo", RESOLUCIONES_PRECIO[mes] || "Por registrar"], [],
      ["Concepto", "Grupo", "Unidad", "Kg", "Precio Bs", "Variación vs. mes anterior %", "Tratamiento IVA"],
      ...conceptos.map((c) => {
        const v = variacionPrecio(c.id, mes);
        return [c.nombre, c.grupo, c.unidad, c.kg || "", Number(tabla[c.id] || 0).toFixed(2),
          v == null ? "—" : v.toFixed(1), c.fiscalPorUso ? "Según uso del contrato" : c.exento ? "Exento" : `Gravado ${IVA * 100}%`];
      }),
      [], ["HISTÓRICO"], ["Concepto", ...ultimos.map(etiquetaPeriodo)],
      ...conceptos.map((c) => [c.nombre, ...ultimos.map((p) => Number(LISTA_PRECIOS[p][c.id] || 0).toFixed(2))]),
    ]));
  }

  return (
    <div className="cg2">
      <GestionStyles />
      <div className="cg2-hero">
        <div>
          <span>TARIFAS VIGENTES Y SU HISTÓRICO</span>
          <h2>Lista de precios</h2>
          <p>Los precios se actualizan cada mes. Un precio no se cambia: se versiona. Cada factura conserva
             la tarifa del mes en que fue emitida, de modo que actualizar la lista nunca reescribe el libro de ventas
             hacia atrás.</p>
        </div>
        <div className="cg2-hero-side">
          <div className="cg2-pill"><TagIcon size={14} /> {etiquetaPeriodo(mes)}</div>
          <small>{RESOLUCIONES_PRECIO[mes] || "Respaldo por registrar"}</small>
        </div>
      </div>

      <section className="card">
        <div className="card-h">
          <div><h2>Tarifas del período</h2><span className="card-note">Comparadas contra el mes inmediatamente anterior.</span></div>
          <div className="toolbar">
            <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
              <option value="TODOS">Todos los grupos</option>
              {[...new Set(CONCEPTOS.map((c) => c.grupo))].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={mes} onChange={(e) => setMes(e.target.value)}>
              {[...PERIODOS_PRECIO].reverse().map((p) => <option key={p} value={p}>{etiquetaPeriodo(p)}</option>)}
            </select>
            <button className="btn sm" onClick={exportar}><Download size={14} /> CSV</button>
            <button className="btn sm primary" onClick={() => window.print()}><Printer size={14} /> Imprimir</button>
          </div>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Concepto</th><th>Grupo</th><th>Unidad</th><th className="r">Kg</th><th className="r">Precio Bs</th><th className="r">Bs / kg</th><th>Variación</th><th>IVA</th></tr></thead>
            <tbody>
              {conceptos.map((c) => {
                const precio = Number(tabla[c.id] || 0);
                const v = variacionPrecio(c.id, mes);
                return (
                  <tr key={c.id}>
                    <td><div className="u-name sm">{c.nombre}</div><div className="u-doc">{c.sub}</div></td>
                    <td className="c-name">{c.grupo}</td>
                    <td className="muted">{c.unidad}</td>
                    <td className="r mono">{c.kg || <span className="muted">—</span>}</td>
                    <td className="r mono strong">{bs(precio)}</td>
                    <td className="r mono muted">{c.kg ? bs(precio / c.kg) : "—"}</td>
                    <td>{v == null ? <span className="muted">—</span> : <VarChip v={v} />}</td>
                    <td>{c.fiscalPorUso ? <span className="tag alt">Según uso</span> : c.exento ? <span className="tag alt">Exento</span> : <span className="tag">{IVA * 100}%</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-h"><div><h2>Histórico de tarifas</h2>
          <span className="card-note">Últimos seis períodos. Esta tabla es la que respalda el precio de cualquier factura anterior.</span></div></div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Concepto</th>{ultimos.map((p) => <th key={p} className="r">{etiquetaPeriodo(p)}</th>)}</tr></thead>
            <tbody>
              {conceptos.map((c) => (
                <tr key={c.id}>
                  <td className="c-name">{c.corto}</td>
                  {ultimos.map((p) => <td key={p} className="r mono">{bs(LISTA_PRECIOS[p][c.id] || 0)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cg2-nota"><History size={15} />
          <span>Siendo tarifa regulada, cada período debería quedar respaldado por la Gaceta o resolución
            que lo autoriza. El prototipo muestra el campo con una referencia interna.</span></div>
      </section>
    </div>
  );
}

const VarChip = ({ v }) => {
  const cls = v > 0.05 ? "up" : v < -0.05 ? "down" : "flat";
  const Ico = v > 0.05 ? TrendingUp : v < -0.05 ? TrendingDown : Minus;
  return <span className={`cg2-var ${cls}`}><Ico size={11} /> {v > 0 ? "+" : ""}{v.toFixed(1)}%</span>;
};

/* ════════════════════════════════════════════════════════════════
   PADRÓN DE USUARIOS · clasificación y estado
   ════════════════════════════════════════════════════════════════ */

export function PadronUsuarios({ padron = [], solicitudes = [], saldos = {}, facturas = [], reclamos = [], onActualizar, onVerFicha, onCrear, onDefinirEstado }) {
  const [tab, setTab] = useState("usuarios");
  const [codigosComuna, setCodigosComuna] = useState(() => Object.fromEntries(COMUNAS.map((c) => [c.id, c.codigo])));
  const [q, setQ] = useState("");
  const [fEstado, setFEstado] = useState("TODOS");
  const [fPago, setFPago] = useState("TODOS");
  const [fTarifa, setFTarifa] = useState("TODOS");
  const [fSegmento, setFSegmento] = useState("TODOS");
  const [edit, setEdit] = useState(null);
  const [alta, setAlta] = useState(false);
  const [estado, setEstado] = useState(null);
  const [aviso, setAviso] = useState(null);

  const lista = padron.filter((u) => {
    const okQ = !q || `${u.nombre} ${u.doc} ${u.contrato} ${u.id}`.toLowerCase().includes(q.toLowerCase());
    const okE = fEstado === "TODOS" || u.padron.estado === fEstado;
    const okP = fPago === "TODOS" || (u.condicionVenta || "CONTADO") === fPago;
    const okT = fTarifa === "TODOS" || (u.condicionTarifa || "REGULAR") === fTarifa;
    const okS = fSegmento === "TODOS" || segmentoUsuario(u) === fSegmento;
    return okQ && okE && okP && okT && okS;
  });

  const activos = padron.filter((u) => u.padron.estado === "ACTIVO").length;
  const inactivos = padron.filter((u) => u.padron.estado === "INACTIVO").length;
  const pausados = padron.filter((u) => u.padron.pausado).length;
  const definidos = padron.filter((u) => u.padron.manual).length;
  const especiales = padron.filter((u) => (u.condicionTarifa || "REGULAR") !== "REGULAR");
  const vencidos = especiales.filter((u) => tarifaVigenteDe(u).vencida);

  /* Resumen por tipo de cliente. La Gerencia lo pidió y no existía: el padrón contaba
     por estado y por tarifa, pero no decía cuántos residenciales, comercios e
     instituciones hay — que es lo que define el negocio y el tratamiento fiscal. */
  const SEGMENTOS = [
    { id: "RESIDENCIAL", nombre: "Residencial", fiscal: "IVA 0% · exento por uso doméstico" },
    { id: "COMERCIAL", nombre: "Comercial", fiscal: "IVA 16% · uso no residencial" },
    { id: "INSTITUCIONAL", nombre: "Institucional", fiscal: "IVA 16% · entes y programas" },
  ];
  const porSegmento = SEGMENTOS.map((s) => {
    const us = padron.filter((u) => segmentoUsuario(u) === s.id);
    return {
      ...s, total: us.length,
      activos: us.filter((u) => u.padron.estado === "ACTIVO").length,
      inactivos: us.filter((u) => u.padron.estado === "INACTIVO").length,
      credito: us.filter((u) => (u.condicionVenta || "CONTADO") === "CREDITO").length,
      especial: us.filter((u) => (u.condicionTarifa || "REGULAR") !== "REGULAR").length,
      saldo: us.reduce((a, u) => a + Number(saldos[u.id] || 0), 0),
    };
  });

  function exportar() {
    descargar("padron-usuarios.csv", csv([
      ["PADRÓN DE USUARIOS"], [EMPRESA.nombre], ["Corte", fechaGuion(HOY)],
      ["Criterio de inactividad", `${DIAS_INACTIVIDAD} días sin movimiento del código`],
      ["Nota", "El reloj se pausa si a la comuna del usuario no se le planificó jornada"], [],
      ["Código", "Usuario", "Cédula / RIF", "Contrato", "Comuna", "CDT", "Condición de pago",
       "Condición tarifaria", "Aval", "Vence", "Estado", "Último movimiento", "Días", "Saldo a favor Bs"],
      ...lista.map((u) => [u.id, u.nombre, u.doc, u.contrato, u.comuna ? comunaOf(u.comuna).nombre : "—", cdtOf(u.cdt).corto,
        condicionPago(u.condicionVenta).nombre, condicionTarifa(u.condicionTarifa).nombre,
        u.tarifaAval || "", u.tarifaVence ? fechaGuion(u.tarifaVence) : "",
        u.padron.estado, u.padron.ultimoMovimiento ? fechaGuion(u.padron.ultimoMovimiento) : "sin movimiento",
        u.padron.dias ?? "", Number(saldos[u.id] || 0).toFixed(2)]),
    ]));
  }

  if (tab === "comunas") {
    return (
      <div className="cg2">
        <GestionStyles />
        <div className="doc-tabs">
          <button onClick={() => setTab("usuarios")}><Users size={15} /> Usuarios <em>{padron.length}</em></button>
          <button className="on"><Landmark size={15} /> Comunas <em>{COMUNAS.length}</em></button>
        </div>
        <div className="cg2-kpis">
          <G2K label="Comunas registradas" value={COMUNAS.length} note="puntos comunales de distribución" />
          <G2K label="Sin código" value={COMUNAS.filter((c) => !codigosComuna[c.id]).length}
            note="heredadas, pendientes de normalizar" tone={COMUNAS.filter((c) => !codigosComuna[c.id]).length ? "warn" : "ok"} />
          <G2K label="Usuarios asociados" value={padron.length} note="cada uno pertenece a una comuna" />
        </div>
        <section className="card">
          <div className="card-h"><div><h2>Comunas y comunidades</h2>
            <span className="card-note">Las comunidades heredadas sin código se registran primero y se normalizan después, sin perder sus datos.</span></div></div>
          <div className="scroll"><table className="tbl">
            <thead><tr><th>Código</th><th>Comuna / comunidad</th><th>CDT</th><th>Sector</th><th>Responsable</th><th className="r">Usuarios</th><th>Estatus</th><th></th></tr></thead>
            <tbody>{COMUNAS.map((c) => {
              const codigo = codigosComuna[c.id];
              const miembros = padron.filter((u) => u.comuna === c.id).length;
              return (
                <tr key={c.id}>
                  <td className="mono strong">{codigo || <span className="muted">SIN CÓDIGO</span>}</td>
                  <td><div className="u-name">{c.nombre}</div><div className="u-doc">{c.punto}</div></td>
                  <td>{cdtOf(c.cdt).corto}</td>
                  <td className="c-name">{c.sector}</td>
                  <td><div className="u-name sm">{c.coordinador}</div><div className="u-doc">{c.tel}</div></td>
                  <td className="r mono">{miembros}</td>
                  <td>{codigo ? <span className="chip st-cul">Registrada</span> : <span className="chip st-pag">Por codificar</span>}</td>
                  <td className="r">{!codigo && <button className="btn sm primary"
                    onClick={() => setCodigosComuna((m) => ({ ...m, [c.id]: `COM-${c.cdt.replace("CDT-", "")}-05` }))}>Generar código</button>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </section>
      </div>
    );
  }

  return (
    <div className="cg2">
      <GestionStyles />
      <div className="doc-tabs">
        <button className="on"><Users size={15} /> Usuarios <em>{padron.length}</em></button>
        <button onClick={() => setTab("comunas")}><Landmark size={15} /> Comunas <em>{COMUNAS.length}</em></button>
      </div>

      <div className="cg2-kpis">
        <G2K label="Usuarios en padrón" value={padron.length} note="todos asociados a una comuna" />
        <G2K label="Activos" value={activos} note="con movimiento reciente" tone="ok" />
        <G2K label="Inactivos" value={inactivos} note={`${DIAS_INACTIVIDAD} días sin movimiento`} tone="warn" />
        <G2K label="Reloj pausado" value={pausados} note="su comuna no tuvo jornada" />
        <G2K label="Estado definido a mano" value={definidos} note={definidos ? "decisión registrada, no cálculo" : "ninguno sobreescrito"} />
        <G2K label="Tarifa especial" value={especiales.length} note={vencidos.length ? `${vencidos.length} con aval vencido` : "todos con aval vigente"} tone={vencidos.length ? "warn" : "ok"} />
      </div>

      <section className="card">
        <div className="card-h">
          <div><h2>Resumen por tipo de cliente</h2>
            <span className="card-note">El segmento decide el tratamiento fiscal y el tipo de contrato. No es lo mismo un hogar que una panadería.</span></div>
        </div>
        <div className="cg2-segmentos">
          {porSegmento.map((s) => (
            <button className={`cg2-seg ${fSegmento === s.id ? "on" : ""}`} key={s.id}
              onClick={() => setFSegmento(fSegmento === s.id ? "TODOS" : s.id)}>
              <span className="cg2-seg-n">{s.nombre}</span>
              <b>{num(s.total)}</b>
              <div className="cg2-seg-d">
                <span><i className="pt ok" />{s.activos} activos</span>
                <span><i className="pt warn" />{s.inactivos} inactivos</span>
              </div>
              <div className="cg2-seg-d">
                <span>{s.credito} a crédito</span>
                <span>{s.especial} con tarifa especial</span>
              </div>
              <small>{s.fiscal}</small>
              {s.saldo > 0 && <em>Bs {bs(s.saldo)} en saldos a favor</em>}
            </button>
          ))}
        </div>
        {fSegmento !== "TODOS" && (
          <div className="cg2-hint">Filtrando el padrón por <b>{SEGMENTOS.find((x) => x.id === fSegmento)?.nombre}</b>.
            Vuelve a pulsar la tarjeta para ver todos.</div>
        )}
      </section>

      <div className="cg2-regla">
        <Users size={17} />
        <div>
          <b>Inactivo es una etiqueta, nunca un bloqueo.</b>
          <span>Sirve para depurar el padrón y priorizar, no para negar servicio. Si a la comuna del usuario
            no se le planificó ninguna jornada, el reloj se pausa: la falta de movimiento es imputable a la empresa
            y no debe contarse en su contra. La reactivación es automática al primer movimiento.</span>
        </div>
      </div>

      {vencidos.length > 0 && (
        <div className="cg2-correlativo bad">
          <AlertTriangle size={17} />
          <div><b>{vencidos.length} usuario(s) con condición tarifaria vencida</b>
            <span>{vencidos.map((u) => u.nombre).join(" · ")}. Mientras el aval esté vencido se les
              factura tarifa regular completa. Renovar el acto administrativo o reclasificar.</span></div>
        </div>
      )}

      <section className="card">
        <div className="card-h">
          <div><h2>Padrón de usuarios <span className="cnt">{lista.length}</span></h2>
            <span className="card-note">Condición de pago y condición tarifaria son ejes independientes: un usuario puede ser crédito y protegido a la vez.</span></div>
          <div className="toolbar">
            <div className="search"><Search size={14} /><input placeholder="Buscar nombre, cédula o contrato" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="btn sm" onClick={exportar}><Download size={14} /> CSV</button>
            <button className="btn sm primary" onClick={() => setAlta(true)}><UserPlus size={14} /> Registrar usuario</button>
          </div>
        </div>
        <div className="cg2-filtros">
          <label><span>Tipo de cliente</span><select value={fSegmento} onChange={(e) => setFSegmento(e.target.value)}>
            <option value="TODOS">Todos</option>
            {SEGMENTOS.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select></label>
          <label><span>Estado</span><select value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="TODOS">Todos</option><option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option><option value="SIN_MOVIMIENTO">Sin movimiento</option>
          </select></label>
          <label><span>Condición de pago</span><select value={fPago} onChange={(e) => setFPago(e.target.value)}>
            <option value="TODOS">Todas</option>
            {CONDICIONES_PAGO.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select></label>
          <label><span>Condición tarifaria</span><select value={fTarifa} onChange={(e) => setFTarifa(e.target.value)}>
            <option value="TODOS">Todas</option>
            {CONDICIONES_TARIFA.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select></label>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Código</th><th>Usuario</th><th>Comuna / CDT</th><th>Pago</th><th>Tarifa</th><th>Último movimiento</th><th>Estado</th><th className="r">Saldo Bs</th><th></th></tr></thead>
            <tbody>
              {lista.map((u) => {
                const tv = tarifaVigenteDe(u);
                const ct = condicionTarifa(u.condicionTarifa);
                return (
                  <tr key={u.id}>
                    <td className="mono muted">{u.id}</td>
                    <td><div className="u-name">{u.nombre}</div><div className="u-doc">{u.doc} · {u.contrato}</div></td>
                    <td><div className="u-name sm">{u.comuna ? comunaOf(u.comuna).nombre : "—"}</div><div className="u-doc">{cdtOf(u.cdt).corto}</div></td>
                    <td><span className={`tag ${u.condicionVenta === "CREDITO" ? "alt" : ""}`}>{condicionPago(u.condicionVenta).nombre}</span></td>
                    <td>
                      {ct.id === "REGULAR"
                        ? <span className="muted">Regular</span>
                        : <><span className={`tag ${tv.vencida ? "warn" : "alt"}`}>{ct.nombre}</span>
                            <div className="u-doc">{tv.vencida ? "Aval vencido" : `Vence ${fechaCorta(u.tarifaVence)}`}</div></>}
                    </td>
                    <td>{u.padron.ultimoMovimiento
                      ? <><div className="mono">{fechaCorta(u.padron.ultimoMovimiento)}</div><div className="u-doc">hace {u.padron.dias} días</div></>
                      : <span className="muted">sin movimiento</span>}</td>
                    <td><EstadoPadronChip p={u.padron} /></td>
                    <td className="r mono strong">{saldos[u.id] ? <span className="cg2-money">{bs(saldos[u.id])}</span> : <span className="muted">—</span>}</td>
                    <td className="r"><div className="cc-acciones">
                      {onVerFicha && <button className="btn sm" onClick={() => onVerFicha(u)}>Ficha 360°</button>}
                      <button className="btn sm" onClick={() => setEstado(u)} title="Definir si está activo o inactivo"><Power size={13} /> Estado</button>
                      <button className="btn sm" onClick={() => setEdit(u)}><UserCog size={13} /> Editar</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {edit && <ModalUsuario u={edit} onClose={() => setEdit(null)} onSave={(cambios) => { onActualizar?.(edit.id, cambios); setEdit(null); }} />}
      {alta && <ModalAltaUsuario onClose={() => setAlta(false)}
        onSave={(d) => {
          const r = onCrear?.(d);
          if (r?.ok) { setAlta(false); setAviso({ ok: true, usuario: r.usuario }); }
          return r;
        }} />}
      {estado && <ModalEstadoPadron u={estado} onClose={() => setEstado(null)}
        onSave={(motivo, nota) => { onDefinirEstado?.(estado.id, motivo, nota); setEstado(null); }} />}
      {aviso?.ok && (
        <div className="overlay" onClick={() => setAviso(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-h"><div><div className="mh-eyebrow">Alta en el padrón</div>
              <h3>Usuario registrado</h3></div></div>
            <div className="modal-b">
              <div className="rec-meta">
                <div><span>Código</span><b className="mono">{aviso.usuario.id}</b></div>
                <div><span>Contrato</span><b className="mono">{aviso.usuario.contrato}</b></div>
                <div><span>Comuna</span><b>{comunaOf(aviso.usuario.comuna).nombre}</b></div>
                <div><span>CDT</span><b>{cdtOf(aviso.usuario.cdt).corto}</b></div>
              </div>
              <div className="inv-regla" style={{ marginTop: 12 }}><CheckCircle2 size={17} /><div>
                <b>Nace de contado y con tarifa regular</b>
                <span>Ya puede solicitar y pagar por el portal. Si le corresponde crédito, exoneración
                  o tarifa protegida, actívelo desde <b>Editar</b> en su ficha: ahí se pide el documento
                  que lo respalda, quién lo autorizó y hasta cuándo tiene vigencia.</span>
              </div></div>
            </div>
            <div className="modal-f"><button className="btn primary" onClick={() => setAviso(null)}>Entendido</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Un estado decidido por una persona se distingue del que calculó el reloj: si no,
   nadie entiende por qué figura inactivo alguien que compró la semana pasada. */
const EstadoPadronChip = ({ p }) => {
  if (p.manual) {
    return (
      <div className="cg2-est-manual">
        <span className={`chip ${p.estado === "ACTIVO" ? "st-cul" : "pri-alta"}`}>{p.estado === "ACTIVO" ? "Activo" : "Inactivo"}</span>
        <small title={`${p.motivoManual.desc}${p.notaManual ? ` · ${p.notaManual}` : ""} — definido por ${p.definidoPor}`}>
          {p.motivoManual.nombre}
        </small>
      </div>
    );
  }
  if (p.pausado) return <span className="chip st-ad">Reloj pausado</span>;
  if (p.estado === "INACTIVO") return <span className="chip pri-alta">Inactivo</span>;
  if (p.estado === "SIN_MOVIMIENTO") return <span className="chip st-pag">Sin movimiento</span>;
  return <span className="chip st-cul">Activo</span>;
};

/**
 * ALTA DE USUARIO · información base, y nada más.
 *
 * La Gerencia lo pidió en dos tiempos: primero se registra quién es y dónde recibe;
 * la condición de pago y la tarifaria se activan después, desde su ficha. Por eso este
 * formulario no ofrece crédito ni exoneración: nace CONTADO y REGULAR, que es lo
 * ordinario, y lo especial se decide aparte con su respaldo.
 */
function ModalAltaUsuario({ onClose, onSave }) {
  const [d, setD] = useState({
    nombre: "", doc: "", tel: "", dir: "", correo: "",
    comuna: COMUNAS[0].id, uso: "RESIDENCIAL", tipoContrato: "Bombona Domicilio",
  });
  const [err, setErr] = useState(null);
  const comuna = COMUNAS.find((c) => c.id === d.comuna) || COMUNAS[0];
  const juridica = /^[JG]/i.test(d.doc.trim());

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cg2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><div><div className="mh-eyebrow">Alta en el padrón</div>
          <h3>Registrar un usuario nuevo</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-b">
          <p className="modal-nota">Solo la información base. El código de usuario y el número de
            contrato los asigna el sistema. Si necesita crédito, exoneración o tarifa protegida,
            se activa después desde su ficha — esas decisiones piden aval y vigencia.</p>

          <div className="grid2">
            <label className="campo"><span>Nombre o razón social</span>
              <input value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })}
                placeholder="Como aparece en el documento" /></label>
            <label className="campo"><span>Cédula o RIF</span>
              <input value={d.doc} onChange={(e) => setD({ ...d, doc: e.target.value.toUpperCase() })}
                placeholder="V-12345678 · J-401184223" /></label>
          </div>
          <div className="grid2">
            <label className="campo"><span>Teléfono</span>
              <input value={d.tel} onChange={(e) => setD({ ...d, tel: e.target.value })} placeholder="0414-000.00.00" /></label>
            <label className="campo"><span>Correo <em className="op">(opcional)</em></span>
              <input value={d.correo} onChange={(e) => setD({ ...d, correo: e.target.value })} /></label>
          </div>
          <label className="campo"><span>Dirección del punto de servicio</span>
            <input value={d.dir} onChange={(e) => setD({ ...d, dir: e.target.value })}
              placeholder="Donde se entrega el gas, no donde vive el titular si son distintas" /></label>
          <div className="grid2">
            <label className="campo"><span>Comuna a la que pertenece</span>
              <select value={d.comuna} onChange={(e) => setD({ ...d, comuna: e.target.value })}>
                {COMUNAS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></label>
            <label className="campo"><span>Tipo de cliente</span>
              <select value={d.uso} onChange={(e) => setD({ ...d, uso: e.target.value })}>
                <option value="RESIDENCIAL">Residencial · IVA 0%</option>
                <option value="COMERCIAL">Comercial · IVA 16%</option>
                <option value="INSTITUCIONAL">Institucional · IVA 16%</option>
              </select></label>
          </div>

          <div className="cg2-hint">
            Recibirá por <b>{comuna.nombre}</b>, adscrita al <b>{cdtOf(comuna.cdt).nombre}</b>.
            {juridica && " Al ser persona jurídica, el RIF se usa como dato de facturación."}
          </div>

          {err && <div className="cg2-err">{err}</div>}
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={() => { const r = onSave(d); if (!r?.ok) setErr(r?.error); }}>
            <UserPlus size={14} /> Registrar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Definir a mano si el usuario está activo o inactivo, con motivo y constancia. */
function ModalEstadoPadron({ u, onClose, onSave }) {
  const p = u.padron;
  const [motivo, setMotivo] = useState(p.manual ? p.motivoManual.id : MOTIVOS_ESTADO_PADRON[0].id);
  const [nota, setNota] = useState(p.notaManual || "");
  const m = motivoEstadoPadron(motivo);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><div><div className="mh-eyebrow">Estado del padrón</div>
          <h3>Definir el estado de {u.nombre}</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-b">
          <div className="rec-meta">
            <div><span>Código</span><b className="mono">{u.id}</b></div>
            <div><span>Por antigüedad</span><b>{p.estadoAutomatico === "ACTIVO" ? "Activo" : p.estadoAutomatico === "INACTIVO" ? "Inactivo" : "Sin movimiento"}</b></div>
            <div><span>Último movimiento</span><b>{p.ultimoMovimiento ? `hace ${p.dias} días` : "nunca"}</b></div>
          </div>

          <p className="modal-nota">El sistema clasifica solo a los {DIAS_INACTIVIDAD} días sin movimiento.
            Eso sirve para depurar padrón, pero no sabe que alguien falleció, se mudó o tiene el
            contrato suspendido. Esa parte la decide quien atiende, y queda firmada.</p>

          <label className="campo"><span>Motivo</span>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS_ESTADO_PADRON.map((x) => (
                <option key={x.id} value={x.id}>{x.nombre} → {x.estado === "ACTIVO" ? "Activo" : "Inactivo"}</option>
              ))}
            </select></label>
          <div className={`inv-regla ${m.estado === "ACTIVO" ? "" : "alt"}`} style={{ margin: "12px 0" }}>
            {m.estado === "ACTIVO" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
            <div><b>Quedará como {m.estado === "ACTIVO" ? "ACTIVO" : "INACTIVO"}</b><span>{m.desc}</span></div>
          </div>
          <label className="campo"><span>Nota <em className="op">(opcional)</em></span>
            <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)}
              placeholder="Detalle que ayude a entender el caso más adelante" /></label>

          {p.manual && (
            <div className="cg2-hint">Hoy está definido a mano como <b>{p.motivoManual.nombre}</b> por {p.definidoPor}.
              Puede devolverlo al cálculo automático por antigüedad.</div>
          )}
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancelar</button>
          {p.manual && <button className="btn" onClick={() => onSave(null, null)}>Volver al cálculo automático</button>}
          <button className="btn primary" onClick={() => onSave(motivo, nota)}>
            <Power size={14} /> Definir estado
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalUsuario({ u, onClose, onSave }) {
  const [d, setD] = useState({
    nombre: u.nombre, dir: u.dir, tel: u.tel, correo: u.correo,
    condicionVenta: u.condicionVenta || "CONTADO",
    condicionTarifa: u.condicionTarifa || "REGULAR",
    tarifaAval: u.tarifaAval || "",
    tarifaVence: u.tarifaVence ? isoDe(u.tarifaVence) : "",
    tarifaAutorizadoPor: u.tarifaAutorizadoPor || "",
  });
  const ct = condicionTarifa(d.condicionTarifa);
  const requiereAval = ct.requiereAval;
  const avalOk = !requiereAval || (d.tarifaAval.trim().length > 3 && d.tarifaVence && d.tarifaAutorizadoPor.trim().length > 3);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cg2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div><div className="mh-eyebrow">Padrón de usuarios</div><h3>{u.nombre}</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-b">
          <div className="cg2-protegidos">
            <ShieldCheck size={15} />
            <span>Código <b>{u.id}</b>, documento <b>{u.doc}</b> y contrato <b>{u.contrato}</b> no se editan por esta vía.
              Son datos de identidad y se corrigen por expediente.</span>
          </div>

          <div className="row2">
            <label className="campo"><span>Nombre o razón social</span>
              <input value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} /></label>
            <label className="campo"><span>Teléfono</span>
              <input value={d.tel} onChange={(e) => setD({ ...d, tel: e.target.value })} /></label>
          </div>
          <label className="campo"><span>Dirección de servicio</span>
            <input value={d.dir} onChange={(e) => setD({ ...d, dir: e.target.value })} /></label>
          <label className="campo"><span>Correo</span>
            <input value={d.correo} onChange={(e) => setD({ ...d, correo: e.target.value })} /></label>

          <div className="cg2-sep">Clasificación</div>
          <div className="row2">
            <label className="campo"><span>Condición de pago · cuándo paga</span>
              <select value={d.condicionVenta} onChange={(e) => setD({ ...d, condicionVenta: e.target.value })}>
                {CONDICIONES_PAGO.map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.desc}</option>)}
              </select></label>
            <label className="campo"><span>Condición tarifaria · cuánto paga</span>
              <select value={d.condicionTarifa} onChange={(e) => setD({ ...d, condicionTarifa: e.target.value })}>
                {CONDICIONES_TARIFA.map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.desc}</option>)}
              </select></label>
          </div>

          {requiereAval && (
            <div className="cg2-aval">
              <div className="cg2-aval-h"><AlertTriangle size={15} />
                <span>Regalar o descontar gas exige respaldo. Sin acto administrativo con vigencia, el sistema
                  factura tarifa regular completa.</span></div>
              <div className="row2">
                <label className="campo"><span>Documento que lo respalda</span>
                  <input value={d.tarifaAval} onChange={(e) => setD({ ...d, tarifaAval: e.target.value })} placeholder="Oficio, convenio o registro social" /></label>
                <label className="campo"><span>Vence</span>
                  <input type="date" value={d.tarifaVence} onChange={(e) => setD({ ...d, tarifaVence: e.target.value })} /></label>
              </div>
              <label className="campo"><span>Autorizado por</span>
                <input value={d.tarifaAutorizadoPor} onChange={(e) => setD({ ...d, tarifaAutorizadoPor: e.target.value })} placeholder="Instancia que aprueba" /></label>
              {ct.id === "PROTEGIDO" && <div className="cg2-hint">Tarifa social: paga {(ct.factorTarifa * 100).toFixed(0)}% de la tarifa vigente, con cupo de referencia de {ct.cupoMensualKg} kg al mes.</div>}
              {ct.id === "EXONERADO" && <div className="cg2-hint">Exonerado: no paga. La operación igual genera factura, BOP y salida de inventario.</div>}
            </div>
          )}

          {u.bitacora?.length > 0 && (
            <>
              <div className="cg2-sep">Bitácora de cambios</div>
              <div className="cg2-bitacora">
                {u.bitacora.slice(0, 6).map((b, i) => (
                  <div key={i}><b>{b.campo}</b><span>{String(b.antes ?? "—")} → {String(b.despues ?? "—")}</span><small>{fechaCorta(b.fecha)} · {b.autor}</small></div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={!avalOk} onClick={() => onSave({
            ...d, tarifaVence: d.tarifaVence ? new Date(`${d.tarifaVence}T12:00:00`) : null,
          })}><Save size={14} /> Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}

const isoDe = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ════════════════════════════════════════════════════════════════
   VENTAS SIN CONTRATO · código genérico
   ════════════════════════════════════════════════════════════════ */

export function VentasSinContrato({ facturas = [], solicitudes = [], onVender }) {
  const [modal, setModal] = useState(false);
  const ventas = facturas.filter((f) => f.origen === "SIN_CONTRATO");

  const totalGenerico = ventas.reduce((a, f) => a + Number(f.total || 0), 0);
  const kgGenerico = ventas.reduce((a, f) => a + cpt(f.concepto).kg * Number(f.cantidad || 0), 0);
  const kgTotal = solicitudes.filter((s) => s.estado === "CULMINADO").reduce((a, s) => a + kgDeSolicitud(s), 0) + kgGenerico;
  const proporcion = kgTotal ? kgGenerico / kgTotal : 0;
  const alerta = proporcion > UMBRAL_ALERTA_GENERICO;

  function exportar() {
    descargar("ventas-sin-contrato.csv", csv([
      ["VENTAS SIN CONTRATO · CÓDIGO GENÉRICO"], [EMPRESA.nombre], ["Corte", fechaGuion(HOY)], [],
      ["Factura", "Fecha", "Código genérico", "Canal", "Comprador", "Documento", "CDT", "Concepto",
       "Cantidad", "Kg", "Litros", "Base Bs", "IVA Bs", "Total Bs", "Banco", "Referencia"],
      ...ventas.map((f) => {
        const kg = cpt(f.concepto).kg * Number(f.cantidad || 0);
        return [f.serie, fechaGuion(f.fecha), f.codigoGenerico, f.canal, f.compradorNombre, f.compradorDoc,
          cdtOf(f.cdt).corto, cpt(f.concepto).nombre, f.cantidad, kg.toFixed(2), kgALitros(kg).toFixed(2),
          Number(f.base || 0).toFixed(2), Number(f.iva || 0).toFixed(2), Number(f.total || 0).toFixed(2),
          f.pago?.banco || "", f.pago?.referencia || ""];
      }),
      [], ["TOTAL", "", "", "", "", "", "", "", ventas.reduce((a, f) => a + Number(f.cantidad || 0), 0),
        kgGenerico.toFixed(2), kgALitros(kgGenerico).toFixed(2), "", "", totalGenerico.toFixed(2)],
      [], ["CONTROL"], ["Proporción sobre el despacho total", `${(proporcion * 100).toFixed(1)}%`],
      ["Umbral de alerta", `${(UMBRAL_ALERTA_GENERICO * 100).toFixed(0)}%`],
    ]));
  }

  return (
    <div className="cg2">
      <GestionStyles />
      <div className="cg2-hero">
        <div>
          <span>VENTAS QUE USAN INVENTARIO Y GENERAN INGRESO</span>
          <h2>Ventas sin contrato</h2>
          <p>Se venden bombonas y granel a personas sin código de usuario: en planta, en planta móvil y en jornadas.
             Formalizarlas contra un código genérico las incorpora al inventario y al libro de ventas, en lugar de
             dejarlas fuera del sistema.</p>
        </div>
        <div className="cg2-hero-side">
          <button className="btn primary" onClick={() => setModal(true)}><ShoppingBag size={15} /> Registrar venta</button>
          <small>Tope de {TOPE_UNIDADES_GENERICO} unidades por operación</small>
        </div>
      </div>

      <div className="cg2-kpis">
        <G2K label="Ventas registradas" value={ventas.length} note="contra código genérico" />
        <G2K label="Ingreso" value={`Bs ${bs(totalGenerico)}`} note="ya asentado en el libro" tone="money" />
        <G2K label="GLP despachado" value={`${num(kgGenerico)} kg`} note={`${num(kgALitros(kgGenerico))} L`} />
        <G2K label="Proporción del despacho" value={`${(proporcion * 100).toFixed(1)}%`}
          note={`umbral de alerta ${(UMBRAL_ALERTA_GENERICO * 100).toFixed(0)}%`} tone={alerta ? "warn" : "ok"} />
      </div>

      <div className={`cg2-correlativo ${alerta ? "bad" : "ok"}`}>
        {alerta ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
        <div>
          <b>{alerta ? "El código genérico supera el umbral de control" : "Uso del código genérico dentro de lo esperado"}</b>
          <span>Un genérico sin límites se vuelve el destino de todo el producto que no se quiere justificar.
            Por eso se exige identificación del comprador aunque no tenga contrato, hay tope por operación y
            el sistema avisa cuando la proporción supera el {(UMBRAL_ALERTA_GENERICO * 100).toFixed(0)}% del despacho.</span>
        </div>
      </div>

      <section className="card">
        <div className="card-h">
          <div><h2>Operaciones registradas <span className="cnt">{ventas.length}</span></h2>
            <span className="card-note">Cada una descuenta inventario y entra al libro de ventas como cualquier factura.</span></div>
          <button className="btn sm" onClick={exportar}><Download size={14} /> CSV</button>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Factura</th><th>Fecha</th><th>Código genérico</th><th>Canal</th><th>Comprador</th><th>Concepto</th><th className="r">Cant.</th><th className="r">Kg / L</th><th className="r">Total Bs</th></tr></thead>
            <tbody>
              {ventas.map((f) => {
                const kg = cpt(f.concepto).kg * Number(f.cantidad || 0);
                return (
                  <tr key={f.id}>
                    <td className="mono strong">{f.serie}</td>
                    <td className="muted">{fechaCorta(f.fecha)}</td>
                    <td className="mono">{f.codigoGenerico}</td>
                    <td><span className="tag alt">{f.canal === "GRANEL" ? "Granel" : f.canal === "PLANTA_MOVIL" ? "Planta móvil" : "Planta"}</span></td>
                    <td><div className="u-name sm">{f.compradorNombre}</div><div className="u-doc">{f.compradorDoc}</div></td>
                    <td className="c-name">{cpt(f.concepto).nombre}</td>
                    <td className="r mono">{num(f.cantidad)}</td>
                    <td className="r mono">{num(kg)} / {num(kgALitros(kg))}</td>
                    <td className="r mono strong">{bs(f.total)}</td>
                  </tr>
                );
              })}
              {!ventas.length && <tr><td colSpan={9} className="cg2-empty">Todavía no se ha registrado ninguna venta sin contrato.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {modal && <ModalVentaGenerica onClose={() => setModal(false)} onSave={(d) => { onVender?.(d); setModal(false); }} />}
    </div>
  );
}

function ModalVentaGenerica({ onClose, onSave }) {
  const [d, setD] = useState({
    codigoGenerico: CODIGOS_GENERICOS[0].id, cantidad: 1, canal: "PLANTA",
    compradorNombre: "", compradorDoc: "", banco: "BDV", referencia: "",
  });
  const g = CODIGOS_GENERICOS.find((x) => x.id === d.codigoGenerico) || CODIGOS_GENERICOS[0];
  const cantidad = Number(d.cantidad || 0);
  const precio = precioVigente(g.concepto, HOY);
  const bruto = precio * cantidad;
  const excedeTope = g.canal !== "GRANEL" && cantidad > TOPE_UNIDADES_GENERICO;
  const ok = cantidad > 0 && !excedeTope && d.compradorNombre.trim().length > 4 && d.compradorDoc.trim().length > 4;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><div><div className="mh-eyebrow">Comercialización</div><h3>Venta sin contrato</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-b">
          <p className="modal-intro">Usa inventario de gas y genera ingreso por venta. Entra al libro de ventas
            igual que cualquier factura, identificada como venta sin contrato.</p>

          <label className="campo"><span>Código genérico</span>
            <select value={d.codigoGenerico} onChange={(e) => setD({ ...d, codigoGenerico: e.target.value })}>
              {CODIGOS_GENERICOS.map((x) => <option key={x.id} value={x.id}>{x.id} — {x.nombre}</option>)}
            </select></label>

          <div className="row2">
            <label className="campo"><span>{g.canal === "GRANEL" ? "Kilogramos" : "Cantidad de cilindros"}</span>
              <input type="number" min="1" value={d.cantidad} onChange={(e) => setD({ ...d, cantidad: e.target.value })} /></label>
            <label className="campo"><span>Canal de venta</span>
              <select value={d.canal} onChange={(e) => setD({ ...d, canal: e.target.value })}>
                <option value="PLANTA">Planta / CDT</option>
                <option value="PLANTA_MOVIL">Planta móvil</option>
                <option value="GRANEL">Granel</option>
              </select></label>
          </div>
          {excedeTope && <div className="cg2-err">Supera el tope de {TOPE_UNIDADES_GENERICO} unidades por operación. Una compra mayor debe hacerse con código de usuario.</div>}

          <div className="cg2-sep">Identificación del comprador</div>
          <div className="cg2-hint">Aunque no tenga contrato, la factura exige nombre y documento del receptor.</div>
          <div className="row2">
            <label className="campo"><span>Nombre y apellido</span>
              <input value={d.compradorNombre} onChange={(e) => setD({ ...d, compradorNombre: e.target.value })} /></label>
            <label className="campo"><span>Cédula</span>
              <input value={d.compradorDoc} onChange={(e) => setD({ ...d, compradorDoc: e.target.value })} placeholder="V-00.000.000" /></label>
          </div>
          <div className="row2">
            <label className="campo"><span>Banco</span>
              <input value={d.banco} onChange={(e) => setD({ ...d, banco: e.target.value })} /></label>
            <label className="campo"><span>Referencia de pago</span>
              <input value={d.referencia} onChange={(e) => setD({ ...d, referencia: e.target.value })} /></label>
          </div>

          <div className="preview">
            <div className="preview-h">Monto calculado · tarifa de {etiquetaPeriodo(PERIODOS_PRECIO[PERIODOS_PRECIO.length - 1])}</div>
            <div className="preview-monto">Bs {bs(bruto * (1 + IVA))}</div>
            <div className="preview-det">Base {bs(bruto)} · IVA {bs(bruto * IVA)} · {num(cpt(g.concepto).kg * cantidad)} kg · {num(kgALitros(cpt(g.concepto).kg * cantidad))} L</div>
          </div>
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={!ok} onClick={() => onSave({ ...d, cantidad })}><Check size={14} /> Registrar venta</button>
        </div>
      </div>
    </div>
  );
}

/* ── Piezas compartidas ── */

function G2K({ label, value, note, tone = "" }) {
  return <div className={`cg2-k ${tone}`}><span>{label}</span><b>{value}</b><small>{note}</small></div>;
}

export function GestionStyles() {
  return <style>{`
.cg2{display:flex;flex-direction:column;gap:14px}
.cg2-hero{background:#fff;border:1px solid #E2E8EC;border-radius:16px;padding:18px 20px;display:flex;justify-content:space-between;gap:24px;align-items:flex-start}
.cg2-hero>div:first-child>span{font-size:9px;font-weight:800;color:#26704C;letter-spacing:.05em}
.cg2-hero h2{margin:6px 0;font-size:22px}
.cg2-hero p{margin:0;color:#6E7C87;font-size:11.5px;line-height:1.6;max-width:760px}
.cg2-hero-side{display:flex;flex-direction:column;gap:7px;align-items:flex-end;flex:none}
.cg2-hero-side small{font-size:9.5px;color:#7C8892}
.cg2-pill{display:flex;align-items:center;gap:6px;background:#EAF5EE;color:#17623F;padding:8px 11px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap}
.cg2-pill.closed{background:#EDF0F2;color:#4C5963}
.cg2-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.cg2-k{background:#fff;border:1px solid #E2E8EC;border-radius:14px;padding:13px;display:flex;flex-direction:column;gap:4px}
.cg2-k span{font-size:10px;color:#71808A}
.cg2-k b{font-size:20px;line-height:1.15}
.cg2-k small{font-size:9.5px;color:#84919B}
.cg2-k.money b{color:#17623F}.cg2-k.warn b{color:#A2701A}.cg2-k.ok b{color:#1C7A50}
.cg2-tres{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.cg2-estado{background:#fff;border:1px solid #E2E8EC;border-radius:14px;padding:14px;border-left-width:4px}
.cg2-estado span{display:block;font-size:9.5px;font-weight:800;color:#71808A;letter-spacing:.03em}
.cg2-estado b{display:block;font-size:23px;margin:6px 0 4px}
.cg2-estado small{display:block;font-size:10px;color:#7B8791;line-height:1.45}
.cg2-estado.ok{border-left-color:#1C7A50}.cg2-estado.ok b{color:#1C7A50}
.cg2-estado.warn{border-left-color:#D08A24}.cg2-estado.warn b{color:#A2701A}
.cg2-estado.money{border-left-color:#2D65B0}.cg2-estado.money b{color:#2D65B0}
.cg2-regla,.cg2-nota{display:flex;gap:10px;align-items:flex-start;background:#EDF6F1;border:1px solid #D7E8DE;border-radius:13px;padding:12px 14px;color:#2F5B45}
.cg2-regla>div>b,.cg2-regla>div>span{display:block}
.cg2-regla>div>b{font-size:12px;margin-bottom:3px}
.cg2-regla>div>span,.cg2-nota span{font-size:10.5px;line-height:1.55}
.cg2-nota{background:#F4F7F9;border-color:#E0E7EC;color:#4B5A66}
.cg2-correlativo{display:flex;gap:10px;align-items:flex-start;border-radius:13px;padding:12px 14px}
.cg2-correlativo.ok{background:#EDF6F1;border:1px solid #D7E8DE;color:#2F5B45}
.cg2-correlativo.bad{background:#FFF6E7;border:1px solid #EED8B2;color:#82561D}
.cg2-correlativo>div>b,.cg2-correlativo>div>span{display:block}
.cg2-correlativo>div>b{font-size:12px;margin-bottom:3px}
.cg2-correlativo>div>span{font-size:10.5px;line-height:1.5}
.cg2-libro{min-width:1180px}
.cg2-empty{text-align:center!important;color:#74818B;padding:34px!important}
.cg2-money{color:#17623F}
.cg2-cargo{color:#A24848}
.cg2-var{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:999px;font-size:9px;font-weight:800}
.cg2-var.up{background:#FBE9E9;color:#9A4141}
.cg2-var.down{background:#E7F4EC;color:#21704A}
.cg2-var.flat{background:#EDF1F4;color:#53616B}
.cg2-filtros{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:10px;margin-bottom:12px}
.cg2-filtros label span{display:block;font-size:9.5px;color:#697783;margin-bottom:5px}
.cg2-filtros select{width:100%;box-sizing:border-box;border:1px solid #DCE4E9;border-radius:9px;padding:8px;font:inherit;font-size:11px;background:#fff}
/* El estado de cuenta lleva siete columnas: sin esto hereda el ancho del modal
   genérico (560px) y los importes quedan fuera de vista. */
.cg2-modal{width:min(880px,96vw);max-width:min(880px,96vw)}
.cg2-cuenta table{width:100%;min-width:0}
.cg2-cuenta td,.cg2-cuenta th{padding-left:10px;padding-right:10px}
.cg2-cuenta .c-name{white-space:normal;line-height:1.45;min-width:170px}
.cg2-saldo-head{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:10px;margin-bottom:12px}
.cg2-saldo-head>div{background:#F4F7F8;border-radius:10px;padding:11px}
.cg2-saldo-head span{display:block;font-size:9px;color:#6E7C87}
.cg2-saldo-head b{display:block;font-size:13px;margin-top:3px}
.cg2-saldo-head .big{background:#EDF6F1;border:1px solid #D7E8DE}
.cg2-saldo-head .big b{font-size:20px;color:#17623F}
.cg2-cuenta{max-height:300px}
.cg2-regla-saldo{margin-top:14px;background:#F1F6F3;border:1px solid #D3E3D9;border-radius:11px;padding:13px 14px;display:flex;gap:11px;align-items:flex-start}
.cg2-regla-saldo svg{color:#1F7A4C;flex:none;margin-top:1px}
.cg2-regla-saldo b{display:block;font-size:12.5px;font-weight:640;color:#17623F;line-height:1.4}
.cg2-regla-saldo span{display:block;font-size:11.5px;color:#3A464E;line-height:1.6;margin-top:5px}
.cg2-anulado td{opacity:.55}
.cg2-anulado td.r.mono{text-decoration:line-through}
.cg2-anul-nota{font-size:10.5px;color:#A83E3E;line-height:1.45;margin-top:3px;font-weight:550}
.cg2-err{background:#FBE9E9;border:1px solid #F0D2D2;color:#9A4141;border-radius:9px;padding:9px;font-size:10px;margin-top:8px}
.cg2-hint{background:#F4F7F9;border:1px solid #E0E7EC;color:#4B5A66;border-radius:9px;padding:11px 12px;font-size:11.5px;line-height:1.55;margin-bottom:8px}

/* Resumen por tipo de cliente. Cada tarjeta filtra el padrón al pulsarla. */
.cg2-segmentos{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.cg2-seg{
  text-align:left;background:#fff;border:0;box-shadow:0 0 0 1px #DDE4E8;border-radius:12px;
  padding:15px 16px;cursor:pointer;display:flex;flex-direction:column;gap:6px;transition:.14s;
}
.cg2-seg:hover{box-shadow:0 0 0 1px #C3CED5,0 2px 8px rgba(16,23,32,.06)}
.cg2-seg.on{box-shadow:0 0 0 2px #1F7A4C;background:#F4FAF6}
.cg2-seg-n{font-size:12px;font-weight:650;color:#516069;letter-spacing:.01em}
.cg2-seg>b{font-size:28px;font-weight:680;color:#141C21;line-height:1.05;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.cg2-seg-d{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:#6B7B85;line-height:1.45}
.cg2-seg-d span{display:inline-flex;align-items:center;gap:5px}
.cg2-seg-d .pt{width:7px;height:7px;border-radius:99px;background:#94A3AC;flex:none}
.cg2-seg-d .pt.ok{background:#1F7A4C}
.cg2-seg-d .pt.warn{background:#9A6410}
.cg2-seg small{font-size:11px;color:#8A97A1;line-height:1.45;border-top:1px solid #EDF1F3;padding-top:7px;margin-top:2px}
.cg2-seg em{font-style:normal;font-size:11px;font-weight:600;color:#1F7A4C}

/* Estado definido por una persona: se ve que fue decisión, no cálculo. */
.cg2-est-manual{display:flex;flex-direction:column;gap:3px;align-items:flex-start}
.cg2-est-manual small{font-size:10.5px;color:#8A5A16;font-weight:600;line-height:1.35;cursor:help}
.cg2-sep{font-size:9.5px;font-weight:800;color:#26704C;letter-spacing:.05em;text-transform:uppercase;margin:16px 0 9px;padding-bottom:6px;border-bottom:1px solid #E6ECEF}
.cg2-protegidos{display:flex;gap:9px;align-items:flex-start;background:#F4F7F9;border:1px solid #E0E7EC;border-radius:11px;padding:11px;margin-bottom:14px;color:#4B5A66;font-size:10.5px;line-height:1.5}
.cg2-aval{background:#FFFCF5;border:1px solid #E6D7BC;border-radius:12px;padding:12px;margin-top:6px}
.cg2-aval-h{display:flex;gap:8px;align-items:flex-start;color:#82561D;font-size:10.5px;line-height:1.5;margin-bottom:10px}
.cg2-bitacora{display:flex;flex-direction:column;gap:6px}
.cg2-bitacora>div{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;background:#F6F8F9;border-radius:9px;padding:8px 10px}
.cg2-bitacora b{font-size:10px}
.cg2-bitacora span{font-size:10px;color:#5D6B76}
.cg2-bitacora small{font-size:9px;color:#84919B;white-space:nowrap}
@media(max-width:1000px){.cg2-tres,.cg2-filtros{grid-template-columns:1fr}.cg2-hero{flex-direction:column}.cg2-saldo-head{grid-template-columns:1fr}}
`}</style>;
}
