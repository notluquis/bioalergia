# Conectar servidores MCP de Cloudflare

Este proyecto documenta cómo conectar servidores MCP de Cloudflare para consultar logs, analytics y configuración de tu zona desde VS Code con GitHub Copilot.

## Prerrequisitos

Antes de comenzar, asegúrate de tener:

### GitHub Copilot en VS Code

El servidor MCP de Cloudflare funciona con [GitHub Copilot](https://github.com/features/copilot) en VS Code. Verifica que tienes:

- VS Code (o VS Code Insiders) instalado
- Extensión GitHub Copilot activa
- Sesión iniciada en GitHub

### Node.js

Los servidores MCP de Cloudflare requieren Node.js. Verifica tu instalación:

```bash
node --version
```

Si no está instalado, descárgalo desde [nodejs.org](https://nodejs.org/). Recomendamos la versión LTS.

## Instalación de servidores MCP de Cloudflare

### 1. Crear API Token en Cloudflare

Accede al [Dashboard de Cloudflare → API Tokens](https://dash.cloudflare.com/profile/api-tokens) y crea un token con estos permisos:

**Permisos requeridos**:

- `Zone` → `Zone` → **Read**
- `Zone` → `Analytics` → **Read**
- `Zone` → `Logs` → **Read**

Opcionalmente (para debugging avanzado):

- `Account` → `Account Settings` → **Read**
- `Zone` → `Zone Settings` → **Read**

### 2. Configurar servidores MCP

El proceso involucra configurar VS Code para conectarse automáticamente a los servidores MCP de Cloudflare.

**Abrir configuración MCP**

Abre el archivo de configuración MCP global:

- **macOS/Linux**: `~/Library/Application Support/Code/User/mcp.json` (o `Code - Insiders/User/mcp.json`)
- **Windows**: `%APPDATA%\Code\User\mcp.json`

**Configurar los servidores de Cloudflare**

Agrega la siguiente configuración al archivo JSON. Esto le indica a VS Code que inicie los servidores MCP de Cloudflare con tu API token:

```json
{
  "inputs": [
    {
      "id": "cloudflare_api_token",
      "type": "promptString",
      "description": "Cloudflare API Token (get from https://dash.cloudflare.com/profile/api-tokens - needs Zone:Read, Analytics:Read, Logs:Read)",
      "password": true
    }
  ],
  "servers": {
    "cloudflare-observability": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "https://observability.mcp.cloudflare.com/mcp"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "${input:cloudflare_api_token}"
      }
    },
    "cloudflare-radar": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "https://radar.mcp.cloudflare.com/mcp"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "${input:cloudflare_api_token}"
      }
    }
  }
}
```

**Entendiendo la configuración**:

- `"cloudflare-observability"`: Nombre descriptivo del servidor
- `"command": "npx"`: Usa npx de Node.js para ejecutar el servidor
- `"-y"`: Confirma automáticamente la instalación del paquete mcp-remote
- `"mcp-remote@latest"`: Paquete que conecta a servidores MCP remotos
- URL del servidor: Endpoint del servicio MCP de Cloudflare
- `"env"`: Variables de entorno, incluido el token desde el input prompt

> **Consideración de seguridad**  
> El token de Cloudflare se solicita de forma segura usando el sistema de inputs de VS Code y no se almacena en texto plano en la configuración.

### 3. Reiniciar VS Code

Después de guardar el archivo de configuración, cierra completamente VS Code y reinícialo. La aplicación necesita reiniciarse para cargar la nueva configuración.

La primera vez que uses Copilot con los servidores de Cloudflare, VS Code te pedirá que ingreses tu API token.

## Servidores MCP disponibles

Los siguientes servidores están configurados:

### Cloudflare Observability

Proporciona herramientas para:

- Consultar logs de aplicaciones y Workers
- Ver analytics de tráfico en tiempo real
- Debugging de Workers con stack traces
- Análisis de errores y excepciones

**URL**: `https://observability.mcp.cloudflare.com/mcp`

### Cloudflare Radar

Proporciona herramientas para:

- Insights de tráfico global de Internet
- Escaneo y análisis de URLs
- Tendencias de seguridad y amenazas
- Estadísticas de adopción de tecnologías

**URL**: `https://radar.mcp.cloudflare.com/mcp`

## Uso con GitHub Copilot

Una vez configurados los servidores, puedes usar Copilot para:

### Consultar logs de tu aplicación

```
"Muéstrame los últimos errores en los logs de intranet.bioalergia.cl"
```

### Ver analytics

```
"¿Cuál ha sido el tráfico de intranet.bioalergia.cl en las últimas 24 horas?"
```

### Debugging de Workers

```
"Muéstrame excepciones en los Workers de las últimas 2 horas"
```

### Escanear URLs

```
"Escanea https://intranet.bioalergia.cl y dime si hay problemas de seguridad"
```

### Cómo funciona la aprobación

Antes de ejecutar cualquier operación a través de los servidores MCP, Copilot solicitará tu aprobación. Esto asegura que mantengas control total sobre las acciones:

1. Copilot mostrará qué herramienta MCP quiere usar
2. Verás los parámetros exactos que se enviarán
3. Puedes aprobar o denegar la solicitud

Revisa cada solicitud cuidadosamente antes de aprobar.

## Limitaciones actuales

**Los servidores MCP de Cloudflare NO permiten**:

- Modificar Transform Rules
- Cambiar configuración de CSP
- Editar Page Rules
- Modificar DNS directamente
- Crear o eliminar Workers

Para esas operaciones, necesitas usar:

1. [Cloudflare Dashboard](https://dash.cloudflare.com)
2. [Cloudflare API directamente](https://developers.cloudflare.com/api/)
3. CLI de Wrangler: `npm install -g wrangler`

## Resolución de problemas de CSP

Para solucionar el CSP restrictivo (`default-src 'none'`) que está bloqueando scripts en producción, ve manualmente al Dashboard de Cloudflare:

**1. Transform Rules**:

- Dashboard → Dominio `bioalergia.cl`
- **Rules → Transform Rules → Modify Response Header**
- Busca reglas que modifiquen `Content-Security-Policy`

**2. Security Settings**:

- **Security → Settings**
- Revisa "Security Headers" o configuración de CSP

**3. Workers/Pages**:

- Verifica si hay un Worker aplicando headers en `intranet.bioalergia.cl`

## Próximos pasos

Ahora que has conectado VS Code a los servidores MCP de Cloudflare:

- [Explorar otros servidores MCP](https://github.com/modelcontextprotocol/servers) - Descubre más servidores oficiales y comunitarios
- [Construir tu propio servidor MCP](https://modelcontextprotocol.io/docs/develop/build-server) - Crea servidores personalizados para tus workflows
- [Entender el protocolo MCP](https://modelcontextprotocol.io/docs/learn/architecture) - Aprende cómo funciona MCP internamente

## Referencias

- [Cloudflare MCP Server GitHub](https://github.com/cloudflare/mcp-server-cloudflare)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Cloudflare API Docs](https://developers.cloudflare.com/api/)
