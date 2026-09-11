# Retomar el trabajo · GasLara

Documento de traspaso. Última actualización: **11 de septiembre de 2026**, al terminar la
reforma del flujo y de la concordancia de datos. Resume en qué quedó el prototipo, qué se
decidió y qué falta, para continuar sin releer las conversaciones.

La transcripción de la primera sesión está en `sesion-2026-09-10.jsonl.gz` (mismo directorio).

---

## Cómo levantarlo y comprobarlo

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # compila (no detecta identificadores sin importar: mira también la consola)
npm run verificar    # prueba el flujo de punta a punta y que las cifras cuadren entre pantallas
```

Sin backend: todo el estado vive en memoria y se reinicia al recargar. **Correr
`npm run verificar` después de cada cambio**: si algo del flujo o de las cifras deja de
cuadrar, sale con error y dice qué.

---

## Qué es

Prototipo de gestión de GLP para el estado Lara, Venezuela. Seis caras en el conmutador:

| Cara | Qué hace |
|---|---|
| **Proyecto** | Portada: el problema, la solución, el flujo y los accesos |
| **Centro de gestión** | Tablero ejecutivo, reportes, auditoría real y roles (sólo lectura) |
| **Portal del usuario** | El ciudadano pide, paga, completa pagos y sigue su pedido. Con rol de comuna ve a sus miembros y la jornada de su comuna |
| **Distribución** | Planifica AD, lleva la jornada por momentos, replanifica y cierra |
| **Comercialización** | Taquilla, padrón, libro de ventas, saldos, precios y cierre del período |
| **Nómina** | Backoffice interno, independiente del resto |

Dos CDT de Comercialización: **Gral. Jacinto Lara** y **Juan Guillermo Iribarren**.

## El flujo (decidido por el dueño del producto, 11/09/2026)

```
pide y paga (portal o taquilla · la API aplica la regla)
  └─ si falta dinero → POR COMPLETAR (lo cubre primero el saldo, solo)
PAGADA (dinero pendiente por despachar + GLP comprometido)
  → AD de jornada, sólo con pagadas
  → RECOLECCIÓN en el punto comunal (la gente lleva su bombona vacía)
  → LLENADO en planta (las malas no se llenan)
  → DEVOLUCIÓN al mismo punto (salen diez, vuelven diez: llenas o vacías)
  → CIERRE DEL AD: factura al precio del día de salida, BOP, salida de inventario
  └─ si hubo un problema → POR REPLANIFICAR → AD especial por usuario → mismo ciclo
       └─ si vence el plazo (cierre del ciclo) sin replanificar → saldo a favor
```

- **La responsabilidad de la empresa termina en el punto.** Si el dueño retira o no su
  bombona ya no le compete a GasLara: no hay consignación ni entrega a miembros.
- **El saldo a favor es el último recurso** (casi siempre es error del usuario): se descuenta
  solo en el próximo pedido y para cubrir diferencias de tarifa. No hay reembolsos.
- **Precio actual siempre:** los precios cambian cada mes; el saldo es nominal.
- **Tope:** una bombona por núcleo familiar (residencial) por ciclo. Pre-AD sólo decide el
  pago; el parque de envases es un aviso, no un bloqueo.
- **No se tocan:** tipos de gas, precios, exonerado/protegido/crédito, apoyo, programa social.

## La arquitectura

```
src/datos.jsx     El dominio: reglas escritas como constantes, precios versionados, montos,
                  generador de la semilla. Es la fuente de verdad de las reglas.
src/flujo.js      Las transiciones (funciones puras) y las cifras que leen todas las pantallas:
                  nuevaSolicitud · completarPago · repreciar · planificarAD · salidaAD ·
                  recoleccionAD · llenadoAD · cerrarADPuro · abonarPedido · vencerPlazos ·
                  cifrasSistema · pedidosDistribucion · gruposPorPlanificar ·
                  bandejaReplanificacion · momentoCiudadano · fichaUsuario360 · bitacoraEventos
src/semilla.js    El estado inicial, construido ejecutando el flujo con esas mismas funciones
src/App.jsx       El estado vivo: aplica los resultados de flujo.js y reparte `compartido`
                  (incluye `cifras`, la única fuente de números para todas las caras)
scripts/verificar.mjs   La prueba del flujo y de la concordancia
```

Estados de la solicitud: `SIN_PAGO · POR_COMPLETAR · PAGADA · EN_AD · POR_REPLANIFICAR ·
CULMINADO · ABONADA`. Estados del AD: `SIN_PLANIFICAR · ASIGNADA · REPROGRAMADA · EN_RUTA
(recolección) · EN_PLANTA · EN_PUNTO (devuelta, lista para cerrar) · INCIDENCIA · CERRADA`.

## Lo que muestra la demo al abrir (14/08/2026)

- **AD 76527** (Rastrojitos Centro) se cerró ayer: 196 convocadas, 168 entregadas,
  27 a replanificación, 1 desistió.
- **AD 76990**, especial por usuario, sale mañana con cinco paradas: dos entregas directas
  de comercio y tres casos replanificados.
- **AD 76950**, la jornada de la comuna del portal (Barquisimeto Centro), está en planta con
  tres vecinos; Pedro Luis no llevó su bombona.
- **Ellard (portal) no tiene pedidos en curso ni saldo**: la demo empieza con su pedido de
  agosto y lo recorre hasta la factura.
- **Hoy:** 76883 en recolección, 76884 en planta y 76902 devuelta al punto, lista para
  cerrar. El resto de las AD están planificadas.
- **Por planificar:** Santa Inés, Peña 1 Las Flores y la institución.
- **Bandeja y pagos:** 24 casos en la bandeja de replanificación y 27 pedidos por completar.
  Hay saldo a favor en 24 usuarios.

## Estado de la verificación (11/09/2026)

- `npm run verificar`: 148 comprobaciones correctas. `npm run build`: compila.
- En el navegador se recorrieron todas las caras sin errores de consola y se probaron en vivo
  el cierre de un AD (cuadra al céntimo con el Panel), un AD completo por momentos, un AD
  especial desde la bandeja, la taquilla con pago de menos y «Completar pago», y el rol de
  comuna. El detalle está al final del README («Prueba en el navegador»).
- **El tope se cuenta por la fecha del pedido.** Yolimar pagó su SOL-2471 en julio y se le
  despacha en la jornada del 14/08; por eso en agosto todavía puede pedir. Es la regla tal
  como está escrita; si la Gerencia quiere que un pedido sin despachar bloquee el ciclo
  siguiente, el cambio va en `consumoDelCiclo` (datos.jsx).
- **Distribución no ve bolívares** (regla del dueño del producto): el cierre muestra facturas
  emitidas, no montos; el arqueo de planta móvil está en Comercialización → Ventas sin contrato.
- **Incidencias por cliente al cerrar:** la ventana de cierre permite anotar o corregir lo que
  pasó con cada persona (`corregirJornadaAD` en flujo.js); rehace los movimientos de planta de
  esa AD y deja traza en la bitácora del AD y en la auditoría.
- **App móvil de operadores** (`src/AppOperador.jsx`): despacho de AD sin cobro (clientes que pagaron y no, incidencias por persona, «Despachado»; el AD lo cierra sólo Distribución) y venta en planta móvil con cobro y cierre de caja. Funciones en flujo.js: `clientesDeAD`, `marcarDespachadoAD`, `ventaPlantaMovil`, `cajaPlantaMovil`.
- **Libro de ventas**: tipo de despacho, condición tarifaria e IVA en cada fila.
- **`.vite/` está versionado** en git aunque ya está en `.gitignore`: al hacer el próximo
  commit, quitarlo con `git rm -r --cached .vite`.

## Lo que queda pendiente de definición

- **Ciclo real:** GasLara trabaja hoy cada 15 a 18 días por comunidad; el prototipo usa el
  mes calendario para el tope y para el plazo de replanificación.
- **Cierre del AD en dos manos** (Distribución actualiza atendidos, Comercialización factura):
  hoy lo cierra Distribución. Alternativa propuesta: cierre automático cuando cuadra y doble
  aprobación sólo cuando hay diferencias.
- **Cómo reporta el conductor** desde la calle (hoy se asume que Distribución transcribe).
- **Capacidad del vehículo:** el planificador avisa cuántos viajes hacen falta pero no bloquea.
- **Correlativo del número de control:** deriva del número de pedido y salta. SENIAT exige
  correlativo continuo asignado por imprenta digital autorizada.
- **EPSDC 30 %:** ninguna fuente pública lo confirma.
- **Cupo del usuario protegido** (18 kg) y **tipo de usuario por nivel** en granel.
- **Vencimiento del saldo a favor:** hoy no caduca.
- **Qué es «TIPS»** en el requerimiento de la O.A.U.
- **Nómina**, para un abogado laboral: bono vacacional (Art. 192), días adicionales de
  garantía (Art. 142 b) y liquidación sin anticipos ni intereses.

## Advertencias de trabajo

**Nunca usar `Set-Content` de PowerShell sobre los archivos fuente.** Corrompió 775
secuencias UTF-8 en una sesión anterior. Para editar por script, usar Node con
`fs.writeFileSync(path, texto, "utf8")`.

**Cuidado con los literales de plantilla anidados** al parchear con `node -e`: un backtick
dentro de otro rompe el script. Escribir el parche a un archivo `.cjs` y ejecutarlo.

**El build pasa aunque falte un import.** `npm run build` no detecta identificadores no
definidos en tiempo de ejecución: abrir las pantallas y sus modales en el navegador y mirar
la consola. Cada cara está protegida: si una falla, muestra un aviso y no deja la demo en blanco.

**La semilla se construye con el flujo.** Para cambiar los datos de demostración, cambiar
`src/semilla.js` (qué pasa en cada AD) y no escribir registros a mano: así siguen cuadrando.
