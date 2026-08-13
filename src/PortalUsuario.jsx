import React, { useState, useMemo } from "react";
import {
  Home, Package, Receipt, MessageSquareWarning, User, LogOut, Plus, X,
  ChevronRight, ChevronLeft, Check, MapPin, Phone, Clock, Truck,
  CheckCircle2, HelpCircle, Copy, Info, AlertCircle, Search, ShieldCheck,
  Bell, Landmark, Smartphone, History, CircleDashed, Zap, Users,
} from "lucide-react";
import {
  LOGO_GASLARA, LOGO_LARA, EMPRESA, BANCOS, banco, CLIENTE_PORTAL, HOY,
  PRODUCTOS, SERVICIOS, cpt, cdtOf, comunaOf, montos, FASES, faseIdx, fase,
  bs, num, fecha, fechaLarga, mesCorto,
} from "./datos.jsx";
import { VisorDocumento } from "./Documentos.jsx";

const C = CLIENTE_PORTAL;
const COM = comunaOf(C.comuna);

export default function PortalUsuario({ solicitudes, reclamos, facturas, ciclo, crearSolicitud, crearReclamo }) {
  const [vista, setVista] = useState("inicio");
  const [modal, setModal] = useState(null);
  const [doc, setDoc] = useState(null);
  const [toast, setToast] = useState(null);
  const aviso = (m) => { setToast(m); setTimeout(() => setToast(null), 3400); };

  const mis = useMemo(() => solicitudes.filter((s) => s.usuario === C.id), [solicitudes]);
  const misRec = useMemo(() => reclamos.filter((r) => r.usuario === C.id), [reclamos]);
  const misFac = useMemo(() => facturas.filter((f) => f.usuario === C.id && f.origen === "AUTOMATICA"), [facturas]);
  const activos = mis.filter((s) => s.estado !== "CULMINADO");
  const enCurso = mis.find((s) => s.estado === "EN_AD") || mis.find((s) => s.estado === "PAGADA");

  const nav = [
    { id: "inicio", label: "Inicio", icon: Home },
    { id: "pedidos", label: "Mis pedidos", icon: Package, badge: activos.length },
    { id: "facturas", label: "Facturas", icon: Receipt },
    { id: "reclamos", label: "Reclamos", icon: MessageSquareWarning, badge: misRec.filter((r) => r.estado !== "RESUELTO").length },
    { id: "perfil", label: "Mi contrato", icon: User },
  ];

  const onNueva = (d) => { const n = crearSolicitud(d); setModal({ tipo: "listo", s: n }); };
  const onReclamo = (d) => { const id = crearReclamo(d); setModal(null); setVista("reclamos"); aviso(`Reclamo ${id} registrado. Respondemos en máximo 72 horas.`); };

  return (
    <div className={`pt ${doc ? "printing" : ""}`}>
      <Estilos />

      <aside className="side">
        <div className="side-brand">
          <img src={LOGO_GASLARA} alt="GasLara" className="logo-img" />
          <div className="logo-rif">Rif: {EMPRESA.rif}</div>
        </div>
        <div className="side-user">
          <div className="avatar">{C.nombre.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
          <div className="su-txt">
            <div className="su-nom">{C.nombre}</div>
            <div className="su-sub">{C.id} · Cliente: {C.tipo}</div>
          </div>
        </div>
        <nav>
          {nav.map((n) => (
            <button key={n.id} className={`nav-b ${vista === n.id ? "on" : ""}`} onClick={() => setVista(n.id)}>
              <n.icon size={18} /><span>{n.label}</span>{n.badge > 0 && <em className="nav-badge">{n.badge}</em>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="nav-b ghost" onClick={() => setModal("ayuda")}><HelpCircle size={18} /><span>Cómo pagar y pedir</span></button>
          <button className="nav-b ghost"><LogOut size={18} /><span>Cerrar sesión</span></button>
          <img src={LOGO_LARA} alt="Gobierno de Lara" className="logo-lara" />
        </div>
      </aside>

      <main className="main">
        <header className="top">
          <div>
            <div className="top-loc"><MapPin size={13} /> Barquisimeto · {fechaLarga(HOY)}</div>
            <h1>{vista === "inicio" ? `Hola, ${C.nombre.split(" ")[0]}` : nav.find((n) => n.id === vista).label}</h1>
          </div>
          <div className="top-r">
            <button className="icon-round" onClick={() => setModal("ayuda")}><Bell size={17} /></button>
            <button className="btn primary" onClick={() => setModal("solicitud")}><Plus size={16} strokeWidth={2.6} /> Pedir gas</button>
          </div>
        </header>

        <div className="body">
          {vista === "inicio" && <Inicio {...{ mis, enCurso, ciclo, setModal, setVista, misFac }} />}
          {vista === "pedidos" && <Pedidos mis={mis} setModal={setModal} />}
          {vista === "facturas" && <Facturas mis={mis} misFac={misFac} setDoc={setDoc} setModal={setModal} />}
          {vista === "reclamos" && <Reclamos misRec={misRec} setModal={setModal} />}
          {vista === "perfil" && <Perfil mis={mis} ciclo={ciclo} />}
        </div>

        <footer className="pie">
          <img src={LOGO_LARA} alt="Gobierno de Lara" className="pie-lara" />
          <div>
            República Bolivariana de Venezuela · {EMPRESA.sistema}<br />
            {EMPRESA.nombre} · Rif: {EMPRESA.rif} · Barquisimeto, estado Lara<br />
            <em>Datos de demostración</em>
          </div>
        </footer>
      </main>

      <nav className="tabbar">
        {nav.map((n) => (
          <button key={n.id} className={vista === n.id ? "on" : ""} onClick={() => setVista(n.id)}>
            <n.icon size={20} /><span>{n.label.replace("Mis ", "").replace("Mi ", "")}</span>{n.badge > 0 && <i />}
          </button>
        ))}
      </nav>
      <button className="fab" onClick={() => setModal("solicitud")}><Plus size={24} strokeWidth={2.6} /></button>

      {modal === "solicitud" && <Wizard onClose={() => setModal(null)} onSave={onNueva} aviso={aviso} />}
      {modal === "reclamo" && <ModalReclamo mis={mis} onClose={() => setModal(null)} onSave={onReclamo} />}
      {modal === "ayuda" && <ModalAyuda onClose={() => setModal(null)} aviso={aviso} />}
      {modal?.tipo === "detalle" && <DetallePedido s={modal.s} onClose={() => setModal(null)} setDoc={setDoc} facturas={facturas} />}
      {modal?.tipo === "reclamo-det" && <DetalleReclamo r={modal.r} onClose={() => setModal(null)} />}
      {modal?.tipo === "listo" && <ModalListo s={modal.s} onClose={() => { setModal(null); setVista("pedidos"); }} />}
      {doc && <VisorDocumento doc={doc} onClose={() => setDoc(null)} />}
      {toast && <div className="toast"><CheckCircle2 size={17} /> {toast}</div>}
    </div>
  );
}

/* ═══════════  INICIO  ═══════════ */

function Inicio({ mis, enCurso, ciclo, setModal, setVista, misFac }) {
  const cerca = ciclo && ciclo.restantes <= 6;
  const pasado = ciclo && ciclo.restantes < 0;

  return (
    <>
      {ciclo && (
        <section className="hero">
          <div className="hero-l">
            <div className="hero-eyebrow"><History size={13} /> Tu ritmo de consumo</div>
            <div className="hero-num">{ciclo.transcurridos}<em>días desde tu última bombona</em></div>
            <p className="hero-desc">
              Pides una <b>{cpt(ciclo.ultima.concepto).corto}</b> cada <b>{ciclo.promedio} días</b> en promedio.
              {pasado ? " Ya pasaste ese promedio, así que puede que te toque pronto."
                      : ` A ese ritmo te tocaría cerca del ${fecha(ciclo.proxima)}.`}
            </p>
            <div className="ciclo">
              <div className="ciclo-meter">
                <div className={`ciclo-fill ${cerca ? "cerca" : ""}`} style={{ width: `${ciclo.pct}%` }} />
              </div>
              <div className="ciclo-ejes">
                <span>{fecha(ciclo.ultima.entrega)}<em>última entrega</em></span>
                <span className="r">{fecha(ciclo.proxima)}<em>promedio histórico</em></span>
              </div>
            </div>
            <div className="hero-nota">
              <Info size={14} />
              <p>Es un cálculo a partir de tus {ciclo.pedidos} pedidos anteriores. <b>No medimos el contenido de tu bombona</b> — tú sabes mejor que nosotros cuánto gas te queda.</p>
            </div>
            <button className="btn primary lg" onClick={() => setModal("solicitud")}>
              <Plus size={17} strokeWidth={2.6} /> Pedir y pagar bombona
            </button>
          </div>
          <div className="hero-r">
            <Bombona pct={100 - ciclo.pct} cerca={cerca} />
            <div className="bomb-cap"><CircleDashed size={11} /> Referencia estimada</div>
          </div>
        </section>
      )}

      {enCurso && (
        <section className="card destacada">
          <div className="card-h">
            <h2><span className="pulse" /> Pedido en curso · {enCurso.id}</h2>
            <button className="link" onClick={() => setModal({ tipo: "detalle", s: enCurso })}>Ver detalle <ChevronRight size={14} /></button>
          </div>
          <Tracker estado={enCurso.estado} />
          <div className="curso-info">
            <div><span>Producto</span><b>{cpt(enCurso.concepto).corto} × {enCurso.cantidad}</b></div>
            <div><span>Próxima jornada comunal</span><b>{fecha(enCurso.entrega)} · entrega consolidada en {COM.nombre}</b></div>
            <div><span>Unidad asignada</span><b>{enCurso.operador || "Por asignar"}</b></div>
            <div><span>Pagado</span><b>Bs {bs(enCurso.total)}</b></div>
          </div>
        </section>
      )}

      <div className="acc-grid">
        <Acceso icon={Truck} titulo="Pedir gas" desc="Pagas primero, despachamos después" onClick={() => setModal("solicitud")} tono="verde" />
        <Acceso icon={Receipt} titulo="Mis facturas" desc={`${misFac.length} documentos disponibles`} onClick={() => setVista("facturas")} tono="azul" />
        <Acceso icon={MessageSquareWarning} titulo="Reportar un problema" desc="Fuga, demora o cilindro dañado" onClick={() => setModal("reclamo")} tono="naranja" />
        <Acceso icon={Landmark} titulo="Cuentas para pagar" desc="4 bancos disponibles" onClick={() => setModal("ayuda")} tono="gris" />
      </div>

      <section className="card">
        <div className="card-h">
          <h2>Movimientos recientes</h2>
          <button className="link" onClick={() => setVista("pedidos")}>Ver todos <ChevronRight size={14} /></button>
        </div>
        <div className="lista">
          {mis.slice(0, 4).map((s) => (
            <button className="lista-row" key={s.id} onClick={() => setModal({ tipo: "detalle", s })}>
              <div className={`lr-ico ${s.estado === "CULMINADO" ? "ok" : s.estado === "PAGADA" ? "warn" : "act"}`}><Package size={16} /></div>
              <div className="lr-txt"><b>{cpt(s.concepto).corto}{s.cantidad > 1 ? ` × ${s.cantidad}` : ""}</b><span>{s.id} · {mesCorto(s.fecha)}</span></div>
              <div className="lr-r"><b>Bs {bs(s.total)}</b><EstadoChip estado={s.estado} /></div>
              <ChevronRight size={16} className="lr-arrow" />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function Bombona({ pct, cerca }) {
  const h = 150 * (Math.max(3, pct) / 100);
  return (
    <svg viewBox="0 0 150 250" className="bombona" role="img" aria-label="Referencia estimada del ciclo">
      <defs>
        <linearGradient id="gasg" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={cerca ? "#E0611F" : "#1E7A4C"} />
          <stop offset="100%" stopColor={cerca ? "#F5A623" : "#4FB07A"} />
        </linearGradient>
      </defs>
      <rect x="63" y="8" width="24" height="20" rx="4" fill="#8A9AA6" />
      <rect x="55" y="26" width="40" height="10" rx="4" fill="#6E7E8B" />
      <path d="M46 40 Q46 22 75 22 Q104 22 104 40" fill="none" stroke="#6E7E8B" strokeWidth="7" strokeLinecap="round" />
      <rect x="24" y="40" width="102" height="196" rx="26" fill="#EDEFF1" stroke="#D6DBE0" strokeWidth="2" />
      <clipPath id="cl"><rect x="26" y="42" width="98" height="192" rx="25" /></clipPath>
      <g clipPath="url(#cl)">
        <rect x="26" y={234 - h} width="98" height={h} fill="url(#gasg)" opacity=".92" />
        <line x1="26" y1={234 - h} x2="124" y2={234 - h} stroke="#fff" strokeWidth="2.5" strokeDasharray="6 5" opacity=".9" />
      </g>
      <rect x="24" y="40" width="102" height="196" rx="26" fill="none" stroke="#C9D0D7" strokeWidth="2" />
      <rect x="38" y="120" width="26" height="58" rx="6" fill="#fff" opacity=".2" />
      <rect x="34" y="230" width="82" height="14" rx="6" fill="#6E7E8B" />
    </svg>
  );
}

const Acceso = ({ icon: Ico, titulo, desc, onClick, tono }) => (
  <button className={`acceso ${tono}`} onClick={onClick}>
    <div className="acc-ico"><Ico size={20} /></div>
    <div className="acc-txt"><b>{titulo}</b><span>{desc}</span></div>
    <ChevronRight size={17} className="acc-arrow" />
  </button>
);

const ICONOS_FASE = [ShieldCheck, Truck, CheckCircle2];

function Tracker({ estado, compacto }) {
  const idx = faseIdx(estado);
  return (
    <div className={`track ${compacto ? "mini" : ""}`}>
      {FASES.map((f, i) => {
        const Ico = ICONOS_FASE[i], on = i <= idx, act = i === idx;
        return (
          <div className={`tr-step ${on ? "on" : ""} ${act ? "act" : ""}`} key={f.key}>
            <div className="tr-top">
              <div className="tr-dot">{on ? <Ico size={13} strokeWidth={2.6} /> : <span className="tr-n">{i + 1}</span>}</div>
              {i < FASES.length - 1 && <div className="tr-line" />}
            </div>
            <div className="tr-txt"><b>{f.cliente}</b>{!compacto && <span>{f.clienteDesc}</span>}</div>
          </div>
        );
      })}
    </div>
  );
}

const EstadoChip = ({ estado }) => {
  const map = { PAGADA: ["Pago verificado", "c-warn"], EN_AD: ["En despacho", "c-act"], CULMINADO: ["Completado", "c-ok"] };
  const [l, c] = map[estado] || ["—", ""];
  return <span className={`chip ${c}`}>{l}</span>;
};

/* ═══════════  PEDIDOS  ═══════════ */

function Pedidos({ mis, setModal }) {
  const [f, setF] = useState("TODOS");
  const [q, setQ] = useState("");
  const lista = mis.filter((s) => {
    const okF = f === "TODOS" || (f === "ACTIVOS" ? s.estado !== "CULMINADO" : s.estado === "CULMINADO");
    const okQ = !q || s.id.toLowerCase().includes(q.toLowerCase()) || cpt(s.concepto).nombre.toLowerCase().includes(q.toLowerCase());
    return okF && okQ;
  });
  return (
    <>
      <div className="filtros">
        <div className="tabs">
          {[["TODOS", "Todos"], ["ACTIVOS", "En curso"], ["CERRADOS", "Completados"]].map(([k, l]) => (
            <button key={k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}</button>
          ))}
        </div>
        <div className="search"><Search size={15} /><input placeholder="Buscar pedido" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="pedidos-grid">
        {lista.map((s) => (
          <button className={`ped ${s.estado !== "CULMINADO" ? "activo" : ""}`} key={s.id} onClick={() => setModal({ tipo: "detalle", s })}>
            <div className="ped-h">
              <div><div className="ped-id">{s.id}</div><div className="ped-fecha">{fechaLarga(s.fecha)}</div></div>
              <EstadoChip estado={s.estado} />
            </div>
            <div className="ped-prod">
              <div className="ped-ico"><Package size={18} /></div>
              <div><b>{cpt(s.concepto).corto}</b><span>{cpt(s.concepto).sub}{s.cantidad > 1 ? ` · ${s.cantidad}` : ""}</span></div>
            </div>
            {s.estado !== "CULMINADO" && <Tracker estado={s.estado} compacto />}
            <div className="ped-f">
              <div className="ped-docs">
                <span>Ref. {s.pago.referencia}</span>
                {s.ad && <span>{s.ad}</span>}
                {s.serie && <span>{s.serie}</span>}
              </div>
              <div className="ped-tot">Bs {bs(s.total)}</div>
            </div>
          </button>
        ))}
      </div>
      {!lista.length && <div className="vacio"><Package size={30} /><p>No hay pedidos con estos filtros.</p></div>}
    </>
  );
}

function DetallePedido({ s, onClose, setDoc, facturas }) {
  const c = cpt(s.concepto), bk = s.pago.banco ? banco(s.pago.banco) : null;
  const fac = facturas.find((f) => f.sol === s.id);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="hoja-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hm-h">
          <div><div className="hm-eyebrow">Pedido</div><h3>{s.id}</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={19} /></button>
        </div>
        <div className="hm-b">
          <Tracker estado={s.estado} />
          <div className="det-grid">
            <div><span>Producto</span><b>{c.nombre}</b></div>
            <div><span>Cantidad</span><b>{num(s.cantidad)} {c.unidad}</b></div>
            <div><span>Solicitado</span><b>{fecha(s.fecha)}</b></div>
            <div><span>{faseIdx(s.estado) >= 2 ? "Entregado a la comuna" : "Jornada comunal"}</span><b>{fecha(s.entrega)}</b></div>
            <div className="w2"><span>Punto de entrega de GasLara</span><b>{COM.punto} · {COM.nombre}</b></div>
            <div><span>Unidad</span><b>{s.operador || "Por asignar"}</b></div>
            <div><span>Centro</span><b>{cdtOf(s.cdt).nombre}</b></div>
            {s.nota && <div className="w2"><span>Nota</span><b>{s.nota}</b></div>}
          </div>

          {bk && (
            <div className="det-docs">
              <div className="det-lbl">Tu pago</div>
              <div className="dd-row"><span>Banco</span><b>{bk.nombre}</b></div>
              <div className="dd-row"><span>Referencia</span><b>{s.pago.referencia}</b></div>
              <div className="dd-row"><span>Fecha</span><b>{fecha(s.pago.fecha)}</b></div>
              <div className="dd-row"><span>Estatus</span><span className="chip c-ok"><Zap size={10} /> Verificado automáticamente</span></div>
            </div>
          )}

          <div className="det-docs">
            <div className="det-lbl">Documentos del sistema</div>
            <div className="dd-row"><span>Pedido Nro</span><b>P{s.pedidoNro}</b></div>
            <div className="dd-row"><span>Atención de distribución</span><b>{s.ad || "—"}</b></div>
            <div className="dd-row"><span>Boleta de operación</span><b>{s.boleta || "—"}</b></div>
            <div className="dd-row"><span>Factura</span>
              {fac ? <button className="link" onClick={() => { onClose(); setDoc({ tipo: "factura", data: fac }); }}>{s.serie} <ChevronRight size={13} /></button> : <b>—</b>}
            </div>
          </div>

          <div className="det-tot">
            <div><span>Subtotal</span><b>Bs {bs(s.base)}</b></div>
            <div><span>IVA</span><b>{s.exento ? "Exonerado" : `Bs ${bs(s.iva)}`}</b></div>
            <div className="big"><span>Total pagado</span><b>Bs {bs(s.total)}</b></div>
          </div>
        </div>
        <div className="hm-f">
          <button className="btn" onClick={onClose}>Cerrar</button>
          {fac && <button className="btn primary" onClick={() => { onClose(); setDoc({ tipo: "factura", data: fac }); }}>Ver factura</button>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════  FACTURAS  ═══════════ */

function Facturas({ mis, misFac, setDoc, setModal }) {
  const sinFactura = mis.filter((s) => !s.serie && s.estado !== "CULMINADO");
  return (
    <>
      {sinFactura.length > 0 && (
        <section className="card">
          <div className="card-h"><h2>Pagos verificados sin factura aún</h2><span className="card-note">La factura se emite al cerrar el despacho</span></div>
          <div className="lista">
            {sinFactura.map((s) => (
              <div className="lista-row estatico" key={s.id}>
                <div className="lr-ico warn"><Clock size={16} /></div>
                <div className="lr-txt"><b>{s.id} · Ref. {s.pago.referencia}</b><span>{banco(s.pago.banco).nombre} · {fecha(s.pago.fecha)}</span></div>
                <div className="lr-r"><b>Bs {bs(s.total)}</b><EstadoChip estado={s.estado} /></div>
                <div className="lr-btns"><button className="btn sm" onClick={() => setModal({ tipo: "detalle", s })}>Ver</button></div>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="card">
        <div className="card-h"><h2>Historial de facturas</h2><span className="card-note">{misFac.length} documentos</span></div>
        <div className="lista">
          {misFac.map((f) => (
            <div className="lista-row estatico" key={f.id}>
              <div className="lr-ico ok"><Receipt size={16} /></div>
              <div className="lr-txt"><b>{f.serie}</b><span>{fecha(f.fecha)} · {cpt(f.concepto).corto} · control {f.control}</span></div>
              <div className="lr-r"><b>Bs {bs(f.total)}</b><span className="chip c-ok">Pagada</span></div>
              <div className="lr-btns"><button className="btn sm" onClick={() => setDoc({ tipo: "factura", data: f })}><Receipt size={13} /> Ver</button></div>
            </div>
          ))}
        </div>
        {!misFac.length && <div className="vacio"><Receipt size={28} /><p>Todavía no tienes facturas emitidas.</p></div>}
      </section>
    </>
  );
}

/* ═══════════  RECLAMOS  ═══════════ */

const EST_REC = { RECIBIDO: ["Recibido", "c-act"], EN_PROCESO: ["En proceso", "c-warn"], RESUELTO: ["Resuelto", "c-ok"] };

function Reclamos({ misRec, setModal }) {
  return (
    <>
      <section className="alerta claro">
        <div className="alerta-ico azul"><MessageSquareWarning size={20} /></div>
        <div className="alerta-txt">
          <b>¿Algo salió mal con tu servicio?</b>
          <span>Fugas, demoras, cilindros dañados o pagos no acreditados. Respondemos en máximo 72 horas.</span>
        </div>
        <button className="btn primary" onClick={() => setModal("reclamo")}><Plus size={16} /> Nuevo reclamo</button>
      </section>
      <div className="rec-grid">
        {misRec.map((r) => (
          <button className="rec" key={r.id} onClick={() => setModal({ tipo: "reclamo-det", r })}>
            <div className="rec-h"><span className="rec-id">{r.id}</span><span className={`chip ${EST_REC[r.estado][1]}`}>{EST_REC[r.estado][0]}</span></div>
            <b className="rec-asunto">{r.asunto}</b>
            <span className="rec-tipo">{r.tipo} · {fecha(r.fecha)}</span>
            {r.respuesta && <div className="rec-resp"><Check size={13} /> Con respuesta de la empresa</div>}
          </button>
        ))}
      </div>
      {!misRec.length && <div className="vacio"><MessageSquareWarning size={30} /><p>No tienes reclamos registrados.</p></div>}
    </>
  );
}

function DetalleReclamo({ r, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="hoja-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hm-h"><div><div className="hm-eyebrow">Reclamo</div><h3>{r.id}</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={19} /></button></div>
        <div className="hm-b">
          <div className="det-grid">
            <div><span>Tipo</span><b>{r.tipo}</b></div>
            <div><span>Fecha</span><b>{fecha(r.fecha)}</b></div>
            <div className="w2"><span>Asunto</span><b>{r.asunto}</b></div>
          </div>
          <div className="burbuja mia"><div className="bur-lbl">Tu reporte</div>{r.detalle}</div>
          {r.respuesta
            ? <div className="burbuja ellos"><div className="bur-lbl">GasLara{r.atendio ? ` · ${r.atendio}` : ""}{r.cerrado ? ` · ${fecha(r.cerrado)}` : ""}</div>{r.respuesta}</div>
            : <div className="esperando"><Clock size={15} /> En revisión por la coordinación de atención al usuario.</div>}
        </div>
        <div className="hm-f"><button className="btn" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}

/* ═══════════  PERFIL  ═══════════ */

function Perfil({ mis, ciclo }) {
  const total = mis.filter((s) => s.estado === "CULMINADO").reduce((s, x) => s + x.total, 0);
  const bombonas = mis.filter((s) => cpt(s.concepto).bombona && s.estado === "CULMINADO").reduce((s, x) => s + x.cantidad, 0);
  const anios = ((HOY - C.desde) / 31536000000).toFixed(0);
  return (
    <>
      <section className="contrato">
        <div className="con-l">
          <div className="con-eyebrow"><ShieldCheck size={14} /> Contrato activo</div>
          <div className="con-id">{C.contrato}</div>
          <div className="con-desc">{C.tipoContrato}</div>
          <div className="con-desde">Cliente desde {fechaLarga(C.desde)} · {anios} años</div>
        </div>
        <div className="con-r">
          <div><span>Bombonas recibidas</span><b>{bombonas}</b></div>
          <div><span>Total pagado</span><b>{bs(total)}</b></div>
          {ciclo && <div><span>Frecuencia</span><b>{ciclo.promedio} días</b></div>}
        </div>
      </section>
      <div className="grid2">
        <section className="card">
          <div className="card-h"><h2>Datos personales</h2></div>
          <div className="datos">
            <div className="w2"><span>Nombre o razón social</span><b>{C.nombre}</b></div>
            <div><span>Cédula</span><b>{C.doc}</b></div>
            <div><span>Código de usuario</span><b>{C.id}</b></div>
            <div><span>Tipo de cliente</span><b>{C.tipo}</b></div>
            <div><span>Teléfono</span><b>{C.tel}</b></div>
            <div className="w2"><span>Correo</span><b>{C.correo}</b></div>
          </div>
        </section>
        <section className="card">
          <div className="card-h"><h2>Dirección de servicio</h2></div>
          <div className="datos">
            <div className="w2"><span>Dirección</span><b>{C.dir}</b></div>
            <div className="w2"><span>Sector</span><b>{C.sector}</b></div>
            <div className="w2"><span>Comuna asignada</span><b>{comunaOf(C.comuna).nombre}</b></div>
            <div className="w2"><span>Punto de distribución</span><b>{comunaOf(C.comuna).punto}</b></div>
            <div><span>CDT abastecedor</span><b>{cdtOf(C.cdt).nombre}</b></div>
            <div><span>Estatus</span><b>Verificada</b></div>
          </div>
          <div className="datos-nota">
            <AlertCircle size={14} /> Para cambiar tu dirección debes solicitar el trámite de cambio de dirección. Tiene un costo de Bs {bs(cpt("CAMB_DIR").precio)} más IVA.
          </div>
        </section>
      </div>
    </>
  );
}

/* ═══════════  WIZARD  ═══════════ */

function Wizard({ onClose, onSave, aviso }) {
  const [paso, setPaso] = useState(1);
  const [d, setD] = useState({ concepto: "BOMB_18", cantidad: 1, ventana: "Mañana (8 am – 12 m)", nota: "", banco: "BDV", referencia: "" });
  const c = cpt(d.concepto), bk = banco(d.banco);
  const m = montos(d.concepto, d.cantidad, C.id);
  const refOk = /^\d{4,}$/.test(d.referencia.trim());
  const copiar = (t, l) => { try { navigator.clipboard.writeText(t); aviso(`${l} copiado`); } catch (e) {} };
  const titulos = ["¿Qué necesitas?", "¿Cuándo y dónde?", "Paga tu pedido", "Revisa y confirma"];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="wiz" onClick={(e) => e.stopPropagation()}>
        <div className="wiz-h">
          <div><div className="hm-eyebrow">Nuevo pedido</div><h3>{titulos[paso - 1]}</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={19} /></button>
        </div>
        <div className="wiz-pasos">{[1, 2, 3, 4].map((n) => <div key={n} className={`wp ${paso >= n ? "on" : ""}`} />)}</div>
        <div className="wiz-b">
          {paso === 1 && (
            <>
              <div className="aviso-pago"><Info size={15} /><p>En GasLara <b>se paga antes del despacho</b>. Eliges el producto, reportas tu pago y el sistema lo verifica automáticamente contra el banco.</p></div>
              <div className="grupo-lbl">Gas</div>
              <div className="opciones">
                {PRODUCTOS.map((p) => (
                  <button key={p.id} className={`opc ${d.concepto === p.id ? "sel" : ""}`} onClick={() => setD({ ...d, concepto: p.id, cantidad: p.granel ? 100 : 1 })}>
                    <div className="opc-ico"><Package size={19} /></div>
                    <div className="opc-txt"><b>{p.corto}</b><span>{p.sub}</span></div>
                    <div className="opc-precio">Bs {bs(p.precio)}{montos(p.id, 1, C.id).exento && <em>exonerado</em>}</div>
                  </button>
                ))}
              </div>
              <div className="grupo-lbl">Servicios</div>
              <div className="opciones">
                {SERVICIOS.map((p) => (
                  <button key={p.id} className={`opc ${d.concepto === p.id ? "sel" : ""}`} onClick={() => setD({ ...d, concepto: p.id, cantidad: 1 })}>
                    <div className="opc-ico alt"><ShieldCheck size={19} /></div>
                    <div className="opc-txt"><b>{p.corto}</b><span>{p.sub}</span></div>
                    <div className="opc-precio">Bs {bs(p.precio)}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {paso === 2 && (
            <>
              {c.bombona && (
                <div className="campo"><span>Cantidad</span>
                  <div className="stepper">
                    <button onClick={() => setD({ ...d, cantidad: Math.max(1, d.cantidad - 1) })}>−</button>
                    <b>{d.cantidad}</b>
                    <button onClick={() => setD({ ...d, cantidad: Math.min(6, d.cantidad + 1) })}>+</button>
                  </div>
                </div>
              )}
              {c.granel && (
                <label className="campo"><span>Kilogramos</span>
                  <input type="number" min="50" step="50" value={d.cantidad}
                    onChange={(e) => setD({ ...d, cantidad: Math.max(50, Number(e.target.value) || 50) })} /></label>
              )}
              <div className="campo"><span>Modalidad de entrega residencial</span>
                <div className="dir-card">
                  <Users size={17} />
                  <div><b>Jornada comunal consolidada</b><span>GasLara lleva el lote completo a la comuna; no realiza una parada individual en tu vivienda.</span></div>
                  <span className="chip c-ok">Comunal</span>
                </div>
              </div>
              <div className="campo"><span>Punto de recepción</span>
                <div className="dir-card">
                  <MapPin size={17} />
                  <div><b>{COM.punto}</b><span>{COM.nombre} · {cdtOf(C.cdt).nombre}</span></div>
                  <span className="chip c-ok">Asignado</span>
                </div>
              </div>
              <label className="campo"><span>Nota para la comuna (opcional)</span>
                <textarea rows={2} placeholder="Ej: avisar al responsable comunal" value={d.nota}
                  onChange={(e) => setD({ ...d, nota: e.target.value })} /></label>
            </>
          )}

          {paso === 3 && (
            <>
              <div className="monto-grande"><span>Monto a pagar</span><b>Bs {bs(m.total)}</b></div>
              <div className="campo"><span>¿Por dónde vas a pagar?</span>
                <div className="bancos">
                  {BANCOS.map((b) => (
                    <button key={b.id} className={`banco ${d.banco === b.id ? "sel" : ""}`} onClick={() => setD({ ...d, banco: b.id })}>
                      <div className="bk-marca" style={{ background: b.color }}>{b.movil ? <Smartphone size={15} /> : <Landmark size={15} />}</div>
                      <div className="bk-txt"><b>{b.nombre}</b><span>{b.tipo}</span></div>
                      {d.banco === b.id && <Check size={16} className="bk-check" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cuenta">
                <div className="det-lbl">Datos para transferir</div>
                <button className="cta-row" onClick={() => copiar(bk.cuenta.replace(/-/g, ""), bk.movil ? "Teléfono" : "Número de cuenta")}>
                  <div><span>{bk.movil ? "Teléfono" : "Número de cuenta"}</span><b>{bk.cuenta}</b></div><Copy size={16} />
                </button>
                <button className="cta-row" onClick={() => copiar(EMPRESA.rif, "Rif")}>
                  <div><span>Titular</span><b>GasLara C.A. · Rif: {EMPRESA.rif}</b></div><Copy size={16} />
                </button>
                <button className="cta-row" onClick={() => copiar(m.total.toFixed(2), "Monto")}>
                  <div><span>Monto exacto</span><b>Bs {bs(m.total)}</b></div><Copy size={16} />
                </button>
              </div>
              <label className="campo"><span>Número de referencia del pago</span>
                <input inputMode="numeric" placeholder="Últimos dígitos que te dio el banco" value={d.referencia}
                  onChange={(e) => setD({ ...d, referencia: e.target.value.replace(/[^\d]/g, "") })} />
                {d.referencia && !refOk && <em className="err">Debe tener al menos 4 dígitos.</em>}
              </label>
              <div className="aviso-pago"><Zap size={15} /><p>El sistema valida tu referencia contra el banco en el momento. Si coincide, tu pedido entra de una vez a la cola de distribución.</p></div>
            </>
          )}

          {paso === 4 && (
            <>
              <div className="resumen">
                <div className="res-row"><span>Producto</span><b>{c.nombre}</b></div>
                <div className="res-row"><span>Cantidad</span><b>{num(d.cantidad)} {c.unidad}</b></div>
                <div className="res-row"><span>Horario</span><b>{d.ventana}</b></div>
                <div className="res-row"><span>Dirección</span><b>{C.dir}</b></div>
                {d.nota && <div className="res-row"><span>Nota</span><b>{d.nota}</b></div>}
                <div className="res-sep" />
                <div className="res-row"><span>Banco</span><b>{bk.nombre}</b></div>
                <div className="res-row"><span>Referencia</span><b>{d.referencia}</b></div>
                <div className="res-sep" />
                <div className="res-row"><span>Subtotal</span><b>Bs {bs(m.base)}</b></div>
                <div className="res-row"><span>IVA</span><b>{m.exento ? "Exonerado" : `Bs ${bs(m.iva)}`}</b></div>
                <div className="res-row total"><span>Total pagado</span><b>Bs {bs(m.total)}</b></div>
              </div>
              <div className="aviso-pago"><Info size={15} /><p>La factura se emite cuando el despacho se cierra en el sistema, no en este momento. La verás en tu historial ese mismo día.</p></div>
            </>
          )}
        </div>
        <div className="wiz-f">
          {paso > 1 ? <button className="btn" onClick={() => setPaso(paso - 1)}><ChevronLeft size={15} /> Atrás</button>
                    : <button className="btn" onClick={onClose}>Cancelar</button>}
          {paso < 4
            ? <button className="btn primary" disabled={paso === 3 && !refOk} onClick={() => setPaso(paso + 1)}>Continuar <ChevronRight size={15} /></button>
            : <button className="btn primary" onClick={() => onSave(d)}>Confirmar pedido <Check size={16} /></button>}
        </div>
      </div>
    </div>
  );
}

function ModalListo({ s, onClose }) {
  const bk = banco(s.pago.banco);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="hoja-modal chico" onClick={(e) => e.stopPropagation()}>
        <div className="listo-b">
          <div className="listo-ico"><Check size={30} strokeWidth={3} /></div>
          <h3>Pago verificado</h3>
          <p>Confirmamos tus <b>Bs {bs(s.total)}</b> por {bk.nombre}, referencia <b>{s.pago.referencia}</b>.</p>
          <div className="listo-id">{s.id}</div>
          <div className="listo-nota"><Truck size={14} /> Tu pedido ya está en la cola de distribución. Te avisamos cuando salga la unidad.</div>
        </div>
        <div className="hm-f"><button className="btn primary" onClick={onClose}>Ver mis pedidos</button></div>
      </div>
    </div>
  );
}

function ModalReclamo({ mis, onClose, onSave }) {
  const [d, setD] = useState({ tipo: "Demora en despacho", asunto: "", detalle: "", solicitud: "" });
  const ok = d.asunto.trim().length > 4 && d.detalle.trim().length > 9;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="hoja-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hm-h"><div><div className="hm-eyebrow">Atención al usuario</div><h3>Nuevo reclamo</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={19} /></button></div>
        <div className="hm-b">
          <label className="campo"><span>Tipo de reclamo</span>
            <select value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>
              {["Demora en despacho", "Pago no acreditado", "Producto defectuoso", "Cobro indebido", "Trato del personal", "Fuga de gas", "Otro"].map((t) => <option key={t}>{t}</option>)}
            </select></label>
          <label className="campo"><span>Pedido relacionado (opcional)</span>
            <select value={d.solicitud} onChange={(e) => setD({ ...d, solicitud: e.target.value })}>
              <option value="">No aplica</option>
              {mis.slice(0, 8).map((s) => <option key={s.id} value={s.id}>{s.id} — {cpt(s.concepto).corto} · {fecha(s.fecha)}</option>)}
            </select></label>
          <label className="campo"><span>Asunto</span>
            <input placeholder="Resume el problema en una línea" value={d.asunto} onChange={(e) => setD({ ...d, asunto: e.target.value })} /></label>
          <label className="campo"><span>Cuéntanos qué pasó</span>
            <textarea rows={4} placeholder="Fecha, pedido afectado y detalles que nos ayuden a resolverlo"
              value={d.detalle} onChange={(e) => setD({ ...d, detalle: e.target.value })} /></label>
          <div className="aviso-pago rojo"><AlertCircle size={15} />
            <p>Si detectas <b>olor a gas</b>, cierra la válvula, ventila el área y llama al {EMPRESA.tel} de inmediato. No esperes respuesta por este canal.</p></div>
        </div>
        <div className="hm-f"><button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={!ok} onClick={() => onSave(d)}>Enviar reclamo</button></div>
      </div>
    </div>
  );
}

function ModalAyuda({ onClose, aviso }) {
  const copiar = (t, l) => { try { navigator.clipboard.writeText(t); aviso(`${l} copiado`); } catch (e) {} };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="hoja-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hm-h"><div><div className="hm-eyebrow">Ayuda</div><h3>Cómo pagar y pedir</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={19} /></button></div>
        <div className="hm-b">
          <div>
            <div className="det-lbl">Cuentas de GasLara C.A. · Rif: {EMPRESA.rif}</div>
            <div className="bancos">
              {BANCOS.map((b) => (
                <button key={b.id} className="banco" onClick={() => copiar(b.cuenta.replace(/-/g, ""), b.movil ? "Teléfono" : "Cuenta")}>
                  <div className="bk-marca" style={{ background: b.color }}>{b.movil ? <Smartphone size={15} /> : <Landmark size={15} />}</div>
                  <div className="bk-txt"><b>{b.nombre}</b><span>{b.tipo} · {b.cuenta}</span></div>
                  <Copy size={15} className="bk-check" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="det-lbl">Qué pasa después de que pagas</div>
            <div className="ayuda-lista">
              {FASES.map((f, i) => {
                const Ico = ICONOS_FASE[i];
                return (
                  <div className="ay-row" key={f.key}>
                    <div className="ay-ico"><Ico size={16} /></div>
                    <div><b>{f.cliente}</b><span>{f.clienteDesc}</span></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="aviso-pago"><Info size={15} /><p>La factura se emite cuando el despacho se cierra en el sistema, no cuando pagas. Por eso puede pasar un rato entre tu transferencia y la factura.</p></div>
          <div className="contacto">
            <div className="cont-b"><Phone size={17} /><div><b>{EMPRESA.tel}</b><span>Atención al usuario</span></div></div>
            <div className="cont-b"><MapPin size={17} /><div><b>{cdtOf(C.cdt).nombre}</b><span>Centro Empresarial Lara, Barquisimeto</span></div></div>
          </div>
        </div>
        <div className="hm-f"><button className="btn primary" onClick={onClose}>Entendido</button></div>
      </div>
    </div>
  );
}

/* ═══════════  ESTILOS  ═══════════ */

function Estilos() {
  return (
    <style>{`
.pt{--ink:#12211E;--ink-2:#40534F;--ink-3:#7A8C88;--bg:#F4F2ED;--panel:#FFF;--line:#E2E0D9;--line-2:#EFEDE7;
--verde:#1E7A4C;--verde-2:#2E9A63;--verde-w:#E6F3EC;--llama:#E0611F;--llama-w:#FCEDE3;
--azul:#1B5E8A;--azul-w:#E7F0F7;--rojo:#B3261E;--rojo-w:#FBEAE8;
--sans:"Inter","Segoe UI",system-ui,-apple-system,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
--r:16px;--sh:0 1px 2px rgba(18,33,30,.05),0 8px 24px -12px rgba(18,33,30,.14);
display:flex;min-height:calc(100vh - 46px);background:var(--bg);font-family:var(--sans);color:var(--ink);font-size:15px;-webkit-font-smoothing:antialiased}
.pt *{box-sizing:border-box}
.pt button{font-family:inherit;cursor:pointer}
.pt input,.pt select,.pt textarea{font-family:inherit;font-size:15px}
.pt :focus-visible{outline:2px solid var(--verde-2);outline-offset:2px}

.side{width:264px;flex-shrink:0;background:var(--panel);border-right:1px solid var(--line);display:flex;flex-direction:column;position:sticky;top:46px;height:calc(100vh - 46px)}
.side-brand{padding:20px}
.logo-img{width:148px;height:auto;display:block}
.logo-rif{font-size:10.5px;color:var(--ink-3);font-family:var(--mono);margin-top:7px}
.side-user{display:flex;gap:11px;align-items:center;margin:0 14px 16px;padding:12px;background:var(--verde-w);border-radius:13px}
.avatar{width:38px;height:38px;border-radius:50%;background:var(--verde);color:#fff;display:grid;place-items:center;font-weight:650;font-size:14px;flex-shrink:0}
.su-txt{min-width:0}
.su-nom{font-size:12.5px;font-weight:650;line-height:1.25;text-transform:capitalize}
.su-sub{font-size:11px;color:var(--ink-3);margin-top:2px}
.side nav{display:flex;flex-direction:column;gap:2px;padding:0 12px}
.nav-b{display:flex;align-items:center;gap:12px;width:100%;padding:11px 12px;background:none;border:none;color:var(--ink-2);font-size:14.5px;text-align:left;border-radius:11px;transition:.13s}
.nav-b:hover{background:var(--line-2)}
.nav-b.on{background:var(--ink);color:#fff;font-weight:560}
.nav-b span{flex:1}
.nav-badge{font-style:normal;font-size:11px;background:var(--llama);color:#fff;padding:1px 7px;border-radius:20px;font-weight:650;font-family:var(--mono)}
.side-foot{margin-top:auto;padding:12px;border-top:1px solid var(--line-2)}
.nav-b.ghost{font-size:13.5px;color:var(--ink-3)}
.logo-lara{width:82px;height:auto;display:block;margin:14px auto 6px;opacity:.9}

.main{flex:1;min-width:0;display:flex;flex-direction:column}
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding:24px 30px 18px}
.top-loc{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--ink-3);margin-bottom:5px}
.top h1{margin:0;font-size:26px;font-weight:680;letter-spacing:-.8px;text-transform:capitalize}
.top-r{display:flex;gap:10px;align-items:center}
.icon-round{width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--panel);color:var(--ink-2);display:grid;place-items:center}
.body{padding:0 30px 40px;flex:1}
.pie{display:flex;gap:16px;align-items:center;padding:22px 0 30px;font-size:11.5px;color:var(--ink-3);line-height:1.65;border-top:1px solid var(--line);margin:0 30px}
.pie-lara{width:52px;height:auto;flex-shrink:0;opacity:.85}
.pie em{font-style:normal;opacity:.75}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:42px;padding:0 18px;border:1px solid var(--line);background:var(--panel);color:var(--ink-2);border-radius:11px;font-size:14.5px;font-weight:560;transition:.13s;white-space:nowrap}
.btn:hover{border-color:#C8C6BE;color:var(--ink)}
.btn.primary{background:var(--verde);border-color:var(--verde);color:#fff}
.btn.primary:hover{background:#186340}
.btn.primary:disabled{background:#B4C6BC;border-color:#B4C6BC;cursor:not-allowed}
.btn.lg{height:50px;padding:0 24px;font-size:15.5px;border-radius:13px}
.btn.sm{height:34px;padding:0 13px;font-size:13px;border-radius:9px}
.icon-btn{background:none;border:none;color:var(--ink-3);padding:5px;border-radius:8px;display:grid;place-items:center}
.icon-btn:hover{background:var(--line-2);color:var(--ink)}
.link{background:none;border:none;padding:0;color:var(--verde);font-size:13.5px;font-weight:560;display:inline-flex;align-items:center;gap:3px}

.hero{background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:28px 32px;display:grid;grid-template-columns:1fr 180px;gap:26px;align-items:center;margin-bottom:16px;box-shadow:var(--sh)}
.hero-eyebrow{display:flex;align-items:center;gap:6px;font-size:11px;text-transform:uppercase;letter-spacing:.13em;color:var(--ink-3);font-weight:650}
.hero-num{font-size:50px;font-weight:700;letter-spacing:-2.2px;line-height:1;margin:10px 0;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.hero-num em{font-size:15px;font-weight:520;color:var(--ink-3);font-style:normal;line-height:1.3;max-width:180px}
.hero-desc{margin:0 0 18px;font-size:14.5px;color:var(--ink-2);line-height:1.55;max-width:52ch}
.hero-desc b{font-weight:640;color:var(--ink)}
.ciclo{max-width:440px}
.ciclo-meter{height:9px;background:var(--line-2);border-radius:5px;overflow:hidden}
.ciclo-fill{height:100%;background:linear-gradient(90deg,var(--verde),var(--verde-2));border-radius:5px;transition:width .6s}
.ciclo-fill.cerca{background:linear-gradient(90deg,var(--llama),#F5A623)}
.ciclo-ejes{display:flex;justify-content:space-between;margin-top:8px;font-size:11.5px;color:var(--ink-2);font-family:var(--mono)}
.ciclo-ejes span{display:flex;flex-direction:column;gap:2px}
.ciclo-ejes .r{text-align:right}
.ciclo-ejes em{font-style:normal;font-family:var(--sans);font-size:10.5px;color:var(--ink-3)}
.hero-nota{display:flex;gap:9px;align-items:flex-start;margin:16px 0 18px;padding:12px 14px;background:#FAF9F5;border:1px dashed var(--line);border-radius:12px;color:var(--ink-3);max-width:52ch}
.hero-nota p{margin:0;font-size:12.5px;line-height:1.55}
.hero-nota b{color:var(--ink-2);font-weight:620}
.hero-r{display:flex;flex-direction:column;align-items:center;gap:9px}
.bombona{width:142px;height:auto;filter:drop-shadow(0 12px 22px rgba(18,33,30,.13))}
.bomb-cap{display:flex;align-items:center;gap:5px;font-size:10.5px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.08em;font-weight:600}

.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);margin-bottom:16px;overflow:hidden;box-shadow:var(--sh)}
.card.destacada{border-color:#CFE3D8}
.card-h{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid var(--line-2)}
.card-h h2{margin:0;font-size:15px;font-weight:640;display:flex;align-items:center;gap:9px}
.card-note{font-size:12.5px;color:var(--ink-3)}
.pulse{width:8px;height:8px;border-radius:50%;background:var(--verde-2);box-shadow:0 0 0 0 rgba(46,154,99,.6);animation:pulse 2s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 9px rgba(46,154,99,0)}100%{box-shadow:0 0 0 0 rgba(46,154,99,0)}}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}

.track{display:grid;grid-template-columns:repeat(4,1fr);padding:22px 20px 18px}
.track.mini{padding:14px 0 6px}
.tr-step{display:flex;flex-direction:column;gap:9px;min-width:0}
.tr-top{display:flex;align-items:center}
.tr-dot{width:28px;height:28px;border-radius:50%;background:var(--line-2);color:var(--ink-3);display:grid;place-items:center;flex-shrink:0;transition:.3s}
.tr-step.on .tr-dot{background:var(--verde);color:#fff}
.tr-step.act .tr-dot{box-shadow:0 0 0 4px var(--verde-w)}
.tr-n{font-size:11.5px;font-weight:650}
.tr-line{flex:1;height:2.5px;background:var(--line-2);margin:0 3px}
.tr-step.on .tr-line{background:var(--verde)}
.tr-step:last-child .tr-line{display:none}
.tr-txt{padding-right:10px}
.tr-txt b{display:block;font-size:11.5px;font-weight:590;line-height:1.3;color:var(--ink-3)}
.tr-step.on .tr-txt b{color:var(--ink)}
.tr-txt span{display:block;font-size:10.5px;color:var(--ink-3);margin-top:3px;line-height:1.35}
.track.mini .tr-dot{width:22px;height:22px}
.track.mini .tr-txt b{font-size:10px}

.curso-info{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:16px 20px;background:#FBFAF7;border-top:1px solid var(--line-2)}
.curso-info div{display:flex;flex-direction:column;gap:3px;min-width:0}
.curso-info span{font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3);font-weight:650}
.curso-info b{font-size:13.5px;font-weight:560}

.alerta{display:flex;align-items:center;gap:15px;background:var(--llama-w);border:1px solid #F0D6C4;border-radius:var(--r);padding:16px 20px;margin-bottom:16px}
.alerta.claro{background:var(--azul-w);border-color:#CFE0EC}
.alerta-ico{width:42px;height:42px;border-radius:12px;background:var(--llama);color:#fff;display:grid;place-items:center;flex-shrink:0}
.alerta-ico.azul{background:var(--azul)}
.alerta-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.alerta-txt b{font-size:14.5px;font-weight:620}
.alerta-txt span{font-size:13px;color:var(--ink-2);line-height:1.45}

.acc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:13px;margin-bottom:16px}
.acceso{display:flex;align-items:center;gap:13px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:16px;text-align:left;transition:.15s;box-shadow:var(--sh)}
.acceso:hover{transform:translateY(-2px);border-color:#C8C6BE}
.acc-ico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex-shrink:0}
.acceso.verde .acc-ico{background:var(--verde-w);color:var(--verde)}
.acceso.azul .acc-ico{background:var(--azul-w);color:var(--azul)}
.acceso.naranja .acc-ico{background:var(--llama-w);color:var(--llama)}
.acceso.gris .acc-ico{background:var(--line-2);color:var(--ink-2)}
.acc-txt{flex:1;min-width:0}
.acc-txt b{display:block;font-size:14px;font-weight:600;line-height:1.25}
.acc-txt span{display:block;font-size:12px;color:var(--ink-3);margin-top:3px}
.acc-arrow{color:var(--ink-3);flex-shrink:0}

.lista{display:flex;flex-direction:column}
.lista-row{display:flex;align-items:center;gap:13px;padding:14px 20px;background:none;border:none;border-bottom:1px solid var(--line-2);text-align:left;width:100%;transition:.12s}
.lista-row:last-child{border-bottom:none}
.lista-row:not(.estatico):hover{background:#FBFAF7}
.lr-ico{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;flex-shrink:0;background:var(--line-2);color:var(--ink-2)}
.lr-ico.ok{background:var(--verde-w);color:var(--verde)}
.lr-ico.warn{background:var(--llama-w);color:var(--llama)}
.lr-ico.act{background:var(--azul-w);color:var(--azul)}
.lr-txt{flex:1;min-width:0}
.lr-txt b{display:block;font-size:14px;font-weight:570;line-height:1.25}
.lr-txt span{display:block;font-size:12px;color:var(--ink-3);margin-top:3px}
.lr-r{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0}
.lr-r b{font-family:var(--mono);font-size:13.5px;font-weight:600}
.lr-btns{display:flex;gap:7px;flex-shrink:0;margin-left:6px}
.lr-arrow{color:var(--ink-3);flex-shrink:0}

.chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:640;padding:3px 10px;border-radius:20px;white-space:nowrap}
.c-ok{background:var(--verde-w);color:var(--verde)}
.c-warn{background:var(--llama-w);color:var(--llama)}
.c-act{background:var(--azul-w);color:var(--azul)}

.filtros{display:flex;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.tabs{display:flex;background:var(--line-2);border-radius:11px;padding:3px}
.tabs button{border:none;background:none;padding:8px 16px;font-size:13.5px;color:var(--ink-3);border-radius:8px;font-weight:520}
.tabs button.on{background:var(--panel);color:var(--ink);font-weight:600;box-shadow:0 1px 3px rgba(18,33,30,.12)}
.search{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--panel);border-radius:11px;padding:0 13px;height:40px;color:var(--ink-3)}
.search input{border:none;outline:none;width:190px;padding:8px 0;background:none}

.pedidos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
.ped{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:17px 19px;text-align:left;transition:.15s;box-shadow:var(--sh);display:flex;flex-direction:column;gap:13px}
.ped:hover{transform:translateY(-2px);border-color:#C8C6BE}
.ped.activo{border-color:#CFE3D8;background:linear-gradient(180deg,#F7FBF9,#fff 60px)}
.ped-h{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.ped-id{font-family:var(--mono);font-size:13.5px;font-weight:640}
.ped-fecha{font-size:12px;color:var(--ink-3);margin-top:3px}
.ped-prod{display:flex;align-items:center;gap:11px}
.ped-ico{width:38px;height:38px;border-radius:11px;background:var(--line-2);color:var(--ink-2);display:grid;place-items:center;flex-shrink:0}
.ped-prod b{display:block;font-size:14px;font-weight:570}
.ped-prod span{display:block;font-size:12px;color:var(--ink-3);margin-top:2px}
.ped-f{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:12px;border-top:1px solid var(--line-2)}
.ped-docs{display:flex;gap:6px;flex-wrap:wrap}
.ped-docs span{font-family:var(--mono);font-size:10px;background:var(--line-2);color:var(--ink-3);padding:2px 7px;border-radius:5px}
.ped-tot{font-family:var(--mono);font-size:15px;font-weight:640}
.vacio{text-align:center;padding:50px 20px;color:var(--ink-3)}
.vacio p{margin:12px 0 0;font-size:14px}

.rec-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.rec{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:17px 19px;text-align:left;display:flex;flex-direction:column;gap:8px;transition:.15s;box-shadow:var(--sh)}
.rec:hover{transform:translateY(-2px);border-color:#C8C6BE}
.rec-h{display:flex;justify-content:space-between;align-items:center;gap:10px}
.rec-id{font-family:var(--mono);font-size:12.5px;color:var(--ink-3);font-weight:600}
.rec-asunto{font-size:14.5px;font-weight:590;line-height:1.35}
.rec-tipo{font-size:12px;color:var(--ink-3)}
.rec-resp{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--verde);margin-top:3px;font-weight:540}
.burbuja{border-radius:14px;padding:14px 16px;font-size:14px;line-height:1.55}
.burbuja.mia{background:var(--line-2);color:var(--ink-2)}
.burbuja.ellos{background:var(--verde-w);color:#16543A}
.bur-lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;opacity:.65;margin-bottom:6px}
.esperando{display:flex;align-items:center;gap:9px;background:var(--llama-w);color:#7A4E05;border-radius:12px;padding:13px 15px;font-size:13.5px}

.contrato{background:var(--ink);color:#fff;border-radius:20px;padding:26px 30px;display:flex;justify-content:space-between;gap:26px;flex-wrap:wrap;margin-bottom:16px}
.con-eyebrow{display:flex;align-items:center;gap:6px;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#8FB3A3;font-weight:650}
.con-id{font-family:var(--mono);font-size:28px;font-weight:650;letter-spacing:-.8px;margin:9px 0 5px}
.con-desc{font-size:14.5px;color:#C3D2CD}
.con-desde{font-size:12.5px;color:#7E9891;margin-top:7px}
.con-r{display:flex;gap:28px;align-items:flex-end;flex-wrap:wrap}
.con-r div{display:flex;flex-direction:column;gap:4px}
.con-r span{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#8FB3A3;font-weight:650}
.con-r b{font-family:var(--mono);font-size:21px;font-weight:640}
.datos{display:grid;grid-template-columns:1fr 1fr;gap:15px;padding:18px 20px}
.datos div{display:flex;flex-direction:column;gap:4px;min-width:0}
.datos .w2{grid-column:span 2}
.datos span{font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3);font-weight:650}
.datos b{font-size:14px;font-weight:550;word-break:break-word}
.datos-nota{display:flex;gap:9px;align-items:flex-start;padding:14px 20px;background:#FBFAF7;border-top:1px solid var(--line-2);font-size:12.5px;color:var(--ink-3);line-height:1.5}

.overlay{position:fixed;inset:0;background:rgba(18,33,30,.5);backdrop-filter:blur(3px);display:grid;place-items:center;padding:18px;z-index:60;animation:fade .18s}
@keyframes fade{from{opacity:0}to{opacity:1}}
.hoja-modal,.wiz{background:var(--panel);border-radius:20px;width:100%;max-width:560px;box-shadow:0 24px 70px rgba(18,33,30,.35);animation:pop .22s cubic-bezier(.2,.9,.3,1);max-height:92vh;display:flex;flex-direction:column}
.hoja-modal.chico{max-width:430px}
@keyframes pop{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
.hm-h,.wiz-h{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 22px 14px}
.hm-h h3,.wiz-h h3{margin:5px 0 0;font-size:19px;font-weight:660;letter-spacing:-.4px}
.hm-eyebrow{font-size:10.5px;text-transform:uppercase;letter-spacing:.13em;color:var(--verde);font-weight:700}
.hm-b,.wiz-b{padding:6px 22px 20px;display:flex;flex-direction:column;gap:16px;overflow-y:auto}
.hm-f,.wiz-f{display:flex;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid var(--line-2);background:#FBFAF7;border-radius:0 0 20px 20px}
.det-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.det-grid .w2{grid-column:span 2}
.det-grid div{display:flex;flex-direction:column;gap:3px;min-width:0}
.det-grid span{font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3);font-weight:650}
.det-grid b{font-size:14px;font-weight:550}
.det-lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--verde);font-weight:700;margin-bottom:10px}
.det-docs{background:#FBFAF7;border-radius:13px;padding:15px 17px}
.dd-row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:13.5px;align-items:center}
.dd-row span:first-child{color:var(--ink-3)}
.dd-row b{font-family:var(--mono);font-size:13px;text-align:right}
.det-tot{border-top:1px solid var(--line-2);padding-top:14px;display:flex;flex-direction:column;gap:8px}
.det-tot div{display:flex;justify-content:space-between;gap:12px;font-size:14px}
.det-tot span{color:var(--ink-3)}
.det-tot b{font-family:var(--mono);font-weight:560}
.det-tot .big{border-top:1px solid var(--line);padding-top:11px;margin-top:3px}
.det-tot .big b{font-size:19px;font-weight:680}

.wiz-pasos{display:flex;gap:6px;padding:0 22px 16px}
.wp{flex:1;height:4px;border-radius:3px;background:var(--line-2);transition:.3s}
.wp.on{background:var(--verde)}
.grupo-lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);font-weight:700}
.opciones{display:flex;flex-direction:column;gap:9px;margin-top:-6px}
.opc{display:flex;align-items:center;gap:13px;padding:13px 15px;border:1.5px solid var(--line);background:var(--panel);border-radius:13px;text-align:left;transition:.13s}
.opc:hover{border-color:#C8C6BE}
.opc.sel{border-color:var(--verde);background:var(--verde-w)}
.opc-ico{width:38px;height:38px;border-radius:11px;background:var(--line-2);color:var(--ink-2);display:grid;place-items:center;flex-shrink:0}
.opc.sel .opc-ico{background:var(--verde);color:#fff}
.opc-ico.alt{background:var(--llama-w);color:var(--llama)}
.opc-txt{flex:1;min-width:0}
.opc-txt b{display:block;font-size:14.5px;font-weight:580}
.opc-txt span{display:block;font-size:12.5px;color:var(--ink-3);margin-top:2px}
.opc-precio{font-family:var(--mono);font-size:13.5px;font-weight:620;text-align:right;flex-shrink:0}
.opc-precio em{display:block;font-style:normal;font-size:10px;color:var(--verde);font-weight:650;text-transform:uppercase;letter-spacing:.08em;margin-top:2px;font-family:var(--sans)}
.campo{display:flex;flex-direction:column;gap:7px}
.campo>span{font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3);font-weight:650}
.campo input,.campo select,.campo textarea{border:1.5px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--panel);color:var(--ink);outline:none;width:100%;resize:vertical}
.campo input:focus,.campo select:focus,.campo textarea:focus{border-color:var(--verde-2)}
.campo .err{font-style:normal;font-size:12px;color:var(--rojo)}
.stepper{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:12px;width:fit-content;overflow:hidden}
.stepper button{width:46px;height:46px;border:none;background:var(--panel);font-size:20px;color:var(--ink-2)}
.stepper button:hover{background:var(--line-2)}
.stepper b{width:56px;text-align:center;font-family:var(--mono);font-size:17px;font-weight:640}
.radios{display:flex;gap:8px;flex-wrap:wrap}
.radios button{border:1.5px solid var(--line);background:var(--panel);border-radius:11px;padding:11px 15px;font-size:13.5px;color:var(--ink-2);text-align:left;transition:.13s}
.radios button.on{border-color:var(--verde);background:var(--verde-w);color:var(--verde);font-weight:580}
.dir-card{display:flex;align-items:center;gap:12px;border:1.5px solid var(--line);border-radius:13px;padding:14px;color:var(--ink-3)}
.dir-card div{flex:1;min-width:0}
.dir-card b{display:block;font-size:13.5px;font-weight:570;color:var(--ink)}
.dir-card span{display:block;font-size:12px;margin-top:2px}

.bancos{display:flex;flex-direction:column;gap:8px}
.banco{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1.5px solid var(--line);background:var(--panel);border-radius:13px;text-align:left;transition:.13s;width:100%}
.banco:hover{border-color:#C8C6BE}
.banco.sel{border-color:var(--verde);background:var(--verde-w)}
.bk-marca{width:34px;height:34px;border-radius:9px;color:#fff;display:grid;place-items:center;flex-shrink:0}
.bk-txt{flex:1;min-width:0}
.bk-txt b{display:block;font-size:13.5px;font-weight:580;line-height:1.25}
.bk-txt span{display:block;font-size:11.5px;color:var(--ink-3);margin-top:2px;font-family:var(--mono)}
.bk-check{color:var(--verde);flex-shrink:0}
.cuenta{background:#FBFAF7;border-radius:14px;padding:15px 17px}
.cta-row{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;background:none;border:none;border-bottom:1px solid var(--line-2);padding:10px 0;text-align:left;color:var(--ink-3)}
.cta-row:last-child{border-bottom:none}
.cta-row:hover{color:var(--verde)}
.cta-row span{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;font-weight:650}
.cta-row b{display:block;font-size:13.5px;font-family:var(--mono);color:var(--ink);margin-top:3px;font-weight:600}
.monto-grande{background:var(--verde-w);border-radius:14px;padding:18px;text-align:center}
.monto-grande span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--verde);font-weight:650}
.monto-grande b{display:block;font-family:var(--mono);font-size:30px;font-weight:700;color:var(--verde);margin-top:6px;letter-spacing:-1px}
.resumen{background:#FBFAF7;border-radius:14px;padding:17px 19px;display:flex;flex-direction:column;gap:10px}
.res-row{display:flex;justify-content:space-between;gap:14px;font-size:14px;align-items:baseline}
.res-row span{color:var(--ink-3);flex-shrink:0}
.res-row b{text-align:right;font-weight:560}
.res-sep{border-top:1px solid var(--line);margin:3px 0}
.res-row.total{border-top:1.5px solid var(--ink);padding-top:12px;margin-top:3px}
.res-row.total b{font-family:var(--mono);font-size:21px;font-weight:700}
.res-row.total span{font-weight:640;color:var(--ink)}
.aviso-pago{display:flex;gap:10px;align-items:flex-start;background:var(--azul-w);border-radius:12px;padding:13px 15px;color:var(--azul)}
.aviso-pago.rojo{background:var(--rojo-w);color:var(--rojo)}
.aviso-pago p{margin:0;font-size:12.5px;line-height:1.55}
.listo-b{padding:34px 26px 26px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:11px}
.listo-ico{width:64px;height:64px;border-radius:50%;background:var(--verde-w);color:var(--verde);display:grid;place-items:center}
.listo-b h3{margin:4px 0 0;font-size:21px;font-weight:680;letter-spacing:-.5px}
.listo-b p{margin:0;font-size:14px;color:var(--ink-2);line-height:1.55;max-width:34ch}
.listo-id{font-family:var(--mono);font-size:17px;font-weight:650;background:var(--line-2);padding:7px 15px;border-radius:9px}
.listo-nota{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--verde);background:var(--verde-w);padding:11px 14px;border-radius:11px;text-align:left;line-height:1.45}
.ayuda-lista{display:flex;flex-direction:column;gap:13px}
.ay-row{display:flex;gap:13px;align-items:flex-start}
.ay-ico{width:34px;height:34px;border-radius:10px;background:var(--verde-w);color:var(--verde);display:grid;place-items:center;flex-shrink:0}
.ay-row b{display:block;font-size:14px;font-weight:580}
.ay-row span{display:block;font-size:12.5px;color:var(--ink-3);margin-top:2px}
.contacto{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cont-b{display:flex;gap:11px;align-items:center;border:1px solid var(--line);border-radius:13px;padding:13px;color:var(--ink-3)}
.cont-b b{display:block;font-size:13px;color:var(--ink);font-weight:580}
.cont-b span{display:block;font-size:11.5px;margin-top:2px}

.toast{position:fixed;bottom:88px;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;display:flex;align-items:center;gap:10px;padding:13px 19px;border-radius:13px;font-size:13.5px;z-index:90;box-shadow:0 12px 34px rgba(18,33,30,.35);animation:up .22s;max-width:calc(100vw - 32px)}
@keyframes up{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}

.tabbar{display:none;position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-top:1px solid var(--line);padding:7px 6px calc(7px + env(safe-area-inset-bottom));z-index:40}
.tabbar button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;padding:6px 2px;color:var(--ink-3);font-size:10.5px;position:relative;font-weight:540}
.tabbar button.on{color:var(--verde)}
.tabbar button i{position:absolute;top:4px;right:calc(50% - 15px);width:7px;height:7px;border-radius:50%;background:var(--llama)}
.fab{display:none;position:fixed;right:18px;bottom:calc(76px + env(safe-area-inset-bottom));width:56px;height:56px;border-radius:50%;background:var(--verde);color:#fff;border:none;place-items:center;z-index:41;box-shadow:0 10px 26px rgba(30,122,76,.4)}

@media print{
 .pt.printing .side,.pt.printing .main,.pt.printing .tabbar,.pt.printing .fab,.pt.printing .toast{display:none!important}
}
@media(max-width:1180px){
 .hero{grid-template-columns:1fr 150px;padding:24px}
 .curso-info{grid-template-columns:1fr 1fr}
 .grid2{grid-template-columns:1fr}
 .tr-txt span{display:none}
}
@media(max-width:820px){
 .side{display:none}
 .tabbar{display:flex}
 .fab{display:grid}
 .body{padding:0 16px 100px}
 .top{padding:18px 16px 14px}
 .top h1{font-size:22px}
 .top-r .btn{display:none}
 .pie{margin:0 16px;padding:20px 0 90px;flex-direction:column;align-items:flex-start}
 .hero{grid-template-columns:1fr;padding:22px;border-radius:18px}
 .hero-r{flex-direction:row;gap:14px;align-items:center;justify-content:flex-start;order:-1}
 .bombona{width:74px}
 .hero-num{font-size:38px}
 .hero-num em{font-size:14px;max-width:none}
 .track{grid-template-columns:1fr;padding:18px}
 .tr-step{flex-direction:row;gap:12px;align-items:flex-start}
 .tr-top{flex-direction:column;align-self:stretch}
 .tr-line{width:2.5px;height:auto;flex:1;min-height:12px;margin:3px 0}
 .tr-txt{padding-bottom:13px}
 .tr-txt b{font-size:13px}
 .tr-txt span{display:block;font-size:11.5px}
 .curso-info{grid-template-columns:1fr 1fr;padding:14px 18px}
 .pedidos-grid,.rec-grid{grid-template-columns:1fr}
 .datos,.det-grid,.contacto{grid-template-columns:1fr}
 .datos .w2,.det-grid .w2{grid-column:span 1}
 .alerta{flex-wrap:wrap}
 .alerta .btn{width:100%}
 .lista-row{flex-wrap:wrap}
 .lr-btns{width:100%;margin-left:49px}
 .filtros{flex-direction:column}
 .search input{width:100%}
 .hoja-modal,.wiz{max-height:94vh;border-radius:18px}
}
@media(prefers-reduced-motion:reduce){.pt *{animation:none!important;transition:none!important}}
`}</style>
  );
}
