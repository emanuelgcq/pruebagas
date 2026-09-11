import React, { useState, useMemo } from "react";
import {
  Home, Package, Receipt, MessageSquareWarning, User, LogOut, Plus, X,
  ChevronRight, ChevronLeft, Check, MapPin, Phone, Clock, Truck,
  CheckCircle2, HelpCircle, Copy, Info, AlertCircle, Search, ShieldCheck,
  Bell, Landmark, Smartphone, History, CircleDashed, Zap, Users, Wallet,
  RotateCcw, XCircle, AlertTriangle,
} from "lucide-react";
import {
  LOGO_GASLARA, LOGO_LARA, EMPRESA, BANCOS, banco, CLIENTE_PORTAL, HOY,
  PRODUCTOS, SERVICIOS, cpt, cdtOf, comunaOf, montos, tpd, FASES, faseIdx, estadoSolicitud,
  estadoPago, reglaPago, motivoNoEntrega, bs, num, fecha, fechaLarga, mesCorto,
  estadoCuentaAbono, tipoAbono, aplicarSaldo, puedeSolicitar, validarCanje, envasesDe, etiquetaCiclo,
  cubiertoDe, faltanteDe, esPendienteDespacho, segmentoUsuario,
} from "./datos.jsx";
import { momentoCiudadano, estadoAD, marcaDe, tipoAD, tipoADInfo, adCerrada } from "./flujo.js";
import { VisorDocumento } from "./Documentos.jsx";
import {
  useFilasComuna, NAV_COMUNA, MiembrosComuna, RecepcionComuna, JornadasComuna,
} from "./PortalRolComuna.jsx";

const C = CLIENTE_PORTAL;
const COM = comunaOf(C.comuna);

/* Un pedido está vivo mientras todavía avanza. Culminado, abonado o con el pago rechazado
   ya no: no cuentan como pedido en curso ni en el contador de "Mis pedidos". */
const esVivo = (s) => !["CULMINADO", "ABONADA"].includes(s.estado) && s.pago?.estado !== "RECHAZADO";
const numId = (id) => Number(String(id).replace(/\D/g, "")) || 0;
// Las AD del flujo se numeran sin prefijo; las del histórico anterior traen "AD-".
const nombreAD = (ad) => (/^AD/i.test(String(ad)) ? String(ad) : `AD ${ad}`);
const rutaDe = (s, rutas) => (s?.rutaId ? rutas.find((r) => r.id === s.rutaId) || null : null);
/** El AD por el que pasa o pasó el pedido: el actual o el último de su historial. */
const adDe = (s) => s.ad || (s.historialAD || []).slice(-1)[0]?.ad || null;
/** El usuario escribe el monto como lo ve en su banco: con coma o con punto decimal. */
const aNumero = (t) => {
  const v = String(t ?? "").trim();
  if (!v) return NaN;
  return Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
};
const montoInicial = (n) => Number(n || 0).toFixed(2).replace(".", ",");

export default function PortalUsuario({
  solicitudes, reclamos, facturas, ciclo, crearSolicitud, completarPago, crearReclamo,
  saldos = {}, abonos = [], rutasDistribucion = [], parqueEnvases = [], padron,
}) {
  const rutas = rutasDistribucion;
  const saldo = Number(saldos[C.id] || 0);
  const misAbonos = useMemo(() => estadoCuentaAbono(abonos, C.id).reverse(), [abonos]);
  const [vista, setVista] = useState("inicio");
  /* PERMISOLOGÍA · el portal es uno solo; lo que cambia es qué puede ver quien entra.
     Un coordinador de comuna es un usuario más —con su contrato y su bombona— que
     además sigue la jornada de su comuna en el punto. Ese permiso le abre un grupo de
     secciones; sin él, no existen. El Portal Comuna dejó de ser una cara aparte el
     01/09/2026 porque nunca fue un sistema distinto. */
  const [rol, setRol] = useState("USUARIO");
  const esComuna = rol === "COMUNA";
  const filasComuna = useFilasComuna(solicitudes, rutas, padron);
  const [modal, setModal] = useState(null);
  const [doc, setDoc] = useState(null);
  const [toast, setToast] = useState(null);
  const aviso = (m) => { setToast(m); setTimeout(() => setToast(null), 3400); };

  // Del más reciente al más antiguo: lo nuevo entra primero al estado, pero la semilla no viene ordenada.
  const mis = useMemo(() => solicitudes.filter((s) => s.usuario === C.id)
    .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0) || numId(b.id) - numId(a.id)), [solicitudes]);
  const misRec = useMemo(() => reclamos.filter((r) => r.usuario === C.id), [reclamos]);
  // Las facturas del cierre de un AD y las de un servicio culminado en la O.A.U.: las dos son suyas.
  const misFac = useMemo(() => facturas.filter((f) => f.usuario === C.id && ["AUTOMATICA", "SERVICIO"].includes(f.origen)), [facturas]);
  const activos = mis.filter(esVivo);
  // El pedido que se destaca en Inicio: el que va más adelante en el flujo.
  const enCurso = ["EN_AD", "POR_REPLANIFICAR", "PAGADA", "POR_COMPLETAR", "SIN_PAGO"]
    .map((k) => activos.find((s) => s.estado === k)).find(Boolean) || null;
  // Los modales leen la versión viva del pedido: si se completa un pago, el cambio se ve al instante.
  const vivo = (s) => solicitudes.find((x) => x.id === s.id) || s;

  const nav = [
    { id: "inicio", label: "Inicio", icon: Home },
    { id: "pedidos", label: "Mis pedidos", icon: Package, badge: activos.length },
    { id: "saldo", label: "Mi saldo", icon: Wallet },
    { id: "seguimiento", label: "Seguimiento", icon: History },
    { id: "facturas", label: "Facturas", icon: Receipt },
    { id: "reclamos", label: "Reclamos", icon: MessageSquareWarning, badge: misRec.filter((r) => r.estado !== "RESUELTO").length },
    { id: "perfil", label: "Mi contrato", icon: User },
  ];
  const navTodo = [...nav, ...(esComuna ? NAV_COMUNA : [])];

  /* El pedido lo resuelve el núcleo: tope, saldo primero y regla de pago. Si lo rechaza, el
     asistente sigue abierto con el motivo; si entra, se muestra lo que realmente pasó. */
  const onNueva = (d) => {
    const res = crearSolicitud(d);
    if (res?.ok) setModal({ tipo: "listo", res });
    return res;
  };
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
        {/* El selector de rol es la permisología hecha visible: en producción vendría
            del perfil con que la persona inicia sesión, no de un desplegable. */}
        <label className="pu-rol">
          <span>Rol de acceso</span>
          <select value={rol} onChange={(e) => { setRol(e.target.value); setVista("inicio"); }}>
            <option value="USUARIO">Usuario del servicio</option>
            <option value="COMUNA">Coordinador de comuna</option>
          </select>
        </label>
        <nav>
          {nav.map((n) => (
            <button key={n.id} className={`nav-b ${vista === n.id ? "on" : ""}`} onClick={() => setVista(n.id)}>
              <n.icon size={18} /><span>{n.label}</span>{n.badge > 0 && <em className="nav-badge">{n.badge}</em>}
            </button>
          ))}
          {esComuna && (
            <>
              <div className="pu-nav-grupo">Mi comuna</div>
              {NAV_COMUNA.map((n) => (
                <button key={n.id} className={`nav-b ${vista === n.id ? "on" : ""}`} onClick={() => setVista(n.id)}>
                  <n.icon size={18} /><span>{n.label}</span>
                </button>
              ))}
            </>
          )}
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
            <h1>{vista === "inicio" ? `Hola, ${C.nombre.split(" ")[0]}` : (navTodo.find((n) => n.id === vista)?.label || "")}</h1>
          </div>
          <div className="top-r">
            <button className="icon-round" onClick={() => setModal("ayuda")}><Bell size={17} /></button>
            <button className="btn primary" onClick={() => setModal("solicitud")}><Plus size={16} strokeWidth={2.6} /> Pedir gas</button>
          </div>
        </header>

        <div className="body">
          {vista === "inicio" && <Inicio {...{ mis, activos, enCurso, ciclo, setModal, setVista, misFac, saldo, rutas }} />}
          {vista === "saldo" && <MiSaldo saldo={saldo} movimientos={misAbonos} setModal={setModal} />}
          {vista === "pedidos" && <Pedidos mis={mis} rutas={rutas} setModal={setModal} />}
          {vista === "seguimiento" && <SeguimientoUsuario mis={mis} enCurso={enCurso} rutas={rutas} setModal={setModal} />}
          {vista === "facturas" && <Facturas mis={mis} misFac={misFac} setDoc={setDoc} setModal={setModal} />}
          {vista === "reclamos" && <Reclamos misRec={misRec} setModal={setModal} />}
          {vista === "perfil" && <Perfil mis={mis} ciclo={ciclo} />}

          {/* Las secciones que abre el rol de comuna. Sin el permiso no se renderizan. */}
          {esComuna && vista === "com-miembros" && <MiembrosComuna filas={filasComuna} />}
          {esComuna && vista === "com-recepcion" && <RecepcionComuna filas={filasComuna} solicitudes={solicitudes} rutas={rutas} />}
          {esComuna && vista === "com-jornadas" && <JornadasComuna filas={filasComuna} solicitudes={solicitudes} rutas={rutas} />}
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

      {modal === "solicitud" && <Wizard onClose={() => setModal(null)} onSave={onNueva} aviso={aviso} saldo={saldo}
        solicitudes={solicitudes} parque={parqueEnvases} />}
      {modal === "reclamo" && <ModalReclamo mis={mis} onClose={() => setModal(null)} onSave={onReclamo} />}
      {modal === "ayuda" && <ModalAyuda onClose={() => setModal(null)} aviso={aviso} />}
      {modal?.tipo === "detalle" && <DetallePedido s={vivo(modal.s)} rutas={rutas} onClose={() => setModal(null)}
        setDoc={setDoc} facturas={facturas} setModal={setModal} />}
      {modal?.tipo === "reclamo-det" && <DetalleReclamo r={modal.r} onClose={() => setModal(null)} />}
      {modal?.tipo === "listo" && <ModalListo res={modal.res} setModal={setModal}
        onClose={() => { setModal(null); setVista("pedidos"); }} />}
      {modal?.tipo === "completar" && <ModalCompletar s={vivo(modal.s)} saldo={saldo} completarPago={completarPago}
        aviso={aviso} onClose={() => setModal(null)} />}
      {doc && <VisorDocumento doc={doc} onClose={() => setDoc(null)} />}
      {toast && <div className="toast"><CheckCircle2 size={17} /> {toast}</div>}
    </div>
  );
}


/* ═══════════  INICIO  ═══════════ */

function MiSaldo({ saldo, movimientos, setModal }) {
  return (
    <>
      <style>{`
.pu-saldo{background:linear-gradient(135deg,#12291F,#1E7A4C);color:#fff;border-radius:20px;padding:26px 28px;display:flex;justify-content:space-between;gap:26px;align-items:center;flex-wrap:wrap}
.pu-saldo-l small{font-size:11.5px;color:#B6D6C6;display:block}
.pu-saldo-l b{display:block;font-size:44px;letter-spacing:-1.4px;margin:6px 0 4px}
.pu-saldo-l span{font-size:12.5px;color:#CFE4D9}
.pu-saldo-r{background:#ffffff1a;border:1px solid #ffffff33;border-radius:14px;padding:16px 18px;max-width:380px}
.pu-saldo-r p{margin:0;font-size:12px;line-height:1.6;color:#E2F0E9}
.pu-mov{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:14px 0;border-bottom:1px solid var(--line-2)}
.pu-mov:last-child{border-bottom:0}
.pu-mov-t b{display:block;font-size:14px}
.pu-mov-t span{display:block;font-size:12px;color:var(--ink-3);margin-top:3px;line-height:1.4}
.pu-mov-r{text-align:right;white-space:nowrap}
.pu-mov-r b{display:block;font-size:15px}
.pu-mov-r b.mas{color:var(--verde)}
.pu-mov-r b.menos{color:var(--rojo)}
.pu-mov-r b.anulado{color:var(--ink-3);text-decoration:line-through}
.pu-mov-r span{display:block;font-size:11.5px;color:var(--ink-3);margin-top:2px}
      `}</style>
      <section className="pu-saldo">
        <div className="pu-saldo-l">
          <small>Dinero disponible en tu código</small>
          <b>Bs {bs(saldo)}</b>
          <span>{saldo > 0 ? "Se descuenta solo en tu próximo pedido." : "No tienes saldo a favor en este momento."}</span>
        </div>
        <div className="pu-saldo-r">
          <p>Tu saldo a favor nace cuando <b>transfieres más de lo necesario</b>, cuando <b>cancelas o desistes</b> de
             un pedido, o cuando un problema de tu pedido <b>no se pudo replanificar antes del cierre del ciclo</b>.
             Se descuenta solo en tu próximo pedido y para cubrir una diferencia de tarifa.</p>
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h2>Movimientos de tu saldo</h2><span className="card-note">{movimientos.length} registros</span></div>
        <div>
          {movimientos.map((m) => {
            const t = tipoAbono(m.tipo);
            // Un movimiento anulado se conserva en el estado de cuenta, pero ni suma ni resta.
            const clase = m.anulado ? "anulado" : m.signo > 0 ? "mas" : "menos";
            return (
              <div className="pu-mov" key={m.id}>
                <div className="pu-mov-t">
                  <b>{t.nombre}{m.anulado ? " · anulado" : ""}</b>
                  <span>{fecha(m.fecha)} · {m.detalle || t.desc}</span>
                </div>
                <div className="pu-mov-r">
                  <b className={clase}>{m.anulado ? "" : m.signo > 0 ? "+ " : "− "}Bs {bs(m.monto)}</b>
                  <span>{m.anulado ? "no afecta tu saldo" : `saldo Bs ${bs(m.saldoResultante)}`}</span>
                </div>
              </div>
            );
          })}
          {!movimientos.length && <div className="vacio"><Wallet size={30} /><p>Todavía no tienes movimientos de saldo.</p></div>}
        </div>
      </section>

      <div className="aviso-pago"><Info size={15} />
        <p>Tu saldo se guarda en <b>bolívares</b> y se descuenta contra el precio vigente: si abonaste Bs 1.300 cuando
           la bombona costaba Bs 1.700 y vuelves cuando cuesta Bs 2.600, se descuentan tus Bs 1.300 y transfieres el
           resto. <b>No se devuelve en efectivo</b>: no vence, no se pierde y queda a tu nombre hasta que se aplique.</p></div>

      <button className="btn primary lg" onClick={() => setModal("solicitud")} style={{ marginTop: 16 }}>
        <Plus size={17} strokeWidth={2.6} /> Usar mi saldo en un pedido
      </button>
    </>
  );
}

function Inicio({ mis, activos, enCurso, ciclo, setModal, setVista, misFac, saldo = 0, rutas }) {
  const cerca = ciclo && ciclo.restantes <= 6;
  const pasado = ciclo && ciclo.restantes < 0;
  // Otros pedidos que esperan que el usuario complete el pago, además del que se destaca.
  const porCompletar = activos.filter((s) => s.estado === "POR_COMPLETAR" && s.id !== enCurso?.id);

  return (
    <>
      {saldo > 0 && (
        <button className="acceso verde" style={{ width: "100%", marginBottom: 16 }} onClick={() => setVista("saldo")}>
          <div className="acc-ico"><Wallet size={20} /></div>
          <div className="acc-txt">
            <b>Tienes Bs {bs(saldo)} a favor</b>
            <span>Se descuentan solos en tu próximo pedido. Toca para ver el detalle.</span>
          </div>
          <ChevronRight size={17} className="acc-arrow" />
        </button>
      )}

      {porCompletar.map((s) => (
        <section className="alerta" key={s.id}>
          <div className="alerta-ico"><Wallet size={20} /></div>
          <div className="alerta-txt"><b>Falta completar el pago de {s.id}</b><span>{momentoCiudadano(s, rutas).detalle}</span></div>
          <button className="btn primary" onClick={() => setModal({ tipo: "completar", s })}>Completar pago</button>
        </section>
      ))}

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
            <div className="card-acc">
              {enCurso.estado === "POR_COMPLETAR" && (
                <button className="btn sm primary" onClick={() => setModal({ tipo: "completar", s: enCurso })}><Wallet size={14} /> Completar pago</button>
              )}
              <button className="link" onClick={() => setModal({ tipo: "detalle", s: enCurso })}>Ver detalle <ChevronRight size={14} /></button>
            </div>
          </div>
          <Tracker s={enCurso} rutas={rutas} />
          <CursoInfo s={enCurso} rutas={rutas} />
        </section>
      )}

      <div className="acc-grid">
        <Acceso icon={Truck} titulo="Pedir gas" desc="Pagas primero, despachamos después" onClick={() => setModal("solicitud")} tono="verde" />
        <Acceso icon={Receipt} titulo="Mis facturas" desc={`${misFac.length} documentos disponibles`} onClick={() => setVista("facturas")} tono="azul" />
        <Acceso icon={MessageSquareWarning} titulo="Reportar un problema" desc="Fuga, demora o cilindro dañado" onClick={() => setModal("reclamo")} tono="naranja" />
        <Acceso icon={Landmark} titulo="Cuentas para pagar" desc={`${BANCOS.length} bancos disponibles`} onClick={() => setModal("ayuda")} tono="gris" />
      </div>

      <section className="card">
        <div className="card-h">
          <h2>Movimientos recientes</h2>
          <button className="link" onClick={() => setVista("pedidos")}>Ver todos <ChevronRight size={14} /></button>
        </div>
        <div className="lista">
          {mis.slice(0, 4).map((s) => (
            <button className="lista-row" key={s.id} onClick={() => setModal({ tipo: "detalle", s })}>
              <div className={`lr-ico ${tonoIcono(s)}`}><Package size={16} /></div>
              <div className="lr-txt"><b>{cpt(s.concepto).corto}{s.cantidad > 1 ? ` × ${s.cantidad}` : ""}</b><span>{s.id} · {mesCorto(s.fecha)}</span></div>
              <div className="lr-r"><b>Bs {bs(s.total)}</b><EstadoChip s={s} /></div>
              <ChevronRight size={16} className="lr-arrow" />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

/** Lo pagado sale de la solicitud (`cubiertoDe`): lo transferido más el saldo aplicado, sin el
 *  excedente que ya pasó al saldo a favor. */
const textoPagado = (s) => {
  if (!tpd(s.tipoDespacho).requierePago) return "No requiere pago";
  if (s.pago?.estado === "RECHAZADO") return "Sin pago aplicado";
  if (s.estado === "ABONADA") return `Bs ${bs(s.abonadoBs || 0)} pasaron a tu saldo`;
  const falta = faltanteDe(s);
  return falta > 0.009 ? `Bs ${bs(cubiertoDe(s))} · faltan Bs ${bs(falta)}` : `Bs ${bs(cubiertoDe(s))}`;
};

/** Los cuatro datos del pedido que el usuario consulta de un vistazo. */
function CursoInfo({ s, rutas }) {
  const c = cpt(s.concepto);
  const r = s.estado === "EN_AD" ? rutaDe(s, rutas) : null;
  const esp = Boolean(r) && tipoAD(r) === "ESPECIAL";
  const jornada = !c.bombona ? "Te contactamos para coordinar"
    : r ? `AD ${r.ad} · ${fecha(r.fechaJornada || r.fechaPlan)}`
    : s.estado === "POR_REPLANIFICAR" ? `Ruta especial antes del ${fecha(s.problema?.plazo)}`
    : s.estado === "POR_COMPLETAR" ? "Al completar el pago"
    : "Se fija al planificar el AD";
  return (
    <div className="curso-info">
      <div><span>Producto</span><b>{c.corto}{s.cantidad > 1 ? ` × ${num(s.cantidad)}` : ""}</b></div>
      <div><span>{!c.bombona ? "Atención" : esp ? "Entrega" : "Punto comunal"}</span>
        <b>{!c.bombona ? cdtOf(s.cdt || C.cdt).nombre : esp ? "Ruta especial por domicilio" : COM.punto}</b></div>
      <div><span>{c.bombona ? "Jornada" : "Fecha"}</span><b>{jornada}</b></div>
      <div><span>Pagado</span><b>{textoPagado(s)}</b></div>
    </div>
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

/* Un ícono por peldaño, por su clave: si FASES cambia, ningún paso queda sin ícono.
   (Un ícono indefinido tumbaba la pantalla entera en la ayuda y en un pedido culminado.) */
const ICONOS_FASE = { SIN_PAGO: Clock, PAGADA: ShieldCheck, EN_AD: Truck, CULMINADO: CheckCircle2 };
const iconoFase = (k) => ICONOS_FASE[k] || CircleDashed;
const ICONOS_LATERAL = { POR_COMPLETAR: Wallet, POR_REPLANIFICAR: RotateCcw, ABONADA: Wallet, RECHAZADO: XCircle };
const TONO_LATERAL = { POR_COMPLETAR: "ambar", POR_REPLANIFICAR: "ambar", ABONADA: "gris", RECHAZADO: "rojo" };

/**
 * La escalera del ciudadano. Los estados laterales —por completar, por replanificar,
 * abonada, pago rechazado— no son un peldaño: se muestran como aviso con lo que pasó y lo
 * que sigue, en vez de una escalera vacía. En jornada, el peldaño dice el momento real del AD.
 */
function Tracker({ s, rutas = [], compacto }) {
  const m = momentoCiudadano(s, rutas);
  if (m.lateral) {
    const Ico = ICONOS_LATERAL[m.lateral] || AlertCircle;
    return (
      <div className={`lat ${TONO_LATERAL[m.lateral] || "gris"} ${compacto ? "mini" : ""}`}>
        <Ico size={compacto ? 15 : 18} />
        <div><b>{m.titulo}</b><span>{m.detalle}</span></div>
      </div>
    );
  }
  const idx = faseIdx(s.estado);
  return (
    <>
      <div className={`track ${compacto ? "mini" : ""}`}>
        {FASES.map((f, i) => {
          const Ico = iconoFase(f.key), on = i <= idx, act = i === idx;
          return (
            <div className={`tr-step ${on ? "on" : ""} ${act ? "act" : ""}`} key={f.key}>
              <div className="tr-top">
                <div className="tr-dot">{on ? <Ico size={13} strokeWidth={2.6} /> : <span className="tr-n">{i + 1}</span>}</div>
                {i < FASES.length - 1 && <div className="tr-line" />}
              </div>
              <div className="tr-txt"><b>{f.paso || f.cliente}</b>{!compacto && (
                <span>{act && m.titulo !== (f.paso || f.cliente) ? <><em>{m.titulo}</em> {m.detalle}</> : act ? m.detalle : f.pasoDesc || f.clienteDesc}</span>
              )}</div>
            </div>
          );
        })}
      </div>
      {compacto && m.momentoAD && <div className="tr-momento"><Truck size={12} /> {m.titulo}</div>}
    </>
  );
}

const CHIP_TONO = { verde: "c-ok", azul: "c-act", ambar: "c-warn", gris: "c-gris", rojo: "c-bad" };
const ICO_TONO = { verde: "ok", azul: "act", ambar: "warn", gris: "", rojo: "bad" };
/** La etiqueta es la del núcleo (`estadoSolicitud().cliente`); el pago rechazado se nombra aparte
 *  porque su estado (sin pago) no dice por qué quedó así. */
const EstadoChip = ({ s }) => {
  if (s.pago?.estado === "RECHAZADO") return <span className="chip c-bad">Pago rechazado</span>;
  // «Lista en tu punto» es de las bombonas: un servicio se presta y el granel se despacha.
  if (s.estado === "CULMINADO" && !cpt(s.concepto).bombona) {
    return <span className="chip c-ok">{cpt(s.concepto).inv ? "Despachado" : "Servicio prestado"}</span>;
  }
  const e = estadoSolicitud(s.estado);
  return <span className={`chip ${CHIP_TONO[e.tono] || ""}`}>{e.cliente}</span>;
};
const tonoIcono = (s) => (s.pago?.estado === "RECHAZADO" ? "bad" : ICO_TONO[estadoSolicitud(s.estado).tono] || "");


/* ═══════════  PEDIDOS  ═══════════ */

function Pedidos({ mis, rutas, setModal }) {
  const [f, setF] = useState("TODOS");
  const [q, setQ] = useState("");
  const lista = mis.filter((s) => {
    const okF = f === "TODOS" || (f === "ACTIVOS" ? esVivo(s) : !esVivo(s));
    const okQ = !q || s.id.toLowerCase().includes(q.toLowerCase()) || cpt(s.concepto).nombre.toLowerCase().includes(q.toLowerCase());
    return okF && okQ;
  });
  const abrir = (s) => setModal({ tipo: "detalle", s });
  return (
    <>
      <div className="filtros">
        <div className="tabs">
          {[["TODOS", "Todos"], ["ACTIVOS", "En curso"], ["CERRADOS", "Cerrados"]].map(([k, l]) => (
            <button key={k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}</button>
          ))}
        </div>
        <div className="search"><Search size={15} /><input placeholder="Buscar pedido" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="pedidos-grid">
        {lista.map((s) => (
          // Tarjeta y no botón: dentro va la acción de completar el pago, y un botón no puede contener otro.
          <div className={`ped ${esVivo(s) ? "activo" : ""}`} key={s.id} role="button" tabIndex={0} onClick={() => abrir(s)}
            onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrir(s); } }}>
            <div className="ped-h">
              <div><div className="ped-id">{s.id}</div><div className="ped-fecha">{fechaLarga(s.fecha)}</div></div>
              <EstadoChip s={s} />
            </div>
            <div className="ped-prod">
              <div className="ped-ico"><Package size={18} /></div>
              <div><b>{cpt(s.concepto).corto}</b><span>{cpt(s.concepto).sub}{s.cantidad > 1 ? ` · ${s.cantidad}` : ""}</span></div>
            </div>
            {s.estado !== "CULMINADO" && <Tracker s={s} rutas={rutas} compacto />}
            {s.estado === "POR_COMPLETAR" && (
              <button className="btn sm primary ped-acc" onClick={(e) => { e.stopPropagation(); setModal({ tipo: "completar", s }); }}>
                <Wallet size={14} /> Completar pago · faltan Bs {bs(faltanteDe(s))}
              </button>
            )}
            <div className="ped-f">
              <div className="ped-docs">
                {s.pago?.referencia && <span>Ref. {s.pago.referencia}</span>}
                {adDe(s) && <span>{nombreAD(adDe(s))}</span>}
                {s.serie && <span>{s.serie}</span>}
              </div>
              <div className="ped-tot">Bs {bs(s.total)}</div>
            </div>
          </div>
        ))}
      </div>
      {!lista.length && <div className="vacio"><Package size={30} /><p>No hay pedidos con estos filtros.</p></div>}
    </>
  );
}

const RESULTADO_AD = {
  ENTREGADA: "Devuelta llena al punto", NO_RECOGIDA: "No se recogió", NO_LLENADA: "Volvió vacía",
  SALIO_POR_TARIFA: "Salió del AD por la tarifa nueva",
};
const TONO_PAGO = { VERIFICADO: "c-ok", INCOMPLETO: "c-warn", RECHAZADO: "c-bad" };

function DetallePedido({ s, rutas, onClose, setDoc, facturas, setModal }) {
  const c = cpt(s.concepto);
  const p = s.pago || {};
  const bk = p.banco ? banco(p.banco) : null;
  const fac = facturas.find((f) => f.sol === s.id);
  const r = s.estado === "EN_AD" ? rutaDe(s, rutas) : null;
  const esp = Boolean(r) && tipoAD(r) === "ESPECIAL";
  const mk = r ? marcaDe(r, s.id) : {};
  const j = r?.jornada || {};
  const falta = faltanteDe(s);
  const requiere = tpd(s.tipoDespacho).requierePago;
  const rechazado = p.estado === "RECHAZADO";
  const transferido = s.montoTransferido ?? p.montoRecibido ?? 0;
  const problema = s.estado === "POR_REPLANIFICAR" ? s.problema || {} : null;
  const inc = s.incidencia;
  const historial = s.historialAD || [];
  const verFactura = () => { onClose(); setDoc({ tipo: "factura", data: fac }); };

  const jornada = !c.bombona ? ["Atención", s.estado === "CULMINADO" ? fecha(s.entrega) : "Te contactamos para coordinar"]
    : s.estado === "CULMINADO" ? ["Devuelta llena al punto", fecha(s.entrega)]
    : r ? ["Jornada", `AD ${r.ad} · ${fecha(r.fechaJornada || r.fechaPlan)}`]
    : problema ? ["Plazo para replanificar", fecha(problema.plazo)]
    : esVivo(s) ? ["Jornada", "Se fija al planificar el AD"] : ["Jornada", "—"];
  const [lblTotal, valTotal] = rechazado ? ["Pago aplicado", "Bs 0,00"]
    : s.estado === "ABONADA" ? ["Pasó a tu saldo", `Bs ${bs(s.abonadoBs || 0)}`]
    : !requiere ? ["A pagar", "No requiere pago"]
    : falta > 0.009 ? ["Falta por pagar", `Bs ${bs(falta)}`]
    : ["Total pagado", `Bs ${bs(cubiertoDe(s))}`];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="hoja-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hm-h">
          <div><div className="hm-eyebrow">Pedido</div><h3>{s.id}</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={19} /></button>
        </div>
        <div className="hm-b">
          <Tracker s={s} rutas={rutas} />
          <div className="det-grid">
            <div><span>Producto</span><b>{c.nombre}</b></div>
            <div><span>Cantidad</span><b>{num(s.cantidad)} {c.unidad}</b></div>
            <div><span>Solicitado</span><b>{fecha(s.fecha)}</b></div>
            <div><span>{jornada[0]}</span><b>{jornada[1]}</b></div>
            {c.bombona
              ? <div className="w2"><span>{esp ? "Entrega" : "Punto comunal"}</span><b>{esp ? `Ruta especial por domicilio · ${C.dir}` : `${COM.punto} · ${COM.nombre}`}</b></div>
              : <div className="w2"><span>Centro</span><b>{cdtOf(s.cdt).nombre}</b></div>}
            {c.bombona && <div><span>Unidad</span><b>{r ? `${r.unidad} · ${r.conductor}` : s.estado === "CULMINADO" ? s.unidad || "—" : "Por asignar"}</b></div>}
            {c.bombona && <div><span>Centro</span><b>{cdtOf(s.cdt).nombre}</b></div>}
            {s.nota && <div className="w2"><span>Nota</span><b>{s.nota}</b></div>}
          </div>

          {(r || historial.length > 0) && (
            <div className="det-docs">
              <div className="det-lbl">Tu jornada</div>
              {r && <>
                <div className="dd-row"><span>AD</span><b>{r.ad} · {tipoADInfo(r).nombre}</b></div>
                <div className="dd-row"><span>Momento</span><b>{estadoAD(r.estadoRuta).nombre}</b></div>
                <div className="dd-row"><span>Recolección</span><b>{mk.recogida === false ? `No se recogió · ${motivoNoEntrega(mk.motivo).nombre}`
                  : j.recoleccion ? `Recogida · ${fecha(j.recoleccion.fecha)} ${j.recoleccion.hora || ""}` : `Pendiente · ${fecha(r.fechaJornada)}`}</b></div>
                {mk.recogida !== false && <div className="dd-row"><span>Llenado</span><b>{mk.llenada === false ? `Volvió vacía · ${motivoNoEntrega(mk.motivo).nombre}`
                  : j.llenado ? `Llenada · ${fecha(j.llenado.fecha)} ${j.llenado.hora || ""}` : "Pendiente"}</b></div>}
                {j.devolucion && mk.recogida !== false && <div className="dd-row"><span>{esp ? "Devolución" : "Devuelta al punto"}</span>
                  <b>{fecha(j.devolucion.fecha)} {j.devolucion.hora || ""}</b></div>}
              </>}
              {historial.map((h, i) => (
                <div className="dd-row" key={`${h.rutaId}-${i}`}><span>AD {h.ad} · {fecha(h.fecha)}</span>
                  <b>{RESULTADO_AD[h.resultado] || h.resultado}{h.motivo ? ` · ${motivoNoEntrega(h.motivo).nombre}` : ""}</b></div>
              ))}
            </div>
          )}

          {problema && (
            <div className="det-docs warn">
              <div className="det-lbl">Por qué se reprograma</div>
              <div className="dd-row"><span>Motivo</span><b>{problema.nombre || "—"}</b></div>
              {problema.adOrigen && <div className="dd-row"><span>AD de origen</span><b>{problema.adOrigen}</b></div>}
              <div className="dd-row"><span>Plazo</span><b>{fecha(problema.plazo)}</b></div>
              <div className="dd-row"><span>Responsable</span><b>{problema.imputable === "EMPRESA" ? "GasLara · se atiende con prioridad" : "Usuario"}</b></div>
              {problema.nota && <div className="dd-row"><span>Observación</span><b>{problema.nota}</b></div>}
              <p className="det-p">Tu pedido sigue vivo y tu dinero sigue aplicado. Si el plazo vence sin replanificar, el monto pasa a tu saldo a favor.</p>
            </div>
          )}

          {s.estado === "ABONADA" && (
            <div className="det-docs">
              <div className="det-lbl">Cerrado con saldo a favor</div>
              <div className="dd-row"><span>Motivo</span><b>{s.motivoNoCompra || "—"}</b></div>
              <div className="dd-row"><span>Pasó a tu saldo</span><b>Bs {bs(s.abonadoBs || 0)}</b></div>
              <div className="dd-row"><span>Fecha</span><b>{fecha(s.fechaAbono)}</b></div>
              {s.decisionAbono?.nota && <div className="dd-row"><span>Nota</span><b>{s.decisionAbono.nota}</b></div>}
            </div>
          )}

          {inc && (
            <div className={`det-docs ${inc.consecuencia === "RETIENE" ? "warn" : ""}`}>
              <div className="det-lbl">Constancia de GasLara</div>
              <div className="dd-row"><span>Incidencia</span><b>{inc.nombre}</b></div>
              <div className="dd-row"><span>Consecuencia</span><b>{inc.consecuencia === "RETIENE" ? "Tu pedido sigue vivo y se reprograma" : "El pedido se cerró"}</b></div>
              <div className="dd-row"><span>Registró</span><b>{inc.por} · {fecha(inc.en)}</b></div>
              {inc.nota && <div className="dd-row"><span>Nota</span><b>{inc.nota}</b></div>}
            </div>
          )}

          <div className="det-docs">
            <div className="det-lbl">Tu pago</div>
            {!requiere ? <div className="dd-row"><span>Pago</span><b>No requiere pago · {tpd(s.tipoDespacho).nombre}</b></div> : <>
              <div className="dd-row"><span>Regla aplicada</span><b>{p.regla ? reglaPago(p.regla).nombre : "—"}</b></div>
              {p.detalleRegla && <div className="dd-row"><span>Resultado</span><b>{p.detalleRegla}</b></div>}
              <div className="dd-row"><span>Banco</span><b>{bk ? bk.nombre : transferido > 0 ? "—" : "No hizo falta transferir"}</b></div>
              <div className="dd-row"><span>Referencia</span><b>{p.referencia || "—"}</b></div>
              <div className="dd-row"><span>Fecha</span><b>{fecha(p.fecha)}</b></div>
              <div className="dd-row"><span>Transferiste</span><b>Bs {bs(transferido)}</b></div>
              {Number(s.saldoAplicado) > 0 && <div className="dd-row"><span>Saldo a favor aplicado</span><b>Bs {bs(s.saldoAplicado)}</b></div>}
              {(p.complementos || []).map((x, i) => (
                <div className="dd-row" key={`${x.referencia}-${i}`}><span>Complemento · Ref. {x.referencia || "—"} · {fecha(x.fecha)}</span><b>Bs {bs(x.monto)}</b></div>
              ))}
              {s.tarifaAnterior && <div className="dd-row"><span>Tarifa anterior → vigente</span><b>Bs {bs(s.tarifaAnterior.total)} → Bs {bs(s.total)}</b></div>}
              {p.revertida && <div className="dd-row"><span>Revertida</span><b>{p.revertidaPor} · {fecha(p.revertidaEn)}{p.notaReversion ? ` · ${p.notaReversion}` : ""}</b></div>}
              <div className="dd-row"><span>Estatus</span>
                {p.estado === "VERIFICADO"
                  ? <span className="chip c-ok"><Zap size={10} /> Verificado automáticamente</span>
                  : <span className={`chip ${TONO_PAGO[p.estado] || "c-gris"}`}>{estadoPago(p.estado).nombre}</span>}</div>
            </>}
          </div>

          <div className="det-docs">
            <div className="det-lbl">Documentos del sistema</div>
            <div className="dd-row"><span>Pedido Nro</span><b>P{s.pedidoNro}</b></div>
            <div className="dd-row"><span>Atención de distribución</span><b>{adDe(s) ? nombreAD(adDe(s)) : "—"}</b></div>
            <div className="dd-row"><span>Boleta de operación</span><b>{s.boleta || "—"}</b></div>
            <div className="dd-row"><span>Factura</span>
              {fac ? <button className="link" onClick={verFactura}>{s.serie} <ChevronRight size={13} /></button> : <b>—</b>}
            </div>
          </div>

          <div className="det-tot">
            <div><span>Subtotal</span><b>Bs {bs(s.base)}</b></div>
            <div><span>IVA</span><b>{s.exento ? "Exonerado" : `Bs ${bs(s.iva)}`}</b></div>
            <div><span>Total del pedido</span><b>Bs {bs(s.total)}</b></div>
            <div className="big"><span>{lblTotal}</span><b>{valTotal}</b></div>
          </div>
        </div>
        <div className="hm-f">
          <button className="btn" onClick={onClose}>Cerrar</button>
          {s.estado === "POR_COMPLETAR" && <button className="btn primary" onClick={() => setModal({ tipo: "completar", s })}><Wallet size={15} /> Completar pago</button>}
          {fac && <button className="btn primary" onClick={verFactura}>Ver factura</button>}
        </div>
      </div>
    </div>
  );
}


/* ═══════════  SEGUIMIENTO  ═══════════ */

/** Los momentos de un AD para esta persona. `h` es su entrada del historial si el AD ya
 *  cerró para ella; sin `h` es el AD en que está convocada ahora. */
function pasosDeAD(paso, s, r, h) {
  if (!r) {
    if (h) paso(`AD ${h.ad}`, `${RESULTADO_AD[h.resultado] || h.resultado}${h.motivo ? ` · ${motivoNoEntrega(h.motivo).nombre}` : ""}`,
      h.resultado === "ENTREGADA" ? "ok" : "mal", h.fecha);
    return;
  }
  if (h?.resultado === "SALIO_POR_TARIFA") {
    paso(`Salió del AD ${h.ad}`, "La tarifa subió antes de la salida y faltó cubrir la diferencia", "warn", h.fecha);
    return;
  }
  const actual = !h;
  const esp = tipoAD(r) === "ESPECIAL";
  const enLugar = esp ? "en tu domicilio" : "en el punto";
  const e = estadoAD(r.estadoRuta).id;
  const j = r.jornada || {};
  // Para un AD ya cerrado manda su entrada del historial; para el actual, lo marcado en la jornada.
  const mk = h
    ? { recogida: h.resultado !== "NO_RECOGIDA", llenada: h.resultado === "NO_LLENADA" ? false : h.resultado === "ENTREGADA" ? true : undefined,
        motivo: h.motivo, observacion: marcaDe(r, s.id).observacion || null }
    : marcaDe(r, s.id);
  const obs = (x) => `${motivoNoEntrega(x.motivo).nombre}${x.observacion ? ` · ${x.observacion}` : ""}`;
  paso(`AD ${r.ad} planificada`, `${tipoADInfo(r).nombre} · jornada el ${fecha(r.fechaJornada || r.fechaPlan)}`, "ok", r.fechaPlan);
  if (actual && e === "INCIDENCIA") { paso(`AD ${r.ad} con incidencia`, "Distribución te informa la nueva fecha", "warn"); return; }

  if (j.recoleccion) {
    if (mk.recogida === false) {
      paso(`No se recogió ${enLugar}`, obs(mk), "mal", j.recoleccion.fecha, j.recoleccion.hora);
      if (actual) paso("Se reprograma al cerrar el AD", "Distribución te asigna una ruta especial", "act");
      else paso(`AD ${r.ad} cerrada`, "Tu pedido pasó a replanificación", "warn", r.cerradaEn || h.fecha, r.horaCierre);
      return;
    }
    paso(`Recogida ${enLugar}`, "Tu bombona vacía entró a la jornada", "ok", j.recoleccion.fecha, j.recoleccion.hora);
  } else if (e === "EN_RUTA") {
    paso("Recolección en curso", `La unidad ${r.unidad} está recogiendo ${enLugar}`, "act", r.fechaSalida, r.horaSalida);
  } else {
    paso("Recolección", esp ? `Ten tu bombona vacía lista en tu domicilio el ${fecha(r.fechaJornada || r.fechaPlan)}`
      : `Lleva tu bombona vacía a ${COM.punto} el ${fecha(r.fechaJornada || r.fechaPlan)}`, "act");
  }

  if (j.llenado) {
    if (mk.llenada === false) paso("No se pudo llenar", obs(mk), "mal", j.llenado.fecha, j.llenado.hora);
    else paso("Llenada en planta", "Tu bombona se llenó", "ok", j.llenado.fecha, j.llenado.hora);
  } else if (e === "EN_PLANTA") paso("En planta · llenado", "Se está llenando; vuelve al mismo punto", "act");
  else paso("Llenado en planta", "Las bombonas malas no se llenan: vuelven vacías", "pend");

  // El último hito: la bombona de vuelta. Aquí termina la responsabilidad de GasLara.
  const vacia = mk.llenada === false;
  const titulo = vacia ? `Volvió vacía ${esp ? "a tu domicilio" : "al punto"}` : esp ? "Devuelta llena en tu domicilio" : "Devuelta llena al punto · lista para retirar";
  if (j.devolucion) {
    const cierre = adCerrada(r)
      ? `AD cerrada el ${fecha(r.cerradaEn)}${r.horaCierre ? ` · ${r.horaCierre}` : ""}${!vacia && s.factura ? ` · factura ${s.factura}` : ""}`
      : vacia ? "Se reprograma al cerrar el AD" : "La factura sale al cerrar el AD";
    paso(titulo, cierre, vacia ? "mal" : "ok", j.devolucion.fecha, j.devolucion.hora);
  } else paso(titulo, "La factura sale al cerrar el AD", "pend");
}

/**
 * LÍNEA DE TIEMPO REAL de un pedido: cada hito sale de la solicitud y de sus AD (pago,
 * planificación, recolección, llenado, devolución y cierre), nunca de horas escritas a mano.
 * Termina cuando la bombona vuelve al punto: ahí acaba la responsabilidad de GasLara, así
 * que no hay un paso de "retirado".
 * estado: "ok" hecho · "act" en curso · "warn" requiere algo · "mal" no se pudo · "pend" pendiente.
 */
function lineaDeTiempo(s, rutas = []) {
  const pasos = [];
  const paso = (titulo, detalle, estado, f = null, hora = null) => pasos.push({ titulo, detalle, estado, fecha: f, hora });
  const c = cpt(s.concepto);
  const p = s.pago || {};
  const m = momentoCiudadano(s, rutas);
  paso("Pedido registrado", `${s.id} · ${c.corto}${s.cantidad > 1 ? ` × ${num(s.cantidad)}` : ""}`, "ok", s.fecha, s.horaPedido);

  // El pago, tal como lo resolvió la regla automática, y lo que se le sumó después.
  const transferido = s.montoTransferido ?? p.montoRecibido ?? 0;
  const conQue = transferido > 0 ? `Ref. ${p.referencia || "—"} · transferiste Bs ${bs(transferido)}` : "Cubierto con tu saldo a favor";
  if (!tpd(s.tipoDespacho).requierePago) paso("No requiere pago", tpd(s.tipoDespacho).nombre, "ok", p.fecha || s.fecha);
  else if (p.estado === "RECHAZADO") paso("Pago rechazado", p.detalleRegla || "La referencia no se pudo validar", "mal", p.resueltoEn || p.fecha);
  else if (p.regla === "MONTO_MENOR") paso("Pago recibido · incompleto", conQue, "warn", p.resueltoEn || p.fecha);
  else if (p.regla) paso(`Pago verificado · ${reglaPago(p.regla).nombre}`, conQue, "ok", p.resueltoEn || p.fecha);
  else paso("Esperando tu pago", estadoSolicitud("SIN_PAGO").clienteDesc, "act");
  (p.complementos || []).forEach((x) => paso("Pago complementario", `Ref. ${x.referencia || "—"} · Bs ${bs(x.monto)}`, "ok", x.fecha));
  if (s.tarifaPendiente) paso("La tarifa cambió", "El precio vigente subió mientras tu pedido esperaba", "warn", s.tarifaPendiente.desde);
  if (s.incidencia?.consecuencia === "RETIENE") paso(`Constancia · ${s.incidencia.nombre}`, s.incidencia.nota || "Tu pedido sigue vivo y se reprograma", "warn", s.incidencia.en);
  if (p.estado === "RECHAZADO") return pasos;

  if (!c.bombona) {
    // Servicios y granel no pasan por la jornada comunal.
    if (s.estado === "CULMINADO") paso(s.servicio ? "Servicio prestado" : "Atendido", s.servicio?.atendio ? `Atendió ${s.servicio.atendio}` : cdtOf(s.cdt).nombre, "ok", s.servicio?.en || s.entrega);
    else if (s.estado === "PAGADA") paso("Por atender", "Te contactamos para coordinar", "act");
    if (s.factura) paso("Factura emitida", s.factura, "ok", s.entrega);
  } else {
    const porId = new Map(rutas.map((r) => [r.id, r]));
    const intentos = (s.historialAD || []).map((h) => ({ h, r: porId.get(h.rutaId) || null }));
    if (s.estado === "EN_AD" && s.rutaId) intentos.push({ h: null, r: porId.get(s.rutaId) || null });
    intentos.forEach(({ h, r }) => pasosDeAD(paso, s, r, h));
    if (!intentos.length && s.estado === "CULMINADO") {
      // Pedidos anteriores a la jornada por momentos: sólo guardan el AD y el día en que volvió.
      if (s.ad) paso(`Atendida en ${nombreAD(s.ad)}`, [s.unidad, s.operador].filter(Boolean).join(" · "), "ok", s.entrega);
      paso("Devuelta llena al punto · lista para retirar", s.factura ? `Factura ${s.factura}` : COM.punto, "ok", s.entrega);
    }
    if (s.estado === "PAGADA") paso("Esperando la jornada de tu comuna", "La fecha se fija cuando Distribución planifique el AD. Ese día llevas tu bombona vacía al punto.", "act");
  }
  // Lo que sigue ahora, después de lo que ya pasó.
  if (s.estado === "POR_COMPLETAR") paso(m.titulo, m.detalle, "act");
  if (s.estado === "POR_REPLANIFICAR") paso(m.titulo, m.detalle, "warn", s.problema?.fecha);
  if (s.estado === "ABONADA") paso(m.titulo, m.detalle, "mal", s.fechaAbono);
  return pasos;
}

function SeguimientoUsuario({ mis, enCurso, rutas, setModal }) {
  const [sel, setSel] = useState(null);
  const s = mis.find((x) => x.id === sel) || enCurso || mis[0] || null;
  const pasos = s ? lineaDeTiempo(s, rutas) : [];
  const otros = mis.filter((x) => x.id !== s?.id);
  return (
    <div className="pu-track"><style>{`
.pu-track{display:flex;flex-direction:column;gap:16px}
.pu-track-card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px}
.pu-track-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
.pu-track-head h2{margin:0;font-size:18px}
.pu-track-head p{margin:5px 0 0;color:var(--ink-3);font-size:12px;line-height:1.5;max-width:62ch}
.pu-track-head select{border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--panel);font-size:13px;max-width:100%}
.pu-track-acc{margin-top:12px}
.pu-stage-list{margin-top:18px}
.pu-stage{display:grid;grid-template-columns:32px 1fr auto;gap:10px;min-height:58px;position:relative}
.pu-stage:before{content:"";position:absolute;left:15px;top:28px;bottom:-5px;width:1px;background:var(--line)}
.pu-stage:last-child:before{display:none}
.pu-stage>i{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--line-2);color:var(--ink-3);font-style:normal;font-weight:800;font-size:11px}
.pu-stage.ok>i{background:#e8f5ed;color:#17623f}
.pu-stage.act>i{background:var(--azul-w);color:var(--azul);box-shadow:0 0 0 3px #DCE8F2}
.pu-stage.warn>i{background:var(--llama-w);color:var(--llama)}
.pu-stage.mal>i{background:var(--rojo-w);color:var(--rojo)}
.pu-stage.pend b{color:var(--ink-3)}
.pu-stage b,.pu-stage span{display:block}
.pu-stage b{font-size:13px}
.pu-stage span{font-size:11.5px;color:var(--ink-3);margin-top:3px;line-height:1.45}
.pu-stage time{font-size:10.5px;color:var(--ink-3);white-space:nowrap}
.pu-delivery-note{display:flex;gap:9px;background:#edf6f1;border:1px solid #d7e8de;border-radius:12px;padding:12px;color:#315e48;font-size:11.5px;line-height:1.5}
.pu-delivery-note svg{flex:none}
.pu-track .scroll{overflow-x:auto}
.pu-hist{width:100%;border-collapse:collapse;font-size:12px}
.pu-hist th,.pu-hist td{padding:10px;border-bottom:1px solid var(--line);text-align:left}
.pu-hist th{font-size:10px;text-transform:uppercase;color:var(--ink-3)}
.pu-hist tbody tr{cursor:pointer}
.pu-hist tbody tr:hover{background:#FBFAF7}
.pu-hist td b,.pu-hist td span:not(.chip){display:block}
.pu-hist td span:not(.chip){font-size:11px;color:var(--ink-3);margin-top:2px}
@media(max-width:700px){.pu-stage{grid-template-columns:30px 1fr}.pu-stage time{grid-column:2}}
  `}</style>
      {!s && <div className="vacio"><History size={30} /><p>Todavía no tienes pedidos.</p></div>}
      {s && (
        <section className="pu-track-card">
          <div className="pu-track-head">
            <div><h2>Seguimiento de {s.id}</h2>
              <p>{cpt(s.concepto).corto} · pedido el {fecha(s.fecha)}. Cada hito sale del sistema: tu pago, tu AD y lo que
                Distribución registró en la jornada.</p></div>
            <select value={s.id} onChange={(e) => setSel(e.target.value)}>
              {mis.slice(0, 24).map((x) => <option key={x.id} value={x.id}>{x.id} · {cpt(x.concepto).corto} · {fecha(x.fecha)}</option>)}
            </select>
          </div>
          {s.estado === "POR_COMPLETAR" && (
            <button className="btn sm primary pu-track-acc" onClick={() => setModal({ tipo: "completar", s })}><Wallet size={14} /> Completar pago</button>
          )}
          <div className="pu-stage-list">
            {pasos.map((x, i) => (
              <div className={`pu-stage ${x.estado}`} key={`${x.titulo}-${i}`}>
                <i>{x.estado === "ok" ? <Check size={14} /> : x.estado === "mal" ? <X size={14} /> : x.estado === "warn" ? <AlertTriangle size={13} /> : i + 1}</i>
                <div><b>{x.titulo}</b>{x.detalle && <span>{x.detalle}</span>}</div>
                <time>{x.fecha ? `${fecha(x.fecha)}${x.hora && x.hora !== "—" ? ` · ${x.hora}` : ""}` : x.estado === "act" ? "Ahora" : "Pendiente"}</time>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="pu-delivery-note"><MapPin size={18} /><span><b>Importante:</b> la responsabilidad de GasLara termina cuando
        tu bombona vuelve llena al punto comunal. Desde ese momento está lista para que la retires; el retiro no se registra en el sistema.</span></div>
      {otros.length > 0 && (
        <section className="pu-track-card">
          <div className="pu-track-head"><div><h2>Tus otros pedidos</h2><p>Toca uno para ver su recorrido.</p></div></div>
          <div className="scroll"><table className="pu-hist">
            <thead><tr><th>Fecha</th><th>Producto</th><th>AD</th><th>Devuelta al punto</th><th>Estado</th></tr></thead>
            <tbody>
              {otros.map((x) => (
                <tr key={x.id} onClick={() => setSel(x.id)}>
                  <td>{fecha(x.fecha)}</td>
                  <td><b>{cpt(x.concepto).corto}</b><span>{x.id}</span></td>
                  <td>{adDe(x) ? nombreAD(adDe(x)) : "—"}</td>
                  <td>{x.estado === "CULMINADO" && cpt(x.concepto).bombona ? fecha(x.entrega) : "—"}</td>
                  <td><EstadoChip s={x} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}


/* ═══════════  FACTURAS  ═══════════ */

function Facturas({ mis, misFac, setDoc, setModal }) {
  // Pagados completos que esperan su AD o su servicio: la factura sale al cerrarse. Un pedido
  // abonado, por completar o con el pago rechazado no tiene nada que facturar.
  const sinFactura = mis.filter((s) => !s.serie && esPendienteDespacho(s) && s.pago?.estado === "VERIFICADO");
  return (
    <>
      {sinFactura.length > 0 && (
        <section className="card">
          <div className="card-h"><h2>Pagos verificados sin factura aún</h2><span className="card-note">La factura se emite al cerrar el AD, cuando tu bombona vuelve llena al punto</span></div>
          <div className="lista">
            {sinFactura.map((s) => (
              <div className="lista-row estatico" key={s.id}>
                <div className="lr-ico warn"><Clock size={16} /></div>
                <div className="lr-txt"><b>{s.id}{s.pago.referencia ? ` · Ref. ${s.pago.referencia}` : ""}</b>
                  <span>{s.pago.banco ? banco(s.pago.banco).nombre : "Saldo a favor"} · {fecha(s.pago.fecha)}</span></div>
                <div className="lr-r"><b>Bs {bs(s.total)}</b><EstadoChip s={s} /></div>
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
            <div className="w2"><span>Comuna asignada</span><b>{COM.nombre}</b></div>
            <div className="w2"><span>Punto comunal</span><b>{COM.punto}</b></div>
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

/* `monto` en null significa "lo que toca transferir": sigue al pedido hasta que el usuario
   escriba el monto real de su transferencia, que es el que la regla de pago evalúa. */
const montoDe = (d, porPagar) => (d.monto == null ? porPagar : aNumero(d.monto));
const referenciaOk = (d) => /^\d{4,}$/.test(String(d.referencia || "").trim());
const transferenciaOk = (d, porPagar) => referenciaOk(d) && Number.isFinite(montoDe(d, porPagar)) && montoDe(d, porPagar) > 0;

/** Banco, datos de la cuenta, referencia y monto: lo mismo para pedir y para completar un pago. */
function DatosTransferencia({ d, setD, porPagar, aviso }) {
  const bk = banco(d.banco);
  const monto = montoDe(d, porPagar);
  const copiar = (t, l) => { try { navigator.clipboard.writeText(t); aviso(`${l} copiado`); } catch (e) {} };
  return (
    <>
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
        <button className="cta-row" onClick={() => copiar(porPagar.toFixed(2), "Monto")}>
          <div><span>Monto exacto</span><b>Bs {bs(porPagar)}</b></div><Copy size={16} />
        </button>
      </div>
      <label className="campo"><span>Número de referencia del pago</span>
        <input inputMode="numeric" placeholder="Últimos dígitos que te dio el banco" value={d.referencia}
          onChange={(e) => setD({ ...d, referencia: e.target.value.replace(/[^\d]/g, "") })} />
        {d.referencia && !referenciaOk(d) && <em className="err">Debe tener al menos 4 dígitos.</em>}
      </label>
      <label className="campo"><span>Monto que transferiste (Bs)</span>
        <input inputMode="decimal" value={d.monto ?? montoInicial(porPagar)}
          onChange={(e) => setD({ ...d, monto: e.target.value.replace(/[^\d.,]/g, "") })} />
        {!(Number.isFinite(monto) && monto > 0) && <em className="err">Indica cuánto transferiste.</em>}
      </label>
    </>
  );
}

function Wizard({ onClose, onSave, aviso, saldo = 0, solicitudes = [], parque = [] }) {
  const [paso, setPaso] = useState(1);
  const [d, setD] = useState({ concepto: "BOMB_18", cantidad: 1, nota: "", banco: "BDV", referencia: "", monto: null });
  const [error, setError] = useState(null);
  const c = cpt(d.concepto), bk = banco(d.banco);
  const m = montos(d.concepto, d.cantidad, C.id, HOY);
  // El saldo a favor se descuenta primero: sólo se transfiere la diferencia.
  const reparto = aplicarSaldo(m.total, saldo);
  const transfiere = reparto.porPagar > 0.009;
  // El tope por núcleo familiar lo decide el núcleo; si ya no hay cupo, el portal lo explica aquí.
  const cupo = c.bombona ? puedeSolicitar(C, solicitudes, d.concepto, 1) : { ok: true };
  const tope = cupo.cupoRestante != null ? Math.max(1, cupo.cupoRestante) : 6;
  // Lo que el parque de envases recuerda es un aviso: si lleva su bombona se sabe en el punto.
  const canje = c.bombona ? validarCanje(envasesDe(parque, C.id), c.kg) : { ok: true };
  const residencial = segmentoUsuario(C) === "RESIDENCIAL";
  const monto = montoDe(d, reparto.porPagar);
  const pagoOk = !transfiere || transferenciaOk(d, reparto.porPagar);
  // Adelanto de lo que hará la regla con ese monto; el resultado real lo devuelve el núcleo.
  const dif = transfiere && pagoOk ? Number((monto - reparto.porPagar).toFixed(2)) : 0;
  const titulos = ["¿Qué necesitas?", "Cantidad y entrega", "Paga tu pedido", "Revisa y confirma"];
  const elegir = (p) => setD({ ...d, concepto: p.id, cantidad: p.granel ? 100 : 1, monto: null });
  const ir = (n) => { setError(null); setPaso(n); };

  const confirmar = () => {
    const res = onSave({
      concepto: d.concepto, cantidad: d.cantidad, nota: d.nota,
      banco: transfiere ? d.banco : null,
      referencia: transfiere ? d.referencia.trim() : "",
      montoTransferido: transfiere ? monto : 0,
    });
    // Si el núcleo lo rechaza (tope, período cerrado…), el asistente sigue abierto con el motivo.
    if (!res?.ok) setError(res?.error || "No se pudo registrar el pedido.");
  };

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
              {!cupo.ok && (
                <div className="aviso-pago rojo"><AlertCircle size={15} />
                  <p><b>Ya tienes tu bombona de este ciclo.</b> {cupo.motivo} Puedes seguirla en Mis pedidos o pedir un servicio.</p></div>
              )}
              {cupo.ok && !canje.ok && (
                <div className="aviso-pago ambar"><AlertTriangle size={15} />
                  <p><b>Aviso sobre tu bombona:</b> {canje.motivo} Puedes continuar: se verifica en el punto el día de la jornada.</p></div>
              )}
              <div className="grupo-lbl">Gas</div>
              <div className="opciones">
                {PRODUCTOS.map((p) => (
                  <button key={p.id} className={`opc ${d.concepto === p.id ? "sel" : ""}`} onClick={() => elegir(p)}>
                    <div className="opc-ico"><Package size={19} /></div>
                    <div className="opc-txt"><b>{p.corto}</b><span>{p.sub}</span></div>
                    <div className="opc-precio">Bs {bs(p.precio)}{montos(p.id, 1, C.id).exento && <em>exonerado</em>}</div>
                  </button>
                ))}
              </div>
              <div className="grupo-lbl">Servicios</div>
              <div className="opciones">
                {SERVICIOS.map((p) => (
                  <button key={p.id} className={`opc ${d.concepto === p.id ? "sel" : ""}`} onClick={() => elegir(p)}>
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
                    <button disabled={d.cantidad <= 1} onClick={() => setD({ ...d, cantidad: Math.max(1, d.cantidad - 1), monto: null })}>−</button>
                    <b>{d.cantidad}</b>
                    <button disabled={d.cantidad >= tope} onClick={() => setD({ ...d, cantidad: Math.min(tope, d.cantidad + 1), monto: null })}>+</button>
                  </div>
                  {cupo.cupoRestante != null && (
                    <em className="nota">Tope de tu núcleo familiar en el ciclo de {etiquetaCiclo(cupo.consumo?.ciclo)}: te queda cupo para {cupo.cupoRestante} bombona{cupo.cupoRestante === 1 ? "" : "s"}.</em>
                  )}
                </div>
              )}
              {c.granel && (
                <label className="campo"><span>Kilogramos</span>
                  <input type="number" min="50" step="50" value={d.cantidad}
                    onChange={(e) => setD({ ...d, cantidad: Math.max(50, Number(e.target.value) || 50), monto: null })} /></label>
              )}
              {c.bombona ? (
                <>
                  <div className="campo"><span>Cómo recibes tu bombona</span>
                    <div className="dir-card">
                      <Users size={17} />
                      {residencial
                        ? <div><b>Jornada comunal</b><span>El día de la jornada llevas tu bombona vacía al punto comunal; se llena en planta y vuelve llena al mismo punto.</span></div>
                        : <div><b>Entrega directa</b><span>Distribución la programa en un AD especial por domicilio.</span></div>}
                      <span className="chip c-ok">{residencial ? "Comunal" : "Directa"}</span>
                    </div>
                  </div>
                  {residencial && (
                    <div className="campo"><span>Punto comunal</span>
                      <div className="dir-card">
                        <MapPin size={17} />
                        <div><b>{COM.punto}</b><span>{COM.nombre} · {cdtOf(C.cdt).nombre}</span></div>
                        <span className="chip c-ok">Asignado</span>
                      </div>
                    </div>
                  )}
                  <div className="aviso-pago"><Clock size={15} /><p>La fecha <b>no se elige aquí</b>: se fija cuando Distribución planifica el AD de tu comuna, sólo con pedidos pagados. La verás en Seguimiento.</p></div>
                </>
              ) : (
                <div className="campo"><span>Atención</span>
                  <div className="dir-card">
                    <MapPin size={17} />
                    <div><b>{cdtOf(C.cdt).nombre}</b><span>{c.granel ? "El despacho a granel lo coordina GasLara contigo." : "Te contactamos para coordinar el servicio."}</span></div>
                  </div>
                </div>
              )}
              <label className="campo"><span>Nota (opcional)</span>
                <textarea rows={2} placeholder="Algo que debamos saber de tu pedido" value={d.nota}
                  onChange={(e) => setD({ ...d, nota: e.target.value })} /></label>
            </>
          )}

          {paso === 3 && (
            <>
              {reparto.devengado > 0 ? (
                <>
                  <div className="det-docs">
                    <div className="det-lbl">Tu saldo a favor se aplica primero</div>
                    <div className="dd-row"><span>Total del pedido</span><b>Bs {bs(m.total)}</b></div>
                    <div className="dd-row"><span>Descontado de tu saldo</span><b style={{ color: "var(--verde)" }}>− Bs {bs(reparto.devengado)}</b></div>
                    <div className="dd-row"><span>Te queda a favor</span><b>Bs {bs(reparto.saldoRestante)}</b></div>
                  </div>
                  <div className="monto-grande">
                    <span>{transfiere ? "Debes transferir" : "No debes transferir nada"}</span>
                    <b>Bs {bs(reparto.porPagar)}</b>
                  </div>
                </>
              ) : (
                <div className="monto-grande"><span>Monto a pagar</span><b>Bs {bs(m.total)}</b></div>
              )}
              {!transfiere
                ? <div className="aviso-pago"><Check size={15} /><p>Tu saldo cubre el pedido completo. Puedes continuar sin transferir.</p></div>
                : <>
                    <DatosTransferencia d={d} setD={setD} porPagar={reparto.porPagar} aviso={aviso} />
                    {dif > 0.01 && <div className="aviso-pago"><Info size={15} /><p>Con Bs {bs(monto)} transfieres de más: <b>Bs {bs(dif)} quedarán a tu favor</b> y se descuentan solos en tu próximo pedido.</p></div>}
                    {dif < -0.01 && <div className="aviso-pago ambar"><AlertTriangle size={15} /><p>Con Bs {bs(monto)} tu pedido queda <b>por completar</b>: faltarían Bs {bs(-dif)}. No entra a la jornada hasta que transfieras la diferencia.</p></div>}
                    <div className="aviso-pago"><Zap size={15} /><p>El sistema valida tu referencia contra el banco en el momento. Si cuadra, tu pedido queda pagado y espera la jornada de tu comuna.</p></div>
                  </>}
            </>
          )}

          {paso === 4 && (
            <>
              <div className="resumen">
                <div className="res-row"><span>Producto</span><b>{c.nombre}</b></div>
                <div className="res-row"><span>Cantidad</span><b>{num(d.cantidad)} {c.unidad}</b></div>
                {c.bombona && residencial && <div className="res-row"><span>Punto comunal</span><b>{COM.punto}</b></div>}
                {c.bombona && <div className="res-row"><span>Fecha</span><b>Cuando se planifique el AD</b></div>}
                {d.nota && <div className="res-row"><span>Nota</span><b>{d.nota}</b></div>}
                <div className="res-sep" />
                {transfiere && <>
                  <div className="res-row"><span>Banco</span><b>{bk.nombre}</b></div>
                  <div className="res-row"><span>Referencia</span><b>{d.referencia}</b></div>
                  <div className="res-sep" />
                </>}
                <div className="res-row"><span>Subtotal</span><b>Bs {bs(m.base)}</b></div>
                <div className="res-row"><span>IVA</span><b>{m.exento ? "Exonerado" : `Bs ${bs(m.iva)}`}</b></div>
                <div className="res-row"><span>Total del pedido</span><b>Bs {bs(m.total)}</b></div>
                {reparto.devengado > 0 && <div className="res-row"><span>Saldo a favor aplicado</span><b>− Bs {bs(reparto.devengado)}</b></div>}
                {transfiere && <div className="res-row"><span>Por transferir</span><b>Bs {bs(reparto.porPagar)}</b></div>}
                <div className="res-row total"><span>Transferiste</span><b>Bs {bs(transfiere ? monto : 0)}</b></div>
              </div>
              <div className="aviso-pago"><Info size={15} /><p>{c.bombona
                ? "La factura se emite al cerrar el AD de tu jornada, cuando tu bombona vuelve llena al punto; no en este momento."
                : "La factura se emite cuando se presta el servicio; no en este momento."}</p></div>
            </>
          )}
          {error && <div className="aviso-pago rojo"><AlertCircle size={15} /><p><b>No se registró el pedido.</b> {error}</p></div>}
        </div>
        <div className="wiz-f">
          {paso > 1 ? <button className="btn" onClick={() => ir(paso - 1)}><ChevronLeft size={15} /> Atrás</button>
                    : <button className="btn" onClick={onClose}>Cancelar</button>}
          {paso < 4
            ? <button className="btn primary" disabled={(paso === 1 && !cupo.ok) || (paso === 3 && !pagoOk)} onClick={() => ir(paso + 1)}>Continuar <ChevronRight size={15} /></button>
            : <button className="btn primary" onClick={confirmar}>Confirmar pedido <Check size={16} /></button>}
        </div>
      </div>
    </div>
  );
}


/**
 * RESULTADO REAL DEL PEDIDO · lo que decidió la regla de pago, no un "verificado" genérico.
 * Muestra la referencia que el usuario escribió, el saldo aplicado y lo que transfirió.
 */
function ModalListo({ res, onClose, setModal }) {
  const s = res.solicitud;
  const p = s.pago || {};
  const bombona = cpt(s.concepto).bombona;
  const transfirio = res.porPagar > 0.009;
  const CASOS = {
    EXACTO: { ico: Check, tono: "", titulo: transfirio ? "Pago verificado" : "Pagado con tu saldo a favor",
      texto: transfirio ? "El monto y la referencia cuadran con el banco." : "Tu saldo a favor cubrió el pedido completo: no hizo falta transferir." },
    MONTO_MAYOR: { ico: Check, tono: "", titulo: "Pago verificado",
      texto: `Transferiste de más: Bs ${bs(res.excedente)} quedan a tu favor y se descuentan solos en tu próximo pedido.` },
    MONTO_MENOR: { ico: AlertCircle, tono: "warn", titulo: `Pago incompleto · faltan Bs ${bs(res.faltante)}`,
      texto: "Lo que transferiste quedó aplicado al pedido. Transfiere la diferencia y entras a la próxima jornada." },
    REFERENCIA_DUPLICADA: { ico: XCircle, tono: "bad", titulo: "Pago rechazado: esa referencia ya respalda otro pedido",
      texto: "No se tocó tu saldo. Revisa el número que te dio el banco; si la operación es tuya, abre un reclamo y Comercialización la revisa." },
  };
  const caso = CASOS[res.regla] || { ico: Check, tono: "", titulo: "Pedido registrado", texto: "Este pedido no requiere pago." };
  const Ico = caso.ico;
  const nota = res.regla === "REFERENCIA_DUPLICADA" ? null
    : res.regla === "MONTO_MENOR" ? "Cuando completes el pago, tu pedido entra a la próxima jornada de tu comuna."
    : bombona ? `Tu pedido espera la jornada de tu comuna. La fecha llega cuando Distribución planifique el AD: ese día llevas tu bombona vacía a ${COM.punto}.`
    : "Te contactamos para coordinar el servicio.";
  return (
    <div className="overlay" onClick={onClose}>
      <div className="hoja-modal chico" onClick={(e) => e.stopPropagation()}>
        <div className="listo-b">
          <div className={`listo-ico ${caso.tono}`}><Ico size={30} strokeWidth={3} /></div>
          <h3>{caso.titulo}</h3>
          <p>{caso.texto}</p>
          <div className="listo-id">{s.id}</div>
          <div className="det-docs listo-pago">
            {p.referencia && <div className="dd-row"><span>Referencia</span><b>{p.referencia}</b></div>}
            {p.banco && <div className="dd-row"><span>Banco</span><b>{banco(p.banco).nombre}</b></div>}
            <div className="dd-row"><span>Total del pedido</span><b>Bs {bs(s.total)}</b></div>
            {res.devengado > 0.009 && <div className="dd-row"><span>Saldo a favor aplicado</span><b>− Bs {bs(res.devengado)}</b></div>}
            {transfirio && <div className="dd-row"><span>{res.regla === "REFERENCIA_DUPLICADA" ? "Monto reportado" : "Transferiste"}</span><b>Bs {bs(s.montoTransferido)}</b></div>}
            {res.excedente > 0.009 && <div className="dd-row"><span>Quedan a tu favor</span><b>Bs {bs(res.excedente)}</b></div>}
            {res.regla === "MONTO_MENOR" && <div className="dd-row"><span>Falta por pagar</span><b>Bs {bs(res.faltante)}</b></div>}
          </div>
          {res.avisoEnvase && <div className="aviso-pago ambar"><AlertTriangle size={15} /><p>{res.avisoEnvase}</p></div>}
          {nota && <div className="listo-nota">{bombona && res.regla !== "MONTO_MENOR" ? <Truck size={14} /> : <Info size={14} />} {nota}</div>}
        </div>
        <div className="hm-f">
          {res.regla === "MONTO_MENOR" ? <>
            <button className="btn" onClick={onClose}>Luego</button>
            <button className="btn primary" onClick={() => setModal({ tipo: "completar", s })}><Wallet size={15} /> Completar pago</button>
          </> : res.regla === "REFERENCIA_DUPLICADA" ? <>
            <button className="btn" onClick={onClose}>Ver mis pedidos</button>
            <button className="btn primary" onClick={() => setModal("reclamo")}>Abrir un reclamo</button>
          </> : <button className="btn primary" onClick={onClose}>Ver mis pedidos</button>}
        </div>
      </div>
    </div>
  );
}

/**
 * COMPLETAR UN PAGO · para un pedido por completar. El núcleo descuenta primero el saldo a
 * favor, solo; lo que falte lo transfiere el usuario y la regla lo resuelve igual que siempre.
 */
function ModalCompletar({ s, saldo = 0, completarPago, aviso, onClose }) {
  const [d, setD] = useState({ banco: "BDV", referencia: "", monto: null });
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const faltante = faltanteDe(s);
  const reparto = aplicarSaldo(faltante, saldo);
  const transfiere = reparto.porPagar > 0.009;
  const listo = !transfiere || transferenciaOk(d, reparto.porPagar);

  const enviar = () => {
    const monto = montoDe(d, reparto.porPagar);
    const r = completarPago?.(s.id, transfiere
      ? { montoRecibido: monto, referencia: d.referencia.trim(), banco: d.banco, canal: d.banco === "PM" ? "PAGO_MOVIL" : "PORTAL" }
      : {});
    if (!r?.ok) { setError(r?.error || "No se pudo completar el pago."); return; }
    setError(null);
    setRes({ ...r, enviado: transfiere ? monto : 0 });
  };
  const otraVez = () => { setRes(null); setD({ ...d, referencia: "", monto: null }); };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="hoja-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hm-h">
          <div><div className="hm-eyebrow">Completar pago</div><h3>{s.id} · {cpt(s.concepto).corto}</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={19} /></button>
        </div>
        {res ? (
          <div className="listo-b">
            <div className={`listo-ico ${res.completo ? "" : "warn"}`}>{res.completo ? <Check size={30} strokeWidth={3} /> : <AlertCircle size={30} strokeWidth={3} />}</div>
            <h3>{res.completo ? "Pago completado" : `Aún faltan Bs ${bs(res.faltante)}`}</h3>
            <p>{res.completo
              ? "Tu pedido quedó pagado y entra a la próxima jornada de tu comuna."
              : "Lo que transferiste quedó aplicado. Completa la diferencia para entrar a la jornada."}</p>
            <div className="det-docs listo-pago">
              {res.devengado > 0.009 && <div className="dd-row"><span>Descontado de tu saldo</span><b>Bs {bs(res.devengado)}</b></div>}
              {res.enviado > 0 && <div className="dd-row"><span>Transferiste</span><b>Bs {bs(res.enviado)}</b></div>}
              {res.excedente > 0.009 && <div className="dd-row"><span>Quedan a tu favor</span><b>Bs {bs(res.excedente)}</b></div>}
            </div>
          </div>
        ) : s.estado !== "POR_COMPLETAR" ? (
          <div className="hm-b"><div className="aviso-pago"><Info size={15} /><p>Este pedido ya no tiene un pago por completar.</p></div></div>
        ) : (
          <div className="hm-b">
            <Tracker s={s} />
            <div className="det-docs">
              <div className="dd-row"><span>Total del pedido</span><b>Bs {bs(s.total)}</b></div>
              <div className="dd-row"><span>Ya aplicado</span><b>Bs {bs(cubiertoDe(s))}</b></div>
              <div className="dd-row"><span>Falta</span><b>Bs {bs(faltante)}</b></div>
              {reparto.devengado > 0 && <div className="dd-row"><span>Se descuenta primero de tu saldo</span><b style={{ color: "var(--verde)" }}>− Bs {bs(reparto.devengado)}</b></div>}
            </div>
            <div className="monto-grande"><span>{transfiere ? "Debes transferir" : "Tu saldo cubre la diferencia"}</span><b>Bs {bs(reparto.porPagar)}</b></div>
            {transfiere && <DatosTransferencia d={d} setD={setD} porPagar={reparto.porPagar} aviso={aviso} />}
            {error && <div className="aviso-pago rojo"><AlertCircle size={15} /><p>{error}</p></div>}
          </div>
        )}
        <div className="hm-f">
          {res ? <>
            {!res.completo && <button className="btn" onClick={otraVez}>Completar el resto</button>}
            <button className="btn primary" onClick={onClose}>Listo</button>
          </> : <>
            <button className="btn" onClick={onClose}>Cancelar</button>
            {s.estado === "POR_COMPLETAR" && <button className="btn primary" disabled={!listo} onClick={enviar}>{transfiere ? "Reportar pago" : "Aplicar mi saldo"}</button>}
          </>}
        </div>
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
              {FASES.map((f) => {
                const Ico = iconoFase(f.key);
                return (
                  <div className="ay-row" key={f.key}>
                    <div className="ay-ico"><Ico size={16} /></div>
                    <div><b>{f.paso || f.cliente}</b><span>{f.pasoDesc || f.clienteDesc}</span></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="det-lbl">Si algo no sale como esperabas</div>
            <div className="ayuda-lista">
              {["POR_COMPLETAR", "POR_REPLANIFICAR", "ABONADA"].map((k) => {
                const e = estadoSolicitud(k), Ico = ICONOS_LATERAL[k] || AlertCircle;
                return (
                  <div className="ay-row" key={k}>
                    <div className="ay-ico alt"><Ico size={16} /></div>
                    <div><b>{e.cliente}</b><span>{e.clienteDesc}</span></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="aviso-pago"><Info size={15} /><p>La factura se emite al cerrar el AD de tu jornada, cuando tu bombona ya volvió llena al punto; no cuando pagas. El saldo a favor no se devuelve en efectivo: se descuenta solo en tu próximo pedido.</p></div>
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
/* Selector de rol: la permisología hecha visible en el prototipo. */
.pu-rol{display:block;margin:0 14px 16px}
.pu-rol span{display:block;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin-bottom:6px}
.pu-rol select{width:100%;box-sizing:border-box;border:1px solid var(--linea);border-radius:10px;padding:10px 11px;font-size:13.5px;font-family:inherit;background:var(--panel);color:var(--ink-1)}
.pu-nav-grupo{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);padding:14px 12px 6px}
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
/* El tracking va en em, no en px: así escala con el tamaño y no aplasta al texto hijo.
   Con -2.2px fijos, el <em> de 15px heredaba un tracking pensado para 50px y las
   letras se montaban unas sobre otras. */
.hero-num{font-size:50px;font-weight:700;letter-spacing:-.044em;line-height:1;margin:10px 0;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.hero-num em{font-size:15px;font-weight:520;color:var(--ink-3);font-style:normal;line-height:1.4;max-width:190px;letter-spacing:normal}
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
.card-acc{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
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
.tr-txt span em{display:block;font-style:normal;font-weight:620;color:var(--azul);margin-bottom:2px}
.tr-momento{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:560;color:var(--azul);background:var(--azul-w);border-radius:9px;padding:7px 10px;margin-top:4px}
/* Estados laterales: un aviso con lo que pasó y lo que sigue, en vez de una escalera vacía. */
.lat{display:flex;gap:11px;align-items:flex-start;border-radius:13px;padding:13px 15px;background:var(--line-2);color:var(--ink-2)}
.lat svg{flex-shrink:0;margin-top:1px}
.lat b{display:block;font-size:14px;font-weight:620;color:var(--ink)}
.lat span{display:block;font-size:12.5px;line-height:1.5;margin-top:3px}
.lat.ambar{background:var(--llama-w);color:#8A4A12}
.lat.ambar svg{color:var(--llama)}
.lat.rojo{background:var(--rojo-w);color:#8A2A24}
.lat.rojo svg{color:var(--rojo)}
.lat.gris svg{color:var(--ink-3)}
.lat.mini{padding:10px 12px;border-radius:11px}
.lat.mini b{font-size:12.5px}
.lat.mini span{font-size:11.5px}
.card .lat{margin:16px 20px}

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
.lr-ico.bad{background:var(--rojo-w);color:var(--rojo)}
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
.c-gris{background:var(--line-2);color:var(--ink-2)}
.c-bad{background:var(--rojo-w);color:var(--rojo)}

.filtros{display:flex;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.tabs{display:flex;background:var(--line-2);border-radius:11px;padding:3px}
.tabs button{border:none;background:none;padding:8px 16px;font-size:13.5px;color:var(--ink-3);border-radius:8px;font-weight:520}
.tabs button.on{background:var(--panel);color:var(--ink);font-weight:600;box-shadow:0 1px 3px rgba(18,33,30,.12)}
.search{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--panel);border-radius:11px;padding:0 13px;height:40px;color:var(--ink-3)}
.search input{border:none;outline:none;width:190px;padding:8px 0;background:none}

.pedidos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
.ped{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:17px 19px;text-align:left;transition:.15s;box-shadow:var(--sh);display:flex;flex-direction:column;gap:13px}
.ped:hover{transform:translateY(-2px);border-color:#C8C6BE}
.ped{cursor:pointer}
.ped-acc{align-self:flex-start}
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
.det-docs.warn{background:var(--llama-w)}
.det-docs.warn .det-lbl{color:var(--llama)}
.det-p{margin:8px 0 0;font-size:12.5px;line-height:1.5;color:var(--ink-2)}
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
.stepper button:disabled{opacity:.35;cursor:not-allowed;background:var(--panel)}
.campo .nota{font-style:normal;font-size:12px;color:var(--ink-3);line-height:1.45}
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
.aviso-pago.ambar{background:var(--llama-w);color:#8A4A12}
.aviso-pago svg{flex-shrink:0;margin-top:1px}
.aviso-pago p{margin:0;font-size:12.5px;line-height:1.55}
.listo-b{padding:34px 26px 26px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:11px}
.listo-ico{width:64px;height:64px;border-radius:50%;background:var(--verde-w);color:var(--verde);display:grid;place-items:center}
.listo-ico.warn{background:var(--llama-w);color:var(--llama)}
.listo-ico.bad{background:var(--rojo-w);color:var(--rojo)}
.listo-pago{width:100%;text-align:left}
.listo-b h3{margin:4px 0 0;font-size:21px;font-weight:680;letter-spacing:-.5px}
.listo-b p{margin:0;font-size:14px;color:var(--ink-2);line-height:1.55;max-width:34ch}
.listo-id{font-family:var(--mono);font-size:17px;font-weight:650;background:var(--line-2);padding:7px 15px;border-radius:9px}
.listo-nota{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--verde);background:var(--verde-w);padding:11px 14px;border-radius:11px;text-align:left;line-height:1.45}
.ayuda-lista{display:flex;flex-direction:column;gap:13px}
.ay-row{display:flex;gap:13px;align-items:flex-start}
.ay-ico{width:34px;height:34px;border-radius:10px;background:var(--verde-w);color:var(--verde);display:grid;place-items:center;flex-shrink:0}
.ay-ico.alt{background:var(--llama-w);color:var(--llama)}
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
