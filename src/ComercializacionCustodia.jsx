import React, { useMemo, useState } from "react";
import { Download, Landmark, ShieldAlert, X } from "lucide-react";
import {
  EMPRESA, HOY, comunaOf, cdtOf, usr, cpt, bs, num, fechaGuion,
  descargar, csv, kgALitros, kgDeSolicitud,
} from "./datos.jsx";
import { GestionStyles } from "./ComercializacionGestion.jsx";

/* ════════════════════════════════════════════════════════════════
   CONSIGNACIÓN COMUNAL
   La comuna recibe mercancía en custodia, no la compra. Lo que recibió y
   no entregó es un saldo del que responde ante la empresa.
   ════════════════════════════════════════════════════════════════ */

export function ConsignacionComunal({ consignaciones = [], solicitudes = [] }) {
  const [sel, setSel] = useState(null);

  const totRecibidas = consignaciones.reduce((a, c) => a + c.recibidas, 0);
  const totEntregadas = consignaciones.reduce((a, c) => a + c.entregadas, 0);
  const totCustodia = consignaciones.reduce((a, c) => a + c.enCustodia, 0);
  const valorCustodia = consignaciones.reduce((a, c) => a + c.valorEnCustodia, 0);
  const kgCustodia = consignaciones.reduce((a, c) => a + c.kgEnCustodia, 0);
  const cumplimiento = totRecibidas ? (totEntregadas / totRecibidas) * 100 : 0;

  function exportar() {
    descargar("consignacion-comunal.csv", csv([
      ["CUENTA DE CONSIGNACIÓN COMUNAL"], [EMPRESA.nombre, `Rif: ${EMPRESA.rif}`], ["Corte", fechaGuion(HOY)],
      ["Figura", "La comuna recibe en custodia. Responde ante la empresa por lo que no entregue."], [],
      ["Comuna", "CDT", "Responsable", "Recibidas", "Entregadas", "En custodia", "Incidencias",
       "Kg en custodia", "Litros en custodia", "Valor recibido Bs", "Valor entregado Bs", "Valor en custodia Bs", "Cumplimiento %"],
      ...consignaciones.map((c) => {
        const co = comunaOf(c.comuna);
        return [co.nombre, cdtOf(co.cdt).corto, co.coordinador, c.recibidas, c.entregadas, c.enCustodia,
          c.incidencias, c.kgEnCustodia.toFixed(2), kgALitros(c.kgEnCustodia).toFixed(2),
          c.valorRecibido.toFixed(2), c.valorEntregado.toFixed(2), c.valorEnCustodia.toFixed(2),
          c.cumplimiento.toFixed(1)];
      }),
      [], ["TOTALES", "", "", totRecibidas, totEntregadas, totCustodia, "", kgCustodia.toFixed(2), "",
        "", "", valorCustodia.toFixed(2), cumplimiento.toFixed(1)],
    ]));
  }

  return (
    <div className="cg2">
      <GestionStyles />
      <div className="cg2-hero">
        <div>
          <span>MERCANCÍA EN CUSTODIA DE TERCEROS</span>
          <h2>Consignación comunal</h2>
          <p>La venta ocurre al despachar desde planta al punto de distribución. La comuna no compra:
             recibe la mercancía en custodia y responde ante la empresa por lo que no entregue.
             El usuario no le reclama a la comuna — la comuna le responde a GasLara.</p>
        </div>
        <div className="cg2-hero-side">
          <div className={`cg2-pill ${totCustodia > 0 ? "closed" : ""}`}>
            <Landmark size={14} /> {num(totCustodia)} en custodia
          </div>
          <button className="btn sm" onClick={exportar}><Download size={14} /> CSV</button>
        </div>
      </div>

      <div className="cg2-kpis">
        <K label="Despachado a comunas" value={num(totRecibidas)} note="cilindros facturados al despachar" />
        <K label="Entregado al usuario" value={num(totEntregadas)} note="confirmado por el portal comuna" tone="ok" />
        <K label="En custodia" value={num(totCustodia)} note={`${num(kgCustodia)} kg sin repartir`} tone={totCustodia ? "warn" : "ok"} />
        <K label="Valor bajo custodia" value={`Bs ${bs(valorCustodia)}`} note="responsabilidad de las comunas" tone="money" />
        <K label="Cumplimiento" value={`${cumplimiento.toFixed(1)}%`} note="entregado sobre recibido" tone={cumplimiento >= 90 ? "ok" : "warn"} />
      </div>

      <div className="cg2-regla">
        <ShieldAlert size={17} />
        <div>
          <b>Quién responde por la mercancía que no llega al usuario.</b>
          <span>Al despachar se emite la factura y el GLP sale del inventario: la venta ya ocurrió.
            A partir de ese momento la comuna es responsable del producto hasta entregarlo. Si un usuario
            reclama que pagó y no recibió, el reclamo se resuelve contra la comuna consignataria,
            no contra el usuario.</span>
        </div>
      </div>

      <section className="card">
        <div className="card-h">
          <div><h2>Cuenta por comuna <span className="cnt">{consignaciones.length}</span></h2>
            <span className="card-note">Ordenadas por lo que tienen sin repartir.</span></div>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Comuna</th><th>Responsable</th><th className="r">Recibidas</th><th className="r">Entregadas</th>
              <th className="r">En custodia</th><th className="r">Kg / L</th><th className="r">Valor Bs</th><th>Cumplimiento</th><th></th></tr></thead>
            <tbody>
              {consignaciones.map((c) => {
                const co = comunaOf(c.comuna);
                return (
                  <tr key={c.comuna}>
                    <td><div className="u-name">{co.nombre}</div><div className="u-doc">{cdtOf(co.cdt).corto} · {co.sector}</div></td>
                    <td><div className="u-name sm">{co.coordinador}</div><div className="u-doc">{co.tel}</div></td>
                    <td className="r mono">{num(c.recibidas)}</td>
                    <td className="r mono">{num(c.entregadas)}</td>
                    <td className="r mono strong">{c.enCustodia > 0 ? <span className="cg2-cargo">{num(c.enCustodia)}</span> : <span className="muted">0</span>}</td>
                    <td className="r mono">{num(c.kgEnCustodia)} / {num(kgALitros(c.kgEnCustodia))}</td>
                    <td className="r mono strong">{bs(c.valorEnCustodia)}</td>
                    <td>
                      <div className="cc-barra"><i style={{ width: `${Math.min(100, c.cumplimiento)}%`, background: c.cumplimiento >= 90 ? "#1B7A4C" : c.cumplimiento >= 60 ? "#9A6410" : "#A83E3E" }} /></div>
                      <span className="u-doc">{c.cumplimiento.toFixed(1)}%</span>
                    </td>
                    <td className="r"><button className="btn sm" onClick={() => setSel(c)}>Ver detalle</button></td>
                  </tr>
                );
              })}
              {!consignaciones.length && <tr><td colSpan={9} className="cg2-empty">
                Todavía no se ha despachado ninguna jornada comunal. La consignación aparece al cerrar una AD desde Operaciones.
              </td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {sel && <DetalleConsignacion c={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function DetalleConsignacion({ c, onClose }) {
  const co = comunaOf(c.comuna);
  const pendientes = c.detalle.filter((s) => !(s.retiradoPorUsuario || s.estadoRetiroComuna === "RETIRADA"));
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cg2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div><div className="mh-eyebrow">Consignación</div><h3>{co.nombre}</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-b">
          <div className="cg2-saldo-head">
            <div><span>Responsable</span><b>{co.coordinador}</b></div>
            <div><span>Punto</span><b>{co.punto}</b></div>
            <div className="big"><span>Bajo su custodia</span><b>{num(c.enCustodia)} cilindros · Bs {bs(c.valorEnCustodia)}</b></div>
          </div>
          <div className="cg2-sep">Personas que aún no han retirado ({pendientes.length})</div>
          <div className="scroll cg2-cuenta">
            <table className="tbl">
              <thead><tr><th>Usuario</th><th>Documento</th><th>Producto</th><th className="r">Kg</th><th className="r">Valor Bs</th><th>Estado</th></tr></thead>
              <tbody>
                {pendientes.slice(0, 60).map((s) => (
                  <tr key={s.id}>
                    <td><div className="u-name sm">{usr(s.usuario).nombre}</div><div className="u-doc">{s.id}</div></td>
                    <td className="mono">{usr(s.usuario).doc}</td>
                    <td className="c-name">{cpt(s.concepto).corto}</td>
                    <td className="r mono">{num(kgDeSolicitud(s))}</td>
                    <td className="r mono strong">{bs(s.total)}</td>
                    <td><span className={`chip ${s.estadoRetiroComuna === "INCIDENCIA" ? "pri-alta" : "st-pag"}`}>
                      {s.estadoRetiroComuna === "INCIDENCIA" ? "Incidencia" : "Pendiente de retiro"}</span></td>
                  </tr>
                ))}
                {!pendientes.length && <tr><td colSpan={6} className="cg2-empty">La comuna entregó todo lo que recibió.</td></tr>}
              </tbody>
            </table>
          </div>
          {pendientes.length > 60 && <div className="cg2-hint">Mostrando 60 de {pendientes.length}. Exporta el CSV para el detalle completo.</div>}
        </div>
        <div className="modal-f"><button className="btn" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}

/* El módulo Parque de envases se retiró el 01/09/2026.
   El envase se sigue registrando y validando; lo que se quitó es la pantalla que lo
   listaba. La regla del canje se aplica donde importa —al crear la solicitud y al marcar
   a cada persona en la jornada— y ahí es donde alguien la necesita ver. Una tabla de
   miles de seriales que nadie consulta no es control, es inventario de pantallas.
   El dato vive en `parqueDelPadron()` y en `validarCanje()`. */

/* La bandeja de conciliación se retiró el 01/09/2026.
   Con el pago confirmado por API contra el banco, el 99% queda casado sin intervención:
   una cola donde cada pago espera aprobación humana era un cuello de botella inútil.
   Lo que sí exige criterio —monto que no coincide, referencia duplicada— vive ahora
   como el segmento «Resueltas por regla» dentro de Solicitudes, junto al expediente. */


function K({ label, value, note, tone = "" }) {
  return <div className={`cg2-k ${tone}`}><span>{label}</span><b>{value}</b><small>{note}</small></div>;
}

export function CustodiaStyles() {
  return <style>{`
.cc-barra{height:6px;background:#EDF1F3;border-radius:99px;overflow:hidden;min-width:70px;margin-bottom:3px}
.cc-barra i{display:block;height:100%;border-radius:99px}
.cc-acciones{display:flex;gap:5px;justify-content:flex-end}
`}</style>;
}
