/* ==========================================================================
   MSI ADUANAS CRM — CONFIGURACION DE ENTORNO (CONFIG.JS)
   Centraliza todas las URLs, claves y parametros fuera del codigo principal
   ========================================================================== */

const ENV_CONFIG = {
  // URL del Backend Google Apps Script (Web App)
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyFKmFLY3GJVgFFyASRfWgdj4RPke7AAtI8HHOo6WoC7NPFq6EPaUWONEwuVFcU0iDY/exec",

  // Clave PIN de Seguridad
  AUTH_PIN: "MSI2026*",

  // Intervalo de Sondeo (8000 ms = 8 segundos)
  POLLING_INTERVAL_MS: 8000,

  // Informacion de Empresa
  COMPANY_NAME: "MSI ADUANAS",
  DEFAULT_AGENT: "Jade Vega"
};
