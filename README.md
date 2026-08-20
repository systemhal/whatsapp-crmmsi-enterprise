# WhatsApp Enterprise CRM (Estilo Kommo & Zoho CRM) 🚀

Sistema CRM de Nivel Empresarial para WhatsApp conectado oficialmente con la **API Cloud v20.0 de Meta** y respaldado en la base de datos de **Google Sheets**.

---

## 🌟 Características Destacadas

1. **💬 Bandeja de Chats en Tiempo Real (Inbox):**
   - Interfaz visual oscura inspirada en WhatsApp Web.
   - Muestra completa de **Fecha y Hora** (`📅 DD/MM/YYYY HH:mm`).
   - Botón de descarga directa de multimedia subida automáticamente a **Google Drive**.
   - Notificación sonora sintetizada (Web Audio API) con botón de activar/silenciar.
   - Selector de emojis y ventana modal para adjuntar archivos por arrastrar y soltar (Drag & Drop).

2. **📊 Embudo de Ventas Kanban (Estilo Kommo CRM):**
   - 6 Etapas comerciales (`Nuevo Lead`, `En Contacto`, `Encuesta Enviada`, `Cotización`, `Cliente Ganado`, `Cliente Perdido`).
   - Arrastrar y soltar (Drag & Drop) para cambiar las etapas de oportunidad.
   - Sincronización bidireccional automática con la pestaña `Clientes_CRM` de Google Sheets.

3. **👤 Ficha Comercial 360° del Cliente (Estilo Zoho CRM):**
   - Panel lateral desplegable con metadatos del cliente.
   - Selector directo de etapa del embudo.
   - Resumen promediado de calificaciones de satisfacción CSAT.

4. **📈 Tablero de Analíticas (Estilo Zoho Analytics):**
   - Tarjetas métricas de satisfacción global, volumen de conversaciones y encuestas respondidas.

---

## 📁 Estructura del Proyecto

Ruta local de los archivos del proyecto:
`C:\Users\USUARIO\Documents\Pojects_gravitity\11. WhatsAppAPi\`

- **`index.html`**: Estructura principal Single Page Application (SPA).
- **`styles.css`**: Sistema de diseño UI/UX (Modo oscuro, Kanban Glassmorphism, Ficha Zoho 360°).
- **`app.js`**: Motor cliente JavaScript (Drag & Drop Kanban, Polling 3.5s, Notificación sonora).
- **`Codigo_gs.js`**: Backend en Google Apps Script (Meta Cloud API, Webhook, Google Sheets Database).

---

## 📋 Pasos para Despliegue en Google Apps Script

1. Abre tu proyecto de **Google Apps Script** asociado a la hoja de cálculo.
2. Copia el contenido de `Codigo_gs.js` y pégalo en tu archivo `Código.gs`.
3. Crea un archivo HTML en el editor de Apps Script llamado `index` y pega todo el contenido de `index.html`.
4. Guarda los cambios (`Ctrl + S`).
5. En el menú superior, haz clic en **Implementar** > **Administrar implementaciones**.
6. Haz clic en el icono del lápiz ✏️ (**Editar**) > **Versión: "Nueva versión"** > **Implementar**.
7. Abre la URL ejecutable (`/exec`) en tu navegador para ingresar al nuevo CRM de WhatsApp.
