import React from "react";
import { KG_POR_LITRO_GLP, composicionGLP, kgALitros, litrosAKg, num } from "./datos.jsx";

/**
 * UNIDADES DEL GLP · KG Y LITROS SIEMPRE JUNTOS
 *
 * El GLP se compra por litro y se vende por kilo. Quien lleva la contabilidad necesita
 * la cifra fiscal (kg, que es como se factura) y quien lleva la planta necesita la
 * volumétrica (L, que es como se mide el tanque y el medidor de la gandola). Mostrar
 * una sola obliga a convertir de cabeza, y ahí es donde se cometen los errores.
 *
 * Regla del sistema: **ninguna cantidad de GLP se muestra en una sola unidad.** Las dos
 * van al mismo tamaño de fuente, una al lado de la otra, para que ninguna se lea como
 * la nota al pie de la otra.
 *
 * Un solo factor manda —`KG_POR_LITRO_GLP`, definido por la composición activa— y toda
 * conversión del sistema pasa por aquí. Si mañana la Gerencia cambia la composición,
 * cambia en un sitio y el prototipo entero queda coherente.
 */

/** Texto plano, para CSV, títulos y tooltips donde no cabe un componente. */
export const kgYL = (kg, dec = 0) =>
  `${num(Number(kg || 0))} kg · ${num(kgALitros(Number(kg || 0)))} L`;

export const lYKg = (litros, dec = 0) =>
  `${num(Number(litros || 0))} L · ${num(litrosAKg(Number(litros || 0)))} kg`;

/**
 * Las dos medidas, al mismo tamaño.
 *   <KgL kg={120} />       →  120 kg · 222 L
 *   <KgL litros={2000} />  →  1.080 kg · 2.000 L   (entra por litros, sale igual)
 *
 * `orden="L"` pone el litro primero, para pantallas de planta y granel donde la
 * medición nace volumétrica.
 */
export function KgL({ kg, litros, orden = "KG", tono = "", size, titulo }) {
  const k = litros != null ? litrosAKg(litros) : Number(kg || 0);
  const l = litros != null ? Number(litros) : kgALitros(k);
  const estilo = size ? { fontSize: size } : undefined;
  const kgSpan = <span className="kgl-v">{num(k)}<i>kg</i></span>;
  const lSpan = <span className="kgl-v">{num(l)}<i>L</i></span>;
  return (
    <span className={`kgl ${tono}`} style={estilo}
      title={titulo || `${num(k)} kg equivalen a ${num(l)} litros · factor ${KG_POR_LITRO_GLP} kg/L (${composicionGLP().nombre})`}>
      {orden === "L" ? lSpan : kgSpan}
      <b className="kgl-sep">·</b>
      {orden === "L" ? kgSpan : lSpan}
    </span>
  );
}

/** Versión apilada, para tarjetas y KPI donde el ancho no da para una sola línea. */
export function KgLBloque({ kg, litros, label, tono = "" }) {
  const k = litros != null ? litrosAKg(litros) : Number(kg || 0);
  const l = litros != null ? Number(litros) : kgALitros(k);
  return (
    <div className={`kgl-bloque ${tono}`}>
      {label && <span className="kgl-lbl">{label}</span>}
      <div className="kgl-par">
        <b>{num(k)}<i>kg</i></b>
        <b>{num(l)}<i>L</i></b>
      </div>
    </div>
  );
}

/** Nota de conversión, para encabezados de módulo. Explica el factor una sola vez. */
export function NotaFactor() {
  const c = composicionGLP();
  return (
    <span className="kgl-nota">
      1 L = {String(KG_POR_LITRO_GLP).replace(".", ",")} kg · {c.nombre}
    </span>
  );
}

export function UnidadesStyles() {
  return <style>{`
/* Las dos medidas pesan lo mismo: mismo tamaño, mismo color, mismo grosor.
   Lo único que las separa es el punto medio.

   Van con prefijo body y doble clase a propósito. Las hojas de cada módulo se inyectan
   después y traen reglas como .cm-inv-name span { display:block; font-size:7.5px } que
   alcanzan a este componente por descendencia: sin más especificidad, partían el par en
   dos líneas con letra ilegible. La regla del sistema —las dos unidades juntas y al mismo
   tamaño— no puede quedar a merced de en qué pantalla se pinte. */
body .kgl,body span.kgl,body td .kgl,body b .kgl{
  display:inline-flex!important;align-items:baseline;gap:6px;
  font-variant-numeric:tabular-nums;white-space:nowrap;letter-spacing:normal;
  color:inherit;margin:0;
  /* Piso de legibilidad. Algunas tarjetas heredadas bajan a 7,5 px, y una cifra de
     inventario a ese tamaño no se lee: hereda el tamaño del contexto, pero nunca por
     debajo de 11,5 px. */
  font-size:max(11.5px,1em)!important;
}
body .kgl .kgl-v,body .kgl span.kgl-v{
  display:inline!important;font-size:1em!important;font-weight:inherit;color:inherit;
  letter-spacing:normal;margin:0;
}
body .kgl .kgl-v i{font-style:normal;font-size:.88em;font-weight:600;opacity:.75;margin-left:3px;display:inline}
body .kgl .kgl-sep{display:inline!important;font-weight:400;opacity:.35;font-size:1em;margin:0}
body .kgl.ok .kgl-v{color:#1F7A4C}
body .kgl.warn .kgl-v{color:#9A6410}
body .kgl.neg .kgl-v{color:#A83E3E}

body .kgl-bloque{display:flex;flex-direction:column;gap:3px;min-width:0}
body .kgl-bloque .kgl-lbl{font-size:11px;color:#6B7B85;font-weight:600;letter-spacing:.02em}
body .kgl-bloque .kgl-par{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
body .kgl-bloque .kgl-par b{
  font-size:19px;font-weight:660;font-variant-numeric:tabular-nums;
  letter-spacing:-.01em;line-height:1.2;color:#252F36;
}
body .kgl-bloque .kgl-par b i{font-style:normal;font-size:.6em;font-weight:600;opacity:.55;margin-left:3px}
body .kgl-bloque.ok .kgl-par b{color:#1F7A4C}
body .kgl-bloque.warn .kgl-par b{color:#9A6410}

body .kgl-nota{
  display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:#516069;
  background:#EEF3F5;border-radius:6px;padding:3px 9px;font-weight:600;letter-spacing:0;
}
body th .kgl,body td .kgl{font-size:inherit}
`}</style>;
}
