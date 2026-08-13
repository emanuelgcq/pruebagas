import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  Truck, ClipboardList, CheckCircle2, X, ChevronLeft, ChevronRight, Check,
  MapPin, Phone, Package, Gauge, PenLine, RotateCcw, AlertTriangle, Navigation,
  User, Users, LogOut, Search, FileText, Receipt, Clock, Fuel, ListChecks, ShieldCheck,
} from "lucide-react";
import {
  LOGO_GASLARA, LOGO_LARA, EMPRESA, HOY, CDTS, cpt, usr, tpd, cdtOf, comunaOf, banco,
  bs, num, fecha, fechaLarga, faseIdx,
} from "./datos.jsx";

const PERFILES = {
  GASLARA: { tipo: "GASLARA", nombre: "L. Torrealba", ci: "V-16.442.870", unidad: "Placa A54BC7K", cdt: "CDT-BQTO", carga: 1800, etiqueta: "Unidad propia GasLara" },
  EPSDC: { tipo: "EPSDC", nombre: "J. Castillo", ci: "V-18.904.221", unidad: "EPSDC · Placa A71CD2F", cdt: "CDT-BQTO", carga: 1800, epsdc: "EPSDC-01", etiqueta: "Despachador EPSDC" },
};

export default function AppOperaciones({ solicitudes, abrirAD, entregar, validarCierre }) {
  const [sesion, setSesion] = useState(false);
  const [perfilId, setPerfilId] = useState("GASLARA");
  const operador = PERFILES[perfilId];
  const [tab, setTab] = useState("ruta");
  const [pantalla, setPantalla] = useState(null);   // { t, s }
  const [toast, setToast] = useState(null);
  const [incidencias, setIncidencias] = useState({});
  const scroll = useRef(null);
  const aviso = (m) => { setToast(m); setTimeout(() => setToast(null), 2800); };

  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [tab]);

  const delCdt = useMemo(
    () => solicitudes.filter((s) => s.cdt === operador.cdt),
    [solicitudes, operador.cdt]
  );
  const porDespachar = delCdt.filter((s) => s.estado === "PAGADA"
    || (s.estado === "EN_AD" && (s.transportistaTipo || "GASLARA") === operador.tipo));
  const entregadas = delCdt.filter(
    (s) => faseIdx(s.estado) >= 2 && s.firma && (s.transportistaTipo || "GASLARA") === operador.tipo
  );
  const kgDia = entregadas.reduce((a, s) => a + cpt(s.concepto).kg * s.cantidad, 0);
  const kgPend = porDespachar.reduce((a, s) => a + cpt(s.concepto).kg * s.cantidad, 0);

  function onTomar(s) {
    const id = abrirAD(s, {
      operador: operador.nombre,
      unidad: operador.unidad,
      transportistaTipo: operador.tipo,
      epsdc: operador.epsdc || null,
    });
    aviso(`${id} asignada a ${operador.tipo === "EPSDC" ? "EPSDC" : "tu unidad"}`);
  }

  function onEntregar(s, datos) {
    const r = entregar(s, datos);
    if (!r?.ok) { aviso(r?.errores?.[0] || "No se pudo cerrar el AD"); return; }
    setPantalla({ t: "listo", s, r });
  }

  function onIncidencia(s, motivo) {
    setIncidencias((p) => ({ ...p, [s.id]: motivo }));
    setPantalla(null);
    aviso("Incidencia registrada");
  }

  return (
    <div className="op">
      <EstilosOp />
      <div className="op-stage">
        <div className="op-lado">
          <img src={LOGO_GASLARA} alt="GasLara" className="op-lado-logo" />
          <h2>Operaciones</h2>
          <p>Aplicación de campo para llevar lotes consolidados a las comunas. En residencial, la unidad hace una sola parada por comuna; las líneas individuales solo indican qué bombona corresponde a cada persona.</p>
          <ul>
            <li><span>1</span> Carga el lote consolidado de la comuna</li>
            <li><span>2</span> Entrega todo el lote al responsable comunal</li>
            <li><span>3</span> La comuna distribuye luego a sus miembros</li>
          </ul>
          <div className="op-lado-pie">
            <img src={LOGO_LARA} alt="Gobierno de Lara" />
            <span>Datos de demostración<br />sin validez fiscal</span>
          </div>
        </div>

        <div className="op-phone">
          {!sesion ? <Login perfilId={perfilId} setPerfilId={setPerfilId} onEntrar={() => setSesion(true)} /> : (
            <>
              <header className="op-top">
                <div className="op-top-l">
                  <div className="op-unidad"><Truck size={13} /> {operador.unidad}</div>
                  <b>{operador.nombre}</b>
                  <span className={`op-chip ${operador.tipo === "EPSDC" ? "mo" : "vd"}`}>{operador.etiqueta}</span>
                </div>
                <div className="op-top-r">{cdtOf(operador.cdt).corto}</div>
              </header>

              <div className="op-screen" ref={scroll}>
                {tab === "ruta" && (
                  <Ruta {...{ porDespachar, incidencias, onTomar, setPantalla, kgPend }} />
                )}
                {tab === "hechas" && <Hechas entregadas={entregadas} setPantalla={setPantalla} />}
                {tab === "resumen" && <Resumen {...{ entregadas, porDespachar, kgDia, kgPend, operador }} onSalir={() => { setSesion(false); setTab("ruta"); }} />}
                <div className="op-fondo" />
              </div>

              <nav className="op-tabs">
                <button className={tab === "ruta" ? "on" : ""} onClick={() => setTab("ruta")}>
                  <ClipboardList size={22} /><span>Mi ruta</span>{porDespachar.length > 0 && <i>{porDespachar.length}</i>}
                </button>
                <button className={tab === "hechas" ? "on" : ""} onClick={() => setTab("hechas")}>
                  <CheckCircle2 size={22} /><span>Entregadas</span>
                </button>
                <button className={tab === "resumen" ? "on" : ""} onClick={() => setTab("resumen")}>
                  <Gauge size={22} /><span>Resumen</span>
                </button>
              </nav>
            </>
          )}

          {pantalla && (
            <div className="op-full">
              {pantalla.t === "detalle" && (
                <Detalle s={pantalla.s} validacion={pantalla.s.estado === "EN_AD" ? validarCierre(pantalla.s) : null} onClose={() => setPantalla(null)}
                  onTomar={() => { onTomar(pantalla.s); setPantalla(null); }}
                  onEntregar={() => setPantalla({ t: "firma", s: pantalla.s })}
                  onIncidencia={() => setPantalla({ t: "incidencia", s: pantalla.s })} />
              )}
              {pantalla.t === "firma" && (
                <Firma s={pantalla.s} onClose={() => setPantalla({ t: "detalle", s: pantalla.s })}
                  onConfirmar={(d) => onEntregar(pantalla.s, d)} />
              )}
              {pantalla.t === "listo" && (
                <Listo s={pantalla.s} r={pantalla.r} onClose={() => { setPantalla(null); setTab("ruta"); }} />
              )}
              {pantalla.t === "incidencia" && (
                <Incidencia s={pantalla.s} onClose={() => setPantalla({ t: "detalle", s: pantalla.s })}
                  onGuardar={(m) => onIncidencia(pantalla.s, m)} />
              )}
              {pantalla.t === "comprobante" && (
                <Comprobante s={pantalla.s} onClose={() => setPantalla(null)} />
              )}
            </div>
          )}

          {toast && <div className="op-toast"><CheckCircle2 size={15} /> {toast}</div>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════  LOGIN  ═══════════ */

function Login({ perfilId, setPerfilId, onEntrar }) {
  return (
    <div className="op-login">
      <img src={LOGO_GASLARA} alt="GasLara" />
      <div className="op-login-t">Operaciones</div>
      <div className="op-login-b">
        <label className="op-campo"><span>Cédula del operador</span>
          <input defaultValue="16442870" inputMode="numeric" /></label>
        <label className="op-campo"><span>Clave</span>
          <input type="password" defaultValue="••••••" /></label>
        <label className="op-campo"><span>Tipo de usuario de despacho</span>
          <select value={perfilId} onChange={(e) => setPerfilId(e.target.value)}>
            <option value="GASLARA">Operador GasLara · unidad propia</option>
            <option value="EPSDC">Despachador EPSDC · tercero autorizado</option>
          </select></label>
        <label className="op-campo"><span>Unidad asignada</span>
          <input value={PERFILES[perfilId].unidad} readOnly /></label>
        {perfilId === "EPSDC" && <div className="op-alerta mo"><Truck size={14} /> Este perfil registra transporte EPSDC. Cada AD cerrado alimenta automáticamente el resumen de venta transportada y el cálculo del 30%.</div>}
        <button className="op-btn pri gr full" onClick={onEntrar}><Truck size={18} /> Iniciar jornada</button>
      </div>
      <div className="op-login-p">
        <img src={LOGO_LARA} alt="Gobierno de Lara" />
        <span>{EMPRESA.sistema}<br />{fechaLarga(HOY)}</span>
      </div>
    </div>
  );
}

/* ═══════════  RUTA  ═══════════ */

function Ruta({ porDespachar, incidencias, onTomar, setPantalla, kgPend }) {
  const [q, setQ] = useState("");
  const filtra = (l) => l.filter((s) => !q || usr(s.usuario).nombre.toLowerCase().includes(q.toLowerCase())
    || s.id.includes(q) || (s.ad || "").includes(q) || comunaOf(usr(s.usuario).comuna).nombre.toLowerCase().includes(q.toLowerCase()));
  const visibles = filtra(porDespachar);
  const comunales = visibles.filter((s) => s.modalidadEntrega !== "DIRECTA_COMERCIAL");
  const directos = visibles.filter((s) => s.modalidadEntrega === "DIRECTA_COMERCIAL");
  const grupos = Object.values(comunales.reduce((acc, s) => {
    const com = comunaOf(usr(s.usuario).comuna);
    const k = `${com.id}-${s.jornadaComunal || "SIN-JORNADA"}`;
    if (!acc[k]) acc[k] = { com, jornada: s.entrega, items: [] };
    acc[k].items.push(s);
    if (s.entrega < acc[k].jornada) acc[k].jornada = s.entrega;
    return acc;
  }, {}));

  return (
    <>
      <div className="op-hero">
        <div><span>Paradas comunales</span><b>{grupos.length}</b></div>
        <div><span>GLP por despachar</span><b>{num(kgPend)} kg</b></div>
      </div>

      <div className="op-buscar"><Search size={16} /><input placeholder="Buscar comuna, persona o AD" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="op-alerta az"><Users size={14}/> En residencial, todas las bombonas de una comuna se llevan juntas el mismo día. No son paradas casa por casa.</div>

      {grupos.map((g) => {
        const bombonas = g.items.reduce((a, s) => a + Number(s.cantidad || 0), 0);
        const kg = g.items.reduce((a, s) => a + cpt(s.concepto).kg * Number(s.cantidad || 0), 0);
        return <div className="op-lote" key={`${g.com.id}-${g.jornada?.getTime?.() || 0}`}>
          <div className="op-lote-h"><div><b>{g.com.nombre}</b><span>{g.com.punto}</span></div><span className="op-chip vd">Una sola parada</span></div>
          <div className="op-lote-meta"><span><User size={12}/> {g.items.length} personas</span><span><Package size={12}/> {bombonas} bombonas</span><span><Fuel size={12}/> {num(kg)} kg</span><span><Clock size={12}/> {g.jornada ? fecha(g.jornada) : "Por programar"}</span></div>
          <div className="op-lote-note">Líneas del lote · se conservan individualmente para pago, factura y trazabilidad.</div>
          {g.items.map((s) => <Tarjeta key={s.id} s={s} inc={incidencias[s.id]} onClick={() => setPantalla({ t: "detalle", s })}
            accion={s.estado === "PAGADA" ? <button className="op-btn chico" onClick={(e) => { e.stopPropagation(); onTomar(s); }}>Tomar línea</button> : null} />)}
        </div>;
      })}

      {directos.length > 0 && <div className="op-lbl"><Truck size={12}/> Excepciones / uso comercial · entrega directa</div>}
      {directos.map((s) => <Tarjeta key={s.id} s={s} inc={incidencias[s.id]} onClick={() => setPantalla({ t: "detalle", s })}
        accion={s.estado === "PAGADA" ? <button className="op-btn chico" onClick={(e) => { e.stopPropagation(); onTomar(s); }}>Tomar</button> : null} />)}

      {!visibles.length && <div className="op-vacio"><CheckCircle2 size={30} /><p>Ruta completada.<br />No queda nada por despachar.</p></div>}
    </>
  );
}

function Tarjeta({ s, onClick, accion, inc }) {
  const c = cpt(s.concepto), u = usr(s.usuario), td = tpd(s.tipoDespacho), com = comunaOf(u.comuna);
  return (
    <button className={`op-card ${s.estado === "EN_AD" ? "mia" : ""}`} onClick={onClick}>
      <div className="op-card-h">
        <div className="op-card-id">{s.ad || s.id}</div>
        {inc ? <span className="op-chip rj">Incidencia</span>
             : s.estado === "EN_AD" ? <span className="op-chip vd">En mi unidad</span>
             : <span className="op-chip gr">En cola</span>}
      </div>
      <div className="op-card-u">{com.nombre}</div>
      <div className="op-card-d"><MapPin size={13} /> {com.punto}</div>
      <div className="op-card-d"><User size={13} /> Beneficiario registrado: {u.nombre}</div>
      {s.transportistaTipo && <div className="op-card-d"><Truck size={13} /> {s.transportistaTipo === "EPSDC" ? "Transporte EPSDC" : "Unidad propia GasLara"}{s.unidad ? ` · ${s.unidad}` : ""}</div>}
      <div className="op-card-f">
        <div className="op-prod"><Package size={14} /> {c.corto} × {s.cantidad}
          {c.kg > 0 && <em>{num(c.kg * s.cantidad)} kg</em>}</div>
        {accion || (td.requierePago
          ? <div className="op-pag"><Check size={12} /> Pagado</div>
          : <span className="op-chip mo">{td.nombre}</span>)}
      </div>
    </button>
  );
}

/* ═══════════  DETALLE  ═══════════ */

function Detalle({ s, validacion, onClose, onTomar, onEntregar, onIncidencia }) {
  const c = cpt(s.concepto), u = usr(s.usuario), td = tpd(s.tipoDespacho), com = comunaOf(u.comuna);
  const bk = s.pago.banco ? banco(s.pago.banco) : null;
  const mia = s.estado === "EN_AD";
  return (
    <>
      <div className="op-nav">
        <button onClick={onClose}><ChevronLeft size={22} /></button>
        <h2>{s.ad || s.id}</h2>
        <span />
      </div>
      <div className="op-body">
        <section className="op-bloque destacado">
          <div className="op-b-t">{s.modalidadEntrega === "DIRECTA_COMERCIAL" ? "Entrega directa · excepción comercial" : "Punto único de entrega · comuna"}</div>
          <div className="op-usuario">{com.nombre}</div>
          <div className="op-doc">Responsable: {com.coordinador} · {com.tel}</div>
          <div className="op-dir"><MapPin size={15} /><div>{s.modalidadEntrega === "DIRECTA_COMERCIAL" ? u.dir : com.punto}<span>{s.modalidadEntrega === "DIRECTA_COMERCIAL" ? u.sector : `${com.sector} · la comuna distribuye después a sus miembros`}</span></div></div>
          <div className="op-acciones">
            <a className="op-btn" href={`tel:${com.tel.replace(/\D/g, "")}`}><Phone size={16} /> Llamar</a>
            <a className="op-btn" href={`https://maps.google.com/?q=${encodeURIComponent(com.punto)}`}
               target="_blank" rel="noreferrer"><Navigation size={16} /> Ir</a>
          </div>
        </section>

        <section className="op-bloque">
          <div className="op-b-t">Usuario asignado</div>
          <div className="op-kv chico">
            <div><span>Usuario</span><b>{u.nombre}</b></div>
            <div><span>Documento</span><b>{u.doc}</b></div>
            <div><span>Contrato</span><b>{u.contrato}</b></div>
            <div><span>Dirección registrada</span><b>{u.dir}</b></div>
          </div>
        </section>

        <section className="op-bloque">
          <div className="op-b-t">Despacho</div>
          <div className="op-kv">
            <div><span>Producto</span><b>{c.nombre}</b></div>
            <div><span>Cantidad</span><b>{num(s.cantidad)} {c.unidad}</b></div>
            {c.kg > 0 && <div><span>Salida GLP</span><b>{num(c.kg * s.cantidad)} kg</b></div>}
            <div><span>Tipo</span><b>{td.nombre}</b></div>
            <div><span>Horario</span><b>{s.ventana}</b></div>
            {s.transportistaTipo && <div><span>Transportista</span><b>{s.transportistaTipo === "EPSDC" ? "EPSDC · tercero" : "GasLara · propio"}</b></div>}
            {s.unidad && <div><span>Unidad</span><b>{s.unidad}</b></div>}
          </div>
          {s.nota && <div className="op-nota"><FileText size={13} /> {s.nota}</div>}
        </section>

        <section className="op-bloque">
          <div className="op-b-t">Cobro</div>
          {td.requierePago ? (
            <>
              <div className="op-monto"><span>Ya pagado por el usuario</span><b>Bs {bs(s.total)}</b></div>
              <div className="op-kv chico">
                <div><span>Banco</span><b>{bk.nombre}</b></div>
                <div><span>Referencia</span><b>{s.pago.referencia}</b></div>
              </div>
              <div className="op-alerta vd"><Check size={14} /> No cobres nada al entregar. El pago ya está verificado.</div>
            </>
          ) : (
            <div className="op-alerta mo"><AlertTriangle size={14} /> Despacho {td.nombre.toLowerCase()}: no requiere cobro en campo. La boleta se genera al cierre{td.factura ? " y la factura queda registrada automáticamente" : ""}.</div>
          )}
        </section>

        {mia && <section className="op-bloque">
          <div className="op-b-t">Cuadre automático previo al cierre</div>
          <div className="op-checks">
            <div className="ok"><Check size={13}/><span>AD asignado y abierto</span></div>
            <div className={td.requierePago && s.pago?.estado !== "VERIFICADO" ? "bad" : "ok"}><Check size={13}/><span>{td.requierePago ? "Pago verificado" : "Despacho sin cobro autorizado"}</span></div>
            <div className={validacion?.ok ? "ok" : "bad"}><Check size={13}/><span>{validacion?.ok ? "Existencia física y cantidad disponibles para cierre" : (validacion?.errores?.[0] || "Pendiente de validación")}</span></div>
          </div>
          <div className="op-alerta az"><ShieldCheck size={14}/> No existe un verificador obligatorio. Si el cuadre automático es correcto, la entrega puede cerrar; si falla, queda como incidencia.</div>
        </section>}
      </div>

      <div className="op-pie">
        {mia ? (
          <>
            <button className="op-btn gr" onClick={onIncidencia}><AlertTriangle size={16} /> No pude entregar</button>
            <button className="op-btn pri gr full" onClick={onEntregar}><PenLine size={17} /> Entregar y firmar</button>
          </>
        ) : (
          <button className="op-btn pri gr full" onClick={onTomar}><Truck size={17} /> Tomar en mi unidad</button>
        )}
      </div>
    </>
  );
}

/* ═══════════  FIRMA  ═══════════ */

function Firma({ s, onClose, onConfirmar }) {
  const canvas = useRef(null);
  const [hayFirma, setHayFirma] = useState(false);
  const [receptor, setReceptor] = useState(comunaOf(usr(s.usuario).comuna).coordinador);
  const [obs, setObs] = useState("");
  const [cantidadEntregada, setCantidadEntregada] = useState(Number(s.cantidad));
  const dibujando = useRef(false);
  const c = cpt(s.concepto);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#12211E";
  }, []);

  const pos = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const empezar = (e) => {
    e.preventDefault();
    dibujando.current = true;
    const ctx = canvas.current.getContext("2d");
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    setHayFirma(true);
  };
  const mover = (e) => {
    if (!dibujando.current) return;
    e.preventDefault();
    const ctx = canvas.current.getContext("2d");
    const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const soltar = () => { dibujando.current = false; };
  const limpiar = () => {
    const cv = canvas.current;
    cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
    setHayFirma(false);
  };

  const confirmar = () => {
    onConfirmar({
      firma: canvas.current.toDataURL("image/png"),
      receptor: receptor.trim() || comunaOf(usr(s.usuario).comuna).coordinador,
      obs: obs.trim(),
      hora: "2:40 pm",
      cantidadEntregada: Number(cantidadEntregada),
    });
  };

  return (
    <>
      <div className="op-nav">
        <button onClick={onClose}><ChevronLeft size={22} /></button>
        <h2>Confirmar entrega</h2>
        <span />
      </div>
      <div className="op-body">
        <div className="op-resumen">
          <div><span>{c.corto} × {s.cantidad} · beneficiario {usr(s.usuario).nombre}</span><b>{s.modalidadEntrega === "DIRECTA_COMERCIAL" ? "Entrega comercial directa" : comunaOf(usr(s.usuario).comuna).nombre}</b></div>
          {c.kg > 0 && <div className="kg">{num(c.kg * s.cantidad)} kg</div>}
        </div>

        <label className="op-campo"><span>Cantidad efectivamente entregada</span>
          <input type="number" min="0.01" max={s.cantidad} step={c.bombona ? "1" : "0.01"} value={cantidadEntregada} onChange={(e)=>setCantidadEntregada(e.target.value)} />
          {Number(cantidadEntregada) < Number(s.cantidad) && Number(cantidadEntregada) > 0 && <small className="op-help">Entrega parcial: {num(Number(s.cantidad)-Number(cantidadEntregada))} quedarán pagados y volverán a la cola de despacho.</small>}
        </label>

        <label className="op-campo"><span>Responsable de comuna que recibe</span>
          <input value={receptor} onChange={(e) => setReceptor(e.target.value)} /></label>

        <div className="op-campo">
          <span>Firma del responsable comunal</span>
          <div className="op-firma">
            <canvas ref={canvas}
              onPointerDown={empezar} onPointerMove={mover}
              onPointerUp={soltar} onPointerLeave={soltar} />
            {!hayFirma && <div className="op-firma-ph"><PenLine size={17} /> Firma aquí con el dedo</div>}
            <button className="op-limpiar" onClick={limpiar}><RotateCcw size={13} /> Borrar</button>
          </div>
        </div>

        <label className="op-campo"><span>Observación (opcional)</span>
          <textarea rows={2} placeholder="Ej: recepción completa, una bombona observada"
            value={obs} onChange={(e) => setObs(e.target.value)} /></label>

        <div className="op-alerta az"><Gauge size={14} /> Al confirmar, el cuadre automático genera BOP, descuenta solo lo efectivamente entregado y emite la factura correspondiente. Cualquier saldo permanece pagado y pendiente.</div>
      </div>
      <div className="op-pie">
        <button className="op-btn pri gr full" disabled={!hayFirma || !(Number(cantidadEntregada)>0) || Number(cantidadEntregada)>Number(s.cantidad)} onClick={confirmar}>
          <Check size={18} /> Confirmar entrega
        </button>
      </div>
    </>
  );
}

/* ═══════════  LISTO  ═══════════ */

function Listo({ s, r, onClose }) {
  const c = cpt(s.concepto);
  return (
    <div className="op-listo">
      <div className="op-listo-i"><Check size={34} strokeWidth={3} /></div>
      <h2>Entrega registrada</h2>
      <p>{c.corto} × {r.cantidadEntregada ?? s.cantidad} · {comunaOf(usr(s.usuario).comuna).nombre} · para {usr(s.usuario).nombre}</p>
      <div className="op-docs">
        <div><span>Boleta de operación</span><b>{r.bopId}</b></div>
        {r.kg > 0 && <div><span>Salida de inventario</span><b>−{num(r.kg)} kg</b></div>}
        <div><span>Factura</span><b>{r.serie || "No aplica"}</b></div>
      </div>
      {r.parcial
        ? <div className="op-alerta mo"><Clock size={14}/> Entrega parcial: quedan {num(r.pendienteCantidad)} pagados en {r.remanenteId}, pendientes de otro despacho. No se descontaron del inventario físico.</div>
        : <div className="op-alerta vd"><Check size={14} /> La comuna ya ve la recepción y el usuario mantiene su solicitud individual.</div>}
      <button className="op-btn pri gr full" onClick={onClose}>Continuar la ruta</button>
    </div>
  );
}

/* ═══════════  ENTREGADAS  ═══════════ */

function Hechas({ entregadas, setPantalla }) {
  return (
    <>
      <div className="op-lbl"><ListChecks size={12} /> Entregas de hoy · {entregadas.length}</div>
      {entregadas.map((s) => {
        const c = cpt(s.concepto);
        return (
          <button className="op-card hecha" key={s.id} onClick={() => setPantalla({ t: "comprobante", s })}>
            <div className="op-card-h">
              <div className="op-card-id">{s.ad}</div>
              <span className="op-chip vd"><Check size={11} /> Entregada</span>
            </div>
            <div className="op-card-u">{comunaOf(usr(s.usuario).comuna).nombre}</div>
            <div className="op-card-d"><User size={13} /> {usr(s.usuario).nombre}</div>
            <div className="op-card-f">
              <div className="op-prod"><Package size={14} /> {c.corto} × {s.cantidad}</div>
              <div className="op-mini">{s.boleta}</div>
            </div>
          </button>
        );
      })}
      {!entregadas.length && <div className="op-vacio"><Truck size={30} /><p>Todavía no has cerrado<br />ninguna entrega hoy.</p></div>}
    </>
  );
}

function Comprobante({ s, onClose }) {
  const c = cpt(s.concepto), u = usr(s.usuario), com = comunaOf(u.comuna);
  return (
    <>
      <div className="op-nav">
        <button onClick={onClose}><ChevronLeft size={22} /></button>
        <h2>Comprobante</h2>
        <span />
      </div>
      <div className="op-body">
        <section className="op-bloque">
          <div className="op-b-t">Entrega</div>
          <div className="op-kv">
            <div><span>Comuna</span><b>{com.nombre}</b></div>
            <div><span>Usuario asignado</span><b>{u.nombre}</b></div>
            <div><span>Recibió</span><b>{s.receptor || com.coordinador}</b></div>
            <div><span>Producto</span><b>{c.corto} × {s.cantidad}</b></div>
            {c.kg > 0 && <div><span>GLP</span><b>{num(c.kg * s.cantidad)} kg</b></div>}
            <div><span>Hora</span><b>{s.horaEntrega || "—"}</b></div>
            <div><span>Transportista</span><b>{s.transportistaTipo === "EPSDC" ? "EPSDC" : "GasLara"}</b></div>
            {s.unidad && <div><span>Unidad</span><b>{s.unidad}</b></div>}
          </div>
          {s.obsEntrega && <div className="op-nota"><FileText size={13} /> {s.obsEntrega}</div>}
        </section>
        {s.firma && (
          <section className="op-bloque">
            <div className="op-b-t">Firma del receptor</div>
            <img src={s.firma} alt="Firma" className="op-firma-img" />
          </section>
        )}
        <section className="op-bloque">
          <div className="op-b-t">Documentos generados</div>
          <div className="op-kv chico">
            <div><span>Boleta</span><b>{s.boleta}</b></div>
            <div><span>Factura</span><b>{s.serie || "No aplica"}</b></div>
            <div><span>AD</span><b>{s.ad}</b></div>
          </div>
        </section>
      </div>
    </>
  );
}

/* ═══════════  INCIDENCIA  ═══════════ */

const MOTIVOS = [
  "Responsable de la comuna no se encontraba",
  "Punto de la comuna no ubicado",
  "Comuna no pudo recibir la entrega",
  "Zona sin acceso o insegura",
  "Falla mecánica de la unidad",
  "Otro motivo",
];

function Incidencia({ s, onClose, onGuardar }) {
  const [m, setM] = useState("");
  return (
    <>
      <div className="op-nav">
        <button onClick={onClose}><ChevronLeft size={22} /></button>
        <h2>No pude entregar</h2>
        <span />
      </div>
      <div className="op-body">
        <div className="op-alerta mo"><AlertTriangle size={14} /> La entrega queda abierta y el centro la reprograma. El pago del usuario no se pierde.</div>
        <div className="op-lbl">Motivo</div>
        <div className="op-motivos">
          {MOTIVOS.map((x) => (
            <button key={x} className={m === x ? "on" : ""} onClick={() => setM(x)}>{x}{m === x && <Check size={15} />}</button>
          ))}
        </div>
      </div>
      <div className="op-pie">
        <button className="op-btn pri gr full" disabled={!m} onClick={() => onGuardar(m)}>Registrar incidencia</button>
      </div>
    </>
  );
}

/* ═══════════  RESUMEN  ═══════════ */

function Resumen({ entregadas, porDespachar, kgDia, kgPend, operador, onSalir }) {
  const restante = Math.max(0, operador.carga - kgDia);
  const pct = (restante / operador.carga) * 100;
  const total = entregadas.length + porDespachar.length;
  const avance = total ? (entregadas.length / total) * 100 : 0;

  return (
    <>
      <div className="op-jornada">
        <div className="op-eyebrow">Jornada de hoy</div>
        <div className="op-fecha">{fechaLarga(HOY)}</div>
        <div className="op-avance"><div style={{ width: `${avance}%` }} /></div>
        <div className="op-avance-t">{entregadas.length} de {total} entregas completadas</div>
      </div>

      <div className="op-metricas">
        <div><span>Entregadas</span><b>{entregadas.length}</b></div>
        <div><span>Pendientes</span><b>{porDespachar.length}</b></div>
        <div><span>GLP despachado</span><b>{num(kgDia)} kg</b></div>
        <div><span>Por despachar</span><b>{num(kgPend)} kg</b></div>
      </div>

      <section className="op-bloque">
        <div className="op-b-t">Carga de la unidad</div>
        <div className="op-tanque">
          <div className="op-tanque-b"><div className={`op-tanque-f ${pct < 25 ? "bajo" : ""}`} style={{ width: `${pct}%` }} /></div>
          <div className="op-tanque-t"><b>{num(restante)} kg</b><span>de {num(operador.carga)} kg cargados</span></div>
        </div>
        {pct < 25 && <div className="op-alerta mo"><Fuel size={14} /> Carga baja. Pasa por el centro antes de la próxima entrega.</div>}
      </section>

      <section className="op-bloque">
        <div className="op-b-t">Operador</div>
        <div className="op-kv chico">
          <div><span>Nombre</span><b>{operador.nombre}</b></div>
          <div><span>Cédula</span><b>{operador.ci}</b></div>
          <div><span>Tipo</span><b>{operador.etiqueta}</b></div>
          <div><span>Unidad</span><b>{operador.unidad}</b></div>
          <div><span>Centro</span><b>{cdtOf(operador.cdt).nombre}</b></div>
        </div>
      </section>

      <button className="op-salir" onClick={onSalir}><LogOut size={16} /> Cerrar jornada</button>
      <div className="op-pie-logo">
        <img src={LOGO_LARA} alt="Gobierno de Lara" />
        <span>{EMPRESA.nombre} · Rif: {EMPRESA.rif}<br />{EMPRESA.sistema} · Operaciones 1.0</span>
      </div>
    </>
  );
}

/* ═══════════  ESTILOS  ═══════════ */

function EstilosOp() {
  return (
    <style>{`
.op{--ink:#101A17;--ink2:#3C4C48;--ink3:#788884;--bg:#EEF0EE;--panel:#FFF;--line:#DCDFDC;--line2:#EDEFEC;
--vd:#1E7A4C;--vdw:#E6F3EC;--am:#C9700E;--amw:#FCF0E0;--az:#1B5E8A;--azw:#E8F1F8;
--rj:#B3261E;--rjw:#FBEAE8;--mo:#5B4A80;--mow:#EDE9F4;
--sans:"Inter","SF Pro Text","Segoe UI",system-ui,-apple-system,sans-serif;
--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
font-family:var(--sans);color:var(--ink);-webkit-font-smoothing:antialiased}
.op *{box-sizing:border-box}
.op button{font-family:inherit;cursor:pointer}
.op input,.op select,.op textarea{font-family:inherit;font-size:16px}
.op a{text-decoration:none;color:inherit}

.op-checks{display:flex;flex-direction:column;gap:7px;margin:8px 0 10px}.op-checks>div{display:flex;gap:7px;align-items:center;font-size:11px;padding:7px 8px;border-radius:8px}.op-checks .ok{background:var(--vdw);color:var(--vd)}.op-checks .bad{background:var(--rjw);color:var(--rj)}.op-help{display:block;font-size:10px;line-height:1.35;color:var(--am);margin-top:5px}
.op-stage{min-height:calc(100vh - 46px);background:
 radial-gradient(1000px 560px at 85% 0%,#2B2118 0%,transparent 58%),
 linear-gradient(160deg,#161311,#241D17 55%,#141210);
display:flex;align-items:center;justify-content:center;gap:60px;padding:40px 24px}
.op-lado{max-width:320px;color:#C4B6A8}
.op-lado-logo{width:148px;filter:brightness(0) invert(1);opacity:.95;display:block}
.op-lado h2{margin:20px 0 10px;font-size:27px;font-weight:700;color:#fff;letter-spacing:-.7px}
.op-lado p{margin:0 0 20px;font-size:14.5px;line-height:1.6}
.op-lado ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}
.op-lado li{display:flex;gap:11px;align-items:center;font-size:14px}
.op-lado li span{width:24px;height:24px;border-radius:50%;background:var(--am);color:#fff;
display:grid;place-items:center;font-size:12px;font-weight:700;flex-shrink:0}
.op-lado-pie{display:flex;gap:12px;align-items:center;margin-top:30px;padding-top:20px;border-top:1px solid #3A2E24}
.op-lado-pie img{width:44px;background:#fff;border-radius:6px;padding:3px}
.op-lado-pie span{font-size:11.5px;color:#8A7B6D;line-height:1.5}

.op-phone{width:392px;height:812px;background:var(--bg);border-radius:44px;position:relative;
overflow:hidden;border:11px solid #0A0806;box-shadow:0 40px 80px -20px rgba(0,0,0,.7);
display:flex;flex-direction:column;flex-shrink:0}

.op-top{background:var(--ink);color:#fff;padding:16px 20px 14px;display:flex;
justify-content:space-between;align-items:center;flex-shrink:0}
.op-unidad{display:flex;align-items:center;gap:5px;font-size:10.5px;text-transform:uppercase;
letter-spacing:.1em;color:#93A79F;font-weight:700}
.op-top-l b{display:block;font-size:16px;font-weight:670;margin-top:4px;letter-spacing:-.3px}
.op-top-r{font-size:11.5px;background:#243430;padding:5px 11px;border-radius:20px;color:#B6C8C1;font-weight:600}
.op-screen{flex:1;overflow-y:auto;padding:14px 14px 0;scrollbar-width:none}
.op-screen::-webkit-scrollbar{display:none}
.op-fondo{height:88px}

.op-hero{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.op-hero div{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:13px 15px}
.op-hero span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;
color:var(--ink3);font-weight:700}
.op-hero b{display:block;font-family:var(--mono);font-size:24px;font-weight:680;margin-top:5px;letter-spacing:-1px}
.op-buscar{display:flex;align-items:center;gap:9px;background:var(--panel);border:1px solid var(--line);
border-radius:14px;padding:0 14px;height:46px;color:var(--ink3);margin-bottom:14px}
.op-buscar input{border:none;outline:none;background:none;flex:1;font-size:15px;min-width:0}
.op-lbl{display:flex;align-items:center;gap:6px;font-size:10px;text-transform:uppercase;
letter-spacing:.12em;color:var(--ink3);font-weight:700;margin:14px 2px 9px}

.op-card{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:18px;
padding:14px 15px;text-align:left;margin-bottom:10px;display:flex;flex-direction:column;gap:7px}
.op-card:active{transform:scale(.99)}
.op-card.mia{border-left:4px solid var(--vd)}
.op-card.hecha{opacity:.85}
.op-card-h{display:flex;justify-content:space-between;align-items:center;gap:10px}
.op-card-id{font-family:var(--mono);font-size:13.5px;font-weight:680}
.op-card-u{font-size:14.5px;font-weight:640;line-height:1.3}
.op-card-d{display:flex;gap:6px;align-items:flex-start;font-size:12px;color:var(--ink3);line-height:1.4}
.op-card-d svg{flex-shrink:0;margin-top:1px}
.op-card-f{display:flex;justify-content:space-between;align-items:center;gap:10px;
padding-top:9px;border-top:1px solid var(--line2)}
.op-prod{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink2);font-weight:560}
.op-prod em{font-style:normal;font-family:var(--mono);font-size:11px;background:var(--line2);
color:var(--ink3);padding:2px 6px;border-radius:5px;margin-left:2px}
.op-pag{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--vd);font-weight:670}
.op-mini{font-family:var(--mono);font-size:11px;color:var(--ink3)}

.op-chip{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;
padding:3px 9px;border-radius:20px;white-space:nowrap}
.op-chip.vd{background:var(--vdw);color:var(--vd)}
.op-chip.gr{background:var(--line2);color:var(--ink3)}
.op-chip.rj{background:var(--rjw);color:var(--rj)}
.op-chip.mo{background:var(--mow);color:var(--mo)}

.op-tabs{position:absolute;bottom:0;left:0;right:0;height:74px;background:rgba(255,255,255,.96);
backdrop-filter:blur(12px);border-top:1px solid var(--line);display:flex;padding:9px 6px 0;z-index:20}
.op-tabs button{flex:1;background:none;border:none;display:flex;flex-direction:column;align-items:center;
gap:3px;color:var(--ink3);font-size:10.5px;font-weight:600;position:relative;padding-top:2px}
.op-tabs button.on{color:var(--vd)}
.op-tabs button i{position:absolute;top:-2px;right:calc(50% - 22px);font-style:normal;font-size:10px;
background:var(--am);color:#fff;min-width:17px;height:17px;border-radius:9px;display:grid;
place-items:center;font-weight:700;padding:0 4px}

.op-full{position:absolute;inset:0;background:var(--bg);z-index:40;display:flex;flex-direction:column;
animation:opin .24s cubic-bezier(.2,.9,.25,1)}
@keyframes opin{from{transform:translateX(14%);opacity:.4}to{transform:none;opacity:1}}
.op-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:16px 12px 12px;
background:var(--panel);border-bottom:1px solid var(--line);flex-shrink:0}
.op-nav h2{margin:0;font-size:16.5px;font-weight:670;letter-spacing:-.3px}
.op-nav button{width:34px;height:34px;border:none;background:none;color:var(--ink2);
display:grid;place-items:center;border-radius:50%}
.op-nav span{width:34px}
.op-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:11px;scrollbar-width:none}
.op-body::-webkit-scrollbar{display:none}
.op-pie{padding:11px 14px calc(14px);background:var(--panel);border-top:1px solid var(--line);
display:flex;gap:9px;flex-shrink:0}

.op-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 16px;
border:1px solid var(--line);background:var(--panel);color:var(--ink2);border-radius:14px;
font-size:14.5px;font-weight:620;flex-shrink:0}
.op-btn:active{transform:scale(.98)}
.op-btn.pri{background:var(--vd);border-color:var(--vd);color:#fff}
.op-btn.pri:disabled{background:#B4C6BC;border-color:#B4C6BC}
.op-btn.gr{height:52px;font-size:15.5px;border-radius:16px}
.op-btn.full{flex:1}
.op-btn.chico{height:32px;padding:0 13px;font-size:12.5px;border-radius:9px;
background:var(--ink);border-color:var(--ink);color:#fff}

.op-bloque{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:15px}
.op-bloque.destacado{border-color:#CFE3D8;background:linear-gradient(180deg,#F6FBF8,#fff 70px)}
.op-b-t{font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--vd);
font-weight:700;margin-bottom:9px}
.op-lote{border:1px solid #d7e3de;background:#f7fbf9;border-radius:12px;padding:10px;margin:10px 0 14px}.op-lote-h{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:7px}.op-lote-h b,.op-lote-h span{display:block}.op-lote-h b{font-size:13px}.op-lote-h div>span{font-size:10px;color:#6a7c75;margin-top:2px}.op-lote-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:10px;color:#53665e;margin-bottom:8px}.op-lote-meta span{display:flex;align-items:center;gap:4px}.op-lote-note{font-size:9.5px;color:#71827b;border-top:1px dashed #d6e0dc;padding-top:7px;margin-bottom:7px}.op-lote .op-card{margin:7px 0 0;background:#fff}
.op-usuario{font-size:17px;font-weight:680;line-height:1.3}
.op-doc{font-size:11.5px;color:var(--ink3);font-family:var(--mono);margin-top:4px}
.op-dir{display:flex;gap:9px;align-items:flex-start;margin-top:11px;font-size:14px;color:var(--ink2);line-height:1.4}
.op-dir svg{flex-shrink:0;margin-top:2px;color:var(--ink3)}
.op-dir span{display:block;font-size:12px;color:var(--ink3);margin-top:2px}
.op-acciones{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}

.op-kv div{display:flex;justify-content:space-between;gap:14px;padding:9px 0;
border-top:1px solid var(--line2);font-size:13.5px;align-items:baseline}
.op-kv div:first-child{border-top:none;padding-top:0}
.op-kv span{color:var(--ink3);flex-shrink:0}
.op-kv b{text-align:right;font-weight:620}
.op-kv.chico div{font-size:12.5px;padding:7px 0}
.op-nota{display:flex;gap:8px;align-items:flex-start;background:var(--line2);border-radius:12px;
padding:10px 12px;font-size:12.5px;color:var(--ink2);line-height:1.45;margin-top:11px}
.op-nota svg{flex-shrink:0;margin-top:1px}
.op-alerta{display:flex;gap:8px;align-items:flex-start;border-radius:12px;padding:11px 13px;
font-size:12.5px;line-height:1.45;margin-top:11px}
.op-alerta svg{flex-shrink:0;margin-top:1px}
.op-alerta.vd{background:var(--vdw);color:var(--vd)}
.op-alerta.mo{background:var(--amw);color:var(--am)}
.op-alerta.az{background:var(--azw);color:var(--az)}
.op-monto{background:var(--vdw);border-radius:14px;padding:14px;text-align:center}
.op-monto span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;
color:var(--vd);font-weight:700}
.op-monto b{display:block;font-family:var(--mono);font-size:25px;font-weight:700;color:var(--vd);margin-top:4px}

.op-resumen{background:var(--ink);color:#fff;border-radius:18px;padding:16px;
display:flex;justify-content:space-between;align-items:center;gap:14px}
.op-resumen span{font-size:12px;color:#93A79F}
.op-resumen b{display:block;font-size:16px;font-weight:670;margin-top:3px;line-height:1.3}
.op-resumen .kg{font-family:var(--mono);font-size:17px;font-weight:680;background:#243430;
padding:8px 12px;border-radius:11px;white-space:nowrap}

.op-campo{display:flex;flex-direction:column;gap:7px}
.op-campo>span{font-size:9.5px;text-transform:uppercase;letter-spacing:.11em;color:var(--ink3);font-weight:700}
.op-campo input,.op-campo select,.op-campo textarea{border:1.5px solid var(--line);border-radius:14px;
padding:13px 14px;background:var(--panel);color:var(--ink);outline:none;width:100%;resize:none}
.op-campo input:focus,.op-campo textarea:focus{border-color:var(--vd)}
.op-firma{position:relative;background:var(--panel);border:1.5px dashed #C3C7C2;border-radius:16px;
height:180px;overflow:hidden}
.op-firma canvas{width:100%;height:100%;display:block;touch-action:none;cursor:crosshair}
.op-firma-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;
color:var(--ink3);font-size:13px;pointer-events:none}
.op-limpiar{position:absolute;top:9px;right:9px;display:flex;align-items:center;gap:5px;
background:var(--line2);border:none;color:var(--ink2);font-size:11.5px;font-weight:620;
padding:6px 10px;border-radius:9px}
.op-firma-img{width:100%;height:auto;background:#fff;border:1px solid var(--line2);border-radius:12px}

.op-listo{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
gap:12px;padding:26px 22px;text-align:center;background:var(--bg)}
.op-listo-i{width:72px;height:72px;border-radius:50%;background:var(--vdw);color:var(--vd);
display:grid;place-items:center}
.op-listo h2{margin:6px 0 0;font-size:23px;font-weight:700;letter-spacing:-.6px}
.op-listo p{margin:0;font-size:14px;color:var(--ink2)}
.op-docs{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:16px;
padding:4px 15px;margin-top:6px}
.op-docs div{display:flex;justify-content:space-between;gap:12px;padding:11px 0;
border-top:1px solid var(--line2);font-size:13px}
.op-docs div:first-child{border-top:none}
.op-docs span{color:var(--ink3)}
.op-docs b{font-family:var(--mono);font-weight:670}
.op-listo .op-btn{width:100%;margin-top:6px}

.op-motivos{display:flex;flex-direction:column;gap:8px}
.op-motivos button{display:flex;justify-content:space-between;align-items:center;
border:1.5px solid var(--line);background:var(--panel);border-radius:14px;padding:14px;
font-size:14px;color:var(--ink2);text-align:left}
.op-motivos button.on{border-color:var(--am);background:var(--amw);color:var(--am);font-weight:640}

.op-jornada{background:var(--ink);color:#fff;border-radius:20px;padding:18px;margin-bottom:12px}
.op-eyebrow{font-size:9.5px;text-transform:uppercase;letter-spacing:.13em;color:#8FB3A3;font-weight:700}
.op-fecha{font-size:17px;font-weight:670;margin:7px 0 14px;letter-spacing:-.3px}
.op-avance{height:8px;background:#243430;border-radius:5px;overflow:hidden}
.op-avance div{height:100%;background:linear-gradient(90deg,var(--vd),#4FB07A);border-radius:5px;transition:width .5s}
.op-avance-t{font-size:12px;color:#93A79F;margin-top:8px}
.op-metricas{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.op-metricas div{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:13px 15px}
.op-metricas span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;
color:var(--ink3);font-weight:700}
.op-metricas b{display:block;font-family:var(--mono);font-size:21px;font-weight:680;margin-top:5px;letter-spacing:-.8px}
.op-tanque{display:flex;flex-direction:column;gap:9px}
.op-tanque-b{height:12px;background:var(--line2);border-radius:7px;overflow:hidden}
.op-tanque-f{height:100%;background:linear-gradient(90deg,var(--vd),#4FB07A);border-radius:7px}
.op-tanque-f.bajo{background:linear-gradient(90deg,var(--am),#E8A33C)}
.op-tanque-t{display:flex;align-items:baseline;gap:8px}
.op-tanque-t b{font-family:var(--mono);font-size:19px;font-weight:680}
.op-tanque-t span{font-size:12px;color:var(--ink3)}
.op-salir{width:100%;background:none;border:none;color:var(--rj);font-size:14.5px;font-weight:620;
padding:16px;display:flex;align-items:center;justify-content:center;gap:8px}
.op-pie-logo{display:flex;gap:11px;align-items:center;justify-content:center;padding:4px 0 8px}
.op-pie-logo img{width:34px;opacity:.85}
.op-pie-logo span{font-size:10px;color:var(--ink3);line-height:1.5}

.op-vacio{text-align:center;padding:60px 20px;color:var(--ink3)}
.op-vacio p{margin:12px 0 0;font-size:14px;line-height:1.5}

.op-login{flex:1;display:flex;flex-direction:column;padding:36px 26px 26px;background:var(--ink)}
.op-login>img{width:150px;filter:brightness(0) invert(1);display:block;margin:0 auto}
.op-login-t{text-align:center;font-size:10.5px;text-transform:uppercase;letter-spacing:.2em;
color:var(--am);font-weight:700;margin-top:10px}
.op-login-b{background:var(--panel);border-radius:22px;padding:20px;margin-top:32px;
display:flex;flex-direction:column;gap:13px}
.op-login-b .op-btn{margin-top:4px}
.op-login-p{margin-top:auto;padding-top:22px;display:flex;gap:11px;align-items:center;justify-content:center}
.op-login-p img{width:36px;background:#fff;border-radius:5px;padding:2px}
.op-login-p span{font-size:10.5px;color:#7C8D87;line-height:1.5}

.op-toast{position:absolute;bottom:92px;left:50%;transform:translateX(-50%);background:var(--ink);
color:#fff;display:flex;align-items:center;gap:8px;padding:11px 16px;border-radius:13px;
font-size:12.5px;z-index:50;box-shadow:0 10px 26px rgba(0,0,0,.4);white-space:nowrap;animation:opu .22s}
@keyframes opu{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}

@media(max-width:1080px){.op-lado{display:none}.op-stage{padding:24px}}
@media(max-width:520px){
 .op-stage{padding:0;background:var(--bg);align-items:stretch}
 .op-phone{width:100%;height:calc(100vh - 46px);border-radius:0;border:none;box-shadow:none}
 .op-tabs{padding-bottom:env(safe-area-inset-bottom)}
}
@media(prefers-reduced-motion:reduce){.op *{animation:none!important;transition:none!important}}
`}</style>
  );
}
