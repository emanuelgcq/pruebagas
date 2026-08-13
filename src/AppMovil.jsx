import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Home, Package, Receipt, MessageSquareWarning, User, Plus, X, ChevronRight,
  ChevronLeft, Check, MapPin, Phone, Clock, Truck, CheckCircle2, Copy, Info,
  AlertCircle, ShieldCheck, Landmark, Smartphone, History, Zap, Bell, LogOut,
  Wifi, BatteryFull, Signal, Search, HelpCircle, ChevronDown, Users,
} from "lucide-react";
import {
  LOGO_GASLARA, LOGO_LARA, EMPRESA, BANCOS, banco, CLIENTE_PORTAL, HOY,
  PRODUCTOS, SERVICIOS, cpt, cdtOf, comunaOf, montos, FASES, faseIdx, fase,
  bs, num, fecha, fechaLarga, mesCorto,
} from "./datos.jsx";
import { VisorDocumento } from "./Documentos.jsx";

const C = CLIENTE_PORTAL;
const COM = comunaOf(C.comuna);
const ICONOS_FASE = [ShieldCheck, Truck, CheckCircle2];

export default function AppMovil({ solicitudes, reclamos, facturas, ciclo, crearSolicitud, crearReclamo }) {
  const [sesion, setSesion] = useState(false);
  const [tab, setTab] = useState("inicio");
  const [hoja, setHoja] = useState(null);
  const [doc, setDoc] = useState(null);
  const [toast, setToast] = useState(null);
  const screenRef = useRef(null);
  const aviso = (m) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const mis = useMemo(() => solicitudes.filter((s) => s.usuario === C.id), [solicitudes]);
  const misRec = useMemo(() => reclamos.filter((r) => r.usuario === C.id), [reclamos]);
  const misFac = useMemo(() => facturas.filter((f) => f.usuario === C.id && f.origen === "AUTOMATICA"), [facturas]);
  const activos = mis.filter((s) => s.estado !== "CULMINADO");
  const enCurso = mis.find((s) => s.estado === "EN_AD") || mis.find((s) => s.estado === "PAGADA");

  useEffect(() => { if (screenRef.current) screenRef.current.scrollTop = 0; }, [tab]);

  const onNueva = (d) => { const n = crearSolicitud(d); setHoja({ t: "listo", s: n }); };
  const onReclamo = (d) => { const id = crearReclamo(d); setHoja(null); setTab("mas"); aviso(`Reclamo ${id} registrado`); };

  const titulos = { inicio: null, pedidos: "Mis pedidos", facturas: "Facturas", mas: "Mi cuenta" };

  return (
    <div className="mv">
      <EstilosMovil />
      <div className="mv-stage">
        <div className="mv-lado">
          <img src={LOGO_GASLARA} alt="GasLara" className="mv-lado-logo" />
          <h2>Aplicación del usuario</h2>
          <p>Prototipo navegable de la app de GasLara para Android e iOS. Mismos datos que el portal web
             y el módulo de comercialización.</p>
          <ul>
            <li><span>1</span> Ingresa con cualquier clave</li>
            <li><span>2</span> Toca el botón verde para pedir gas</li>
            <li><span>3</span> Sigue tu pedido en la pantalla de inicio</li>
          </ul>
          <div className="mv-lado-pie">
            <img src={LOGO_LARA} alt="Gobierno de Lara" />
            <span>Datos de demostración<br />sin validez fiscal</span>
          </div>
        </div>

        <div className="mv-phone">
          <div className="mv-notch" />
          <div className="mv-status">
            <span>9:41</span>
            <div className="mv-status-r"><Signal size={13} /><Wifi size={13} /><BatteryFull size={15} /></div>
          </div>

          {!sesion ? (
            <Login onEntrar={() => setSesion(true)} />
          ) : (
            <>
              {titulos[tab] && (
                <header className="mv-head">
                  <h1>{titulos[tab]}</h1>
                  {tab === "pedidos" && <span className="mv-head-n">{mis.length}</span>}
                </header>
              )}

              <div className="mv-screen" ref={screenRef}>
                {tab === "inicio" && <Inicio {...{ mis, enCurso, ciclo, setHoja, setTab, misFac }} />}
                {tab === "pedidos" && <Pedidos mis={mis} setHoja={setHoja} />}
                {tab === "facturas" && <Facturas mis={mis} misFac={misFac} setDoc={setDoc} setHoja={setHoja} />}
                {tab === "mas" && <Cuenta {...{ mis, misRec, ciclo, setHoja, onSalir: () => { setSesion(false); setTab("inicio"); } }} />}
                <div className="mv-fondo" />
              </div>

              <nav className="mv-tabs">
                <Tab id="inicio" icon={Home} label="Inicio" tab={tab} set={setTab} />
                <Tab id="pedidos" icon={Package} label="Pedidos" tab={tab} set={setTab} n={activos.length} />
                <button className="mv-cta" onClick={() => setHoja({ t: "pedir" })} aria-label="Pedir gas">
                  <Plus size={26} strokeWidth={2.8} />
                </button>
                <Tab id="facturas" icon={Receipt} label="Facturas" tab={tab} set={setTab} />
                <Tab id="mas" icon={User} label="Cuenta" tab={tab} set={setTab} n={misRec.filter((r) => r.estado !== "RESUELTO").length} />
              </nav>
              <div className="mv-barra" />
            </>
          )}

          {hoja && (
            <div className="mv-sheet-bg" onClick={() => setHoja(null)}>
              <div className="mv-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="mv-grab" />
                {hoja.t === "pedir" && <Pedir onClose={() => setHoja(null)} onSave={onNueva} aviso={aviso} />}
                {hoja.t === "listo" && <Listo s={hoja.s} onClose={() => { setHoja(null); setTab("pedidos"); }} />}
                {hoja.t === "detalle" && <Detalle s={hoja.s} facturas={facturas} onClose={() => setHoja(null)} setDoc={setDoc} />}
                {hoja.t === "reclamo" && <NuevoReclamo mis={mis} onClose={() => setHoja(null)} onSave={onReclamo} />}
                {hoja.t === "reclamos" && <ListaReclamos misRec={misRec} setHoja={setHoja} />}
                {hoja.t === "rec-det" && <ReclamoDet r={hoja.r} onClose={() => setHoja(null)} />}
                {hoja.t === "bancos" && <Bancos aviso={aviso} />}
                {hoja.t === "ayuda" && <Ayuda />}
                {hoja.t === "perfil" && <PerfilDatos />}
              </div>
            </div>
          )}

          {toast && <div className="mv-toast"><CheckCircle2 size={15} /> {toast}</div>}
        </div>
      </div>

      {doc && <VisorDocumento doc={doc} onClose={() => setDoc(null)} />}
    </div>
  );
}

const Tab = ({ id, icon: Ico, label, tab, set, n }) => (
  <button className={`mv-tab ${tab === id ? "on" : ""}`} onClick={() => set(id)}>
    <div className="mv-tab-i"><Ico size={21} strokeWidth={tab === id ? 2.4 : 2} />{n > 0 && <i />}</div>
    <span>{label}</span>
  </button>
);

/* ═══════════  LOGIN  ═══════════ */

function Login({ onEntrar }) {
  const [ci, setCi] = useState("15884207");
  const [clave, setClave] = useState("••••••••");
  return (
    <div className="mv-login">
      <div className="mv-login-top">
        <img src={LOGO_GASLARA} alt="GasLara" />
        <div className="mv-login-rif">Rif: {EMPRESA.rif}</div>
      </div>
      <div className="mv-login-b">
        <h2>Bienvenido</h2>
        <p>Ingresa con tu cédula y la clave que registraste en tu contrato de servicio.</p>
        <label className="mv-campo"><span>Cédula</span>
          <input inputMode="numeric" value={ci} onChange={(e) => setCi(e.target.value.replace(/\D/g, ""))} /></label>
        <label className="mv-campo"><span>Clave</span>
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} /></label>
        <button className="mv-btn pri grande" onClick={onEntrar}>Entrar</button>
        <button className="mv-link-c">¿Olvidaste tu clave?</button>
        <div className="mv-login-sep"><span>o</span></div>
        <button className="mv-btn">Registrarme con mi número de contrato</button>
      </div>
      <div className="mv-login-pie">
        <img src={LOGO_LARA} alt="Gobierno de Lara" />
        <span>{EMPRESA.sistema}<br />Gobierno Bolivariano de Lara</span>
      </div>
    </div>
  );
}

/* ═══════════  INICIO  ═══════════ */

function Inicio({ mis, enCurso, ciclo, setHoja, setTab, misFac }) {
  const cerca = ciclo && ciclo.restantes <= 6;
  const pasado = ciclo && ciclo.restantes < 0;
  return (
    <>
      <div className="mv-saludo">
        <div>
          <span>Hola,</span>
          <h1>{C.nombre.split(" ")[0].toLowerCase().replace(/^./, (m) => m.toUpperCase())}</h1>
        </div>
        <button className="mv-camp" onClick={() => setHoja({ t: "ayuda" })}><Bell size={19} /></button>
      </div>

      {ciclo && (
        <section className="mv-ciclo">
          <div className="mv-ciclo-l">
            <div className="mv-eyebrow"><History size={11} /> Tu ritmo</div>
            <div className="mv-big">{ciclo.transcurridos}<em>días desde tu<br />última bombona</em></div>
            <div className="mv-meter"><div className={`mv-fill ${cerca ? "cerca" : ""}`} style={{ width: `${ciclo.pct}%` }} /></div>
            <p>Pides cada <b>{ciclo.promedio} días</b>. {pasado ? "Ya pasaste tu promedio." : `Te tocaría cerca del ${fecha(ciclo.proxima)}.`}</p>
          </div>
          <Bombona pct={100 - ciclo.pct} cerca={cerca} />
        </section>
      )}

      {ciclo && (
        <div className="mv-aclara"><Info size={13} /><span>Estimado según tus {ciclo.pedidos} pedidos anteriores. No medimos tu bombona.</span></div>
      )}

      <button className="mv-btn pri grande full" onClick={() => setHoja({ t: "pedir" })}>
        <Plus size={18} strokeWidth={2.8} /> Pedir y pagar bombona
      </button>

      {enCurso && (
        <section className="mv-card curso">
          <div className="mv-card-h">
            <h3><span className="mv-pulse" /> Pedido en curso</h3>
            <button className="mv-link" onClick={() => setHoja({ t: "detalle", s: enCurso })}>Detalle <ChevronRight size={13} /></button>
          </div>
          <TrackerV estado={enCurso.estado} />
          <div className="mv-curso-f">
            <div><span>Producto</span><b>{cpt(enCurso.concepto).corto}</b></div>
            <div><span>Entrega</span><b>{fecha(enCurso.entrega)}</b></div>
          </div>
        </section>
      )}

      <div className="mv-acc">
        <button onClick={() => setHoja({ t: "bancos" })}><div className="i az"><Landmark size={18} /></div>Cuentas<br />para pagar</button>
        <button onClick={() => setTab("facturas")}><div className="i vd"><Receipt size={18} /></div>Mis<br />facturas</button>
        <button onClick={() => setHoja({ t: "reclamo" })}><div className="i nj"><MessageSquareWarning size={18} /></div>Reportar<br />problema</button>
      </div>

      <section className="mv-card">
        <div className="mv-card-h"><h3>Movimientos recientes</h3>
          <button className="mv-link" onClick={() => setTab("pedidos")}>Ver todos</button></div>
        {mis.slice(0, 4).map((s) => <Fila key={s.id} s={s} onClick={() => setHoja({ t: "detalle", s })} />)}
      </section>
    </>
  );
}

function Bombona({ pct, cerca }) {
  const h = 96 * (Math.max(4, pct) / 100);
  return (
    <svg viewBox="0 0 100 165" className="mv-bomb" aria-label="Referencia estimada">
      <defs><linearGradient id="mvg" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor={cerca ? "#E0611F" : "#1E7A4C"} />
        <stop offset="100%" stopColor={cerca ? "#F5A623" : "#4FB07A"} />
      </linearGradient></defs>
      <rect x="42" y="5" width="16" height="13" rx="3" fill="#8A9AA6" />
      <rect x="36" y="17" width="28" height="7" rx="3" fill="#6E7E8B" />
      <path d="M30 27 Q30 14 50 14 Q70 14 70 27" fill="none" stroke="#6E7E8B" strokeWidth="5" strokeLinecap="round" />
      <rect x="14" y="27" width="72" height="127" rx="19" fill="#EDEFF1" stroke="#D6DBE0" strokeWidth="1.5" />
      <clipPath id="mvc"><rect x="15.5" y="28.5" width="69" height="124" rx="18" /></clipPath>
      <g clipPath="url(#mvc)">
        <rect x="15" y={152 - h} width="70" height={h} fill="url(#mvg)" opacity=".92" />
        <line x1="15" y1={152 - h} x2="85" y2={152 - h} stroke="#fff" strokeWidth="2" strokeDasharray="5 4" opacity=".9" />
      </g>
      <rect x="14" y="27" width="72" height="127" rx="19" fill="none" stroke="#C9D0D7" strokeWidth="1.5" />
      <rect x="24" y="80" width="17" height="38" rx="4" fill="#fff" opacity=".2" />
      <rect x="21" y="150" width="58" height="10" rx="4" fill="#6E7E8B" />
    </svg>
  );
}

function TrackerV({ estado }) {
  const idx = faseIdx(estado);
  return (
    <div className="mv-track">
      {FASES.map((f, i) => {
        const Ico = ICONOS_FASE[i], on = i <= idx, act = i === idx;
        return (
          <div className={`mv-tr ${on ? "on" : ""} ${act ? "act" : ""}`} key={f.key}>
            <div className="mv-tr-rail">
              <div className="mv-tr-dot">{on ? <Ico size={11} strokeWidth={2.8} /> : <b>{i + 1}</b>}</div>
              {i < FASES.length - 1 && <div className="mv-tr-line" />}
            </div>
            <div className="mv-tr-txt"><b>{f.cliente}</b>{act && <span>{f.clienteDesc}</span>}</div>
          </div>
        );
      })}
    </div>
  );
}

const Chip = ({ estado }) => {
  const m = { PAGADA: ["Pagado", "w"], EN_AD: ["En despacho", "a"], CULMINADO: ["Completado", "o"] };
  const [l, c] = m[estado] || ["—", ""];
  return <span className={`mv-chip ${c}`}>{l}</span>;
};

const Fila = ({ s, onClick }) => (
  <button className="mv-fila" onClick={onClick}>
    <div className={`mv-fila-i ${s.estado === "CULMINADO" ? "o" : s.estado === "PAGADA" ? "w" : "a"}`}><Package size={16} /></div>
    <div className="mv-fila-t">
      <b>{cpt(s.concepto).corto}{s.cantidad > 1 ? ` × ${s.cantidad}` : ""}</b>
      <span>{s.id} · {mesCorto(s.fecha)}</span>
    </div>
    <div className="mv-fila-r"><b>{bs(s.total)}</b><Chip estado={s.estado} /></div>
  </button>
);

/* ═══════════  PEDIDOS  ═══════════ */

function Pedidos({ mis, setHoja }) {
  const [f, setF] = useState("TODOS");
  const lista = mis.filter((s) => f === "TODOS" || (f === "ACT" ? s.estado !== "CULMINADO" : s.estado === "CULMINADO"));
  return (
    <>
      <div className="mv-seg">
        {[["TODOS", "Todos"], ["ACT", "En curso"], ["FIN", "Completados"]].map(([k, l]) => (
          <button key={k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>
      {lista.map((s) => (
        <button className={`mv-ped ${s.estado !== "CULMINADO" ? "act" : ""}`} key={s.id} onClick={() => setHoja({ t: "detalle", s })}>
          <div className="mv-ped-h">
            <div><b>{cpt(s.concepto).corto}</b><span>{s.id} · {fechaLarga(s.fecha)}</span></div>
            <Chip estado={s.estado} />
          </div>
          {s.estado !== "CULMINADO" && <div className="mv-mini"><TrackerV estado={s.estado} /></div>}
          <div className="mv-ped-f">
            <div className="mv-tags">{s.ad && <span>{s.ad}</span>}{s.serie && <span>{s.serie}</span>}</div>
            <b>Bs {bs(s.total)}</b>
          </div>
        </button>
      ))}
      {!lista.length && <div className="mv-vacio"><Package size={26} /><p>No hay pedidos aquí.</p></div>}
    </>
  );
}

function Detalle({ s, facturas, onClose, setDoc }) {
  const c = cpt(s.concepto), bk = s.pago.banco ? banco(s.pago.banco) : null;
  const fac = facturas.find((f) => f.sol === s.id);
  return (
    <>
      <div className="mv-sh-h"><h2>{s.id}</h2><button className="mv-x" onClick={onClose}><X size={19} /></button></div>
      <div className="mv-sh-b">
        <TrackerV estado={s.estado} />
        <div className="mv-kv">
          <div><span>Producto</span><b>{c.nombre}</b></div>
          <div><span>Cantidad</span><b>{num(s.cantidad)} {c.unidad}</b></div>
          <div><span>{faseIdx(s.estado) >= 2 ? "Entregado a la comuna" : "Jornada comunal"}</span><b>{fecha(s.entrega)}</b></div>
          <div><span>Modalidad</span><b>Entrega consolidada a la comuna</b></div>
          <div><span>Punto de recepción</span><b>{COM.punto}</b></div>
          {s.operador && <div><span>Unidad</span><b>{s.operador}</b></div>}
          {s.nota && <div><span>Nota</span><b>{s.nota}</b></div>}
        </div>
        {bk && (
          <div className="mv-bloque">
            <div className="mv-bloque-t">Tu pago</div>
            <div className="mv-kv chico">
              <div><span>Banco</span><b>{bk.nombre}</b></div>
              <div><span>Referencia</span><b>{s.pago.referencia}</b></div>
              <div><span>Estatus</span><b className="vd"><Zap size={11} /> Verificado</b></div>
            </div>
          </div>
        )}
        <div className="mv-bloque">
          <div className="mv-bloque-t">Documentos</div>
          <div className="mv-kv chico">
            <div><span>Pedido Nro</span><b>P{s.pedidoNro}</b></div>
            <div><span>AD</span><b>{s.ad || "—"}</b></div>
            <div><span>Boleta</span><b>{s.boleta || "—"}</b></div>
            <div><span>Factura</span><b>{s.serie || "—"}</b></div>
          </div>
        </div>
        <div className="mv-total">
          <div><span>Subtotal</span><b>Bs {bs(s.base)}</b></div>
          <div><span>IVA</span><b>{s.exento ? "Exonerado" : `Bs ${bs(s.iva)}`}</b></div>
          <div className="big"><span>Total pagado</span><b>Bs {bs(s.total)}</b></div>
        </div>
        {fac && <button className="mv-btn pri grande full" onClick={() => { onClose(); setDoc({ tipo: "factura", data: fac }); }}>
          <Receipt size={17} /> Ver factura</button>}
      </div>
    </>
  );
}

/* ═══════════  FACTURAS  ═══════════ */

function Facturas({ mis, misFac, setDoc, setHoja }) {
  const sin = mis.filter((s) => !s.serie && s.estado !== "CULMINADO");
  return (
    <>
      {sin.length > 0 && (
        <section className="mv-card">
          <div className="mv-card-h"><h3>Pagos sin factura aún</h3></div>
          {sin.map((s) => (
            <button className="mv-fila" key={s.id} onClick={() => setHoja({ t: "detalle", s })}>
              <div className="mv-fila-i w"><Clock size={16} /></div>
              <div className="mv-fila-t"><b>Ref. {s.pago.referencia}</b><span>{banco(s.pago.banco).nombre}</span></div>
              <div className="mv-fila-r"><b>{bs(s.total)}</b><Chip estado={s.estado} /></div>
            </button>
          ))}
          <div className="mv-nota"><Info size={13} /> La factura se emite cuando el despacho se cierra, no al pagar.</div>
        </section>
      )}
      <section className="mv-card">
        <div className="mv-card-h"><h3>Historial</h3><span className="mv-n">{misFac.length}</span></div>
        {misFac.map((f) => (
          <button className="mv-fila" key={f.id} onClick={() => setDoc({ tipo: "factura", data: f })}>
            <div className="mv-fila-i o"><Receipt size={16} /></div>
            <div className="mv-fila-t"><b>{f.serie}</b><span>{fecha(f.fecha)} · {cpt(f.concepto).corto}</span></div>
            <div className="mv-fila-r"><b>{bs(f.total)}</b><ChevronRight size={15} className="mv-ar" /></div>
          </button>
        ))}
        {!misFac.length && <div className="mv-vacio"><Receipt size={24} /><p>Aún no tienes facturas.</p></div>}
      </section>
    </>
  );
}

/* ═══════════  CUENTA  ═══════════ */

function Cuenta({ mis, misRec, ciclo, setHoja, onSalir }) {
  const total = mis.filter((s) => s.estado === "CULMINADO").reduce((s, x) => s + x.total, 0);
  const bombonas = mis.filter((s) => cpt(s.concepto).bombona && s.estado === "CULMINADO").reduce((s, x) => s + x.cantidad, 0);
  const abiertos = misRec.filter((r) => r.estado !== "RESUELTO").length;
  return (
    <>
      <section className="mv-perfil">
        <div className="mv-av">{C.nombre.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
        <div><b>{C.nombre}</b><span>Código {C.id} · Contrato {C.contrato}</span></div>
      </section>

      <section className="mv-contrato">
        <div className="mv-eyebrow claro"><ShieldCheck size={11} /> Contrato activo</div>
        <div className="mv-contrato-id">{C.contrato}</div>
        <div className="mv-contrato-s">{C.tipoContrato}</div>
        <div className="mv-contrato-g">
          <div><span>Bombonas</span><b>{bombonas}</b></div>
          <div><span>Pagado</span><b>{bs(total)}</b></div>
          {ciclo && <div><span>Cada</span><b>{ciclo.promedio} días</b></div>}
        </div>
      </section>

      <section className="mv-card">
        <Opcion icon={MessageSquareWarning} t="Mis reclamos" s={abiertos ? `${abiertos} sin resolver` : "Todos resueltos"} n={abiertos} onClick={() => setHoja({ t: "reclamos" })} />
        <Opcion icon={Landmark} t="Cuentas para pagar" s="4 bancos disponibles" onClick={() => setHoja({ t: "bancos" })} />
        <Opcion icon={User} t="Mis datos" s="Dirección y contacto" onClick={() => setHoja({ t: "perfil" })} />
        <Opcion icon={HelpCircle} t="Cómo funciona" s="Pago, despacho y factura" onClick={() => setHoja({ t: "ayuda" })} />
      </section>

      <section className="mv-card">
        <a className="mv-op" href={`tel:${EMPRESA.tel.replace(/\D/g, "")}`}>
          <div className="mv-op-i"><Phone size={17} /></div>
          <div className="mv-op-t"><b>Emergencias de gas</b><span>{EMPRESA.tel} · atención 24 horas</span></div>
          <ChevronRight size={16} className="mv-ar" />
        </a>
      </section>

      <button className="mv-salir" onClick={onSalir}><LogOut size={16} /> Cerrar sesión</button>
      <div className="mv-pie">
        <img src={LOGO_LARA} alt="Gobierno de Lara" />
        <span>{EMPRESA.nombre} · Rif: {EMPRESA.rif}<br />{EMPRESA.sistema} · versión 2.0</span>
      </div>
    </>
  );
}

const Opcion = ({ icon: Ico, t, s, n, onClick }) => (
  <button className="mv-op" onClick={onClick}>
    <div className="mv-op-i"><Ico size={17} /></div>
    <div className="mv-op-t"><b>{t}</b><span>{s}</span></div>
    {n > 0 && <em className="mv-badge">{n}</em>}
    <ChevronRight size={16} className="mv-ar" />
  </button>
);

/* ═══════════  PEDIR (flujo en hoja)  ═══════════ */

function Pedir({ onClose, onSave, aviso }) {
  const [paso, setPaso] = useState(1);
  const [d, setD] = useState({ concepto: "BOMB_18", cantidad: 1, ventana: "Mañana (8 am – 12 m)", nota: "", banco: "BDV", referencia: "" });
  const c = cpt(d.concepto), bk = banco(d.banco);
  const m = montos(d.concepto, d.cantidad, C.id);
  const refOk = /^\d{4,}$/.test(d.referencia.trim());
  const copiar = (t, l) => { try { navigator.clipboard.writeText(t); aviso(`${l} copiado`); } catch (e) {} };
  const tits = ["¿Qué necesitas?", "¿Cuándo y dónde?", "Paga tu pedido", "Confirma"];

  return (
    <>
      <div className="mv-sh-h">
        {paso > 1 ? <button className="mv-x" onClick={() => setPaso(paso - 1)}><ChevronLeft size={20} /></button> : <span className="mv-x" />}
        <h2>{tits[paso - 1]}</h2>
        <button className="mv-x" onClick={onClose}><X size={19} /></button>
      </div>
      <div className="mv-pasos">{[1, 2, 3, 4].map((n) => <i key={n} className={paso >= n ? "on" : ""} />)}</div>

      <div className="mv-sh-b">
        {paso === 1 && (
          <>
            <div className="mv-nota az"><Info size={13} /> En GasLara se paga antes del despacho.</div>
            <div className="mv-lbl">Gas</div>
            {PRODUCTOS.map((p) => (
              <button key={p.id} className={`mv-opc ${d.concepto === p.id ? "sel" : ""}`}
                onClick={() => setD({ ...d, concepto: p.id, cantidad: p.granel ? 100 : 1 })}>
                <div className="mv-opc-i"><Package size={17} /></div>
                <div className="mv-opc-t"><b>{p.corto}</b><span>{p.sub}</span></div>
                <div className="mv-opc-p">{bs(p.precio)}{montos(p.id, 1, C.id).exento && <em>exonerado</em>}</div>
              </button>
            ))}
            <div className="mv-lbl">Servicios</div>
            {SERVICIOS.map((p) => (
              <button key={p.id} className={`mv-opc ${d.concepto === p.id ? "sel" : ""}`}
                onClick={() => setD({ ...d, concepto: p.id, cantidad: 1 })}>
                <div className="mv-opc-i alt"><ShieldCheck size={17} /></div>
                <div className="mv-opc-t"><b>{p.corto}</b><span>{p.sub}</span></div>
                <div className="mv-opc-p">{bs(p.precio)}</div>
              </button>
            ))}
          </>
        )}

        {paso === 2 && (
          <>
            {c.bombona && (
              <div className="mv-campo"><span>Cantidad</span>
                <div className="mv-step">
                  <button onClick={() => setD({ ...d, cantidad: Math.max(1, d.cantidad - 1) })}>−</button>
                  <b>{d.cantidad}</b>
                  <button onClick={() => setD({ ...d, cantidad: Math.min(6, d.cantidad + 1) })}>+</button>
                </div>
              </div>
            )}
            {c.granel && (
              <label className="mv-campo"><span>Kilogramos</span>
                <input type="number" min="50" step="50" value={d.cantidad}
                  onChange={(e) => setD({ ...d, cantidad: Math.max(50, Number(e.target.value) || 50) })} /></label>
            )}
            <div className="mv-campo"><span>Modalidad residencial</span>
              <div className="mv-dir"><Users size={16} /><div><b>Jornada comunal</b><span>GasLara entrega el lote a la comuna, no casa por casa.</span></div><span className="mv-chip o">Comunal</span></div>
            </div>
            <div className="mv-campo"><span>Punto de recepción</span>
              <div className="mv-dir"><MapPin size={16} /><div><b>{COM.punto}</b><span>{COM.nombre}</span></div><span className="mv-chip o">Asignado</span></div>
            </div>
            <label className="mv-campo"><span>Nota para la comuna</span>
              <textarea rows={2} placeholder="Ej: avisar al responsable comunal"
                value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} /></label>
          </>
        )}

        {paso === 3 && (
          <>
            <div className="mv-monto"><span>Monto a pagar</span><b>Bs {bs(m.total)}</b></div>
            <div className="mv-lbl">¿Por dónde vas a pagar?</div>
            {BANCOS.map((b) => (
              <button key={b.id} className={`mv-banco ${d.banco === b.id ? "sel" : ""}`} onClick={() => setD({ ...d, banco: b.id })}>
                <div className="mv-bk" style={{ background: b.color }}>{b.movil ? <Smartphone size={14} /> : <Landmark size={14} />}</div>
                <div className="mv-bk-t"><b>{b.nombre}</b><span>{b.tipo}</span></div>
                {d.banco === b.id && <Check size={16} className="vd" />}
              </button>
            ))}
            <div className="mv-cuenta">
              <button onClick={() => copiar(bk.cuenta.replace(/-/g, ""), bk.movil ? "Teléfono" : "Cuenta")}>
                <div><span>{bk.movil ? "Teléfono" : "Cuenta"}</span><b>{bk.cuenta}</b></div><Copy size={15} /></button>
              <button onClick={() => copiar(EMPRESA.rif, "Rif")}>
                <div><span>Titular</span><b>GasLara C.A. · {EMPRESA.rif}</b></div><Copy size={15} /></button>
              <button onClick={() => copiar(m.total.toFixed(2), "Monto")}>
                <div><span>Monto exacto</span><b>Bs {bs(m.total)}</b></div><Copy size={15} /></button>
            </div>
            <label className="mv-campo"><span>Número de referencia</span>
              <input inputMode="numeric" placeholder="Los dígitos que te dio el banco" value={d.referencia}
                onChange={(e) => setD({ ...d, referencia: e.target.value.replace(/\D/g, "") })} />
              {d.referencia && !refOk && <em className="mv-err">Debe tener al menos 4 dígitos.</em>}
            </label>
            <div className="mv-nota vd"><Zap size={13} /> Validamos tu referencia contra el banco al instante.</div>
          </>
        )}

        {paso === 4 && (
          <>
            <div className="mv-res">
              <div><span>Producto</span><b>{c.nombre}</b></div>
              <div><span>Cantidad</span><b>{num(d.cantidad)} {c.unidad}</b></div>
              <div><span>Horario</span><b>{d.ventana}</b></div>
              <div><span>Dirección</span><b>{C.dir}</b></div>
              {d.nota && <div><span>Nota</span><b>{d.nota}</b></div>}
              <div className="sep" />
              <div><span>Banco</span><b>{bk.nombre}</b></div>
              <div><span>Referencia</span><b>{d.referencia}</b></div>
              <div className="sep" />
              <div><span>Subtotal</span><b>Bs {bs(m.base)}</b></div>
              <div><span>IVA</span><b>{m.exento ? "Exonerado" : `Bs ${bs(m.iva)}`}</b></div>
              <div className="tot"><span>Total</span><b>Bs {bs(m.total)}</b></div>
            </div>
            <div className="mv-nota az"><Info size={13} /> La factura se emite cuando el despacho se cierra, no ahora.</div>
          </>
        )}
      </div>

      <div className="mv-sh-f">
        {paso < 4
          ? <button className="mv-btn pri grande full" disabled={paso === 3 && !refOk} onClick={() => setPaso(paso + 1)}>Continuar</button>
          : <button className="mv-btn pri grande full" onClick={() => onSave(d)}><Check size={18} /> Confirmar pedido</button>}
      </div>
    </>
  );
}

function Listo({ s, onClose }) {
  const bk = banco(s.pago.banco);
  return (
    <>
      <div className="mv-listo">
        <div className="mv-listo-i"><Check size={30} strokeWidth={3} /></div>
        <h2>Pago verificado</h2>
        <p>Confirmamos tus <b>Bs {bs(s.total)}</b> por {bk.nombre}, referencia <b>{s.pago.referencia}</b>.</p>
        <div className="mv-listo-id">{s.id}</div>
        <div className="mv-nota vd"><Truck size={13} /> Tu pedido ya está en la cola de distribución.</div>
      </div>
      <div className="mv-sh-f"><button className="mv-btn pri grande full" onClick={onClose}>Ver mis pedidos</button></div>
    </>
  );
}

/* ═══════════  RECLAMOS  ═══════════ */

const EST = { RECIBIDO: ["Recibido", "a"], EN_PROCESO: ["En proceso", "w"], RESUELTO: ["Resuelto", "o"] };

function ListaReclamos({ misRec, setHoja }) {
  return (
    <>
      <div className="mv-sh-h"><h2>Mis reclamos</h2><button className="mv-x" onClick={() => setHoja({ t: "reclamo" })}><Plus size={20} /></button></div>
      <div className="mv-sh-b">
        {misRec.map((r) => (
          <button className="mv-rec" key={r.id} onClick={() => setHoja({ t: "rec-det", r })}>
            <div className="mv-rec-h"><span>{r.id}</span><span className={`mv-chip ${EST[r.estado][1]}`}>{EST[r.estado][0]}</span></div>
            <b>{r.asunto}</b>
            <span className="mv-rec-t">{r.tipo} · {fecha(r.fecha)}</span>
            {r.respuesta && <div className="mv-rec-ok"><Check size={12} /> Con respuesta</div>}
          </button>
        ))}
        {!misRec.length && <div className="mv-vacio"><MessageSquareWarning size={24} /><p>No tienes reclamos.</p></div>}
      </div>
    </>
  );
}

function ReclamoDet({ r, onClose }) {
  return (
    <>
      <div className="mv-sh-h"><h2>{r.id}</h2><button className="mv-x" onClick={onClose}><X size={19} /></button></div>
      <div className="mv-sh-b">
        <div className="mv-kv chico">
          <div><span>Tipo</span><b>{r.tipo}</b></div>
          <div><span>Fecha</span><b>{fecha(r.fecha)}</b></div>
        </div>
        <h4 className="mv-h4">{r.asunto}</h4>
        <div className="mv-burb mia"><span>Tu reporte</span>{r.detalle}</div>
        {r.respuesta
          ? <div className="mv-burb ellos"><span>GasLara{r.atendio ? ` · ${r.atendio}` : ""}</span>{r.respuesta}</div>
          : <div className="mv-nota w"><Clock size={13} /> En revisión por atención al usuario.</div>}
      </div>
    </>
  );
}

function NuevoReclamo({ mis, onClose, onSave }) {
  const [d, setD] = useState({ tipo: "Demora en despacho", asunto: "", detalle: "", solicitud: "" });
  const ok = d.asunto.trim().length > 4 && d.detalle.trim().length > 9;
  return (
    <>
      <div className="mv-sh-h"><h2>Nuevo reclamo</h2><button className="mv-x" onClick={onClose}><X size={19} /></button></div>
      <div className="mv-sh-b">
        <div className="mv-nota rj"><AlertCircle size={13} /> Si hueles gas, cierra la válvula, ventila y llama al {EMPRESA.tel}.</div>
        <label className="mv-campo"><span>Tipo</span>
          <select value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>
            {["Demora en despacho", "Pago no acreditado", "Producto defectuoso", "Cobro indebido", "Trato del personal", "Fuga de gas", "Otro"].map((t) => <option key={t}>{t}</option>)}
          </select></label>
        <label className="mv-campo"><span>Pedido relacionado</span>
          <select value={d.solicitud} onChange={(e) => setD({ ...d, solicitud: e.target.value })}>
            <option value="">No aplica</option>
            {mis.slice(0, 8).map((s) => <option key={s.id} value={s.id}>{s.id} — {cpt(s.concepto).corto}</option>)}
          </select></label>
        <label className="mv-campo"><span>Asunto</span>
          <input placeholder="Resume el problema" value={d.asunto} onChange={(e) => setD({ ...d, asunto: e.target.value })} /></label>
        <label className="mv-campo"><span>¿Qué pasó?</span>
          <textarea rows={4} placeholder="Fecha, pedido afectado y detalles"
            value={d.detalle} onChange={(e) => setD({ ...d, detalle: e.target.value })} /></label>
      </div>
      <div className="mv-sh-f"><button className="mv-btn pri grande full" disabled={!ok} onClick={() => onSave(d)}>Enviar reclamo</button></div>
    </>
  );
}

/* ═══════════  BANCOS · AYUDA · PERFIL  ═══════════ */

function Bancos({ aviso }) {
  const copiar = (t, l) => { try { navigator.clipboard.writeText(t); aviso(`${l} copiado`); } catch (e) {} };
  return (
    <>
      <div className="mv-sh-h"><h2>Cuentas para pagar</h2></div>
      <div className="mv-sh-b">
        <p className="mv-p">Todas a nombre de <b>GasLara C.A.</b>, Rif: {EMPRESA.rif}. Toca para copiar.</p>
        {BANCOS.map((b) => (
          <button key={b.id} className="mv-banco" onClick={() => copiar(b.cuenta.replace(/-/g, ""), b.movil ? "Teléfono" : "Cuenta")}>
            <div className="mv-bk" style={{ background: b.color }}>{b.movil ? <Smartphone size={14} /> : <Landmark size={14} />}</div>
            <div className="mv-bk-t"><b>{b.nombre}</b><span>{b.cuenta}</span></div>
            <Copy size={15} />
          </button>
        ))}
      </div>
    </>
  );
}

function Ayuda() {
  return (
    <>
      <div className="mv-sh-h"><h2>Cómo funciona</h2></div>
      <div className="mv-sh-b">
        <p className="mv-p">Después de que pagas, tu pedido pasa por estas cuatro etapas:</p>
        {FASES.map((f, i) => {
          const Ico = ICONOS_FASE[i];
          return (
            <div className="mv-ay" key={f.key}>
              <div className="mv-ay-i"><Ico size={16} /></div>
              <div><b>{f.cliente}</b><span>{f.clienteDesc}</span></div>
            </div>
          );
        })}
        <div className="mv-nota az"><Info size={13} /> La factura se emite cuando el despacho se cierra, no cuando pagas.</div>
        <a className="mv-op" href={`tel:${EMPRESA.tel.replace(/\D/g, "")}`}>
          <div className="mv-op-i"><Phone size={17} /></div>
          <div className="mv-op-t"><b>{EMPRESA.tel}</b><span>Atención al usuario</span></div>
          <ChevronRight size={16} className="mv-ar" />
        </a>
      </div>
    </>
  );
}

function PerfilDatos() {
  return (
    <>
      <div className="mv-sh-h"><h2>Mis datos</h2></div>
      <div className="mv-sh-b">
        <div className="mv-kv">
          <div><span>Nombre</span><b>{C.nombre}</b></div>
          <div><span>Cédula</span><b>{C.doc}</b></div>
          <div><span>Código</span><b>{C.id}</b></div>
          <div><span>Contrato</span><b>{C.contrato} · {C.tipoContrato}</b></div>
          <div><span>Teléfono</span><b>{C.tel}</b></div>
          <div><span>Correo</span><b>{C.correo}</b></div>
          <div><span>Dirección</span><b>{C.dir}</b></div>
          <div><span>Sector</span><b>{C.sector}</b></div>
          <div><span>Centro</span><b>{cdtOf(C.cdt).nombre}</b></div>
        </div>
        <div className="mv-nota"><AlertCircle size={13} /> Para cambiar tu dirección debes solicitar el trámite de cambio de dirección.</div>
      </div>
    </>
  );
}

/* ═══════════  ESTILOS  ═══════════ */

function EstilosMovil() {
  return (
    <style>{`
.mv{--ink:#12211E;--ink2:#40534F;--ink3:#7A8C88;--bg:#F5F3EE;--panel:#FFF;--line:#E4E2DB;--line2:#F1EFE9;
--vd:#1E7A4C;--vd2:#2E9A63;--vdw:#E7F4EC;--lm:#E0611F;--lmw:#FCEDE3;--az:#1B5E8A;--azw:#E8F1F8;
--rj:#B3261E;--rjw:#FBEAE8;
--sans:"Inter","SF Pro Text","Segoe UI",system-ui,-apple-system,sans-serif;
--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
font-family:var(--sans);color:var(--ink);-webkit-font-smoothing:antialiased}
.mv *{box-sizing:border-box}
.mv button{font-family:inherit;cursor:pointer}
.mv input,.mv select,.mv textarea{font-family:inherit;font-size:15px}

.mv-stage{min-height:calc(100vh - 46px);background:
 radial-gradient(1100px 620px at 12% 0%,#20362E 0%,transparent 60%),
 linear-gradient(160deg,#101B18,#1A2A24 55%,#101B18);
display:flex;align-items:center;justify-content:center;gap:64px;padding:40px 24px}

.mv-lado{max-width:330px;color:#B8C9C2}
.mv-lado-logo{width:150px;height:auto;display:block;filter:brightness(0) invert(1);opacity:.95}
.mv-lado h2{margin:22px 0 10px;font-size:27px;font-weight:700;color:#fff;letter-spacing:-.7px;line-height:1.2}
.mv-lado p{margin:0 0 22px;font-size:14.5px;line-height:1.6}
.mv-lado ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:11px}
.mv-lado li{display:flex;gap:11px;align-items:center;font-size:14px}
.mv-lado li span{width:24px;height:24px;border-radius:50%;background:var(--vd);color:#fff;
display:grid;place-items:center;font-size:12px;font-weight:700;flex-shrink:0}
.mv-lado-pie{display:flex;gap:12px;align-items:center;margin-top:32px;padding-top:20px;border-top:1px solid #2B3D37}
.mv-lado-pie img{width:44px;height:auto;background:#fff;border-radius:6px;padding:3px}
.mv-lado-pie span{font-size:11.5px;color:#7C918A;line-height:1.5}

.mv-phone{width:392px;height:812px;background:var(--bg);border-radius:46px;position:relative;overflow:hidden;
border:11px solid #06100D;box-shadow:0 40px 80px -20px rgba(0,0,0,.65),0 0 0 2px #2A3B35;
display:flex;flex-direction:column;flex-shrink:0}
.mv-notch{position:absolute;top:9px;left:50%;transform:translateX(-50%);width:110px;height:26px;
background:#06100D;border-radius:16px;z-index:30}
.mv-status{height:44px;display:flex;align-items:center;justify-content:space-between;
padding:0 26px;font-size:13.5px;font-weight:650;color:var(--ink);flex-shrink:0;padding-top:6px}
.mv-status-r{display:flex;gap:5px;align-items:center}
.mv-barra{position:absolute;bottom:7px;left:50%;transform:translateX(-50%);width:128px;height:4.5px;
background:#12211E;opacity:.28;border-radius:3px;z-index:25}

.mv-head{padding:4px 20px 10px;flex-shrink:0;display:flex;align-items:baseline;gap:9px}
.mv-head h1{margin:0;font-size:27px;font-weight:700;letter-spacing:-.8px}
.mv-head-n{font-family:var(--mono);font-size:13px;color:var(--ink3)}
.mv-screen{flex:1;overflow-y:auto;overflow-x:hidden;padding:4px 16px 0;scrollbar-width:none}
.mv-screen::-webkit-scrollbar{display:none}
.mv-fondo{height:104px}

.mv-saludo{display:flex;justify-content:space-between;align-items:flex-start;padding:2px 4px 14px}
.mv-saludo span{font-size:14px;color:var(--ink3)}
.mv-saludo h1{margin:2px 0 0;font-size:27px;font-weight:700;letter-spacing:-.8px}
.mv-camp{width:40px;height:40px;border-radius:50%;background:var(--panel);border:1px solid var(--line);
color:var(--ink2);display:grid;place-items:center}

.mv-ciclo{background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:18px 18px 16px;
display:flex;gap:10px;align-items:center;box-shadow:0 6px 18px -12px rgba(18,33,30,.3)}
.mv-ciclo-l{flex:1;min-width:0}
.mv-eyebrow{display:flex;align-items:center;gap:5px;font-size:10px;text-transform:uppercase;
letter-spacing:.12em;color:var(--ink3);font-weight:700}
.mv-eyebrow.claro{color:#8FB3A3}
.mv-big{font-size:40px;font-weight:700;letter-spacing:-1.8px;line-height:1;margin:9px 0 12px;
display:flex;align-items:baseline;gap:9px}
.mv-big em{font-size:11.5px;font-weight:520;color:var(--ink3);font-style:normal;line-height:1.3}
.mv-meter{height:7px;background:var(--line2);border-radius:4px;overflow:hidden}
.mv-fill{height:100%;background:linear-gradient(90deg,var(--vd),var(--vd2));border-radius:4px;transition:width .6s}
.mv-fill.cerca{background:linear-gradient(90deg,var(--lm),#F5A623)}
.mv-ciclo p{margin:9px 0 0;font-size:12.5px;color:var(--ink2);line-height:1.5}
.mv-bomb{width:74px;height:auto;flex-shrink:0;filter:drop-shadow(0 8px 14px rgba(18,33,30,.14))}
.mv-aclara{display:flex;gap:8px;align-items:flex-start;margin:9px 2px 14px;font-size:11.5px;
color:var(--ink3);line-height:1.5}
.mv-aclara svg{flex-shrink:0;margin-top:1px}

.mv-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 20px;
border:1px solid var(--line);background:var(--panel);color:var(--ink2);border-radius:14px;
font-size:15px;font-weight:600;transition:.12s}
.mv-btn:active{transform:scale(.98)}
.mv-btn.pri{background:var(--vd);border-color:var(--vd);color:#fff}
.mv-btn.pri:disabled{background:#B4C6BC;border-color:#B4C6BC}
.mv-btn.grande{height:52px;font-size:15.5px;border-radius:16px}
.mv-btn.full{width:100%;margin-bottom:14px}
.mv-link{background:none;border:none;padding:0;color:var(--vd);font-size:12.5px;font-weight:600;
display:inline-flex;align-items:center;gap:2px}
.mv-link-c{background:none;border:none;color:var(--vd);font-size:13.5px;font-weight:600;
width:100%;padding:12px 0}

.mv-card{background:var(--panel);border:1px solid var(--line);border-radius:20px;overflow:hidden;margin-bottom:14px}
.mv-card.curso{border-color:#CFE5D8;background:linear-gradient(180deg,#F6FBF8,#fff 70px)}
.mv-card-h{display:flex;justify-content:space-between;align-items:center;padding:14px 16px 10px}
.mv-card-h h3{margin:0;font-size:14px;font-weight:670;display:flex;align-items:center;gap:8px}
.mv-n{font-family:var(--mono);font-size:12px;color:var(--ink3)}
.mv-pulse{width:7px;height:7px;border-radius:50%;background:var(--vd2);
box-shadow:0 0 0 0 rgba(46,154,99,.6);animation:mvp 2s infinite}
@keyframes mvp{70%{box-shadow:0 0 0 8px rgba(46,154,99,0)}100%{box-shadow:0 0 0 0 rgba(46,154,99,0)}}

.mv-track{padding:6px 16px 14px;display:flex;flex-direction:column}
.mv-tr{display:grid;grid-template-columns:24px 1fr;gap:11px}
.mv-tr-rail{display:flex;flex-direction:column;align-items:center}
.mv-tr-dot{width:22px;height:22px;border-radius:50%;background:var(--line2);color:var(--ink3);
display:grid;place-items:center;flex-shrink:0;transition:.3s}
.mv-tr-dot b{font-size:10px;font-weight:700}
.mv-tr.on .mv-tr-dot{background:var(--vd);color:#fff}
.mv-tr.act .mv-tr-dot{box-shadow:0 0 0 3.5px var(--vdw)}
.mv-tr-line{flex:1;width:2px;background:var(--line2);min-height:9px;margin:2px 0}
.mv-tr.on .mv-tr-line{background:var(--vd)}
.mv-tr:last-child .mv-tr-line{display:none}
.mv-tr-txt{padding-bottom:11px;min-width:0}
.mv-tr-txt b{display:block;font-size:12.5px;font-weight:600;color:var(--ink3);line-height:1.35}
.mv-tr.on .mv-tr-txt b{color:var(--ink)}
.mv-tr-txt span{display:block;font-size:11px;color:var(--ink3);margin-top:2px;line-height:1.4}
.mv-mini .mv-track{padding:10px 0 2px}
.mv-mini .mv-tr-txt b{font-size:11.5px}

.mv-curso-f{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px;
background:#FAFBF9;border-top:1px solid var(--line2)}
.mv-curso-f div{display:flex;flex-direction:column;gap:2px;min-width:0}
.mv-curso-f span{font-size:9.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink3);font-weight:700}
.mv-curso-f b{font-size:13px;font-weight:600}

.mv-acc{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:14px}
.mv-acc button{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:14px 8px;
font-size:11.5px;font-weight:580;color:var(--ink2);line-height:1.35;display:flex;flex-direction:column;
align-items:center;gap:8px;text-align:center}
.mv-acc button:active{transform:scale(.97)}
.mv-acc .i{width:38px;height:38px;border-radius:12px;display:grid;place-items:center}
.mv-acc .i.az{background:var(--azw);color:var(--az)}
.mv-acc .i.vd{background:var(--vdw);color:var(--vd)}
.mv-acc .i.nj{background:var(--lmw);color:var(--lm)}

.mv-fila{display:flex;align-items:center;gap:11px;padding:11px 16px;background:none;border:none;
width:100%;text-align:left;border-top:1px solid var(--line2)}
.mv-fila:active{background:#FAFBF9}
.mv-fila-i{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;flex-shrink:0;
background:var(--line2);color:var(--ink2)}
.mv-fila-i.o{background:var(--vdw);color:var(--vd)}
.mv-fila-i.w{background:var(--lmw);color:var(--lm)}
.mv-fila-i.a{background:var(--azw);color:var(--az)}
.mv-fila-t{flex:1;min-width:0}
.mv-fila-t b{display:block;font-size:13.5px;font-weight:600;line-height:1.25}
.mv-fila-t span{display:block;font-size:11px;color:var(--ink3);margin-top:2px}
.mv-fila-r{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
.mv-fila-r b{font-family:var(--mono);font-size:12.5px;font-weight:650}
.mv-ar{color:var(--ink3)}

.mv-chip{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;
padding:2px 8px;border-radius:20px;white-space:nowrap}
.mv-chip.o{background:var(--vdw);color:var(--vd)}
.mv-chip.w{background:var(--lmw);color:var(--lm)}
.mv-chip.a{background:var(--azw);color:var(--az)}

.mv-seg{display:flex;background:#E7E5DE;border-radius:12px;padding:3px;margin-bottom:14px}
.mv-seg button{flex:1;border:none;background:none;padding:8px 4px;font-size:12.5px;color:var(--ink3);
border-radius:9px;font-weight:580}
.mv-seg button.on{background:var(--panel);color:var(--ink);font-weight:670;box-shadow:0 1px 3px rgba(18,33,30,.14)}

.mv-ped{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:15px 16px;
text-align:left;margin-bottom:11px;display:flex;flex-direction:column;gap:9px}
.mv-ped:active{transform:scale(.99)}
.mv-ped.act{border-color:#CFE5D8;background:linear-gradient(180deg,#F7FBF9,#fff 56px)}
.mv-ped-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.mv-ped-h b{display:block;font-size:14.5px;font-weight:640}
.mv-ped-h span{display:block;font-size:11px;color:var(--ink3);margin-top:3px}
.mv-ped-f{display:flex;justify-content:space-between;align-items:center;gap:10px;
padding-top:10px;border-top:1px solid var(--line2)}
.mv-ped-f b{font-family:var(--mono);font-size:14px;font-weight:670}
.mv-tags{display:flex;gap:5px;flex-wrap:wrap}
.mv-tags span{font-family:var(--mono);font-size:9.5px;background:var(--line2);color:var(--ink3);
padding:2px 6px;border-radius:5px}
.mv-vacio{text-align:center;padding:40px 16px;color:var(--ink3)}
.mv-vacio p{margin:10px 0 0;font-size:13px}

.mv-perfil{display:flex;gap:13px;align-items:center;background:var(--panel);border:1px solid var(--line);
border-radius:20px;padding:15px 16px;margin-bottom:12px}
.mv-av{width:46px;height:46px;border-radius:50%;background:var(--vd);color:#fff;display:grid;
place-items:center;font-weight:700;font-size:16px;flex-shrink:0}
.mv-perfil b{display:block;font-size:14px;font-weight:640;line-height:1.3;text-transform:capitalize}
.mv-perfil span{display:block;font-size:11.5px;color:var(--ink3);margin-top:3px;font-family:var(--mono)}
.mv-contrato{background:var(--ink);color:#fff;border-radius:20px;padding:18px;margin-bottom:12px}
.mv-contrato-id{font-family:var(--mono);font-size:25px;font-weight:680;letter-spacing:-.8px;margin:8px 0 3px}
.mv-contrato-s{font-size:13px;color:#BCCFC9}
.mv-contrato-g{display:flex;gap:22px;margin-top:15px;padding-top:14px;border-top:1px solid #2A3B35}
.mv-contrato-g div{display:flex;flex-direction:column;gap:3px}
.mv-contrato-g span{font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:#8FB3A3;font-weight:700}
.mv-contrato-g b{font-family:var(--mono);font-size:15px;font-weight:670}

.mv-op{display:flex;align-items:center;gap:12px;padding:13px 16px;background:none;border:none;width:100%;
text-align:left;border-top:1px solid var(--line2);text-decoration:none;color:inherit}
.mv-card .mv-op:first-child{border-top:none}
.mv-op:active{background:#FAFBF9}
.mv-op-i{width:34px;height:34px;border-radius:11px;background:var(--line2);color:var(--ink2);
display:grid;place-items:center;flex-shrink:0}
.mv-op-t{flex:1;min-width:0}
.mv-op-t b{display:block;font-size:14px;font-weight:600}
.mv-op-t span{display:block;font-size:11.5px;color:var(--ink3);margin-top:2px}
.mv-badge{font-style:normal;font-size:10.5px;background:var(--lm);color:#fff;padding:1px 7px;
border-radius:20px;font-weight:700;font-family:var(--mono)}
.mv-salir{width:100%;background:none;border:none;color:var(--rj);font-size:14px;font-weight:600;
padding:14px;display:flex;align-items:center;justify-content:center;gap:8px}
.mv-pie{display:flex;gap:11px;align-items:center;justify-content:center;padding:10px 0 4px}
.mv-pie img{width:34px;height:auto;opacity:.85}
.mv-pie span{font-size:10px;color:var(--ink3);line-height:1.5}

.mv-tabs{position:absolute;bottom:0;left:0;right:0;height:78px;background:rgba(255,255,255,.94);
backdrop-filter:blur(14px);border-top:1px solid var(--line);display:flex;align-items:flex-start;
padding:9px 6px 0;z-index:20}
.mv-tab{flex:1;background:none;border:none;display:flex;flex-direction:column;align-items:center;gap:3px;
color:var(--ink3);font-size:10px;font-weight:600;padding:2px 0}
.mv-tab.on{color:var(--vd)}
.mv-tab-i{position:relative}
.mv-tab-i i{position:absolute;top:-1px;right:-4px;width:7px;height:7px;border-radius:50%;
background:var(--lm);border:1.5px solid #fff}
.mv-cta{width:56px;height:56px;border-radius:50%;background:var(--vd);color:#fff;border:4px solid var(--bg);
display:grid;place-items:center;margin-top:-20px;flex-shrink:0;
box-shadow:0 8px 20px -4px rgba(30,122,76,.5)}
.mv-cta:active{transform:scale(.94)}

/* HOJAS */
.mv-sheet-bg{position:absolute;inset:0;background:rgba(10,20,17,.45);backdrop-filter:blur(2px);
z-index:40;display:flex;align-items:flex-end;animation:mvf .2s}
@keyframes mvf{from{opacity:0}to{opacity:1}}
.mv-sheet{width:100%;max-height:93%;background:var(--bg);border-radius:26px 26px 0 0;
display:flex;flex-direction:column;animation:mvs .28s cubic-bezier(.2,.9,.25,1);overflow:hidden}
@keyframes mvs{from{transform:translateY(100%)}to{transform:none}}
.mv-grab{width:38px;height:4.5px;background:#CFCFC6;border-radius:3px;margin:9px auto 2px;flex-shrink:0}
.mv-sh-h{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 16px 10px;flex-shrink:0}
.mv-sh-h h2{margin:0;font-size:18px;font-weight:680;letter-spacing:-.4px;flex:1;text-align:center}
.mv-sh-h h2:first-child{text-align:left}
.mv-x{width:32px;height:32px;border-radius:50%;background:#E7E5DE;border:none;color:var(--ink2);
display:grid;place-items:center;flex-shrink:0}
.mv-sh-b{flex:1;overflow-y:auto;padding:4px 16px 20px;display:flex;flex-direction:column;gap:11px;scrollbar-width:none}
.mv-sh-b::-webkit-scrollbar{display:none}
.mv-sh-f{padding:10px 16px calc(14px);border-top:1px solid var(--line);background:var(--panel);flex-shrink:0}
.mv-sh-f .mv-btn{margin-bottom:0}
.mv-pasos{display:flex;gap:5px;padding:0 16px 12px;flex-shrink:0}
.mv-pasos i{flex:1;height:3.5px;border-radius:3px;background:#DEDCD4}
.mv-pasos i.on{background:var(--vd)}

.mv-p{margin:0;font-size:13px;color:var(--ink2);line-height:1.55}
.mv-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink3);font-weight:700;margin-top:4px}
.mv-h4{margin:2px 0;font-size:16px;font-weight:660;line-height:1.35}
.mv-opc{display:flex;align-items:center;gap:11px;padding:12px 13px;border:1.5px solid var(--line);
background:var(--panel);border-radius:15px;text-align:left;width:100%}
.mv-opc.sel{border-color:var(--vd);background:var(--vdw)}
.mv-opc-i{width:34px;height:34px;border-radius:11px;background:var(--line2);color:var(--ink2);
display:grid;place-items:center;flex-shrink:0}
.mv-opc.sel .mv-opc-i{background:var(--vd);color:#fff}
.mv-opc-i.alt{background:var(--lmw);color:var(--lm)}
.mv-opc-t{flex:1;min-width:0}
.mv-opc-t b{display:block;font-size:14px;font-weight:620}
.mv-opc-t span{display:block;font-size:11.5px;color:var(--ink3);margin-top:2px}
.mv-opc-p{font-family:var(--mono);font-size:13px;font-weight:670;text-align:right;flex-shrink:0}
.mv-opc-p em{display:block;font-style:normal;font-size:9px;color:var(--vd);font-weight:700;
text-transform:uppercase;letter-spacing:.07em;margin-top:2px;font-family:var(--sans)}

.mv-campo{display:flex;flex-direction:column;gap:6px}
.mv-campo>span{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink3);font-weight:700}
.mv-campo input,.mv-campo select,.mv-campo textarea{border:1.5px solid var(--line);border-radius:14px;
padding:13px 14px;background:var(--panel);color:var(--ink);outline:none;width:100%;resize:none}
.mv-campo input:focus,.mv-campo select:focus,.mv-campo textarea:focus{border-color:var(--vd2)}
.mv-err{font-style:normal;font-size:11.5px;color:var(--rj)}
.mv-step{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:14px;
width:fit-content;overflow:hidden;background:var(--panel)}
.mv-step button{width:52px;height:50px;border:none;background:none;font-size:22px;color:var(--ink2)}
.mv-step b{width:56px;text-align:center;font-family:var(--mono);font-size:18px;font-weight:680}
.mv-radios{display:flex;flex-direction:column;gap:7px}
.mv-radios button{display:flex;justify-content:space-between;align-items:center;
border:1.5px solid var(--line);background:var(--panel);border-radius:14px;padding:13px 14px;
font-size:13.5px;color:var(--ink2);text-align:left}
.mv-radios button.on{border-color:var(--vd);background:var(--vdw);color:var(--vd);font-weight:620}
.mv-dir{display:flex;align-items:center;gap:11px;border:1.5px solid var(--line);border-radius:14px;
padding:13px;color:var(--ink3);background:var(--panel)}
.mv-dir div{flex:1;min-width:0}
.mv-dir b{display:block;font-size:13px;font-weight:600;color:var(--ink)}
.mv-dir span{display:block;font-size:11px;margin-top:2px}

.mv-monto{background:var(--vdw);border-radius:16px;padding:16px;text-align:center}
.mv-monto span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.1em;
color:var(--vd);font-weight:700}
.mv-monto b{display:block;font-family:var(--mono);font-size:27px;font-weight:700;color:var(--vd);
margin-top:5px;letter-spacing:-1px}
.mv-banco{display:flex;align-items:center;gap:11px;padding:12px 13px;border:1.5px solid var(--line);
background:var(--panel);border-radius:15px;text-align:left;width:100%;color:var(--ink3)}
.mv-banco.sel{border-color:var(--vd);background:var(--vdw)}
.mv-bk{width:32px;height:32px;border-radius:10px;color:#fff;display:grid;place-items:center;flex-shrink:0}
.mv-bk-t{flex:1;min-width:0}
.mv-bk-t b{display:block;font-size:13px;font-weight:620;color:var(--ink);line-height:1.25}
.mv-bk-t span{display:block;font-size:11px;margin-top:2px;font-family:var(--mono)}
.mv-cuenta{background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.mv-cuenta button{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;
background:none;border:none;border-top:1px solid var(--line2);padding:12px 14px;text-align:left;color:var(--ink3)}
.mv-cuenta button:first-child{border-top:none}
.mv-cuenta button:active{background:var(--vdw)}
.mv-cuenta span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.09em;font-weight:700}
.mv-cuenta b{display:block;font-size:13px;font-family:var(--mono);color:var(--ink);margin-top:3px;font-weight:640}

.mv-res{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:15px;
display:flex;flex-direction:column;gap:9px}
.mv-res div{display:flex;justify-content:space-between;gap:12px;font-size:13px;align-items:baseline}
.mv-res span{color:var(--ink3);flex-shrink:0}
.mv-res b{text-align:right;font-weight:600}
.mv-res .sep{border-top:1px solid var(--line2);display:block;padding:0;margin:2px 0}
.mv-res .tot{border-top:1.5px solid var(--ink);padding-top:11px;margin-top:2px}
.mv-res .tot span{color:var(--ink);font-weight:670}
.mv-res .tot b{font-family:var(--mono);font-size:19px;font-weight:700}

.mv-kv{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:4px 15px}
.mv-kv div{display:flex;justify-content:space-between;gap:14px;padding:10px 0;
border-top:1px solid var(--line2);font-size:13px;align-items:baseline}
.mv-kv div:first-child{border-top:none}
.mv-kv span{color:var(--ink3);flex-shrink:0}
.mv-kv b{text-align:right;font-weight:600}
.mv-kv b.vd{color:var(--vd);display:inline-flex;align-items:center;gap:4px}
.mv-kv.chico{background:none;border:none;padding:0}
.mv-kv.chico div{font-size:12.5px;padding:7px 0}
.mv-bloque{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:13px 15px}
.mv-bloque-t{font-size:10px;text-transform:uppercase;letter-spacing:.11em;color:var(--vd);
font-weight:700;margin-bottom:4px}
.mv-total{border-top:1px solid var(--line);padding-top:12px;display:flex;flex-direction:column;gap:7px}
.mv-total div{display:flex;justify-content:space-between;font-size:13px}
.mv-total span{color:var(--ink3)}
.mv-total b{font-family:var(--mono);font-weight:600}
.mv-total .big{border-top:1px solid var(--line);padding-top:10px;margin-top:2px}
.mv-total .big b{font-size:18px;font-weight:700}

.mv-nota{display:flex;gap:8px;align-items:flex-start;background:#EFEDE6;border-radius:13px;
padding:11px 13px;color:var(--ink2);font-size:11.5px;line-height:1.5;margin:2px 0}
.mv-nota svg{flex-shrink:0;margin-top:1px}
.mv-nota.az{background:var(--azw);color:var(--az)}
.mv-nota.vd{background:var(--vdw);color:var(--vd)}
.mv-nota.rj{background:var(--rjw);color:var(--rj)}
.mv-nota.w{background:var(--lmw);color:var(--lm)}

.mv-rec{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;
text-align:left;display:flex;flex-direction:column;gap:6px}
.mv-rec-h{display:flex;justify-content:space-between;align-items:center;gap:10px}
.mv-rec-h span:first-child{font-family:var(--mono);font-size:11.5px;color:var(--ink3);font-weight:650}
.mv-rec b{font-size:14px;font-weight:620;line-height:1.35}
.mv-rec-t{font-size:11.5px;color:var(--ink3)}
.mv-rec-ok{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--vd);font-weight:580}
.mv-burb{border-radius:15px;padding:13px 14px;font-size:13px;line-height:1.55}
.mv-burb span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;
font-weight:700;opacity:.6;margin-bottom:5px}
.mv-burb.mia{background:#E7E5DE;color:var(--ink2)}
.mv-burb.ellos{background:var(--vdw);color:#16543A}
.mv-ay{display:flex;gap:12px;align-items:flex-start}
.mv-ay-i{width:32px;height:32px;border-radius:10px;background:var(--vdw);color:var(--vd);
display:grid;place-items:center;flex-shrink:0}
.mv-ay b{display:block;font-size:13.5px;font-weight:620}
.mv-ay span{display:block;font-size:12px;color:var(--ink3);margin-top:2px;line-height:1.45}

.mv-listo{padding:26px 22px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px}
.mv-listo-i{width:62px;height:62px;border-radius:50%;background:var(--vdw);color:var(--vd);display:grid;place-items:center}
.mv-listo h2{margin:4px 0 0;font-size:21px;font-weight:700;letter-spacing:-.5px}
.mv-listo p{margin:0;font-size:13.5px;color:var(--ink2);line-height:1.55}
.mv-listo-id{font-family:var(--mono);font-size:16px;font-weight:680;background:#E7E5DE;
padding:6px 14px;border-radius:9px}

.mv-login{flex:1;display:flex;flex-direction:column;padding:0 26px 26px;overflow-y:auto}
.mv-login-top{padding:26px 0 30px;text-align:center}
.mv-login-top img{width:150px;height:auto;margin:0 auto;display:block}
.mv-login-rif{font-size:10.5px;color:var(--ink3);font-family:var(--mono);margin-top:8px}
.mv-login-b{display:flex;flex-direction:column;gap:13px}
.mv-login-b h2{margin:0;font-size:25px;font-weight:700;letter-spacing:-.7px}
.mv-login-b p{margin:-6px 0 6px;font-size:13.5px;color:var(--ink3);line-height:1.55}
.mv-login-sep{display:flex;align-items:center;gap:12px;color:var(--ink3);font-size:12px}
.mv-login-sep::before,.mv-login-sep::after{content:"";flex:1;height:1px;background:var(--line)}
.mv-login-pie{margin-top:auto;padding-top:24px;display:flex;gap:11px;align-items:center;justify-content:center}
.mv-login-pie img{width:36px;height:auto;opacity:.85}
.mv-login-pie span{font-size:10.5px;color:var(--ink3);line-height:1.5}

.mv-toast{position:absolute;bottom:96px;left:50%;transform:translateX(-50%);background:var(--ink);
color:#fff;display:flex;align-items:center;gap:8px;padding:11px 16px;border-radius:13px;font-size:12.5px;
z-index:50;box-shadow:0 10px 26px rgba(10,20,17,.4);white-space:nowrap;animation:mvu .22s}
@keyframes mvu{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}

@media(max-width:1080px){.mv-lado{display:none}.mv-stage{padding:24px}}
@media(max-width:520px){
 .mv-stage{padding:0;background:var(--bg);min-height:calc(100vh - 46px);align-items:stretch}
 .mv-phone{width:100%;height:calc(100vh - 46px);border-radius:0;border:none;box-shadow:none}
 .mv-notch{display:none}
 .mv-status{display:none}
 .mv-head{padding-top:14px}
 .mv-barra{display:none}
 .mv-tabs{padding-bottom:env(safe-area-inset-bottom)}
}
@media(prefers-reduced-motion:reduce){.mv *{animation:none!important;transition:none!important}}
`}</style>
  );
}
