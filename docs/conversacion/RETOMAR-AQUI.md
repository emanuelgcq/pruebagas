# Retomar el trabajo · GasLara

Documento de traspaso escrito el **10 de septiembre de 2026** al cambiar de equipo.
Resume en qué quedó el prototipo, qué se decidió y qué falta, para poder continuar sin
releer la conversación completa.

La transcripción íntegra está en `sesion-2026-09-10.jsonl.gz` (mismo directorio). Son
5.244 mensajes; se le quitaron las 38 capturas de pantalla en base64 porque pesaban
10 MB y no aportan al historial.

---

## Cómo levantarlo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # verificación rápida de que todo compila
```

Sin backend: todo el estado vive en memoria en `App.jsx` y se reinicia al recargar.

---

## Qué es

Prototipo de gestión de GLP para el estado Lara, Venezuela. **Seis caras** en el
conmutador superior:

| Cara | Qué hace |
|---|---|
| **Proyecto** | Portada con el problema, la solución y accesos |
| **Centro de gestión** | Dashboard ejecutivo, reportes, auditoría (solo lectura) |
| **Portal del usuario** | El ciudadano pide y paga. Con rol de comuna, además gestiona su lote |
| **Distribución** | Planifica, ejecuta y **cierra** las AD |
| **Comercialización** | Factura, cobra, audita y administra el padrón |
| **Nómina** | Backoffice interno, independiente del resto |

Dos CDT: **Gral. Jacinto Lara** y **Juan Guillermo Iribarren**.

## La arquitectura, en una frase

**Un solo objeto —la solicitud— atraviesa los tres módulos operativos.** No hay tres
tablas ni tres verdades: hay una lista de 2.723 solicitudes y tres oficios mirándola
desde ángulos distintos. La propiedad del estado está limpia; nadie escribe donde no le
toca.

```
Cliente        crearSolicitud · crearReclamo · registrarRetiroComuna
Distribución   actualizarRutaDistribucion · crearRutaDistribucionPersonalizada
               cerrarAD · crearMovimientoPlanta
Comercializ.   facturación, padrón, abonos e incidencias previas (13 handlers)
```

Todo se orquesta desde `App.jsx`, que expone `compartido` a las tres caras.

---

## Las reglas de negocio que la Gerencia fijó

Están escritas como constantes y comentarios en `src/datos.jsx`, que es la única fuente
de verdad del dominio.

**El pago lo resuelve una regla, no una persona.** `aplicarReglaPago()` decide al recibir
el dinero: monto exacto, de más (excedente al saldo), de menos (se abona y se cancela,
no hay entrega parcial) y referencia duplicada (se rechaza). Comercialización no aprueba
nada: consulta la bitácora y puede revertir un caso concreto con motivo.

**No hay reembolsos.** `PERMITE_REEMBOLSO = false`. Todo dinero que entra queda abonado
al código del usuario y solo se descarga contra un despacho posterior. `TIPOS_ABONO` no
tiene ningún movimiento que devuelva dinero.

**La factura nace al cerrar el AD, no al pagar.** `cerrarAD()` es el único punto que
asigna serie, control y factura. Y factura al precio del día del despacho, no al del
pedido.

**Cómo es la jornada.** La gente lleva su bombona vacía al punto comunal. El operador la
recoge, se la lleva a planta, la llena y la vuelve a dejar. **Salen diez, vuelven diez.**
El camión NO sale cargado: sale a recoger.

**Las incidencias tienen dos momentos:**
- *Antes del AD* — una sola cosa: pagó o no pagó. Eso decide quién entra.
- *En el sitio* — quién llevó su bombona, cuáles volvieron llenas y cuáles no se pudieron
  llenar por estar malas.

**La bombona mala no se repone.** Vuelve vacía, el envase entra a taller y el dinero le
queda abonado. Los siete motivos de no entrega abonan; ninguno deja a la persona sin gas
y sin dinero.

**Un litro de GLP pesa 0,540 kg** (mezcla 60/40, el factor comercial). La tabla
`COMPOSICIONES_GLP` conserva 0,504 para propano 100% como opción. **Ninguna cantidad de
GLP se muestra en una sola unidad**: kg y L van juntos, al mismo tamaño de fuente
(`src/Unidades.jsx`).

**Tope de una bombona por núcleo familiar por ciclo.** Sin envase vacío no hay canje, y
los formatos no se sustituyen entre sí porque la tarifa es por formato.

---

## Mapa de archivos

```
datos.jsx               El dominio. Reglas, constantes, semilla. 1.750 líneas
Unidades.jsx            kg ↔ L. Un solo factor, siempre las dos unidades
Tema.jsx                Capa de diseño global con prefijo `body`

App.jsx                 Orquestador. Todo el estado y los handlers

PortalUsuario.jsx       El ciudadano
PortalRolComuna.jsx     El rol de comuna (permisología dentro del portal)

Distribucion.jsx        Nav + Resumen + Pedidos + AD del día + Comunas
DistribucionPersonas.jsx  Las personas de un AD: cuadre, lista nominal
DistribucionEjecucion.jsx Panel del gerente: ejecutar, incidencias, cerrar
DistribucionCierreAD.jsx  El cierre persona por persona
DistribucionPlanta.jsx    Movimiento de planta, granel, planta móvil
DistribucionExtra.jsx     Preparación de carga, flota, reasignar

Comercializacion.jsx      Nav + panel + solicitudes + inventario + EPSDC
ComercializacionGestion.jsx   Libro de ventas, saldos, precios, padrón
ComercializacionCustodia.jsx  Consignación comunal
```

---

## Qué se hizo en esta sesión

1. **Automatización de pagos** y retirada de la bandeja de conciliación
2. **Sin reembolsos** — se eliminó el reintegro en efectivo
3. **Huecos cerrados**: alta de usuarios, servicios culminables, estado del padrón
   definible, resumen por tipo de cliente, venta sin contrato con boleta
4. **Nueve caras a seis** — se eliminaron la app móvil del usuario, la del repartidor y
   el Portal Comuna
5. **El AD lo cierra Distribución**, no el conductor
6. **Modelo de la jornada corregido** — el camión sale a recoger, no a repartir
7. **Distribución de 15 entradas a 10**
8. **Cada AD abre a su listado nominal** de personas

Cada bloque está documentado en el `README.md` con su fecha y su porqué.

---

## Lo que queda pendiente

Ordenado por peso. Los cuatro primeros salieron del análisis de los tres módulos y
siguen abiertos.

### 1 · El portal no aplica la regla de pago

`crearSolicitud()` en `App.jsx` escribe el pago a mano —`estado: "VERIFICADO"`, sin
`regla`, sin `canal`, sin `montoRecibido`— y maneja el excedente por su cuenta,
duplicando la lógica de `MONTO_MAYOR`. No contempla transferencia corta ni referencia
duplicada.

Las otras tres vías (semilla, rutas, taquilla) sí pasan por `aplicarReglaPago`. **Una
solicitud creada hoy desde el portal no aparece en la bitácora de Comercialización**,
porque `bitacoraPagos()` filtra por `s.pago.regla`. Es el hueco más serio: está en la vía
que en producción generaría el mayor volumen.

### 2 · El flujo es de una sola vía

El ciudadano no ve **ninguna** decisión que los otros dos módulos toman sobre su pedido:
`motivoNoCompra`, `incidencia`, `retenidaDesde`, `abonadoBs`, `revertida`,
`detalleRegla`, `estadoRetiroComuna` — ninguno se renderiza en `PortalUsuario.jsx`.

El dinero sí vuelve (aparece en "Mi saldo" con su detalle) pero **el motivo atado a su
pedido no vuelve nunca**.

### 3 · La escalera de fases tiene un peldaño muerto y un estado invisible

`FASES` es `SIN_PAGO → POR_CONCILIAR → PAGADA → EN_AD → CULMINADO`.

- **`POR_CONCILIAR` ya no existe** — se retiró cuando la API pasó a resolver los pagos.
  Ninguna solicitud lo alcanza, pero el ciudadano sigue viendo *"Verificando tu pago"*.
- **`ABONADA` no está en la escalera.** `faseIdx("ABONADA")` devuelve `-1` y el Tracker
  enciende con `i <= idx`, así que **no enciende ninguno**. Las 25 personas con solicitud
  abonada ven una barra de progreso vacía sin explicación.
- `esAbonada` está importado en el portal y no se usa.

### 4 · El portal no valida cupo ni envase

`crearSolicitudManual` (taquilla) comprueba `puedeSolicitar` y `validarCanje`. El portal
no comprueba ninguno. Un ciudadano puede pedir por el portal lo que el mismo sistema le
negaría en el mostrador.

### 5 · El cierre del AD sigue en una sola mano

La Gerencia lo quiere controlado por Distribución **y** Comercialización —una actualiza
atendidos, la otra factura y abona. Hoy lo ejecuta solo Distribución. Las piezas existen
sin usar: `entregar()` y `abrirAD()` en `App.jsx` no las llama nadie.

Se dejó fuera a propósito, por decisión explícita.

### 6 · Cómo reporta el conductor

Al retirar la app del repartidor, el prototipo dejó de mostrar **cómo** reporta desde la
calle. Hoy se asume que llama o usa radio y Distribución transcribe. Si va a haber un
canal digital para ese reporte, hay que decidirlo.

---

## Puntos que siguen esperando definición de la Gerencia

- **Vencimiento del saldo a favor**: hoy no caduca. Sin política de prescripción, el
  pasivo se acumula (hoy Bs 32.532,15 entre 49 usuarios).
- **Cupo mensual del usuario protegido**: el prototipo usa 18 kg sin validarlo.
- **Capacidad del vehículo**: 13 de 25 AD de la semilla exceden la capacidad del camión
  asignado, una hasta 247%. El planificador no lo valida.
- **Qué pasa con quien no tiene envase**: hoy queda sin servicio y con su dinero abonado.
  Falta definir si existe una vía para que adquiera uno.
- **Correlativo del número de control**: deriva del número de pedido y por tanto salta.
  SENIAT espera correlativo continuo asignado por imprenta digital autorizada.
- **Tipo de usuario por nivel en granel**: se modeló por volumen mensual contratado. Si
  el criterio es otro —nivel del tanque o nivel tarifario— el corte se ajusta sin tocar
  el resto del módulo.

---

## Advertencias de trabajo

**Nunca usar `Set-Content` de PowerShell sobre los archivos fuente.** Corrompió 775
secuencias UTF-8 en una sesión anterior. Para editar por script, usar Node con
`fs.writeFileSync(path, texto, "utf8")`.

**Cuidado con los literales de plantilla anidados** al parchear con `node -e`: un
backtick dentro de otro rompe el script. Escribir el parche a un archivo `.cjs` y
ejecutarlo.

**El build pasa aunque falte un import.** `npm run build` no detecta identificadores no
definidos en tiempo de ejecución; hay que abrir el navegador y mirar la consola.

**Verificación en navegador**: se usó el protocolo de DevTools de Chrome con el WebSocket
nativo de Node (no hay Playwright ni Puppeteer instalados). Lanzar Chrome con
`--remote-debugging-port=9222 --headless=new` y conectarse a `http://localhost:9222/json`.
