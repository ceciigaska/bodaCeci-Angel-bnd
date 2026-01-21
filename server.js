// ===== SERVER.JS CORREGIDO - VALIDACIÓN DE ASISTENCIA =====
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

// ===== CONFIGURACIÓN DE CORS =====
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5500",
    "https://boda-ceci-angel-bnd.vercel.app",
    "https://ceciigaska.github.io",
    "https://ceciigaska.github.io/bodaCeci-Angel",
  ],
  methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Accept", "Authorization", "X-Requested-With"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ===== URL DE GOOGLE APPS SCRIPT =====
//const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxnQrrFZjH_Jnvao6AlyBcmAL9HxYZpHg1HVTvh3rTNjNwxKvz3FvdkrxT2F5JAfYFC/exec";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwP58sJqzGTgLI_jIU0TGq7DoLPYQ6qQ5Ur63p2cecgw4rNAl4PIlvjgta0tEZ0_FG4/exec"

app.post('/api/validate-code', async (req, res) => {
  const { code } = req.body;
  console.log(`🔍 Validando código: ${code}`);

  if (!code) {
    return res.status(400).json({
      isValid: false,
      message: 'No se proporcionó un código.'
    });
  }

  try {
    // ✅ CORRECCIÓN: Usar GET con parámetros de query
    const validateUrl = `${GOOGLE_SCRIPT_URL}?action=validate&code=${encodeURIComponent(code)}`;

    const response = await axios.get(validateUrl, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Wedding-App/1.0'
      },
      validateStatus: status => status >= 200 && status < 500
    });

    let jsonData;
    if (typeof response.data === 'string') {
      try {
        jsonData = JSON.parse(response.data);
      } catch (err) {
        console.error('❌ Error parseando respuesta:', err);
        return res.status(500).json({
          isValid: false,
          message: 'Respuesta inválida del servidor.'
        });
      }
    } else {
      jsonData = response.data;
    }

    console.log('📨 Respuesta de Google Script (validate):', jsonData);

    // Mapear la respuesta al formato esperado
    if (jsonData.success) {
      res.json({
        isValid: true,
        message: jsonData.message || 'Código válido',
        guestName: jsonData.guestName || null
      });
    } else {
      res.json({
        isValid: false,
        message: jsonData.message || 'Código inválido o ya utilizado'
      });
    }

  } catch (error) {
    console.error('❌ Error en /api/validate-code:', error.message);
    res.status(500).json({
      isValid: false,
      message: 'Error interno al validar el código'
    });
  }
});

// ===== NUEVA RUTA: VERIFICAR SI UN INVITADO YA CONFIRMÓ =====
app.get('/api/check-confirmation', async (req, res) => {
  const { guestId } = req.query;
  console.log(`🔍 Verificando confirmación previa para invitado ID: ${guestId}`);

  if (!guestId) {
    return res.status(400).json({
      hasConfirmed: false,
      error: 'Falta el ID del invitado'
    });
  }

  try {
    const checkUrl = `${GOOGLE_SCRIPT_URL}?action=checkConfirmation&guestId=${encodeURIComponent(guestId)}`;
    
    console.log('📡 URL de verificación:', checkUrl);
    
    const response = await axios.get(checkUrl, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Wedding-App/1.0'
      },
      validateStatus: status => status >= 200 && status < 500
    });

    let jsonData;
    if (typeof response.data === 'string') {
      try {
        jsonData = JSON.parse(response.data);
      } catch (err) {
        console.error('❌ Error parseando respuesta:', err);
        return res.json({
          hasConfirmed: false,
          error: 'Error parseando respuesta'
        });
      }
    } else {
      jsonData = response.data;
    }

    console.log('📨 Respuesta verificación:', jsonData);
    res.json(jsonData);

  } catch (error) {
    console.error('❌ Error verificando confirmación:', error.message);
    res.json({
      hasConfirmed: false,
      error: 'Error al verificar confirmación'
    });
  }
});

// ===== RUTA DE SALUD =====
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    message: "Servidor funcionando correctamente",
  });
});

// ===== RUTA PARA BÚSQUEDA DE INVITADOS =====
app.get("/api/search", async (req, res) => {
  console.log("🔍 Búsqueda de invitado:", req.query);

  const { name } = req.query;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({
      found: false,
      error: "Nombre debe tener al menos 2 caracteres",
    });
  }

  try {
    const searchUrl = `${GOOGLE_SCRIPT_URL}?action=search&name=${encodeURIComponent(name.trim())}`;
    console.log("📡 Enviando request a:", searchUrl);

    const axiosConfig = {
      timeout: 15000,
      headers: {
        "User-Agent": "Wedding-App/1.0",
        Accept: "application/json",
      },
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      },
    };

    const response = await axios.get(searchUrl, axiosConfig);

    let jsonData;
    if (typeof response.data === "string") {
      try {
        jsonData = JSON.parse(response.data);
      } catch (parseError) {
        console.error("❌ Error parseando JSON:", parseError);
        return res.status(500).json({
          found: false,
          error: "Error en el formato de respuesta del servidor",
        });
      }
    } else {
      jsonData = response.data;
    }

    if (!jsonData || typeof jsonData !== "object") {
      console.error("❌ Respuesta inválida:", jsonData);
      return res.status(500).json({
        found: false,
        error: "Respuesta inválida del servidor",
      });
    }

    res.json(jsonData);
  } catch (error) {
    console.error("❌ Error en búsqueda:", error.message);

    if (error.code === "ENOTFOUND") {
      return res.status(503).json({
        found: false,
        error: "No se puede conectar con Google Apps Script",
      });
    }

    if (error.code === "ETIMEDOUT") {
      return res.status(504).json({
        found: false,
        error: "Timeout - el servidor tardó demasiado",
      });
    }

    res.status(500).json({
      found: false,
      error: "Error interno del servidor",
    });
  }
});

// ===== RUTA PARA ENVÍO DE FORMULARIO =====
app.post("/api/submit", async (req, res) => {
  console.log("📝 Confirmación recibida:", req.body);

  try {
    const { id, name, attendance, phone } = req.body;
    if (!id || !name || !attendance) {
      return res.status(400).json({
        success: false,
        error: "Faltan datos requeridos: id, name, attendance",
      });
    }

    console.log("📡 Enviando confirmación a Google Script...");
    const axiosConfig = {
      timeout: 20000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Wedding-App/1.0",
        Accept: "application/json",
      },
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      },
    };

    const response = await axios.post(GOOGLE_SCRIPT_URL, req.body, axiosConfig);

    let jsonData;
    if (typeof response.data === "string") {
      try {
        jsonData = JSON.parse(response.data);
      } catch (parseError) {
        console.error("❌ Error parseando respuesta POST:", parseError);
        return res.status(500).json({
          success: false,
          error: "Error en el formato de respuesta del servidor",
        });
      }
    } else {
      jsonData = response.data;
    }

    if (jsonData.success) {
      const confirmationNumber = jsonData.confirmationNumber;
      const qrUrl = `https://boda-ceci-angel-bnd.vercel.app/qr-code/${confirmationNumber}`;

      const whatsappText = encodeURIComponent(
        `🎉 ¡Hola ${name}!\n\n` +
          `¡Tu asistencia a nuestra boda ha sido confirmada!\n\n` +
          `📅 Fecha: 30 de Octubre 2026\n` +
          `🕕 Hora: 4:00 PM\n` +
          `📍 Lugar: Lienzo Charro "La Tapatía"\n\n` +
          `🎫 Código de confirmación: ${confirmationNumber}\n\n` +
          `📲 Presenta este QR el día de la boda:\n${qrUrl}\n\n` +
          `¡Nos vemos en la celebración!\n` +
          `💕 Cecilia & Ángel`
      );

      const whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${whatsappText}`;

      return res.json({
        success: true,
        message: "Confirmación guardada y QR generado",
        confirmationNumber: confirmationNumber,
        whatsappUrl: whatsappUrl,
        qrUrl: qrUrl,
      });
    } else {
      console.log("⚠️ Error en confirmación:", jsonData.message);
    }
    res.json(jsonData);
  } catch (error) {
    console.error("❌ Error enviando confirmación:", error.message);
    
    if (error.code === "ETIMEDOUT") {
      return res.status(504).json({
        success: false,
        error: "Timeout - la confirmación tardó demasiado",
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// ===== RUTA PARA LA IMAGEN DEL QR =====
app.get('/qr-code/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const validationUrl = `https://boda-ceci-angel-bnd.vercel.app/validacion-qr/?code=${code}`;
        const qrImage = await QRCode.toBuffer(validationUrl, { type: 'png', width: 300 });

        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': qrImage.length
        });
        res.end(qrImage);
    } catch (error) {
        console.error('Error generando QR:', error);
        res.status(500).json({ error: 'No se pudo generar el QR' });
    }
});

// ===== RUTA RAÍZ =====
app.get("/", (req, res) => {
  res.json({
    message: "¡Bienvenido a la API de la boda de Cecilia & Ángel!",
    status: "Backend funcionando correctamente",
    routes: {
      health: "/api/health",
      search: "/api/search?name=nombre",
      submit: "POST /api/submit",
      checkConfirmation: "/api/check-confirmation?guestId=ID",
      validateQR: "POST /api/validate-code",
    },
  });
});

// ===== INICIAR SERVIDOR =====
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en puerto ${port}`);
  console.log(`📡 Google Script URL: ${GOOGLE_SCRIPT_URL}`);
});

process.on("SIGTERM", () => {
  console.log("👋 Cerrando servidor...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("👋 Cerrando servidor...");
  process.exit(0);
});

module.exports = app;

