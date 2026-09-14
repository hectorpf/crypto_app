# Crypto Pulse

Dashboard web en dark mode para consultar el precio real de Bitcoin (BTC) y Ethereum (ETH), estudiar sus últimos 30 días y generar escenarios estadísticos configurables.

> Importante: el forecast no adivina el futuro. Resume qué ocurriría si la tendencia y la volatilidad de la muestra histórica elegida continuasen. No es asesoramiento financiero.

## 1. Qué construye el proyecto

La pantalla tiene tres bloques:

1. **Mercado actual**: precio, variación en 24 horas, moneda EUR/USD, actualización automática cada 60 segundos y botón manual.
2. **Histórico interactivo**: ventanas de 1, 7, 14 y 30 días; se puede alternar entre precio, rentabilidad diaria y volatilidad anualizada.
3. **Forecast**: activo BTC/ETH, muestra histórica de 7/14/30 días y horizonte de 1/3/7/14/30 días. Presenta escenario optimista, base, pesimista y una banda de incertidumbre del 80%.

La app **no incluye datos de demostración ni precios de reserva**. Si CoinGecko falla, la interfaz informa del error y no sustituye la respuesta por números inventados.

## 2. Arquitectura explicada como profesor

```text
Navegador (app/page.tsx)
        |
        | GET /api/market?currency=...&asset=...&history=...&horizon=...
        v
API del servidor (app/api/market/route.ts)
        |-- acceso a datos: lib/crypto/data-source.ts
        |-- cálculos:       lib/finance/metrics.ts
        `-- predicción:     lib/forecast/model.ts
```

Esta separación tiene una intención didáctica clara:

- `app/page.tsx` se ocupa sólo de la experiencia de usuario: estado, selectores, refresco y gráficas.
- `lib/crypto/data-source.ts` es la única pieza que habla con CoinGecko. Valida la respuesta y transforma el histórico en cierres diarios.
- `lib/finance/metrics.ts` calcula retornos logarítmicos, desviación estándar y volatilidad anualizada.
- `lib/forecast/model.ts` construye los escenarios. Al estar aislado, el modelo puede cambiarse más adelante sin reescribir la pantalla.
- `app/api/market/route.ts` coordina las capas, valida todos los parámetros y devuelve un error HTTP 502 si la fuente real no responde.

La URL de CoinGecko sólo aparece en código de servidor gracias a `server-only`. La API pública empleada no necesita clave. Si en el futuro se añade una clave Pro, debe guardarse en `.env.local` y leerse únicamente desde `data-source.ts`, nunca desde variables con prefijo `NEXT_PUBLIC_`.

El acceso a datos conserva durante 30 segundos la última respuesta válida de cada moneda. Así, cambiar controles recalcula el forecast sin repetir tres llamadas externas. El botón **Actualizar** y el ciclo automático de 60 segundos omiten esa caché y consultan de nuevo la fuente. Un fallo nunca se guarda como si fuera un precio.

## 3. Cómo funciona el modelo

El modelo parte de los retornos logarítmicos diarios:

```text
r(t) = ln(precio(t) / precio(t-1))
```

Con la media de esos retornos obtiene la deriva diaria y con su desviación estándar obtiene la volatilidad. Para cada día futuro calcula:

- **Base**: mantiene la deriva media observada.
- **Optimista**: añade una desviación típica escalada por la raíz del tiempo.
- **Pesimista**: resta esa desviación típica.
- **Intervalo 80%**: usa `1,28 × volatilidad × raíz(días)` alrededor del escenario base.

Cambiar la muestra histórica modifica la media y la volatilidad; cambiar el horizonte modifica el número de puntos y amplía la incertidumbre. Por eso los controles modifican el resultado de verdad.

## 4. Dependencias principales

- **Next.js**: frontend React y endpoint backend dentro del mismo proyecto.
- **React**: estado y actualización de los controles.
- **Recharts**: gráficas interactivas, tooltips y banda de incertidumbre.
- **Lucide React**: iconos accesibles y ligeros.
- **TypeScript**: contratos de datos y validación durante el build.
- **Tailwind CSS**: procesa la hoja global; el diseño específico está escrito en CSS semántico.

## 5. Guía desde cero: descargar y ejecutar la aplicación

Esta sección está pensada para una persona que nunca ha clonado ni ejecutado un proyecto.

### Paso 1. Instalar los programas necesarios

Necesitas dos programas gratuitos:

1. **Git**, para descargar el proyecto. Se obtiene desde [git-scm.com/downloads](https://git-scm.com/downloads). Durante la instalación puedes aceptar las opciones predeterminadas.
2. **Node.js 22 o superior**, para ejecutar la aplicación. Descarga una versión LTS desde [nodejs.org](https://nodejs.org/). La instalación de Node incluye `npm`, que instalará las dependencias.

Después de instalarlos, abre **PowerShell** en Windows o una terminal en macOS/Linux y comprueba que funcionan:

```bash
git --version
node --version
npm --version
```

Cada comando debe mostrar un número de versión. Si aparece «no se reconoce el comando», cierra la terminal, vuelve a abrirla y repite la prueba.

### Paso 2. Clonar el repositorio

Elige una carpeta fácil de encontrar. Por ejemplo, para guardarlo en el Escritorio, abre una terminal y escribe:

```bash
cd Desktop
git clone https://github.com/hectorpf/crypto_app.git
cd crypto_app
```

`git clone` crea una copia completa del proyecto. `cd crypto_app` entra en esa nueva carpeta.

Si no quieres utilizar Git, abre [github.com/hectorpf/crypto_app](https://github.com/hectorpf/crypto_app), pulsa **Code → Download ZIP**, descomprime el archivo y abre una terminal dentro de la carpeta descomprimida.

### Paso 3. Instalar las dependencias

Dentro de la carpeta `crypto_app`, ejecuta:

```bash
npm ci
```

Este comando lee `package-lock.json` e instala las mismas versiones de las librerías utilizadas para desarrollar la app. Sólo es necesario la primera vez o cuando se actualicen las dependencias.

### Paso 4. Arrancar la aplicación

Ejecuta:

```bash
npm run dev
```

Cuando aparezca el mensaje `Ready`, abre un navegador y visita:

```text
http://127.0.0.1:3000
```

Mantén la terminal abierta mientras utilizas la app. Para detenerla, vuelve a la terminal y pulsa `Ctrl + C`.

### Paso 5. Obtener futuras actualizaciones

Si clonaste el repositorio con Git, entra de nuevo en su carpeta y ejecuta:

```bash
git pull
npm ci
npm run dev
```

### Problemas frecuentes

- **El puerto 3000 ya está ocupado**: cierra otra aplicación que esté usando ese puerto y repite `npm run dev`.
- **No aparecen precios**: comprueba la conexión a Internet. CoinGecko puede limitar temporalmente las consultas y devolver un error 429; espera un minuto y pulsa **Actualizar**.
- **Falla `npm ci`**: comprueba que estás dentro de la carpeta `crypto_app` y que existe el archivo `package.json`.
- **Una red escolar o corporativa bloquea la API**: prueba desde otra red o consulta al administrador. La app necesita acceder a `api.coingecko.com`.

### Comprobar la versión de producción

No es necesario para usar la app, pero permite verificar que el proyecto compila correctamente:

```bash
npm run build
npm start
```

## 6. Pruebas manuales recomendadas

1. Comprueba que BTC y ETH muestran hora de consulta y fuente CoinGecko.
2. Pulsa **Actualizar** y verifica que aparece el estado de carga y se renueva la hora.
3. Cambia EUR/USD y confirma que precios, ejes, tooltips y forecast cambian de moneda.
4. Cambia entre 1D, 7D, 14D y 30D y observa que el número de puntos del histórico cambia.
5. Cambia Precio, Rentabilidad y Volatilidad y comprueba las unidades del eje vertical.
6. En Forecast, combina BTC/ETH, 7/14/30 días de muestra y varios horizontes. El título, los puntos y los tres valores finales deben variar.
7. Desconecta Internet y actualiza: debe aparecer el mensaje de indisponibilidad, nunca una cotización ficticia.

## 7. Límites conscientes

- “Tiempo real” significa consulta bajo demanda y refresco periódico cada 60 segundos; no es un feed de trading por WebSocket.
- CoinGecko aplica límites de uso a su API pública. Un estado 429 se muestra como indisponibilidad y no se maquilla con datos falsos.
- Los resultados del forecast son una extrapolación educativa muy sensible a la ventana elegida y no una recomendación de inversión.

