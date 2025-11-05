# Configuración de Cloudflare MCP en VS Code

Este proyecto tiene configurado el servidor MCP de Cloudflare para consultar logs, analytics y configuración de tu zona.

## 🔧 Configuración inicial

### 1. Crear API Token en Cloudflare

Ve a [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens) y crea un token con estos permisos:

**Permisos requeridos**:

- `Zone` → `Zone` → **Read**
- `Zone` → `Analytics` → **Read**
- `Zone` → `Logs` → **Read**

Opcionalmente (para debugging avanzado):

- `Account` → `Account Settings` → **Read**
- `Zone` → `Zone Settings` → **Read**

### 2. Configurar el token en tu entorno

Edita `.env.local` y reemplaza `your_token_here` con tu token:

```bash
CLOUDFLARE_API_TOKEN=tu_token_aqui
```

### 3. Instalar mcp-remote (si no está)

```bash
npm install -g mcp-remote
```

## 📊 Servidores MCP disponibles

Ya configurados en `.vscode/settings.json`:

1. **Cloudflare Observability** (`cloudflare-observability`)
   - Consulta logs de aplicaciones
   - Analytics de tráfico
   - Debugging de Workers
   - URL: `https://observability.mcp.cloudflare.com/mcp`

2. **Cloudflare Radar** (`cloudflare-radar`)
   - Insights de tráfico global
   - Escaneo de URLs
   - Tendencias de Internet
   - URL: `https://radar.mcp.cloudflare.com/mcp`

## 🚀 Uso en VS Code

Una vez configurado el token, puedes usar GitHub Copilot para:

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

## ⚠️ Limitaciones actuales

**Los servidores MCP de Cloudflare NO permiten**:

- Modificar Transform Rules
- Cambiar configuración de CSP
- Editar Page Rules
- Modificar DNS directamente

Para esas operaciones necesitas usar:

1. [Cloudflare Dashboard](https://dash.cloudflare.com)
2. [Cloudflare API directamente](https://developers.cloudflare.com/api/)
3. CLI de Wrangler: `npm install -g wrangler`

## 🔍 Debugging del problema actual de CSP

Para solucionar el CSP restrictivo (`default-src 'none'`), ve al Dashboard de Cloudflare:

1. **Transform Rules**:
   - Dashboard → Dominio `bioalergia.cl`
   - **Rules → Transform Rules → Modify Response Header**
   - Busca reglas que modifiquen `Content-Security-Policy`

2. **Security Settings**:
   - **Security → Settings**
   - Revisa "Security Headers" o configuración de CSP

3. **Workers/Pages**:
   - Verifica si hay un Worker aplicando headers en `intranet.bioalergia.cl`

## 📚 Referencias

- [Cloudflare MCP Server GitHub](https://github.com/cloudflare/mcp-server-cloudflare)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Cloudflare API Docs](https://developers.cloudflare.com/api/)
