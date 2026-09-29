// ==========================================================================
// WHATSAPP ENTERPRISE CRM — GOOGLE APPS SCRIPT BACKEND ENGINE
// Integración Oficial con Meta Cloud API v20.0 + Google Sheets Database
// Código Senior de Envío y Descarga de Medios + Extracción Completa de Logs
// ==========================================================================

const SPREADSHEET_ID = "1MEeCEmjpnUEFz8zQgz6lcaSHU6uRhHZNl4oCCatmePQ";
const ACCESS_TOKEN = "EAASz43rVNgUBSAbTl8hgBWhe290GQMJ77FrGKGxeLrvYLOopaa3tJH9mSQ1ZAIzqSdDzMAlqM9nIPEXLNZClrngOgjuYM4rNo8C6KdFbESWf9QQJ1W0WWUnQZB3pm16XA3uMQ0gGpxb8ASYG46uA8HwZBYBy4CMUIicPfWNRyQqMxP5RFBsvEWplpTeBUAZDZD";
const PHONE_NUMBER_ID = "1266313029888670";
const TEMPLATE_NAME = "encuesta_new_numero";
const VERIFY_TOKEN = "msi_aduanas_token_seguro_2026";
const CRM_SECRET_PIN = "MSI2026*";

// 🔒 FUNCIÓN DE VALIDACIÓN DE AUTENTICACIÓN (CIBERSEGURIDAD)
function validarAccesoCRM(pinIngresado) {
  if (pinIngresado === CRM_SECRET_PIN) {
    var sessionToken = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, CRM_SECRET_PIN + new Date().toDateString())
                                .map(function(b){ return (b<0?b+256:b).toString(16); }).join('');
    return { autorizado: true, token: sessionToken };
  } else {
    return { autorizado: false, error: "PIN de seguridad incorrecto" };
  }
}

// 🚀 MENÚ PERSONALIZADO EN GOOGLE SHEETS
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 WhatsApp API')
    .addItem('📤 Enviar Encuestas Pendientes', 'enviarEncuestasMasivas')
    .addItem('🖥️ Abrir Panel CRM (Estilo Kommo/Zoho)', 'mostrarUrlCrm')
    .addSeparator()
    .addItem('📢 Enviar Aviso Cambio Personal', 'menuEnviarAvisoCambioPersonal')
    .addItem('📋 Crear pestaña EnviosPlantilla', 'crearHojaEnviosPlantilla')
    .addItem('🧹 Limpiar estados EnviosPlantilla', 'limpiarEstadosEnvioPlantilla')
    .addSeparator()
    .addItem('🔍 Verificar Estado del Token Meta', 'menuVerificarToken')
    .addToUi();
}

function menuVerificarToken() {
  var status = verificarTokenMetaInterno();
  var ui = SpreadsheetApp.getUi();
  if (status.tokenValido) {
    ui.alert('✅ Token Meta — OK', 'El token de WhatsApp Business es VÁLIDO.\nPhone ID confirmado: ' + status.phoneId, ui.ButtonSet.OK);
  } else {
    ui.alert('🚨 Token Meta — INVÁLIDO', 'El token NO es válido o está caducado.\n\nError: ' + (status.error || 'Desconocido') + '\nCódigo HTTP: ' + (status.code || 'N/A') + '\n\n⚠️ Renuévalo en Meta Business Suite y actualiza ACCESS_TOKEN en Codigo_gs.js.', ui.ButtonSet.OK);
  }
}


const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyFKmFLY3GJVgFFyASRfWgdj4RPke7AAtI8HHOo6WoC7NPFq6EPaUWONEwuVFcU0iDY/exec";

function mostrarUrlCrm() {
  const html = `<div style="font-family:sans-serif;padding:10px;text-align:center;">
    <h3 style="color:#00a884;margin-bottom:8px;">🖥️ WhatsApp CRM — MSI ADUANAS</h3>
    <p style="font-size:0.9rem;color:#444;margin-bottom:16px;">Haz clic en el botón para abrir el panel de chats en vivo en una nueva pestaña:</p>
    <a href="${WEB_APP_URL}" target="_blank" style="background:#00a884;color:white;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;box-shadow:0 4px 12px rgba(0,168,132,0.3);">🚀 Abrir Panel CRM</a>
  </div>`;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(420).setHeight(190), "WhatsApp CRM");
}

function enviarEncuestasMasivas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Envíos") || ss.getSheetByName("Envios");
  if (!sheet) {
    SpreadsheetApp.getUi().alert("❌ No se encontró la pestaña 'Envíos' ni 'Envios'.");
    return;
  }

  const data = sheet.getDataRange().getValues();
  let enviadosCount = 0;
  let erroresLog = [];

  for (let i = 1; i < data.length; i++) {
    const celdaEstado = sheet.getRange(i + 1, 2);
    const celdaFecha = sheet.getRange(i + 1, 3);
    const estado = String(celdaEstado.getValue()).trim();
    let telefono = cleanPhoneNum(data[i][0]);

    if (!telefono) continue;

    if (estado !== "Enviado") {
      const res = enviarPlantillaEncuesta(telefono);
      if (res.exito) {
        celdaEstado.setValue("Enviado");
        celdaFecha.setValue(new Date());
        registrarTrazabilidad(ss, telefono, "Enviado 📤");
        enviadosCount++;
      } else {
        celdaEstado.setValue("Error ❌");
        erroresLog.push(`Teléfono ${telefono}: ${res.error}`);
        registrarTrazabilidad(ss, telefono, "Fallido ❌ (" + res.error + ")");
      }
    }
  }

  let mensajeFinal = `✅ Proceso finalizado. Se enviaron ${enviadosCount} encuestas por WhatsApp.`;
  if (erroresLog.length > 0) {
    mensajeFinal += `\n\n⚠️ Detalles de errores (${erroresLog.length}):\n` + erroresLog.join("\n");
  }
  SpreadsheetApp.getUi().alert(mensajeFinal);
}

function enviarPlantillaEncuesta(telefono) {
  const cleanPhone = cleanPhoneNum(telefono);
  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
  
  const payload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": cleanPhone,
    "type": "template",
    "template": {
      "name": TEMPLATE_NAME,
      "language": { "code": "es" },
      "components": [
        {
          "type": "button",
          "sub_type": "flow",
          "index": "0",
          "parameters": [
            {
              "type": "action",
              "action": {
                "flow_token": "unused"
              }
            }
          ]
        }
      ]
    }
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "headers": { "Authorization": "Bearer " + ACCESS_TOKEN },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const resJson = JSON.parse(response.getContentText());
    if (resJson.messages && resJson.messages[0].id) {
      const msgId = resJson.messages[0].id;
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      let envSheet = ss.getSheetByName("MensajesEnviados");
      if (!envSheet) {
        envSheet = ss.insertSheet("MensajesEnviados");
        envSheet.appendRow(["Fecha y Hora", "Teléfono", "Mensaje", "MsgId"]);
      }
      envSheet.appendRow([new Date(), cleanPhone, "📋 Encuesta de Satisfacción Enviada", msgId]);
      return { exito: true, msgId: msgId };
    } else {
      const errMsg = resJson.error ? (`(#${resJson.error.code}) ${resJson.error.message}`) : "Respuesta desconocida de Meta";
      return { exito: false, error: errMsg };
    }
  } catch (e) {
    return { exito: false, error: e.toString() };
  }
}

// NUEVA FUNCIÓN: Wrapper para CRM web que también actualiza la pestaña Envíos
function enviarEncuestaManualBackend(phoneSurv) {
  var res = enviarPlantillaEncuesta(phoneSurv);
  if (res && res.exito) {
    try {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var enviosSheet = ss.getSheetByName("Envíos") || ss.getSheetByName("Envios");
      if (enviosSheet) {
        enviosSheet.appendRow([phoneSurv, "Enviado", new Date()]);
      }
    } catch(e) {}
  }
  return res;
}

// ============================================================================
// 📢 ENVÍO DE PLANTILLA "aviso_cambio_personal" — BLOQUE COMPLETO
// ============================================================================

const TEMPLATE_AVISO = "aviso_cambio_personal";
const TEMPLATE_AVISO_LANG = "es_PE";
const HOJA_ENVIOS_PLANTILLA = "EnviosPlantilla";

/**
 * Crea la pestaña "EnviosPlantilla" con formato y encabezados
 */
function crearHojaEnviosPlantilla() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let hoja = ss.getSheetByName(HOJA_ENVIOS_PLANTILLA);

  if (hoja) {
    SpreadsheetApp.getUi().alert('⚠️ La pestaña "' + HOJA_ENVIOS_PLANTILLA + '" ya existe.');
    return;
  }

  hoja = ss.insertSheet(HOJA_ENVIOS_PLANTILLA);

  const encabezados = ["Número de Celular", "Estado", "Fecha/Hora Envío", "Template Usado", "Mensaje ID"];
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);

  const rango = hoja.getRange(1, 1, 1, encabezados.length);
  rango.setBackground('#4a86c8');
  rango.setFontColor('#ffffff');
  rango.setFontWeight('bold');

  hoja.setColumnWidth(1, 160);
  hoja.setColumnWidth(2, 100);
  hoja.setColumnWidth(3, 180);
  hoja.setColumnWidth(4, 200);
  hoja.setColumnWidth(5, 250);
  hoja.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    '✅ Pestaña "' + HOJA_ENVIOS_PLANTILLA + '" creada.\n\n' +
    'Coloca los números de celular en la columna A (desde fila 2).\n' +
    'Formato: con código de país, ej: 51925030096'
  );
}

/**
 * Menú principal — Enviar Aviso de Cambio de Personal
 * Lee números de "EnviosPlantilla" y envía la plantilla aviso_cambio_personal
 */
function menuEnviarAvisoCambioPersonal() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = ss.getSheetByName(HOJA_ENVIOS_PLANTILLA);

  if (!hoja) {
    ui.alert(
      '❌ Error',
      'No se encontró la pestaña "' + HOJA_ENVIOS_PLANTILLA + '".\n\n' +
      'Usa el menú "🚀 WhatsApp API > 📋 Crear pestaña EnviosPlantilla" para crearla.',
      ui.ButtonSet.OK
    );
    return;
  }

  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) {
    ui.alert('⚠️ No hay números en la pestaña "' + HOJA_ENVIOS_PLANTILLA + '".');
    return;
  }

  const rangoDatos = hoja.getRange(2, 1, ultimaFila - 1, 1).getValues();
  const numeros = [];

  for (let i = 0; i < rangoDatos.length; i++) {
    const numero = cleanPhoneNum(rangoDatos[i][0]);
    if (numero) {
      numeros.push({ numero: numero, fila: i + 2 });
    }
  }

  if (numeros.length === 0) {
    ui.alert('⚠️ No se encontraron números válidos.');
    return;
  }

  const respuesta = ui.alert(
    '📢 Enviar Aviso de Cambio de Personal',
    '¿Enviar la plantilla "' + TEMPLATE_AVISO + '" a ' + numeros.length + ' contactos?\n\n' +
    'Template: ' + TEMPLATE_AVISO + '\n' +
    'Idioma: ' + TEMPLATE_AVISO_LANG,
    ui.ButtonSet.YES_NO
  );

  if (respuesta !== ui.Button.YES) {
    ui.alert('Envío cancelado.');
    return;
  }

  // Ejecutar envío masivo
  let exitosos = 0, fallidos = 0, omitidos = 0;
  let erroresLog = [];
  const fechaHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

  for (let i = 0; i < numeros.length; i++) {
    const { numero, fila } = numeros[i];

    // Omitir ya enviados
    const estadoActual = String(hoja.getRange(fila, 2).getValue()).trim();
    if (estadoActual === 'Enviado') {
      omitidos++;
      continue;
    }

    try {
      const resultado = enviarPlantillaAviso(numero);

      if (resultado.exito) {
        hoja.getRange(fila, 2).setValue('Enviado');
        hoja.getRange(fila, 3).setValue(fechaHora);
        hoja.getRange(fila, 4).setValue(TEMPLATE_AVISO);
        hoja.getRange(fila, 5).setValue(resultado.msgId || '');
        hoja.getRange(fila, 1, 1, 5).setBackground('#d4edda');
        exitosos++;
        registrarTrazabilidad(ss, numero, "Aviso Cambio Personal Enviado 📢");
      } else {
        hoja.getRange(fila, 2).setValue('Error ❌');
        hoja.getRange(fila, 3).setValue(fechaHora);
        hoja.getRange(fila, 4).setValue(resultado.error || 'Error desconocido');
        hoja.getRange(fila, 1, 1, 5).setBackground('#f8d7da');
        fallidos++;
        erroresLog.push('Tel ' + numero + ': ' + resultado.error);
        registrarTrazabilidad(ss, numero, "Aviso Fallido ❌ (" + resultado.error + ")");
      }

      Utilities.sleep(1000); // Espera 1s entre mensajes

    } catch (e) {
      hoja.getRange(fila, 2).setValue('Error ❌');
      hoja.getRange(fila, 3).setValue(fechaHora);
      hoja.getRange(fila, 4).setValue('Excepción: ' + e.message);
      hoja.getRange(fila, 1, 1, 5).setBackground('#f8d7da');
      fallidos++;
      erroresLog.push('Tel ' + numero + ': ' + e.message);
    }
  }

  // Resumen final
  let mensajeFinal = '📊 Resumen de Envío — ' + TEMPLATE_AVISO + '\n\n' +
    '✅ Exitosos: ' + exitosos + '\n' +
    '❌ Fallidos: ' + fallidos + '\n' +
    '⏭️ Omitidos (ya enviados): ' + omitidos;

  if (erroresLog.length > 0) {
    mensajeFinal += '\n\n⚠️ Errores:\n' + erroresLog.join('\n');
  }

  ui.alert(mensajeFinal);
}

/**
 * Envía la plantilla "aviso_cambio_personal" a un número específico
 * (Estructura similar a enviarPlantillaEncuesta pero para esta plantilla)
 */
function enviarPlantillaAviso(telefono) {
  const cleanPhone = cleanPhoneNum(telefono);
  const url = 'https://graph.facebook.com/v20.0/' + PHONE_NUMBER_ID + '/messages';

  const payload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": cleanPhone,
    "type": "template",
    "template": {
      "name": TEMPLATE_AVISO,
      "language": { "code": TEMPLATE_AVISO_LANG }
    }
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "headers": { "Authorization": "Bearer " + ACCESS_TOKEN },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const resJson = JSON.parse(response.getContentText());
    if (resJson.messages && resJson.messages[0].id) {
      const msgId = resJson.messages[0].id;
      // Registrar en MensajesEnviados
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      let envSheet = ss.getSheetByName("MensajesEnviados");
      if (!envSheet) {
        envSheet = ss.insertSheet("MensajesEnviados");
        envSheet.appendRow(["Fecha y Hora", "Teléfono", "Mensaje", "MsgId"]);
      }
      envSheet.appendRow([new Date(), cleanPhone, "📢 *Aviso Importante:*\nEstimado cliente, les informamos que Jesús Riojas y Aldair Nuñez, quienes se desempeñaban como ejecutivos comerciales, ya no forman parte de nuestra empresa.\n\nLa salida de Jesús se produjo de manera abrupta y por situaciones relacionadas con su desempeño y proceder, por lo que queremos dejar claramente establecido que cualquier gestión, servicio u ofrecimiento que realicen actualmente no cuenta con el respaldo ni la autorización de MSI.\n\nAgradecemos que, ante cualquier requerimiento, se comuniquen directamente con nosotros para garantizarles una atención segura y responsable.", msgId]);
      return { exito: true, msgId: msgId };
    } else {
      const errMsg = resJson.error ? ('(#' + resJson.error.code + ') ' + resJson.error.message) : "Respuesta desconocida de Meta";
      return { exito: false, error: errMsg };
    }
  } catch (e) {
    return { exito: false, error: e.toString() };
  }
}

/**
 * Limpiar estados de EnviosPlantilla para poder reenviar
 */
function limpiarEstadosEnvioPlantilla() {
  const ui = SpreadsheetApp.getUi();
  const respuesta = ui.alert(
    '⚠️ Limpiar Estados',
    '¿Limpiar todos los estados de envío en "' + HOJA_ENVIOS_PLANTILLA + '"?\nEsto permitirá reenviar a todos los números.',
    ui.ButtonSet.YES_NO
  );

  if (respuesta !== ui.Button.YES) return;

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = ss.getSheetByName(HOJA_ENVIOS_PLANTILLA);

  if (!hoja) {
    ui.alert('❌ No se encontró la pestaña "' + HOJA_ENVIOS_PLANTILLA + '".');
    return;
  }

  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return;

  // Limpiar columnas B-E y colores
  hoja.getRange(2, 2, ultimaFila - 1, 4).clearContent();
  hoja.getRange(2, 1, ultimaFila - 1, 5).setBackground(null);

  ui.alert('✅ Estados limpiados. Puedes volver a enviar.');
}

// ============================================================================
// FIN BLOQUE — aviso_cambio_personal
// ============================================================================

function autorizarPermisosDrive() {
  var testFolder = DriveApp.createFolder("CRM_WhatsApp_Test_Drive");
  testFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  DriveApp.getFolderById(testFolder.getId()).setTrashed(true);
  Logger.log("Permisos completos de escritura en Drive autorizados correctamente.");
}

// 1. SERVIR PANEL CRM O ATENDER PETICIONES REST
function doGet(e) {
  var mode = e.parameter ? e.parameter['hub.mode'] : null;
  var token = e.parameter ? e.parameter['hub.verify_token'] : null;
  var challenge = e.parameter ? e.parameter['hub.challenge'] : null;

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    return ContentService.createTextOutput(challenge);
  }

  var action = e.parameter ? e.parameter.action : null;
  
  if (action === "getChats") {
    var chats = obtenerChatsEnVivo();
    var cb = e.parameter.callback;
    if (cb) {
      return ContentService.createTextOutput(cb + "(" + JSON.stringify({chats: chats}) + ")")
                           .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify({chats: chats}))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  // NUEVO: Para guardar logs desde GitHub Pages / Localhost sin error de CORS
  if (action === "logMessage") {
    var p = e.parameter.phone;
    var msg = e.parameter.msg;
    var msgId = e.parameter.msgId;
    
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var envSheet = ss.getSheetByName("MensajesEnviados");
    if (!envSheet) {
      envSheet = ss.insertSheet("MensajesEnviados");
      envSheet.appendRow(["Fecha y Hora", "Teléfono", "Mensaje", "MsgId"]);
    }
    envSheet.appendRow([new Date(), cleanPhoneNum(p), msg, msgId]);
    registrarTrazabilidad(ss, p, "Respuesta/Archivo Enviado 📤");
    
    var cb = e.parameter.callback;
    if (cb) {
      return ContentService.createTextOutput(cb + "(" + JSON.stringify({exito: true}) + ")")
                           .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify({exito: true}))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'updateStage') {
    var phone = e.parameter.phone;
    var stage = e.parameter.stage;
    var resStage = actualizarEtapaCliente(phone, stage);
    var cb = e.parameter.callback;
    if (cb) {
      return ContentService.createTextOutput(cb + "(" + JSON.stringify(resStage) + ")")
                           .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(resStage))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'sendMessage') {
    var phoneSend = e.parameter.phone;
    var textSend = e.parameter.text;
    var resSend = enviarRespuestaManual(phoneSend, textSend);
    var cb = e.parameter.callback;
    if (cb) {
      return ContentService.createTextOutput(cb + "(" + JSON.stringify(resSend) + ")")
                           .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(resSend))
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  // NUEVO: Endpoint para enviar encuesta desde el frontend y actualizar pestaña "Envíos"
  if (action === 'sendSurvey') {
    var phoneSurv = cleanPhoneNum(e.parameter.phone);
    var resSurv = enviarPlantillaEncuesta(phoneSurv);
    
    // Si fue exitoso, intentar actualizar también la pestaña "Envíos"
    if (resSurv.exito) {
      try {
        var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        var enviosSheet = ss.getSheetByName("Envíos") || ss.getSheetByName("Envios");
        if (enviosSheet) {
          // Siempre agregamos al final para mantener un historial cronológico visible
          enviosSheet.appendRow([phoneSurv, "Enviado", new Date()]);
        }
      } catch(e) {}
    }
    
    var cb = e.parameter.callback;
    if (cb) {
      return ContentService.createTextOutput(cb + "(" + JSON.stringify(resSurv) + ")")
                           .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(resSurv))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  // NUEVO: Endpoint para persistir eliminación de auditorías CSAT en Google Sheets
  if (action === 'deleteSurveyLog') {
    var delPhone = cleanPhoneNum(e.parameter.phone);
    var delSendTime = e.parameter.sendTime;
    var clearAll = e.parameter.clearAll;

    try {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var delSheet = ss.getSheetByName("Eliminados");
      if (!delSheet) {
        delSheet = ss.insertSheet("Eliminados");
        delSheet.appendRow(["Fecha Eliminación", "Teléfono", "Fecha Envío Encuesta", "Modo"]);
      }
      delSheet.appendRow([new Date(), delPhone || "TODOS", delSendTime || "TODOS", clearAll ? "Limpieza Total" : "Fila Individual"]);
    } catch(e) {}

    var cbDel = e.parameter.callback;
    var resDel = { exito: true };
    if (cbDel) {
      return ContentService.createTextOutput(cbDel + "(" + JSON.stringify(resDel) + ");")
                           .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(resDel))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  // ── CENTINELA TOKEN META: Verificación de salud del token (solo admin) ──
  if (action === 'checkMetaToken') {
    var tokenStatus = verificarTokenMetaInterno();
    var cbToken = e.parameter.callback;
    if (cbToken) {
      return ContentService.createTextOutput(cbToken + "(" + JSON.stringify(tokenStatus) + ");")
                           .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(tokenStatus))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createHtmlOutput(getCrmHtml())
                    .setTitle("WhatsApp CRM | MSI ADUANAS")
                    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ==========================================================================
// 🚨 CENTINELA AUTOMÁTICO — VERIFICACIÓN DIARIA DEL TOKEN META
// ==========================================================================
// CONFIGURACIÓN (solo una vez):
//   En Apps Script: menú ⏰ Activadores > Agregar activador
//   Función: verificarYAlertarTokenMeta
//   Tipo: Basado en tiempo > Diariamente > Entre 8:00 y 9:00 AM
// ==========================================================================

function verificarTokenMetaInterno() {
  try {
    var url = "https://graph.facebook.com/v20.0/" + PHONE_NUMBER_ID + "?access_token=" + ACCESS_TOKEN;
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = response.getResponseCode();
    var body = JSON.parse(response.getContentText());
    if (code === 200 && body.id) {
      return { tokenValido: true, phoneId: body.id };
    } else {
      var errorMsg = (body.error && body.error.message) ? body.error.message : "Error desconocido";
      return { tokenValido: false, error: errorMsg, code: code };
    }
  } catch(err) {
    return { tokenValido: false, error: err.toString(), code: 0 };
  }
}

function verificarYAlertarTokenMeta() {
  var status = verificarTokenMetaInterno();
  if (!status.tokenValido) {
    var adminEmail = "sistemas@msi.com.pe"; // ← Cambia por el correo del cliente en cada proyecto
    var asunto = "🚨 URGENTE: Token WhatsApp Business requiere renovación — CRM MSI ADUANAS";
    var cuerpo = "Estimado Administrador,\n\n" +
      "El monitor automático del CRM detectó que el Token de Meta WhatsApp Business está inactivo o caducó.\n\n" +
      "📋 Error detectado:\n" +
      "   • Código HTTP: " + (status.code || "N/A") + "\n" +
      "   • Detalle: " + (status.error || "Token inválido") + "\n\n" +
      "⚠️ CONSECUENCIAS:\n" +
      "   • No se pueden enviar ni recibir mensajes por WhatsApp.\n" +
      "   • Las encuestas automáticas están detenidas.\n\n" +
      "🔧 PASOS PARA RESOLVER:\n" +
      "   1. Ingresa a Meta Business Suite: https://business.facebook.com\n" +
      "   2. Ve a Configuración → WhatsApp → API Cloud\n" +
      "   3. Genera un nuevo Token de Sistema Permanente\n" +
      "   4. Actualiza ACCESS_TOKEN en Codigo_gs.js y vuelve a publicar la Web App.\n\n" +
      "Fecha de detección: " + new Date().toLocaleString("es-PE") + "\n" +
      "— Monitor Automático CRM WhatsApp Enterprise";

    GmailApp.sendEmail(adminEmail, asunto, cuerpo);

    // Registrar en Google Sheets para trazabilidad
    try {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var logsSheet = ss.getSheetByName("Logs");
      if (logsSheet) {
        logsSheet.appendRow([new Date(), "⚠️ CENTINELA: Token Meta inválido — Alerta enviada a " + adminEmail]);
      }
    } catch(logErr) {}
  }
}

// 2. WEBHOOK DESDE META
function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    var logSheet = ss.getSheetByName("Logs");
    if (!logSheet) {
      logSheet = ss.insertSheet("Logs");
      logSheet.appendRow(["Fecha y Hora", "JSON Recibido"]);
    }
    logSheet.appendRow([new Date(), rawData]);

    var contents = JSON.parse(rawData);
    if (contents.entry && contents.entry[0].changes) {
      var value = contents.entry[0].changes[0].value;

      if (value && value.statuses && value.statuses.length > 0) {
        var statusObj = value.statuses[0];
        var estadoTexto = "";
        if (statusObj.status === "delivered") estadoTexto = "Entregado 🚚";
        else if (statusObj.status === "read") estadoTexto = "Leído 👁️";
        else if (statusObj.status === "failed") estadoTexto = "Fallido ❌";
        if (estadoTexto !== "") registrarTrazabilidad(ss, statusObj.recipient_id, estadoTexto);
      }

      if (value && value.messages && value.messages.length > 0) {
        var msg = value.messages[0];
        if (msg.type === "interactive" && msg.interactive && msg.interactive.nfm_reply) {
          var phone = cleanPhoneNum(msg.from);
          var responseJson = {};
          try {
            var rawResp = msg.interactive.nfm_reply.response_json;
            responseJson = typeof rawResp === 'string' ? JSON.parse(rawResp) : rawResp;
          } catch(err) {}

          var sheet = ss.getSheetByName("Respuestas");
          if (sheet) {
            sheet.appendRow([
              new Date(), phone,
              responseJson.rapidez_respuesta || "",
              responseJson.conocimiento_tecnico || "",
              responseJson.acompanamiento_operaciones || "",
              responseJson.respaldo_soporte || "",
              responseJson.cambio_ejecutivo || "",
              responseJson.recomendar_msi || ""
            ]);
          }
          registrarTrazabilidad(ss, phone, "Respondido ✅");
        }
      }
    }
  } catch (error) {}
  return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
}

// 3. ENVIAR RESPUESTA MANUAL
function enviarRespuestaManual(telefono, mensajeTexto) {
  var url = "https://graph.facebook.com/v20.0/" + PHONE_NUMBER_ID + "/messages";
  var cleanPhone = cleanPhoneNum(telefono);

  var payload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": cleanPhone,
    "type": "text",
    "text": { "body": mensajeTexto }
  };

  var options = {
    "method": "post",
    "contentType": "application/json",
    "headers": { "Authorization": "Bearer " + ACCESS_TOKEN },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var resJson = JSON.parse(response.getContentText());
    if (resJson.messages && resJson.messages[0].id) {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var envSheet = ss.getSheetByName("MensajesEnviados");
      if (!envSheet) {
        envSheet = ss.insertSheet("MensajesEnviados");
        envSheet.appendRow(["Fecha y Hora", "Teléfono", "Mensaje", "MsgId"]);
      }
      envSheet.appendRow([new Date(), cleanPhone, mensajeTexto, resJson.messages[0].id]);
      registrarTrazabilidad(ss, cleanPhone, "Respuesta Enviada 📤");
      return { exito: true };
    } else {
      return { exito: false, error: resJson.error ? resJson.error.message : "Error Meta" };
    }
  } catch(e) {
    return { exito: false, error: e.toString() };
  }
}

// 3b. SUBIR Y ENVIAR ARCHIVO A META MEDIA API (SIGNATURA EXACTA: telefono, base64Data, fileName, mimeType)
function subirYEnviarArchivo(telefono, base64Data, fileName, mimeType) {
  try {
    var cleanPhone = cleanPhoneNum(telefono);

    if (!mimeType) mimeType = "image/jpeg";
    if (!fileName) fileName = "imagen.jpg";

    var cleanBase64 = String(base64Data).replace(/[^A-Za-z0-9\+\/\=]/g, "");
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, mimeType, fileName);
    blob.setName(fileName);

    var waType = (mimeType && mimeType.indexOf("image/") === 0) ? "image" : "document";

    var urlMedia = "https://graph.facebook.com/v20.0/" + PHONE_NUMBER_ID + "/media";
    var payloadMedia = {
      "messaging_product": "whatsapp",
      "file": blob,
      "type": mimeType
    };

    var optionsMedia = {
      "method": "post",
      "headers": { "Authorization": "Bearer " + ACCESS_TOKEN },
      "payload": payloadMedia,
      "muteHttpExceptions": true
    };

    var resMedia = UrlFetchApp.fetch(urlMedia, optionsMedia);
    var resMediaJson = JSON.parse(resMedia.getContentText());

    if (resMediaJson && resMediaJson.id) {
      var mediaId = resMediaJson.id;
      var urlMsg = "https://graph.facebook.com/v20.0/" + PHONE_NUMBER_ID + "/messages";
      var msgPayload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": cleanPhone,
        "type": waType
      };

      if (waType === "image") {
        msgPayload.image = { "id": mediaId };
      } else {
        msgPayload.document = { "id": mediaId, "filename": fileName };
      }

      var optionsMsg = {
        "method": "post",
        "contentType": "application/json",
        "headers": { "Authorization": "Bearer " + ACCESS_TOKEN },
        "payload": JSON.stringify(msgPayload),
        "muteHttpExceptions": true
      };

      var resMsg = UrlFetchApp.fetch(urlMsg, optionsMsg);
      var resMsgJson = JSON.parse(resMsg.getContentText());

      if (resMsgJson.messages && resMsgJson.messages[0] && resMsgJson.messages[0].id) {
        var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        var envSheet = ss.getSheetByName("MensajesEnviados");
        if (!envSheet) {
          envSheet = ss.insertSheet("MensajesEnviados");
          envSheet.appendRow(["Fecha y Hora", "Teléfono", "Mensaje", "MsgId"]);
        }
        var label = waType === "image" ? "📷 Imagen enviada" : "📎 " + fileName;
        envSheet.appendRow([new Date(), cleanPhone, label, resMsgJson.messages[0].id]);
        registrarTrazabilidad(ss, cleanPhone, "Archivo Enviado 📤");
        return { exito: true };
      } else {
        var errDesc = resMsgJson.error ? ("(#" + resMsgJson.error.code + ") " + resMsgJson.error.message) : "Meta no aceptó el envío del mensaje";
        return { exito: false, error: errDesc };
      }
    } else {
      var errMediaDesc = resMediaJson.error ? ("(#" + resMediaJson.error.code + ") " + resMediaJson.error.message) : "Meta no pudo procesar el archivo subido";
      return { exito: false, error: errMediaDesc };
    }
  } catch(e) {
    return { exito: false, error: e.toString() };
  }
}

// Alias para compatibilidad
function enviarMediaWhatsApp(telefono, base64Data, mimeType, fileName) {
  return subirYEnviarArchivo(telefono, base64Data, fileName, mimeType);
}

// 3c. DESCARGAR MEDIA ENTRANTE (CON CACHÉ DE 6 HORAS)
function obtenerUrlDescargaMedia(mediaId, fileName) {
  if (!mediaId) return null;
  var cacheKey = "MEDIA_URL_" + mediaId;
  var cached = CacheService.getScriptCache().get(cacheKey);
  if (cached) return cached;

  try {
    var res = UrlFetchApp.fetch("https://graph.facebook.com/v20.0/" + mediaId, {
      headers: { "Authorization": "Bearer " + ACCESS_TOKEN },
      muteHttpExceptions: true
    });
    var metaJson = JSON.parse(res.getContentText());
    if (!metaJson || !metaJson.url) return null;

    var fileRes = UrlFetchApp.fetch(metaJson.url, {
      headers: { "Authorization": "Bearer " + ACCESS_TOKEN },
      muteHttpExceptions: true
    });
    var blob = fileRes.getBlob();
    if (fileName) blob.setName(fileName);

    var folders = DriveApp.getFoldersByName("Archivos_Recibidos_WhatsApp");
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("Archivos_Recibidos_WhatsApp");
    var driveFile = folder.createFile(blob);
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var driveUrl = "https://drive.google.com/uc?export=download&id=" + driveFile.getId();
    CacheService.getScriptCache().put(cacheKey, driveUrl, 21600);
    return driveUrl;
  } catch(e) {
    return null;
  }
}

// LIMPIADOR RIGUROSO DE TELÉFONOS (SENIOR DEV)
function cleanPhoneNum(val) {
  if (!val) return "";
  var s = String(val).trim();
  if (s.indexOf("e") !== -1 || s.indexOf("E") !== -1 || s.indexOf(".") !== -1) {
    var num = Number(val);
    if (!isNaN(num)) s = num.toFixed(0);
  }
  var clean = s.replace(/\D/g, "");
  if (!clean.startsWith("51") && clean.length === 9) clean = "51" + clean;
  return clean;
}

// PARSEADOR INFALIBLE DE FECHAS (SENIOR DEV)
function parseFechaSheet(raw, fallbackTs) {
  if (!raw) {
    var d = fallbackTs ? new Date(fallbackTs) : new Date();
    return { ts: d.getTime(), timeStr: Utilities.formatDate(d, "GMT-5", "HH:mm"), dateStr: Utilities.formatDate(d, "GMT-5", "dd/MM/yyyy"), fullStr: Utilities.formatDate(d, "GMT-5", "dd/MM/yyyy HH:mm") };
  }

  if (raw && typeof raw.getTime === 'function' && !isNaN(raw.getTime())) {
    var ts = raw.getTime();
    return {
      ts: ts,
      timeStr: Utilities.formatDate(raw, "GMT-5", "HH:mm"),
      dateStr: Utilities.formatDate(raw, "GMT-5", "dd/MM/yyyy"),
      fullStr: Utilities.formatDate(raw, "GMT-5", "dd/MM/yyyy HH:mm")
    };
  }

  var str = String(raw).trim();
  var mSp = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (mSp) {
    var day = parseInt(mSp[1], 10);
    var month = parseInt(mSp[2], 10) - 1;
    var year = parseInt(mSp[3], 10);
    var hour = mSp[4] ? parseInt(mSp[4], 10) : 0;
    var min = mSp[5] ? parseInt(mSp[5], 10) : 0;
    var sec = mSp[6] ? parseInt(mSp[6], 10) : 0;
    var dObj = new Date(year, month, day, hour, min, sec);
    if (!isNaN(dObj.getTime())) {
      var ts = dObj.getTime();
      return {
        ts: ts,
        timeStr: Utilities.formatDate(dObj, "GMT-5", "HH:mm"),
        dateStr: Utilities.formatDate(dObj, "GMT-5", "dd/MM/yyyy"),
        fullStr: Utilities.formatDate(dObj, "GMT-5", "dd/MM/yyyy HH:mm")
      };
    }
  }

  var d2 = new Date(str);
  if (d2 && typeof d2.getTime === 'function' && !isNaN(d2.getTime())) {
    var ts = d2.getTime();
    return {
      ts: ts,
      timeStr: Utilities.formatDate(d2, "GMT-5", "HH:mm"),
      dateStr: Utilities.formatDate(d2, "GMT-5", "dd/MM/yyyy"),
      fullStr: Utilities.formatDate(d2, "GMT-5", "dd/MM/yyyy HH:mm")
    };
  }

  var dFallback = fallbackTs ? new Date(fallbackTs) : new Date();
  return { ts: dFallback.getTime(), timeStr: Utilities.formatDate(dFallback, "GMT-5", "HH:mm"), dateStr: Utilities.formatDate(dFallback, "GMT-5", "dd/MM/yyyy"), fullStr: Utilities.formatDate(dFallback, "GMT-5", "dd/MM/yyyy HH:mm") };
}

// 4. OBTENER CHATS EN VIVO (CON LECTURA Y DESCARGA DE IMÁGENES/DOCUMENTOS ENTRANTES)
function obtenerChatsEnVivo() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var chatsMap = {};

  var clientStages = {};
  var crmSheet = ss.getSheetByName("Clientes_CRM");
  if (crmSheet && crmSheet.getLastRow() >= 2) {
    var crmData = crmSheet.getRange(2, 1, crmSheet.getLastRow() - 1, 3).getValues();
    for (var c = 0; c < crmData.length; c++) {
      var ph = cleanPhoneNum(crmData[c][0]);
      if (ph) clientStages[ph] = crmData[c][1] || "Nuevo Lead";
    }
  }

  // --- PASO 1: Leer mensajes ENTRANTES desde Logs (Optimizado para alto volumen) ---
  var logSheet = ss.getSheetByName("Logs");
  if (logSheet && logSheet.getLastRow() >= 2) {
    var lastRow = logSheet.getLastRow();
    var maxLogs = 1000;
    var startRow = Math.max(2, lastRow - maxLogs + 1);
    var countRows = lastRow - startRow + 1;
    var logsData = logSheet.getRange(startRow, 1, countRows, 2).getValues();
    for (var i = 0; i < logsData.length; i++) {
      try {
        var rawTime = logsData[i][0];
        if (!rawTime) continue;

        var rawStr = String(logsData[i][1] || "");
        if (!rawStr) continue;

        var parsed = null;
        try { parsed = JSON.parse(rawStr); } catch(err) { parsed = null; }

        var phone = "";
        var name = "";
        var msgObj = null;
        var metaSeconds = null;
        var rowIdx = i + 1;

        if (parsed && parsed.entry && parsed.entry[0] && parsed.entry[0].changes && parsed.entry[0].changes[0].value) {
          var val = parsed.entry[0].changes[0].value;
          if (val.messages && val.messages.length > 0) {
            var msg = val.messages[0];
            phone = cleanPhoneNum(msg.from);
            name = (val.contacts && val.contacts[0] && val.contacts[0].profile) ? val.contacts[0].profile.name : ("Cliente +" + phone);
            if (msg.timestamp) metaSeconds = parseInt(msg.timestamp, 10) * 1000;

            var dtInfo = parseFechaSheet(rawTime, metaSeconds);
            var ts = metaSeconds || dtInfo.ts;
            if (!ts || isNaN(ts) || ts <= 0) ts = 1784700000000 + (rowIdx * 1000);
            var fullStr = dtInfo.fullStr || "00/00/0000 00:00";
            var dateStr = dtInfo.dateStr || "";

            if (msg.type === "text" && msg.text) {
              msgObj = { type: 'inbound', text: msg.text.body, fullStr: fullStr, dateStr: dateStr, ts: ts, rowIdx: rowIdx };
            } else if (msg.type === "document") {
              var fileName = (msg.document && msg.document.filename) ? msg.document.filename : "Archivo PDF";
              var mediaId = msg.document ? msg.document.id : null;
              var mediaUrl = mediaId ? obtenerUrlDescargaMedia(mediaId, fileName) : null;
              msgObj = { type: 'inbound', text: "📎 " + fileName, mediaUrl: mediaUrl, fullStr: fullStr, dateStr: dateStr, ts: ts, rowIdx: rowIdx };
            } else if (msg.type === "image") {
              var mediaId = msg.image ? msg.image.id : null;
              var fileName = "imagen_" + (mediaId || Date.now()) + ".jpg";
              var mediaUrl = mediaId ? obtenerUrlDescargaMedia(mediaId, fileName) : null;
              msgObj = { type: 'inbound', text: "📷 Imagen recibida", mediaUrl: mediaUrl, fullStr: fullStr, dateStr: dateStr, ts: ts, rowIdx: rowIdx };
            } else if (msg.type === "interactive" && msg.interactive) {
              if (msg.interactive.nfm_reply) {
                var resJson = {};
                try {
                  var rawResp = msg.interactive.nfm_reply.response_json;
                  resJson = typeof rawResp === 'string' ? JSON.parse(rawResp) : rawResp;
                } catch(err) {}
                msgObj = {
                  type: 'survey_flow', fullStr: fullStr, dateStr: dateStr, ts: ts, rowIdx: rowIdx,
                  scores: {
                    rapidez: resJson.rapidez_respuesta || '5',
                    conocimiento: resJson.conocimiento_tecnico || '5',
                    acompanamiento: resJson.acompanamiento_operaciones || '5',
                    respaldo: resJson.respaldo_soporte || '5',
                    cambio: resJson.cambio_ejecutivo || 'No',
                    recomendacion: resJson.recomendar_msi || '5'
                  }
                };
              } else if (msg.interactive.button_reply) {
                msgObj = { type: 'inbound', text: msg.interactive.button_reply.title || "Opción seleccionada", fullStr: fullStr, dateStr: dateStr, ts: ts, rowIdx: rowIdx };
              }
            }
          }
        }

        // --- REGEX FALLBACK PARSER ---
        if (!msgObj && rawStr.indexOf("from") !== -1) {
          var mFrom = rawStr.match(/"from"\s*:\s*"(\d+)"/);
          if (mFrom) {
            phone = cleanPhoneNum(mFrom[1]);
            name = "Cliente +" + phone;
            var dtInfo = parseFechaSheet(rawTime);
            var ts = dtInfo.ts || (1784700000000 + (rowIdx * 1000));
            var fullStr = dtInfo.fullStr || "00/00/0000 00:00";
            var dateStr = dtInfo.dateStr || "";

            if (rawStr.indexOf("nfm_reply") !== -1 || rawStr.indexOf("response_json") !== -1) {
              var getScore = function(key) {
                var m = rawStr.match(new RegExp('\\\\?"' + key + '\\\\?"\\s*:\\s*\\\\?"([^\\\\"]+)\\\\?"'));
                return m ? m[1] : "5";
              };
              msgObj = {
                type: 'survey_flow', fullStr: fullStr, dateStr: dateStr, ts: ts, rowIdx: rowIdx,
                scores: {
                  rapidez: getScore("rapidez_respuesta"),
                  conocimiento: getScore("conocimiento_tecnico"),
                  acompanamiento: getScore("acompanamiento_operaciones"),
                  respaldo: getScore("respaldo_soporte"),
                  cambio: getScore("cambio_ejecutivo"),
                  recomendacion: getScore("recomendar_msi")
                }
              };
            } else {
              var mBody = rawStr.match(/"text"\s*:\s*\{\s*"body"\s*:\s*"([^"]+)"\}/) || rawStr.match(/"body"\s*:\s*"([^"]+)"/);
              if (mBody) {
                msgObj = { type: 'inbound', text: mBody[1], fullStr: fullStr, dateStr: dateStr, ts: ts, rowIdx: rowIdx };
              }
            }
          }
        }

        if (phone && msgObj) {
          if (!chatsMap[phone]) {
            chatsMap[phone] = { id: phone, phone: phone, name: name, lastMsg: '', time: msgObj.fullStr, stage: clientStages[phone] || "Nuevo Lead", messages: [] };
          }
          chatsMap[phone].time = msgObj.fullStr;
          if (msgObj.type === 'survey_flow') chatsMap[phone].lastMsg = "📋 Encuesta completada";
          else chatsMap[phone].lastMsg = msgObj.text || "Mensaje recibido";

          chatsMap[phone].messages.push(msgObj);
        }
      } catch(e) {}
    }
  }

  // --- PASO 2: Leer mensajes ENVIADOS desde MensajesEnviados (Optimizado) ---
  var envSheet = ss.getSheetByName("MensajesEnviados");
  if (envSheet && envSheet.getLastRow() >= 2) {
    var envLastRow = envSheet.getLastRow();
    var envMax = 1000;
    var envStartRow = Math.max(2, envLastRow - envMax + 1);
    var envCountRows = envLastRow - envStartRow + 1;
    var envData = envSheet.getRange(envStartRow, 1, envCountRows, 3).getValues();
    for (var j = 0; j < envData.length; j++) {
      try {
        var envTime = envData[j][0];
        if (!envTime) continue;
        var envDtInfo = parseFechaSheet(envTime);
        var envRowIdx = j + 100000;
        var envTs = envDtInfo.ts || (1784700000000 + (envRowIdx * 1000));

        var envFullStr = envDtInfo.fullStr || "00/00/0000 00:00";
        var envDateStr = envDtInfo.dateStr || "";
        var envPhone = cleanPhoneNum(envData[j][1]);
        if (!envPhone) continue;
        var envText = String(envData[j][2] || "");

        if (!chatsMap[envPhone]) {
          chatsMap[envPhone] = { id: envPhone, phone: envPhone, name: "Cliente +" + envPhone, lastMsg: '', time: envFullStr, stage: clientStages[envPhone] || "Nuevo Lead", messages: [] };
        }
        chatsMap[envPhone].messages.push({ type: 'outbound', text: envText, fullStr: envFullStr, dateStr: envDateStr, ts: envTs, rowIdx: envRowIdx });
        chatsMap[envPhone].lastMsg = "Tú: " + envText;
        chatsMap[envPhone].time = envFullStr;
      } catch(e) {}
    }
  }

  var result = [];
  var phones = Object.keys(chatsMap);
  for (var k = 0; k < phones.length; k++) {
    var chat = chatsMap[phones[k]];
    
    // 1. Ordenar los mensajes cronológicamente
    chat.messages.sort(function(a, b) {
      if (a.ts && b.ts && a.ts !== b.ts) {
        return a.ts - b.ts;
      }
      return (a.rowIdx || 0) - (b.rowIdx || 0);
    });
    
    // 2. REPARACIÓN DEL BUG: Actualizar 'time' y 'lastMsg' según el VERDADERO último mensaje de la lista ordenada
    if (chat.messages.length > 0) {
      var lastM = chat.messages[chat.messages.length - 1];
      chat.time = lastM.fullStr;
      if (lastM.type === 'outbound') {
        chat.lastMsg = "Tú: " + lastM.text;
      } else if (lastM.type === 'survey_flow') {
        chat.lastMsg = "📋 Encuesta completada";
      } else {
        chat.lastMsg = lastM.text || "Mensaje recibido";
      }
    }
    
    // 3. Contar mensajes NO LEÍDOS (inbound después del último outbound)
    var unread = 0;
    for (var m = chat.messages.length - 1; m >= 0; m--) {
      if (chat.messages[m].type === 'outbound') break;
      if (chat.messages[m].type === 'inbound' || chat.messages[m].type === 'survey_flow') {
        unread++;
      }
    }
    chat.unreadCount = unread;
    
    result.push(chat);
  }

  result.sort(function(a, b) {
    var lastA = (a.messages && a.messages.length > 0) ? (a.messages[a.messages.length - 1].ts || 0) : 0;
    var lastB = (b.messages && b.messages.length > 0) ? (b.messages[b.messages.length - 1].ts || 0) : 0;
    return lastB - lastA;
  });

  return result;
}

function actualizarEtapaCliente(telefono, nuevaEtapa) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var cleanPhone = cleanPhoneNum(telefono);
  var sheet = ss.getSheetByName("Clientes_CRM");
  if (!sheet) {
    sheet = ss.insertSheet("Clientes_CRM");
    sheet.appendRow(["Teléfono", "Etapa_Kanban", "Fecha_Actualización"]);
  }

  var data = sheet.getDataRange().getValues();
  var encon = false;
  for (var i = 1; i < data.length; i++) {
    if (cleanPhoneNum(data[i][0]) === cleanPhone) {
      sheet.getRange(i + 1, 2).setValue(nuevaEtapa);
      sheet.getRange(i + 1, 3).setValue(new Date());
      encon = true;
      break;
    }
  }

  if (!encon) {
    sheet.appendRow([cleanPhone, nuevaEtapa, new Date()]);
  }
  return { exito: true };
}

function registrarTrazabilidad(ss, telefono, estado) {
  var sheet = ss.getSheetByName("Trazabilidad");
  if (!sheet) {
    sheet = ss.insertSheet("Trazabilidad");
    sheet.appendRow(["Fecha y Hora", "Teléfono del Cliente", "Estado del Mensaje"]);
  }
  sheet.appendRow([new Date(), cleanPhoneNum(telefono), estado]);
}

function getCrmHtml() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp CRM | MSI ADUANAS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css" rel="stylesheet">
  <style>
    :root {
      --wa-deep:#0b141a;
      --wa-app:#111b21;
      --wa-header:#202c33;
      --wa-chat:#0b141a;
      --wa-green:#00a884;
      --wa-green-dk:#017561;
      --wa-out:#005c4b;
      --wa-in:#202c33;
      --wa-txt:#e9edef;
      --wa-txt2:#8696a0;
      --wa-border:rgba(134,150,160,.15);
    }
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{height:100%;overflow:hidden;font-family:'Inter','Segoe UI',sans-serif;background:var(--wa-deep);color:var(--wa-txt);transform:translateZ(0);will-change:transform}

    .app{width:100%;height:100%;display:flex}
    .col-side{width:380px;min-width:300px;max-width:420px;display:flex;flex-direction:column;background:var(--wa-app);border-right:1px solid var(--wa-border)}
    .col-chat{flex:1;display:flex;flex-direction:column;background:var(--wa-chat);min-width:0;position:relative;height:100%;max-height:100vh;overflow:hidden}
    .col-info{width:340px;min-width:280px;max-width:380px;display:flex;flex-direction:column;background:var(--wa-app);border-left:1px solid var(--wa-border);overflow-y:auto}

    .side-hdr{height:59px;background:var(--wa-header);display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid var(--wa-border)}
    .logo-pill{display:flex;align-items:center;gap:10px}
    .logo-pill .av{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#00a884,#017561);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.95rem;color:#fff;flex-shrink:0}
    .logo-pill span{font-weight:600;font-size:.95rem}
    .hdr-icons{display:flex;gap:16px;color:var(--wa-txt2);font-size:1.25rem;align-items:center}
    .hdr-icons i{cursor:pointer;transition:color .15s}
    .hdr-icons i:hover{color:var(--wa-txt)}

    .search-box{padding:7px 12px;border-bottom:1px solid var(--wa-border)}
    .search-inner{background:var(--wa-header);border-radius:8px;display:flex;align-items:center;padding:0 12px}
    .search-inner i{color:var(--wa-txt2);font-size:.95rem}
    .search-inner input{flex:1;background:none;border:none;padding:8px 10px;color:var(--wa-txt);outline:none;font-size:.87rem}
    .search-inner input::placeholder{color:var(--wa-txt2)}

    .chat-list{flex:1;overflow-y:auto}
    .chat-list::-webkit-scrollbar{width:6px}
    .chat-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}

    .ci{display:flex;align-items:center;gap:13px;padding:13px 16px;cursor:pointer;border-bottom:1px solid var(--wa-border);transition:background .12s}
    .ci:hover{background:rgba(255,255,255,.04)}
    .ci.act{background:#2a3942}
    .ci .av{width:49px;height:49px;border-radius:50%;background:#374151;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:1.05rem;color:#fff;flex-shrink:0}
    .ci-body{flex:1;min-width:0}
    .ci-r1{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}
    .ci-name{font-weight:600;font-size:.93rem}
    .ci-time{font-size:.70rem;color:var(--wa-green);font-weight:600}
    .ci-r2{font-size:.82rem;color:var(--wa-txt2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

    .chat-hdr{height:59px;background:var(--wa-header);display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid var(--wa-border)}
    .chat-hdr .av{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#00a884,#017561);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.95rem;color:#fff;flex-shrink:0}
    .u-info{display:flex;align-items:center;gap:12px}
    .u-name{font-weight:600;font-size:.95rem}
    .u-status{font-size:.73rem;color:var(--wa-green)}

    .msg-area{flex:1;height:calc(100vh - 121px);max-height:calc(100vh - 121px);padding:16px 5%;overflow-y:auto;display:flex;flex-direction:column;gap:6px;scroll-behavior:auto;min-height:0}
    .msg-area::-webkit-scrollbar{width:6px}
    .msg-area::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}

    .badge-day{align-self:center;background:#182229;color:#34d399;font-size:.75rem;font-weight:700;padding:6px 16px;border-radius:8px;margin:12px 0 6px;box-shadow:0 1px 2px rgba(0,0,0,.3);letter-spacing:.3px;border:1px solid rgba(0,168,132,.3)}

    .bub{max-width:65%;padding:8px 12px 5px;border-radius:7.5px;font-size:.9rem;line-height:1.45;position:relative;word-wrap:break-word}
    .bub.in{align-self:flex-start;background:var(--wa-in);border-top-left-radius:0}
    .bub.out{align-self:flex-end;background:var(--wa-out);border-top-right-radius:0}
    .bub .ts{display:flex;justify-content:flex-end;align-items:center;gap:4px;font-size:.66rem;color:rgba(255,255,255,.6);margin-top:4px;font-weight:500}
    .bub.out .ts .ck{color:rgba(83,180,240,.9);font-size:.72rem}

    .dl-btn{margin-top:6px;display:inline-block}
    .dl-btn a{background:#00a884;color:#fff;padding:6px 12px;border-radius:6px;font-size:.78rem;text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,.25);transition:background .15s}
    .dl-btn a:hover{background:#017561}

    .sv-card{background:rgba(0,0,0,.22);border:1px solid rgba(0,168,132,.35);border-radius:8px;padding:10px 12px;margin-top:3px}
    .sv-title{color:var(--wa-green);font-weight:700;font-size:.85rem;margin-bottom:6px;display:flex;align-items:center;gap:5px}
    .sv-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.78rem}
    .sv-item{background:rgba(255,255,255,.05);padding:5px 7px;border-radius:5px}
    .sv-lbl{color:var(--wa-txt2);font-size:.66rem}
    .sv-val{color:#34d399;font-weight:700}

    .compose{height:62px;min-height:62px;background:var(--wa-header);display:flex;align-items:center;gap:10px;padding:8px 16px;border-top:1px solid var(--wa-border);position:relative}
    .compose .ic{font-size:1.4rem;color:var(--wa-txt2);cursor:pointer;flex-shrink:0;transition:color .15s}
    .compose .ic:hover{color:var(--wa-txt)}
    .compose input{flex:1;background:#2a3942;border:none;border-radius:8px;padding:10px 14px;color:var(--wa-txt);outline:none;font-size:.9rem;min-width:0}
    .compose input::placeholder{color:var(--wa-txt2)}
    .send-btn{width:42px;height:42px;border-radius:50%;background:var(--wa-green);color:var(--wa-deep);border:none;display:flex;align-items:center;justify-content:center;font-size:1.2rem;cursor:pointer;flex-shrink:0;transition:transform .12s,background .15s}
    .send-btn:hover{background:var(--wa-green-dk);transform:scale(1.06)}

    .info-inner{padding:20px 18px;display:flex;flex-direction:column;gap:18px}
    .info-profile{text-align:center;padding-bottom:16px;border-bottom:1px solid var(--wa-border)}
    .info-profile .big-av{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#00a884,#017561);margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:1.9rem;font-weight:700;color:#fff}
    .info-profile h3{font-size:1.05rem;margin-bottom:3px}
    .info-profile p{font-size:.82rem;color:var(--wa-txt2)}

    .info-section .sec-title{font-size:.75rem;font-weight:700;color:var(--wa-txt2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
    .info-card{background:var(--wa-header);padding:12px 14px;border-radius:8px;font-size:.82rem}
    .info-row{display:flex;justify-content:space-between;margin-bottom:7px}
    .info-row:last-child{margin-bottom:0}
    .info-row .lbl{color:var(--wa-txt2)}

    .empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--wa-txt2);gap:12px;padding:20px}
    .empty-state i{font-size:4rem;opacity:.3}
    .empty-state p{font-size:.95rem;text-align:center;max-width:320px;line-height:1.5}

    @media(max-width:1100px){.col-info{display:none}}
    @media(max-width:768px){
      .col-side{position:absolute;z-index:10;width:100%;max-width:100%;height:100%;transform:translateX(0);transition:transform .25s}
      .col-side.hidden{transform:translateX(-100%)}
      .col-chat{width:100%}
      .back-btn{display:flex !important}
    }
    .back-btn{display:none;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;cursor:pointer;color:var(--wa-txt2);font-size:1.3rem;flex-shrink:0;transition:background .15s}
    .back-btn:hover{background:rgba(255,255,255,.07)}

    .emoji-picker{display:none;position:absolute;bottom:70px;left:16px;width:340px;max-height:320px;background:var(--wa-header);border:1px solid var(--wa-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:50;flex-direction:column;overflow:hidden}
    .emoji-picker.show{display:flex}
    .emoji-tabs{display:flex;border-bottom:1px solid var(--wa-border);padding:6px 8px;gap:4px;flex-shrink:0}
    .emoji-tab{flex:1;text-align:center;padding:6px 0;font-size:1.1rem;cursor:pointer;border-radius:6px;transition:background .12s}
    .emoji-tab:hover,.emoji-tab.act{background:rgba(255,255,255,.08)}
    .emoji-grid{flex:1;overflow-y:auto;padding:8px;display:grid;grid-template-columns:repeat(8,1fr);gap:2px}
    .emoji-grid::-webkit-scrollbar{width:5px}
    .emoji-grid::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
    .emoji-cell{display:flex;align-items:center;justify-content:center;font-size:1.4rem;padding:6px;border-radius:6px;cursor:pointer;transition:background .1s,transform .1s}
    .emoji-cell:hover{background:rgba(255,255,255,.1);transform:scale(1.15)}
    .emoji-search{background:rgba(255,255,255,.05);border:none;border-radius:6px;padding:7px 10px;color:var(--wa-txt);font-size:.82rem;outline:none;margin:6px 8px 2px}
    .emoji-search::placeholder{color:var(--wa-txt2)}

    .modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center}
    .modal-overlay.show{display:flex}
    .modal-box{background:var(--wa-header);border-radius:12px;padding:24px;width:480px;max-width:92vw;box-shadow:0 12px 40px rgba(0,0,0,.5)}
    .modal-box h3{font-size:1rem;margin-bottom:16px;display:flex;align-items:center;gap:8px}
    .modal-box h3 i{color:var(--wa-green);font-size:1.2rem}
    .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}
    .modal-actions button{padding:9px 20px;border-radius:8px;border:none;font-size:.88rem;font-weight:600;cursor:pointer;transition:background .15s,transform .1s}
    .btn-cancel{background:rgba(255,255,255,.08);color:var(--wa-txt)}
    .btn-cancel:hover{background:rgba(255,255,255,.12)}
    .btn-send-file{background:var(--wa-green);color:var(--wa-deep)}
    .btn-send-file:hover{background:var(--wa-green-dk);transform:scale(1.02)}
    .btn-send-file:disabled{opacity:.5;cursor:not-allowed}

    .dropzone{border:2px dashed rgba(0,168,132,.4);border-radius:12px;padding:32px 20px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s}
    .dropzone:hover,.dropzone.dragover{border-color:var(--wa-green);background:rgba(0,168,132,.08)}
    .dropzone i{font-size:2.5rem;color:var(--wa-green);margin-bottom:8px;display:block}
    .dropzone p{color:var(--wa-txt2);font-size:.88rem;line-height:1.5}
    .dropzone p strong{color:var(--wa-txt)}
    .dropzone-hint{font-size:.72rem;color:var(--wa-txt2);margin-top:6px}

    .file-preview{display:none;background:rgba(255,255,255,.05);border-radius:10px;padding:14px;margin-top:14px;align-items:center;gap:12px}
    .file-preview.show{display:flex}
    .file-preview .fp-icon{width:48px;height:48px;border-radius:8px;background:var(--wa-green);display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:#fff;flex-shrink:0}
    .file-preview .fp-icon.img-type{background:#8b5cf6}
    .file-preview .fp-info{flex:1;min-width:0}
    .file-preview .fp-name{font-size:.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .file-preview .fp-size{font-size:.73rem;color:var(--wa-txt2)}
    .file-preview .fp-remove{width:32px;height:32px;border-radius:50%;background:rgba(239,68,68,.15);display:flex;align-items:center;justify-content:center;color:#ef4444;cursor:pointer;font-size:1.1rem;flex-shrink:0;transition:background .15s}
    .file-preview .fp-remove:hover{background:rgba(239,68,68,.3)}
    .file-preview .fp-thumb{width:48px;height:48px;border-radius:8px;object-fit:cover}

    .drag-overlay{display:none;position:absolute;inset:0;background:rgba(0,168,132,.12);border:3px dashed var(--wa-green);z-index:40;align-items:center;justify-content:center;flex-direction:column;gap:8px;pointer-events:none}
    .drag-overlay.show{display:flex}
    .drag-overlay i{font-size:3rem;color:var(--wa-green)}
    .drag-overlay p{color:var(--wa-green);font-weight:600;font-size:1rem}

    .auth-overlay{position:fixed;inset:0;background:var(--wa-deep);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px)}
    .auth-card{background:var(--wa-app);border:1px solid var(--wa-border);border-radius:16px;padding:36px;width:380px;max-width:90vw;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.8)}
    .auth-card .auth-logo{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#00a884,#017561);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;color:#fff;box-shadow:0 6px 16px rgba(0,168,132,.3)}
    .auth-card h2{font-size:1.15rem;margin-bottom:6px}
    .auth-card p{font-size:.82rem;color:var(--wa-txt2);margin-bottom:24px}
    .auth-field{position:relative;margin-bottom:20px}
    .auth-field input{width:100%;background:var(--wa-header);border:1px solid var(--wa-border);border-radius:10px;padding:12px 16px;color:var(--wa-txt);font-size:.95rem;outline:none;text-align:center;letter-spacing:2px;transition:border-color .2s}
    .auth-field input:focus{border-color:var(--wa-green)}
    .auth-btn{width:100%;background:var(--wa-green);color:var(--wa-deep);border:none;border-radius:10px;padding:12px;font-size:.95rem;font-weight:700;cursor:pointer;transition:background .15s,transform .1s}
    .auth-btn:hover{background:var(--wa-green-dk);transform:scale(1.02)}
    .auth-error{color:#ef4444;font-size:.78rem;margin-top:10px;display:none}

    .scroll-bottom-btn{position:absolute;bottom:75px;right:24px;width:42px;height:42px;border-radius:50%;background:#00a884;color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;cursor:pointer;box-shadow:0 6px 16px rgba(0,168,132,.4);z-index:30;transition:transform .15s,background .15s}
    .scroll-bottom-btn:hover{transform:scale(1.1);background:#017561}
  </style>
</head>
<body>

<div class="app">
  <aside class="col-side" id="sidebar">
    <div class="side-hdr">
      <div class="logo-pill"><div class="av">MSI</div><span>MSI Aduanas</span><span style="font-size:0.7rem;background:rgba(0,168,132,0.15);color:var(--wa-green);padding:3px 8px;border-radius:12px;font-weight:600;margin-left:4px;">WhatsApp API</span></div>
      <div class="hdr-icons">
        <i class="ri-volume-up-line" id="soundToggleBtn" title="Notificación Sonora Activada" onclick="toggleSound()" style="color:var(--wa-green)"></i>
        <i class="ri-refresh-line" title="Actualizar" onclick="loadChats()"></i>
        <i class="ri-lock-line" title="Bloquear Panel" onclick="lockPanel()" style="color:#ef4444"></i>
      </div>
    </div>
    <div class="search-box"><div class="search-inner"><i class="ri-search-line"></i><input id="searchInput" placeholder="Buscar o iniciar nuevo chat" oninput="renderList()"></div></div>
    <div class="chat-list" id="chatList"></div>
  </aside>

  <section class="col-chat">
    <div class="chat-hdr" id="chatHdr" style="display:none">
      <div class="u-info">
        <div class="back-btn" onclick="showSidebar()"><i class="ri-arrow-left-s-line"></i></div>
        <div class="av" id="hdrAv">MSI</div>
        <div><div class="u-name" id="hdrName">—</div><div class="u-status" id="hdrStatus">en línea</div></div>
      </div>
      <div class="hdr-icons"><i class="ri-search-2-line"></i><i class="ri-more-2-fill"></i></div>
    </div>

    <div class="empty-state" id="emptyState">
      <i class="ri-whatsapp-line"></i>
      <p><strong>WhatsApp CRM — MSI ADUANAS</strong><br>Selecciona un chat para ver la conversación y responder mensajes en tiempo real.</p>
    </div>

    <div class="msg-area" id="msgArea" style="display:none"></div>
    <div class="scroll-bottom-btn" id="scrollBottomBtn" style="display:none" onclick="forceScrollBottom()"><i class="ri-arrow-down-line"></i></div>
    <div class="drag-overlay" id="dragOverlay"><i class="ri-download-cloud-2-line"></i><p>Suelta el archivo aquí para enviarlo</p></div>

    <div class="compose" id="composeBar" style="display:none">
      <i class="ri-emotion-happy-line ic" id="btnEmoji" onclick="toggleEmoji()"></i>
      <i class="ri-attachment-2 ic" id="btnAttach" onclick="openAttachModal()"></i>
      <input id="replyInput" placeholder="Escribe un mensaje..." onkeydown="if(event.key==='Enter'){event.preventDefault();sendReply();}" onfocus="closeEmoji()">
      <button class="send-btn" onclick="sendReply()"><i class="ri-send-plane-2-fill"></i></button>
      <div class="emoji-picker" id="emojiPicker">
        <input class="emoji-search" id="emojiSearch" placeholder="Buscar emoji..." oninput="filterEmojis()">
        <div class="emoji-tabs" id="emojiTabs"></div>
        <div class="emoji-grid" id="emojiGrid"></div>
      </div>
    </div>
  </section>

  <aside class="col-info">
    <div class="info-inner" id="infoPanel">
      <div class="info-profile">
        <div class="big-av" id="infAv">MSI</div>
        <h3 id="infName">MSI Aduanas</h3>
        <p id="infPhone">+51 913 984 252</p>
      </div>
      <div class="info-section">
        <div class="sec-title">Información Comercial</div>
        <div class="info-card">
          <div class="info-row"><span class="lbl">Empresa</span><strong>MSI ADUANAS</strong></div>
          <div class="info-row"><span class="lbl">Ejecutivo</span><strong>Jade Vega</strong></div>
          <div class="info-row"><span class="lbl">Canal</span><strong style="color:var(--wa-green)">WhatsApp API</strong></div>
        </div>
      </div>
      <div class="info-section" id="surveySection" style="display:none">
        <div class="sec-title">Última Encuesta</div>
        <div class="info-card" id="surveyCard"></div>
      </div>
    </div>
  </aside>
</div>

<div class="modal-overlay" id="attachModal">
  <div class="modal-box">
    <h3><i class="ri-attachment-2"></i> Enviar Archivo por WhatsApp</h3>
    <div class="dropzone" id="dropzone" onclick="document.getElementById('fileInput').click()">
      <i class="ri-upload-cloud-2-line"></i>
      <p><strong>Haz clic aquí</strong> para seleccionar un archivo<br>o arrástralo directamente</p>
      <div class="dropzone-hint">PDF, Word, Excel, Imágenes (máx 16 MB)</div>
    </div>
    <input type="file" id="fileInput" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp" style="display:none" onchange="handleFileSelect(this)">
    <div class="file-preview" id="filePreview">
      <div class="fp-icon" id="fpIcon"><i class="ri-file-pdf-2-line"></i></div>
      <div class="fp-info">
        <div class="fp-name" id="fpName">archivo.pdf</div>
        <div class="fp-size" id="fpSize">1.2 MB</div>
      </div>
      <div class="fp-remove" onclick="clearFileSelection()"><i class="ri-close-line"></i></div>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeAttachModal()">Cancelar</button>
      <button class="btn-send-file" id="btnSendFile" onclick="sendFileAttachment()" disabled><i class="ri-send-plane-fill"></i> Enviar Archivo</button>
    </div>
  </div>
</div>

<div class="auth-overlay" id="authOverlay">
  <div class="auth-card">
    <div class="auth-logo"><i class="ri-shield-keyhole-line"></i></div>
    <h2>Acceso Restringido</h2>
    <p>Introduce la clave de seguridad corporativa para ingresar al CRM de MSI ADUANAS.</p>
    <div class="auth-field">
      <input type="password" id="authPinInput" placeholder="Clave de Seguridad" onkeypress="if(event.key==='Enter')submitAuthPin()">
    </div>
    <button class="auth-btn" onclick="submitAuthPin()"><i class="ri-lock-unlock-line"></i> Ingresar al Panel</button>
    <div class="auth-error" id="authError">Clave de seguridad incorrecta. Inténtalo nuevamente.</div>
  </div>
</div>

<script>
var chats=[];
var activePhone="";
var lastChatsHash="";
var knownMsgCountMap={};
var soundEnabled=true;
var audioCtx=null;

function playNotificationSound() {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    var now = audioCtx.currentTime;
    
    var osc1 = audioCtx.createOscillator();
    var gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.51, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    var osc2 = audioCtx.createOscillator();
    var gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760, now + 0.09);
    gain2.gain.setValueAtTime(0.22, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.32);
  } catch(e) {}
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  var btn = document.getElementById("soundToggleBtn");
  if (btn) {
    if (soundEnabled) {
      btn.className = "ri-volume-up-line";
      btn.style.color = "var(--wa-green)";
      btn.title = "Notificación Sonora Activada";
      playNotificationSound();
    } else {
      btn.className = "ri-volume-mute-line";
      btn.style.color = "#ef4444";
      btn.title = "Notificación Sonora Silenciada";
    }
  }
}

function checkNewInboundMessages(newChats) {
  var hasNewInbound = false;
  for (var i = 0; i < newChats.length; i++) {
    var c = newChats[i];
    var phone = c.phone;
    var inboundCount = 0;
    for (var j = 0; j < c.messages.length; j++) {
      if (c.messages[j].type !== 'outbound') {
        inboundCount++;
      }
    }
    
    if (knownMsgCountMap[phone] !== undefined) {
      if (inboundCount > knownMsgCountMap[phone]) {
        hasNewInbound = true;
      }
    }
    knownMsgCountMap[phone] = inboundCount;
  }
  
  if (hasNewInbound) {
    playNotificationSound();
  }
}

function loadChats(){
  google.script.run.withSuccessHandler(function(data){
    if(data&&data.length>0){
      checkNewInboundMessages(data);
      var newHash = JSON.stringify(data);
      if(newHash !== lastChatsHash){
        lastChatsHash = newHash;
        chats=data;
        renderList();
        if(activePhone) openChat(activePhone, true);
        else if(chats[0] && chats[0].phone) openChat(chats[0].phone);
      }
    }
  }).obtenerChatsEnVivo();
}

function renderList(){
  var el=document.getElementById("chatList");
  if(!el) return;
  el.innerHTML="";
  var q=document.getElementById("searchInput").value.toLowerCase();
  for(var i=0;i<chats.length;i++){
    var c=chats[i];
    if(q&&c.name.toLowerCase().indexOf(q)===-1&&c.phone.indexOf(q)===-1)continue;
    var init=getInitials(c.name);
    var div=document.createElement("div");
    div.className="ci"+(c.phone===activePhone?" act":"");
    div.setAttribute("data-ph",c.phone);
    div.onclick=(function(ph){return function(){openChat(ph)}})(c.phone);
    div.innerHTML='<div class="av">'+init+'</div><div class="ci-body"><div class="ci-r1"><span class="ci-name">'+esc(c.name)+'</span><span class="ci-time">'+(c.time||"")+'</span></div><div class="ci-r2">'+esc(c.lastMsg)+'</div></div>';
    el.appendChild(div);
  }
}

function forceScrollBottom(){
  var area=document.getElementById("msgArea");
  if(!area) return;
  var b=document.getElementById("chatBottomAnchor");
  if(b) b.scrollIntoView({ behavior: 'smooth', block: 'end' });
  area.scrollTop = area.scrollHeight + 999999;
}

function openChat(ph, isAutoRefresh){
  activePhone=ph;
  if(!isAutoRefresh) renderList();
  var c=findChat(ph);
  if(!c)return;

  document.getElementById("emptyState").style.display="none";
  document.getElementById("chatHdr").style.display="flex";
  document.getElementById("msgArea").style.display="flex";
  document.getElementById("composeBar").style.display="flex";
  document.getElementById("scrollBottomBtn").style.display="flex";

  var init=getInitials(c.name);
  document.getElementById("hdrAv").innerText=init;
  document.getElementById("hdrName").innerText=c.name;
  document.getElementById("hdrStatus").innerHTML='<span style="color:var(--wa-green);font-weight:600;">● Línea WhatsApp Cloud API Activa</span> • +'+c.phone;

  document.getElementById("infAv").innerText=init;
  document.getElementById("infName").innerText=c.name;
  document.getElementById("infPhone").innerText="+"+c.phone;

  var area=document.getElementById("msgArea");
  area.innerHTML="";

  var lastDate="";
  var lastSurvey=null;

  for(var i=0;i<c.messages.length;i++){
    var m=c.messages[i];
    
    var msgDate = m.dateStr || "Fecha Desconocida";
    if (msgDate !== lastDate) {
      lastDate = msgDate;
      var dBadge = document.createElement("div");
      dBadge.className = "badge-day";
      dBadge.innerText = "📅 " + msgDate;
      area.appendChild(dBadge);
    }

    var div=document.createElement("div");

    if(m.type==="survey_flow"){
      lastSurvey=m.scores;
      div.className="bub in";
      div.style.maxWidth="80%";
      var html='<div class="sv-card"><div class="sv-title"><i class="ri-checkbox-circle-fill"></i> Encuesta Respondida</div>';
      html+='<div class="sv-grid">';
      html+='<div class="sv-item"><div class="sv-lbl">Rapidez</div><div class="sv-val">'+esc(m.scores.rapidez)+' / 5</div></div>';
      html+='<div class="sv-item"><div class="sv-lbl">Técnico</div><div class="sv-val">'+esc(m.scores.conocimiento)+' / 5</div></div>';
      html+='<div class="sv-item"><div class="sv-lbl">Acompañamiento</div><div class="sv-val">'+esc(m.scores.acompanamiento)+' / 5</div></div>';
      html+='<div class="sv-item"><div class="sv-lbl">Respaldo MSI</div><div class="sv-val">'+esc(m.scores.respaldo)+' / 5</div></div>';
      html+='</div>';
      html+='<div style="margin-top:6px;font-size:.73rem;color:var(--wa-txt2)">Cambiar ejecutivo: <strong style="color:#fff">'+esc(m.scores.cambio)+'</strong></div>';
      html+='</div>';
      html+='<div class="ts">📅 '+(m.fullStr||"")+'</div>';
      div.innerHTML=html;
    } else if(m.type==="outbound"){
      div.className="bub out";
      if (m.text && m.text.indexOf("Encuesta") !== -1) {
        div.style.background = "linear-gradient(135deg, #005c4b, #017561)";
        div.style.border = "1px solid #00a884";
        div.innerHTML = '<div style="font-weight:600;display:flex;align-items:center;gap:6px;"><i class="ri-file-list-3-line" style="font-size:1.1rem;color:#34d399;"></i> ' + esc(m.text) + '</div><div class="ts">📅 ' + (m.fullStr||"") + ' <i class="ri-check-double-line ck"></i></div>';
      } else {
        div.innerHTML='<div>'+esc(m.text)+'</div><div class="ts">📅 '+(m.fullStr||"")+' <i class="ri-check-double-line ck"></i></div>';
      }
    } else {
      div.className="bub in";
      var contentHtml = '<div>' + esc(m.text) + '</div>';
      if (m.mediaUrl) {
        contentHtml += '<div class="dl-btn"><a href="' + m.mediaUrl + '" target="_blank"><i class="ri-download-2-line"></i> Descargar Archivo Recibido</a></div>';
      }
      div.innerHTML = contentHtml + '<div class="ts">📅 ' + (m.fullStr||"") + '</div>';
    }
    area.appendChild(div);
  }

  var bElement = document.createElement("div");
  bElement.id = "chatBottomAnchor";
  bElement.style.height = "1px";
  bElement.style.width = "100%";
  area.appendChild(bElement);

  function executeScroll(){
    var b=document.getElementById("chatBottomAnchor");
    if(b) b.scrollIntoView({ behavior: 'auto', block: 'end' });
    area.scrollTop = area.scrollHeight + 999999;
  }

  executeScroll();
  setTimeout(executeScroll, 50);
  setTimeout(executeScroll, 200);
  setTimeout(executeScroll, 600);

  var ss=document.getElementById("surveySection");
  if(lastSurvey){
    ss.style.display="block";
    var nums=[parseFloat(lastSurvey.rapidez)||0,parseFloat(lastSurvey.conocimiento)||0,parseFloat(lastSurvey.acompanamiento)||0,parseFloat(lastSurvey.respaldo)||0];
    var avg=nums.reduce(function(a,b){return a+b},0)/nums.length;
    document.getElementById("surveyCard").innerHTML='<div style="color:var(--wa-green);font-weight:700;font-size:1rem;margin-bottom:6px">Promedio: '+avg.toFixed(1)+' / 5.0 ⭐</div><div style="font-size:.8rem;display:flex;flex-direction:column;gap:3px"><div>• Rapidez: <strong>'+esc(lastSurvey.rapidez)+'</strong></div><div>• Técnico: <strong>'+esc(lastSurvey.conocimiento)+'</strong></div><div>• Acompañamiento: <strong>'+esc(lastSurvey.acompanamiento)+'</strong></div><div>• Respaldo: <strong>'+esc(lastSurvey.respaldo)+'</strong></div><div>• Cambio Ejecutivo: <strong>'+esc(lastSurvey.cambio)+'</strong></div></div>';
  } else {
    ss.style.display="none";
  }

  if(window.innerWidth<=768)document.getElementById("sidebar").classList.add("hidden");
}

function sendReply(){
  var input=document.getElementById("replyInput");
  var txt=input.value.trim();
  if(!txt) return;

  if(!activePhone){
    if(chats && chats.length > 0 && chats[0].phone) {
      activePhone = chats[0].phone;
    } else {
      alert("Por favor selecciona un chat de la lista izquierda primero.");
      return;
    }
  }

  var targetPhone = cleanPhoneNum(activePhone);
  if(targetPhone === "51913984252") {
    alert("⚠️ No puedes enviar mensajes a la misma línea corporativa (+51 913 984 252). Selecciona un cliente real de la lista.");
    return;
  }

  input.value="";

  var now=new Date();
  var day=String(now.getDate()).padStart(2,"0");
  var mnt=String(now.getMonth()+1).padStart(2,"0");
  var yr=now.getFullYear();
  var h=String(now.getHours()).padStart(2,"0");
  var mn=String(now.getMinutes()).padStart(2,"0");
  var fullStr=day+"/"+mnt+"/"+yr+" "+h+":"+mn;

  var area=document.getElementById("msgArea");
  var div=document.createElement("div");
  div.className="bub out";
  div.innerHTML='<div>'+esc(txt)+'</div><div class="ts">📅 '+fullStr+' <i class="ri-time-line ck" style="color:var(--wa-txt2)"></i></div>';
  
  var bAnchor=document.getElementById("chatBottomAnchor");
  if(bAnchor) area.insertBefore(div, bAnchor);
  else area.appendChild(div);

  forceScrollBottom();

  var c=findChat(activePhone);
  if(c)c.messages.push({type:"outbound",text:txt,fullStr:fullStr,ts:now.getTime()});

  google.script.run.withSuccessHandler(function(res){
    if(res&&res.exito){
      var ticks=div.querySelector(".ck");
      if(ticks){ticks.className="ri-check-double-line ck";ticks.style.color="rgba(83,180,240,.85)";}
    } else {
      var ticks=div.querySelector(".ck");
      if(ticks){ticks.className="ri-close-line ck";ticks.style.color="#ef4444";}
      alert("Error Meta: "+(res?res.error:"Sin respuesta"));
    }
  }).withFailureHandler(function(err){
    var ticks=div.querySelector(".ck");
    if(ticks){ticks.className="ri-close-line ck";ticks.style.color="#ef4444";}
    alert("Error de conexión: "+err);
  }).enviarRespuestaManual(targetPhone,txt);
}

function showSidebar(){document.getElementById("sidebar").classList.remove("hidden")}
function findChat(ph){for(var i=0;i<chats.length;i++){if(chats[i].phone===ph)return chats[i]}return null}
function getInitials(n){var parts=n.split(" ");var r="";for(var i=0;i<Math.min(parts.length,2);i++){if(parts[i][0])r+=parts[i][0]}return r.toUpperCase()}
function esc(s){if(!s)return"";var d=document.createElement("div");d.appendChild(document.createTextNode(s));return d.innerHTML}

var isAuthorized=false;
var inactivityTimer=null;

function checkAuthOnLoad(){
  var token=sessionStorage.getItem("crm_auth_token");
  if(token){
    isAuthorized=true;
    document.getElementById("authOverlay").style.display="none";
    loadChats();
    resetInactivityTimer();
  } else {
    isAuthorized=false;
    document.getElementById("authOverlay").style.display="flex";
  }
}

function submitAuthPin(){
  var pin=document.getElementById("authPinInput").value.trim();
  var errEl=document.getElementById("authError");
  if(!pin) return;

  google.script.run.withSuccessHandler(function(res){
    if(res&&res.autorizado){
      isAuthorized=true;
      sessionStorage.setItem("crm_auth_token", res.token);
      document.getElementById("authOverlay").style.display="none";
      document.getElementById("authPinInput").value="";
      errEl.style.display="none";
      loadChats();
      resetInactivityTimer();
    } else {
      errEl.innerText="Clave de seguridad incorrecta. Acceso denegado.";
      errEl.style.display="block";
      document.getElementById("authPinInput").value="";
    }
  }).withFailureHandler(function(err){
    errEl.innerText="Error de verificación: "+err;
    errEl.style.display="block";
  }).validarAccesoCRM(pin);
}

function lockPanel(){
  isAuthorized=false;
  sessionStorage.removeItem("crm_auth_token");
  document.getElementById("authOverlay").style.display="flex";
  document.getElementById("authPinInput").focus();
}

function resetInactivityTimer(){
  if(inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer=setTimeout(function(){
    if(isAuthorized){
      lockPanel();
      alert("Sesión bloqueada automáticamente por inactividad (15 min).");
    }
  },900000);
}

["mousemove","keypress","click","scroll","touchstart"].forEach(function(evt){
  document.addEventListener(evt,function(){
    if(isAuthorized){
      resetInactivityTimer();
      if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }
  });
});

setInterval(function(){if(isAuthorized)loadChats();},3500);

var emojiData={
  "😀":["Caras",["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","🫤","😟","🙁","😮","😯","😲","😳","🥺","🥹","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖"]],
  "👋":["Manos",["👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💪","🦾","🦿"]],
  "❤️":["Corazones",["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️🔥","❤️🩹","❣️","💕","💞","💓","💗","💖","💝","💘","💟"]],
  "🎉":["Celebración",["🎉","🎊","🎈","🎁","🎀","🏆","🥇","🥈","🥉","⭐","🌟","✨","💫","🔥","💥","🎯","🚀"]],
  "📋":["Trabajo",["📋","📊","📈","📉","📄","📑","📝","✅","❌","⚠️","📌","📍","🔗","📎","✏️","📐","📏","🗂️","📁","📂","🗄️","💼","🏢","📞","📱","💻","⌨️","🖥️","🖨️","📧","📨","📩","📮"]],
  "🚛":["Transporte",["🚛","🚚","🚢","✈️","📦","🏗️","⚓","🌍","🌎","🌏","🗺️","🧭","🛃"]]
};
var emojiCategories=Object.keys(emojiData);
var currentCat=0;

function buildEmojiPicker(){
  var tabs=document.getElementById("emojiTabs");
  if(!tabs) return;
  tabs.innerHTML="";
  for(var i=0;i<emojiCategories.length;i++){
    var t=document.createElement("div");
    t.className="emoji-tab"+(i===0?" act":"");
    t.innerText=emojiCategories[i];
    t.setAttribute("data-idx",i);
    t.onclick=function(){switchCat(parseInt(this.getAttribute("data-idx")))};
    tabs.appendChild(t);
  }
  renderEmojis(0);
}

function switchCat(idx){
  currentCat=idx;
  var tabs=document.querySelectorAll(".emoji-tab");
  for(var i=0;i<tabs.length;i++)tabs[i].className="emoji-tab"+(i===idx?" act":"");
  document.getElementById("emojiSearch").value="";
  renderEmojis(idx);
}

function renderEmojis(idx){
  var grid=document.getElementById("emojiGrid");
  if(!grid) return;
  grid.innerHTML="";
  var list=emojiData[emojiCategories[idx]][1];
  for(var i=0;i<list.length;i++){
    var cell=document.createElement("div");
    cell.className="emoji-cell";
    cell.innerText=list[i];
    cell.onclick=function(){insertEmoji(this.innerText)};
    grid.appendChild(cell);
  }
}

function filterEmojis(){
  var q=document.getElementById("emojiSearch").value.toLowerCase();
  if(!q){renderEmojis(currentCat);return}
  var grid=document.getElementById("emojiGrid");
  if(!grid) return;
  grid.innerHTML="";
  for(var k=0;k<emojiCategories.length;k++){
    var list=emojiData[emojiCategories[k]][1];
    for(var i=0;i<list.length;i++){
      var cell=document.createElement("div");
      cell.className="emoji-cell";
      cell.innerText=list[i];
      cell.onclick=function(){insertEmoji(this.innerText)};
      grid.appendChild(cell);
    }
  }
}

function insertEmoji(e){
  var input=document.getElementById("replyInput");
  var start=input.selectionStart||input.value.length;
  input.value=input.value.substring(0,start)+e+input.value.substring(start);
  input.focus();
  input.selectionStart=input.selectionEnd=start+e.length;
}

function toggleEmoji(){
  var p=document.getElementById("emojiPicker");
  if(p) p.classList.toggle("show");
}
function closeEmoji(){
  var p=document.getElementById("emojiPicker");
  if(p) p.classList.remove("show");
}

var selectedFile=null;
var selectedBase64="";

function openAttachModal(){
  if(!activePhone){alert("Selecciona un chat primero");return}
  clearFileSelection();
  document.getElementById("attachModal").classList.add("show");
}
function closeAttachModal(){
  document.getElementById("attachModal").classList.remove("show");
  clearFileSelection();
}

function handleFileSelect(input){
  if(input.files&&input.files[0]) processFile(input.files[0]);
}

function processFile(file){
  if(file.size>16*1024*1024){alert("El archivo excede 16 MB. WhatsApp no permite archivos mayores.");return}
  selectedFile=file;

  var preview=document.getElementById("filePreview");
  preview.classList.add("show");
  document.getElementById("fpName").innerText=file.name;
  document.getElementById("fpSize").innerText=formatSize(file.size);
  document.getElementById("btnSendFile").disabled=false;

  var iconEl=document.getElementById("fpIcon");
  if(file.type.indexOf("image/")===0){
    iconEl.className="fp-icon img-type";
    iconEl.innerHTML='<i class="ri-image-line"></i>';
    var reader2=new FileReader();
    reader2.onload=function(ev){
      iconEl.innerHTML='<img src="'+ev.target.result+'" class="fp-thumb">';
    };
    reader2.readAsDataURL(file);
  } else if(file.name.match(/\.pdf$/i)){
    iconEl.className="fp-icon";
    iconEl.innerHTML='<i class="ri-file-pdf-2-line"></i>';
  } else if(file.name.match(/\.(xlsx?|csv)$/i)){
    iconEl.className="fp-icon";
    iconEl.style.background="#10b981";
    iconEl.innerHTML='<i class="ri-file-excel-2-line"></i>';
  } else if(file.name.match(/\.(docx?|txt)$/i)){
    iconEl.className="fp-icon";
    iconEl.style.background="#3b82f6";
    iconEl.innerHTML='<i class="ri-file-word-2-line"></i>';
  } else {
    iconEl.className="fp-icon";
    iconEl.innerHTML='<i class="ri-file-3-line"></i>';
  }

  var reader=new FileReader();
  reader.onload=function(ev){
    var base64Full=ev.target.result;
    selectedBase64=base64Full.split(",")[1];
  };
  reader.readAsDataURL(file);
}

function clearFileSelection(){
  selectedFile=null;
  selectedBase64="";
  var prev = document.getElementById("filePreview");
  if(prev) prev.classList.remove("show");
  var btn = document.getElementById("btnSendFile");
  if(btn) btn.disabled=true;
  var input = document.getElementById("fileInput");
  if(input) input.value="";
  var iconEl=document.getElementById("fpIcon");
  if(iconEl){
    iconEl.className="fp-icon";
    iconEl.style.background="";
  }
}

function formatSize(bytes){
  if(bytes<1024) return bytes+" B";
  if(bytes<1048576) return (bytes/1024).toFixed(1)+" KB";
  return (bytes/1048576).toFixed(1)+" MB";
}

function sendFileAttachment(){
  if(!selectedFile||!activePhone) return;
  var btn=document.getElementById("btnSendFile");
  btn.disabled=true;
  btn.innerText="Subiendo...";

  var fileToUpload=selectedFile;
  var fileName=fileToUpload.name;
  var mimeType=fileToUpload.type||"application/octet-stream";
  var isImage=mimeType.indexOf("image/")===0;
  var label=isImage?"📷 "+fileName:"📎 "+fileName;

  var reader=new FileReader();
  reader.onload=function(ev){
    var base64Full=ev.target.result;
    var base64Data=base64Full.split(",")[1];

    closeAttachModal();

    var now=new Date();
    var day=String(now.getDate()).padStart(2,"0");
    var mnt=String(now.getMonth()+1).padStart(2,"0");
    var yr=now.getFullYear();
    var h=String(now.getHours()).padStart(2,"0");
    var mn=String(now.getMinutes()).padStart(2,"0");
    var fullStr=day+"/"+mnt+"/"+yr+" "+h+":"+mn;

    var area=document.getElementById("msgArea");
    var div=document.createElement("div");
    div.className="bub out";
    div.innerHTML='<div>'+esc(label)+'</div><div class="ts">📅 '+fullStr+' <i class="ri-loader-4-line ck" style="color:var(--wa-txt2);animation:spin 1s linear infinite"></i></div>';
    
    var bAnchor=document.getElementById("chatBottomAnchor");
    if(bAnchor) area.insertBefore(div, bAnchor);
    else area.appendChild(div);

    forceScrollBottom();

    var c=findChat(activePhone);
    if(c)c.messages.push({type:"outbound",text:label,fullStr:fullStr,ts:now.getTime()});

    google.script.run.withSuccessHandler(function(res){
      var ticks=div.querySelector(".ck");
      if(res&&res.exito){
        if(ticks){ticks.className="ri-check-double-line ck";ticks.style.color="rgba(83,180,240,.85)";ticks.style.animation="none";}
      } else {
        if(ticks){ticks.className="ri-close-line ck";ticks.style.color="#ef4444";ticks.style.animation="none";}
        alert("Error al enviar archivo por WhatsApp: "+(res?res.error:"Sin respuesta"));
      }
    }).withFailureHandler(function(err){
      var ticks=div.querySelector(".ck");
      if(ticks){ticks.className="ri-close-line ck";ticks.style.color="#ef4444";ticks.style.animation="none";}
      alert("Error de conexión con Google Apps Script: "+err);
    }).subirYEnviarArchivo(activePhone,base64Data,fileName,mimeType);
  };
  reader.readAsDataURL(fileToUpload);
}

var dragCounter=0;
document.addEventListener("DOMContentLoaded",function(){
  var chatCol=document.querySelector(".col-chat");
  if(!chatCol) return;

  chatCol.addEventListener("dragenter",function(e){
    e.preventDefault();e.stopPropagation();
    dragCounter++;
    if(activePhone) document.getElementById("dragOverlay").classList.add("show");
  });
  chatCol.addEventListener("dragleave",function(e){
    e.preventDefault();e.stopPropagation();
    dragCounter--;
    if(dragCounter<=0){dragCounter=0;document.getElementById("dragOverlay").classList.remove("show")}
  });
  chatCol.addEventListener("dragover",function(e){
    e.preventDefault();e.stopPropagation();
  });
  chatCol.addEventListener("drop",function(e){
    e.preventDefault();e.stopPropagation();
    dragCounter=0;
    document.getElementById("dragOverlay").classList.remove("show");
    if(!activePhone){alert("Selecciona un chat primero");return}
    if(e.dataTransfer.files&&e.dataTransfer.files[0]){
      processFile(e.dataTransfer.files[0]);
      document.getElementById("attachModal").classList.add("show");
    }
  });

  var dz=document.getElementById("dropzone");
  if(dz){
    dz.addEventListener("dragover",function(e){e.preventDefault();this.classList.add("dragover")});
    dz.addEventListener("dragleave",function(){this.classList.remove("dragover")});
    dz.addEventListener("drop",function(e){
      e.preventDefault();e.stopPropagation();
      this.classList.remove("dragover");
      if(e.dataTransfer.files&&e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    });
  }
});

document.addEventListener("click",function(e){
  var picker=document.getElementById("emojiPicker");
  var btn=document.querySelector(".ri-emotion-happy-line");
  if(picker&&picker.classList.contains("show")&&!picker.contains(e.target)&&e.target!==btn){
    picker.classList.remove("show");
  }
});

window.onload=function(){checkAuthOnLoad();buildEmojiPicker();};
</script>
</body>
</html>`;
}
