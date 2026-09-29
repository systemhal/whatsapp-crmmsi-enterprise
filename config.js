/* ==========================================================================
   CRM WHATSAPP ENTERPRISE — ARCHIVO DE CONFIGURACIÓN PORTABLE
   ============================================================
   ✅ ARCHIVO ÚNICO PARA CAMBIAR DE EMPRESA / CLIENTE
   Si quieres reutilizar este CRM para otro cliente, SOLO edita este archivo.
   NO toques app.js, index.html ni styles.css.
   ========================================================================== */

const ENV_CONFIG = {

  // ─────────────────────────────────────────────────────────────
  // 1. BACKEND — URL del Google Apps Script (Web App Publicada)
  //    Al cambiar de cliente: Crea un nuevo Apps Script y pega la URL aquí.
  // ─────────────────────────────────────────────────────────────
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyFKmFLY3GJVgFFyASRfWgdj4RPke7AAtI8HHOo6WoC7NPFq6EPaUWONEwuVFcU0iDY/exec",

  // ─────────────────────────────────────────────────────────────
  // 2. EMPRESA — Datos de Identidad Corporativa
  //    Al cambiar de cliente: Actualiza nombre, agente y colores.
  // ─────────────────────────────────────────────────────────────
  COMPANY_NAME:    "MSI ADUANAS",
  DEFAULT_AGENT:   "Jade Vega",
  COMPANY_SLOGAN:  "Comercio Exterior de Confianza",

  // ─────────────────────────────────────────────────────────────
  // 3. USUARIOS DEL CRM — Sistema de Roles (Admin / Colaborador)
  //    Agrega o quita usuarios aquí. No toques app.js.
  //
  //    ROLES disponibles: "ADMIN" o "COLABORADOR"
  //    ADMIN    → Puede eliminar auditorías, ver alertas técnicas del sistema,
  //               y en el futuro gestionar usuarios.
  //    COLABORADOR → Puede ver y responder chats, ver encuestas CSAT.
  //               NO puede eliminar auditorías ni ver alertas del sistema.
  //
  //    pin: clave de acceso individual de cada usuario.
  // ─────────────────────────────────────────────────────────────
  USUARIOS: [
    {
      id:     "USR-001",
      nombre: "Administrador",
      alias:  "admin",
      pin:    "MSI2026*",
      rol:    "ADMIN"
    },
    {
      id:     "USR-002",
      nombre: "Jade Vega",
      alias:  "jvega",
      pin:    "Jade2026#",
      rol:    "COLABORADOR"
    }
  ],

  // ─────────────────────────────────────────────────────────────
  // 4. INTERVALO DE ACTUALIZACIÓN (Polling)
  //    8000 ms = 8 segundos entre cada consulta de nuevos chats.
  // ─────────────────────────────────────────────────────────────
  POLLING_INTERVAL_MS: 8000,

  // ─────────────────────────────────────────────────────────────
  // 5. CORREO DE ALERTAS DEL SISTEMA
  //    Solo se usa en el backend (Codigo_gs.js) para enviar alertas
  //    automáticas si el token de Meta caduca o el sistema falla.
  //    Al cambiar de cliente: Pon el correo del administrador del cliente.
  // ─────────────────────────────────────────────────────────────
  ADMIN_ALERT_EMAIL: "sistemas@msi.com.pe"

};
