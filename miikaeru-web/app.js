// ===================================================
// MIIKAERU SYSTEM — FASE 1 + FASE 2
// HUB modular ("tomacorriente"): estado global + adaptadores
// ===================================================

// ---------------------------------------------------
// MiikaeruHub: punto de enchufe para IA / minijuegos / sensores externos.
// Cualquier adaptador futuro solo necesita implementar
// generateReply(prompt, context), start(context) / stop(), o getSteps().
// ---------------------------------------------------
const MiikaeruHub = (() => {
  const plugins = { ai: null, minigame: null, steps: null };

  return {
    connectAI(adapter) {
      plugins.ai = adapter;
    },
    connectMinigame(adapter) {
      plugins.minigame = adapter;
    },
    connectSteps(adapter) {
      plugins.steps = adapter;
    },
    async askAI(prompt, context) {
      const adapter = plugins.ai || defaultAIAdapter;
      return adapter.generateReply(prompt, context);
    },
    startMinigame(context) {
      const adapter = plugins.minigame || defaultMinigameAdapter;
      return adapter.start(context);
    },
    async fetchSteps() {
      if (plugins.steps && typeof plugins.steps.getSteps === "function") {
        return plugins.steps.getSteps();
      }
      return null; // sin proveedor conectado (API/Smartwatch): se usa entrada manual
    },
  };
})();

// ---------------------------------------------------
// Adaptador de IA por defecto (mock local, sin red).
// Se reemplaza en el futuro con MiikaeruHub.connectAI({ generateReply })
// ---------------------------------------------------
const lastPillarMessage = {};

// ---------------------------------------------------
// Chat Guía: detecta intención por palabras clave en el texto LIBRE que
// escribe el usuario (distinto de los flujos "automáticos" por pilar que
// ya llaman a askAI(prompt, {pillar}) con su propio banco de frases fijo
// — esos se resuelven arriba en generateReply() antes de llegar aquí).
// `matchChatGuideIntent()` es una función pura de texto→intención,
// compartida por generateReply() (arma la respuesta) y el submit
// handler del chat dentro de DOMContentLoaded (decide qué ícono del
// dock resaltar con el efecto de parpadeo neón) — así ambos coinciden
// siempre en la misma intención detectada, sin duplicar la lista de
// palabras clave en dos lugares.
const CHAT_GUIDE_INTENTS = [
  {
    id: "finanzas",
    keywords: ["mejorar mis finanzas", "mejorar finanzas", "control de gastos", "control de mis gastos", "controlar mis gastos", "finanzas", "presupuesto", "ahorrar"],
    dockTarget: '.pillar-btn[data-pillar="finanzas"]',
    reply: "¡Perfecto! Lo primero es llevar un control de tus gastos para plantear tus estrategias. En la sección Finanzas tienes un formulario para hacer tu balance general. Mira este icono:",
  },
  {
    id: "fisico",
    keywords: ["mejorar mi fisico", "mejorar mi físico", "estado fisico", "estado físico", "hacer ejercicio", "entrenar mi cuerpo"],
    dockTarget: '.pillar-btn[data-pillar="fisico"]',
    reply: "¡Vamos! Registra tu energía y actividad del día en Estado Físico para que tu HP refleje tu progreso real. Mira este icono:",
  },
  {
    id: "espiritual",
    keywords: ["estado espiritual", "quiero meditar", "meditación", "meditacion", "oracion", "oración"],
    dockTarget: '.pillar-btn[data-pillar="espiritual"]',
    reply: "Tómate un momento para tu Estado Espiritual: ahí encuentras tu espacio de meditación y devoción diaria. Mira este icono:",
  },
  {
    id: "japones",
    keywords: ["aprender japones", "aprender japonés", "practicar kanji", "hiragana", "katakana"],
    dockTarget: '.app-card[data-app="japanese"]',
    reply: "¡Genial! En el módulo de Japonés tienes Práctica de Trazos y Modo Examen para avanzar con Kanji, Hiragana y Katakana. Mira este icono:",
  },
  {
    id: "habits",
    keywords: ["quiero registrar mi entrenamiento", "registrar mi entrenamiento", "registrar mi rutina", "mis habitos de hoy", "mis hábitos de hoy", "mi racha", "rutina de ejercicios"],
    dockTarget: '.app-card[data-app="habits"]',
    reply: "¡Así se hace! En Hábitos & Rachas puedes marcar tus hábitos del día y registrar tu rutina de ejercicios (series, repeticiones y peso). Mira este icono:",
  },
];

function matchChatGuideIntent(text) {
  const normalized = text.toLowerCase();
  return CHAT_GUIDE_INTENTS.find((intent) => intent.keywords.some((kw) => normalized.includes(kw))) || null;
}

const defaultAIAdapter = {
  generateReply(prompt, context) {
    const text = prompt.toLowerCase();
    const pillar = context && context.pillar;

    const banks = {
      finanzas: [
        "Cada sol ahorrado hoy es un ladrillo de tu Casa mañana. Registra ese movimiento.",
        "Revisa tus gastos hormiga esta semana. La disciplina financiera desbloquea tu Garage.",
        "Un presupuesto claro es el primer paso del Kodomo hacia la libertad financiera.",
      ],
      fisico: [
        "Tu cuerpo es el vehículo del viaje. 20 minutos de movimiento hoy suman a tu energía.",
        "Hidratación, sueño y una caminata: pequeñas victorias físicas cuentan como XP real.",
        "El guerrero que cuida su HP llega más lejos en la Boss Fight.",
      ],
      espiritual: [
        "Cuando las fuerzas flaqueen, recuerda: 'Todo lo puedo en Cristo que me fortalece'.",
        "La fe no elimina la tormenta, pero te sostiene en medio de ella. Dios va contigo.",
        "Un momento de oración hoy puede darte la claridad que ningún plan humano te dará.",
        "No temas: donde tú no llegas, la gracia de Dios sí alcanza.",
        "Cada obstáculo es una oportunidad para confiar más profundamente en Su plan.",
        "Renueva tu espíritu hoy: la devoción diaria es entrenamiento invisible pero real.",
      ],
    };

    if (pillar && banks[pillar]) {
      const options = banks[pillar];
      let index = Math.floor(Math.random() * options.length);
      if (options.length > 1) {
        while (index === lastPillarMessage[pillar]) {
          index = Math.floor(Math.random() * options.length);
        }
      }
      lastPillarMessage[pillar] = index;
      return options[index];
    }

    const guideIntent = matchChatGuideIntent(text);
    if (guideIntent) return guideIntent.reply;

    if (text.includes("minijuego") || text.includes("boss")) {
      return "El módulo de combate 2D está listo. Pulsa Iniciar cuando quieras entrar a la Boss Fight.";
    }
    if (text.includes("wishlist") || text.includes("deseo")) {
      return "Cada meta que agregas al Garage se desbloquea al subir de rango. Sigue avanzando.";
    }

    const generic = [
      "Anotado en el núcleo Miikaeru. Cuéntame qué quieres mejorar y te guío al módulo correcto.",
      "Registrado en el núcleo Miikaeru. ¿Qué pilar quieres entrenar hoy?",
      "Estoy contigo, operador. Elige Finanzas, Físico o Espiritual para avanzar.",
    ];
    return generic[Math.floor(Math.random() * generic.length)];
  },
};

// ---------------------------------------------------
// Adaptador de minijuego por defecto: Boss Fight 2D jugable, dificultad
// fácil-intermedia con movimiento. Se reemplaza en el futuro con
// MiikaeruHub.connectMinigame({ start, stop }) por un motor/emulador
// externo real.
// context recibido: { canvas, viewport, damagePerShot, onVictory, onDefeat }
//
// Controles: flechas izq/der o A/D para moverse, ESPACIO o click para
// atacar. El Boss telegrafía (se ilumina) ~700ms antes de cada ataque,
// que viaja lento por el mismo carril horizontal — moverse a tiempo lo
// esquiva. Los ataques son poco frecuentes y de daño bajo a propósito.
// ---------------------------------------------------
const defaultMinigameAdapter = {
  start(context) {
    const canvas = context.canvas;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const laneY = h / 2;
    const damagePerShot = context.damagePerShot || 10;
    const onVictory = typeof context.onVictory === "function" ? context.onVictory : () => {};
    const onDefeat = typeof context.onDefeat === "function" ? context.onDefeat : () => {};

    const player = { x: 26, y: laneY, r: 12, hp: 100, maxHp: 100 };
    const boss = { x: w - 34, y: laneY, r: 22 };
    const bossMaxHp = 100;
    let bossHp = bossMaxHp;

    const PLAYER_MIN_X = player.r + 6;
    const PLAYER_MAX_X = boss.x - boss.r - 36;

    // Todas las velocidades/temporizadores están en unidades por SEGUNDO
    // (no por frame), usando el delta de performance.now() en draw(). Así
    // el ritmo es siempre el mismo sin importar la tasa de refresco real
    // del dispositivo — es lo que mantiene la dificultad "lenta y fácil"
    // consistente en cualquier pantalla.
    const PLAYER_SPEED_PX_S = 90; // movimiento lento del jugador
    const PLAYER_SHOT_SPEED_PX_S = 260;
    const BOSS_ATTACK_INTERVAL_S = 4.3; // ataques poco frecuentes
    const BOSS_TELEGRAPH_S = 0.7; // aviso antes de cada ataque
    const BOSS_PROJECTILE_SPEED_PX_S = 70; // lento, da tiempo a esquivar
    const BOSS_ATTACK_DAMAGE = 8; // daño bajo, margen de error generoso

    let playerShots = [];
    let bossShots = [];
    let finished = false;
    let defeated = false;
    let raf = null;
    let lastTime = null;
    let attackTimer = BOSS_ATTACK_INTERVAL_S;
    let telegraphTimer = 0;

    const keys = { left: false, right: false };

    function shoot() {
      if (finished || defeated) return;
      playerShots.push({ x: player.x + player.r, y: player.y });
    }

    function handleKeydown(event) {
      if (event.code === "Space") {
        event.preventDefault();
        shoot();
      } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
        keys.left = true;
      } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        keys.right = true;
      }
    }

    function handleKeyup(event) {
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        keys.left = false;
      } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        keys.right = false;
      }
    }

    function handleClick() {
      shoot();
    }

    canvas.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("keyup", handleKeyup);

    function drawActor(actor, color, glow) {
      ctx.beginPath();
      ctx.arc(actor.x, actor.y, actor.r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = glow || 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function drawBar(x, y, w2, h2, pct, color) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.strokeRect(x, y, w2, h2);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w2 * Math.max(0, pct), h2);
    }

    function updatePlayerMovement(dt) {
      if (finished || defeated) return;
      if (keys.left) player.x -= PLAYER_SPEED_PX_S * dt;
      if (keys.right) player.x += PLAYER_SPEED_PX_S * dt;
      player.x = Math.min(PLAYER_MAX_X, Math.max(PLAYER_MIN_X, player.x));
    }

    function updateBossAI(dt) {
      if (finished || defeated) return;
      if (telegraphTimer > 0) {
        telegraphTimer -= dt;
        if (telegraphTimer <= 0) {
          telegraphTimer = 0;
          bossShots.push({ x: boss.x - boss.r, y: laneY });
        }
        return;
      }
      attackTimer -= dt;
      if (attackTimer <= 0) {
        attackTimer = BOSS_ATTACK_INTERVAL_S;
        telegraphTimer = BOSS_TELEGRAPH_S;
      }
    }

    function updatePlayerShots(dt) {
      playerShots.forEach((p) => (p.x += PLAYER_SHOT_SPEED_PX_S * dt));
      playerShots = playerShots.filter((p) => {
        if (p.x >= boss.x - boss.r) {
          if (!finished) bossHp = Math.max(0, bossHp - damagePerShot);
          return false;
        }
        return p.x < w;
      });
    }

    function updateBossShots(dt) {
      bossShots.forEach((p) => (p.x -= BOSS_PROJECTILE_SPEED_PX_S * dt));
      bossShots = bossShots.filter((p) => {
        const hit = Math.abs(p.x - player.x) < player.r + 3 && !defeated && !finished;
        if (hit) {
          player.hp = Math.max(0, player.hp - BOSS_ATTACK_DAMAGE);
          return false;
        }
        return p.x > -6;
      });
    }

    function draw(now) {
      if (lastTime === null) lastTime = now;
      // Clamp del delta: evita "saltos" grandes si la pestaña estuvo en
      // segundo plano (rAF pausado) y vuelve con un salto de varios segundos.
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(0, 240, 255, 0.05)";
      ctx.fillRect(0, 0, w, h);

      // Carril de movimiento (referencia visual sutil)
      ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
      ctx.beginPath();
      ctx.moveTo(0, laneY + player.r + 6);
      ctx.lineTo(w, laneY + player.r + 6);
      ctx.stroke();

      updatePlayerMovement(dt);
      updateBossAI(dt);
      updatePlayerShots(dt);
      updateBossShots(dt);

      const isTelegraphing = telegraphTimer > 0;
      drawActor(boss, isTelegraphing ? "#FFB700" : "#FF2E9A", isTelegraphing ? 22 : 14);
      drawActor(player, defeated ? "#7C93AD" : "#00F0FF");

      playerShots.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#00FF9C";
        ctx.fill();
      });
      bossShots.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#FFB700";
        ctx.shadowColor = "#FFB700";
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Barra del Boss (arriba derecha)
      drawBar(w - 112, 14, 100, 8, bossHp / bossMaxHp, "#FF2E9A");
      ctx.fillStyle = "#E6F7FF";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`BOSS ${bossHp}/${bossMaxHp}`, w - 112, 10);

      // Barra del jugador (arriba izquierda)
      drawBar(12, 14, 90, 8, player.hp / player.maxHp, "#00F0FF");
      ctx.fillText(`TÚ ${player.hp}/${player.maxHp}`, 12, 10);

      ctx.fillStyle = "#7C93AD";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("← → / A D mover · Click o ESPACIO atacar", 8, h - 8);

      if (bossHp <= 0 && !finished && !defeated) {
        finished = true;
        onVictory();
      }
      if (finished) {
        ctx.fillStyle = "#00FF9C";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("¡VICTORIA!", w / 2, h / 2 - 30);
      }

      if (player.hp <= 0 && !defeated && !finished) {
        defeated = true;
        onDefeat();
      }
      if (defeated) {
        ctx.fillStyle = "#FF2E9A";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Inténtalo de nuevo", w / 2, h / 2 - 30);
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    return {
      stop() {
        if (raf) cancelAnimationFrame(raf);
        canvas.removeEventListener("click", handleClick);
        window.removeEventListener("keydown", handleKeydown);
        window.removeEventListener("keyup", handleKeyup);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
    };
  },
};

// ---------------------------------------------------
// Cuenta Principal (candado de acceso al dispositivo)
// Capa MÁS ARRIBA que el sistema de Sub-Perfiles de abajo: una sola
// cuenta por dispositivo (celular + contraseña), guardada en texto plano
// en localStorage. IMPORTANTE — esto NO es autenticación segura de
// verdad (localStorage es legible por cualquiera con acceso a devtools
// en el mismo dispositivo/navegador); es un candado liviano tipo
// "control parental de acceso casual", no una cuenta protegida contra un
// atacante real. No hay backend: no podría serlo.
// ---------------------------------------------------
const MASTER_ACCOUNT_KEY = "miikaeru_master_account";
const MASTER_LOGGED_IN_KEY = "miikaeru_master_logged_in";

// ---------------------------------------------------
// Sistema de Perfiles de Usuario
// Cada perfil ("Admin", "Mamá - Salón", "Hermano - Camión"...) es una
// cuenta separada en el mismo dispositivo: TODA la persistencia de la app
// (state, ledger de negocios, moneda del negocio, calendario, bio-sync,
// módulo activo) vive en claves de localStorage con el sufijo
// "::<profileId>", vía scopedKey(). Cambiar de perfil = escribir cuál es
// el activo + recargar la página (más simple y robusto que reinicializar
// en caliente los ~20 render*() de la app; ver switchProfile() más abajo).
// Vive DENTRO de la Cuenta Principal: los Sub-Perfiles solo importan una
// vez pasado el candado de arriba.
// ---------------------------------------------------
const USER_PROFILES_KEY = "miikaeru_user_profiles";
const ACTIVE_PROFILE_KEY = "miikaeru_active_profile";

// Claves "legacy" de antes de que existiera este sistema de perfiles — se
// migran UNA sola vez, íntegras, al primer perfil que se crea, para no
// perder progreso ya guardado en el navegador.
const LEGACY_UNSCOPED_KEYS = [
  "miikaeru_state_v1",
  "miikaeru_business_ledger",
  "miikaeru_business_currency",
  "miikaeru_calendar_events",
  "miikaeru_biometrics_log",
  "miikaeru_active_app",
];

function loadUserProfiles() {
  try {
    const raw = localStorage.getItem(USER_PROFILES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function persistUserProfiles(profiles) {
  localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles));
}

function scopedKey(base, profileId) {
  return `${base}::${profileId}`;
}

function migrateLegacyDataToProfile(profileId) {
  LEGACY_UNSCOPED_KEYS.forEach((base) => {
    const legacyValue = localStorage.getItem(base);
    if (legacyValue !== null) {
      localStorage.setItem(scopedKey(base, profileId), legacyValue);
      localStorage.removeItem(base);
    }
  });
}

// Resuelve el perfil activo al arrancar: si no hay ninguno guardado todavía
// (primera vez que corre este sistema), crea "Admin" y migra hacia él
// cualquier dato legacy sin perfil que ya existiera en este navegador.
function ensureActiveProfile() {
  let profiles = loadUserProfiles();

  if (!profiles.length) {
    const defaultProfile = {
      id: `profile-${Date.now()}`,
      name: "Admin",
      createdAt: new Date().toISOString(),
    };
    profiles = [defaultProfile];
    persistUserProfiles(profiles);
    migrateLegacyDataToProfile(defaultProfile.id);
    localStorage.setItem(ACTIVE_PROFILE_KEY, defaultProfile.id);
    return defaultProfile.id;
  }

  const saved = localStorage.getItem(ACTIVE_PROFILE_KEY);
  if (saved && profiles.some((p) => p.id === saved)) return saved;

  localStorage.setItem(ACTIVE_PROFILE_KEY, profiles[0].id);
  return profiles[0].id;
}

const activeProfileId = ensureActiveProfile();

function switchProfile(profileId) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
  location.reload();
}

// ---------------------------------------------------
// Estado global persistente (SIEMPRE del perfil activo — ver scopedKey())
// ---------------------------------------------------
const STORAGE_KEY = scopedKey("miikaeru_state_v1", activeProfileId);

const RANKS = [
  { level: 1, name: "Kodomo" },
  { level: 10, name: "Wakamono" },
  { level: 20, name: "Bushi" },
  { level: 30, name: "Sensei" },
  { level: 50, name: "Kage" },
];

const SPIRITUAL_STATES = ["Equilibrado", "Enfocado", "Inspirado", "En Tormenta", "Renaciendo"];

const CURRENCIES = {
  PEN: { symbol: "S/", locale: "es-PE" },
  JPY: { symbol: "¥", locale: "ja-JP" },
  USD: { symbol: "$", locale: "en-US" },
};

// ---------------------------------------------------
// i18n: diccionario de traducciones para el HUD, el chat y el Boss Fight.
// applyLanguage() recorre [data-i18n] / [data-i18n-placeholder] /
// [data-i18n-title] y también expone t(key) para textos que la app
// escribe dinámicamente (estado del Boss Fight, botón Iniciar/Detener).
// ---------------------------------------------------
// El idioma es una preferencia del dispositivo/navegador, no del state del
// operador: vive en su propia clave de localStorage para que se mantenga
// aunque se cierre sesión o se cree una cuenta nueva en el mismo equipo.
const LANGUAGE_KEY = "miikaeru_language";
let currentLanguage = localStorage.getItem(LANGUAGE_KEY) || "es";

// ---------------------------------------------------
// Escala visual del León y del panel de Chat (ver --avatar-scale/
// --chat-scale en :root, style.css) — preferencia de pantalla/dispositivo,
// no dato de usuario, así que se guarda SIN scopedKey() (mismo criterio
// que LANGUAGE_KEY arriba: vale para el dispositivo, no por perfil).
// ---------------------------------------------------
const SCALE_KEY = "miikaeru_panel_scale";

function loadScalePrefs() {
  try {
    const raw = localStorage.getItem(SCALE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? { avatar: 1, chat: 1, ...parsed } : { avatar: 1, chat: 1 };
  } catch (err) {
    return { avatar: 1, chat: 1 };
  }
}

function persistScalePrefs(prefs) {
  localStorage.setItem(SCALE_KEY, JSON.stringify(prefs));
}

// ---------------------------------------------------
// Supabase: respaldo en la nube del ledger de negocios + fuente de datos
// del Panel de Administrador. localStorage sigue siendo la fuente de
// verdad de TODA la app — esto es un respaldo de "mejor esfuerzo": si
// Supabase está caído, sin internet, o la tabla todavía no existe, la
// app sigue funcionando exactamente igual, solo sin respaldo en la nube
// (ver syncTransactionToSupabase() más abajo, siempre con try/catch).
//
// NOTA DE SEGURIDAD IMPORTANTE: la clave de abajo es de tipo "publishable"
// (equivalente a la vieja "anon key"), diseñada para vivir en código de
// cliente — no es un secreto que haya que ocultar. PERO eso significa
// que cualquiera que la tenga puede llamar directamente a la API REST de
// Supabase con ella. La única protección real de los datos es Row Level
// Security (RLS) configurado del lado de Supabase — ver el SQL que se
// entrega junto con este cambio para crear la tabla `transactions` con
// una política RLS. El "candado" del Panel de Administrador (más abajo,
// ADMIN_PANEL_PASSWORD) es solo una cortina en la interfaz del navegador,
// NO seguridad real — se documenta así a propósito, en vez de fingir una
// protección que esta app (sin backend propio) no puede dar.
const SUPABASE_URL = "https://pzurvgcurifdkhbfxhrv.supabase.co";
const SUPABASE_KEY = "sb_publishable_NApj9xOyicARat8ummK52Q_mY20RsBz";

// `window.supabase` es el namespace que expone la librería cargada por
// CDN (index.html) — el cliente ya inicializado se guarda en
// `supabaseClient` para no pisar ese namespace global.
// `persistSession`/`autoRefreshToken` ya son el default de supabase-js v2
// — se dejan explícitos acá (en vez de confiar en el default implícito)
// para que quede documentado el comportamiento real: la sesión de Admin
// (ver checkAdminSession() más abajo) sobrevive recargas de página y
// períodos de inactividad normales, porque el SDK guarda el refresh
// token en localStorage y renueva el access token solo. Lo que el
// default NO cubre bien es el momento exacto de "despertar" de una
// laptop suspendida: los timers de refresco se pausan mientras el
// sistema duerme, así que al volver puede haber un access token vencido
// hasta la próxima llamada. Por eso se agrega abajo un listener de
// `visibilitychange` que fuerza ese chequeo apenas la pestaña vuelve a
// primer plano, en vez de esperar pasivamente a la siguiente petición.
//
// IMPORTANTE — lo que esto NO hace (a propósito): no extiende la
// vigencia REAL de los tokens más allá de lo configurado del lado de
// Supabase (Authentication → Settings: expiración del access token,
// normalmente 1h, y del refresh token, normalmente ~30 días de
// inactividad). Hacer que un token de Admin "nunca expire" desde acá
// sería debilitar la seguridad real de esa cuenta — si hace falta una
// sesión más larga, esa configuración se cambia del lado de Supabase de
// forma consciente, no silenciosamente desde el cliente.
const supabaseClient = (typeof window !== "undefined" && window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// ---------------------------------------------------
// Rol SUPER_ADMIN: a diferencia del candado de contraseña que existía
// antes (ADMIN_PANEL_PASSWORD, una cortina de interfaz sin seguridad
// real — ver historial en PROGRESS_LOG Bloque 32), esto es autenticación
// REAL vía Supabase Auth (supabaseClient.auth), la misma librería ya
// cargada por CDN en index.html. El rol NO se basa en un campo custom
// de la app: es simplemente "¿el email de la sesión autenticada de
// Supabase coincide con esta constante?" — y del lado de Supabase, las
// políticas RLS de `feedback` (ver SQL entregado junto con este cambio)
// exigen ADEMÁS `auth.jwt() ->> 'email' = ADMIN_EMAIL` para poder leer o
// actualizar filas, así que aunque alguien manipule el JS del navegador
// para fingir isSuperAdmin=true, Supabase seguiría rechazando sus
// pedidos — esa es la diferencia real con la cortina de antes.
//
// CAMBIAR este email por el real antes de crear la cuenta en Supabase
// (Authentication → Users → Add User, ver instrucciones al final del
// cambio) — ver checkAdminSession()/applySuperAdminVisibility() dentro
// de DOMContentLoaded para cómo se usa.
const ADMIN_EMAIL = "admin@miikaeru.com";

// Respaldo de "mejor esfuerzo" de una transacción del ledger de negocios
// hacia la tabla `transactions` de Supabase (ver el SQL entregado junto
// con este cambio para crearla). Nunca lanza ni bloquea: si la tabla
// todavía no existe, no hay internet, o RLS rechaza el pedido, el error
// queda solo en consola — localStorage (persistBusinessLedger(), ya
// llamado antes de esto en cada punto de uso) sigue siendo la fuente de
// verdad real de la app.
function syncTransactionToSupabase(txn) {
  if (!supabaseClient) return;
  supabaseClient
    .from("transactions")
    .upsert({
      id: txn.id,
      profile_id: activeProfileId,
      business_name: txn.businessName,
      collaborator: txn.collaborator,
      type: txn.type,
      concept: txn.concept,
      // metodo_pago: columna nueva — hasta que se agregue a la tabla
      // `transactions` en Supabase (ALTER TABLE transactions ADD COLUMN
      // metodo_pago text;), el upsert entero de esta transacción falla y
      // queda solo en consola, igual que cualquier otro desfase de
      // schema — localStorage sigue siendo la fuente de verdad real.
      metodo_pago: txn.metodoPago,
      ingreso_bruto: txn.ingresoBruto,
      egresos: txn.egresos,
      comision_monto: txn.comisionMonto,
      ganancia_neta: txn.gananciaNeta,
      currency: businessCurrency,
      txn_date: txn.date,
    })
    .then(({ error }) => {
      if (error) console.warn("Supabase: no se pudo respaldar la transacción (la app sigue funcionando con localStorage):", error.message);
    })
    .catch((err) => console.warn("Supabase: fallo de red al respaldar la transacción:", err));
}

const I18N = {
  es: {
    statLevel: "Nivel",
    statRank: "Rango",
    statCompass: "Brújula",
    statFinance: "Finanzas",
    statStreakTitle: "Racha de aprendizaje",
    statBalanceGlobalTitle: "Balance Global",
    statBalanceGlobal: "Balance Global",
    hudBannerPhrase1: "TOMA EL CONTROL DE TU NEGOCIO",
    hudBannerPhrase2: "MANTÉN TU RACHA DE APRENDIZAJE",
    hudBannerPhrase3: "CADA DÍA CUENTA PARA TU FUTURO",
    hudBannerPhrase4: "TU PRÓXIMO NIVEL TE ESTÁ ESPERANDO",
    hudBannerPhrase5: "CONVIERTE TUS METAS EN LOGROS",
    online: "ONLINE",
    logout: "Cerrar sesión",
    masterAuthLoginTitle: "Bienvenido de vuelta",
    masterAuthLoginSubtitle: "Ingresa tu celular y contraseña para desbloquear el núcleo.",
    masterAuthRegisterTitle: "Crea tu Cuenta Principal",
    masterAuthRegisterSubtitle: "Esta cuenta protege el acceso a todo el dispositivo. Los perfiles se crean después, ya adentro.",
    masterAuthPhonePlaceholder: "Número de Celular",
    masterAuthPasswordPlaceholder: "Contraseña",
    masterAuthPasswordConfirmPlaceholder: "Confirmar Contraseña",
    masterAuthLoginBtn: "Iniciar Sesión",
    masterAuthRegisterBtn: "Crear Cuenta",
    masterAuthPasswordMismatch: "Las contraseñas no coinciden.",
    masterAuthInvalidCredentials: "Celular o contraseña incorrectos.",
    masterAuthAccountExists: "Ya existe una cuenta en este dispositivo. Inicia sesión con tu celular y contraseña.",
    masterAuthGoRegister: "¿No tienes cuenta? Crear una",
    masterAuthGoLogin: "¿Ya tienes cuenta? Iniciar sesión",
    profileSwitchBtnTitle: "Cambiar de perfil",
    miikaPassBtn: "🎫 Miika Pass",
    miikaPassTitle: "🎫 MIIKA PASS",
    miikaPassLore: "Cada nivel que alcanzas desbloquea una recompensa del núcleo Miikaeru.",
    miikaPassFilterLabel: "Ver",
    miikaPassFilterAll: "Todos los niveles",
    miikaPassFilterUnlocked: "Solo desbloqueados",
    miikaPassLevelPrefix: "Nv.",
    miikaPassAvatarIdle: "Avatar Núcleo Despierto",
    miikaPassAvatarBoss: "Avatar Modo Boss",
    profilesTitle: "Perfiles de Usuario",
    profilesSubtitle: "Cada perfil guarda su propio historial, moneda y módulo activo.",
    profileCreatePlaceholder: "Nombre del nuevo perfil (ej. Mamá - Salón)",
    profileCreateBtn: "+ Crear Perfil",
    profileActiveBadge: "Activo",
    profileSwitchTo: "Cambiar",
    negocioScanBtn: "📷 Subir Foto de Registro / Boleta",
    negocioPrintBtn: "🖨️ Imprimir Formulario Físico",
    negocioFechaLabel: "Fecha",
    negocioScanScanning: "Escaneando imagen...",
    negocioScanDone: "Detectado:",
    printFormTitle: "Formulario de Registro de Negocio",
    printFormSubtitle: "Llenar a mano con letra clara. Puede volver a subirse luego con \"📷 Subir Foto de Registro / Boleta\".",
    printFormBusinessLabel: "Negocio:",
    printFormWeekLabel: "Semana del:",
    printFormColFecha: "Fecha",
    printFormColColaborador: "Colaborador",
    printFormColServicio: "Servicio / Producto",
    printFormColPrecio: "Precio",
    printFormColComision: "% Comisión",
    printFormColInsumos: "Insumos / Gastos",
    wishlistTitle: "WISHLIST // GARAGE DE DESEOS",
    wishlistPlaceholder: "Agregar deseo...",
    wishlistReqPlaceholder: "Nuevo requisito (ej. Juntar cuota inicial)",
    wishlistReqEmpty: "Todavía no agregaste requisitos para este deseo.",
    wishlistReqRemove: "Quitar requisito",
    wishlistReqAllDoneMessage: "¡Completaste todos los requisitos de {name}! Deseo desbloqueado en tu Garage.",
    chatTitle: "Feed // Chat",
    chatChannel: "canal-01",
    chatPlaceholder: "Escribe un mensaje a Miikaeru...",
    chatSend: "Enviar",
    pillarFinanzas: "Finanzas",
    pillarFisico: "Estado Físico",
    pillarEspiritual: "Estado Espiritual",
    pillarAprendizaje: "Aprendizaje",
    aprendizajeTitle: "🧠 Aprendizaje",
    aprendizajeHint: "Este pilar está en construcción. Pronto vas a poder registrar tu progreso de aprendizaje aquí.",
    courseAiName: "Sistemas con Inteligencia Artificial",
    courseAiDesc: "Fundamentos de IA, modelos de lenguaje y automatización aplicada a negocios reales.",
    courseEnglishName: "Inglés Técnico",
    courseEnglishDesc: "Vocabulario y comunicación técnica en inglés para el mundo laboral tecnológico.",
    courseFinanceName: "Finanzas Avanzadas",
    courseFinanceDesc: "Inversión, análisis financiero y estrategias avanzadas más allá del control básico de gastos.",
    courseCyberName: "Ciberseguridad y Ciberestructuras",
    courseCyberDesc: "Protección de datos, redes y sistemas — fundamentos de seguridad digital aplicada.",
    courseCodeName: "Programación y Desarrollo de Software",
    courseCodeDesc: "Lógica de programación y desarrollo de software desde cero, paso a paso.",
    courseCloudName: "Cloud y Automatización",
    courseCloudDesc: "Infraestructura en la nube y automatización de procesos para escalar cualquier negocio.",
    courseComingSoonBadge: "🚀 Próximamente — Gran Lanzamiento",
    financeIncomeLabel: "Ingreso Mensual",
    payrollAuditOpenTitle: "Auditoría y Control de Nómina",
    payrollAuditTitle: "📋 Auditoría y Control de Nómina",
    payrollAuditSubtitle: "Estructura de boleta japonesa (給与明細書) — registra tus horas e ingresos para calcular tu sueldo neto real.",
    payrollScanBtn: "📷 Subir Boleta / Hoja de Horas",
    payrollScanScanning: "Escaneando documento...",
    payrollScanDone: "Documento leído — campos actualizados.",
    payrollEvidenceSavedText: "Comprobante guardado.",
    payrollHoursTitle: "⏱️ Días / Horas Trabajadas",
    payrollHorasBaseLabel: "Horas Base (出勤時間)",
    payrollHorasExtraLabel: "Horas Extras (残業)",
    payrollHorasNocturnasLabel: "Horas Nocturnas (深夜)",
    payrollIncomeTitle: "💰 Ingresos Brutos",
    payrollSueldoBaseLabel: "Sueldo Base (基本給)",
    payrollBonosLabel: "Bonos / Incentivos",
    payrollDeductionsTitle: "➖ Descuentos",
    payrollSegurosLabel: "Seguros (社会保険)",
    payrollImpuestosLabel: "Impuestos (所得税)",
    payrollAdelantosLabel: "Adelantos (前払い)",
    payrollNetoFinalLabel: "Sueldo Neto Final",
    payrollApplyBtn: "✓ Usar como Ingreso Mensual",
    payrollAppliedMessage: "Apliqué mi Auditoría de Nómina: Sueldo Neto Final de {amount} como Ingreso Mensual.",
    categoryBreakdownOpenTitle: "Ver desglose de gastos",
    categoryAmountDerivedHint: "Calculado automáticamente por la suma del desglose — edítalo desde ahí.",
    categoryScanBtn: "📷 Subir Boleta / Ticket",
    categoryScanScanning: "Escaneando recibo...",
    categoryScanDone: "Detectado:",
    categoryItemConceptPlaceholder: "Concepto (ej. Supermercado)",
    categoryItemAmountPlaceholder: "Monto",
    categoryItemAddBtn: "+ Agregar Gasto",
    categoryBreakdownTotalLabel: "Total de la categoría",
    categoryBreakdownTitlePrefix: "Desglose de Gastos de",
    categoryItemsEmpty: "Todavía no agregaste gastos a esta categoría.",
    financeAddCategory: "+ Agregar categoría",
    financeTotal: "Total Gastos",
    financeBalance: "Balance",
    financeSave: "Guardar",
    financeTabPersonal: "Personales",
    financeTabServicios: "Servicios / Negocio",
    financeOpenDashboardBtn: "📊 Ver Dashboard Completo",
    adminPanelOpenBtn: "🛡️ Panel de Administrador",
    inspectorOpenBtn: "🕵️ Agente Inspector",
    adminPanelTitle: "🛡️ Panel de Administrador",
    adminPanelTabTransactions: "💳 Transacciones",
    adminPanelTabInspector: "🕵️ Inspector de Bugs",
    adminPanelTabAutomation: "🤖 Automatización (n8n)",
    adminPanelRefreshBtn: "🔄 Actualizar",
    adminPanelExportBtn: "📥 Exportar CSV",
    adminPanelColDate: "Fecha",
    adminPanelColBusiness: "Negocio",
    adminPanelColCollaborator: "Colaborador",
    adminPanelColIncome: "Ingreso Bruto",
    adminPanelColExpense: "Gastos",
    adminPanelColNet: "Ganancia Neta",
    adminPanelNoClient: "⚠️ No se pudo conectar con Supabase.",
    adminPanelLoading: "Cargando transacciones...",
    adminPanelError: "⚠️ No se pudo leer la tabla de Supabase:",
    adminPanelRowCount: "Transacciones consolidadas:",
    adminPanelNetworkError: "⚠️ Error de red al conectar con Supabase.",
    adminLoginTriggerBtn: "🛡️ Acceder como Admin",
    adminLogoutTriggerBtn: "🛡️ Cerrar sesión de Admin",
    adminLoginTitle: "🛡️ Acceso de Administrador",
    adminLoginSubtitle: "Inicia sesión con tu cuenta de Administrador de Supabase.",
    adminLoginEmailPlaceholder: "Correo",
    adminLoginPasswordPlaceholder: "Contraseña",
    adminLoginBtn: "Iniciar Sesión",
    adminLoginError: "Credenciales incorrectas o cuenta inexistente.",
    adminLoginNotAuthorized: "Esta cuenta no tiene permisos de Administrador.",
    adminLoginSuccessMessage: "Sesión de Administrador iniciada. Panel de Administrador y Agente Inspector desbloqueados.",
    adminLogoutMessage: "Sesión de Administrador cerrada.",
    inspectorStatTotal: "Total",
    inspectorStatPending: "Pendientes",
    inspectorStatApproved: "Aprobados",
    inspectorStatResolved: "Resueltos",
    inspectorStatus_pendiente: "En Espera",
    inspectorStatus_aprobado: "Aprobado",
    inspectorStatus_descartado: "Descartado",
    inspectorStatus_resuelto: "Resuelto",
    inspectorApproveBtn: "✅ Aprobar",
    inspectorDiscardBtn: "❌ Descartar",
    inspectorResolveBtn: "✔️ Marcar Resuelto",
    automationStatTotal: "Total",
    automationStatPending: "Pendientes",
    automationStatApproved: "Aprobadas",
    automationStatDiscarded: "Descartadas",
    automationStatus_pending: "Pendiente",
    automationStatus_approved: "Aprobada",
    automationStatus_discarded: "Descartada",
    automationApproveBtn: "✅ Aprobar / Ejecutar",
    automationDiscardBtn: "❌ Descartar",
    automationRowCount: "Tareas encontradas:",
    automationEmptyState: "Sin tareas en cola. n8n las agrega automáticamente a la tabla automation_tasks de Supabase.",
    negocioCurrencyLabel: "Moneda del Negocio",
    negocioNombreLabel: "Nombre del Negocio",
    negocioColaboradorLabel: "Colaborador / Vendedor *",
    negocioMetodoPagoLabel: "Método de Pago",
    negocioMetodoPagoYape: "Yape",
    negocioMetodoPagoTarjeta: "Tarjeta",
    negocioMetodoPagoOtro: "Otro",
    negocioMetodoPagoOtroLabel: "Especifica el método",
    dashboardColMetodoPago: "Método de Pago",
    adminPanelColMetodoPago: "Método de Pago",
    negocioComisionPreviewLabel: "Comisión del Colaborador",
    negocioTipoServicio: "Servicio",
    negocioTipoVenta: "Venta",
    negocioServicioConceptoLabel: "Servicio / Ruta",
    negocioServicioMontoLabel: "Monto Cobrado",
    negocioServicioGastosLabel: "Gastos Directos",
    negocioServicioComisionLabel: "% Comisión",
    negocioVentaConceptoLabel: "Producto / Concepto",
    negocioVentaPrecioUnitarioLabel: "Precio Unitario (Costo Mayorista)",
    negocioCantidadLabel: "Cantidad / Peso / Unidades",
    negocioVentaCostoTotalLabel: "Costo Total Compra",
    negocioVentaMontoCobradoLabel: "Monto Cobrado (Precio Venta Final)",
    negocioVentaGananciaBrutaLabel: "Ganancia Bruta",
    negocioVentaComisionLabel: "Comisión (opcional)",
    negocioComisionModoPct: "% Porcentaje",
    negocioComisionModoFijo: "Monto Fijo",
    negocioVentaGananciaFinalLabel: "Ganancia Neta Final",
    negocioGananciaPreviewLabel: "Ganancia Neta (vista previa)",
    negocioRegistrarBtn: "+ Registrar Transacción",
    storyModalEyebrow: "NÚCLEO MIIKAERU // REGISTRO CUÁNTICO DE LORE",
    storyModalViewChapters: "📖 Capítulos",
    storyModalViewCharacters: "🧬 Entidades del Nexus",
    storyModalMysteryTitle: "⚠ MISTERIO REVELADO",
    storyModalClueTitle: "📡 PRÓXIMA PISTA",
    storyModalCloseBtn: "🔌 CERRAR ENLACE",
    skinsOpenBtn: "🎭 Skins del León",
    skinsModalTitle: "🎭 Skins del León",
    skinsModalSubtitle: "colección desbloqueable",
    skinsModalCloseBtn: "Cerrar",
    characterOpenBtn: "🧬 Mi Personaje",
    characterSelectTitle: "🧬 Elige tu Avatar Inicial",
    characterSelectSubtitle: "evolucionará contigo, nivel a nivel",
    characterSelectFemale: "Mellizo Femenino",
    characterSelectMale: "Mellizo Masculino",
    cityMapTitle: "🌐 Expansión de Territorio",
    cityMapHeadline: "Próximamente: Ten tus deseos listos en tu ciudad",
    feedbackTitle: "🐞 Bugs & Sugerencias",
    feedbackSubtitle: "¿Encontraste un error o tienes una idea para mejorar Miikaeru? Cuéntanos.",
    feedbackTypeLabel: "Tipo",
    feedbackTypeBug: "🐞 Bug / Error",
    feedbackTypeSuggestion: "💡 Sugerencia",
    feedbackMessagePlaceholder: "Describe el bug o tu idea...",
    feedbackSubmitBtn: "Enviar",
    feedbackStatusSuccess: "¡Gracias! Tu mensaje fue enviado.",
    feedbackStatusError: "No se pudo enviar. Intenta de nuevo más tarde.",
    feedbackStatusOffline: "Servicio no disponible por ahora. Intenta más tarde.",
    dashboardTitle: "📊 Dashboard Financiero General",
    dashboardReportGenericTitle: "Reporte Financiero",
    dashboardFilterLabel: "Negocio",
    dashboardPrintBtn: "🖨️ Imprimir Reporte",
    dashboardPayslipBtn: "🖨️ Imprimir Boleta de Pago del Colaborador",
    dashboardCollaboratorSelectedLabel: "Colaborador seleccionado:",
    payslipTitle: "Boleta de Pago",
    payslipSubtitle: "Liquidación de servicios",
    payslipBusinessLabel: "Negocio:",
    payslipDateLabel: "Fecha de emisión:",
    payslipCollaboratorLabel: "Colaborador:",
    payslipColFecha: "Fecha",
    payslipColConcepto: "Servicio / Producto",
    payslipColMonto: "Monto Cobrado",
    payslipColComision: "Comisión Ganada",
    payslipTotalLabel: "Total Neto a Pagar",
    payslipEmpty: "Sin transacciones registradas para este colaborador.",
    printPopupBlocked: "El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio e intenta de nuevo.",
    btnDownloadPdf: "📥 Descargar PDF",
    pdfDownloadHint: "Se abrió el diálogo de impresión — elige \"Guardar como PDF\" como destino para descargarlo.",
    dashboardFilterAll: "Todos",
    dashboardCardIncome: "Total Ingresos",
    dashboardCardExpense: "Total Gastos",
    dashboardCardBalance: "Balance Neto Global",
    dashboardRankingTitle: "🏆 Mejor Rendimiento",
    dashboardRankingByNegocio: "Por Negocio",
    dashboardRankingByColaborador: "Por Colaborador",
    dashboardRankingEmpty: "Registra tu primera transacción para ver el ranking.",
    dashboardColFecha: "Fecha",
    dashboardColNegocio: "Negocio",
    dashboardColColaborador: "Colaborador",
    dashboardColConcepto: "Concepto",
    dashboardColIngreso: "Ingreso Bruto",
    dashboardColEgresos: "Egresos/Comisiones",
    dashboardColGanancia: "Ganancia Neta",
    dashboardColAcciones: "Acciones",
    dashboardDeleteBtn: "Eliminar transacción",
    dashboardDeleteConfirm: "¿Eliminar esta transacción? Esta acción no se puede deshacer.",
    dashboardEmpty: "Todavía no hay transacciones registradas.",
    fisicoRepsLabel: "Meta de repeticiones",
    fisicoStepsLabel: "Pasos registrados",
    fisicoRegister: "Registrar",
    espiritualMeditationTitle: "Meditación en Silencio",
    espiritualMeditationHint: "Desconexión total: sin música, sin distracciones, sin notificaciones.",
    espiritualMinutesLabel: "Minutos",
    espiritualStart: "Iniciar Meditación",
    espiritualCancel: "Cancelar",
    espiritualTechniquesTitle: "Técnicas de Claridad Mental",
    avatarTitle: "Avatar",
    appsHubTitle: "Apps & Módulos",
    appsAddBtn: "+ Agregar App",
    appBossFightName: "Boss Fight",
    appJapaneseName: "Japonés AI Coach",
    appHabitsName: "Hábitos & Rachas",
    appStatusNew: "Nuevo",
    appStatusComingSoon: "Próximamente",
    appJapanesePlaceholder: "El módulo Japonés AI Coach está en desarrollo. Pronto vas a poder practicarlo aquí.",
    appAddedMessage: "Más módulos estarán disponibles próximamente en Apps & Módulos.",
    appCalendarName: "Calendario & Eventos",
    appBiosyncName: "Bio-Sync & Estado Físico",
    appKaraokeName: "Karaoke",
    appKaraokePlaceholder: "El módulo Karaoke está en desarrollo. Pronto vas a poder cantar tus canciones favoritas aquí.",
    habitsTabDaily: "🔥 Hábitos Diarios",
    habitsTabWorkout: "💪 Rutina de Ejercicios",
    habitsStreakLabel: "días de racha",
    habitsHint: "Completa los 5 hábitos hoy para sumar a tu racha.",
    habitsAllDoneCongrats: "¡Excelente, Operador! Completaste todos tus hábitos de hoy. Racha: {streak} días 🔥",
    habitWakeUp: "Levantarse a las 5:00 AM",
    habitMeditate: "Meditar (10-15 min)",
    habitPlan: "Planear el día",
    habitJapanese: "Estudiar Japonés",
    habitHydrate: "Hidratación / Salud",
    workoutMon: "Lunes",
    workoutTue: "Martes",
    workoutWed: "Miércoles",
    workoutThu: "Jueves",
    workoutFri: "Viernes",
    workoutSat: "Sábado",
    workoutSun: "Domingo",
    workoutFocusPlaceholder: "Enfoque del día (ej. Brazos / Pecho)",
    workoutExerciseLabel: "Ejercicio",
    workoutExercisePlaceholder: "Ej. Press de banca",
    workoutSetsLabel: "Series",
    workoutRepsLabel: "Repeticiones",
    workoutWeightLabel: "Peso (kg)",
    workoutLogBtn: "+ Registrar Ejercicio",
    sevenMinTitle: "🏆 Reto 7 Minutos — Funcional sin Equipo",
    sevenMinNote: "12 ejercicios, 30s cada uno con 10s de descanso — sin ningún equipo, solo tu cuerpo (y una silla firme).",
    sevenMinCompleteBtn: "✅ Completé la rutina de hoy",
    sevenMinAlreadyDoneToday: "Ya completaste la rutina de hoy",
    sevenMinSessionsToUnlock: "sesiones para desbloquear",
    sevenMinSessionsCompleted: "sesiones completadas en total",
    sevenMinRestLabel: "descanso",
    sevenMinWeekUnlockedMsg: "¡Desbloqueaste una nueva semana!",
    sevenMinWeek1Title: "Semana 1",
    sevenMinWeek1Desc: "Adaptación — 1 vuelta completa al circuito. El objetivo es aprender bien cada ejercicio.",
    sevenMinWeek2Title: "Semana 2",
    sevenMinWeek2Desc: "Consistencia — seguí con 1 vuelta, enfocate en mantener la forma correcta en cada ejercicio.",
    sevenMinWeek3Title: "Semana 3",
    sevenMinWeek3Desc: "Fuerza — 2 vueltas completas al circuito (con un descanso de 1 minuto entre vuelta y vuelta).",
    sevenMinWeek4Title: "Semana 4",
    sevenMinWeek4Desc: "Resistencia — 2 vueltas completas, tratando de acortar el descanso entre vuelta y vuelta.",
    sevenMinExJumpingJacks: "Saltos de tijera",
    sevenMinGuideJumpingJacks: "Salta abriendo piernas y brazos a la vez, después volvé a juntarlos. Ritmo constante.",
    sevenMinExWallSit: "Sentada en la pared",
    sevenMinGuideWallSit: "Espalda apoyada en la pared, rodillas a 90°, como si estuvieras sentado en una silla invisible.",
    sevenMinExPushUps: "Flexiones de brazos",
    sevenMinGuidePushUps: "Manos un poco más anchas que los hombros, bajá el pecho casi hasta el piso y empujá. Si es muy difícil, apoyá las rodillas.",
    sevenMinExCrunches: "Abdominales",
    sevenMinGuideCrunches: "Acostado, rodillas dobladas, subí los hombros del piso contrayendo el abdomen (no tirés del cuello).",
    sevenMinExStepUp: "Subida a silla",
    sevenMinGuideStepUp: "Subí y bajá de una silla o escalón firme, alternando la pierna que empieza cada vez.",
    sevenMinExSquats: "Sentadillas",
    sevenMinGuideSquats: "Pies al ancho de los hombros, bajá como si te fueras a sentar, las rodillas sin pasar la punta del pie.",
    sevenMinExTricepDips: "Fondos de tríceps en silla",
    sevenMinGuideTricepDips: "Manos en el borde de la silla, bajá el cuerpo doblando los codos y volvé a subir.",
    sevenMinExPlank: "Plancha",
    sevenMinGuidePlank: "Antebrazos y puntas de los pies en el piso, cuerpo en línea recta, abdomen firme.",
    sevenMinExHighKnees: "Rodillas al pecho (trote en el lugar)",
    sevenMinGuideHighKnees: "Corré en el lugar llevando las rodillas lo más alto posible, ritmo rápido.",
    sevenMinExLunges: "Estocadas / Zancadas",
    sevenMinGuideLunges: "Un paso largo hacia adelante, bajá la rodilla trasera casi al piso, alterná las piernas.",
    sevenMinExPushUpRotation: "Flexión con rotación",
    sevenMinGuidePushUpRotation: "Después de una flexión, girá el cuerpo levantando un brazo hacia el techo, mirando hacia ese lado.",
    sevenMinExSidePlank: "Plancha lateral",
    sevenMinGuideSidePlank: "Apoyado en un antebrazo de costado, cuerpo en línea recta, cambiá de lado a la mitad del tiempo.",
    forceUpdateBtn: "🔄 Forzar Actualización / Limpiar Caché",
    forceUpdateBtnWorking: "Limpiando caché...",
    scaleControlsTitle: "🔍 Tamaño de Paneles",
    scaleControlsAvatar: "León",
    scaleControlsChat: "Chat",
    scaleControlsReset: "Restablecer",
    calendarEventPlaceholder: "Pagos de sueldo, Mantenimiento Camión...",
    calendarAddBtn: "+ Agregar",
    calendarNoEvents: "Sin eventos para este día.",
    biosyncConnectBtn: "📡 Conectar Smartwatch / Banda Bluetooth",
    biosyncBtUnavailable: "Este navegador no soporta Bluetooth Web. Usa el modo manual.",
    biosyncBtConnecting: "Buscando dispositivos cercanos...",
    biosyncBtConnected: "Conectado a",
    biosyncBtError: "No se pudo conectar:",
    biosyncManualLabel: "Modo Manual / Simulación (BPM)",
    biosyncWeightLabel: "Peso (kg)",
    biosyncSleepLabel: "Horas de Sueño",
    biosyncEnergyLabel: "Nivel de Energía (1-10)",
    biosyncEnergyShort: "Energía",
    biosyncSaveBtn: "+ Registrar Estado Físico",
    biosyncLogMessage: "Registré mi estado físico: {weight}kg, {sleep}h de sueño, energía {energy}/10.",
    jpScriptHiragana: "Hiragana",
    jpScriptKatakana: "Katakana",
    jpScriptKanji: "Kanji N5",
    jpKanjiN5Title: "Kanji Básicos (N5)",
    jpKanjiOnyomi: "On'yomi:",
    jpKanjiKunyomi: "Kun'yomi:",
    jpKanjiMeaning: "Significado:",
    jpVocabTitle: "📚 Palabras Clave",
    jpGeneralPractice: "🎯 Práctica General",
    jpPracticeRow: "Practicar",
    jpBackToGrid: "← Volver",
    jpSkipStroke: "⏭ Omitir Trazo",
    jpQuizPrompt: "¿Cuál es la romanización?",
    jpQuizPromptMeaning: "¿Cuál es el significado?",
    jpQuizCorrect: "¡Correcto!",
    jpQuizIncorrect: "Casi — la respuesta era",
    jpSessionComplete: "Sesión de Japonés completa:",
    jpPracticeSessionComplete: "Sesión de práctica completa.",
    jpRowLabelPrefix: "Fila",
    jpListen: "Escuchar pronunciación",
    jpStrokeLabel: "Trazo",
    jpConfigTitle: "🎌 Japonés AI Coach",
    jpConfigLanguageTitle: "Idioma de Interfaz",
    jpConfigModeTitle: "Modo",
    jpModePractica: "Práctica",
    jpModeExamen: "Examen",
    jpConfigReopenTitle: "Cambiar idioma / modo",
    jpPhasesHint: "Observa la evolución del trazo, fase por fase.",
    jpPhaseRowError: "⚠️ No se pudieron cargar los trazos de este carácter.",
    jpNextChar: "Siguiente →",
    jpExamStrokeInstruction: "Prueba 1: haz clic en los trazos en el orden correcto de escritura.",
    jpHanziWriterOpenBtn: "✍️ Trazos Reales",
    jpVocabOpenBtn: "📚 Vocabulario N5",
    jpGrammarOpenBtn: "📖 Gramática N5",
    jpYoonOpenBtn: "🈴 Yōon",
    jpYoonNote: "Tabla de lectura — los trazos de き/し/ち/etc. y ゃ/ゅ/ょ se practican por separado arriba, en Hiragana/Katakana.",
    jpYoonQuizStart: "🎯 Quiz de Yōon",
    jpYoonQuizPrompt: "¿Cómo se lee esto?",
    jpBackToVocab: "← Volver a Categorías",
    jpVocabQuizStart: "🎯 Quiz de esta categoría",
    jpGrammarQuizStart: "🎯 Quiz de Gramática N5",
    jpVocabWordsCount: "palabras",
    jpMiniQuizVocabPrompt: "¿Qué significa esta palabra?",
    jpMiniQuizGrammarPrompt: "¿Qué partícula falta?",
    jpMiniQuizDone: "🎉 ¡Quiz completo!",
    jpMiniQuizScore: "Puntaje:",
    n5CatGreetings: "Saludos",
    n5CatNumbers: "Números",
    n5CatTime: "Tiempo",
    n5CatFamily: "Familia",
    n5CatVerbs: "Verbos Básicos",
    n5CatColors: "Colores",
    n5CatFood: "Comida",
    n5CatPlaces: "Lugares",
    n5CatAdjectives: "Adjetivos",
    n5CatObjects: "Objetos Cotidianos",
    n5GramWaTitle: "は — Partícula de Tema",
    n5GramMoTitle: "も — También",
    n5GramOTitle: "を — Objeto Directo",
    n5GramNiTitle: "に — Tiempo / Destino",
    n5GramDeTitle: "で — Lugar / Medio",
    n5GramGaTitle: "が — Sujeto",
    n5GramNoTitle: "の — Posesión",
    n5GramDesuMasuTitle: "です / ます — Forma Educada",
    n5GramNegativeTitle: "〜ません — Forma Negativa",
    n5GramPastTitle: "〜ました — Pasado",
    n5GramAdjTitle: "い-adj / な-adj — Adjetivos",
    n5GramTaiTitle: "〜たいです — Querer Hacer",
    n5GramKudasaiTitle: "〜てください — Pedidos",
    n5GramDekiruTitle: "〜ことができます — Capacidad",
    n5GramKaTitle: "か — Preguntas",
    n5GramKaraTitle: "から — Razón",
    n5GramShikaTitle: "しか — Solo",
    n5GramMasenkaTitle: "〜ませんか — Invitación",
    n5GramMashouTitle: "〜ましょう — Propuesta",
    n5GramTemoiiTitle: "〜てもいい / 〜てはいけません — Permiso y Prohibición",
    n5GramTokiTitle: "とき — Cuando",
    n5GramMouMadaTitle: "もう / まだ — Ya / Todavía",
    hanziWriterTitle: "✍️ Práctica de Trazos Reales",
    hanziWriterSubtitle: "Basado en datos de trazos reales (KanjiVG). Elige un carácter para animarlo o practicarlo trazo por trazo.",
    hanziWriterHiraganaTitle: "Hiragana",
    hanziWriterKatakanaTitle: "Katakana",
    hanziWriterKanjiTitle: "Kanji Básicos (N5)",
    hanziAnimateBtn: "🎬 Animar Trazos",
    hanziQuizBtn: "✍️ Practicar Trazado",
    hanziResetBtn: "🔄 Reiniciar",
    hanziQuizHint: "Traza el carácter en orden. Verde = correcto, rojo = trazo equivocado.",
    hanziQuizCorrectStroke: "✅ Trazo correcto",
    hanziQuizMistake: "❌ Orden o dirección incorrecta — intenta de nuevo",
    hanziQuizComplete: "🎉 ¡Carácter completo! +10 XP, +3 🪙",
    hanziCharDataUnavailable: "⚠️ No se pudieron cargar los datos de trazo para este carácter. Revisa tu conexión e intenta de nuevo.",
    bossStart: "Iniciar",
    bossStop: "Detener",
    bossStatusStandby: "standby",
    bossStatusCombat: "en combate",
    bossStatusVictory: "victoria",
    bossWaiting: "Módulo de minijuego en espera...",
    bossFighting: "Boss Fight activa. ¡Buena suerte!",
  },
  en: {
    statLevel: "Level",
    statRank: "Rank",
    statCompass: "Compass",
    statFinance: "Finance",
    statStreakTitle: "Learning streak",
    statBalanceGlobalTitle: "Global Balance",
    statBalanceGlobal: "Global Balance",
    hudBannerPhrase1: "TAKE CONTROL OF YOUR BUSINESS",
    hudBannerPhrase2: "KEEP YOUR LEARNING STREAK ALIVE",
    hudBannerPhrase3: "EVERY DAY COUNTS TOWARD YOUR FUTURE",
    hudBannerPhrase4: "YOUR NEXT LEVEL IS WAITING",
    hudBannerPhrase5: "TURN YOUR GOALS INTO ACHIEVEMENTS",
    online: "ONLINE",
    logout: "Log out",
    masterAuthLoginTitle: "Welcome back",
    masterAuthLoginSubtitle: "Enter your phone number and password to unlock the core.",
    masterAuthRegisterTitle: "Create your Main Account",
    masterAuthRegisterSubtitle: "This account protects access to the whole device. Profiles are created afterward, once inside.",
    masterAuthPhonePlaceholder: "Phone Number",
    masterAuthPasswordPlaceholder: "Password",
    masterAuthPasswordConfirmPlaceholder: "Confirm Password",
    masterAuthLoginBtn: "Log In",
    masterAuthRegisterBtn: "Create Account",
    masterAuthPasswordMismatch: "Passwords don't match.",
    masterAuthInvalidCredentials: "Incorrect phone number or password.",
    masterAuthAccountExists: "An account already exists on this device. Log in with your phone and password.",
    masterAuthGoRegister: "Don't have an account? Create one",
    masterAuthGoLogin: "Already have an account? Log in",
    profileSwitchBtnTitle: "Switch profile",
    miikaPassBtn: "🎫 Miika Pass",
    miikaPassTitle: "🎫 MIIKA PASS",
    miikaPassLore: "Every level you reach unlocks a reward from the Miikaeru core.",
    miikaPassFilterLabel: "View",
    miikaPassFilterAll: "All levels",
    miikaPassFilterUnlocked: "Unlocked only",
    miikaPassLevelPrefix: "Lv.",
    miikaPassAvatarIdle: "Awakened Core Avatar",
    miikaPassAvatarBoss: "Boss Mode Avatar",
    profilesTitle: "User Profiles",
    profilesSubtitle: "Each profile keeps its own history, currency and active module.",
    profileCreatePlaceholder: "New profile name (e.g. Mom - Salon)",
    profileCreateBtn: "+ Create Profile",
    profileActiveBadge: "Active",
    profileSwitchTo: "Switch",
    negocioScanBtn: "📷 Upload Receipt / Form Photo",
    negocioPrintBtn: "🖨️ Print Physical Form",
    negocioFechaLabel: "Date",
    negocioScanScanning: "Scanning image...",
    negocioScanDone: "Detected:",
    printFormTitle: "Business Registration Form",
    printFormSubtitle: "Fill by hand with clear handwriting. Can later be uploaded via \"📷 Upload Receipt / Form Photo\".",
    printFormBusinessLabel: "Business:",
    printFormWeekLabel: "Week of:",
    printFormColFecha: "Date",
    printFormColColaborador: "Collaborator",
    printFormColServicio: "Service / Product",
    printFormColPrecio: "Price",
    printFormColComision: "% Commission",
    printFormColInsumos: "Supplies / Expenses",
    wishlistTitle: "WISHLIST // DREAM GARAGE",
    wishlistPlaceholder: "Add a wish...",
    wishlistReqPlaceholder: "New requirement (e.g. Save the down payment)",
    wishlistReqEmpty: "You haven't added any requirements for this wish yet.",
    wishlistReqRemove: "Remove requirement",
    wishlistReqAllDoneMessage: "You completed every requirement for {name}! Wish unlocked in your Garage.",
    chatTitle: "Feed // Chat",
    chatChannel: "channel-01",
    chatPlaceholder: "Message Miikaeru...",
    chatSend: "Send",
    pillarFinanzas: "Finance",
    pillarFisico: "Physical State",
    pillarEspiritual: "Spiritual State",
    pillarAprendizaje: "Learning",
    aprendizajeTitle: "🧠 Learning",
    aprendizajeHint: "This pillar is under construction. Soon you'll be able to track your learning progress here.",
    courseAiName: "AI Systems",
    courseAiDesc: "AI fundamentals, language models, and automation applied to real businesses.",
    courseEnglishName: "Technical English",
    courseEnglishDesc: "Vocabulary and technical communication in English for the tech workplace.",
    courseFinanceName: "Advanced Finance",
    courseFinanceDesc: "Investing, financial analysis, and advanced strategies beyond basic expense tracking.",
    courseCyberName: "Cybersecurity & Cyber Infrastructure",
    courseCyberDesc: "Data, network, and system protection — applied digital security fundamentals.",
    courseCodeName: "Programming & Software Development",
    courseCodeDesc: "Programming logic and software development from scratch, step by step.",
    courseCloudName: "Cloud & Automation",
    courseCloudDesc: "Cloud infrastructure and process automation to scale any business.",
    courseComingSoonBadge: "🚀 Coming Soon — Big Launch",
    financeIncomeLabel: "Monthly Income",
    payrollAuditOpenTitle: "Payroll Audit & Control",
    payrollAuditTitle: "📋 Payroll Audit & Control",
    payrollAuditSubtitle: "Japanese payslip structure (給与明細書) — log your hours and income to calculate your real net pay.",
    payrollScanBtn: "📷 Upload Payslip / Timesheet",
    payrollScanScanning: "Scanning document...",
    payrollScanDone: "Document read — fields updated.",
    payrollEvidenceSavedText: "Receipt saved.",
    payrollHoursTitle: "⏱️ Days / Hours Worked",
    payrollHorasBaseLabel: "Base Hours (出勤時間)",
    payrollHorasExtraLabel: "Overtime Hours (残業)",
    payrollHorasNocturnasLabel: "Night Hours (深夜)",
    payrollIncomeTitle: "💰 Gross Income",
    payrollSueldoBaseLabel: "Base Salary (基本給)",
    payrollBonosLabel: "Bonuses / Incentives",
    payrollDeductionsTitle: "➖ Deductions",
    payrollSegurosLabel: "Insurance (社会保険)",
    payrollImpuestosLabel: "Taxes (所得税)",
    payrollAdelantosLabel: "Advances (前払い)",
    payrollNetoFinalLabel: "Final Net Pay",
    payrollApplyBtn: "✓ Use as Monthly Income",
    payrollAppliedMessage: "I applied my Payroll Audit: Final Net Pay of {amount} as Monthly Income.",
    categoryBreakdownOpenTitle: "View expense breakdown",
    categoryAmountDerivedHint: "Auto-calculated from the breakdown total — edit it from there.",
    categoryScanBtn: "📷 Upload Receipt / Ticket",
    categoryScanScanning: "Scanning receipt...",
    categoryScanDone: "Detected:",
    categoryItemConceptPlaceholder: "Concept (e.g. Supermarket)",
    categoryItemAmountPlaceholder: "Amount",
    categoryItemAddBtn: "+ Add Expense",
    categoryBreakdownTotalLabel: "Category total",
    categoryBreakdownTitlePrefix: "Expense Breakdown for",
    categoryItemsEmpty: "You haven't added any expenses to this category yet.",
    financeAddCategory: "+ Add category",
    financeTotal: "Total Expenses",
    financeBalance: "Balance",
    financeSave: "Save",
    financeTabPersonal: "Personal",
    financeTabServicios: "Services / Business",
    financeOpenDashboardBtn: "📊 View Full Dashboard",
    adminPanelOpenBtn: "🛡️ Admin Panel",
    inspectorOpenBtn: "🕵️ Inspector Agent",
    adminPanelTitle: "🛡️ Admin Panel",
    adminPanelTabTransactions: "💳 Transactions",
    adminPanelTabInspector: "🕵️ Bug Inspector",
    adminPanelTabAutomation: "🤖 Automation (n8n)",
    adminPanelRefreshBtn: "🔄 Refresh",
    adminPanelExportBtn: "📥 Export CSV",
    adminPanelColDate: "Date",
    adminPanelColBusiness: "Business",
    adminPanelColCollaborator: "Collaborator",
    adminPanelColIncome: "Gross Income",
    adminPanelColExpense: "Expenses",
    adminPanelColNet: "Net Profit",
    adminPanelNoClient: "⚠️ Couldn't connect to Supabase.",
    adminPanelLoading: "Loading transactions...",
    adminPanelError: "⚠️ Couldn't read the Supabase table:",
    adminPanelRowCount: "Consolidated transactions:",
    adminPanelNetworkError: "⚠️ Network error connecting to Supabase.",
    adminLoginTriggerBtn: "🛡️ Log In as Admin",
    adminLogoutTriggerBtn: "🛡️ Log Out of Admin",
    adminLoginTitle: "🛡️ Admin Access",
    adminLoginSubtitle: "Sign in with your Supabase Administrator account.",
    adminLoginEmailPlaceholder: "Email",
    adminLoginPasswordPlaceholder: "Password",
    adminLoginBtn: "Sign In",
    adminLoginError: "Wrong credentials or account doesn't exist.",
    adminLoginNotAuthorized: "This account doesn't have Administrator permissions.",
    adminLoginSuccessMessage: "Administrator session started. Admin Panel and Inspector Agent unlocked.",
    adminLogoutMessage: "Administrator session closed.",
    inspectorStatTotal: "Total",
    inspectorStatPending: "Pending",
    inspectorStatApproved: "Approved",
    inspectorStatResolved: "Resolved",
    inspectorStatus_pendiente: "On Hold",
    inspectorStatus_aprobado: "Approved",
    inspectorStatus_descartado: "Discarded",
    inspectorStatus_resuelto: "Resolved",
    inspectorApproveBtn: "✅ Approve",
    inspectorDiscardBtn: "❌ Discard",
    inspectorResolveBtn: "✔️ Mark Resolved",
    automationStatTotal: "Total",
    automationStatPending: "Pending",
    automationStatApproved: "Approved",
    automationStatDiscarded: "Discarded",
    automationStatus_pending: "Pending",
    automationStatus_approved: "Approved",
    automationStatus_discarded: "Discarded",
    automationApproveBtn: "✅ Approve / Execute",
    automationDiscardBtn: "❌ Discard",
    automationRowCount: "Tasks found:",
    automationEmptyState: "No tasks queued. n8n adds them automatically to Supabase's automation_tasks table.",
    negocioCurrencyLabel: "Business Currency",
    negocioNombreLabel: "Business Name",
    negocioColaboradorLabel: "Collaborator / Seller *",
    negocioMetodoPagoLabel: "Payment Method",
    negocioMetodoPagoYape: "Yape",
    negocioMetodoPagoTarjeta: "Card",
    negocioMetodoPagoOtro: "Other",
    negocioMetodoPagoOtroLabel: "Specify the method",
    dashboardColMetodoPago: "Payment Method",
    adminPanelColMetodoPago: "Payment Method",
    negocioComisionPreviewLabel: "Collaborator's Commission",
    negocioTipoServicio: "Service",
    negocioTipoVenta: "Sale",
    negocioServicioConceptoLabel: "Service / Route",
    negocioServicioMontoLabel: "Amount Charged",
    negocioServicioGastosLabel: "Direct Expenses",
    negocioServicioComisionLabel: "Commission %",
    negocioVentaConceptoLabel: "Product / Concept",
    negocioVentaPrecioUnitarioLabel: "Unit Price (Wholesale Cost)",
    negocioCantidadLabel: "Quantity / Weight / Units",
    negocioVentaCostoTotalLabel: "Total Purchase Cost",
    negocioVentaMontoCobradoLabel: "Amount Charged (Final Sale Price)",
    negocioVentaGananciaBrutaLabel: "Gross Profit",
    negocioVentaComisionLabel: "Commission (optional)",
    negocioComisionModoPct: "% Percentage",
    negocioComisionModoFijo: "Fixed Amount",
    negocioVentaGananciaFinalLabel: "Final Net Profit",
    negocioGananciaPreviewLabel: "Net Profit (preview)",
    negocioRegistrarBtn: "+ Log Transaction",
    storyModalEyebrow: "MIIKAERU CORE // QUANTUM LORE REGISTRY",
    storyModalViewChapters: "📖 Chapters",
    storyModalViewCharacters: "🧬 Nexus Entities",
    storyModalMysteryTitle: "⚠ MYSTERY REVEALED",
    storyModalClueTitle: "📡 NEXT CLUE",
    storyModalCloseBtn: "🔌 CLOSE LINK",
    skinsOpenBtn: "🎭 Lion Skins",
    skinsModalTitle: "🎭 Lion Skins",
    skinsModalSubtitle: "unlockable collection",
    skinsModalCloseBtn: "Close",
    characterOpenBtn: "🧬 My Character",
    characterSelectTitle: "🧬 Choose your Starting Avatar",
    characterSelectSubtitle: "will evolve with you, level by level",
    characterSelectFemale: "Female Twin",
    characterSelectMale: "Male Twin",
    cityMapTitle: "🌐 Territory Expansion",
    cityMapHeadline: "Coming soon: have your wishes ready in your city",
    feedbackTitle: "🐞 Bugs & Suggestions",
    feedbackSubtitle: "Found a bug or have an idea to improve Miikaeru? Tell us.",
    feedbackTypeLabel: "Type",
    feedbackTypeBug: "🐞 Bug / Error",
    feedbackTypeSuggestion: "💡 Suggestion",
    feedbackMessagePlaceholder: "Describe the bug or your idea...",
    feedbackSubmitBtn: "Send",
    feedbackStatusSuccess: "Thanks! Your message was sent.",
    feedbackStatusError: "Couldn't send it. Try again later.",
    feedbackStatusOffline: "Service unavailable right now. Try again later.",
    dashboardTitle: "📊 General Financial Dashboard",
    dashboardReportGenericTitle: "Financial Report",
    dashboardFilterLabel: "Business",
    dashboardPrintBtn: "🖨️ Print Report",
    dashboardPayslipBtn: "🖨️ Print Collaborator's Payslip",
    dashboardCollaboratorSelectedLabel: "Selected collaborator:",
    payslipTitle: "Payslip",
    payslipSubtitle: "Service settlement",
    payslipBusinessLabel: "Business:",
    payslipDateLabel: "Issue date:",
    payslipCollaboratorLabel: "Collaborator:",
    payslipColFecha: "Date",
    payslipColConcepto: "Service / Product",
    payslipColMonto: "Amount Charged",
    payslipColComision: "Commission Earned",
    payslipTotalLabel: "Total Net Pay",
    payslipEmpty: "No transactions logged for this collaborator.",
    printPopupBlocked: "The browser blocked the print window. Allow pop-ups for this site and try again.",
    btnDownloadPdf: "📥 Download PDF",
    pdfDownloadHint: "The print dialog opened — choose \"Save as PDF\" as the destination to download it.",
    dashboardFilterAll: "All",
    dashboardCardIncome: "Total Income",
    dashboardCardExpense: "Total Expenses",
    dashboardCardBalance: "Global Net Balance",
    dashboardRankingTitle: "🏆 Top Performance",
    dashboardRankingByNegocio: "By Business",
    dashboardRankingByColaborador: "By Collaborator",
    dashboardRankingEmpty: "Log your first transaction to see the ranking.",
    dashboardColFecha: "Date",
    dashboardColNegocio: "Business",
    dashboardColColaborador: "Collaborator",
    dashboardColConcepto: "Concept",
    dashboardColIngreso: "Gross Income",
    dashboardColEgresos: "Expenses/Commissions",
    dashboardColGanancia: "Net Profit",
    dashboardColAcciones: "Actions",
    dashboardDeleteBtn: "Delete transaction",
    dashboardDeleteConfirm: "Delete this transaction? This cannot be undone.",
    dashboardEmpty: "No transactions logged yet.",
    fisicoRepsLabel: "Rep goal",
    fisicoStepsLabel: "Steps logged",
    fisicoRegister: "Log",
    espiritualMeditationTitle: "Silent Meditation",
    espiritualMeditationHint: "Full disconnection: no music, no distractions, no notifications.",
    espiritualMinutesLabel: "Minutes",
    espiritualStart: "Start Meditation",
    espiritualCancel: "Cancel",
    espiritualTechniquesTitle: "Mental Clarity Techniques",
    avatarTitle: "Avatar",
    appsHubTitle: "Apps & Modules",
    appsAddBtn: "+ Add App",
    appBossFightName: "Boss Fight",
    appJapaneseName: "Japanese AI Coach",
    appHabitsName: "Habits & Streaks",
    appStatusNew: "New",
    appStatusComingSoon: "Coming soon",
    appJapanesePlaceholder: "The Japanese AI Coach module is under development. You'll be able to practice here soon.",
    appAddedMessage: "More modules will be available soon in Apps & Modules.",
    appCalendarName: "Calendar & Events",
    appBiosyncName: "Bio-Sync & Physical State",
    appKaraokeName: "Karaoke",
    appKaraokePlaceholder: "The Karaoke module is under development. You'll be able to sing your favorite songs here soon.",
    habitsTabDaily: "🔥 Daily Habits",
    habitsTabWorkout: "💪 Workout Routine",
    habitsStreakLabel: "streak days",
    habitsHint: "Complete all 5 habits today to add to your streak.",
    habitsAllDoneCongrats: "Excellent, Operator! You completed all your habits today. Streak: {streak} days 🔥",
    habitWakeUp: "Wake up at 5:00 AM",
    habitMeditate: "Meditate (10-15 min)",
    habitPlan: "Plan your day",
    habitJapanese: "Study Japanese",
    habitHydrate: "Hydration / Health",
    workoutMon: "Monday",
    workoutTue: "Tuesday",
    workoutWed: "Wednesday",
    workoutThu: "Thursday",
    workoutFri: "Friday",
    workoutSat: "Saturday",
    workoutSun: "Sunday",
    workoutFocusPlaceholder: "Focus for the day (e.g. Arms / Chest)",
    workoutExerciseLabel: "Exercise",
    workoutExercisePlaceholder: "E.g. Bench press",
    workoutSetsLabel: "Sets",
    workoutRepsLabel: "Reps",
    workoutWeightLabel: "Weight (kg)",
    workoutLogBtn: "+ Log Exercise",
    sevenMinTitle: "🏆 7-Minute Challenge — No-Equipment Functional Workout",
    sevenMinNote: "12 exercises, 30s each with a 10s rest — no equipment at all, just your body (and a sturdy chair).",
    sevenMinCompleteBtn: "✅ I completed today's workout",
    sevenMinAlreadyDoneToday: "You already completed today's workout",
    sevenMinSessionsToUnlock: "sessions to unlock",
    sevenMinSessionsCompleted: "total sessions completed",
    sevenMinRestLabel: "rest",
    sevenMinWeekUnlockedMsg: "You unlocked a new week!",
    sevenMinWeek1Title: "Week 1",
    sevenMinWeek1Desc: "Adaptation — 1 full round of the circuit. The goal is learning each exercise well.",
    sevenMinWeek2Title: "Week 2",
    sevenMinWeek2Desc: "Consistency — keep it at 1 round, focus on keeping correct form on every exercise.",
    sevenMinWeek3Title: "Week 3",
    sevenMinWeek3Desc: "Strength — 2 full rounds of the circuit (with a 1-minute rest between rounds).",
    sevenMinWeek4Title: "Week 4",
    sevenMinWeek4Desc: "Endurance — 2 full rounds, try to shorten the rest between rounds.",
    sevenMinExJumpingJacks: "Jumping Jacks",
    sevenMinGuideJumpingJacks: "Jump while opening legs and arms at the same time, then bring them back together. Keep a steady pace.",
    sevenMinExWallSit: "Wall Sit",
    sevenMinGuideWallSit: "Back against the wall, knees at 90°, as if sitting on an invisible chair.",
    sevenMinExPushUps: "Push-ups",
    sevenMinGuidePushUps: "Hands a bit wider than shoulders, lower your chest almost to the floor and push up. If it's too hard, rest on your knees.",
    sevenMinExCrunches: "Abdominal Crunches",
    sevenMinGuideCrunches: "Lying down, knees bent, lift your shoulders off the floor by contracting your abs (don't pull on your neck).",
    sevenMinExStepUp: "Step-up onto a Chair",
    sevenMinGuideStepUp: "Step up and down on a sturdy chair or step, alternating which leg leads each time.",
    sevenMinExSquats: "Squats",
    sevenMinGuideSquats: "Feet shoulder-width apart, lower down as if sitting back, knees not passing your toes.",
    sevenMinExTricepDips: "Triceps Dips on a Chair",
    sevenMinGuideTricepDips: "Hands on the edge of the chair, lower your body by bending your elbows, then push back up.",
    sevenMinExPlank: "Plank",
    sevenMinGuidePlank: "Forearms and toes on the floor, body in a straight line, core tight.",
    sevenMinExHighKnees: "High Knees (running in place)",
    sevenMinGuideHighKnees: "Run in place bringing your knees as high as possible, quick pace.",
    sevenMinExLunges: "Lunges",
    sevenMinGuideLunges: "One long step forward, lower your back knee almost to the floor, alternate legs.",
    sevenMinExPushUpRotation: "Push-up and Rotation",
    sevenMinGuidePushUpRotation: "After a push-up, rotate your body lifting one arm toward the ceiling, looking toward that side.",
    sevenMinExSidePlank: "Side Plank",
    sevenMinGuideSidePlank: "Resting on one forearm sideways, body in a straight line, switch sides halfway through.",
    forceUpdateBtn: "🔄 Force Update / Clear Cache",
    forceUpdateBtnWorking: "Clearing cache...",
    scaleControlsTitle: "🔍 Panel Size",
    scaleControlsAvatar: "Lion",
    scaleControlsChat: "Chat",
    scaleControlsReset: "Reset",
    calendarEventPlaceholder: "Payroll, Truck maintenance...",
    calendarAddBtn: "+ Add",
    calendarNoEvents: "No events for this day.",
    biosyncConnectBtn: "📡 Connect Smartwatch / Bluetooth Band",
    biosyncBtUnavailable: "This browser doesn't support Web Bluetooth. Use manual mode instead.",
    biosyncBtConnecting: "Scanning for nearby devices...",
    biosyncBtConnected: "Connected to",
    biosyncBtError: "Couldn't connect:",
    biosyncManualLabel: "Manual / Simulation Mode (BPM)",
    biosyncWeightLabel: "Weight (kg)",
    biosyncSleepLabel: "Sleep Hours",
    biosyncEnergyLabel: "Energy Level (1-10)",
    biosyncEnergyShort: "Energy",
    biosyncSaveBtn: "+ Log Physical State",
    biosyncLogMessage: "I logged my physical state: {weight}kg, {sleep}h of sleep, energy {energy}/10.",
    jpScriptHiragana: "Hiragana",
    jpScriptKatakana: "Katakana",
    jpScriptKanji: "Kanji N5",
    jpKanjiN5Title: "Basic Kanji (N5)",
    jpKanjiOnyomi: "On'yomi:",
    jpKanjiKunyomi: "Kun'yomi:",
    jpKanjiMeaning: "Meaning:",
    jpVocabTitle: "📚 Key Words",
    jpGeneralPractice: "🎯 General Practice",
    jpPracticeRow: "Practice",
    jpBackToGrid: "← Back",
    jpSkipStroke: "⏭ Skip Stroke",
    jpQuizPrompt: "What's the romanization?",
    jpQuizPromptMeaning: "What's the meaning?",
    jpQuizCorrect: "Correct!",
    jpQuizIncorrect: "Not quite — the answer was",
    jpSessionComplete: "Japanese session complete:",
    jpPracticeSessionComplete: "Practice session complete.",
    jpRowLabelPrefix: "Row",
    jpListen: "Listen to pronunciation",
    jpStrokeLabel: "Stroke",
    jpConfigTitle: "🎌 Japanese AI Coach",
    jpConfigLanguageTitle: "Interface Language",
    jpConfigModeTitle: "Mode",
    jpModePractica: "Practice",
    jpModeExamen: "Exam",
    jpConfigReopenTitle: "Change language / mode",
    jpPhasesHint: "Watch the stroke evolve, phase by phase.",
    jpPhaseRowError: "⚠️ Couldn't load strokes for this character.",
    jpNextChar: "Next →",
    jpExamStrokeInstruction: "Test 1: click the strokes in the correct writing order.",
    jpHanziWriterOpenBtn: "✍️ Real Strokes",
    jpVocabOpenBtn: "📚 N5 Vocabulary",
    jpGrammarOpenBtn: "📖 N5 Grammar",
    jpYoonOpenBtn: "🈴 Yōon",
    jpYoonNote: "Reading reference — the strokes for き/し/ち/etc. and ゃ/ゅ/ょ are practiced separately above, in Hiragana/Katakana.",
    jpYoonQuizStart: "🎯 Yōon Quiz",
    jpYoonQuizPrompt: "How is this read?",
    jpBackToVocab: "← Back to Categories",
    jpVocabQuizStart: "🎯 Quiz this category",
    jpGrammarQuizStart: "🎯 N5 Grammar Quiz",
    jpVocabWordsCount: "words",
    jpMiniQuizVocabPrompt: "What does this word mean?",
    jpMiniQuizGrammarPrompt: "Which particle is missing?",
    jpMiniQuizDone: "🎉 Quiz complete!",
    jpMiniQuizScore: "Score:",
    n5CatGreetings: "Greetings",
    n5CatNumbers: "Numbers",
    n5CatTime: "Time",
    n5CatFamily: "Family",
    n5CatVerbs: "Basic Verbs",
    n5CatColors: "Colors",
    n5CatFood: "Food",
    n5CatPlaces: "Places",
    n5CatAdjectives: "Adjectives",
    n5CatObjects: "Everyday Objects",
    n5GramWaTitle: "は — Topic Particle",
    n5GramMoTitle: "も — Also/Too",
    n5GramOTitle: "を — Direct Object",
    n5GramNiTitle: "に — Time / Destination",
    n5GramDeTitle: "で — Place / Means",
    n5GramGaTitle: "が — Subject",
    n5GramNoTitle: "の — Possession",
    n5GramDesuMasuTitle: "です / ます — Polite Form",
    n5GramNegativeTitle: "〜ません — Negative Form",
    n5GramPastTitle: "〜ました — Past Tense",
    n5GramAdjTitle: "い-adj / な-adj — Adjectives",
    n5GramTaiTitle: "〜たいです — Wanting To",
    n5GramKudasaiTitle: "〜てください — Requests",
    n5GramDekiruTitle: "〜ことができます — Ability",
    n5GramKaTitle: "か — Questions",
    n5GramKaraTitle: "から — Reason",
    n5GramShikaTitle: "しか — Only",
    n5GramMasenkaTitle: "〜ませんか — Invitation",
    n5GramMashouTitle: "〜ましょう — Suggestion",
    n5GramTemoiiTitle: "〜てもいい / 〜てはいけません — Permission and Prohibition",
    n5GramTokiTitle: "とき — When",
    n5GramMouMadaTitle: "もう / まだ — Already / Not yet",
    hanziWriterTitle: "✍️ Real Stroke Practice",
    hanziWriterSubtitle: "Based on real stroke data (KanjiVG). Pick a character to animate it or practice it stroke by stroke.",
    hanziWriterHiraganaTitle: "Hiragana",
    hanziWriterKatakanaTitle: "Katakana",
    hanziWriterKanjiTitle: "Basic Kanji (N5)",
    hanziAnimateBtn: "🎬 Animate Strokes",
    hanziQuizBtn: "✍️ Practice Tracing",
    hanziResetBtn: "🔄 Reset",
    hanziQuizHint: "Trace the character in order. Green = correct, red = wrong stroke.",
    hanziQuizCorrectStroke: "✅ Correct stroke",
    hanziQuizMistake: "❌ Wrong order or direction — try again",
    hanziQuizComplete: "🎉 Character complete! +10 XP, +3 🪙",
    hanziCharDataUnavailable: "⚠️ Couldn't load stroke data for this character. Check your connection and try again.",
    bossStart: "Start",
    bossStop: "Stop",
    bossStatusStandby: "standby",
    bossStatusCombat: "in combat",
    bossStatusVictory: "victory",
    bossWaiting: "Minigame module on standby...",
    bossFighting: "Boss Fight active. Good luck!",
  },
  ja: {
    statLevel: "レベル",
    statRank: "ランク",
    statCompass: "コンパス",
    statFinance: "財務",
    statStreakTitle: "学習の連続記録",
    statBalanceGlobalTitle: "グローバル残高",
    statBalanceGlobal: "グローバル残高",
    hudBannerPhrase1: "ビジネスの主導権を握れ",
    hudBannerPhrase2: "学習の連続記録を維持しよう",
    hudBannerPhrase3: "毎日が未来につながる",
    hudBannerPhrase4: "次のレベルが待っている",
    hudBannerPhrase5: "目標を達成に変えよう",
    online: "オンライン",
    logout: "ログアウト",
    masterAuthLoginTitle: "おかえりなさい",
    masterAuthLoginSubtitle: "電話番号とパスワードを入力してコアのロックを解除してください。",
    masterAuthRegisterTitle: "メインアカウントを作成",
    masterAuthRegisterSubtitle: "このアカウントはデバイス全体へのアクセスを保護します。プロフィールはログイン後に作成できます。",
    masterAuthPhonePlaceholder: "電話番号",
    masterAuthPasswordPlaceholder: "パスワード",
    masterAuthPasswordConfirmPlaceholder: "パスワードを確認",
    masterAuthLoginBtn: "ログイン",
    masterAuthRegisterBtn: "アカウントを作成",
    masterAuthPasswordMismatch: "パスワードが一致しません。",
    masterAuthInvalidCredentials: "電話番号またはパスワードが正しくありません。",
    masterAuthAccountExists: "この端末にはすでにアカウントがあります。電話番号とパスワードでログインしてください。",
    masterAuthGoRegister: "アカウントをお持ちでないですか？作成する",
    masterAuthGoLogin: "すでにアカウントをお持ちですか？ログイン",
    profileSwitchBtnTitle: "プロフィールを切り替える",
    miikaPassBtn: "🎫 ミイカパス",
    miikaPassTitle: "🎫 ミイカパス",
    miikaPassLore: "到達したレベルごとに、ミイカエルのコアから報酬が解放されます。",
    miikaPassFilterLabel: "表示",
    miikaPassFilterAll: "すべてのレベル",
    miikaPassFilterUnlocked: "解放済みのみ",
    miikaPassLevelPrefix: "Lv.",
    miikaPassAvatarIdle: "覚醒コアアバター",
    miikaPassAvatarBoss: "ボスモードアバター",
    profilesTitle: "ユーザープロフィール",
    profilesSubtitle: "各プロフィールは独自の履歴、通貨、アクティブモジュールを保持します。",
    profileCreatePlaceholder: "新しいプロフィール名（例：ママ - 美容室）",
    profileCreateBtn: "+ プロフィールを作成",
    profileActiveBadge: "アクティブ",
    profileSwitchTo: "切り替える",
    negocioScanBtn: "📷 レシート/伝票の写真をアップロード",
    negocioPrintBtn: "🖨️ 記入用紙を印刷",
    negocioFechaLabel: "日付",
    negocioScanScanning: "画像をスキャン中...",
    negocioScanDone: "検出結果：",
    printFormTitle: "事業登録フォーム",
    printFormSubtitle: "はっきりした文字で手書きしてください。後で「📷 レシート/伝票の写真をアップロード」から再登録できます。",
    printFormBusinessLabel: "事業名：",
    printFormWeekLabel: "週：",
    printFormColFecha: "日付",
    printFormColColaborador: "担当者",
    printFormColServicio: "サービス/商品",
    printFormColPrecio: "価格",
    printFormColComision: "歩合（％）",
    printFormColInsumos: "経費/材料費",
    wishlistTitle: "ウィッシュリスト // 夢のガレージ",
    wishlistPlaceholder: "願いを追加...",
    wishlistReqPlaceholder: "新しい条件（例：頭金を貯める）",
    wishlistReqEmpty: "この願いにはまだ条件がありません。",
    wishlistReqRemove: "条件を削除",
    wishlistReqAllDoneMessage: "{name}の条件をすべて達成しました！ガレージで願いが解放されました。",
    chatTitle: "フィード // チャット",
    chatChannel: "チャンネル-01",
    chatPlaceholder: "ミイカエルにメッセージ...",
    chatSend: "送信",
    pillarFinanzas: "財務",
    pillarFisico: "身体状態",
    pillarEspiritual: "精神状態",
    pillarAprendizaje: "学習",
    aprendizajeTitle: "🧠 学習",
    aprendizajeHint: "この柱は現在準備中です。もうすぐここで学習の進捗を記録できるようになります。",
    courseAiName: "AIシステム",
    courseAiDesc: "AIの基礎、言語モデル、実際のビジネスに応用する自動化。",
    courseEnglishName: "テクニカル英語",
    courseEnglishDesc: "テック業界で使う技術英語の語彙とコミュニケーション。",
    courseFinanceName: "上級ファイナンス",
    courseFinanceDesc: "基本的な支出管理を超えた、投資・財務分析・上級戦略。",
    courseCyberName: "サイバーセキュリティとインフラ",
    courseCyberDesc: "データ・ネットワーク・システムの保護 — 実践的なデジタルセキュリティの基礎。",
    courseCodeName: "プログラミングとソフトウェア開発",
    courseCodeDesc: "プログラミングの論理とソフトウェア開発をゼロからステップごとに。",
    courseCloudName: "クラウドと自動化",
    courseCloudDesc: "どんなビジネスも拡張できるクラウドインフラとプロセス自動化。",
    courseComingSoonBadge: "🚀 近日公開 — 大型リリース",
    financeIncomeLabel: "月収",
    payrollAuditOpenTitle: "給与監査・管理",
    payrollAuditTitle: "📋 給与監査・管理",
    payrollAuditSubtitle: "日本の給与明細書の構成 — 勤務時間と収入を記録して実際の手取り額を計算します。",
    payrollScanBtn: "📷 給与明細書 / 勤怠表をアップロード",
    payrollScanScanning: "書類をスキャン中...",
    payrollScanDone: "書類を読み取りました — 項目を更新しました。",
    payrollEvidenceSavedText: "証憑を保存しました。",
    payrollHoursTitle: "⏱️ 勤務日数・時間",
    payrollHorasBaseLabel: "出勤時間",
    payrollHorasExtraLabel: "残業",
    payrollHorasNocturnasLabel: "深夜",
    payrollIncomeTitle: "💰 総支給額",
    payrollSueldoBaseLabel: "基本給",
    payrollBonosLabel: "ボーナス・手当",
    payrollDeductionsTitle: "➖ 控除",
    payrollSegurosLabel: "社会保険",
    payrollImpuestosLabel: "所得税",
    payrollAdelantosLabel: "前払い",
    payrollNetoFinalLabel: "最終手取り額",
    payrollApplyBtn: "✓ 月収として使用",
    payrollAppliedMessage: "給与監査を適用しました：最終手取り額{amount}を月収として設定しました。",
    categoryBreakdownOpenTitle: "支出内訳を見る",
    categoryAmountDerivedHint: "内訳の合計から自動計算されます — 編集はそちらから。",
    categoryScanBtn: "📷 レシート/伝票をアップロード",
    categoryScanScanning: "レシートをスキャン中...",
    categoryScanDone: "検出結果：",
    categoryItemConceptPlaceholder: "内容（例：スーパー）",
    categoryItemAmountPlaceholder: "金額",
    categoryItemAddBtn: "+ 支出を追加",
    categoryBreakdownTotalLabel: "カテゴリー合計",
    categoryBreakdownTitlePrefix: "支出内訳：",
    categoryItemsEmpty: "このカテゴリーにはまだ支出が登録されていません。",
    financeAddCategory: "+ カテゴリー追加",
    financeTotal: "総支出",
    financeBalance: "残高",
    financeSave: "保存",
    financeTabPersonal: "個人",
    financeTabServicios: "サービス / ビジネス",
    financeOpenDashboardBtn: "📊 ダッシュボードを見る",
    adminPanelOpenBtn: "🛡️ 管理者パネル",
    inspectorOpenBtn: "🕵️ インスペクターエージェント",
    adminPanelTitle: "🛡️ 管理者パネル",
    adminPanelTabTransactions: "💳 取引",
    adminPanelTabInspector: "🕵️ バグ検査",
    adminPanelTabAutomation: "🤖 自動化（n8n）",
    adminPanelRefreshBtn: "🔄 更新",
    adminPanelExportBtn: "📥 CSVをエクスポート",
    adminPanelColDate: "日付",
    adminPanelColBusiness: "ビジネス",
    adminPanelColCollaborator: "協力者",
    adminPanelColIncome: "総収入",
    adminPanelColExpense: "支出",
    adminPanelColNet: "純利益",
    adminPanelNoClient: "⚠️ Supabaseに接続できませんでした。",
    adminPanelLoading: "取引を読み込み中...",
    adminPanelError: "⚠️ Supabaseのテーブルを読み込めませんでした：",
    adminPanelRowCount: "統合された取引数：",
    adminPanelNetworkError: "⚠️ Supabase接続時のネットワークエラー。",
    adminLoginTriggerBtn: "🛡️ 管理者としてログイン",
    adminLogoutTriggerBtn: "🛡️ 管理者セッションを終了",
    adminLoginTitle: "🛡️ 管理者アクセス",
    adminLoginSubtitle: "Supabase管理者アカウントでログインしてください。",
    adminLoginEmailPlaceholder: "メールアドレス",
    adminLoginPasswordPlaceholder: "パスワード",
    adminLoginBtn: "ログイン",
    adminLoginError: "認証情報が間違っているか、アカウントが存在しません。",
    adminLoginNotAuthorized: "このアカウントには管理者権限がありません。",
    adminLoginSuccessMessage: "管理者セッションを開始しました。管理者パネルとインスペクターエージェントが解放されました。",
    adminLogoutMessage: "管理者セッションを終了しました。",
    inspectorStatTotal: "合計",
    inspectorStatPending: "保留中",
    inspectorStatApproved: "承認済み",
    inspectorStatResolved: "解決済み",
    inspectorStatus_pendiente: "保留中",
    inspectorStatus_aprobado: "承認済み",
    inspectorStatus_descartado: "却下済み",
    inspectorStatus_resuelto: "解決済み",
    inspectorApproveBtn: "✅ 承認",
    inspectorDiscardBtn: "❌ 却下",
    inspectorResolveBtn: "✔️ 解決済みにする",
    automationStatTotal: "合計",
    automationStatPending: "保留中",
    automationStatApproved: "承認済み",
    automationStatDiscarded: "却下済み",
    automationStatus_pending: "保留中",
    automationStatus_approved: "承認済み",
    automationStatus_discarded: "却下済み",
    automationApproveBtn: "✅ 承認 / 実行",
    automationDiscardBtn: "❌ 却下",
    automationRowCount: "見つかったタスク：",
    automationEmptyState: "キューにタスクはありません。n8nがSupabaseのautomation_tasksテーブルに自動で追加します。",
    negocioCurrencyLabel: "ビジネスの通貨",
    negocioNombreLabel: "ビジネス名",
    negocioColaboradorLabel: "協力者 / 販売員 *",
    negocioMetodoPagoLabel: "支払い方法",
    negocioMetodoPagoYape: "Yape",
    negocioMetodoPagoTarjeta: "カード",
    negocioMetodoPagoOtro: "その他",
    negocioMetodoPagoOtroLabel: "方法を入力してください",
    dashboardColMetodoPago: "支払い方法",
    adminPanelColMetodoPago: "支払い方法",
    negocioComisionPreviewLabel: "協力者の歩合",
    negocioTipoServicio: "サービス",
    negocioTipoVenta: "販売",
    negocioServicioConceptoLabel: "サービス / ルート",
    negocioServicioMontoLabel: "請求金額",
    negocioServicioGastosLabel: "直接経費",
    negocioServicioComisionLabel: "歩合率",
    negocioVentaConceptoLabel: "商品 / 内容",
    negocioVentaPrecioUnitarioLabel: "単価（卸値）",
    negocioCantidadLabel: "数量 / 重量 / 単位",
    negocioVentaCostoTotalLabel: "仕入合計金額",
    negocioVentaMontoCobradoLabel: "請求金額（最終販売価格）",
    negocioVentaGananciaBrutaLabel: "粗利益",
    negocioVentaComisionLabel: "歩合（任意）",
    negocioComisionModoPct: "% 割合",
    negocioComisionModoFijo: "固定金額",
    negocioVentaGananciaFinalLabel: "最終純利益",
    negocioGananciaPreviewLabel: "純利益（プレビュー）",
    negocioRegistrarBtn: "+ 取引を登録",
    storyModalEyebrow: "ミイカエル核心 // 量子ロア記録",
    storyModalViewChapters: "📖 チャプター",
    storyModalViewCharacters: "🧬 ネクサスの存在",
    storyModalMysteryTitle: "⚠ 明かされた謎",
    storyModalClueTitle: "📡 次の手がかり",
    storyModalCloseBtn: "🔌 回線を切断",
    skinsOpenBtn: "🎭 ライオンスキン",
    skinsModalTitle: "🎭 ライオンスキン",
    skinsModalSubtitle: "解放可能なコレクション",
    skinsModalCloseBtn: "閉じる",
    characterOpenBtn: "🧬 マイキャラクター",
    characterSelectTitle: "🧬 初期アバターを選んでください",
    characterSelectSubtitle: "レベルとともに進化します",
    characterSelectFemale: "双子の女の子",
    characterSelectMale: "双子の男の子",
    cityMapTitle: "🌐 都市拡張",
    cityMapHeadline: "近日公開：あなたの街で願いを叶える準備を",
    feedbackTitle: "🐞 バグ＆提案",
    feedbackSubtitle: "バグを見つけましたか？Miikaeruを改善するアイデアはありますか？教えてください。",
    feedbackTypeLabel: "種類",
    feedbackTypeBug: "🐞 バグ／エラー",
    feedbackTypeSuggestion: "💡 提案",
    feedbackMessagePlaceholder: "バグやアイデアを説明してください...",
    feedbackSubmitBtn: "送信",
    feedbackStatusSuccess: "ありがとうございます！メッセージを送信しました。",
    feedbackStatusError: "送信できませんでした。後でもう一度お試しください。",
    feedbackStatusOffline: "現在サービスが利用できません。後でもう一度お試しください。",
    dashboardTitle: "📊 総合財務ダッシュボード",
    dashboardReportGenericTitle: "財務レポート",
    dashboardFilterLabel: "ビジネス",
    dashboardPrintBtn: "🖨️ レポートを印刷",
    dashboardPayslipBtn: "🖨️ 協力者の給与明細を印刷",
    dashboardCollaboratorSelectedLabel: "選択中の協力者：",
    payslipTitle: "給与明細",
    payslipSubtitle: "サービス精算書",
    payslipBusinessLabel: "事業名：",
    payslipDateLabel: "発行日：",
    payslipCollaboratorLabel: "協力者：",
    payslipColFecha: "日付",
    payslipColConcepto: "サービス / 商品",
    payslipColMonto: "請求金額",
    payslipColComision: "獲得歩合",
    payslipTotalLabel: "支払純額",
    payslipEmpty: "この協力者の取引記録がありません。",
    printPopupBlocked: "ブラウザが印刷ウィンドウをブロックしました。このサイトのポップアップを許可してから再試行してください。",
    btnDownloadPdf: "📥 PDFをダウンロード",
    pdfDownloadHint: "印刷ダイアログが開きました — 「PDFに保存」を選択してダウンロードしてください。",
    dashboardFilterAll: "すべて",
    dashboardCardIncome: "総収入",
    dashboardCardExpense: "総支出",
    dashboardCardBalance: "総純利益",
    dashboardRankingTitle: "🏆 トップパフォーマンス",
    dashboardRankingByNegocio: "ビジネス別",
    dashboardRankingByColaborador: "協力者別",
    dashboardRankingEmpty: "最初の取引を登録するとランキングが表示されます。",
    dashboardColFecha: "日付",
    dashboardColNegocio: "ビジネス",
    dashboardColColaborador: "協力者",
    dashboardColConcepto: "内容",
    dashboardColIngreso: "総収入",
    dashboardColEgresos: "経費・歩合",
    dashboardColGanancia: "純利益",
    dashboardColAcciones: "操作",
    dashboardDeleteBtn: "取引を削除",
    dashboardDeleteConfirm: "この取引を削除しますか？この操作は元に戻せません。",
    dashboardEmpty: "まだ取引が登録されていません。",
    fisicoRepsLabel: "目標回数",
    fisicoStepsLabel: "記録した歩数",
    fisicoRegister: "登録",
    espiritualMeditationTitle: "静寂の瞑想",
    espiritualMeditationHint: "完全な遮断：音楽なし、気を散らすものなし、通知なし。",
    espiritualMinutesLabel: "分",
    espiritualStart: "瞑想を開始",
    espiritualCancel: "キャンセル",
    espiritualTechniquesTitle: "心の明晰さのテクニック",
    avatarTitle: "アバター",
    appsHubTitle: "アプリ & モジュール",
    appsAddBtn: "+ アプリを追加",
    appBossFightName: "ボスファイト",
    appJapaneseName: "日本語AIコーチ",
    appHabitsName: "習慣＆連続記録",
    appStatusNew: "新着",
    appStatusComingSoon: "近日公開",
    appJapanesePlaceholder: "日本語AIコーチモジュールは開発中です。もうすぐここで練習できるようになります。",
    appAddedMessage: "アプリ&モジュールに、もうすぐ新しいモジュールが追加されます。",
    appCalendarName: "カレンダー&イベント",
    appBiosyncName: "バイオシンク&体調管理",
    appKaraokeName: "カラオケ",
    habitsTabDaily: "🔥 デイリー習慣",
    habitsTabWorkout: "💪 トレーニングルーティン",
    habitsStreakLabel: "連続日数",
    habitsHint: "今日5つの習慣を完了して連続記録を伸ばそう。",
    habitsAllDoneCongrats: "素晴らしい、オペレーター！今日の習慣をすべて完了しました。連続記録：{streak}日 🔥",
    habitWakeUp: "朝5時に起きる",
    habitMeditate: "瞑想する（10〜15分）",
    habitPlan: "1日の計画を立てる",
    habitJapanese: "日本語を勉強する",
    habitHydrate: "水分補給・健康管理",
    workoutMon: "月曜日",
    workoutTue: "火曜日",
    workoutWed: "水曜日",
    workoutThu: "木曜日",
    workoutFri: "金曜日",
    workoutSat: "土曜日",
    workoutSun: "日曜日",
    workoutFocusPlaceholder: "その日の重点部位（例：腕・胸）",
    workoutExerciseLabel: "種目",
    workoutExercisePlaceholder: "例：ベンチプレス",
    workoutSetsLabel: "セット数",
    workoutRepsLabel: "回数",
    workoutWeightLabel: "重量（kg）",
    workoutLogBtn: "+ 種目を記録",
    sevenMinTitle: "🏆 7分間チャレンジ — 器具なしファンクショナルトレーニング",
    sevenMinNote: "12種目、各30秒 + 休憩10秒 — 器具は一切不要、必要なのは体（と丈夫な椅子）だけ。",
    sevenMinCompleteBtn: "✅ 今日のトレーニングを完了した",
    sevenMinAlreadyDoneToday: "今日のトレーニングは完了済みです",
    sevenMinSessionsToUnlock: "回で解放",
    sevenMinSessionsCompleted: "回、合計で完了",
    sevenMinRestLabel: "休憩",
    sevenMinWeekUnlockedMsg: "新しい週が解放されました！",
    sevenMinWeek1Title: "1週目",
    sevenMinWeek1Desc: "慣らし期間 — サーキットを1周。各種目の正しいフォームを覚えることが目標。",
    sevenMinWeek2Title: "2週目",
    sevenMinWeek2Desc: "継続 — 引き続き1周。すべての種目で正しいフォームを保つことに集中。",
    sevenMinWeek3Title: "3週目",
    sevenMinWeek3Desc: "筋力強化 — サーキットを2周（周と周の間に1分休憩）。",
    sevenMinWeek4Title: "4週目",
    sevenMinWeek4Desc: "持久力強化 — 2周、周と周の間の休憩を短くしていく。",
    sevenMinExJumpingJacks: "ジャンピングジャック",
    sevenMinGuideJumpingJacks: "脚と腕を同時に開いてジャンプし、また閉じる。一定のリズムで。",
    sevenMinExWallSit: "ウォールシット",
    sevenMinGuideWallSit: "壁に背中をつけ、膝を90°に。見えない椅子に座っているような姿勢。",
    sevenMinExPushUps: "腕立て伏せ",
    sevenMinGuidePushUps: "手は肩幅より少し広く、胸が床につく直前まで下げて押し上げる。きつい場合は膝をついてもOK。",
    sevenMinExCrunches: "腹筋（クランチ）",
    sevenMinGuideCrunches: "仰向けで膝を曲げ、腹筋を使って肩を床から持ち上げる（首を引っ張らないように）。",
    sevenMinExStepUp: "椅子の昇降",
    sevenMinGuideStepUp: "丈夫な椅子や段差を昇り降りする。毎回踏み出す足を交互に変える。",
    sevenMinExSquats: "スクワット",
    sevenMinGuideSquats: "足は肩幅に開き、椅子に座るように腰を落とす。膝がつま先より前に出ないように。",
    sevenMinExTricepDips: "椅子を使った三頭筋ディップス",
    sevenMinGuideTricepDips: "椅子の縁に手をつき、肘を曲げて体を下げてから押し上げる。",
    sevenMinExPlank: "プランク",
    sevenMinGuidePlank: "前腕とつま先を床につけ、体を一直線に保ち、腹筋を締める。",
    sevenMinExHighKnees: "その場でのももあげ走り",
    sevenMinGuideHighKnees: "その場で膝をできるだけ高く上げながら素早く走る。",
    sevenMinExLunges: "ランジ",
    sevenMinGuideLunges: "大きく一歩前に踏み出し、後ろの膝を床近くまで下げる。左右交互に。",
    sevenMinExPushUpRotation: "回旋腕立て伏せ",
    sevenMinGuidePushUpRotation: "腕立て伏せの後、片腕を天井に向けて体をひねる。その方向を見る。",
    sevenMinExSidePlank: "サイドプランク",
    sevenMinGuideSidePlank: "横向きで片方の前腕をつき、体を一直線に。時間の半分で反対側に切り替える。",
    forceUpdateBtn: "🔄 強制更新 / キャッシュ削除",
    forceUpdateBtnWorking: "キャッシュを削除中...",
    scaleControlsTitle: "🔍 パネルサイズ",
    scaleControlsAvatar: "獅子",
    scaleControlsChat: "チャット",
    scaleControlsReset: "リセット",
    appKaraokePlaceholder: "カラオケモジュールは開発中です。もうすぐここでお気に入りの曲を歌えるようになります。",
    calendarEventPlaceholder: "給料の支払い、トラックの整備...",
    calendarAddBtn: "+ 追加",
    calendarNoEvents: "この日の予定はありません。",
    biosyncConnectBtn: "📡 スマートウォッチ/バンドをBluetooth接続",
    biosyncBtUnavailable: "このブラウザはWeb Bluetoothに対応していません。手動モードを使用してください。",
    biosyncBtConnecting: "近くのデバイスを検索中...",
    biosyncBtConnected: "接続済み:",
    biosyncBtError: "接続できませんでした:",
    biosyncManualLabel: "手動/シミュレーションモード (BPM)",
    biosyncWeightLabel: "体重 (kg)",
    biosyncSleepLabel: "睡眠時間",
    biosyncEnergyLabel: "エネルギーレベル (1-10)",
    biosyncEnergyShort: "エネルギー",
    biosyncSaveBtn: "+ 体調を記録",
    biosyncLogMessage: "体調を記録しました：{weight}kg、睡眠{sleep}時間、エネルギー{energy}/10。",
    jpScriptHiragana: "ひらがな",
    jpScriptKatakana: "カタカナ",
    jpScriptKanji: "基本漢字 N5",
    jpKanjiN5Title: "基本漢字（N5）",
    jpKanjiOnyomi: "音読み：",
    jpKanjiKunyomi: "訓読み：",
    jpKanjiMeaning: "意味：",
    jpVocabTitle: "📚 キーワード",
    jpGeneralPractice: "🎯 総合練習",
    jpPracticeRow: "練習",
    jpBackToGrid: "← 戻る",
    jpSkipStroke: "⏭ 書き順をスキップ",
    jpQuizPrompt: "ローマ字は？",
    jpQuizPromptMeaning: "意味は？",
    jpQuizCorrect: "正解！",
    jpQuizIncorrect: "惜しい — 正解は",
    jpSessionComplete: "日本語セッション終了:",
    jpPracticeSessionComplete: "練習セッション終了。",
    jpRowLabelPrefix: "",
    jpListen: "発音を聞く",
    jpStrokeLabel: "画",
    jpConfigTitle: "🎌 日本語AIコーチ",
    jpConfigLanguageTitle: "インターフェース言語",
    jpConfigModeTitle: "モード",
    jpModePractica: "練習",
    jpModeExamen: "試験",
    jpConfigReopenTitle: "言語 / モードを変更",
    jpPhasesHint: "書き順の変化をフェーズごとに見てみましょう。",
    jpPhaseRowError: "⚠️ この文字の書き順を読み込めませんでした。",
    jpNextChar: "次へ →",
    jpExamStrokeInstruction: "テスト1：正しい書き順の通りに画をクリックしてください。",
    jpHanziWriterOpenBtn: "✍️ 本物の書き順",
    jpVocabOpenBtn: "📚 N5語彙",
    jpGrammarOpenBtn: "📖 N5文法",
    jpYoonOpenBtn: "🈴 拗音",
    jpYoonNote: "読み方の一覧 — き・し・ち等とゃ・ゅ・ょの書き順は上のひらがな/カタカナで別途練習できます。",
    jpYoonQuizStart: "🎯 拗音クイズ",
    jpYoonQuizPrompt: "これはどう読みますか？",
    jpBackToVocab: "← カテゴリーに戻る",
    jpVocabQuizStart: "🎯 このカテゴリーのクイズ",
    jpGrammarQuizStart: "🎯 N5文法クイズ",
    jpVocabWordsCount: "単語",
    jpMiniQuizVocabPrompt: "この単語の意味は？",
    jpMiniQuizGrammarPrompt: "どの助詞が抜けている？",
    jpMiniQuizDone: "🎉 クイズ完了！",
    jpMiniQuizScore: "スコア：",
    n5CatGreetings: "挨拶",
    n5CatNumbers: "数字",
    n5CatTime: "時間",
    n5CatFamily: "家族",
    n5CatVerbs: "基本動詞",
    n5CatColors: "色",
    n5CatFood: "食べ物",
    n5CatPlaces: "場所",
    n5CatAdjectives: "形容詞",
    n5CatObjects: "身の回りの物",
    n5GramWaTitle: "は — 主題の助詞",
    n5GramMoTitle: "も — 〜も",
    n5GramOTitle: "を — 目的語",
    n5GramNiTitle: "に — 時間・行き先",
    n5GramDeTitle: "で — 場所・手段",
    n5GramGaTitle: "が — 主語",
    n5GramNoTitle: "の — 所有",
    n5GramDesuMasuTitle: "です / ます — 丁寧形",
    n5GramNegativeTitle: "〜ません — 否定形",
    n5GramPastTitle: "〜ました — 過去形",
    n5GramAdjTitle: "い形容詞 / な形容詞",
    n5GramTaiTitle: "〜たいです — 願望",
    n5GramKudasaiTitle: "〜てください — 依頼",
    n5GramDekiruTitle: "〜ことができます — 可能",
    n5GramKaTitle: "か — 疑問文",
    n5GramKaraTitle: "から — 理由",
    n5GramShikaTitle: "しか — 限定",
    n5GramMasenkaTitle: "〜ませんか — 勧誘",
    n5GramMashouTitle: "〜ましょう — 提案",
    n5GramTemoiiTitle: "〜てもいい / 〜てはいけません — 許可と禁止",
    n5GramTokiTitle: "とき — 時",
    n5GramMouMadaTitle: "もう / まだ — 完了と未完了",
    hanziWriterTitle: "✍️ 書き順練習（実データ）",
    hanziWriterSubtitle: "実際の筆順データ（KanjiVG）に基づいています。文字を選んでアニメーションで見るか、書き順を練習しましょう。",
    hanziWriterHiraganaTitle: "ひらがな",
    hanziWriterKatakanaTitle: "カタカナ",
    hanziWriterKanjiTitle: "基本漢字（N5）",
    hanziAnimateBtn: "🎬 書き順をアニメーション",
    hanziQuizBtn: "✍️ なぞり書き練習",
    hanziResetBtn: "🔄 リセット",
    hanziQuizHint: "文字を正しい順になぞりましょう。緑=正解、赤=間違った画。",
    hanziQuizCorrectStroke: "✅ 正しい画です",
    hanziQuizMistake: "❌ 順番または方向が違います — もう一度",
    hanziQuizComplete: "🎉 文字完成！+10 XP、+3 🪙",
    hanziCharDataUnavailable: "⚠️ この文字の筆順データを読み込めませんでした。接続を確認してもう一度お試しください。",
    bossStart: "開始",
    bossStop: "停止",
    bossStatusStandby: "待機中",
    bossStatusCombat: "戦闘中",
    bossStatusVictory: "勝利",
    bossWaiting: "ミニゲームモジュールは待機中です...",
    bossFighting: "ボスファイト進行中。頑張って！",
  },
};

function t(key) {
  const dict = I18N[currentLanguage] || I18N.es;
  return dict[key] || I18N.es[key] || key;
}

// ---------------------------------------------------
// Avatar: sistema de "emotes". Siempre parte en idle y cambia
// temporalmente ante ciertos eventos (login, subir de nivel, victoria en
// Boss Fight), volviendo solo a idle después de unos segundos.
// ---------------------------------------------------
// Arte real de "Mikaeru skin" (assets/skins/, pedido explícito) en vez de
// los 3 PNG placeholder anteriores — welcome usa la pose meditando
// (cálida, distinta de idle); levelup y victory comparten la pose de
// batalla/armadura (ambos son momentos "de triunfo").
const AVATAR_EMOTES = {
  idle: "assets/skins/mikaeru_idle_chakras.png",
  welcome: "assets/skins/mikaeru_meditando_neon.png",
  levelup: "assets/skins/mikaeru_batalla_armadura.png",
  victory: "assets/skins/mikaeru_batalla_armadura.png",
};

// Precarga las 4 imágenes al cargar el script para que los cambios de
// emote sean instantáneos (sin parpadeo ni imagen rota mientras carga).
Object.values(AVATAR_EMOTES).forEach((src) => {
  const preloadImg = new Image();
  preloadImg.src = src;
});

// ---------------------------------------------------
// Avatar: estado de la escena (fondo + personaje) según el contexto del
// juego — distinto del sistema de "emotes" de arriba (que son pulsos
// cortos ante un evento puntual). setAvatarState() cambia el `src` de
// las capas .layer-bg y .layer-lion de #avatarStage (ver index.html /
// style.css) y se queda así hasta el próximo cambio de estado.
// Función global (declarada fuera de DOMContentLoaded) para poder
// invocarla desde cualquier parte de app.js o desde la consola.
// ---------------------------------------------------
const AVATAR_STATE_ASSETS = {
  idle: { bg: "assets/bg_state_idle.png", lion: "assets/skins/mikaeru_idle_chakras.png" },
  meditating: { bg: "assets/bg_state_meditation.png", lion: "assets/skins/mikaeru_meditando_neon.png" },
  boss: { bg: "assets/bg_main.png", lion: "assets/skins/mikaeru_batalla_armadura.png" },
};

// ---------------------------------------------------
// Skins desbloqueables del León (galería "Mikaeru skin") — SOLO retratos
// del propio Miikaeru (se excluyen a propósito metrakaela_guerrera.png/
// demiure_draconiano.png/badas_batalla.png: son otros personajes del
// lore, no variantes del avatar del Operador). `nivelRequerido` escala
// junto con los rangos reales de RANKS (1/10/20/30/50) para que
// desbloquear un skin nuevo se sienta ligado al progreso real, no a un
// sistema paralelo. El Operador elige uno desde el modal de Skins
// (#skins-modal, ver DOMContentLoaded más abajo); `state.selectedSkin`
// guarda el id elegido y sustituye al carrusel ambiental de
// startAvatarIdleCarousel() mientras esté activo (ver
// currentIdleLionSrc()) — `null` vuelve a la rotación de 3 estados de
// siempre.
const MIIKAERU_SKINS = [
  { id: "cachorro_kodomo", nivelRequerido: 1, src: "assets/skins/mikaeru_cachorro_kodomo.png" },
  { id: "idle_chakras", nivelRequerido: 1, src: "assets/skins/mikaeru_idle_chakras.png" },
  { id: "cachorro_dormido", nivelRequerido: 3, src: "assets/skins/mikaeru_skin_cachorro_dormido.png" },
  { id: "meditando_neon", nivelRequerido: 5, src: "assets/skins/mikaeru_meditando_neon.png" },
  { id: "cachorro_cosmico", nivelRequerido: 8, src: "assets/skins/mikaeru_cachorro_cosmico_wakai.png" },
  { id: "cazador_neon", nivelRequerido: 10, src: "assets/skins/mikaeru_skin_cazador_neon.png" },
  { id: "cristal_arcano", nivelRequerido: 12, src: "assets/skins/mikaeru_skin_cristal_arcano.png" },
  { id: "sacrificio_despertar", nivelRequerido: 15, src: "assets/skins/mikaeru_sacrificio_despertar.png" },
  { id: "familia_portada", nivelRequerido: 18, src: "assets/skins/mikaeru_familia_portada.png" },
  { id: "guardian_templo", nivelRequerido: 20, src: "assets/skins/mikaeru_skin_guardian_templo.png" },
  { id: "batalla_armadura", nivelRequerido: 24, src: "assets/skins/mikaeru_batalla_armadura.png" },
  { id: "soberano_estelar", nivelRequerido: 28, src: "assets/skins/mikaeru_skin_soberano_estelar.png" },
  { id: "comandante_ejercito", nivelRequerido: 30, src: "assets/skins/mikaeru_skin_comandante_ejercito.png" },
  { id: "heraldo_rugiente", nivelRequerido: 35, src: "assets/skins/mikaeru_skin_heraldo_rugiente.png" },
  { id: "deidad_meditante", nivelRequerido: 50, src: "assets/skins/mikaeru_skin_deidad_meditante.png" },
];

function skinUnlocked(skin, nivel) {
  return nivel >= skin.nivelRequerido;
}

// ---------------------------------------------------
// Selección de Avatar Inicial: Fesha (mellizo femenino) o Mijashi
// (mellizo masculino) — el Operador elige uno la primera vez que entra
// (ver openCharacterSelectModal(), enganchado a onMasterAuthSuccess() /
// al crear cuenta) y lo ve evolucionar por fases a medida que sube de
// nivel, con rangos propios que van de cachorro a "Supremo Nivel Dios".
// No existe arte dedicado y distinto por género en la carpeta de origen
// más allá de las crías (ver Bloque 55 en PROGRESS_LOG) — las fases de
// rango alto reutilizan retratos ya integrados de MIIKAERU_SKINS,
// enmarcados narrativamente como "el mismo legado dorado manifestándose
// en el mellizo que lo despierta", consistente con el propio lore
// (Fesha/Mijashi heredan Bendiciones de la misma sangre que Miikaeru).
const FESHA_EVOLUTIONS = [
  { id: "fesha_kodomo", nivelRequerido: 1, rango: "Kodomo", titulo: "Cachorro Dorado", src: "assets/skins/mikaeru_cachorro_kodomo.png" },
  { id: "fesha_wakai", nivelRequerido: 10, rango: "Wakai", titulo: "Despertar de la Chispa", src: "assets/skins/mikaeru_cachorro_cosmico_wakai.png" },
  { id: "fesha_soldado_elite", nivelRequerido: 20, rango: "Shinzen", titulo: "Soldado de Élite", src: "assets/skins/mikaeru_skin_guardian_templo.png" },
  { id: "fesha_general", nivelRequerido: 30, rango: "Kami", titulo: "General del Nexus", src: "assets/skins/mikaeru_skin_comandante_ejercito.png" },
  { id: "fesha_meditacion_final", nivelRequerido: 40, rango: "Kami", titulo: "Meditación Final", src: "assets/skins/mikaeru_meditando_neon.png" },
  { id: "fesha_supremo_dios", nivelRequerido: 50, rango: "Kami", titulo: "Supremo Nivel Dios", src: "assets/skins/mikaeru_skin_deidad_meditante.png" },
];

const MIJASHI_EVOLUTIONS = [
  { id: "mijashi_kodomo", nivelRequerido: 1, rango: "Kodomo", titulo: "Cachorro Cósmico", src: "assets/skins/mikaeru_skin_cachorro_galactico.png" },
  { id: "mijashi_wakai", nivelRequerido: 10, rango: "Wakai", titulo: "Reflejo del Escudo", src: "assets/skins/mikaeru_skin_cazador_neon.png" },
  { id: "mijashi_soldado_elite", nivelRequerido: 20, rango: "Shinzen", titulo: "Soldado de Élite", src: "assets/skins/mikaeru_skin_cristal_arcano.png" },
  { id: "mijashi_general", nivelRequerido: 30, rango: "Kami", titulo: "General del Nexus", src: "assets/skins/mikaeru_batalla_armadura.png" },
  { id: "mijashi_meditacion_final", nivelRequerido: 40, rango: "Kami", titulo: "Meditación Final", src: "assets/skins/mikaeru_idle_chakras.png" },
  { id: "mijashi_supremo_dios", nivelRequerido: 50, rango: "Kami", titulo: "Supremo Nivel Dios", src: "assets/skins/mikaeru_skin_soberano_estelar.png" },
];

const PLAYER_CHARACTERS = {
  fesha: { id: "fesha", nombre: "Fesha", evoluciones: FESHA_EVOLUTIONS },
  mijashi: { id: "mijashi", nombre: "Mijashi", evoluciones: MIJASHI_EVOLUTIONS },
};

// La fase más alta que el nivel actual ya alcanza — mismo criterio de
// "lo más reciente que ya desbloqueaste" que MIIKAERU_SKINS/Miika Pass.
function faseActualPersonaje(idPersonaje, nivel) {
  const personaje = PLAYER_CHARACTERS[idPersonaje];
  if (!personaje) return null;
  const desbloqueadas = personaje.evoluciones.filter((fase) => skinUnlocked(fase, nivel));
  if (!desbloqueadas.length) return null;
  return desbloqueadas.reduce((mejor, fase) => (fase.nivelRequerido > mejor.nivelRequerido ? fase : mejor));
}

// Resuelve qué retrato usar para el estado "idle": el skin que el
// Operador eligió a mano (si hay uno guardado) o, por defecto, el de
// AVATAR_STATE_ASSETS.idle de siempre. `state` ya es top-level en este
// archivo (ver `let state = loadState()` más abajo) así que se lee
// directo, sin pasar nada por parámetro.
function currentIdleLionSrc() {
  if (state.selectedSkin) {
    const skin = MIIKAERU_SKINS.find((entry) => entry.id === state.selectedSkin);
    if (skin) return skin.src;
  }
  return AVATAR_STATE_ASSETS.idle.lion;
}

// Precarga también los assets de estado, mismo motivo que AVATAR_EMOTES
// — EXCEPTO los fondos de escena (`bg`) en Mobile Lite (≤767px, ver
// style.css): esas capas quedan con `display:none` ahí (el pedido pide
// "únicamente el avatar en PNG súper liviano"), así que precargarlas
// solo gastaría batería/datos móviles sin que el usuario las vea nunca.
// El León (`lion`) SÍ se sigue precargando siempre, es lo único visible.
const isMobileLiteInit = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 767px)").matches;
Object.values(AVATAR_STATE_ASSETS).forEach(({ bg, lion }) => {
  const sources = isMobileLiteInit ? [lion] : [bg, lion];
  sources.forEach((src) => {
    const preloadImg = new Image();
    preloadImg.src = src;
  });
});

const AVATAR_STATE_FADE_MS = 200; // calza con transition: opacity 0.2s en style.css

// Cruza en fade una capa (baja a opacity 0, cambia `src`, sube a 1) —
// mismo patrón que setAvatarEmote(), reutilizado aquí para .layer-bg y
// .layer-lion. Si la capa ya muestra ese `src`, no hace nada.
function crossfadeAvatarLayer(layer, src) {
  if (!layer || layer.getAttribute("src") === src) return;
  layer.style.opacity = "0";
  setTimeout(() => {
    layer.src = src;
    layer.style.opacity = "1";
  }, AVATAR_STATE_FADE_MS);
}

// Rastrea el estado "real" activo (a diferencia de AVATAR_STATE_ASSETS,
// que es solo el diccionario de datos) — lo necesita el carrusel
// ambiental de abajo para saber si está seguro rotar el arte del León
// sin pisar un estado real como "boss" (Boss Fight en curso).
let avatarCurrentState = "idle";

function setAvatarState(stateName) {
  const config = AVATAR_STATE_ASSETS[stateName];
  if (!config) {
    console.warn(`setAvatarState: estado desconocido "${stateName}"`);
    return;
  }

  avatarCurrentState = stateName;
  crossfadeAvatarLayer(document.querySelector(".layer-bg"), config.bg);
  const lionSrc = stateName === "idle" ? currentIdleLionSrc() : config.lion;
  crossfadeAvatarLayer(document.getElementById("avatar-visual-img"), lionSrc);
}

// ---------------------------------------------------
// Carrusel ambiental del León: rota entre las 3 artes de assets/skins/
// (idle/meditando/batalla), cada una ya atada a un estado real de juego
// (reposo/meditación implícita al arrancar/Boss Fight). Rota ÚNICAMENTE
// el retrato del León (capa .layer-lion), EXCLUSIVAMENTE mientras
// `avatarCurrentState === "idle"` (fuera de combate) y dejando el fondo
// (.layer-bg) intacto en el de reposo —
// así nunca se confunde con un cambio real de estado (p. ej. entrar a
// Boss Fight de verdad). Se pausa solo (no hace nada) durante combate y
// retoma el ciclo apenas `setAvatarState("idle")` vuelve a llamarse.
function startAvatarIdleCarousel() {
  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  const lions = [AVATAR_STATE_ASSETS.idle.lion, AVATAR_STATE_ASSETS.meditating.lion, AVATAR_STATE_ASSETS.boss.lion];
  let index = 0;

  setInterval(() => {
    if (avatarCurrentState !== "idle") return;
    if (state.selectedSkin) return; // el Operador fijó un skin propio — no rotar por encima
    index = (index + 1) % lions.length;
    crossfadeAvatarLayer(document.getElementById("avatar-visual-img"), lions[index]);
  }, 9000);
}

// ---------------------------------------------------
// Módulo Japonés: tabla Gojuon (filas tradicionales del silabario).
// Datos puros — sin DOM — para que también estén disponibles si algo
// más adelante quiere reutilizarlos fuera del App Hub.
// ---------------------------------------------------
const GOJUON_ROWS = [
  { id: "a", romaji: "A", hiragana: ["あ", "い", "う", "え", "お"], katakana: ["ア", "イ", "ウ", "エ", "オ"], romajiList: ["a", "i", "u", "e", "o"] },
  { id: "ka", romaji: "KA", hiragana: ["か", "き", "く", "け", "こ"], katakana: ["カ", "キ", "ク", "ケ", "コ"], romajiList: ["ka", "ki", "ku", "ke", "ko"] },
  { id: "sa", romaji: "SA", hiragana: ["さ", "し", "す", "せ", "そ"], katakana: ["サ", "シ", "ス", "セ", "ソ"], romajiList: ["sa", "shi", "su", "se", "so"] },
  { id: "ta", romaji: "TA", hiragana: ["た", "ち", "つ", "て", "と"], katakana: ["タ", "チ", "ツ", "テ", "ト"], romajiList: ["ta", "chi", "tsu", "te", "to"] },
  { id: "na", romaji: "NA", hiragana: ["な", "に", "ぬ", "ね", "の"], katakana: ["ナ", "ニ", "ヌ", "ネ", "ノ"], romajiList: ["na", "ni", "nu", "ne", "no"] },
  { id: "ha", romaji: "HA", hiragana: ["は", "ひ", "ふ", "へ", "ほ"], katakana: ["ハ", "ヒ", "フ", "ヘ", "ホ"], romajiList: ["ha", "hi", "fu", "he", "ho"] },
  { id: "ma", romaji: "MA", hiragana: ["ま", "み", "む", "め", "も"], katakana: ["マ", "ミ", "ム", "メ", "モ"], romajiList: ["ma", "mi", "mu", "me", "mo"] },
  { id: "ya", romaji: "YA", hiragana: ["や", "ゆ", "よ"], katakana: ["ヤ", "ユ", "ヨ"], romajiList: ["ya", "yu", "yo"] },
  { id: "ra", romaji: "RA", hiragana: ["ら", "り", "る", "れ", "ろ"], katakana: ["ラ", "リ", "ル", "レ", "ロ"], romajiList: ["ra", "ri", "ru", "re", "ro"] },
  { id: "wa", romaji: "WA", hiragana: ["わ", "を"], katakana: ["ワ", "ヲ"], romajiList: ["wa", "wo"] },
  { id: "n", romaji: "N", hiragana: ["ん"], katakana: ["ン"], romajiList: ["n"] },
  // Dakuten (゛) y handakuten (゜) — silabario COMPLETO para N5 (pedido
  // explícito), no solo el seion de arriba. Cada carácter sigue siendo
  // UN solo glifo unicode, así que se integran a la tabla/práctica de
  // trazos/quiz existentes sin ningún cambio de código: mismo shape de
  // datos, fetchHanziStrokeData() los resuelve igual que cualquier otro
  // kana (el dataset @k1low/hanzi-writer-data-jp los cubre como
  // caracteres individuales).
  { id: "ga", romaji: "GA", hiragana: ["が", "ぎ", "ぐ", "げ", "ご"], katakana: ["ガ", "ギ", "グ", "ゲ", "ゴ"], romajiList: ["ga", "gi", "gu", "ge", "go"] },
  { id: "za", romaji: "ZA", hiragana: ["ざ", "じ", "ず", "ぜ", "ぞ"], katakana: ["ザ", "ジ", "ズ", "ゼ", "ゾ"], romajiList: ["za", "ji", "zu", "ze", "zo"] },
  { id: "da", romaji: "DA", hiragana: ["だ", "ぢ", "づ", "で", "ど"], katakana: ["ダ", "ヂ", "ヅ", "デ", "ド"], romajiList: ["da", "ji", "zu", "de", "do"] },
  { id: "ba", romaji: "BA", hiragana: ["ば", "び", "ぶ", "べ", "ぼ"], katakana: ["バ", "ビ", "ブ", "ベ", "ボ"], romajiList: ["ba", "bi", "bu", "be", "bo"] },
  { id: "pa", romaji: "PA", hiragana: ["ぱ", "ぴ", "ぷ", "ぺ", "ぽ"], katakana: ["パ", "ピ", "プ", "ペ", "ポ"], romajiList: ["pa", "pi", "pu", "pe", "po"] },
];

// Yōon (拗音, sonidos contraídos: き+ゃ → きゃ, etc.) — tabla de
// REFERENCIA/lectura, deliberadamente separada de GOJUON_ROWS: cada
// entrada acá son 2 caracteres unicode juntos (base + ya/yu/yo chico), y
// el dataset de trazos reales (@k1low/hanzi-writer-data-jp) indexa por
// UN carácter a la vez — pedirle el trazo de "きゃ" como si fuera un
// solo glifo fallaría. En vez de forzar el yōon dentro del sistema de
// práctica de trazos (donde silenciosamente no cargaría nada), se
// expone acá como tabla de lectura/reconocimiento, que es como
// realmente se enseña este bloque en N5 (combinación de 2 kana ya
// conocidos, no un trazo nuevo que aprender).
const YOON_ROWS = [
  { id: "kya", hiragana: ["きゃ", "きゅ", "きょ"], katakana: ["キャ", "キュ", "キョ"], romajiList: ["kya", "kyu", "kyo"] },
  { id: "sha", hiragana: ["しゃ", "しゅ", "しょ"], katakana: ["シャ", "シュ", "ショ"], romajiList: ["sha", "shu", "sho"] },
  { id: "cha", hiragana: ["ちゃ", "ちゅ", "ちょ"], katakana: ["チャ", "チュ", "チョ"], romajiList: ["cha", "chu", "cho"] },
  { id: "nya", hiragana: ["にゃ", "にゅ", "にょ"], katakana: ["ニャ", "ニュ", "ニョ"], romajiList: ["nya", "nyu", "nyo"] },
  { id: "hya", hiragana: ["ひゃ", "ひゅ", "ひょ"], katakana: ["ヒャ", "ヒュ", "ヒョ"], romajiList: ["hya", "hyu", "hyo"] },
  { id: "mya", hiragana: ["みゃ", "みゅ", "みょ"], katakana: ["ミャ", "ミュ", "ミョ"], romajiList: ["mya", "myu", "myo"] },
  { id: "rya", hiragana: ["りゃ", "りゅ", "りょ"], katakana: ["リャ", "リュ", "リョ"], romajiList: ["rya", "ryu", "ryo"] },
  { id: "gya", hiragana: ["ぎゃ", "ぎゅ", "ぎょ"], katakana: ["ギャ", "ギュ", "ギョ"], romajiList: ["gya", "gyu", "gyo"] },
  { id: "ja", hiragana: ["じゃ", "じゅ", "じょ"], katakana: ["ジャ", "ジュ", "ジョ"], romajiList: ["ja", "ju", "jo"] },
  { id: "bya", hiragana: ["びゃ", "びゅ", "びょ"], katakana: ["ビャ", "ビュ", "ビョ"], romajiList: ["bya", "byu", "byo"] },
  { id: "pya", hiragana: ["ぴゃ", "ぴゅ", "ぴょ"], katakana: ["ピャ", "ピュ", "ピョ"], romajiList: ["pya", "pyu", "pyo"] },
];

// Kanji N5 (JLPT): lista completa del nivel, no solo los 10 más
// elementales de antes — mismo shape de datos de siempre (On'yomi/
// Kun'yomi, en katakana/hiragana como es convención, + significado en
// español), así que se integra a la práctica de trazos/quiz/cuadrícula
// existentes sin ningún cambio de código. A diferencia de los kana, un
// kanji no tiene una única "romanización" — por eso su quiz pregunta
// por el SIGNIFICADO en vez de la lectura (ver showJpQuiz()/
// getKanaList() más abajo). Organizada por tema para que sea más fácil
// de mantener/ampliar, aunque la app la consume como lista plana.
//
// Nota de alcance honesta: son ~107 kanji (el pedido decía
// "aproximadamente 80-100") — se priorizó cubrir bien el vocabulario
// N5 real (números, tiempo, familia, verbos básicos, adjetivos
// comunes) por sobre recortar arbitrariamente para calzar un número
// exacto. Las lecturas se verificaron una por una contra el uso
// estándar N5 (no son lecturas exhaustivas del kanji — solo la/s más
// relevante/s para este nivel).
const KANJI_N5 = [
  // Números
  { char: "一", onyomi: "イチ", kunyomi: "ひと(つ)", meaning: "uno" },
  { char: "二", onyomi: "ニ", kunyomi: "ふた(つ)", meaning: "dos" },
  { char: "三", onyomi: "サン", kunyomi: "み(つ)", meaning: "tres" },
  { char: "四", onyomi: "シ", kunyomi: "よん / よ(つ)", meaning: "cuatro" },
  { char: "五", onyomi: "ゴ", kunyomi: "いつ(つ)", meaning: "cinco" },
  { char: "六", onyomi: "ロク", kunyomi: "む(つ)", meaning: "seis" },
  { char: "七", onyomi: "シチ", kunyomi: "なな(つ)", meaning: "siete" },
  { char: "八", onyomi: "ハチ", kunyomi: "や(つ)", meaning: "ocho" },
  { char: "九", onyomi: "キュウ", kunyomi: "ここの(つ)", meaning: "nueve" },
  { char: "十", onyomi: "ジュウ", kunyomi: "とお", meaning: "diez" },
  { char: "百", onyomi: "ヒャク", kunyomi: "—", meaning: "cien" },
  { char: "千", onyomi: "セン", kunyomi: "—", meaning: "mil" },
  { char: "万", onyomi: "マン", kunyomi: "—", meaning: "diez mil" },
  { char: "円", onyomi: "エン", kunyomi: "まる(い)", meaning: "yen / círculo" },
  // Tiempo
  { char: "日", onyomi: "ニチ", kunyomi: "ひ", meaning: "sol / día" },
  { char: "月", onyomi: "ゲツ", kunyomi: "つき", meaning: "luna / mes" },
  { char: "火", onyomi: "カ", kunyomi: "ひ", meaning: "fuego" },
  { char: "水", onyomi: "スイ", kunyomi: "みず", meaning: "agua" },
  { char: "木", onyomi: "モク", kunyomi: "き", meaning: "árbol" },
  { char: "金", onyomi: "キン", kunyomi: "かね", meaning: "oro / dinero" },
  { char: "土", onyomi: "ド", kunyomi: "つち", meaning: "tierra" },
  { char: "年", onyomi: "ネン", kunyomi: "とし", meaning: "año" },
  { char: "時", onyomi: "ジ", kunyomi: "とき", meaning: "hora / tiempo" },
  { char: "分", onyomi: "フン", kunyomi: "わ(かる)", meaning: "minuto / entender" },
  { char: "半", onyomi: "ハン", kunyomi: "なか(ば)", meaning: "mitad" },
  { char: "今", onyomi: "コン", kunyomi: "いま", meaning: "ahora" },
  { char: "週", onyomi: "シュウ", kunyomi: "—", meaning: "semana" },
  { char: "曜", onyomi: "ヨウ", kunyomi: "—", meaning: "día de la semana" },
  { char: "毎", onyomi: "マイ", kunyomi: "—", meaning: "cada" },
  // Naturaleza
  { char: "山", onyomi: "サン", kunyomi: "やま", meaning: "montaña" },
  { char: "川", onyomi: "セン", kunyomi: "かわ", meaning: "río" },
  { char: "天", onyomi: "テン", kunyomi: "あめ", meaning: "cielo" },
  { char: "気", onyomi: "キ", kunyomi: "—", meaning: "espíritu / aire" },
  { char: "空", onyomi: "クウ", kunyomi: "そら", meaning: "cielo / vacío" },
  { char: "雨", onyomi: "ウ", kunyomi: "あめ", meaning: "lluvia" },
  { char: "花", onyomi: "カ", kunyomi: "はな", meaning: "flor" },
  { char: "草", onyomi: "ソウ", kunyomi: "くさ", meaning: "hierba" },
  // Personas / familia
  { char: "人", onyomi: "ジン", kunyomi: "ひと", meaning: "persona" },
  { char: "女", onyomi: "ジョ", kunyomi: "おんな", meaning: "mujer" },
  { char: "男", onyomi: "ダン", kunyomi: "おとこ", meaning: "hombre" },
  { char: "子", onyomi: "シ", kunyomi: "こ", meaning: "niño / niña" },
  { char: "父", onyomi: "フ", kunyomi: "ちち", meaning: "padre" },
  { char: "母", onyomi: "ボ", kunyomi: "はは", meaning: "madre" },
  { char: "友", onyomi: "ユウ", kunyomi: "とも", meaning: "amigo/a" },
  { char: "名", onyomi: "メイ", kunyomi: "な", meaning: "nombre" },
  { char: "私", onyomi: "シ", kunyomi: "わたし", meaning: "yo" },
  // Lugares / direcciones
  { char: "上", onyomi: "ジョウ", kunyomi: "うえ", meaning: "arriba" },
  { char: "下", onyomi: "カ", kunyomi: "した", meaning: "abajo" },
  { char: "中", onyomi: "チュウ", kunyomi: "なか", meaning: "dentro / medio" },
  { char: "外", onyomi: "ガイ", kunyomi: "そと", meaning: "fuera" },
  { char: "左", onyomi: "サ", kunyomi: "ひだり", meaning: "izquierda" },
  { char: "右", onyomi: "ウ", kunyomi: "みぎ", meaning: "derecha" },
  { char: "前", onyomi: "ゼン", kunyomi: "まえ", meaning: "antes / adelante" },
  { char: "後", onyomi: "ゴ", kunyomi: "あと / うし(ろ)", meaning: "después / atrás" },
  { char: "学", onyomi: "ガク", kunyomi: "まな(ぶ)", meaning: "estudiar" },
  { char: "校", onyomi: "コウ", kunyomi: "—", meaning: "escuela" },
  { char: "生", onyomi: "セイ", kunyomi: "い(きる)", meaning: "vida / nacer" },
  { char: "先", onyomi: "セン", kunyomi: "さき", meaning: "antes / punta" },
  { char: "国", onyomi: "コク", kunyomi: "くに", meaning: "país" },
  { char: "語", onyomi: "ゴ", kunyomi: "かた(る)", meaning: "idioma / hablar" },
  { char: "車", onyomi: "シャ", kunyomi: "くるま", meaning: "auto" },
  { char: "電", onyomi: "デン", kunyomi: "—", meaning: "electricidad" },
  { char: "駅", onyomi: "エキ", kunyomi: "—", meaning: "estación" },
  { char: "道", onyomi: "ドウ", kunyomi: "みち", meaning: "camino" },
  { char: "何", onyomi: "カ", kunyomi: "なに / なん", meaning: "qué" },
  { char: "店", onyomi: "テン", kunyomi: "みせ", meaning: "tienda" },
  { char: "病", onyomi: "ビョウ", kunyomi: "や(む)", meaning: "enfermedad" },
  { char: "院", onyomi: "イン", kunyomi: "—", meaning: "institución" },
  { char: "口", onyomi: "コウ", kunyomi: "くち", meaning: "boca" },
  // Verbos básicos
  { char: "食", onyomi: "ショク", kunyomi: "た(べる)", meaning: "comer" },
  { char: "飲", onyomi: "イン", kunyomi: "の(む)", meaning: "beber" },
  { char: "見", onyomi: "ケン", kunyomi: "み(る)", meaning: "ver" },
  { char: "聞", onyomi: "ブン", kunyomi: "き(く)", meaning: "oír / preguntar" },
  { char: "言", onyomi: "ゲン", kunyomi: "い(う)", meaning: "decir" },
  { char: "話", onyomi: "ワ", kunyomi: "はな(す)", meaning: "hablar" },
  { char: "読", onyomi: "ドク", kunyomi: "よ(む)", meaning: "leer" },
  { char: "書", onyomi: "ショ", kunyomi: "か(く)", meaning: "escribir" },
  { char: "行", onyomi: "コウ", kunyomi: "い(く)", meaning: "ir" },
  { char: "来", onyomi: "ライ", kunyomi: "く(る)", meaning: "venir" },
  { char: "出", onyomi: "シュツ", kunyomi: "で(る)", meaning: "salir" },
  { char: "入", onyomi: "ニュウ", kunyomi: "はい(る)", meaning: "entrar" },
  { char: "立", onyomi: "リツ", kunyomi: "た(つ)", meaning: "pararse" },
  { char: "休", onyomi: "キュウ", kunyomi: "やす(む)", meaning: "descansar" },
  { char: "買", onyomi: "バイ", kunyomi: "か(う)", meaning: "comprar" },
  { char: "走", onyomi: "ソウ", kunyomi: "はし(る)", meaning: "correr" },
  { char: "起", onyomi: "キ", kunyomi: "お(きる)", meaning: "levantarse" },
  { char: "寝", onyomi: "シン", kunyomi: "ね(る)", meaning: "dormir" },
  { char: "会", onyomi: "カイ", kunyomi: "あ(う)", meaning: "encontrarse / reunión" },
  { char: "思", onyomi: "シ", kunyomi: "おも(う)", meaning: "pensar" },
  { char: "作", onyomi: "サク", kunyomi: "つく(る)", meaning: "hacer / crear" },
  // Adjetivos / descripciones comunes
  { char: "大", onyomi: "ダイ", kunyomi: "おお(きい)", meaning: "grande" },
  { char: "小", onyomi: "ショウ", kunyomi: "ちい(さい)", meaning: "pequeño" },
  { char: "高", onyomi: "コウ", kunyomi: "たか(い)", meaning: "alto / caro" },
  { char: "安", onyomi: "アン", kunyomi: "やす(い)", meaning: "barato / tranquilo" },
  { char: "新", onyomi: "シン", kunyomi: "あたら(しい)", meaning: "nuevo" },
  { char: "古", onyomi: "コ", kunyomi: "ふる(い)", meaning: "viejo" },
  { char: "長", onyomi: "チョウ", kunyomi: "なが(い)", meaning: "largo" },
  { char: "多", onyomi: "タ", kunyomi: "おお(い)", meaning: "mucho" },
  { char: "少", onyomi: "ショウ", kunyomi: "すこ(し)", meaning: "poco" },
  { char: "白", onyomi: "ハク", kunyomi: "しろ(い)", meaning: "blanco" },
  { char: "黒", onyomi: "コク", kunyomi: "くろ(い)", meaning: "negro" },
  { char: "早", onyomi: "ソウ", kunyomi: "はや(い)", meaning: "temprano / rápido" },
  // Cuerpo
  { char: "手", onyomi: "シュ", kunyomi: "て", meaning: "mano" },
  { char: "目", onyomi: "モク", kunyomi: "め", meaning: "ojo" },
  { char: "耳", onyomi: "ジ", kunyomi: "みみ", meaning: "oreja" },
  { char: "足", onyomi: "ソク", kunyomi: "あし", meaning: "pie / pierna" },
];

// Palabras Clave por kana (módulo Japonés, Modo Práctica — "Vocabulario
// Ampliado"): VARIOS ejemplos reales por carácter (antes había solo 1),
// cada uno con lectura, kanji SOLO cuando es de uso común real en
// escritura cotidiana (varias palabras cotidianas se escriben
// normalmente en kana puro — ahí se omite el campo kanji a propósito, en
// vez de forzar un kanji correcto pero raramente usado). `meaning` es un
// objeto {es, en} para el soporte i18n pedido — si la interfaz está en
// 日本語, renderVocabSection() oculta esta traducción del todo y muestra
// solo Kana/Kanji/Romaji (modo "nativo/infantil", pedido explícito). を y
// ん/ン se omiten deliberadamente: ninguna palabra japonesa empieza con
// esos sonidos.
//
// Densidad de contenido (nota de alcance, no un límite técnico): あ trae
// exactamente los 9 ejemplos del pedido original, como referencia
// "bandera". El resto del hiragana ya cubierto se amplió a 3 ejemplos
// reales verificados cada uno. El katakana se amplió a 2-3 cada uno en
// las filas que ya tenían cobertura (ア-ソ) y se sumó cobertura nueva
// (1-2 préstamos reales) en el resto de filas — con menos ejemplos en
// filas genuinamente escasas en vocabulario real (ヌ, ヤ, る) en vez de
// forzar una tercera palabra dudosa o inventada solo para completar un
// número parejo.
const JP_VOCAB = {
  // Hiragana — fila a あ (ejemplo "bandera" del pedido, 9 palabras)
  あ: [
    { kana: "あか", kanji: "赤", romaji: "aka", meaning: { es: "rojo", en: "red" }, emoji: "🔴" },
    { kana: "あし", kanji: "足", romaji: "ashi", meaning: { es: "pies", en: "feet" }, emoji: "🦶" },
    { kana: "あい", kanji: "愛", romaji: "ai", meaning: { es: "amor", en: "love" }, emoji: "❤️" },
    { kana: "あした", kanji: "明日", romaji: "ashita", meaning: { es: "mañana", en: "tomorrow" }, emoji: "🌅" },
    { kana: "あなた", romaji: "anata", meaning: { es: "tú", en: "you" }, emoji: "👉" },
    { kana: "あき", kanji: "秋", romaji: "aki", meaning: { es: "otoño", en: "autumn" }, emoji: "🍂" },
    { kana: "あさ", kanji: "朝", romaji: "asa", meaning: { es: "mañana (temprano)", en: "morning" }, emoji: "🌄" },
    { kana: "あせ", kanji: "汗", romaji: "ase", meaning: { es: "sudor", en: "sweat" }, emoji: "💦" },
    { kana: "あお", kanji: "青", romaji: "ao", meaning: { es: "azul", en: "blue" }, emoji: "🔵" },
  ],
  い: [
    { kana: "いぬ", kanji: "犬", romaji: "inu", meaning: { es: "perro", en: "dog" }, emoji: "🐶" },
    { kana: "いえ", kanji: "家", romaji: "ie", meaning: { es: "casa", en: "house" }, emoji: "🏠" },
    { kana: "いろ", kanji: "色", romaji: "iro", meaning: { es: "color", en: "color" }, emoji: "🎨" },
  ],
  う: [
    { kana: "うみ", kanji: "海", romaji: "umi", meaning: { es: "mar", en: "sea" }, emoji: "🌊" },
    { kana: "うた", kanji: "歌", romaji: "uta", meaning: { es: "canción", en: "song" }, emoji: "🎵" },
    { kana: "うし", kanji: "牛", romaji: "ushi", meaning: { es: "vaca", en: "cow" }, emoji: "🐄" },
  ],
  え: [
    { kana: "えき", kanji: "駅", romaji: "eki", meaning: { es: "estación", en: "station" }, emoji: "🚉" },
    { kana: "え", kanji: "絵", romaji: "e", meaning: { es: "dibujo", en: "picture" }, emoji: "🖼️" },
    { kana: "えんぴつ", kanji: "鉛筆", romaji: "enpitsu", meaning: { es: "lápiz", en: "pencil" }, emoji: "✏️" },
  ],
  お: [
    { kana: "おんがく", kanji: "音楽", romaji: "ongaku", meaning: { es: "música", en: "music" }, emoji: "🎵" },
    { kana: "おかね", kanji: "お金", romaji: "okane", meaning: { es: "dinero", en: "money" }, emoji: "💰" },
    { kana: "おとうと", kanji: "弟", romaji: "otouto", meaning: { es: "hermano menor", en: "younger brother" }, emoji: "👦" },
  ],
  // か
  か: [
    { kana: "かさ", kanji: "傘", romaji: "kasa", meaning: { es: "paraguas", en: "umbrella" }, emoji: "☂️" },
    { kana: "かお", kanji: "顔", romaji: "kao", meaning: { es: "cara", en: "face" }, emoji: "😊" },
    { kana: "かみ", kanji: "紙", romaji: "kami", meaning: { es: "papel", en: "paper" }, emoji: "📄" },
  ],
  き: [
    { kana: "き", kanji: "木", romaji: "ki", meaning: { es: "árbol", en: "tree" }, emoji: "🌳" },
    { kana: "きん", kanji: "金", romaji: "kin", meaning: { es: "oro", en: "gold" }, emoji: "🏅" },
    { kana: "きつね", kanji: "狐", romaji: "kitsune", meaning: { es: "zorro", en: "fox" }, emoji: "🦊" },
  ],
  く: [
    { kana: "くるま", kanji: "車", romaji: "kuruma", meaning: { es: "coche", en: "car" }, emoji: "🚗" },
    { kana: "くつ", kanji: "靴", romaji: "kutsu", meaning: { es: "zapato", en: "shoe" }, emoji: "👞" },
    { kana: "くも", kanji: "雲", romaji: "kumo", meaning: { es: "nube", en: "cloud" }, emoji: "☁️" },
  ],
  け: [
    { kana: "けが", kanji: "怪我", romaji: "kega", meaning: { es: "herida", en: "injury" }, emoji: "🤕" },
    { kana: "けいたい", kanji: "携帯", romaji: "keitai", meaning: { es: "celular", en: "mobile phone" }, emoji: "📱" },
    { kana: "けさ", kanji: "今朝", romaji: "kesa", meaning: { es: "esta mañana", en: "this morning" }, emoji: "🌄" },
  ],
  こ: [
    { kana: "こおり", kanji: "氷", romaji: "koori", meaning: { es: "hielo", en: "ice" }, emoji: "🧊" },
    { kana: "こえ", kanji: "声", romaji: "koe", meaning: { es: "voz", en: "voice" }, emoji: "🗣️" },
    { kana: "こども", kanji: "子供", romaji: "kodomo", meaning: { es: "niño/a", en: "child" }, emoji: "👶" },
  ],
  // さ
  さ: [
    { kana: "さかな", kanji: "魚", romaji: "sakana", meaning: { es: "pez", en: "fish" }, emoji: "🐟" },
    { kana: "さくら", kanji: "桜", romaji: "sakura", meaning: { es: "cerezo", en: "cherry blossom" }, emoji: "🌸" },
    { kana: "さむい", kanji: "寒い", romaji: "samui", meaning: { es: "frío", en: "cold" }, emoji: "🥶" },
  ],
  し: [
    { kana: "しろ", kanji: "白", romaji: "shiro", meaning: { es: "blanco", en: "white" }, emoji: "⚪" },
    { kana: "しお", kanji: "塩", romaji: "shio", meaning: { es: "sal", en: "salt" }, emoji: "🧂" },
    { kana: "しま", kanji: "島", romaji: "shima", meaning: { es: "isla", en: "island" }, emoji: "🏝️" },
  ],
  す: [
    { kana: "すし", kanji: "寿司", romaji: "sushi", meaning: { es: "sushi", en: "sushi" }, emoji: "🍣" },
    { kana: "すき", kanji: "好き", romaji: "suki", meaning: { es: "que gusta", en: "liked / fond of" }, emoji: "💖" },
    { kana: "すずめ", kanji: "雀", romaji: "suzume", meaning: { es: "gorrión", en: "sparrow" }, emoji: "🐦" },
  ],
  せ: [
    { kana: "せかい", kanji: "世界", romaji: "sekai", meaning: { es: "mundo", en: "world" }, emoji: "🌍" },
    { kana: "せんせい", kanji: "先生", romaji: "sensei", meaning: { es: "profesor/a", en: "teacher" }, emoji: "🍎" },
    { kana: "せいと", kanji: "生徒", romaji: "seito", meaning: { es: "estudiante", en: "student" }, emoji: "🎒" },
  ],
  そ: [
    { kana: "そら", kanji: "空", romaji: "sora", meaning: { es: "cielo", en: "sky" }, emoji: "☁️" },
    { kana: "そふ", kanji: "祖父", romaji: "sofu", meaning: { es: "abuelo", en: "grandfather" }, emoji: "👴" },
    { kana: "そぼ", kanji: "祖母", romaji: "sobo", meaning: { es: "abuela", en: "grandmother" }, emoji: "👵" },
  ],
  // た
  た: [
    { kana: "たいよう", kanji: "太陽", romaji: "taiyou", meaning: { es: "sol", en: "sun" }, emoji: "☀️" },
    { kana: "たべもの", kanji: "食べ物", romaji: "tabemono", meaning: { es: "comida", en: "food" }, emoji: "🍽️" },
    { kana: "たのしい", kanji: "楽しい", romaji: "tanoshii", meaning: { es: "divertido", en: "fun" }, emoji: "😄" },
  ],
  ち: [
    { kana: "ちず", kanji: "地図", romaji: "chizu", meaning: { es: "mapa", en: "map" }, emoji: "🗺️" },
    { kana: "ちち", kanji: "父", romaji: "chichi", meaning: { es: "padre", en: "father" }, emoji: "👨" },
    { kana: "ちいさい", kanji: "小さい", romaji: "chiisai", meaning: { es: "pequeño", en: "small" }, emoji: "🤏" },
  ],
  つ: [
    { kana: "つき", kanji: "月", romaji: "tsuki", meaning: { es: "luna", en: "moon" }, emoji: "🌙" },
    { kana: "つくえ", kanji: "机", romaji: "tsukue", meaning: { es: "escritorio", en: "desk" }, emoji: "🪑" },
    { kana: "つゆ", kanji: "梅雨", romaji: "tsuyu", meaning: { es: "temporada de lluvias", en: "rainy season" }, emoji: "☔" },
  ],
  て: [
    { kana: "てがみ", kanji: "手紙", romaji: "tegami", meaning: { es: "carta", en: "letter" }, emoji: "✉️" },
    { kana: "て", kanji: "手", romaji: "te", meaning: { es: "mano", en: "hand" }, emoji: "✋" },
    { kana: "てんき", kanji: "天気", romaji: "tenki", meaning: { es: "clima", en: "weather" }, emoji: "🌤️" },
  ],
  と: [
    { kana: "とり", kanji: "鳥", romaji: "tori", meaning: { es: "pájaro", en: "bird" }, emoji: "🐦" },
    { kana: "とけい", kanji: "時計", romaji: "tokei", meaning: { es: "reloj", en: "clock" }, emoji: "🕐" },
    { kana: "とし", kanji: "年", romaji: "toshi", meaning: { es: "año / edad", en: "year / age" }, emoji: "🎂" },
  ],
  // な
  な: [
    { kana: "なつ", kanji: "夏", romaji: "natsu", meaning: { es: "verano", en: "summer" }, emoji: "🏖️" },
    { kana: "なまえ", kanji: "名前", romaji: "namae", meaning: { es: "nombre", en: "name" }, emoji: "📛" },
    { kana: "なか", kanji: "中", romaji: "naka", meaning: { es: "dentro", en: "inside" }, emoji: "📦" },
  ],
  に: [
    { kana: "にく", kanji: "肉", romaji: "niku", meaning: { es: "carne", en: "meat" }, emoji: "🍖" },
    { kana: "にほん", kanji: "日本", romaji: "nihon", meaning: { es: "Japón", en: "Japan" }, emoji: "🇯🇵" },
    { kana: "にわ", kanji: "庭", romaji: "niwa", meaning: { es: "jardín", en: "garden" }, emoji: "🏡" },
  ],
  ぬ: [
    { kana: "ぬの", kanji: "布", romaji: "nuno", meaning: { es: "tela", en: "cloth" }, emoji: "🧵" },
    { kana: "ぬるい", romaji: "nurui", meaning: { es: "tibio", en: "lukewarm" }, emoji: "🌡️" },
    { kana: "ぬぐ", kanji: "脱ぐ", romaji: "nugu", meaning: { es: "quitarse (ropa)", en: "to take off (clothes)" }, emoji: "🧥" },
  ],
  ね: [
    { kana: "ねこ", kanji: "猫", romaji: "neko", meaning: { es: "gato", en: "cat" }, emoji: "🐱" },
    { kana: "ねだん", kanji: "値段", romaji: "nedan", meaning: { es: "precio", en: "price" }, emoji: "💰" },
    { kana: "ねむい", kanji: "眠い", romaji: "nemui", meaning: { es: "soñoliento", en: "sleepy" }, emoji: "😴" },
  ],
  の: [
    { kana: "のり", kanji: "海苔", romaji: "nori", meaning: { es: "alga nori", en: "seaweed" }, emoji: "🍙" },
    { kana: "のみもの", kanji: "飲み物", romaji: "nomimono", meaning: { es: "bebida", en: "drink" }, emoji: "🥤" },
    { kana: "のる", kanji: "乗る", romaji: "noru", meaning: { es: "subir (a un vehículo)", en: "to ride / board" }, emoji: "🚌" },
  ],
  // は
  は: [
    { kana: "はな", kanji: "花", romaji: "hana", meaning: { es: "flor", en: "flower" }, emoji: "🌸" },
    { kana: "はし", kanji: "橋", romaji: "hashi", meaning: { es: "puente", en: "bridge" }, emoji: "🌉" },
    { kana: "はれ", kanji: "晴れ", romaji: "hare", meaning: { es: "despejado (clima)", en: "clear weather" }, emoji: "🌞" },
  ],
  ひ: [
    { kana: "ひ", kanji: "火", romaji: "hi", meaning: { es: "fuego", en: "fire" }, emoji: "🔥" },
    { kana: "ひだり", kanji: "左", romaji: "hidari", meaning: { es: "izquierda", en: "left" }, emoji: "⬅️" },
    { kana: "ひこうき", kanji: "飛行機", romaji: "hikouki", meaning: { es: "avión", en: "airplane" }, emoji: "✈️" },
  ],
  ふ: [
    { kana: "ふね", kanji: "船", romaji: "fune", meaning: { es: "barco", en: "boat" }, emoji: "⛵" },
    { kana: "ふゆ", kanji: "冬", romaji: "fuyu", meaning: { es: "invierno", en: "winter" }, emoji: "❄️" },
    { kana: "ふとん", kanji: "布団", romaji: "futon", meaning: { es: "futón", en: "futon (bedding)" }, emoji: "🛏️" },
  ],
  へ: [
    { kana: "へや", kanji: "部屋", romaji: "heya", meaning: { es: "habitación", en: "room" }, emoji: "🚪" },
    { kana: "へん", kanji: "変", romaji: "hen", meaning: { es: "raro", en: "strange" }, emoji: "🤔" },
    { kana: "へた", kanji: "下手", romaji: "heta", meaning: { es: "torpe (en algo)", en: "unskilled (at something)" }, emoji: "🙈" },
  ],
  ほ: [
    { kana: "ほし", kanji: "星", romaji: "hoshi", meaning: { es: "estrella", en: "star" }, emoji: "⭐" },
    { kana: "ほん", kanji: "本", romaji: "hon", meaning: { es: "libro", en: "book" }, emoji: "📖" },
    { kana: "ほしい", kanji: "欲しい", romaji: "hoshii", meaning: { es: "querer (algo)", en: "to want (something)" }, emoji: "🙏" },
  ],
  // ま
  ま: [
    { kana: "まど", kanji: "窓", romaji: "mado", meaning: { es: "ventana", en: "window" }, emoji: "🪟" },
    { kana: "まち", kanji: "町", romaji: "machi", meaning: { es: "ciudad", en: "town" }, emoji: "🏘️" },
    { kana: "まつり", kanji: "祭り", romaji: "matsuri", meaning: { es: "festival", en: "festival" }, emoji: "🎆" },
  ],
  み: [
    { kana: "みず", kanji: "水", romaji: "mizu", meaning: { es: "agua", en: "water" }, emoji: "💧" },
    { kana: "みみ", kanji: "耳", romaji: "mimi", meaning: { es: "oreja", en: "ear" }, emoji: "👂" },
    { kana: "みち", kanji: "道", romaji: "michi", meaning: { es: "camino", en: "road" }, emoji: "🛣️" },
  ],
  む: [
    { kana: "むし", kanji: "虫", romaji: "mushi", meaning: { es: "insecto", en: "insect" }, emoji: "🐛" },
    { kana: "むら", kanji: "村", romaji: "mura", meaning: { es: "pueblo", en: "village" }, emoji: "🏡" },
    { kana: "むずかしい", kanji: "難しい", romaji: "muzukashii", meaning: { es: "difícil", en: "difficult" }, emoji: "😖" },
  ],
  め: [
    { kana: "め", kanji: "目", romaji: "me", meaning: { es: "ojo", en: "eye" }, emoji: "👁️" },
    { kana: "めがね", kanji: "眼鏡", romaji: "megane", meaning: { es: "anteojos", en: "glasses" }, emoji: "👓" },
    { kana: "めずらしい", kanji: "珍しい", romaji: "mezurashii", meaning: { es: "raro / poco común", en: "rare / unusual" }, emoji: "🦄" },
  ],
  も: [
    { kana: "もり", kanji: "森", romaji: "mori", meaning: { es: "bosque", en: "forest" }, emoji: "🌲" },
    { kana: "もの", kanji: "物", romaji: "mono", meaning: { es: "cosa", en: "thing" }, emoji: "📦" },
    { kana: "もち", kanji: "餅", romaji: "mochi", meaning: { es: "mochi (pastel de arroz)", en: "mochi (rice cake)" }, emoji: "🍡" },
  ],
  // や
  や: [
    { kana: "やま", kanji: "山", romaji: "yama", meaning: { es: "montaña", en: "mountain" }, emoji: "⛰️" },
    { kana: "やさい", kanji: "野菜", romaji: "yasai", meaning: { es: "verdura", en: "vegetable" }, emoji: "🥦" },
    { kana: "やすみ", kanji: "休み", romaji: "yasumi", meaning: { es: "descanso", en: "rest / day off" }, emoji: "🛌" },
  ],
  ゆ: [
    { kana: "ゆき", kanji: "雪", romaji: "yuki", meaning: { es: "nieve", en: "snow" }, emoji: "❄️" },
    { kana: "ゆうべ", kanji: "夕べ", romaji: "yuube", meaning: { es: "anoche", en: "last night" }, emoji: "🌃" },
    { kana: "ゆび", kanji: "指", romaji: "yubi", meaning: { es: "dedo", en: "finger" }, emoji: "☝️" },
  ],
  よ: [
    { kana: "よる", kanji: "夜", romaji: "yoru", meaning: { es: "noche", en: "night" }, emoji: "🌃" },
    { kana: "ようふく", kanji: "洋服", romaji: "youfuku", meaning: { es: "ropa", en: "clothes" }, emoji: "👕" },
    { kana: "よやく", kanji: "予約", romaji: "yoyaku", meaning: { es: "reserva", en: "reservation" }, emoji: "📅" },
  ],
  // ら
  ら: [
    { kana: "らくだ", romaji: "rakuda", meaning: { es: "camello", en: "camel" }, emoji: "🐪" },
    { kana: "らいねん", kanji: "来年", romaji: "rainen", meaning: { es: "el próximo año", en: "next year" }, emoji: "📆" },
    { kana: "らく", kanji: "楽", romaji: "raku", meaning: { es: "fácil / cómodo", en: "easy / comfortable" }, emoji: "😌" },
  ],
  り: [
    { kana: "りんご", romaji: "ringo", meaning: { es: "manzana", en: "apple" }, emoji: "🍎" },
    { kana: "りゆう", kanji: "理由", romaji: "riyuu", meaning: { es: "razón", en: "reason" }, emoji: "🤔" },
    { kana: "りく", kanji: "陸", romaji: "riku", meaning: { es: "tierra firme", en: "land" }, emoji: "🏝️" },
  ],
  // る: fila genuinamente escasa en vocabulario nativo — 2 ejemplos
  // reales en vez de forzar un tercero dudoso.
  る: [
    { kana: "るす", kanji: "留守", romaji: "rusu", meaning: { es: "ausente (fuera de casa)", en: "away from home" }, emoji: "🚪" },
    { kana: "るいじ", kanji: "類似", romaji: "ruiji", meaning: { es: "similitud", en: "similarity" }, emoji: "🔗" },
  ],
  れ: [
    { kana: "れいぞうこ", kanji: "冷蔵庫", romaji: "reizouko", meaning: { es: "refrigerador", en: "refrigerator" }, emoji: "🧊" },
    { kana: "れきし", kanji: "歴史", romaji: "rekishi", meaning: { es: "historia", en: "history" }, emoji: "📜" },
    { kana: "れんしゅう", kanji: "練習", romaji: "renshuu", meaning: { es: "práctica", en: "practice" }, emoji: "📝" },
  ],
  ろ: [
    { kana: "ろうそく", romaji: "rousoku", meaning: { es: "vela", en: "candle" }, emoji: "🕯️" },
    { kana: "ろくがつ", kanji: "六月", romaji: "rokugatsu", meaning: { es: "junio", en: "June" }, emoji: "📅" },
    { kana: "ろうか", kanji: "廊下", romaji: "rouka", meaning: { es: "pasillo", en: "hallway" }, emoji: "🚪" },
  ],
  // わ
  わ: [
    { kana: "わに", romaji: "wani", meaning: { es: "cocodrilo", en: "crocodile" }, emoji: "🐊" },
    { kana: "わたし", kanji: "私", romaji: "watashi", meaning: { es: "yo", en: "I / me" }, emoji: "🙋" },
    { kana: "わらう", kanji: "笑う", romaji: "warau", meaning: { es: "reír", en: "to laugh" }, emoji: "😄" },
  ],

  // ---- Katakana: filas ア-ソ ampliadas de 1 a 2-3 ejemplos; el resto de
  // filas (タ en adelante) suma cobertura nueva por primera vez, con
  // menos ejemplos en las filas con menos préstamos reales conocidos
  // (ヌ, ヤ) en vez de forzar palabras inventadas o dudosas. ---
  ア: [
    { kana: "アイス", romaji: "aisu", meaning: { es: "helado", en: "ice cream" }, emoji: "🍦" },
    { kana: "アルバイト", romaji: "arubaito", meaning: { es: "trabajo a tiempo parcial", en: "part-time job" }, emoji: "💼" },
    { kana: "アパート", romaji: "apaato", meaning: { es: "apartamento", en: "apartment" }, emoji: "🏢" },
  ],
  イ: [
    { kana: "インク", romaji: "inku", meaning: { es: "tinta", en: "ink" }, emoji: "🖋️" },
    { kana: "インフルエンザ", romaji: "infuruenza", meaning: { es: "gripe", en: "influenza" }, emoji: "🤒" },
    { kana: "イヤホン", romaji: "iyahon", meaning: { es: "audífonos", en: "earphones" }, emoji: "🎧" },
  ],
  ウ: [
    { kana: "ウール", romaji: "uuru", meaning: { es: "lana", en: "wool" }, emoji: "🧶" },
    { kana: "ウイスキー", romaji: "uisukii", meaning: { es: "whisky", en: "whiskey" }, emoji: "🥃" },
    { kana: "ウインドウ", romaji: "uindou", meaning: { es: "ventana (informática)", en: "window (computer)" }, emoji: "🖥️" },
  ],
  エ: [
    { kana: "エアコン", romaji: "eakon", meaning: { es: "aire acondicionado", en: "air conditioner" }, emoji: "❄️" },
    { kana: "エレベーター", romaji: "erebeetaa", meaning: { es: "ascensor", en: "elevator" }, emoji: "🛗" },
    { kana: "エンジン", romaji: "enjin", meaning: { es: "motor", en: "engine" }, emoji: "🔧" },
  ],
  オ: [
    { kana: "オレンジ", romaji: "orenji", meaning: { es: "naranja", en: "orange" }, emoji: "🍊" },
    { kana: "オーブン", romaji: "oobun", meaning: { es: "horno", en: "oven" }, emoji: "🍞" },
    { kana: "オフィス", romaji: "ofisu", meaning: { es: "oficina", en: "office" }, emoji: "🏢" },
  ],
  カ: [
    { kana: "カメラ", romaji: "kamera", meaning: { es: "cámara", en: "camera" }, emoji: "📷" },
    { kana: "カレンダー", romaji: "karendaa", meaning: { es: "calendario", en: "calendar" }, emoji: "📅" },
    { kana: "カード", romaji: "kaado", meaning: { es: "tarjeta", en: "card" }, emoji: "💳" },
  ],
  キ: [
    { kana: "キリン", romaji: "kirin", meaning: { es: "jirafa", en: "giraffe" }, emoji: "🦒" },
    { kana: "キッチン", romaji: "kicchin", meaning: { es: "cocina", en: "kitchen" }, emoji: "🍳" },
    { kana: "キス", romaji: "kisu", meaning: { es: "beso", en: "kiss" }, emoji: "💋" },
  ],
  ク: [
    { kana: "クラス", romaji: "kurasu", meaning: { es: "clase", en: "class" }, emoji: "🏫" },
    { kana: "クリスマス", romaji: "kurisumasu", meaning: { es: "Navidad", en: "Christmas" }, emoji: "🎄" },
    { kana: "クッキー", romaji: "kukkii", meaning: { es: "galleta", en: "cookie" }, emoji: "🍪" },
  ],
  ケ: [
    { kana: "ケーキ", romaji: "keeki", meaning: { es: "pastel", en: "cake" }, emoji: "🍰" },
    { kana: "ケチャップ", romaji: "kechappu", meaning: { es: "ketchup", en: "ketchup" }, emoji: "🍅" },
    { kana: "ケア", romaji: "kea", meaning: { es: "cuidado", en: "care" }, emoji: "💆" },
  ],
  コ: [
    { kana: "コーヒー", romaji: "koohii", meaning: { es: "café", en: "coffee" }, emoji: "☕" },
    { kana: "コンビニ", romaji: "konbini", meaning: { es: "tienda de conveniencia", en: "convenience store" }, emoji: "🏪" },
    { kana: "コンピューター", romaji: "konpyuutaa", meaning: { es: "computadora", en: "computer" }, emoji: "💻" },
  ],
  サ: [
    { kana: "サラダ", romaji: "sarada", meaning: { es: "ensalada", en: "salad" }, emoji: "🥗" },
    { kana: "サイン", romaji: "sain", meaning: { es: "firma / autógrafo", en: "signature / autograph" }, emoji: "✍️" },
    { kana: "サイズ", romaji: "saizu", meaning: { es: "talla", en: "size" }, emoji: "📏" },
  ],
  シ: [
    { kana: "シャツ", romaji: "shatsu", meaning: { es: "camisa", en: "shirt" }, emoji: "👕" },
    { kana: "シャワー", romaji: "shawaa", meaning: { es: "ducha", en: "shower" }, emoji: "🚿" },
    { kana: "シーン", romaji: "shiin", meaning: { es: "escena", en: "scene" }, emoji: "🎬" },
  ],
  ス: [
    { kana: "スープ", romaji: "suupu", meaning: { es: "sopa", en: "soup" }, emoji: "🍲" },
    { kana: "スカート", romaji: "sukaato", meaning: { es: "falda", en: "skirt" }, emoji: "👗" },
    { kana: "スーパー", romaji: "suupaa", meaning: { es: "supermercado", en: "supermarket" }, emoji: "🛒" },
  ],
  セ: [
    { kana: "セーター", romaji: "seetaa", meaning: { es: "suéter", en: "sweater" }, emoji: "🧥" },
    { kana: "セット", romaji: "setto", meaning: { es: "conjunto", en: "set" }, emoji: "📦" },
    { kana: "センター", romaji: "sentaa", meaning: { es: "centro", en: "center" }, emoji: "🎯" },
  ],
  ソ: [
    { kana: "ソース", romaji: "soosu", meaning: { es: "salsa", en: "sauce" }, emoji: "🥫" },
    { kana: "ソファ", romaji: "sofa", meaning: { es: "sofá", en: "sofa" }, emoji: "🛋️" },
    { kana: "ソックス", romaji: "sokkusu", meaning: { es: "calcetines", en: "socks" }, emoji: "🧦" },
  ],
  タ: [
    { kana: "タオル", romaji: "taoru", meaning: { es: "toalla", en: "towel" }, emoji: "🛁" },
    { kana: "タクシー", romaji: "takushii", meaning: { es: "taxi", en: "taxi" }, emoji: "🚕" },
  ],
  チ: [
    { kana: "チーズ", romaji: "chiizu", meaning: { es: "queso", en: "cheese" }, emoji: "🧀" },
    { kana: "チケット", romaji: "chiketto", meaning: { es: "boleto", en: "ticket" }, emoji: "🎫" },
  ],
  // ツ: pocos préstamos comunes empiezan con este sonido.
  ツ: [
    { kana: "ツアー", romaji: "tsuaa", meaning: { es: "tour", en: "tour" }, emoji: "🧳" },
  ],
  テ: [
    { kana: "テレビ", romaji: "terebi", meaning: { es: "televisión", en: "television" }, emoji: "📺" },
    { kana: "テスト", romaji: "tesuto", meaning: { es: "examen", en: "test" }, emoji: "📝" },
  ],
  ト: [
    { kana: "トマト", romaji: "tomato", meaning: { es: "tomate", en: "tomato" }, emoji: "🍅" },
    { kana: "トイレ", romaji: "toire", meaning: { es: "baño", en: "toilet" }, emoji: "🚽" },
  ],
  ナ: [
    { kana: "ナイフ", romaji: "naifu", meaning: { es: "cuchillo", en: "knife" }, emoji: "🔪" },
    { kana: "ナプキン", romaji: "napukin", meaning: { es: "servilleta", en: "napkin" }, emoji: "🧻" },
  ],
  ニ: [
    { kana: "ニュース", romaji: "nyuusu", meaning: { es: "noticias", en: "news" }, emoji: "📰" },
    { kana: "ニット", romaji: "nitto", meaning: { es: "tejido de punto", en: "knitwear" }, emoji: "🧶" },
  ],
  // ヌ: fila con muy pocos préstamos reales — 1 ejemplo real en vez de
  // forzar un segundo dudoso.
  ヌ: [
    { kana: "ヌードル", romaji: "nuudoru", meaning: { es: "fideos", en: "noodles" }, emoji: "🍜" },
  ],
  ネ: [
    { kana: "ネクタイ", romaji: "nekutai", meaning: { es: "corbata", en: "necktie" }, emoji: "👔" },
    { kana: "ネット", romaji: "netto", meaning: { es: "internet / red", en: "net / internet" }, emoji: "🌐" },
  ],
  ノ: [
    { kana: "ノート", romaji: "nooto", meaning: { es: "cuaderno", en: "notebook" }, emoji: "📓" },
    { kana: "ノック", romaji: "nokku", meaning: { es: "tocar (la puerta)", en: "knock" }, emoji: "🚪" },
  ],
  ハ: [
    { kana: "ハンバーガー", romaji: "hanbaagaa", meaning: { es: "hamburguesa", en: "hamburger" }, emoji: "🍔" },
    { kana: "ハート", romaji: "haato", meaning: { es: "corazón", en: "heart" }, emoji: "❤️" },
  ],
  ヒ: [
    { kana: "ヒーロー", romaji: "hiiroo", meaning: { es: "héroe", en: "hero" }, emoji: "🦸" },
    { kana: "ヒント", romaji: "hinto", meaning: { es: "pista", en: "hint" }, emoji: "💡" },
  ],
  フ: [
    { kana: "フォーク", romaji: "fooku", meaning: { es: "tenedor", en: "fork" }, emoji: "🍴" },
    { kana: "フルーツ", romaji: "furuutsu", meaning: { es: "fruta", en: "fruit" }, emoji: "🍎" },
  ],
  ヘ: [
    { kana: "ヘリコプター", romaji: "herikoputaa", meaning: { es: "helicóptero", en: "helicopter" }, emoji: "🚁" },
    { kana: "ヘッドホン", romaji: "heddohon", meaning: { es: "audífonos", en: "headphones" }, emoji: "🎧" },
  ],
  ホ: [
    { kana: "ホテル", romaji: "hoteru", meaning: { es: "hotel", en: "hotel" }, emoji: "🏨" },
    { kana: "ホーム", romaji: "hoomu", meaning: { es: "andén (estación)", en: "platform (station)" }, emoji: "🚉" },
  ],
  マ: [
    { kana: "マスク", romaji: "masuku", meaning: { es: "mascarilla", en: "mask" }, emoji: "😷" },
    { kana: "マンション", romaji: "manshon", meaning: { es: "apartamento (edificio)", en: "apartment (condo)" }, emoji: "🏢" },
  ],
  ミ: [
    { kana: "ミルク", romaji: "miruku", meaning: { es: "leche", en: "milk" }, emoji: "🥛" },
    { kana: "ミュージック", romaji: "myuujikku", meaning: { es: "música", en: "music" }, emoji: "🎵" },
  ],
  // ム: fila con pocos préstamos reales frecuentes.
  ム: [
    { kana: "ムード", romaji: "muudo", meaning: { es: "ambiente", en: "mood" }, emoji: "🌙" },
  ],
  メ: [
    { kana: "メニュー", romaji: "menyuu", meaning: { es: "menú", en: "menu" }, emoji: "📋" },
    { kana: "メール", romaji: "meeru", meaning: { es: "correo electrónico", en: "email" }, emoji: "📧" },
  ],
  モ: [
    { kana: "モデル", romaji: "moderu", meaning: { es: "modelo", en: "model" }, emoji: "💃" },
    { kana: "モーター", romaji: "mootaa", meaning: { es: "motor", en: "motor" }, emoji: "⚙️" },
  ],
  // ヤ: fila con muy pocos préstamos reales — 1 ejemplo.
  ヤ: [
    { kana: "ヤード", romaji: "yaado", meaning: { es: "yarda (medida)", en: "yard (unit)" }, emoji: "📏" },
  ],
  ユ: [
    { kana: "ユーモア", romaji: "yuumoa", meaning: { es: "humor", en: "humor" }, emoji: "😄" },
    { kana: "ユニフォーム", romaji: "yunifoomu", meaning: { es: "uniforme", en: "uniform" }, emoji: "👕" },
  ],
  ヨ: [
    { kana: "ヨーグルト", romaji: "yooguruto", meaning: { es: "yogur", en: "yogurt" }, emoji: "🥣" },
    { kana: "ヨット", romaji: "yotto", meaning: { es: "velero", en: "yacht / sailboat" }, emoji: "⛵" },
  ],
  ラ: [
    { kana: "ラジオ", romaji: "rajio", meaning: { es: "radio", en: "radio" }, emoji: "📻" },
    { kana: "ラーメン", romaji: "raamen", meaning: { es: "ramen", en: "ramen noodles" }, emoji: "🍜" },
  ],
  リ: [
    { kana: "リボン", romaji: "ribon", meaning: { es: "listón", en: "ribbon" }, emoji: "🎀" },
    { kana: "リズム", romaji: "rizumu", meaning: { es: "ritmo", en: "rhythm" }, emoji: "🎵" },
  ],
  // ル: fila con pocos préstamos reales frecuentes.
  ル: [
    { kana: "ルール", romaji: "ruuru", meaning: { es: "regla", en: "rule" }, emoji: "📏" },
  ],
  レ: [
    { kana: "レストラン", romaji: "resutoran", meaning: { es: "restaurante", en: "restaurant" }, emoji: "🍽️" },
    { kana: "レモン", romaji: "remon", meaning: { es: "limón", en: "lemon" }, emoji: "🍋" },
  ],
  ロ: [
    { kana: "ロボット", romaji: "robotto", meaning: { es: "robot", en: "robot" }, emoji: "🤖" },
    { kana: "ロープ", romaji: "roopu", meaning: { es: "cuerda", en: "rope" }, emoji: "🪢" },
  ],
  ワ: [
    { kana: "ワイン", romaji: "wain", meaning: { es: "vino", en: "wine" }, emoji: "🍷" },
    { kana: "ワッフル", romaji: "waffuru", meaning: { es: "waffle", en: "waffle" }, emoji: "🧇" },
  ],
};

// ---------------------------------------------------
// Vocabulario N5 por CATEGORÍA TEMÁTICA — distinto de JP_VOCAB de arriba
// (que son ejemplos ligados a un kana puntual, para la práctica de
// pronunciación de ESE carácter). Este es el vocabulario "de currícula"
// pedido explícito: saludos, números, tiempo, familia, verbos básicos,
// etc., navegable por categoría independiente de qué kana se esté
// estudiando. `kanji: null` en las palabras que en uso real N5 se
// escriben normalmente en kana puro (la mayoría de los saludos) — se
// omite el kanji a propósito en vez de forzar uno técnicamente válido
// pero raro en la práctica cotidiana, mismo criterio ya usado en
// JP_VOCAB.
// ---------------------------------------------------
const N5_VOCAB_CATEGORIES = [
  {
    id: "greetings",
    icon: "👋",
    titleKey: "n5CatGreetings",
    words: [
      { kana: "おはようございます", kanji: null, romaji: "ohayou gozaimasu", meaning: { es: "buenos días", en: "good morning" } },
      { kana: "こんにちは", kanji: null, romaji: "konnichiwa", meaning: { es: "hola / buenas tardes", en: "hello / good afternoon" } },
      { kana: "こんばんは", kanji: null, romaji: "konbanwa", meaning: { es: "buenas noches (saludo)", en: "good evening" } },
      { kana: "さようなら", kanji: null, romaji: "sayounara", meaning: { es: "adiós", en: "goodbye" } },
      { kana: "おやすみなさい", kanji: null, romaji: "oyasuminasai", meaning: { es: "buenas noches (al dormir)", en: "good night" } },
      { kana: "ありがとうございます", kanji: null, romaji: "arigatou gozaimasu", meaning: { es: "muchas gracias", en: "thank you" } },
      { kana: "すみません", kanji: null, romaji: "sumimasen", meaning: { es: "disculpe / lo siento", en: "excuse me / sorry" } },
      { kana: "はじめまして", kanji: null, romaji: "hajimemashite", meaning: { es: "mucho gusto", en: "nice to meet you" } },
      { kana: "おげんきですか", kanji: "お元気ですか", romaji: "ogenki desu ka", meaning: { es: "¿cómo estás?", en: "how are you?" } },
      { kana: "いただきます", kanji: null, romaji: "itadakimasu", meaning: { es: "(antes de comer)", en: "(before eating)" } },
      { kana: "ごちそうさまでした", kanji: null, romaji: "gochisousama deshita", meaning: { es: "(después de comer)", en: "(after eating)" } },
      { kana: "いってきます", kanji: null, romaji: "ittekimasu", meaning: { es: "ya vuelvo / me voy", en: "I'm off (I'll be back)" } },
    ],
  },
  {
    id: "numbers",
    icon: "🔢",
    titleKey: "n5CatNumbers",
    words: [
      { kana: "ゼロ / れい", kanji: "零", romaji: "zero / rei", meaning: { es: "cero", en: "zero" } },
      { kana: "いち", kanji: "一", romaji: "ichi", meaning: { es: "uno", en: "one" } },
      { kana: "に", kanji: "二", romaji: "ni", meaning: { es: "dos", en: "two" } },
      { kana: "さん", kanji: "三", romaji: "san", meaning: { es: "tres", en: "three" } },
      { kana: "よん / し", kanji: "四", romaji: "yon / shi", meaning: { es: "cuatro", en: "four" } },
      { kana: "ご", kanji: "五", romaji: "go", meaning: { es: "cinco", en: "five" } },
      { kana: "ろく", kanji: "六", romaji: "roku", meaning: { es: "seis", en: "six" } },
      { kana: "なな / しち", kanji: "七", romaji: "nana / shichi", meaning: { es: "siete", en: "seven" } },
      { kana: "はち", kanji: "八", romaji: "hachi", meaning: { es: "ocho", en: "eight" } },
      { kana: "きゅう", kanji: "九", romaji: "kyuu", meaning: { es: "nueve", en: "nine" } },
      { kana: "じゅう", kanji: "十", romaji: "juu", meaning: { es: "diez", en: "ten" } },
      { kana: "にじゅう", kanji: "二十", romaji: "nijuu", meaning: { es: "veinte", en: "twenty" } },
      { kana: "ひゃく", kanji: "百", romaji: "hyaku", meaning: { es: "cien", en: "one hundred" } },
      { kana: "せん", kanji: "千", romaji: "sen", meaning: { es: "mil", en: "one thousand" } },
    ],
  },
  {
    id: "time",
    icon: "🕐",
    titleKey: "n5CatTime",
    words: [
      { kana: "きょう", kanji: "今日", romaji: "kyou", meaning: { es: "hoy", en: "today" } },
      { kana: "あした", kanji: "明日", romaji: "ashita", meaning: { es: "mañana", en: "tomorrow" } },
      { kana: "きのう", kanji: "昨日", romaji: "kinou", meaning: { es: "ayer", en: "yesterday" } },
      { kana: "いま", kanji: "今", romaji: "ima", meaning: { es: "ahora", en: "now" } },
      { kana: "あさ", kanji: "朝", romaji: "asa", meaning: { es: "mañana (del día)", en: "morning" } },
      { kana: "ひる", kanji: "昼", romaji: "hiru", meaning: { es: "mediodía", en: "noon" } },
      { kana: "よる", kanji: "夜", romaji: "yoru", meaning: { es: "noche", en: "night" } },
      { kana: "しゅうまつ", kanji: "週末", romaji: "shuumatsu", meaning: { es: "fin de semana", en: "weekend" } },
      { kana: "まいにち", kanji: "毎日", romaji: "mainichi", meaning: { es: "todos los días", en: "every day" } },
      { kana: "なんじ", kanji: "何時", romaji: "nanji", meaning: { es: "¿qué hora?", en: "what time?" } },
      { kana: "せんしゅう", kanji: "先週", romaji: "senshuu", meaning: { es: "la semana pasada", en: "last week" } },
      { kana: "らいしゅう", kanji: "来週", romaji: "raishuu", meaning: { es: "la próxima semana", en: "next week" } },
    ],
  },
  {
    id: "family",
    icon: "👨‍👩‍👧",
    titleKey: "n5CatFamily",
    words: [
      { kana: "かぞく", kanji: "家族", romaji: "kazoku", meaning: { es: "familia", en: "family" } },
      { kana: "ちち", kanji: "父", romaji: "chichi", meaning: { es: "mi padre", en: "my father" } },
      { kana: "はは", kanji: "母", romaji: "haha", meaning: { es: "mi madre", en: "my mother" } },
      { kana: "おとうさん", kanji: "お父さん", romaji: "otousan", meaning: { es: "papá (de otro / formal)", en: "father (someone else's)" } },
      { kana: "おかあさん", kanji: "お母さん", romaji: "okaasan", meaning: { es: "mamá (de otro / formal)", en: "mother (someone else's)" } },
      { kana: "あに", kanji: "兄", romaji: "ani", meaning: { es: "hermano mayor", en: "older brother" } },
      { kana: "あね", kanji: "姉", romaji: "ane", meaning: { es: "hermana mayor", en: "older sister" } },
      { kana: "おとうと", kanji: "弟", romaji: "otouto", meaning: { es: "hermano menor", en: "younger brother" } },
      { kana: "いもうと", kanji: "妹", romaji: "imouto", meaning: { es: "hermana menor", en: "younger sister" } },
      { kana: "こども", kanji: "子供", romaji: "kodomo", meaning: { es: "niño / niña", en: "child" } },
      { kana: "つま", kanji: "妻", romaji: "tsuma", meaning: { es: "esposa", en: "wife" } },
      { kana: "おっと", kanji: "夫", romaji: "otto", meaning: { es: "esposo", en: "husband" } },
    ],
  },
  {
    id: "verbs",
    icon: "🏃",
    titleKey: "n5CatVerbs",
    words: [
      { kana: "たべます", kanji: "食べます", romaji: "tabemasu", meaning: { es: "comer", en: "to eat" } },
      { kana: "のみます", kanji: "飲みます", romaji: "nomimasu", meaning: { es: "beber", en: "to drink" } },
      { kana: "みます", kanji: "見ます", romaji: "mimasu", meaning: { es: "ver", en: "to see / watch" } },
      { kana: "ききます", kanji: "聞きます", romaji: "kikimasu", meaning: { es: "escuchar / preguntar", en: "to listen / ask" } },
      { kana: "はなします", kanji: "話します", romaji: "hanashimasu", meaning: { es: "hablar", en: "to speak" } },
      { kana: "よみます", kanji: "読みます", romaji: "yomimasu", meaning: { es: "leer", en: "to read" } },
      { kana: "かきます", kanji: "書きます", romaji: "kakimasu", meaning: { es: "escribir", en: "to write" } },
      { kana: "いきます", kanji: "行きます", romaji: "ikimasu", meaning: { es: "ir", en: "to go" } },
      { kana: "きます", kanji: "来ます", romaji: "kimasu", meaning: { es: "venir", en: "to come" } },
      { kana: "かえります", kanji: "帰ります", romaji: "kaerimasu", meaning: { es: "regresar", en: "to return / go home" } },
      { kana: "かいます", kanji: "買います", romaji: "kaimasu", meaning: { es: "comprar", en: "to buy" } },
      { kana: "あいます", kanji: "会います", romaji: "aimasu", meaning: { es: "encontrarse (con alguien)", en: "to meet" } },
      { kana: "します", kanji: null, romaji: "shimasu", meaning: { es: "hacer", en: "to do" } },
      { kana: "あります", kanji: null, romaji: "arimasu", meaning: { es: "haber (cosas/objetos)", en: "there is (objects)" } },
      { kana: "います", kanji: null, romaji: "imasu", meaning: { es: "haber (seres vivos)", en: "there is (living things)" } },
      { kana: "わかります", kanji: "分かります", romaji: "wakarimasu", meaning: { es: "entender", en: "to understand" } },
      { kana: "ねます", kanji: "寝ます", romaji: "nemasu", meaning: { es: "dormir", en: "to sleep" } },
      { kana: "おきます", kanji: "起きます", romaji: "okimasu", meaning: { es: "levantarse", en: "to wake up / get up" } },
    ],
  },
  {
    id: "colors",
    icon: "🎨",
    titleKey: "n5CatColors",
    words: [
      { kana: "あか", kanji: "赤", romaji: "aka", meaning: { es: "rojo", en: "red" } },
      { kana: "あお", kanji: "青", romaji: "ao", meaning: { es: "azul", en: "blue" } },
      { kana: "きいろ", kanji: "黄色", romaji: "kiiro", meaning: { es: "amarillo", en: "yellow" } },
      { kana: "みどり", kanji: "緑", romaji: "midori", meaning: { es: "verde", en: "green" } },
      { kana: "しろ", kanji: "白", romaji: "shiro", meaning: { es: "blanco", en: "white" } },
      { kana: "くろ", kanji: "黒", romaji: "kuro", meaning: { es: "negro", en: "black" } },
      { kana: "ちゃいろ", kanji: "茶色", romaji: "chairo", meaning: { es: "marrón", en: "brown" } },
      { kana: "ピンク", kanji: null, romaji: "pinku", meaning: { es: "rosa", en: "pink" } },
      { kana: "オレンジ", kanji: null, romaji: "orenji", meaning: { es: "naranja", en: "orange" } },
      { kana: "むらさき", kanji: "紫", romaji: "murasaki", meaning: { es: "morado", en: "purple" } },
    ],
  },
  {
    id: "food",
    icon: "🍙",
    titleKey: "n5CatFood",
    words: [
      { kana: "ごはん", kanji: "ご飯", romaji: "gohan", meaning: { es: "arroz / comida", en: "rice / meal" } },
      { kana: "パン", kanji: null, romaji: "pan", meaning: { es: "pan", en: "bread" } },
      { kana: "みず", kanji: "水", romaji: "mizu", meaning: { es: "agua", en: "water" } },
      { kana: "おちゃ", kanji: "お茶", romaji: "ocha", meaning: { es: "té", en: "tea" } },
      { kana: "さかな", kanji: "魚", romaji: "sakana", meaning: { es: "pescado", en: "fish" } },
      { kana: "にく", kanji: "肉", romaji: "niku", meaning: { es: "carne", en: "meat" } },
      { kana: "やさい", kanji: "野菜", romaji: "yasai", meaning: { es: "verdura", en: "vegetable" } },
      { kana: "くだもの", kanji: "果物", romaji: "kudamono", meaning: { es: "fruta", en: "fruit" } },
      { kana: "たまご", kanji: "卵", romaji: "tamago", meaning: { es: "huevo", en: "egg" } },
      { kana: "ぎゅうにゅう", kanji: "牛乳", romaji: "gyuunyuu", meaning: { es: "leche", en: "milk" } },
    ],
  },
  {
    id: "places",
    icon: "🏠",
    titleKey: "n5CatPlaces",
    words: [
      { kana: "いえ", kanji: "家", romaji: "ie", meaning: { es: "casa", en: "house" } },
      { kana: "がっこう", kanji: "学校", romaji: "gakkou", meaning: { es: "escuela", en: "school" } },
      { kana: "かいしゃ", kanji: "会社", romaji: "kaisha", meaning: { es: "empresa", en: "company" } },
      { kana: "えき", kanji: "駅", romaji: "eki", meaning: { es: "estación", en: "station" } },
      { kana: "びょういん", kanji: "病院", romaji: "byouin", meaning: { es: "hospital", en: "hospital" } },
      { kana: "みせ", kanji: "店", romaji: "mise", meaning: { es: "tienda", en: "store" } },
      { kana: "ぎんこう", kanji: "銀行", romaji: "ginkou", meaning: { es: "banco", en: "bank" } },
      { kana: "としょかん", kanji: "図書館", romaji: "toshokan", meaning: { es: "biblioteca", en: "library" } },
      { kana: "こうえん", kanji: "公園", romaji: "kouen", meaning: { es: "parque", en: "park" } },
      { kana: "トイレ", kanji: null, romaji: "toire", meaning: { es: "baño", en: "restroom" } },
      { kana: "へや", kanji: "部屋", romaji: "heya", meaning: { es: "habitación", en: "room" } },
    ],
  },
  {
    id: "adjectives",
    icon: "🎭",
    titleKey: "n5CatAdjectives",
    words: [
      { kana: "おおきい", kanji: "大きい", romaji: "ookii", meaning: { es: "grande", en: "big" } },
      { kana: "ちいさい", kanji: "小さい", romaji: "chiisai", meaning: { es: "pequeño", en: "small" } },
      { kana: "あたらしい", kanji: "新しい", romaji: "atarashii", meaning: { es: "nuevo", en: "new" } },
      { kana: "ふるい", kanji: "古い", romaji: "furui", meaning: { es: "viejo / antiguo", en: "old" } },
      { kana: "たかい", kanji: "高い", romaji: "takai", meaning: { es: "alto / caro", en: "tall / expensive" } },
      { kana: "やすい", kanji: "安い", romaji: "yasui", meaning: { es: "barato", en: "cheap" } },
      { kana: "あつい", kanji: "暑い", romaji: "atsui", meaning: { es: "caluroso (clima)", en: "hot (weather)" } },
      { kana: "さむい", kanji: "寒い", romaji: "samui", meaning: { es: "frío (clima)", en: "cold (weather)" } },
      { kana: "いそがしい", kanji: "忙しい", romaji: "isogashii", meaning: { es: "ocupado", en: "busy" } },
      { kana: "たのしい", kanji: "楽しい", romaji: "tanoshii", meaning: { es: "divertido", en: "fun" } },
      { kana: "いい / よい", kanji: null, romaji: "ii / yoi", meaning: { es: "bueno", en: "good" } },
      { kana: "わるい", kanji: "悪い", romaji: "warui", meaning: { es: "malo", en: "bad" } },
      { kana: "むずかしい", kanji: "難しい", romaji: "muzukashii", meaning: { es: "difícil", en: "difficult" } },
      { kana: "やさしい", kanji: "易しい", romaji: "yasashii", meaning: { es: "fácil", en: "easy" } },
      { kana: "きれい", kanji: null, romaji: "kirei", meaning: { es: "bonito / limpio (na-adj)", en: "pretty / clean (na-adj)" } },
      { kana: "げんき", kanji: "元気", romaji: "genki", meaning: { es: "sano / animado (na-adj)", en: "healthy / energetic (na-adj)" } },
      { kana: "しずか", kanji: "静か", romaji: "shizuka", meaning: { es: "tranquilo (na-adj)", en: "quiet (na-adj)" } },
      { kana: "すき", kanji: "好き", romaji: "suki", meaning: { es: "gustar (na-adj)", en: "to like (na-adj)" } },
    ],
  },
  {
    id: "objects",
    icon: "🎒",
    titleKey: "n5CatObjects",
    words: [
      { kana: "ほん", kanji: "本", romaji: "hon", meaning: { es: "libro", en: "book" } },
      { kana: "かばん", kanji: null, romaji: "kaban", meaning: { es: "bolso / mochila", en: "bag" } },
      { kana: "つくえ", kanji: "机", romaji: "tsukue", meaning: { es: "escritorio", en: "desk" } },
      { kana: "いす", kanji: "椅子", romaji: "isu", meaning: { es: "silla", en: "chair" } },
      { kana: "まど", kanji: "窓", romaji: "mado", meaning: { es: "ventana", en: "window" } },
      { kana: "でんわ", kanji: "電話", romaji: "denwa", meaning: { es: "teléfono", en: "telephone" } },
      { kana: "とけい", kanji: "時計", romaji: "tokei", meaning: { es: "reloj", en: "clock / watch" } },
      { kana: "かさ", kanji: "傘", romaji: "kasa", meaning: { es: "paraguas", en: "umbrella" } },
      { kana: "めがね", kanji: "眼鏡", romaji: "megane", meaning: { es: "lentes", en: "glasses" } },
      { kana: "くつ", kanji: "靴", romaji: "kutsu", meaning: { es: "zapatos", en: "shoes" } },
      { kana: "ふく", kanji: "服", romaji: "fuku", meaning: { es: "ropa", en: "clothes" } },
      { kana: "かみ", kanji: "紙", romaji: "kami", meaning: { es: "papel", en: "paper" } },
      { kana: "えんぴつ", kanji: "鉛筆", romaji: "enpitsu", meaning: { es: "lápiz", en: "pencil" } },
      { kana: "かぎ", kanji: "鍵", romaji: "kagi", meaning: { es: "llave", en: "key" } },
    ],
  },
];

// ---------------------------------------------------
// Gramática N5: estructuras fundamentales explicadas paso a paso, cada
// una con su patrón, una explicación breve en es/en, y 1-2 oraciones de
// ejemplo con romaji + traducción — pensado para leerse rápido en el
// celular (Mobile Lite) sin perder profundidad en desktop. No es
// exhaustivo (N5 real cubre más matices de cada partícula), pero cubre
// las piezas que un principiante necesita para armar sus primeras
// oraciones: partículas básicas, formas です/ます, negativo, pasado,
// adjetivos, y 3 patrones de uso diario (querer, pedir, poder).
// ---------------------------------------------------
const N5_GRAMMAR_POINTS = [
  {
    id: "wa",
    label: "は",
    titleKey: "n5GramWaTitle",
    pattern: "[Tema] は [Comentario]",
    explanation: {
      es: "Marca el TEMA de la oración — de qué se está hablando. Se escribe con el carácter へ pero se PRONUNCIA \"wa\".",
      en: "Marks the TOPIC of the sentence — what you're talking about. Written with the character へ but PRONOUNCED \"wa\".",
    },
    examples: [
      { jp: "私は学生です。", reading: "わたしはがくせいです。", romaji: "Watashi wa gakusei desu.", translation: { es: "Yo soy estudiante.", en: "I am a student." } },
      { jp: "これは本です。", reading: "これはほんです。", romaji: "Kore wa hon desu.", translation: { es: "Esto es un libro.", en: "This is a book." } },
    ],
  },
  {
    id: "mo",
    label: "も",
    titleKey: "n5GramMoTitle",
    pattern: "[Sustantivo] も",
    explanation: {
      es: "\"También\" — reemplaza a は/が/を cuando agregás algo a lo ya dicho.",
      en: "\"Also/too\" — replaces は/が/を when adding something to what was already said.",
    },
    examples: [
      { jp: "私も学生です。", reading: "わたしもがくせいです。", romaji: "Watashi mo gakusei desu.", translation: { es: "Yo también soy estudiante.", en: "I am also a student." } },
    ],
  },
  {
    id: "o",
    label: "を",
    titleKey: "n5GramOTitle",
    pattern: "[Objeto] を [Verbo]",
    explanation: {
      es: "Marca el OBJETO DIRECTO del verbo — sobre qué recae la acción.",
      en: "Marks the DIRECT OBJECT of the verb — what the action falls on.",
    },
    examples: [
      { jp: "ご飯を食べます。", reading: "ごはんをたべます。", romaji: "Gohan o tabemasu.", translation: { es: "Como arroz / Como.", en: "I eat rice / I eat." } },
      { jp: "本を読みます。", reading: "ほんをよみます。", romaji: "Hon o yomimasu.", translation: { es: "Leo un libro.", en: "I read a book." } },
    ],
  },
  {
    id: "ni",
    label: "に",
    titleKey: "n5GramNiTitle",
    pattern: "[Tiempo/Lugar] に",
    explanation: {
      es: "Marca un punto en el TIEMPO, o el DESTINO/lugar de existencia — \"a las 7\", \"a la escuela\", \"hay algo EN...\".",
      en: "Marks a point in TIME, or the DESTINATION/place something exists — \"at 7\", \"to school\", \"there is something AT...\".",
    },
    examples: [
      { jp: "7時に起きます。", reading: "しちじにおきます。", romaji: "Shichiji ni okimasu.", translation: { es: "Me levanto a las 7.", en: "I wake up at 7." } },
      { jp: "学校に行きます。", reading: "がっこうにいきます。", romaji: "Gakkou ni ikimasu.", translation: { es: "Voy a la escuela.", en: "I go to school." } },
    ],
  },
  {
    id: "de",
    label: "で",
    titleKey: "n5GramDeTitle",
    pattern: "[Lugar/Medio] で [Acción]",
    explanation: {
      es: "Marca DÓNDE pasa una acción, o el MEDIO/herramienta con la que se hace algo.",
      en: "Marks WHERE an action happens, or the MEANS/tool used to do something.",
    },
    examples: [
      { jp: "図書館で勉強します。", reading: "としょかんでべんきょうします。", romaji: "Toshokan de benkyou shimasu.", translation: { es: "Estudio en la biblioteca.", en: "I study at the library." } },
      { jp: "バスで行きます。", reading: "バスでいきます。", romaji: "Basu de ikimasu.", translation: { es: "Voy en autobús.", en: "I go by bus." } },
    ],
  },
  {
    id: "ga",
    label: "が",
    titleKey: "n5GramGaTitle",
    pattern: "[Sujeto] が [Verbo/Estado]",
    explanation: {
      es: "Marca el SUJETO con énfasis (\"quién específicamente\"), y es obligatorio con あります/います (haber) y para expresar gustos/habilidades.",
      en: "Marks the SUBJECT with emphasis (\"specifically who\"), and is required with あります/います (there is) and to express likes/abilities.",
    },
    examples: [
      { jp: "猫がいます。", reading: "ねこがいます。", romaji: "Neko ga imasu.", translation: { es: "Hay un gato.", en: "There is a cat." } },
      { jp: "私が行きます。", reading: "わたしがいきます。", romaji: "Watashi ga ikimasu.", translation: { es: "Yo (soy quien) voy.", en: "I'll be the one to go." } },
    ],
  },
  {
    id: "no",
    label: "の",
    titleKey: "n5GramNoTitle",
    pattern: "[A] の [B] = \"B de A\"",
    explanation: {
      es: "Conecta 2 sustantivos, casi siempre como posesión — el orden es al revés que en español.",
      en: "Connects 2 nouns, almost always as possession — the order is reversed from English.",
    },
    examples: [
      { jp: "私の本", reading: "わたしのほん", romaji: "Watashi no hon", translation: { es: "mi libro", en: "my book" } },
      { jp: "日本語の先生", reading: "にほんごのせんせい", romaji: "Nihongo no sensei", translation: { es: "profesor/a de japonés", en: "Japanese teacher" } },
    ],
  },
  {
    id: "desumasu",
    label: "です / ます",
    titleKey: "n5GramDesuMasuTitle",
    pattern: "[Sustantivo/な-adj] です · [Raíz del verbo] ます",
    explanation: {
      es: "La forma EDUCADA/formal estándar — です para sustantivos y adjetivos な, ます para verbos. Es la base con la que se aprende a hablar en N5.",
      en: "The standard POLITE/formal form — です for nouns and な-adjectives, ます for verbs. This is the foundation N5 speech is built on.",
    },
    examples: [
      { jp: "学生です。", reading: "がくせいです。", romaji: "Gakusei desu.", translation: { es: "Soy estudiante.", en: "I am a student." } },
      { jp: "食べます。", reading: "たべます。", romaji: "Tabemasu.", translation: { es: "Como.", en: "I eat." } },
    ],
  },
  {
    id: "negative",
    label: "〜ません / ではありません",
    titleKey: "n5GramNegativeTitle",
    pattern: "[Raíz] ません · [Sustantivo] ではありません",
    explanation: {
      es: "Forma NEGATIVA educada — ません para verbos, ではありません (o じゃありません, más hablado) para sustantivos.",
      en: "Polite NEGATIVE form — ません for verbs, ではありません (or じゃありません, more spoken) for nouns.",
    },
    examples: [
      { jp: "食べません。", reading: "たべません。", romaji: "Tabemasen.", translation: { es: "No como.", en: "I don't eat." } },
      { jp: "学生ではありません。", reading: "がくせいではありません。", romaji: "Gakusei dewa arimasen.", translation: { es: "No soy estudiante.", en: "I am not a student." } },
    ],
  },
  {
    id: "past",
    label: "〜ました / でした",
    titleKey: "n5GramPastTitle",
    pattern: "[Raíz] ました · [Sustantivo] でした",
    explanation: {
      es: "Forma de PASADO educada — ました para verbos, でした para sustantivos/な-adjetivos.",
      en: "Polite PAST form — ました for verbs, でした for nouns/な-adjectives.",
    },
    examples: [
      { jp: "食べました。", reading: "たべました。", romaji: "Tabemashita.", translation: { es: "Comí.", en: "I ate." } },
      { jp: "学生でした。", reading: "がくせいでした。", romaji: "Gakusei deshita.", translation: { es: "Era estudiante.", en: "I was a student." } },
    ],
  },
  {
    id: "adjectives",
    label: "い-adj / な-adj",
    titleKey: "n5GramAdjTitle",
    pattern: "[い-adj] + sustantivo · [な-adj] + な + sustantivo",
    explanation: {
      es: "Los adjetivos い van directo antes del sustantivo; los adjetivos な necesitan な en el medio.",
      en: "い-adjectives go directly before the noun; な-adjectives need な in between.",
    },
    examples: [
      { jp: "大きい家", reading: "おおきいいえ", romaji: "Ookii ie", translation: { es: "una casa grande", en: "a big house" } },
      { jp: "元気な人", reading: "げんきなひと", romaji: "Genki na hito", translation: { es: "una persona con energía", en: "an energetic person" } },
    ],
  },
  {
    id: "tai",
    label: "〜たいです",
    titleKey: "n5GramTaiTitle",
    pattern: "[Raíz del verbo] たいです",
    explanation: {
      es: "Expresa lo que UNO QUIERE hacer.",
      en: "Expresses what YOU want to do.",
    },
    examples: [
      { jp: "日本に行きたいです。", reading: "にほんにいきたいです。", romaji: "Nihon ni ikitai desu.", translation: { es: "Quiero ir a Japón.", en: "I want to go to Japan." } },
    ],
  },
  {
    id: "kudasai",
    label: "〜てください",
    titleKey: "n5GramKudasaiTitle",
    pattern: "[Verbo en forma て] ください",
    explanation: {
      es: "Un pedido educado — \"por favor hacé...\".",
      en: "A polite request — \"please do...\".",
    },
    examples: [
      { jp: "待ってください。", reading: "まってください。", romaji: "Matte kudasai.", translation: { es: "Por favor espera.", en: "Please wait." } },
    ],
  },
  {
    id: "dekiru",
    label: "〜ことができます",
    titleKey: "n5GramDekiruTitle",
    pattern: "[Verbo en forma diccionario] ことができます",
    explanation: {
      es: "Expresa CAPACIDAD — poder hacer algo.",
      en: "Expresses ABILITY — being able to do something.",
    },
    examples: [
      { jp: "漢字を書くことができます。", reading: "かんじをかくことができます。", romaji: "Kanji o kaku koto ga dekimasu.", translation: { es: "Puedo escribir kanji.", en: "I can write kanji." } },
    ],
  },
  {
    id: "ka",
    label: "か",
    titleKey: "n5GramKaTitle",
    pattern: "[Oración] か。",
    explanation: {
      es: "Convierte cualquier oración en PREGUNTA — se agrega al final, sin cambiar el orden de las palabras.",
      en: "Turns any sentence into a QUESTION — added at the end, without changing word order.",
    },
    examples: [
      { jp: "学生ですか。", reading: "がくせいですか。", romaji: "Gakusei desu ka.", translation: { es: "¿Eres estudiante?", en: "Are you a student?" } },
    ],
  },
  {
    id: "kara",
    label: "から",
    titleKey: "n5GramKaraTitle",
    pattern: "[Razón] から、[Resultado]",
    explanation: {
      es: "Da la RAZÓN de algo — \"porque...\". Va después de la causa, antes del resultado.",
      en: "Gives the REASON for something — \"because...\". Goes after the cause, before the result.",
    },
    examples: [
      { jp: "忙しいから、行きません。", reading: "いそがしいから、いきません。", romaji: "Isogashii kara, ikimasen.", translation: { es: "Porque estoy ocupado, no voy.", en: "Because I'm busy, I'm not going." } },
      { jp: "雨だから、うちにいます。", reading: "あめだから、うちにいます。", romaji: "Ame dakara, uchi ni imasu.", translation: { es: "Porque llueve, me quedo en casa.", en: "Because it's raining, I'm staying home." } },
    ],
  },
  {
    id: "shika",
    label: "しか",
    titleKey: "n5GramShikaTitle",
    pattern: "[Sustantivo] しか + [forma negativa]",
    explanation: {
      es: "\"Solo/nada más que\" — SIEMPRE se usa con el verbo en NEGATIVO, aunque el significado sea positivo (\"solo tengo...\").",
      en: "\"Only/nothing but\" — ALWAYS paired with a NEGATIVE verb, even though the meaning is positive (\"I only have...\").",
    },
    examples: [
      { jp: "千円しかありません。", reading: "せんえんしかありません。", romaji: "Sen en shika arimasen.", translation: { es: "Solo tengo mil yenes.", en: "I only have a thousand yen." } },
    ],
  },
  {
    id: "masenka",
    label: "〜ませんか",
    titleKey: "n5GramMasenkaTitle",
    pattern: "[Raíz del verbo] ませんか",
    explanation: {
      es: "Una INVITACIÓN educada — \"¿no querés...?\", \"¿vamos a...?\".",
      en: "A polite INVITATION — \"won't you...?\", \"shall we...?\".",
    },
    examples: [
      { jp: "一緒に行きませんか。", reading: "いっしょにいきませんか。", romaji: "Issho ni ikimasen ka.", translation: { es: "¿Vamos juntos?", en: "Shall we go together?" } },
    ],
  },
  {
    id: "mashou",
    label: "〜ましょう",
    titleKey: "n5GramMashouTitle",
    pattern: "[Raíz del verbo] ましょう",
    explanation: {
      es: "\"Hagamos...\" — una PROPUESTA para hacer algo juntos, más directa que ませんか.",
      en: "\"Let's...\" — a SUGGESTION to do something together, more direct than ませんか.",
    },
    examples: [
      { jp: "一緒に食べましょう。", reading: "いっしょにたべましょう。", romaji: "Issho ni tabemashou.", translation: { es: "Comamos juntos.", en: "Let's eat together." } },
    ],
  },
  {
    id: "temoii",
    label: "〜てもいいです / 〜てはいけません",
    titleKey: "n5GramTemoiiTitle",
    pattern: "[Verbo en forma て] もいいです · [Verbo en forma て] はいけません",
    explanation: {
      es: "PERMISO (\"se puede...\") y PROHIBICIÓN (\"no se puede...\") — un par de patrones opuestos que se aprenden juntos.",
      en: "PERMISSION (\"you may...\") and PROHIBITION (\"you must not...\") — an opposite pair usually learned together.",
    },
    examples: [
      { jp: "ここで写真をとってもいいです。", reading: "ここでしゃしんをとってもいいです。", romaji: "Koko de shashin o totte mo ii desu.", translation: { es: "Se puede tomar fotos aquí.", en: "You may take photos here." } },
      { jp: "ここに入ってはいけません。", reading: "ここにはいってはいけません。", romaji: "Koko ni haitte wa ikemasen.", translation: { es: "No se puede entrar aquí.", en: "You must not enter here." } },
    ],
  },
  {
    id: "toki",
    label: "とき",
    titleKey: "n5GramTokiTitle",
    pattern: "[Oración] とき、[Oración principal]",
    explanation: {
      es: "\"Cuando...\" — conecta dos oraciones en el tiempo, funciona como un sustantivo (literalmente \"el momento en que...\").",
      en: "\"When...\" — connects two clauses in time, grammatically works like a noun (literally \"the moment when...\").",
    },
    examples: [
      { jp: "忙しいとき、休みません。", reading: "いそがしいとき、やすみません。", romaji: "Isogashii toki, yasumimasen.", translation: { es: "Cuando estoy ocupado, no descanso.", en: "When I'm busy, I don't rest." } },
    ],
  },
  {
    id: "moumada",
    label: "もう / まだ",
    titleKey: "n5GramMouMadaTitle",
    pattern: "もう + [pasado] · まだ + [negativo]",
    explanation: {
      es: "もう (\"ya\") con verbo en pasado, y まだ (\"todavía/aún no\") con verbo en negativo — un par muy usado en preguntas de confirmación.",
      en: "もう (\"already\") with a past-tense verb, and まだ (\"still/not yet\") with a negative verb — a very common pair in confirmation questions.",
    },
    examples: [
      { jp: "もう食べました。", reading: "もうたべました。", romaji: "Mou tabemashita.", translation: { es: "Ya comí.", en: "I already ate." } },
      { jp: "まだ食べません。", reading: "まだたべません。", romaji: "Mada tabemasen.", translation: { es: "Todavía no como.", en: "I'm not eating yet." } },
    ],
  },
];

const JP_MASTERY_THRESHOLD = 3; // respuestas correctas para brillo dorado + 3 estrellas

// "Fila KA" / "Row KA" en es/en, "KA行" en ja (sufijo, no prefijo — así
// se nombran las filas del Gojuon en japonés real).
function formatGojuonRowLabel(row) {
  if (currentLanguage === "ja") return `${row.romaji}行`;
  return `${t("jpRowLabelPrefix")} ${row.romaji}`;
}

// Lista plana para practicar/quizzear, con forma uniforme sin importar
// el script: `answer` es la romanización para hiragana/katakana, o el
// significado en español para kanji — así showJpQuiz()/handleJpAnswer()
// no necesitan ninguna rama especial por tipo.
function getKanaList(script) {
  if (script === "kanji") {
    return KANJI_N5.map((k) => ({
      char: k.char,
      answer: k.meaning,
      rowId: "kanji-n5",
      script,
      onyomi: k.onyomi,
      kunyomi: k.kunyomi,
      meaning: k.meaning,
    }));
  }
  const list = [];
  GOJUON_ROWS.forEach((row) => {
    row[script].forEach((char, i) => {
      list.push({ char, answer: row.romajiList[i], rowId: row.id, script });
    });
  });
  return list;
}

function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Reproduce un carácter japonés con la Web Speech API nativa del
// navegador (sin archivos de audio externos). Sin guardas raras: si el
// navegador no soporta síntesis de voz, simplemente no hace nada.
function speakKana(char) {
  if (!("speechSynthesis" in window) || !char) return;
  window.speechSynthesis.cancel(); // corta cualquier lectura anterior en curso
  const utterance = new SpeechSynthesisUtterance(char);
  utterance.lang = "ja-JP";
  window.speechSynthesis.speak(utterance);
}


// Dataset de trazos REALES (Hiragana + Katakana + Kanji), verificado en un
// bloque anterior: @k1low/hanzi-writer-data-jp devuelve {strokes, medians}
// en el mismo formato que Hanzi Writer usa nativamente. Versión fijada
// (no "@latest") para que una publicación futura del paquete no cambie
// el comportamiento sin volver a probarse acá primero. Compartido entre
// el módulo de Práctica de Trazos Reales (#hanzi-writer-modal) y la
// vista de Fases del módulo Japonés — con caché en memoria para no pedir
// dos veces el mismo carácter durante una sesión.
const HANZI_STROKE_DATA_URL = "https://cdn.jsdelivr.net/npm/@k1low/hanzi-writer-data-jp@0.8.0";
const hanziStrokeDataCache = new Map();

function fetchHanziStrokeData(char) {
  if (hanziStrokeDataCache.has(char)) return Promise.resolve(hanziStrokeDataCache.get(char));
  return fetch(`${HANZI_STROKE_DATA_URL}/${encodeURIComponent(char)}.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      hanziStrokeDataCache.set(char, data);
      return data;
    });
}

function defaultState() {
  return {
    level: 1,
    xp: 0,
    xpToNext: 100,
    currency: "PEN",
    diamonds: 0,
    // Oro (🪙): la única recompensa de moneda por completar lecciones o
    // misiones (junto con XP). Los Diamantes NO se otorgan por jugar —
    // quedan reservados exclusivamente para compra con dinero real, así
    // que ningún flujo del juego debe volver a llamar addDiamonds().
    gold: 0,
    operatorName: null,
    // Skin del León elegido a mano por el Operador en el modal de Skins
    // (ver MIIKAERU_SKINS/currentIdleLionSrc() arriba) — `null` = usa el
    // carrusel ambiental de siempre (idle/meditando/batalla rotando).
    selectedSkin: null,
    // Avatar Inicial elegido en el primer ingreso (ver PLAYER_CHARACTERS
    // arriba) — "fesha" | "mijashi" | null (todavía no eligió, dispara
    // openCharacterSelectModal() la próxima vez que se detecte).
    playerCharacter: null,
    // Mock temporal: % de misiones completadas esta semana. Reemplazar por
    // un cálculo real (historial de pilares) cuando exista esa lógica.
    weeklyMissions: { completed: 3, total: 5 },
    // Racha de días consecutivos con actividad en la app (cualquier
    // sesión cuenta, no solo Idiomas — no existe todavía un registro de
    // actividad separado por pilar). Real, no un mock: se recalcula en
    // cada carga comparando lastActiveDate contra hoy — ver
    // updateActivityStreak() más abajo.
    streak: 0,
    lastActiveDate: null,
    pillars: {
      finanzas: {
        balance: 0,
        tier: 0,
        ingresoMensual: 0,
        // items: desglose de gastos individuales de la categoría (ver
        // modal "Desglose de Gastos"). Cuando tiene elementos, `amount`
        // pasa a ser la SUMA de items (auto-sincronizada) en vez de un
        // número editable a mano — ver renderFinanzasCategories().
        categories: [
          { id: "vivienda", name: "Vivienda", amount: 0, editable: false, items: [] },
          { id: "comida", name: "Comida", amount: 0, editable: false, items: [] },
          { id: "estudios", name: "Estudios", amount: 0, editable: false, items: [] },
          { id: "vanidades", name: "Vanidades", amount: 0, editable: false, items: [] },
        ],
        // Auditoría y Control de Nómina (給与明細書): snapshot ÚNICO del
        // mes actual, no un historial — mismo nivel de simplicidad que
        // ingresoMensual (un solo número vigente). evidenceImage guarda
        // la foto adjunta como dataURL directamente en el state (mismo
        // patrón que pendingEvidenceImage del chat).
        payrollAudit: {
          horasBase: 0,
          horasExtra: 0,
          horasNocturnas: 0,
          sueldoBase: 0,
          bonos: 0,
          seguros: 0,
          impuestos: 0,
          adelantos: 0,
          evidenceImage: null,
        },
      },
      fisico: { energy: 100, repsGoal: 20, steps: { value: 0, source: "manual" } },
      espiritual: { estado: "Equilibrado" },
      // mastery: mapa "script:kana" -> veces respondida correctamente
      // (tope JP_MASTERY_THRESHOLD), usado por el módulo Japonés del App
      // Hub para el brillo dorado + estrellas de la cuadrícula Gojuon.
      aprendizaje: { mastery: {} },
    },
    // requirements: metas/checklist propias del deseo (ver modal de
    // Requisitos) — completarlas TODAS también desbloquea la tarjeta,
    // como camino alternativo a subir de nivel. Arranca vacío: el
    // usuario las agrega desde el modal.
    wishlist: [
      { id: "casa", name: "Casa", icon: "🏠", unlockLevel: 15, unlocked: false, requirements: [] },
      { id: "carro", name: "Carro", icon: "🚗", unlockLevel: 20, unlocked: false, requirements: [] },
      { id: "moto", name: "Moto", icon: "🏍️", unlockLevel: 12, unlocked: false, requirements: [] },
      { id: "viajes", name: "Viajes", icon: "✈️", unlockLevel: 25, unlocked: false, requirements: [] },
    ],
    chatHistory: [
      { author: "SISTEMA", text: "Conexión establecida con el núcleo Miikaeru. Bienvenido, operador.", variant: "system" },
      { author: "MIIKAERU", text: "Tu progreso ha sido sincronizado. ¿Listo para la siguiente misión?", variant: "bot" },
    ],
  };
}

function rankForLevel(level) {
  let current = RANKS[0].name;
  for (const rank of RANKS) {
    if (level >= rank.level) current = rank.name;
  }
  return current;
}

function formatCurrency(amount, currencyCode) {
  const currency = CURRENCIES[currencyCode] || CURRENCIES.PEN;
  const value = Math.round(amount || 0);
  const formatted = Math.abs(value).toLocaleString(currency.locale);
  const sign = value < 0 ? "-" : "";
  return `${sign}${currency.symbol} ${formatted}`;
}

// Variante con 2 decimales SIN redondear a entero — usada específicamente
// por la pestaña Venta (pedido explícito: "No redondear valores decimales
// a enteros", ejemplos "175.00"/"50.00"). formatCurrency() de arriba
// sigue igual (Math.round) para todo lo demás de la app — Servicio,
// Dashboard, Boleta de Pago, etc. — no era parte de este pedido y
// cambiarla habría alterado esas pantallas sin que nadie lo pidiera.
function formatCurrencyDecimal(amount, currencyCode) {
  const currency = CURRENCIES[currencyCode] || CURRENCIES.PEN;
  const value = amount || 0;
  const formatted = Math.abs(value).toLocaleString(currency.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = value < 0 ? "-" : "";
  return `${sign}${currency.symbol} ${formatted}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();

    const mergedFisico = {
      ...base.pillars.fisico,
      ...(parsed.pillars && parsed.pillars.fisico),
      steps: {
        ...base.pillars.fisico.steps,
        ...(parsed.pillars && parsed.pillars.fisico && parsed.pillars.fisico.steps),
      },
    };

    const parsedFinanzas = parsed.pillars && parsed.pillars.finanzas;
    const mergedFinanzas = {
      ...base.pillars.finanzas,
      ...parsedFinanzas,
      categories:
        parsedFinanzas && Array.isArray(parsedFinanzas.categories) && parsedFinanzas.categories.length
          ? parsedFinanzas.categories
          : base.pillars.finanzas.categories,
    };

    const parsedAprendizaje = parsed.pillars && parsed.pillars.aprendizaje;
    const mergedAprendizaje = {
      ...base.pillars.aprendizaje,
      ...parsedAprendizaje,
      mastery: { ...base.pillars.aprendizaje.mastery, ...(parsedAprendizaje && parsedAprendizaje.mastery) },
    };

    return {
      ...base,
      ...parsed,
      pillars: {
        finanzas: mergedFinanzas,
        fisico: mergedFisico,
        espiritual: { ...base.pillars.espiritual, ...(parsed.pillars && parsed.pillars.espiritual) },
        aprendizaje: mergedAprendizaje,
      },
      wishlist: Array.isArray(parsed.wishlist) && parsed.wishlist.length ? parsed.wishlist : base.wishlist,
      chatHistory: Array.isArray(parsed.chatHistory) ? parsed.chatHistory : base.chatHistory,
    };
  } catch (err) {
    return defaultState();
  }
}

let state = loadState();

function persist() {
  // El campo `image` de los mensajes de chat vive solo en memoria de sesión,
  // por eso se excluye al serializar hacia localStorage.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state, (key, value) => (key === "image" ? undefined : value)));
}

// ---------------------------------------------------
// Ledger de negocios (pestaña Servicios/Negocio + Dashboard Financiero).
// Persistencia DELIBERADAMENTE separada del `state` principal, en su
// propia clave de localStorage — tal como se pidió explícitamente — en
// vez de vivir anidada dentro de state.pillars.finanzas.
// ---------------------------------------------------
const BUSINESS_LEDGER_KEY = scopedKey("miikaeru_business_ledger", activeProfileId);

function loadBusinessLedger() {
  try {
    const raw = localStorage.getItem(BUSINESS_LEDGER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function persistBusinessLedger() {
  localStorage.setItem(BUSINESS_LEDGER_KEY, JSON.stringify(businessLedger));
}

let businessLedger = loadBusinessLedger();

// Moneda del ledger de negocios: independiente de state.currency (la
// moneda "personal" del resto de Finanzas/HUD) — su propia clave de
// localStorage, igual de separada que el ledger mismo.
const BUSINESS_CURRENCY_KEY = scopedKey("miikaeru_business_currency", activeProfileId);

function loadBusinessCurrency() {
  const saved = localStorage.getItem(BUSINESS_CURRENCY_KEY);
  return CURRENCIES[saved] ? saved : "PEN";
}

function persistBusinessCurrency() {
  localStorage.setItem(BUSINESS_CURRENCY_KEY, businessCurrency);
}

let businessCurrency = loadBusinessCurrency();

// ---------------------------------------------------
// Módulo Calendario & Eventos: persistencia propia, igual patrón que el
// ledger de negocios (clave dedicada en localStorage, cargada una vez al
// inicio y re-guardada tras cada mutación).
// ---------------------------------------------------
const CALENDAR_EVENTS_KEY = scopedKey("miikaeru_calendar_events", activeProfileId);

function loadCalendarEvents() {
  try {
    const raw = localStorage.getItem(CALENDAR_EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function persistCalendarEvents() {
  localStorage.setItem(CALENDAR_EVENTS_KEY, JSON.stringify(calendarEvents));
}

let calendarEvents = loadCalendarEvents();

// ---------------------------------------------------
// Módulo Bio-Sync: registro de peso / sueño / energía, misma estrategia
// de persistencia independiente.
// ---------------------------------------------------
const BIOMETRICS_LOG_KEY = scopedKey("miikaeru_biometrics_log", activeProfileId);

function loadBiometricsLog() {
  try {
    const raw = localStorage.getItem(BIOMETRICS_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function persistBiometricsLog() {
  localStorage.setItem(BIOMETRICS_LOG_KEY, JSON.stringify(biometricsLog));
}

let biometricsLog = loadBiometricsLog();

// ---------------------------------------------------
// Módulo Hábitos & Rachas: 5 hábitos diarios recomendados, un mapa de
// completado por fecha, y un contador de racha (días consecutivos con
// los 5 hábitos completos). Igual que updateActivityStreak(), es real
// (no un mock): se recalcula comparando la última fecha de racha contra
// hoy, nunca se inventa. Mismo patrón de persistencia independiente que
// biometricsLog — no vive dentro de `state` porque puede crecer con el
// tiempo (un registro por día), a diferencia de un contador simple.
// ---------------------------------------------------
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const HABITS_LIST = [
  { id: "wakeup", icon: "🌅", i18nKey: "habitWakeUp" },
  { id: "meditate", icon: "🧘", i18nKey: "habitMeditate" },
  { id: "plan", icon: "📝", i18nKey: "habitPlan" },
  { id: "japanese", icon: "📖", i18nKey: "habitJapanese" },
  { id: "hydrate", icon: "💧", i18nKey: "habitHydrate" },
];

const HABITS_LOG_KEY = scopedKey("miikaeru_habits_log", activeProfileId); // { "YYYY-MM-DD": { habitId: true, ... } }
const HABITS_META_KEY = scopedKey("miikaeru_habits_meta", activeProfileId); // { streak, lastStreakDate }

function loadHabitsLog() {
  try {
    const raw = localStorage.getItem(HABITS_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
}

function persistHabitsLog() {
  localStorage.setItem(HABITS_LOG_KEY, JSON.stringify(habitsLog));
}

function loadHabitsMeta() {
  try {
    const raw = localStorage.getItem(HABITS_META_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? { streak: 0, lastStreakDate: null, ...parsed } : { streak: 0, lastStreakDate: null };
  } catch (err) {
    return { streak: 0, lastStreakDate: null };
  }
}

function persistHabitsMeta() {
  localStorage.setItem(HABITS_META_KEY, JSON.stringify(habitsMeta));
}

let habitsLog = loadHabitsLog();
let habitsMeta = loadHabitsMeta();

// ---------------------------------------------------
// Módulo Rutina de Ejercicios: plan semanal (enfoque por día, editable
// por el usuario) + historial de series/repeticiones/peso registrado.
// Mismo patrón de persistencia independiente que biometricsLog/hábitos.
// ---------------------------------------------------
const WORKOUT_WEEKDAYS = [
  { id: "mon", i18nKey: "workoutMon" },
  { id: "tue", i18nKey: "workoutTue" },
  { id: "wed", i18nKey: "workoutWed" },
  { id: "thu", i18nKey: "workoutThu" },
  { id: "fri", i18nKey: "workoutFri" },
  { id: "sat", i18nKey: "workoutSat" },
  { id: "sun", i18nKey: "workoutSun" },
];

// Plan por defecto tal como lo pidió el usuario (Lunes/Martes/Miércoles
// concretos); el resto de la semana arranca en blanco — 100% editable
// desde la propia UI, esto es solo el punto de partida.
const WORKOUT_PLAN_DEFAULT = {
  mon: "Brazos / Pecho",
  tue: "Piernas / Core",
  wed: "Espalda / Hombros",
  thu: "",
  fri: "",
  sat: "",
  sun: "",
};

const WORKOUT_PLAN_KEY = scopedKey("miikaeru_workout_plan", activeProfileId);
const WORKOUT_LOG_KEY = scopedKey("miikaeru_workout_log", activeProfileId);

function loadWorkoutPlan() {
  try {
    const raw = localStorage.getItem(WORKOUT_PLAN_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? { ...WORKOUT_PLAN_DEFAULT, ...parsed } : { ...WORKOUT_PLAN_DEFAULT };
  } catch (err) {
    return { ...WORKOUT_PLAN_DEFAULT };
  }
}

function persistWorkoutPlan() {
  localStorage.setItem(WORKOUT_PLAN_KEY, JSON.stringify(workoutPlan));
}

function loadWorkoutLog() {
  try {
    const raw = localStorage.getItem(WORKOUT_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function persistWorkoutLog() {
  localStorage.setItem(WORKOUT_LOG_KEY, JSON.stringify(workoutLog));
}

let workoutPlan = loadWorkoutPlan();
let workoutLog = loadWorkoutLog();

// ---------------------------------------------------
// Reto 7 Minutos: circuito funcional sin equipo (el "7-Minute Workout"
// clásico — 12 ejercicios de 30s con 10s de descanso, solo cuerpo + una
// silla), organizado en 4 semanas que se desbloquean progresivamente por
// SESIONES COMPLETADAS (no por fecha de calendario — así manda el
// progreso real de cada usuario, no cuántos días pasaron desde que
// empezó). El circuito de ejercicios es siempre el mismo; lo único que
// cambia entre semanas es cuántas vueltas completas sugiere cada una —
// la progresión real es "hacelo más veces", no "hacelo distinto".
// Mismo patrón de persistencia independiente que workoutLog/
// biometricsLog: un array de sesiones en localStorage, máximo un
// registro por día (ver hasCompletedSevenMinToday() más abajo).
// ---------------------------------------------------
const SEVEN_MIN_EXERCISES = [
  { id: "jumping-jacks", icon: "🤸", nameKey: "sevenMinExJumpingJacks", guideKey: "sevenMinGuideJumpingJacks" },
  { id: "wall-sit", icon: "🧱", nameKey: "sevenMinExWallSit", guideKey: "sevenMinGuideWallSit" },
  { id: "push-ups", icon: "💪", nameKey: "sevenMinExPushUps", guideKey: "sevenMinGuidePushUps" },
  { id: "crunches", icon: "🔄", nameKey: "sevenMinExCrunches", guideKey: "sevenMinGuideCrunches" },
  { id: "step-up", icon: "🪜", nameKey: "sevenMinExStepUp", guideKey: "sevenMinGuideStepUp" },
  { id: "squats", icon: "🏋️", nameKey: "sevenMinExSquats", guideKey: "sevenMinGuideSquats" },
  { id: "tricep-dips", icon: "🪑", nameKey: "sevenMinExTricepDips", guideKey: "sevenMinGuideTricepDips" },
  { id: "plank", icon: "🧘", nameKey: "sevenMinExPlank", guideKey: "sevenMinGuidePlank" },
  { id: "high-knees", icon: "🏃", nameKey: "sevenMinExHighKnees", guideKey: "sevenMinGuideHighKnees" },
  { id: "lunges", icon: "🚶", nameKey: "sevenMinExLunges", guideKey: "sevenMinGuideLunges" },
  { id: "push-up-rotation", icon: "🔃", nameKey: "sevenMinExPushUpRotation", guideKey: "sevenMinGuidePushUpRotation" },
  { id: "side-plank", icon: "📐", nameKey: "sevenMinExSidePlank", guideKey: "sevenMinGuideSidePlank" },
];

const SEVEN_MIN_WEEKS = [
  { id: 1, rounds: 1, sessionsToUnlock: 0, titleKey: "sevenMinWeek1Title", descKey: "sevenMinWeek1Desc" },
  { id: 2, rounds: 1, sessionsToUnlock: 3, titleKey: "sevenMinWeek2Title", descKey: "sevenMinWeek2Desc" },
  { id: 3, rounds: 2, sessionsToUnlock: 7, titleKey: "sevenMinWeek3Title", descKey: "sevenMinWeek3Desc" },
  { id: 4, rounds: 2, sessionsToUnlock: 12, titleKey: "sevenMinWeek4Title", descKey: "sevenMinWeek4Desc" },
];

const SEVEN_MIN_LOG_KEY = scopedKey("miikaeru_seven_min_log", activeProfileId);

function loadSevenMinLog() {
  try {
    const raw = localStorage.getItem(SEVEN_MIN_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function persistSevenMinLog() {
  localStorage.setItem(SEVEN_MIN_LOG_KEY, JSON.stringify(sevenMinLog));
}

let sevenMinLog = loadSevenMinLog();
let selectedSevenMinWeek = 1; // se reajusta a la última semana desbloqueada al renderizar

// Respaldo de "mejor esfuerzo" hacia Supabase — mismo patrón/limitaciones
// que syncTransactionToSupabase() y el feedback de Bugs & Sugerencias
// (ver ese comentario para la nota de seguridad completa sobre la clave
// "publishable"). Se hace un upsert por fecha+perfil de la racha de
// hábitos (para no perderla si cambia de dispositivo) y un insert por
// cada entrenamiento registrado.
function syncHabitsToSupabase(dateKey, completedIds) {
  if (!supabaseClient) return;
  supabaseClient
    .from("habit_logs")
    .upsert({
      profile_id: activeProfileId,
      log_date: dateKey,
      completed: completedIds,
      streak: habitsMeta.streak,
    }, { onConflict: "profile_id,log_date" })
    .then(({ error }) => {
      if (error) console.warn("Supabase: no se pudo respaldar el hábito del día (la app sigue funcionando con localStorage):", error.message);
    })
    .catch((err) => console.warn("Supabase: fallo de red al respaldar hábitos:", err));
}

function syncWorkoutToSupabase(entry) {
  if (!supabaseClient) return;
  supabaseClient
    .from("workouts")
    .insert({
      id: entry.id,
      profile_id: activeProfileId,
      log_date: entry.date,
      weekday: entry.weekday,
      exercise: entry.exercise,
      sets: entry.sets,
      reps: entry.reps,
      weight_kg: entry.weightKg,
    })
    .then(({ error }) => {
      if (error) console.warn("Supabase: no se pudo respaldar el entrenamiento (la app sigue funcionando con localStorage):", error.message);
    })
    .catch((err) => console.warn("Supabase: fallo de red al respaldar el entrenamiento:", err));
}

// ---------------------------------------------------
// Módulo activo del App Hub (Boss Fight / Hábitos / Calendario / Bio-Sync)
// — se recuerda por perfil. Japonés queda fuera a propósito: es un modal,
// no un módulo "activo" en el sentido de vista persistente, y no debería
// auto-abrirse solo porque fue lo último que el perfil tocó.
// ---------------------------------------------------
const ACTIVE_APP_KEY = scopedKey("miikaeru_active_app", activeProfileId);

function loadActiveApp() {
  return localStorage.getItem(ACTIVE_APP_KEY) || "bossfight";
}

function persistActiveApp(appKey) {
  localStorage.setItem(ACTIVE_APP_KEY, appKey);
}

// ---------------------------------------------------
// DOM + render
// ---------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatFeed = document.getElementById("chat-feed");

  // Rediseño HUD estilo juego: Chat y Wishlist, antes paneles siempre
  // visibles, ahora se abren desde un ícono del dock izquierdo — mismo
  // patrón de modal anidado (open/close/backdrop/Escape) que el resto de
  // la app.
  const chatOpenBtn = document.getElementById("chat-open-btn");
  const chatModal = document.getElementById("chat-modal");
  const chatModalClose = document.getElementById("chat-modal-close");
  const wishlistOpenBtn = document.getElementById("wishlist-open-btn");
  const wishlistModal = document.getElementById("wishlist-modal");
  const wishlistModalClose = document.getElementById("wishlist-modal-close");

  const pillarsEl = document.getElementById("pillars");
  const pillarModal = document.getElementById("pillar-modal");
  const pillarModalClose = document.getElementById("pillar-modal-close");

  const attachBtn = document.getElementById("attach-btn");
  const evidenceInput = document.getElementById("evidence-input");
  const evidencePreview = document.getElementById("evidence-preview");
  const evidencePreviewImg = document.getElementById("evidence-preview-img");
  const evidenceRemove = document.getElementById("evidence-remove");

  const finanzasPanel = document.getElementById("finanzas-panel");
  const financeIngresoInput = document.getElementById("finanzas-ingreso");
  const financeIngresoSymbol = document.getElementById("finanzas-ingreso-symbol");
  const financeCategoriesEl = document.getElementById("finanzas-categories");
  const financeAddCategoryBtn = document.getElementById("finanzas-add-category");
  const financeTotalGastosEl = document.getElementById("finanzas-total-gastos");
  const financeBalanceEl = document.getElementById("finanzas-balance");
  const financeSaveBtn = document.getElementById("finanzas-save-btn");

  // Auditoría y Control de Nómina (Módulo 1: Personales)
  const payrollAuditOpenBtn = document.getElementById("payroll-audit-open-btn");
  const payrollAuditModal = document.getElementById("payroll-audit-modal");
  const payrollAuditModalClose = document.getElementById("payroll-audit-modal-close");
  const payrollScanInput = document.getElementById("payroll-scan-input");
  const payrollScanBtn = document.getElementById("payroll-scan-btn");
  const payrollScanStatus = document.getElementById("payroll-scan-status");
  const payrollScanPreview = document.getElementById("payroll-scan-preview");
  const payrollScanStatusText = document.getElementById("payroll-scan-status-text");
  const payrollHorasBaseInput = document.getElementById("payroll-horas-base");
  const payrollHorasExtraInput = document.getElementById("payroll-horas-extra");
  const payrollHorasNocturnasInput = document.getElementById("payroll-horas-nocturnas");
  const payrollSueldoBaseInput = document.getElementById("payroll-sueldo-base");
  const payrollSueldoBaseSymbol = document.getElementById("payroll-sueldo-base-symbol");
  const payrollBonosInput = document.getElementById("payroll-bonos");
  const payrollBonosSymbol = document.getElementById("payroll-bonos-symbol");
  const payrollSegurosInput = document.getElementById("payroll-seguros");
  const payrollSegurosSymbol = document.getElementById("payroll-seguros-symbol");
  const payrollImpuestosInput = document.getElementById("payroll-impuestos");
  const payrollImpuestosSymbol = document.getElementById("payroll-impuestos-symbol");
  const payrollAdelantosInput = document.getElementById("payroll-adelantos");
  const payrollAdelantosSymbol = document.getElementById("payroll-adelantos-symbol");
  const payrollNetoFinalEl = document.getElementById("payroll-neto-final");
  const payrollApplyBtn = document.getElementById("payroll-apply-btn");

  // Desglose de Gastos por Categoría (Módulo 2: Personales)
  const categoryBreakdownModal = document.getElementById("category-breakdown-modal");
  const categoryBreakdownModalClose = document.getElementById("category-breakdown-modal-close");
  const categoryBreakdownModalTitle = document.getElementById("category-breakdown-modal-title");
  const categoryScanInput = document.getElementById("category-scan-input");
  const categoryScanBtn = document.getElementById("category-scan-btn");
  const categoryScanStatus = document.getElementById("category-scan-status");
  const categoryScanPreview = document.getElementById("category-scan-preview");
  const categoryScanStatusText = document.getElementById("category-scan-status-text");
  const categoryItemsList = document.getElementById("category-items-list");
  const categoryItemForm = document.getElementById("category-item-form");
  const categoryItemConceptInput = document.getElementById("category-item-concept");
  const categoryItemAmountInput = document.getElementById("category-item-amount");
  const categoryBreakdownTotalEl = document.getElementById("category-breakdown-total");

  // Pestañas del modal de Finanzas (Personales / Servicios y Negocio)
  const finanzasTabs = document.getElementById("finanzas-tabs");
  const finanzasTabPersonal = document.getElementById("finanzas-tab-personal");
  const finanzasTabServicios = document.getElementById("finanzas-tab-servicios");

  // Pestaña "Servicios / Negocio": registro de transacciones (Tipo 1
  // Servicio / Tipo 2 Venta) hacia el ledger de negocios.
  const negocioScanInput = document.getElementById("negocio-scan-input");
  const negocioScanBtn = document.getElementById("negocio-scan-btn");
  const negocioPrintBtn = document.getElementById("negocio-print-btn");
  const negocioPdfBtn = document.getElementById("negocio-pdf-btn");
  const negocioScanStatus = document.getElementById("negocio-scan-status");
  const negocioScanPreview = document.getElementById("negocio-scan-preview");
  const negocioScanStatusText = document.getElementById("negocio-scan-status-text");
  const negocioCurrencySelect = document.getElementById("negocio-currency-select");
  const negocioFechaInput = document.getElementById("negocio-fecha");
  const negocioNombreInput = document.getElementById("negocio-nombre");
  const negocioNombreSugerencias = document.getElementById("negocio-nombre-sugerencias");
  const negocioColaboradorInput = document.getElementById("negocio-colaborador");
  const negocioColaboradorSugerencias = document.getElementById("negocio-colaborador-sugerencias");
  const negocioMetodoPagoSelect = document.getElementById("negocio-metodo-pago");
  const negocioMetodoPagoOtroRow = document.getElementById("negocio-metodo-pago-otro-row");
  const negocioMetodoPagoOtroInput = document.getElementById("negocio-metodo-pago-otro");
  const negocioTypeToggle = document.getElementById("negocio-type-toggle");
  const negocioFieldsServicio = document.getElementById("negocio-fields-servicio");
  const negocioFieldsVenta = document.getElementById("negocio-fields-venta");

  // Tipo 1: Servicio — campos originales, restaurados tal cual (pedido
  // explícito de este bloque).
  const negocioServicioConceptoInput = document.getElementById("negocio-servicio-concepto");
  const negocioServicioMontoInput = document.getElementById("negocio-servicio-monto");
  const negocioServicioMontoSymbol = document.getElementById("negocio-servicio-monto-symbol");
  const negocioServicioGastosInput = document.getElementById("negocio-servicio-gastos");
  const negocioServicioGastosSymbol = document.getElementById("negocio-servicio-gastos-symbol");
  const negocioServicioComisionInput = document.getElementById("negocio-servicio-comision");
  const negocioServicioComisionPreviewEl = document.getElementById("negocio-servicio-comision-preview");
  const negocioServicioGananciaPreviewEl = document.getElementById("negocio-servicio-ganancia-preview");

  // Tipo 2: Venta — lógica mayorista con decimales, Costo Total Compra,
  // Monto Cobrado independiente, Ganancia Bruta, y comisión opcional en
  // %/Monto Fijo.
  const negocioVentaConceptoInput = document.getElementById("negocio-venta-concepto");
  const negocioVentaPrecioUnitarioInput = document.getElementById("negocio-venta-precio-unitario");
  const negocioVentaPrecioUnitarioSymbol = document.getElementById("negocio-venta-precio-unitario-symbol");
  const negocioVentaCantidadInput = document.getElementById("negocio-venta-cantidad");
  const negocioVentaCostoTotalEl = document.getElementById("negocio-venta-costo-total");
  const negocioVentaMontoCobradoInput = document.getElementById("negocio-venta-monto-cobrado");
  const negocioVentaMontoCobradoSymbol = document.getElementById("negocio-venta-monto-cobrado-symbol");
  const negocioVentaGananciaBrutaEl = document.getElementById("negocio-venta-ganancia-bruta");
  const negocioVentaComisionInput = document.getElementById("negocio-venta-comision");
  const negocioVentaComisionSuffix = document.getElementById("negocio-venta-comision-suffix");
  const negocioVentaComisionModoToggle = document.getElementById("negocio-venta-comision-modo-toggle");
  const negocioVentaComisionPreviewEl = document.getElementById("negocio-venta-comision-preview");
  const negocioVentaGananciaPreviewEl = document.getElementById("negocio-venta-ganancia-preview");

  const negocioRegistrarBtn = document.getElementById("negocio-registrar-btn");

  // Modal de Expansión de Ciudades (se abre desde el ícono 🌐 del dock
  // izquierdo — hasta el Bloque 50 vivía en el click del avatar/León, ver
  // #story-modal más abajo, que tomó ese gesto).
  const cityMapModal = document.getElementById("city-map-modal");
  const cityMapModalClose = document.getElementById("city-map-modal-close");
  const cityMapGrid = document.getElementById("city-map-grid");
  const cityMapOpenBtn = document.getElementById("city-map-open-btn");

  // Bugs & Sugerencias — vive dentro del mismo modal del León (city-map-modal)
  const feedbackForm = document.getElementById("feedback-form");
  const feedbackType = document.getElementById("feedback-type");
  const feedbackMessage = document.getElementById("feedback-message");
  const feedbackStatus = document.getElementById("feedback-status");

  // Panel de Administrador (se abre desde "Panel de Administrador" o
  // "Agente Inspector" dentro del Cuadro de Finanzas, ambos ocultos
  // hasta que checkAdminSession() confirme una sesión real — ver más
  // abajo) — lee de Supabase, no del ledger local.
  const adminPanelOpenBtn = document.getElementById("admin-panel-open-btn");
  const inspectorOpenBtn = document.getElementById("inspector-open-btn");
  const adminPanelModal = document.getElementById("admin-panel-modal");
  const adminPanelModalClose = document.getElementById("admin-panel-modal-close");
  const adminPanelTabs = document.getElementById("admin-panel-tabs");
  const adminPanelTabTransactions = document.getElementById("admin-panel-tab-transactions");
  const adminPanelTabInspector = document.getElementById("admin-panel-tab-inspector");
  const adminPanelTabAutomation = document.getElementById("admin-panel-tab-automation");
  const adminPanelRefreshBtn = document.getElementById("admin-panel-refresh-btn");
  const adminPanelExportBtn = document.getElementById("admin-panel-export-btn");
  const adminPanelStatus = document.getElementById("admin-panel-status");
  const adminPanelTableBody = document.getElementById("admin-panel-table-body");

  // Agente Inspector (pestaña dentro del Panel de Administrador)
  const inspectorRefreshBtn = document.getElementById("inspector-refresh-btn");
  const inspectorStatus = document.getElementById("inspector-status");
  const inspectorStatTotal = document.getElementById("inspector-stat-total");
  const inspectorStatPending = document.getElementById("inspector-stat-pending");
  const inspectorStatApproved = document.getElementById("inspector-stat-approved");
  const inspectorStatResolved = document.getElementById("inspector-stat-resolved");
  const inspectorCards = document.getElementById("inspector-cards");

  // Automatización (pestaña dentro del Panel de Administrador) — lee
  // `automation_tasks` de Supabase, la tabla donde escribe el flujo de n8n
  // externo (ver AUTOMATION_WORKFLOW.md). Mismo patrón que Agente Inspector,
  // más una suscripción realtime (ver wireAutomationRealtime()).
  const automationRefreshBtn = document.getElementById("automation-refresh-btn");
  const automationStatus = document.getElementById("automation-status");
  const automationStatTotal = document.getElementById("automation-stat-total");
  const automationStatPending = document.getElementById("automation-stat-pending");
  const automationStatApproved = document.getElementById("automation-stat-approved");
  const automationStatDiscarded = document.getElementById("automation-stat-discarded");
  const automationCards = document.getElementById("automation-cards");

  // Login de Administrador (Supabase Auth real — ver ADMIN_EMAIL/
  // checkAdminSession() arriba del todo del archivo)
  const adminLoginTriggerBtn = document.getElementById("admin-login-trigger-btn");
  const adminLoginModal = document.getElementById("admin-login-modal");
  const adminLoginModalClose = document.getElementById("admin-login-modal-close");
  const adminLoginForm = document.getElementById("admin-login-form");
  const adminLoginEmailInput = document.getElementById("admin-login-email");
  const adminLoginPasswordInput = document.getElementById("admin-login-password");
  const adminLoginError = document.getElementById("admin-login-error");

  // Modal del Dashboard Financiero General (se abre desde el botón "Ver
  // Dashboard Completo" dentro del Cuadro de Finanzas)
  const dashboardModal = document.getElementById("dashboard-modal");
  const dashboardModalClose = document.getElementById("dashboard-modal-close");
  const dashboardFilterSelect = document.getElementById("dashboard-filter-negocio");
  const dashboardPrintBtn = document.getElementById("dashboard-print-btn");
  const dashboardPdfBtn = document.getElementById("dashboard-pdf-btn");
  const dashboardCollaboratorPanel = document.getElementById("dashboard-collaborator-panel");
  const dashboardCollaboratorPanelLabel = document.getElementById("dashboard-collaborator-panel-label");
  const dashboardPayslipBtn = document.getElementById("dashboard-payslip-btn");
  const dashboardPayslipPdfBtn = document.getElementById("dashboard-payslip-pdf-btn");
  const dashboardTotalIngresosEl = document.getElementById("dashboard-total-ingresos");
  const dashboardTotalGastosEl = document.getElementById("dashboard-total-gastos");
  const dashboardTotalBalanceEl = document.getElementById("dashboard-total-balance");

  const financeGlobalIngresosEl = document.getElementById("finanzas-global-ingresos");
  const financeGlobalGastosEl = document.getElementById("finanzas-global-gastos");
  const financeGlobalBalanceEl = document.getElementById("finanzas-global-balance");
  const financeOpenDashboardBtn = document.getElementById("finanzas-open-dashboard-btn");
  const dashboardRankingToggle = document.getElementById("dashboard-ranking-toggle");
  const dashboardRankingList = document.getElementById("dashboard-ranking-list");
  const dashboardTableBody = document.getElementById("dashboard-table-body");
  const dashboardEmpty = document.getElementById("dashboard-empty");

  const fisicoPanel = document.getElementById("fisico-panel");
  const fisicoReps = document.getElementById("fisico-reps");
  const fisicoSteps = document.getElementById("fisico-steps");
  const fisicoStepsSource = document.getElementById("fisico-steps-source");
  const fisicoSubmit = document.getElementById("fisico-submit");

  const espiritualPanel = document.getElementById("espiritual-panel");
  const meditationMinutesInput = document.getElementById("meditation-minutes");
  const meditationStartBtn = document.getElementById("meditation-start-btn");
  const meditationControls = document.getElementById("meditation-controls");
  const meditationCountdown = document.getElementById("meditation-countdown");
  const meditationCountdownValue = document.getElementById("meditation-countdown-value");
  const meditationCancelBtn = document.getElementById("meditation-cancel-btn");
  const techniqueButtons = document.querySelectorAll(".technique-complete-btn");

  const aprendizajePanel = document.getElementById("aprendizaje-panel");

  const playBtn = document.getElementById("play-btn");
  const minigameViewport = document.getElementById("minigame-viewport");
  const minigameCanvas = document.getElementById("minigame-canvas");
  const minigamePlaceholder = document.getElementById("minigame-placeholder");
  const minigameStatus = document.getElementById("minigame-status");

  const appGrid = document.getElementById("app-grid");
  const addAppBtn = document.getElementById("add-app-btn");

  // Miika Pass: pase de progresión con lore de Miikaeru, niveles 1-20.
  const miikaPassBtn = document.getElementById("miika-pass-btn");
  const miikaPassModal = document.getElementById("miika-pass-modal");
  const miikaPassModalClose = document.getElementById("miika-pass-modal-close");
  const mpassFilter = document.getElementById("mpass-filter");
  const mpassTrack = document.getElementById("mpass-track");

  // Cada módulo del App Hub abre su propia ventana modal independiente
  // (ver openAppModal()/selectApp() más abajo) en vez de renderizarse
  // apretado dentro del panel — mismo patrón que ya usaba Japonés.
  const bossfightModal = document.getElementById("bossfight-modal");
  const bossfightModalClose = document.getElementById("bossfight-modal-close");
  const calendarModal = document.getElementById("calendar-modal");
  const calendarModalClose = document.getElementById("calendar-modal-close");
  const biosyncModal = document.getElementById("biosync-modal");
  const biosyncModalClose = document.getElementById("biosync-modal-close");
  const habitsModal = document.getElementById("habits-modal");
  const habitsModalClose = document.getElementById("habits-modal-close");
  // Placeholder "próximamente" genérico — hoy solo lo usa Karaoke (Hábitos
  // ya tiene módulo real, ver más abajo).
  const appPlaceholderModal = document.getElementById("app-placeholder-modal");
  const appPlaceholderModalClose = document.getElementById("app-placeholder-modal-close");
  const appPlaceholderIcon = document.getElementById("app-placeholder-icon");
  const appPlaceholderTitle = document.getElementById("app-placeholder-title");
  const appPlaceholderText = document.getElementById("app-placeholder-text");

  // Módulo Hábitos & Rachas + Rutina de Ejercicios
  const habitsTabs = document.getElementById("habits-tabs");
  const habitsTabDaily = document.getElementById("habits-tab-daily");
  const habitsTabWorkout = document.getElementById("habits-tab-workout");
  const habitsStreakValue = document.getElementById("habits-streak-value");
  const habitsGrid = document.getElementById("habits-grid");
  const workoutPlanEl = document.getElementById("workout-plan");
  const workoutLogForm = document.getElementById("workout-log-form");
  const workoutExerciseInput = document.getElementById("workout-exercise");
  const workoutSetsInput = document.getElementById("workout-sets");
  const workoutRepsInput = document.getElementById("workout-reps");
  const workoutWeightInput = document.getElementById("workout-weight");
  const workoutLogHistory = document.getElementById("workout-log-history");

  const sevenMinWeekToggle = document.getElementById("seven-min-week-toggle");
  const sevenMinProgressEl = document.getElementById("seven-min-progress");
  const sevenMinExerciseGrid = document.getElementById("seven-min-exercise-grid");
  const sevenMinCompleteBtn = document.getElementById("seven-min-complete-btn");

  const forceUpdateBtn = document.getElementById("force-update-btn");
  const avatarScaleInput = document.getElementById("avatar-scale-input");
  const avatarScaleValue = document.getElementById("avatar-scale-value");
  const chatScaleInput = document.getElementById("chat-scale-input");
  const chatScaleValue = document.getElementById("chat-scale-value");
  const scaleResetBtn = document.getElementById("scale-reset-btn");

  // Módulo Calendario & Eventos
  const calendarContent = document.getElementById("calendar-content");
  const calendarPrevBtn = document.getElementById("calendar-prev-btn");
  const calendarNextBtn = document.getElementById("calendar-next-btn");
  const calendarMonthLabel = document.getElementById("calendar-month-label");
  const calendarWeekdaysEl = document.getElementById("calendar-weekdays");
  const calendarGridEl = document.getElementById("calendar-grid");
  const calendarEventDateInput = document.getElementById("calendar-event-date");
  const calendarEventTitleInput = document.getElementById("calendar-event-title");
  const calendarAddEventBtn = document.getElementById("calendar-add-event-btn");
  const calendarEventsList = document.getElementById("calendar-events-list");

  // Módulo Bio-Sync & Estado Físico
  const biosyncBpmValueEl = document.getElementById("biosync-bpm-value");
  const biosyncPulseLine = document.querySelector(".biosync-pulse__line");
  const biosyncConnectBtn = document.getElementById("biosync-connect-btn");
  const biosyncBtStatus = document.getElementById("biosync-bt-status");
  const biosyncManualBpm = document.getElementById("biosync-manual-bpm");
  const biosyncManualBpmValue = document.getElementById("biosync-manual-bpm-value");
  const biosyncWeightInput = document.getElementById("biosync-weight");
  const biosyncSleepInput = document.getElementById("biosync-sleep");
  const biosyncEnergyInput = document.getElementById("biosync-energy");
  const biosyncEnergyValue = document.getElementById("biosync-energy-value");
  const biosyncSaveLogBtn = document.getElementById("biosync-save-log-btn");
  const biosyncLogHistory = document.getElementById("biosync-log-history");

  const jpConfigModal = document.getElementById("jp-config-modal");
  const jpConfigModalClose = document.getElementById("jp-config-modal-close");
  const jpConfigLanguageRow = document.getElementById("jp-config-language-row");
  const jpConfigModeRow = document.getElementById("jp-config-mode-row");
  const jpConfigReopenBtn = document.getElementById("jp-config-reopen-btn");
  const jpModeBadge = document.getElementById("jp-mode-badge");

  const japaneseModal = document.getElementById("japanese-modal");
  const japaneseModalClose = document.getElementById("japanese-modal-close");
  const jpScriptToggle = document.getElementById("jp-script-toggle");
  const jpGeneralPracticeBtn = document.getElementById("jp-general-practice-btn");
  const jpRowsEl = document.getElementById("jp-rows");
  const jpViewGrid = document.getElementById("jp-view-grid");
  const jpViewPhases = document.getElementById("jp-view-phases");
  const jpViewExamstroke = document.getElementById("jp-view-examstroke");
  const jpViewQuiz = document.getElementById("jp-view-quiz");
  const jpViewVocab = document.getElementById("jp-view-vocab");
  const jpViewVocabWords = document.getElementById("jp-view-vocab-words");
  const jpViewGrammar = document.getElementById("jp-view-grammar");
  const jpViewYoon = document.getElementById("jp-view-yoon");
  const jpViewMiniQuiz = document.getElementById("jp-view-mini-quiz");

  const jpVocabOpenBtn = document.getElementById("jp-vocab-open-btn");
  const jpVocabBackBtn = document.getElementById("jp-vocab-back-btn");
  const jpVocabCatGrid = document.getElementById("jp-vocab-cat-grid");
  const jpVocabWordsBackBtn = document.getElementById("jp-vocab-words-back-btn");
  const jpVocabWordsTitle = document.getElementById("jp-vocab-words-title");
  const jpVocabWordsList = document.getElementById("jp-vocab-words-list");
  const jpVocabQuizStartBtn = document.getElementById("jp-vocab-quiz-start-btn");

  const jpGrammarOpenBtn = document.getElementById("jp-grammar-open-btn");
  const jpGrammarBackBtn = document.getElementById("jp-grammar-back-btn");
  const jpGrammarList = document.getElementById("jp-grammar-list");
  const jpGrammarQuizStartBtn = document.getElementById("jp-grammar-quiz-start-btn");

  const jpYoonOpenBtn = document.getElementById("jp-yoon-open-btn");
  const jpYoonBackBtn = document.getElementById("jp-yoon-back-btn");
  const jpYoonGrid = document.getElementById("jp-yoon-grid");
  const jpYoonQuizStartBtn = document.getElementById("jp-yoon-quiz-start-btn");

  const jpMiniQuizBackBtn = document.getElementById("jp-mini-quiz-back-btn");
  const jpMiniQuizPrompt = document.getElementById("jp-mini-quiz-prompt");
  const jpMiniQuizChar = document.getElementById("jp-mini-quiz-char");
  const jpMiniQuizReading = document.getElementById("jp-mini-quiz-reading");
  const jpMiniQuizOptions = document.getElementById("jp-mini-quiz-options");
  const jpMiniQuizFeedback = document.getElementById("jp-mini-quiz-feedback");
  const jpMiniQuizScore = document.getElementById("jp-mini-quiz-score");

  const jpPhasesChar = document.getElementById("jp-phases-char");
  const jpPhasesProgress = document.getElementById("jp-phases-progress");
  const jpPhasesBackBtn = document.getElementById("jp-phases-back-btn");
  const jpPhasesNextBtn = document.getElementById("jp-phases-next-btn");
  const jpPhasesSpeakBtn = document.getElementById("jp-phases-speak-btn");
  const jpPhaseRow = document.getElementById("jp-phase-row");

  const jpExamstrokeChar = document.getElementById("jp-examstroke-char");
  const jpExamstrokeProgress = document.getElementById("jp-examstroke-progress");
  const jpExamstrokeBackBtn = document.getElementById("jp-examstroke-back-btn");
  const jpExamstrokeSkipBtn = document.getElementById("jp-examstroke-skip-btn");
  const jpExamSegments = document.getElementById("jp-exam-segments");
  const jpExamVocabSection = document.getElementById("jp-examstroke-vocab-section");
  const jpExamVocabGrid = document.getElementById("jp-examstroke-vocab-grid");

  const jpKanjiInfo = document.getElementById("jp-kanji-info");
  const jpKanjiOnyomiEl = document.getElementById("jp-kanji-onyomi");
  const jpKanjiKunyomiEl = document.getElementById("jp-kanji-kunyomi");
  const jpKanjiMeaningEl = document.getElementById("jp-kanji-meaning");
  const jpVocabSection = document.getElementById("jp-vocab-section");
  const jpVocabGrid = document.getElementById("jp-vocab-grid");
  const jpQuizBackBtn = document.getElementById("jp-quiz-back-btn");
  const jpQuizPromptEl = document.getElementById("jp-quiz-prompt");
  const jpQuizChar = document.getElementById("jp-quiz-char");
  const jpQuizSpeakBtn = document.getElementById("jp-quiz-speak-btn");
  const jpQuizOptions = document.getElementById("jp-quiz-options");
  const jpQuizFeedback = document.getElementById("jp-quiz-feedback");

  const hanziWriterOpenBtn = document.getElementById("jp-hanzi-writer-open-btn");
  const hanziWriterModal = document.getElementById("hanzi-writer-modal");
  const hanziWriterModalClose = document.getElementById("hanzi-writer-modal-close");
  const hanziViewGrid = document.getElementById("hanzi-view-grid");
  const hanziViewPractice = document.getElementById("hanzi-view-practice");
  const hanziHiraganaGrid = document.getElementById("hanzi-hiragana-grid");
  const hanziKatakanaGrid = document.getElementById("hanzi-katakana-grid");
  const hanziKanjiGrid = document.getElementById("hanzi-kanji-grid");
  const hanziPracticeBackBtn = document.getElementById("hanzi-practice-back-btn");
  const hanziWriterTarget = document.getElementById("hanzi-writer-target");
  const hanziCanvasStage = document.getElementById("hanzi-canvas-stage");
  const hanziQuizFeedback = document.getElementById("hanzi-quiz-feedback");
  const hanziAnimateBtn = document.getElementById("hanzi-animate-btn");
  const hanziQuizBtn = document.getElementById("hanzi-quiz-btn");
  const hanziResetBtn = document.getElementById("hanzi-reset-btn");

  const xpFill = document.getElementById("xp-fill");
  const xpText = document.getElementById("xp-text");
  const levelValue = document.getElementById("level-value");
  const streakValue = document.getElementById("streak-value");
  const hudBalanceGlobalEl = document.getElementById("hud-balance-global");
  const rankValue = document.getElementById("rank-value");
  const avatarRankTag = document.getElementById("avatar-rank-tag");
  const avatarHp = document.getElementById("avatar-hp");
  const avatarImg = document.getElementById("avatar-visual-img");
  const avatarScene = document.getElementById("avatarScene");
  const avatarStage = document.getElementById("avatarStage");
  const avatar3dStage = document.getElementById("avatar3dStage");
  const avatarSpeechBubble = document.getElementById("avatar-speech-bubble");
  const avatarSpeechText = document.getElementById("avatar-speech-text");
  const spiritualValue = document.getElementById("spiritual-value");
  const financeValue = document.getElementById("finance-value");
  const financeTier = document.getElementById("finance-tier");
  const diamondsValue = document.getElementById("diamonds-value");
  const goldValue = document.getElementById("gold-value");
  const currencySelect = document.getElementById("currency-select");
  const languageSelect = document.getElementById("language-select");
  const hudBannerText = document.getElementById("hud-banner-text");

  const wishlistGrid = document.getElementById("wishlist-grid");
  const wishlistCount = document.getElementById("wishlist-count");
  const wishlistForm = document.getElementById("wishlist-form");
  const wishlistInput = document.getElementById("wishlist-input");

  // Modal de Requisitos de Deseo (checklist por tarjeta)
  const wishlistItemModal = document.getElementById("wishlist-item-modal");
  const wishlistItemModalClose = document.getElementById("wishlist-item-modal-close");
  const wishlistItemModalIcon = document.getElementById("wishlist-item-modal-icon");
  const wishlistItemModalName = document.getElementById("wishlist-item-modal-name");
  const wishlistItemModalProgressFill = document.getElementById("wishlist-item-modal-progress-fill");
  const wishlistItemModalProgressText = document.getElementById("wishlist-item-modal-progress-text");
  const wishlistReqList = document.getElementById("wishlist-req-list");
  const wishlistReqForm = document.getElementById("wishlist-req-form");
  const wishlistReqInput = document.getElementById("wishlist-req-input");

  // Candado principal (Cuenta Principal: celular + contraseña)
  const masterAuthModal = document.getElementById("master-auth-modal");
  const masterAuthViewLogin = document.getElementById("master-auth-view-login");
  const masterAuthViewRegister = document.getElementById("master-auth-view-register");
  const masterLoginForm = document.getElementById("master-login-form");
  const masterLoginPhone = document.getElementById("master-login-phone");
  const masterLoginPassword = document.getElementById("master-login-password");
  const masterLoginError = document.getElementById("master-login-error");
  const masterRegisterForm = document.getElementById("master-register-form");
  const masterRegisterPhone = document.getElementById("master-register-phone");
  const masterRegisterPassword = document.getElementById("master-register-password");
  const masterRegisterPasswordConfirm = document.getElementById("master-register-password-confirm");
  const masterRegisterError = document.getElementById("master-register-error");
  const masterAuthGoRegisterBtn = document.getElementById("master-auth-go-register-btn");
  const masterAuthGoLoginBtn = document.getElementById("master-auth-go-login-btn");

  const welcomeModal = document.getElementById("welcome-modal");
  const welcomeViewChoice = document.getElementById("welcome-view-choice");
  const welcomeViewCreate = document.getElementById("welcome-view-create");
  const welcomeViewLogin = document.getElementById("welcome-view-login");
  const welcomeCreateBtn = document.getElementById("welcome-create-btn");
  const welcomeLoginBtn = document.getElementById("welcome-login-btn");
  const welcomeBackFromCreate = document.getElementById("welcome-back-from-create");
  const welcomeBackFromLogin = document.getElementById("welcome-back-from-login");
  const welcomeLoginCreateBtn = document.getElementById("welcome-login-create-btn");
  const registrationForm = document.getElementById("registration-form");
  const operatorNameInput = document.getElementById("operator-name-input");
  const profileName = document.getElementById("profile-name");
  const logoutBtn = document.getElementById("logout-btn");

  // Perfiles de Usuario (cuentas separadas, distinto de operatorName)
  const profileSwitchBtn = document.getElementById("profile-switch-btn");
  const activeProfileNameEl = document.getElementById("active-profile-name");
  const profileModal = document.getElementById("profile-modal");
  const profileModalClose = document.getElementById("profile-modal-close");
  const profileListEl = document.getElementById("profile-list");
  const profileCreateForm = document.getElementById("profile-create-form");
  const profileCreateInput = document.getElementById("profile-create-input");

  let activeMinigame = null;
  let pendingEvidenceImage = null;
  let activePillar = null; // pilar cuyo panel está visible ('finanzas' | 'fisico' | 'espiritual' | null)
  let meditationInterval = null;

  function formatTime(date) {
    return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }

  // ---------------- Avatar: emotes ----------------

  // 200ms para calzar con la transición opacity 0.2s de .layer-lion en
  // style.css (compartida con setAvatarState(), ver más abajo).
  const AVATAR_FADE_MS = 200;
  let avatarEmoteTimeout = null;

  // Cruza en fade la imagen actual con la del emote pedido. Como las 4
  // imágenes ya están precargadas, el cambio de `src` durante el fade-out
  // es instantáneo y nunca deja ver un hueco en blanco.
  function setAvatarEmote(emoteKey) {
    const src = AVATAR_EMOTES[emoteKey] || AVATAR_EMOTES.idle;
    if (avatarImg.getAttribute("src") === src) return;

    avatarImg.style.opacity = "0";
    setTimeout(() => {
      avatarImg.src = src;
      avatarImg.style.opacity = "1";
    }, AVATAR_FADE_MS);
  }

  // Muestra un emote temporal y programa el regreso a idle. Si ya había
  // un regreso a idle pendiente (ej. levelup seguido de victory), se
  // cancela para que gane siempre el emote más reciente.
  function playAvatarEmote(emoteKey, durationMs) {
    if (avatarEmoteTimeout) {
      clearTimeout(avatarEmoteTimeout);
      avatarEmoteTimeout = null;
    }
    setAvatarEmote(emoteKey);
    avatarEmoteTimeout = setTimeout(() => {
      avatarEmoteTimeout = null;
      setAvatarEmote("idle");
    }, durationMs);
  }

  // ---------------- Avatar: escena 3D Parallax ----------------
  // #avatarScene escucha el mouse y calcula la posición relativa del
  // cursor normalizada a [-1, 1] en cada eje; #avatarStage recibe la
  // rotación 3D del conjunto y cada capa (.layer-bg/.layer-props/
  // .layer-lion) recibe un desplazamiento propio proporcional a su
  // profundidad (data-depth, mismo valor que --depth en style.css) —
  // así las capas "cercanas" se mueven más que las "lejanas", dando la
  // ilusión de profundidad real. mouseleave restablece todo a reposo.
  const AVATAR_PARALLAX_MAX_TILT_DEG = 12;
  const AVATAR_PARALLAX_MAX_SHIFT_PX = 18;
  const AVATAR_PARALLAX_DEPTH_REF = 120; // profundidad "de referencia" para normalizar el desplazamiento
  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (avatarScene && avatarStage && !prefersReducedMotion) {
    const avatarLayers = Array.from(avatarStage.querySelectorAll(".layer-bg, .layer-props, .layer-lion"));
    const layerDepths = new Map(
      avatarLayers.map((layer) => [layer, parseFloat(getComputedStyle(layer).getPropertyValue("--depth")) || 0])
    );

    function resetAvatarParallax() {
      avatarStage.style.setProperty("--stage-rx", "0deg");
      avatarStage.style.setProperty("--stage-ry", "0deg");
      avatarLayers.forEach((layer) => {
        layer.style.setProperty("--layer-px", "0px");
        layer.style.setProperty("--layer-py", "0px");
      });
    }

    avatarScene.addEventListener("mousemove", (event) => {
      const rect = avatarScene.getBoundingClientRect();
      const relX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const relY = ((event.clientY - rect.top) / rect.height) * 2 - 1;

      const rotateY = relX * AVATAR_PARALLAX_MAX_TILT_DEG;
      const rotateX = -relY * AVATAR_PARALLAX_MAX_TILT_DEG;
      avatarStage.style.setProperty("--stage-rx", `${rotateX.toFixed(2)}deg`);
      avatarStage.style.setProperty("--stage-ry", `${rotateY.toFixed(2)}deg`);

      avatarLayers.forEach((layer) => {
        const factor = (layerDepths.get(layer) || 0) / AVATAR_PARALLAX_DEPTH_REF;
        const px = relX * AVATAR_PARALLAX_MAX_SHIFT_PX * factor;
        const py = relY * AVATAR_PARALLAX_MAX_SHIFT_PX * factor;
        layer.style.setProperty("--layer-px", `${px.toFixed(2)}px`);
        layer.style.setProperty("--layer-py", `${py.toFixed(2)}px`);
      });
    });

    avatarScene.addEventListener("mouseleave", resetAvatarParallax);
  }

  // ---------------- Avatar 3D (Three.js + .glb, solo desktop) ----------------
  // "Mobile Lite & Desktop Pro": en mobile (≤767px, ver style.css) este
  // bloque entero no se ejecuta — Three.js NUNCA se pide de la red ahí, ni
  // siquiera el intento de fetch del .glb. En desktop, es "mejor esfuerzo"
  // real: si assets/models/leon_nivel1.glb no existe todavía (caso de hoy)
  // o falla la carga por cualquier motivo, la escena PNG de #avatarScene
  // se queda exactamente como está — cero regresión visible. El día que se
  // agregue el .glb real en esa ruta, la escena 3D se activa sola en la
  // próxima carga, sin tocar código.
  const AVATAR_GLB_URL = "assets/models/leon_nivel1.glb";
  // El endpoint `+esm` de jsdelivr reescribe los imports internos "bare"
  // (GLTFLoader/OrbitControls hacen `import ... from 'three'` sin ruta) a
  // URLs resueltas — sin esto, el navegador no sabe qué es "three" y la
  // carga del módulo falla con "Failed to resolve module specifier".
  const THREE_CDN_BASE = "https://cdn.jsdelivr.net/npm/three@0.160.0";

  async function initAvatar3D() {
    if (!avatar3dStage || prefersReducedMotion) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return; // Mobile Lite: ni se intenta

    let THREE, GLTFLoader, OrbitControls;
    try {
      [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
        import(`${THREE_CDN_BASE}/+esm`),
        import(`${THREE_CDN_BASE}/examples/jsm/loaders/GLTFLoader.js/+esm`),
        import(`${THREE_CDN_BASE}/examples/jsm/controls/OrbitControls.js/+esm`),
      ]);
    } catch (err) {
      // Sin red / CDN bloqueado: se queda en la escena PNG de siempre, sin
      // romper nada — el mismo criterio de "mejor esfuerzo" que Supabase.
      console.warn("Avatar 3D: no se pudo cargar Three.js (se mantiene el avatar PNG):", err);
      return;
    }

    const loader = new GLTFLoader();
    loader.load(
      AVATAR_GLB_URL,
      (gltf) => {
        // Éxito: recién acá se revela #avatar3dStage y se oculta la
        // escena PNG — antes de esto ambas rutas de fallo (red o 404 del
        // propio .glb) dejan todo intacto.
        renderAvatar3DScene(THREE, OrbitControls, gltf);
        avatarScene.hidden = true;
        avatar3dStage.hidden = false;
      },
      undefined,
      (err) => {
        console.warn(`Avatar 3D: "${AVATAR_GLB_URL}" no existe todavía o no se pudo cargar — se mantiene el avatar PNG:`, err && err.message);
      }
    );
  }

  function renderAvatar3DScene(THREE, OrbitControls, gltf) {
    const width = avatar3dStage.clientWidth || 460;
    const height = avatar3dStage.clientHeight || 560;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    avatar3dStage.appendChild(renderer.domElement);

    // Iluminación Cyberpunk: un llenado tenue + 2 luces de borde cian/
    // magenta, mismo par de acentos neón que el resto de la interfaz, en
    // vez de una luz blanca genérica de catálogo 3D.
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const rimCyan = new THREE.PointLight(0x00f0ff, 3, 12);
    rimCyan.position.set(-2, 2, 2);
    scene.add(rimCyan);
    const rimMagenta = new THREE.PointLight(0xff2e9a, 2.2, 12);
    rimMagenta.position.set(2, 1, -2);
    scene.add(rimMagenta);

    scene.add(gltf.scene);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 7;
    controls.target.set(0, 1, 0);

    let frameId;
    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    const handleResize = () => {
      const w = avatar3dStage.clientWidth;
      const h = avatar3dStage.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Si la sesión no termina (SPA de una sola página, sin navegación
    // real), no hay un momento natural de "destruir" — se documenta acá
    // por si en el futuro este avatar pasa a abrirse/cerrarse dinámico,
    // que haría falta cancelAnimationFrame(frameId) + remover el listener.
  }

  initAvatar3D();

  // ---------------- Avatar: asistente guía (globo de diálogo) ----------------

  // Banner de copywriting motivacional del HUD superior — a diferencia de
  // AVATAR_TIPS (español fijo, ya establecido así en el resto de la app),
  // este SÍ pasa por el sistema de idiomas: vive arriba de todo, es lo
  // primero que se lee, así que conviene que respete el idioma activo.
  const HUD_BANNER_KEYS = [
    "hudBannerPhrase1",
    "hudBannerPhrase2",
    "hudBannerPhrase3",
    "hudBannerPhrase4",
    "hudBannerPhrase5",
  ];
  let hudBannerIndex = Math.floor(Math.random() * HUD_BANNER_KEYS.length);

  // Solo vuelve a traducir la frase ACTUAL en el idioma nuevo — no
  // sortea una frase distinta (eso lo hace pickRandomHudBanner()) para
  // que un cambio de idioma no se sienta como un cambio de frase.
  function renderHudBanner() {
    if (!hudBannerText) return;
    hudBannerText.textContent = t(HUD_BANNER_KEYS[hudBannerIndex]);
  }

  function pickRandomHudBanner() {
    if (HUD_BANNER_KEYS.length > 1) {
      let index = hudBannerIndex;
      while (index === hudBannerIndex) {
        index = Math.floor(Math.random() * HUD_BANNER_KEYS.length);
      }
      hudBannerIndex = index;
    }
    renderHudBanner();
  }

  const AVATAR_TIPS = [
    "Revisa tus Finanzas hoy — cada categoría cuenta.",
    "Tu Estado Físico también sube de nivel contigo.",
    "Un momento de silencio fortalece más que mil palabras.",
    "¡Atención! La tormenta se acerca — mantén tu enfoque.",
    "La Wishlist se desbloquea con cada logro. Sigue avanzando.",
    "¿Ya probaste hoy la Boss Fight?",
    "Cada Diamante cuenta una historia de disciplina.",
    "Tu Brújula del Norte refleja tu equilibrio interior.",
    "Puedes arrastrar la esquina del chat para agrandarlo.",
  ];

  let lastAvatarTipIndex = -1;

  function setAvatarSpeech(text) {
    if (!avatarSpeechBubble || !avatarSpeechText) return;
    avatarSpeechBubble.classList.add("avatar__speech-bubble--fading");
    setTimeout(() => {
      avatarSpeechText.textContent = text;
      avatarSpeechBubble.classList.remove("avatar__speech-bubble--fading");
    }, 180);
  }

  // Evita repetir el mismo consejo dos veces seguidas, igual que las
  // frases de los pilares.
  function showRandomAvatarTip() {
    let index = Math.floor(Math.random() * AVATAR_TIPS.length);
    if (AVATAR_TIPS.length > 1) {
      while (index === lastAvatarTipIndex) {
        index = Math.floor(Math.random() * AVATAR_TIPS.length);
      }
    }
    lastAvatarTipIndex = index;
    setAvatarSpeech(AVATAR_TIPS[index]);
  }

  function pulseAvatarStage() {
    if (!avatarStage) return;
    avatarStage.classList.add("stage-pulse");
    setTimeout(() => avatarStage.classList.remove("stage-pulse"), 600);
  }

  // ---------------- Expansión de Ciudades (mapa, se abre desde el avatar/León) ----------------
  // Puramente decorativo por ahora ("Próximamente"): sin coordenadas
  // reales ni librería de mapas, solo nodos-marcador sobre un fondo de
  // grilla (ver .city-map__grid en style.css). El Dashboard Financiero
  // General, que antes se abría con este mismo clic, ahora vive en el
  // botón [📊 Ver Dashboard Completo] dentro del Cuadro de Finanzas.
  const CITY_MAP_NODES = ["Toyokawa", "Gamagori", "Huancayo", "Lima", "Madrid"];

  function renderCityMapNodes() {
    cityMapGrid.innerHTML = "";
    CITY_MAP_NODES.forEach((city) => {
      const node = document.createElement("div");
      node.className = "city-map__node";

      const pin = document.createElement("span");
      pin.className = "city-map__node-pin";
      pin.textContent = "📍";

      const name = document.createElement("span");
      name.className = "city-map__node-name";
      name.textContent = city;

      node.append(pin, name);
      cityMapGrid.appendChild(node);
    });
  }

  function openCityMapModal() {
    renderCityMapNodes();
    cityMapModal.hidden = false;
  }

  function closeCityMapModal() {
    cityMapModal.hidden = true;
  }

  cityMapModalClose.addEventListener("click", closeCityMapModal);
  cityMapModal.addEventListener("click", (event) => {
    if (event.target === cityMapModal) closeCityMapModal();
  });
  if (cityMapOpenBtn) cityMapOpenBtn.addEventListener("click", openCityMapModal);

  // Modal de Skins del León (ver MIIKAERU_SKINS/skinUnlocked/
  // currentIdleLionSrc() arriba, fuera de este closure) — grid de
  // tarjetas, click en una desbloqueada la fija como `state.selectedSkin`
  // y refresca de inmediato el retrato si el avatar está en reposo.
  const skinsOpenBtn = document.getElementById("skins-open-btn");
  const skinsModal = document.getElementById("skins-modal");
  const skinsModalClose = document.getElementById("skins-modal-close");
  const skinsModalCloseBtn = document.getElementById("skins-modal-close-btn");
  const skinsGrid = document.getElementById("skins-grid");

  function renderSkinsGrid() {
    skinsGrid.innerHTML = "";
    MIIKAERU_SKINS.forEach((skin) => {
      const unlocked = skinUnlocked(skin, state.level);
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "skin-card" +
        (unlocked ? "" : " skin-card--locked") +
        (state.selectedSkin === skin.id ? " skin-card--selected" : "");
      card.disabled = !unlocked;

      const img = document.createElement("img");
      img.src = skin.src;
      img.alt = `Skin Nv. ${skin.nivelRequerido}`;
      img.loading = "lazy";
      card.appendChild(img);

      if (!unlocked) {
        const lockOverlay = document.createElement("span");
        lockOverlay.className = "skin-card__lock";
        lockOverlay.innerHTML = `🔒<span>Nv. ${skin.nivelRequerido}</span>`;
        card.appendChild(lockOverlay);
      } else {
        card.addEventListener("click", () => selectSkin(skin.id));
      }

      skinsGrid.appendChild(card);
    });
  }

  function selectSkin(skinId) {
    state.selectedSkin = state.selectedSkin === skinId ? null : skinId; // click de nuevo sobre el ya elegido = volver al carrusel de siempre
    persist();
    renderSkinsGrid();
    if (avatarCurrentState === "idle") {
      crossfadeAvatarLayer(document.getElementById("avatar-visual-img"), currentIdleLionSrc());
    }
  }

  function openSkinsModal() {
    renderSkinsGrid();
    skinsModal.hidden = false;
  }

  function closeSkinsModal() {
    skinsModal.hidden = true;
  }

  if (skinsOpenBtn) skinsOpenBtn.addEventListener("click", openSkinsModal);
  if (skinsModalClose) skinsModalClose.addEventListener("click", closeSkinsModal);
  if (skinsModalCloseBtn) skinsModalCloseBtn.addEventListener("click", closeSkinsModal);
  if (skinsModal) {
    skinsModal.addEventListener("click", (event) => {
      if (event.target === skinsModal) closeSkinsModal();
    });
  }

  // ---------------- Selección de Avatar Inicial (Fesha/Mijashi) ----------------
  // Ver PLAYER_CHARACTERS/faseActualPersonaje() arriba, fuera de este
  // closure. openCharacterSelectModal() se llama UNA vez, la primera vez
  // que el Operador entra (ver onMasterAuthSuccess()/registrationForm más
  // abajo) — sin botón de cerrar en el modal, es una elección obligatoria.
  const characterSelectModal = document.getElementById("character-select-modal");
  const characterSelectFeshaBtn = document.getElementById("character-select-fesha");
  const characterSelectMijashiBtn = document.getElementById("character-select-mijashi");
  const characterOpenBtn = document.getElementById("character-open-btn");
  const characterModal = document.getElementById("character-modal");
  const characterModalClose = document.getElementById("character-modal-close");
  const characterModalCloseBtn = document.getElementById("character-modal-close-btn");
  const characterModalName = document.getElementById("character-modal-name");
  const characterModalRank = document.getElementById("character-modal-rank");
  const characterModalImage = document.getElementById("character-modal-image");
  const characterModalPhaseTitle = document.getElementById("character-modal-phase-title");
  const characterEvolutionGrid = document.getElementById("character-evolution-grid");

  function openCharacterSelectModal() {
    if (characterSelectModal) characterSelectModal.hidden = false;
  }

  function chooseCharacter(idPersonaje) {
    state.playerCharacter = idPersonaje;
    persist();
    if (characterSelectModal) characterSelectModal.hidden = true;
    const personaje = PLAYER_CHARACTERS[idPersonaje];
    setAvatarSpeech(`${personaje.nombre} despierta contigo. Crecerá junto a cada nivel que alcances.`);
    playAvatarEmote("welcome", 3000);
  }

  if (characterSelectFeshaBtn) characterSelectFeshaBtn.addEventListener("click", () => chooseCharacter("fesha"));
  if (characterSelectMijashiBtn) characterSelectMijashiBtn.addEventListener("click", () => chooseCharacter("mijashi"));

  function renderCharacterModal() {
    const personaje = PLAYER_CHARACTERS[state.playerCharacter];
    if (!personaje) return;

    const faseActual = faseActualPersonaje(state.playerCharacter, state.level);
    characterModalName.textContent = personaje.nombre;
    characterModalRank.textContent = faseActual ? `${faseActual.rango} · Nv. ${faseActual.nivelRequerido}` : "—";
    characterModalPhaseTitle.textContent = faseActual ? faseActual.titulo : "—";
    if (faseActual) {
      characterModalImage.src = faseActual.src;
      characterModalImage.alt = `${personaje.nombre} — ${faseActual.titulo}`;
    }

    characterEvolutionGrid.innerHTML = "";
    personaje.evoluciones.forEach((fase) => {
      const unlocked = skinUnlocked(fase, state.level);
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "skin-card" +
        (unlocked ? "" : " skin-card--locked") +
        (faseActual && faseActual.id === fase.id ? " skin-card--selected" : "");
      card.disabled = true; // solo lectura: la fase avanza sola con el nivel, no se elige a mano

      const img = document.createElement("img");
      img.src = fase.src;
      img.alt = fase.titulo;
      img.loading = "lazy";
      card.appendChild(img);

      if (!unlocked) {
        const lockOverlay = document.createElement("span");
        lockOverlay.className = "skin-card__lock";
        lockOverlay.innerHTML = `🔒<span>Nv. ${fase.nivelRequerido}</span>`;
        card.appendChild(lockOverlay);
      }
      characterEvolutionGrid.appendChild(card);
    });
  }

  function openCharacterModal() {
    if (!state.playerCharacter) {
      openCharacterSelectModal();
      return;
    }
    renderCharacterModal();
    if (characterModal) characterModal.hidden = false;
  }

  function closeCharacterModal() {
    if (characterModal) characterModal.hidden = true;
  }

  if (characterOpenBtn) characterOpenBtn.addEventListener("click", openCharacterModal);
  if (characterModalClose) characterModalClose.addEventListener("click", closeCharacterModal);
  if (characterModalCloseBtn) characterModalCloseBtn.addEventListener("click", closeCharacterModal);
  if (characterModal) {
    characterModal.addEventListener("click", (event) => {
      if (event.target === characterModal) closeCharacterModal();
    });
  }

  // El Modal de Lore / Cuento Interactivo (se abre al hacer click en el
  // avatar/León) vive en su propio módulo, storyEngine.js — mismo patrón
  // de "punto de enchufe" que MiikaeruHub al inicio de este archivo.
  // alHacerClicEnAvatarLeon() lee sus propios DOM refs por id (no
  // comparte closure con este bloque) y solo necesita el nivel actual.

  // Bugs & Sugerencias: mismo patrón de "mejor esfuerzo" que
  // syncTransactionToSupabase() — si la tabla `feedback` todavía no
  // existe en Supabase (ver SQL entregado junto con este cambio) o no
  // hay internet, el error queda solo en consola y el formulario igual
  // confirma al usuario, porque no hay nada más que guardar localmente
  // que valga la pena persistir para este caso de uso.
  if (feedbackForm) {
    feedbackForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = feedbackMessage.value.trim();
      if (!message) return;

      feedbackStatus.hidden = true;
      feedbackStatus.classList.remove("feedback-section__status--error");

      if (!supabaseClient) {
        feedbackStatus.textContent = t("feedbackStatusOffline");
        feedbackStatus.classList.add("feedback-section__status--error");
        feedbackStatus.hidden = false;
        return;
      }

      supabaseClient
        .from("feedback")
        .insert({
          profile_id: activeProfileId,
          type: feedbackType.value,
          message,
        })
        .then(({ error }) => {
          if (error) {
            console.warn("Supabase: no se pudo guardar el feedback:", error.message);
            feedbackStatus.textContent = t("feedbackStatusError");
            feedbackStatus.classList.add("feedback-section__status--error");
          } else {
            feedbackStatus.textContent = t("feedbackStatusSuccess");
            feedbackForm.reset();
          }
          feedbackStatus.hidden = false;
        })
        .catch((err) => {
          console.warn("Supabase: fallo de red al guardar el feedback:", err);
          feedbackStatus.textContent = t("feedbackStatusError");
          feedbackStatus.classList.add("feedback-section__status--error");
          feedbackStatus.hidden = false;
        });
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !cityMapModal.hidden) closeCityMapModal();
  });

  if (avatarStage) {
    // Además del consejo de siempre, tocar a Miikaeru abre el Modal de
    // Lore vía storyEngine.js (antes abría el mapa de Expansión de
    // Ciudades, que se movió al ícono 🌐 del dock izquierdo — ver
    // #city-map-open-btn). MiikaeruStoryEngine es un módulo aparte, cargado
    // después de app.js — ver <script src="storyEngine.js"> en index.html.
    avatarStage.addEventListener("click", () => {
      showRandomAvatarTip();
      pulseAvatarStage();
      if (window.MiikaeruStoryEngine) window.MiikaeruStoryEngine.alHacerClicEnAvatarLeon({ nivel: state.level });
    });
    avatarStage.addEventListener("keydown", (event) => {
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        showRandomAvatarTip();
        pulseAvatarStage();
        if (window.MiikaeruStoryEngine) window.MiikaeruStoryEngine.alHacerClicEnAvatarLeon({ nivel: state.level });
      }
    });
  }

  // ---------------- Login de Administrador (Supabase Auth real) ----------------
  // isSuperAdmin es solo un flag de UI (para decidir qué mostrar/ocultar
  // sin parpadeos) — la protección REAL vive del lado de Supabase: las
  // políticas RLS de `feedback` exigen que el JWT autenticado tenga
  // exactamente el email de ADMIN_EMAIL (ver SQL entregado junto con
  // este cambio), así que aunque alguien fuerce isSuperAdmin=true desde
  // la consola del navegador, Supabase seguiría rechazando sus pedidos.
  let isSuperAdmin = false;

  function applySuperAdminVisibility() {
    adminPanelOpenBtn.hidden = !isSuperAdmin;
    inspectorOpenBtn.hidden = !isSuperAdmin;
    adminLoginTriggerBtn.textContent = isSuperAdmin ? t("adminLogoutTriggerBtn") : t("adminLoginTriggerBtn");
    if (!isSuperAdmin) closeAdminPanel();
  }

  // Se llama una vez al cargar la página: si ya había una sesión de
  // Supabase Auth válida (persistida por la propia librería en
  // localStorage) y su email coincide, restaura el rol sin pedir login
  // de nuevo — mismo criterio que cualquier sesión web normal.
  async function checkAdminSession() {
    if (!supabaseClient) return;
    try {
      const { data } = await supabaseClient.auth.getSession();
      const email = data && data.session && data.session.user && data.session.user.email;
      isSuperAdmin = !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    } catch (err) {
      console.warn("Supabase: no se pudo verificar la sesión de administrador:", err);
      isSuperAdmin = false;
    }
    applySuperAdminVisibility();
  }

  // Al volver de suspensión/inactividad (la pestaña pasa de "hidden" a
  // "visible"), se revalida la sesión de inmediato en vez de esperar
  // pasivamente a la próxima llamada a Supabase — getSession() dispara
  // el refresco del access token si hace falta y el refresh token
  // sigue siendo válido, sin pedirle nada al usuario. Los timers de
  // autoRefreshToken del SDK se pausan mientras el sistema duerme; este
  // listener es lo que "despierta" el chequeo apenas la pestaña vuelve
  // a primer plano. Si el refresh token YA expiró de verdad (tras mucha
  // inactividad real), esto simplemente deja isSuperAdmin en false y el
  // botón vuelve a mostrar "Acceder como Admin" — comportamiento
  // correcto, no un bug.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkAdminSession();
  });

  function openAdminLoginModal() {
    adminLoginError.hidden = true;
    adminLoginEmailInput.value = "";
    adminLoginPasswordInput.value = "";
    adminLoginModal.hidden = false;
  }

  function closeAdminLoginModal() {
    adminLoginModal.hidden = true;
  }

  adminLoginTriggerBtn.addEventListener("click", async () => {
    if (isSuperAdmin) {
      if (supabaseClient) await supabaseClient.auth.signOut();
      isSuperAdmin = false;
      applySuperAdminVisibility();
      addMessage({ author: "SISTEMA", text: t("adminLogoutMessage"), variant: "system" });
    } else {
      openAdminLoginModal();
    }
  });
  adminLoginModalClose.addEventListener("click", closeAdminLoginModal);
  adminLoginModal.addEventListener("click", (event) => {
    if (event.target === adminLoginModal) closeAdminLoginModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !adminLoginModal.hidden) closeAdminLoginModal();
  });

  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    adminLoginError.hidden = true;

    if (!supabaseClient) {
      adminLoginError.textContent = t("adminPanelNoClient");
      adminLoginError.hidden = false;
      return;
    }

    const email = adminLoginEmailInput.value.trim();
    const password = adminLoginPasswordInput.value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      adminLoginError.textContent = t("adminLoginError");
      adminLoginError.hidden = false;
      return;
    }

    const sessionEmail = data && data.user && data.user.email;
    if (!sessionEmail || sessionEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      // Autenticación válida, pero NO es la cuenta de administrador —
      // se cierra la sesión de inmediato en vez de dejarla "a medias".
      // No es una cortina de UI: el rechazo real vuelve a pasar del
      // lado de Supabase (RLS) si alguien saltea este chequeo.
      await supabaseClient.auth.signOut();
      adminLoginError.textContent = t("adminLoginNotAuthorized");
      adminLoginError.hidden = false;
      return;
    }

    isSuperAdmin = true;
    applySuperAdminVisibility();
    closeAdminLoginModal();
    addMessage({ author: "SISTEMA", text: t("adminLoginSuccessMessage"), variant: "system" });
  });

  // ---------------- Panel de Administrador (Supabase) ----------------
  // Lee la tabla `transactions` de Supabase (respaldo en la nube del
  // ledger de negocios, ver syncTransactionToSupabase() arriba del todo
  // del archivo) — NO el ledger local, para que sirva también para ver
  // el consolidado desde otro dispositivo. Ya no hace falta un candado
  // de contraseña acá adentro: si el botón que abrió este modal era
  // visible, es porque isSuperAdmin ya es true (ver
  // applySuperAdminVisibility() arriba) — openAdminPanel() igual
  // revalida por las dudas, como red de seguridad de UI.
  let adminPanelRows = [];

  function showAdminPanelTab(target) {
    document.querySelectorAll(".admin-panel-tab").forEach((btn) => {
      btn.classList.toggle("admin-panel-tab--active", btn.dataset.adminTab === target);
    });
    adminPanelTabTransactions.hidden = target !== "transactions";
    adminPanelTabInspector.hidden = target !== "inspector";
    adminPanelTabAutomation.hidden = target !== "automation";
    if (target === "inspector") fetchInspectorFeedback();
    if (target === "automation") {
      fetchAutomationTasks();
      wireAutomationRealtime();
    }
  }

  adminPanelTabs.addEventListener("click", (event) => {
    const tabBtn = event.target.closest(".admin-panel-tab");
    if (!tabBtn) return;
    showAdminPanelTab(tabBtn.dataset.adminTab);
  });

  function openAdminPanel(defaultTab) {
    if (!isSuperAdmin) return;
    showAdminPanelTab(defaultTab);
    adminPanelModal.hidden = false;
    if (defaultTab === "transactions") fetchAdminPanelTransactions();
  }

  function closeAdminPanel() {
    adminPanelModal.hidden = true;
  }

  adminPanelOpenBtn.addEventListener("click", () => openAdminPanel("transactions"));
  inspectorOpenBtn.addEventListener("click", () => openAdminPanel("inspector"));
  adminPanelModalClose.addEventListener("click", closeAdminPanel);
  adminPanelModal.addEventListener("click", (event) => {
    if (event.target === adminPanelModal) closeAdminPanel();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !adminPanelModal.hidden) closeAdminPanel();
  });

  function setAdminPanelStatus(text) {
    adminPanelStatus.textContent = text;
  }

  // Formatea un monto con SU PROPIA moneda guardada en la fila (cada
  // transacción respaldó la moneda vigente al momento de sincronizarse,
  // ver syncTransactionToSupabase()) — a diferencia del Dashboard local,
  // acá pueden convivir filas de distintas monedas si el negocio cambió
  // de moneda entre una sincronización y otra.
  function formatAdminAmount(value, currencyCode) {
    return formatCurrency(Number(value) || 0, currencyCode || state.currency);
  }

  function renderAdminPanelTable(rows) {
    adminPanelTableBody.innerHTML = "";
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      const cells = [
        row.txn_date ? new Date(row.txn_date).toLocaleDateString(calendarLocale()) : "—",
        row.business_name || "—",
        row.collaborator || "—",
        row.metodo_pago || "—",
        formatAdminAmount(row.ingreso_bruto, row.currency),
        formatAdminAmount(row.egresos, row.currency),
        formatAdminAmount(row.ganancia_neta, row.currency),
      ];
      cells.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
      adminPanelTableBody.appendChild(tr);
    });
  }

  function fetchAdminPanelTransactions() {
    if (!supabaseClient) {
      setAdminPanelStatus(t("adminPanelNoClient"));
      return;
    }
    setAdminPanelStatus(t("adminPanelLoading"));
    adminPanelTableBody.innerHTML = "";
    supabaseClient
      .from("transactions")
      .select("*")
      .order("txn_date", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          // Caso esperado hasta que se cree la tabla `transactions` en
          // Supabase (ver SQL entregado junto con este cambio) — mensaje
          // honesto en vez de una tabla vacía sin explicación.
          adminPanelRows = [];
          setAdminPanelStatus(`${t("adminPanelError")} ${error.message}`);
          return;
        }
        adminPanelRows = data || [];
        renderAdminPanelTable(adminPanelRows);
        setAdminPanelStatus(`${t("adminPanelRowCount")} ${adminPanelRows.length}`);
      })
      .catch(() => {
        adminPanelRows = [];
        setAdminPanelStatus(t("adminPanelNetworkError"));
      });
  }

  adminPanelRefreshBtn.addEventListener("click", fetchAdminPanelTransactions);

  // Exporta EXACTAMENTE las filas ya cargadas en pantalla (no vuelve a
  // pedirle nada a Supabase) — descarga real vía Blob + <a download>, sin
  // depender de ningún backend propio para generar el archivo.
  adminPanelExportBtn.addEventListener("click", () => {
    if (!adminPanelRows.length) return;
    const header = ["Fecha", "Negocio", "Colaborador", "Método de Pago", "Ingreso Bruto", "Gastos", "Ganancia Neta", "Moneda"];
    const csvRows = adminPanelRows.map((row) => [
      row.txn_date || "",
      row.business_name || "",
      row.collaborator || "",
      row.metodo_pago || "",
      row.ingreso_bruto ?? "",
      row.egresos ?? "",
      row.ganancia_neta ?? "",
      row.currency || "",
    ]);
    const csv = [header, ...csvRows]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `miikaeru-transacciones-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ---------------- Agente Inspector (auditoría de feedback) ----------------
  // Lee/actualiza la tabla `feedback` (Bugs & Sugerencias, ver
  // #feedback-form en el modal del León) — a diferencia de la lectura de
  // `transactions` de arriba (permitida a cualquiera vía RLS, son datos
  // ya resumidos), leer y ACTUALIZAR `feedback` requiere estar
  // autenticado como ADMIN_EMAIL (ver política RLS en el SQL entregado
  // junto con este cambio) — sin sesión de administrador válida, estas
  // llamadas devuelven error de RLS aunque isSuperAdmin esté en true acá
  // (ver nota arriba: esa es justamente la diferencia con una cortina
  // de UI).
  let inspectorRows = [];

  function setInspectorStatus(text) {
    inspectorStatus.textContent = text;
  }

  // Estados posibles: "pendiente" (default al crear el reporte, ver
  // #feedback-form) → "aprobado" (✅, en cola de trabajo) o "descartado"
  // (❌, archivado) → un reporte aprobado puede pasar a "resuelto"
  // (✔️, ya solucionado/desplegado). "Dejar sin tocar" simplemente no
  // hace ninguna llamada: el reporte sigue en "pendiente".
  function renderInspectorStats(rows) {
    const counts = { pendiente: 0, aprobado: 0, descartado: 0, resuelto: 0 };
    rows.forEach((row) => {
      const status = row.status || "pendiente";
      if (counts[status] !== undefined) counts[status] += 1;
    });
    inspectorStatTotal.textContent = rows.length;
    inspectorStatPending.textContent = counts.pendiente;
    inspectorStatApproved.textContent = counts.aprobado;
    inspectorStatResolved.textContent = counts.resuelto;
  }

  function updateFeedbackStatus(id, status) {
    if (!supabaseClient) return;
    supabaseClient
      .from("feedback")
      .update({ status })
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.warn("Supabase: no se pudo actualizar el estado del reporte:", error.message);
          setInspectorStatus(`${t("adminPanelError")} ${error.message}`);
          return;
        }
        fetchInspectorFeedback();
      })
      .catch((err) => {
        console.warn("Supabase: fallo de red al actualizar el reporte:", err);
        setInspectorStatus(t("adminPanelNetworkError"));
      });
  }

  function renderInspectorCards(rows) {
    inspectorCards.innerHTML = "";
    rows.forEach((row) => {
      const status = row.status || "pendiente";
      const card = document.createElement("div");
      card.className = "inspector-card";

      const header = document.createElement("div");
      header.className = "inspector-card__header";
      const date = row.created_at ? new Date(row.created_at).toLocaleDateString(calendarLocale()) : "—";
      const typeLabel = row.type === "suggestion" ? t("feedbackTypeSuggestion") : t("feedbackTypeBug");
      const dateSpan = document.createElement("span");
      dateSpan.textContent = `${date} · ${typeLabel}`;
      const statusSpan = document.createElement("span");
      statusSpan.className = `inspector-card__status inspector-card__status--${status}`;
      statusSpan.textContent = t(`inspectorStatus_${status}`);
      header.append(dateSpan, statusSpan);

      const message = document.createElement("p");
      message.className = "inspector-card__message";
      message.textContent = row.message || "";

      const actions = document.createElement("div");
      actions.className = "inspector-card__actions";

      if (status === "pendiente") {
        const approveBtn = document.createElement("button");
        approveBtn.type = "button";
        approveBtn.className = "inspector-card__approve";
        approveBtn.textContent = t("inspectorApproveBtn");
        approveBtn.addEventListener("click", () => updateFeedbackStatus(row.id, "aprobado"));

        const discardBtn = document.createElement("button");
        discardBtn.type = "button";
        discardBtn.className = "inspector-card__discard";
        discardBtn.textContent = t("inspectorDiscardBtn");
        discardBtn.addEventListener("click", () => updateFeedbackStatus(row.id, "descartado"));

        actions.append(approveBtn, discardBtn);
      } else if (status === "aprobado") {
        const resolveBtn = document.createElement("button");
        resolveBtn.type = "button";
        resolveBtn.className = "inspector-card__resolve";
        resolveBtn.textContent = t("inspectorResolveBtn");
        resolveBtn.addEventListener("click", () => updateFeedbackStatus(row.id, "resuelto"));
        actions.append(resolveBtn);
      }

      card.append(header, message);
      if (actions.children.length) card.appendChild(actions);
      inspectorCards.appendChild(card);
    });
  }

  function fetchInspectorFeedback() {
    if (!supabaseClient) {
      setInspectorStatus(t("adminPanelNoClient"));
      return;
    }
    setInspectorStatus(t("adminPanelLoading"));
    inspectorCards.innerHTML = "";
    supabaseClient
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          // Caso esperado hasta que se corra el SQL de esta actualización
          // (columna `status` + política RLS de admin) contra la tabla
          // `feedback` que ya existe desde el Bloque 35.
          inspectorRows = [];
          renderInspectorStats([]);
          setInspectorStatus(`${t("adminPanelError")} ${error.message}`);
          return;
        }
        inspectorRows = data || [];
        renderInspectorStats(inspectorRows);
        renderInspectorCards(inspectorRows);
        setInspectorStatus(`${t("adminPanelRowCount")} ${inspectorRows.length}`);
      })
      .catch(() => {
        inspectorRows = [];
        setInspectorStatus(t("adminPanelNetworkError"));
      });
  }

  inspectorRefreshBtn.addEventListener("click", fetchInspectorFeedback);

  // ---------------- Automatización (n8n → Supabase → esta pestaña) ----------------
  //
  // `automation_tasks` es la tabla que n8n (flujo externo, puerto 5678, ver
  // AUTOMATION_WORKFLOW.md) llena directo vía su propia API REST de
  // Supabase — no hay ningún webhook ni endpoint en este código que n8n
  // llame. La app solo LEE esa tabla (y actualiza `status`/`payload` cuando
  // un admin marca una tarea completada/fallida), igual que ya hace con
  // `feedback` en el Agente Inspector de arriba.
  //
  // Esquema REAL de la tabla (el usuario corrió una versión simplificada
  // del SQL propuesto — solo id/title/status/payload jsonb/created_at/
  // updated_at, sin columnas separadas para description/type/priority/
  // affected_files/notes): el resto de los campos que documentaba
  // approved_tasks.json vive adentro de `payload` como un objeto suelto
  // (`payload.description`, `payload.type`, etc.) en vez de columnas
  // propias — n8n decide qué mete ahí, este código solo lee lo que
  // encuentra y no asume que ningún campo de `payload` vaya a estar
  // presente.
  let automationRows = [];
  let automationRealtimeChannel = null;

  function setAutomationStatus(text) {
    automationStatus.textContent = text;
  }

  function renderAutomationStats(rows) {
    const counts = { pending: 0, approved: 0, discarded: 0 };
    rows.forEach((row) => {
      const status = row.status || "pending";
      if (counts[status] !== undefined) counts[status] += 1;
    });
    automationStatTotal.textContent = rows.length;
    automationStatPending.textContent = counts.pending;
    automationStatApproved.textContent = counts.approved;
    automationStatDiscarded.textContent = counts.discarded;
  }

  function updateAutomationTaskStatus(row, status, notes) {
    if (!supabaseClient) return;
    const payload = Object.assign({}, row.payload || {}, notes ? { notes } : {});
    supabaseClient
      .from("automation_tasks")
      .update({ status, payload, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .then(({ error }) => {
        if (error) {
          console.warn("Supabase: no se pudo actualizar la tarea de automatización:", error.message);
          setAutomationStatus(`${t("adminPanelError")} ${error.message}`);
          return;
        }
        fetchAutomationTasks();
      })
      .catch((err) => {
        console.warn("Supabase: fallo de red al actualizar la tarea de automatización:", err);
        setAutomationStatus(t("adminPanelNetworkError"));
      });
  }

  function renderAutomationCards(rows) {
    automationCards.innerHTML = "";
    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "inspector-card__message";
      empty.textContent = t("automationEmptyState");
      automationCards.appendChild(empty);
      return;
    }
    rows.forEach((row) => {
      const status = row.status || "pending";
      const payload = row.payload || {};
      const card = document.createElement("div");
      card.className = "inspector-card";

      const header = document.createElement("div");
      header.className = "inspector-card__header";
      const date = row.created_at ? new Date(row.created_at).toLocaleDateString(calendarLocale()) : "—";
      const metaSpan = document.createElement("span");
      metaSpan.textContent = `${date} · ${payload.type || "—"} · ${payload.priority || "—"} · ${payload.source || "—"}`;
      const statusSpan = document.createElement("span");
      statusSpan.className = `inspector-card__status inspector-card__status--${status}`;
      statusSpan.textContent = t(`automationStatus_${status}`) || status;
      header.append(metaSpan, statusSpan);

      const title = document.createElement("p");
      title.className = "inspector-card__message";
      title.style.fontWeight = "700";
      title.textContent = row.title || "";

      const description = document.createElement("p");
      description.className = "inspector-card__message";
      description.textContent = payload.description || "";

      card.append(header, title, description);

      if (Array.isArray(payload.affected_files) && payload.affected_files.length) {
        const files = document.createElement("p");
        files.className = "inspector-card__message";
        files.style.opacity = "0.7";
        files.style.fontSize = "0.75rem";
        files.textContent = payload.affected_files.join(", ");
        card.appendChild(files);
      }

      if (status === "pending") {
        // Tres opciones pedidas explícitamente: Aprobar/Ejecutar, Descartar,
        // o no tocar nada (se queda pendiente sola, sin acción). "Aprobar"
        // solo cambia `status` a "approved" en Supabase — NO dispara ningún
        // ejecutor automático de código (no existe ninguno, ver
        // AUTOMATION_WORKFLOW.md); es la señal de "listo para pasar al
        // flujo de desarrollo local", que hoy sigue siendo manual.
        const actions = document.createElement("div");
        actions.className = "inspector-card__actions";

        const approveBtn = document.createElement("button");
        approveBtn.type = "button";
        approveBtn.className = "inspector-card__approve";
        approveBtn.textContent = t("automationApproveBtn");
        approveBtn.addEventListener("click", () => updateAutomationTaskStatus(row, "approved", null));

        const discardBtn = document.createElement("button");
        discardBtn.type = "button";
        discardBtn.className = "inspector-card__discard";
        discardBtn.textContent = t("automationDiscardBtn");
        discardBtn.addEventListener("click", () => updateAutomationTaskStatus(row, "discarded", null));

        actions.append(approveBtn, discardBtn);
        card.appendChild(actions);
      } else if (payload.notes) {
        const notes = document.createElement("p");
        notes.className = "inspector-card__message";
        notes.style.fontStyle = "italic";
        notes.textContent = payload.notes;
        card.appendChild(notes);
      }

      automationCards.appendChild(card);
    });
  }

  function fetchAutomationTasks() {
    if (!supabaseClient) {
      setAutomationStatus(t("adminPanelNoClient"));
      return;
    }
    setAutomationStatus(t("adminPanelLoading"));
    supabaseClient
      .from("automation_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          // Caso esperado hasta que se corra el SQL que crea la tabla
          // `automation_tasks` — ver AUTOMATION_WORKFLOW.md.
          automationRows = [];
          renderAutomationStats([]);
          renderAutomationCards([]);
          setAutomationStatus(`${t("adminPanelError")} ${error.message}`);
          return;
        }
        automationRows = data || [];
        renderAutomationStats(automationRows);
        renderAutomationCards(automationRows);
        setAutomationStatus(`${t("automationRowCount")} ${automationRows.length}`);
      })
      .catch(() => {
        automationRows = [];
        setAutomationStatus(t("adminPanelNetworkError"));
      });
  }

  // Suscripción realtime: una fila nueva que n8n inserte en Supabase
  // aparece acá sin que el admin tenga que tocar "Actualizar" — pedido
  // explícito de sincronización "en tiempo real". Se conecta una sola vez
  // (guardia `automationRealtimeChannel`), la primera vez que se abre esta
  // pestaña, y vive mientras dure la sesión de la página.
  function wireAutomationRealtime() {
    if (automationRealtimeChannel || !supabaseClient) return;
    automationRealtimeChannel = supabaseClient
      .channel("automation_tasks_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "automation_tasks" },
        () => fetchAutomationTasks()
      )
      .subscribe();
  }

  automationRefreshBtn.addEventListener("click", fetchAutomationTasks);

  // ---------------- Chat ----------------

  function renderChatHistory() {
    chatFeed.innerHTML = "";
    state.chatHistory.forEach((entry) => renderMessage(entry, false));
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  function renderMessage(entry, scroll = true) {
    const message = document.createElement("div");
    message.className = `message message--${entry.variant}`;

    const authorEl = document.createElement("span");
    authorEl.className = "message__author";
    authorEl.textContent = entry.author;

    const textEl = document.createElement("p");
    textEl.className = "message__text";
    textEl.textContent = entry.text;

    message.append(authorEl, textEl);

    if (entry.image) {
      const imgEl = document.createElement("img");
      imgEl.className = "message__image";
      imgEl.src = entry.image;
      imgEl.alt = "Evidencia adjunta";
      message.appendChild(imgEl);
    }

    const timeEl = document.createElement("span");
    timeEl.className = "message__time";
    timeEl.textContent = entry.time || formatTime(new Date());
    message.appendChild(timeEl);

    chatFeed.appendChild(message);
    if (scroll) chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  function addMessage({ author, text, variant, image }) {
    const entry = { author, text, variant, time: formatTime(new Date()), image: image || null };
    state.chatHistory.push(entry);
    if (state.chatHistory.length > 60) {
      state.chatHistory = state.chatHistory.slice(-60);
    }
    renderMessage(entry);
    persist();
  }

  // ---------------- HUD / progreso ----------------

  function renderHud() {
    levelValue.textContent = state.level;
    rankValue.textContent = rankForLevel(state.level);
    avatarRankTag.textContent = rankForLevel(state.level);

    const percent = Math.min(100, Math.round((state.xp / state.xpToNext) * 100));
    xpFill.style.width = `${percent}%`;
    xpText.textContent = `${state.xp.toLocaleString("es-ES")} / ${state.xpToNext.toLocaleString("es-ES")}`;

    spiritualValue.textContent = state.pillars.espiritual.estado;
    avatarHp.textContent = `HP ${Math.round(state.pillars.fisico.energy)}%`;

    currencySelect.value = state.currency;
    financeValue.textContent = formatCurrency(state.pillars.finanzas.balance, state.currency);
    financeTier.textContent = `Nivel ${state.pillars.finanzas.tier}`;
    diamondsValue.textContent = state.diamonds.toLocaleString("es-ES");
    goldValue.textContent = state.gold.toLocaleString("es-ES");
    streakValue.textContent = state.streak;
  }

  // NOTA: addDiamonds() se deja tal cual (no se borra la lógica existente),
  // pero ya no se llama desde ningún flujo de recompensa del juego — los
  // Diamantes solo deberían aumentar vía una futura compra con dinero real.
  function addDiamonds(amount) {
    state.diamonds += amount;
    diamondsValue.textContent = state.diamonds.toLocaleString("es-ES");
    persist();
  }

  // Oro (🪙): recompensa real de todas las lecciones/misiones, junto con XP.
  function addGold(amount) {
    state.gold += amount;
    goldValue.textContent = state.gold.toLocaleString("es-ES");
    persist();
  }

  function grantXP(amount) {
    state.xp += amount;
    let levelsGained = 0;

    while (state.xp >= state.xpToNext) {
      state.xp -= state.xpToNext;
      state.level += 1;
      state.xpToNext = Math.round(state.xpToNext * 1.15);
      levelsGained += 1;
    }

    if (levelsGained > 0) {
      checkWishlistUnlocks();
      addGold(levelsGained * 10);
      playAvatarEmote("levelup", 3500);
      setAvatarSpeech(`¡Subiste a Nivel ${state.level}! Sigue así, ${state.operatorName || "Operador"}.`);
      addMessage({
        author: "SISTEMA",
        text: `Subiste a Nivel ${state.level} · Rango ${rankForLevel(state.level)}. +${levelsGained * 10} 🪙`,
        variant: "system",
      });
    }

    renderHud();
    persist();
  }

  currencySelect.addEventListener("change", () => {
    state.currency = currencySelect.value;
    persist();
    renderHud();
    // El resumen del panel de Finanzas formatea sus propios montos y no se
    // refresca solo con renderHud(), por eso hay que recalcularlo aquí también.
    updateFinanzasCurrencySymbols();
    updateFinanzasSummary();
  });

  // ---------------- Idioma ----------------

  function applyLanguage(lang) {
    currentLanguage = I18N[lang] ? lang : "es";
    localStorage.setItem(LANGUAGE_KEY, currentLanguage);
    languageSelect.value = currentLanguage;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.title = t(el.getAttribute("data-i18n-title"));
    });

    // Banner del HUD: mismo índice, texto en el idioma nuevo (ver
    // comentario en renderHudBanner()).
    renderHudBanner();

    // adminLoginTriggerBtn también tiene [data-i18n] (para el caso
    // default "no logueado"), pero applySuperAdminVisibility() lo
    // sobreescribe según isSuperAdmin — el loop genérico de arriba
    // acaba de resetearlo, así que se vuelve a aplicar acá para que un
    // cambio de idioma no le "borre" el estado real de la sesión.
    applySuperAdminVisibility();

    // El estado del Boss Fight y el botón Iniciar/Detener se escriben
    // dinámicamente desde JS, así que se retraducen aparte según si hay
    // una partida activa, para no perder el idioma a mitad de juego.
    if (activeMinigame) {
      minigameStatus.textContent = t("bossStatusCombat");
      minigamePlaceholder.textContent = t("bossFighting");
      playBtn.textContent = t("bossStop");
    } else {
      minigameStatus.textContent = t("bossStatusStandby");
      minigamePlaceholder.textContent = t("bossWaiting");
      playBtn.textContent = t("bossStart");
    }

    // Igual que arriba: si hay un módulo placeholder "próximamente" activo
    // (Hábitos o Karaoke comparten el mismo modal — ver APP_MODULES), su
    // ícono/título/texto se escribieron dinámicamente (no tienen
    // [data-i18n] porque dependen de qué app esté seleccionada) — se
    // vuelve a correr su mismo onOpen() para retraducirlos. applyLanguage()
    // solo se llama después de que APP_MODULES/activeApp ya existen (al
    // final del script y desde el listener de #language-select).
    const activeAppInfo = APP_MODULES[activeApp];
    if (activeApp === "habits" || activeApp === "karaoke") {
      activeAppInfo.onOpen();
    }
    // Las etiquetas "Fila X" de la cuadrícula Gojuon también se generan
    // dinámicamente (formatGojuonRowLabel usa currentLanguage) — se
    // reconstruye aunque la sub-vista visible sea trazo/quiz, para que
    // quede lista si el usuario vuelve a la cuadrícula.
    if (activeAppInfo && activeAppInfo.view === "japanese") {
      renderGojuonGrid();
    }
  }

  languageSelect.addEventListener("change", () => {
    applyLanguage(languageSelect.value);
  });

  // ---------------- Pilares (coaching) ----------------

  const pillarPrompts = {
    finanzas: "Quiero avanzar en mi pilar de Finanzas.",
    fisico: "Quiero avanzar en mi pilar de Estado Físico.",
    espiritual: "Quiero avanzar en mi pilar de Estado Espiritual.",
  };

  // ---- Navegación dinámica de pilares: un solo panel visible a la vez ----

  function hideAllPillarPanels() {
    finanzasPanel.hidden = true;
    fisicoPanel.hidden = true;
    espiritualPanel.hidden = true;
    aprendizajePanel.hidden = true;
  }

  // Las herramientas de pilares viven en un modal aparte (ver index.html)
  // para que el panel de chat sea únicamente feed + input, sin scrolls
  // anidados. Este helper es el único punto que las cierra.
  function closePillarModal() {
    hideAllPillarPanels();
    activePillar = null;
    pillarModal.hidden = true;
  }

  function togglePillarPanel(pillar) {
    const panels = { finanzas: finanzasPanel, fisico: fisicoPanel, espiritual: espiritualPanel, aprendizaje: aprendizajePanel };
    const target = panels[pillar];
    if (!target) return;

    // La variable `activePillar` es la única fuente de verdad para decidir
    // qué panel toca mostrar — no se lee `.hidden` del DOM, así se evita
    // cualquier desincronización si otro handler (ej. Guardar) tocara el DOM.
    const wasActive = activePillar === pillar;

    if (wasActive) {
      closePillarModal();
      return;
    }

    hideAllPillarPanels();
    target.hidden = false;
    pillarModal.hidden = false;
    activePillar = pillar;

    if (pillar === "fisico") refreshStepsFromProvider();
    if (pillar === "finanzas") renderFinanzasGlobalSummary();
  }

  pillarModalClose.addEventListener("click", closePillarModal);
  pillarModal.addEventListener("click", (event) => {
    if (event.target === pillarModal) closePillarModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !pillarModal.hidden) closePillarModal();
  });

  // ---- Chat y Wishlist: mismo patrón de modal anidado (rediseño HUD) ----
  function openChatModal() {
    chatModal.hidden = false;
  }
  function closeChatModal() {
    chatModal.hidden = true;
  }
  chatOpenBtn.addEventListener("click", openChatModal);
  chatModalClose.addEventListener("click", closeChatModal);
  chatModal.addEventListener("click", (event) => {
    if (event.target === chatModal) closeChatModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !chatModal.hidden) closeChatModal();
  });

  // Chat Guía: resalta con un parpadeo neón el ícono del dock al que la
  // respuesta hace referencia (ver CHAT_GUIDE_INTENTS/matchChatGuideIntent
  // arriba del todo del archivo). El dock vive DETRÁS del backdrop oscuro
  // del modal de chat (.modal-overlay, opacity 0.75 + blur), así que el
  // brillo no se vería si el chat se queda abierto — por eso el chat se
  // cierra solo un instante después de mostrar la respuesta guía, dando
  // tiempo a leer el mensaje antes de revelar el ícono.
  function pulseDockGlow(selector) {
    const target = document.querySelector(selector);
    if (!target) return;
    closeChatModal();
    target.classList.add("dock-icon-glow");
    setTimeout(() => target.classList.remove("dock-icon-glow"), 4000);
  }

  function openWishlistModal() {
    wishlistModal.hidden = false;
  }
  function closeWishlistModal() {
    wishlistModal.hidden = true;
  }
  wishlistOpenBtn.addEventListener("click", openWishlistModal);
  wishlistModalClose.addEventListener("click", closeWishlistModal);
  wishlistModal.addEventListener("click", (event) => {
    if (event.target === wishlistModal) closeWishlistModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !wishlistModal.hidden) closeWishlistModal();
  });

  // ---- Finanzas: casilleros de gasto + total/balance en vivo ----

  // items puede faltar en datos guardados de antes de esta función existir
  // (localStorage con categorías ya persistidas) — toda lectura de
  // cat.items en este bloque usa este helper en vez de asumir que
  // siempre está presente, mismo criterio que getWishRequirements().
  function getCategoryItems(cat) {
    return Array.isArray(cat.items) ? cat.items : [];
  }

  // Recalcula cat.amount como la suma de sus items — se llama cada vez
  // que el desglose cambia (alta/edición/borrado/escaneo), para que la
  // categoría en la pantalla principal quede siempre sincronizada
  // (pedido explícito: "Actualización Dinámica").
  function syncCategoryAmountFromItems(cat) {
    const items = getCategoryItems(cat);
    if (!items.length) return;
    cat.amount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }

  function renderFinanzasCategories() {
    financeCategoriesEl.innerHTML = "";

    state.pillars.finanzas.categories.forEach((cat) => {
      const row = document.createElement("div");
      row.className = "finanzas-category";

      let nameEl;
      if (cat.editable) {
        nameEl = document.createElement("input");
        nameEl.type = "text";
        nameEl.className = "finanzas-category__name-input";
        nameEl.value = cat.name;
        nameEl.addEventListener("input", () => {
          cat.name = nameEl.value;
          persist();
        });
      } else {
        nameEl = document.createElement("span");
        nameEl.className = "finanzas-category__name";
        nameEl.textContent = cat.name;
      }

      // Abre el Desglose de Gastos de esta categoría (pedido explícito:
      // "haz que cada botón de categoría sea cliqueable"). Botón
      // dedicado en vez de la fila entera, para no chocar con editar el
      // nombre (categorías custom) o el monto directamente.
      const breakdownBtn = document.createElement("button");
      breakdownBtn.type = "button";
      breakdownBtn.className = "btn-category-breakdown";
      breakdownBtn.textContent = "📊";
      breakdownBtn.title = t("categoryBreakdownOpenTitle");
      breakdownBtn.addEventListener("click", () => openCategoryBreakdownModal(cat.id));

      const symbolEl = document.createElement("span");
      symbolEl.className = "finanzas-currency-symbol finanzas-category__symbol";
      symbolEl.textContent = (CURRENCIES[state.currency] || CURRENCIES.PEN).symbol;

      const hasItems = getCategoryItems(cat).length > 0;
      const amountEl = document.createElement("input");
      amountEl.type = "number";
      amountEl.min = "0";
      amountEl.className = "finanzas-category__amount";
      amountEl.placeholder = "0";
      amountEl.value = cat.amount || "";
      if (hasItems) {
        // Con desglose cargado, el monto pasa a ser 100% derivado de la
        // suma de items — editarlo acá directamente rompería esa
        // sincronización, así que queda de solo lectura (se edita desde
        // el modal de desglose).
        amountEl.readOnly = true;
        amountEl.title = t("categoryAmountDerivedHint");
      } else {
        amountEl.addEventListener("input", () => {
          cat.amount = parseFloat(amountEl.value) || 0;
          updateFinanzasSummary();
        });
      }

      row.append(nameEl, breakdownBtn, symbolEl, amountEl);

      if (cat.editable) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "finanzas-category__remove";
        removeBtn.textContent = "✕";
        removeBtn.addEventListener("click", () => {
          state.pillars.finanzas.categories = state.pillars.finanzas.categories.filter((c) => c !== cat);
          renderFinanzasCategories();
          updateFinanzasSummary();
        });
        row.appendChild(removeBtn);
      }

      financeCategoriesEl.appendChild(row);
    });

    updateFinanzasCurrencySymbols();
  }

  // Refresca el símbolo mostrado junto a Ingreso Mensual, cada categoría, y
  // los 4 campos numéricos de la pestaña Servicios.
  // Solo Personales (Ingreso Mensual + categorías) — el formulario de
  // Servicios/Negocio tiene su propia moneda independiente, actualizada
  // aparte por updateNegocioCurrencySymbols() (ver más abajo).
  function updateFinanzasCurrencySymbols() {
    const symbol = (CURRENCIES[state.currency] || CURRENCIES.PEN).symbol;
    financeIngresoSymbol.textContent = symbol;
    document.querySelectorAll(".finanzas-category__symbol").forEach((el) => {
      el.textContent = symbol;
    });
  }

  function updateFinanzasSummary() {
    const totalGastos = state.pillars.finanzas.categories.reduce((sum, cat) => sum + (Number(cat.amount) || 0), 0);
    const ingreso = Number(financeIngresoInput.value) || 0;
    state.pillars.finanzas.ingresoMensual = ingreso;

    const balance = ingreso - totalGastos;
    state.pillars.finanzas.balance = balance;
    if (balance >= (state.pillars.finanzas.tier + 1) * 500) {
      state.pillars.finanzas.tier += 1;
    }

    financeTotalGastosEl.textContent = formatCurrency(totalGastos, state.currency);
    financeBalanceEl.textContent = formatCurrency(balance, state.currency);
    renderHud();
    persist();
  }

  // Resumen General Financiero, ahora permanente dentro del Cuadro de
  // Finanzas (antes solo vivía en el Dashboard, detrás de un clic en el
  // avatar). A diferencia de renderDashboard(), que calcula sobre `rows`
  // ya filtrado por negocio/colaborador, este siempre suma TODO
  // businessLedger sin filtrar — es el panorama global, no uno acotado.
  function renderFinanzasGlobalSummary() {
    const totalIngresos = businessLedger.reduce((sum, txn) => sum + txn.ingresoBruto, 0);
    const totalGastos = businessLedger.reduce((sum, txn) => sum + txn.egresos, 0);
    financeGlobalIngresosEl.textContent = formatCurrency(totalIngresos, businessCurrency);
    financeGlobalGastosEl.textContent = formatCurrency(totalGastos, businessCurrency);
    financeGlobalBalanceEl.textContent = formatCurrency(totalIngresos - totalGastos, businessCurrency);
    // Mismo valor, reflejado también en el resumen rápido del HUD superior
    // (pedido explícito del rediseño estilo HUD de juego).
    hudBalanceGlobalEl.textContent = formatCurrency(totalIngresos - totalGastos, businessCurrency);
  }

  financeOpenDashboardBtn.addEventListener("click", openDashboardModal);

  financeIngresoInput.addEventListener("input", updateFinanzasSummary);

  financeAddCategoryBtn.addEventListener("click", () => {
    state.pillars.finanzas.categories.push({
      id: `custom-${Date.now()}`,
      name: "Nueva categoría",
      amount: 0,
      editable: true,
      items: [],
    });
    renderFinanzasCategories();
    updateFinanzasSummary();
  });

  // ---- Módulo 1: Auditoría y Control de Nómina (給与明細書) ----
  // Snapshot único del mes actual (state.pillars.finanzas.payrollAudit),
  // no un historial — "Usar como Ingreso Mensual" vuelca el Sueldo Neto
  // Final calculado acá directamente al campo de Personales.

  function updatePayrollCurrencySymbols() {
    const symbol = (CURRENCIES[state.currency] || CURRENCIES.PEN).symbol;
    payrollSueldoBaseSymbol.textContent = symbol;
    payrollBonosSymbol.textContent = symbol;
    payrollSegurosSymbol.textContent = symbol;
    payrollImpuestosSymbol.textContent = symbol;
    payrollAdelantosSymbol.textContent = symbol;
  }

  function computePayrollNeto() {
    const sueldoBase = Number(payrollSueldoBaseInput.value) || 0;
    const bonos = Number(payrollBonosInput.value) || 0;
    const seguros = Number(payrollSegurosInput.value) || 0;
    const impuestos = Number(payrollImpuestosInput.value) || 0;
    const adelantos = Number(payrollAdelantosInput.value) || 0;
    const ingresosBrutos = sueldoBase + bonos;
    const descuentos = seguros + impuestos + adelantos;
    return { ingresosBrutos, descuentos, neto: ingresosBrutos - descuentos };
  }

  function updatePayrollNeto() {
    const { neto } = computePayrollNeto();
    payrollNetoFinalEl.textContent = formatCurrency(neto, state.currency);
  }

  function persistPayrollAuditFromForm() {
    const audit = state.pillars.finanzas.payrollAudit;
    audit.horasBase = Number(payrollHorasBaseInput.value) || 0;
    audit.horasExtra = Number(payrollHorasExtraInput.value) || 0;
    audit.horasNocturnas = Number(payrollHorasNocturnasInput.value) || 0;
    audit.sueldoBase = Number(payrollSueldoBaseInput.value) || 0;
    audit.bonos = Number(payrollBonosInput.value) || 0;
    audit.seguros = Number(payrollSegurosInput.value) || 0;
    audit.impuestos = Number(payrollImpuestosInput.value) || 0;
    audit.adelantos = Number(payrollAdelantosInput.value) || 0;
    persist();
  }

  function loadPayrollAuditIntoForm() {
    const audit = state.pillars.finanzas.payrollAudit || {};
    payrollHorasBaseInput.value = audit.horasBase || "";
    payrollHorasExtraInput.value = audit.horasExtra || "";
    payrollHorasNocturnasInput.value = audit.horasNocturnas || "";
    payrollSueldoBaseInput.value = audit.sueldoBase || "";
    payrollBonosInput.value = audit.bonos || "";
    payrollSegurosInput.value = audit.seguros || "";
    payrollImpuestosInput.value = audit.impuestos || "";
    payrollAdelantosInput.value = audit.adelantos || "";

    if (audit.evidenceImage) {
      payrollScanStatus.hidden = false;
      payrollScanPreview.src = audit.evidenceImage;
      payrollScanStatusText.textContent = t("payrollEvidenceSavedText");
    } else {
      payrollScanStatus.hidden = true;
    }

    updatePayrollNeto();
  }

  function openPayrollAuditModal() {
    updatePayrollCurrencySymbols();
    loadPayrollAuditIntoForm();
    payrollAuditModal.hidden = false;
  }

  function closePayrollAuditModal() {
    payrollAuditModal.hidden = true;
  }

  payrollAuditOpenBtn.addEventListener("click", openPayrollAuditModal);
  payrollAuditModalClose.addEventListener("click", closePayrollAuditModal);
  payrollAuditModal.addEventListener("click", (event) => {
    if (event.target === payrollAuditModal) closePayrollAuditModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !payrollAuditModal.hidden) closePayrollAuditModal();
  });

  // input + change (pedido explícito de un bloque anterior, mismo
  // criterio aplicado acá para consistencia): cada tecla Y cada ajuste
  // con spinner/blur recalculan el Sueldo Neto Final en vivo.
  [
    payrollHorasBaseInput,
    payrollHorasExtraInput,
    payrollHorasNocturnasInput,
    payrollSueldoBaseInput,
    payrollBonosInput,
    payrollSegurosInput,
    payrollImpuestosInput,
    payrollAdelantosInput,
  ].forEach((input) => {
    const handler = () => {
      updatePayrollNeto();
      persistPayrollAuditFromForm();
    };
    input.addEventListener("input", handler);
    input.addEventListener("change", handler);
  });

  payrollApplyBtn.addEventListener("click", () => {
    const { neto } = computePayrollNeto();
    financeIngresoInput.value = Math.max(0, Math.round(neto));
    updateFinanzasSummary();
    addGold(5);
    grantXP(20);
    addMessage({
      author: "TÚ",
      text: t("payrollAppliedMessage").replace("{amount}", formatCurrency(neto, state.currency)),
      variant: "user",
    });
    closePayrollAuditModal();
  });

  payrollScanBtn.addEventListener("click", () => payrollScanInput.click());

  // A diferencia de negocioScanPreview (URL.createObjectURL, temporal),
  // acá se usa FileReader → dataURL: el pedido explícito quiere la foto
  // "guardada en localStorage" como comprobante — un blob: URL se
  // invalida al recargar la página, un data: URL sí sobrevive.
  payrollScanInput.addEventListener("change", () => {
    const file = payrollScanInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      payrollScanPreview.src = dataUrl;
      payrollScanStatus.hidden = false;
      payrollScanStatusText.textContent = t("payrollScanScanning");

      const result = await scanPayrollDocument(file);

      payrollHorasBaseInput.value = result.horasBase;
      payrollHorasExtraInput.value = result.horasExtra;
      payrollHorasNocturnasInput.value = result.horasNocturnas;
      payrollSueldoBaseInput.value = result.sueldoBase;
      payrollBonosInput.value = result.bonos;
      payrollSegurosInput.value = result.seguros;
      payrollImpuestosInput.value = result.impuestos;
      payrollAdelantosInput.value = result.adelantos;

      state.pillars.finanzas.payrollAudit.evidenceImage = dataUrl;
      persistPayrollAuditFromForm();
      updatePayrollNeto();

      payrollScanStatusText.textContent = t("payrollScanDone");
      payrollScanInput.value = "";
    };
    reader.readAsDataURL(file);
  });

  // ---- Módulo 2: Desglose de Gastos por Categoría ----

  let activeCategoryId = null;

  function getActiveCategory() {
    return state.pillars.finanzas.categories.find((c) => c.id === activeCategoryId) || null;
  }

  function renderCategoryBreakdownTotal(cat) {
    const total = getCategoryItems(cat).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    categoryBreakdownTotalEl.textContent = formatCurrency(total, state.currency);
  }

  function renderCategoryBreakdownModal() {
    const cat = getActiveCategory();
    if (!cat) return;

    categoryBreakdownModalTitle.textContent = `${t("categoryBreakdownTitlePrefix")} ${cat.name}`;

    const items = getCategoryItems(cat);
    categoryItemsList.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "category-items-empty";
      empty.textContent = t("categoryItemsEmpty");
      categoryItemsList.appendChild(empty);
    } else {
      items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "category-item-row";

        const conceptInput = document.createElement("input");
        conceptInput.type = "text";
        conceptInput.className = "category-item-row__concept";
        conceptInput.value = item.concept;
        conceptInput.addEventListener("input", () => {
          item.concept = conceptInput.value;
          persist();
        });

        const amountInput = document.createElement("input");
        amountInput.type = "number";
        amountInput.min = "0";
        amountInput.className = "category-item-row__amount";
        amountInput.value = item.amount;
        amountInput.addEventListener("input", () => {
          item.amount = Number(amountInput.value) || 0;
          syncCategoryAmountFromItems(cat);
          renderCategoryBreakdownTotal(cat);
          renderFinanzasCategories();
          updateFinanzasSummary();
        });

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "category-item-row__remove";
        removeBtn.textContent = "✕";
        removeBtn.addEventListener("click", () => {
          cat.items = getCategoryItems(cat).filter((i) => i.id !== item.id);
          if (!cat.items.length) {
            cat.amount = 0;
          } else {
            syncCategoryAmountFromItems(cat);
          }
          renderCategoryBreakdownModal();
          renderFinanzasCategories();
          updateFinanzasSummary();
        });

        row.append(conceptInput, amountInput, removeBtn);
        categoryItemsList.appendChild(row);
      });
    }

    renderCategoryBreakdownTotal(cat);
  }

  function openCategoryBreakdownModal(categoryId) {
    activeCategoryId = categoryId;
    renderCategoryBreakdownModal();
    categoryBreakdownModal.hidden = false;
  }

  function closeCategoryBreakdownModal() {
    categoryBreakdownModal.hidden = true;
    activeCategoryId = null;
  }

  categoryBreakdownModalClose.addEventListener("click", closeCategoryBreakdownModal);
  categoryBreakdownModal.addEventListener("click", (event) => {
    if (event.target === categoryBreakdownModal) closeCategoryBreakdownModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !categoryBreakdownModal.hidden) closeCategoryBreakdownModal();
  });

  categoryItemForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const cat = getActiveCategory();
    const concept = categoryItemConceptInput.value.trim();
    const amount = Number(categoryItemAmountInput.value) || 0;
    if (!cat || !concept || amount <= 0) return;

    if (!Array.isArray(cat.items)) cat.items = [];
    cat.items.push({
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      concept,
      amount,
    });
    syncCategoryAmountFromItems(cat);

    categoryItemConceptInput.value = "";
    categoryItemAmountInput.value = "";

    renderCategoryBreakdownModal();
    renderFinanzasCategories();
    updateFinanzasSummary();
  });

  let categoryScanPreviewUrl = null;

  categoryScanBtn.addEventListener("click", () => categoryScanInput.click());

  categoryScanInput.addEventListener("change", async () => {
    const file = categoryScanInput.files[0];
    const cat = getActiveCategory();
    if (!file || !cat) return;

    if (categoryScanPreviewUrl) URL.revokeObjectURL(categoryScanPreviewUrl);
    categoryScanPreviewUrl = URL.createObjectURL(file);
    categoryScanPreview.src = categoryScanPreviewUrl;
    categoryScanStatus.hidden = false;
    categoryScanStatusText.textContent = t("categoryScanScanning");

    const result = await scanCategoryReceipt(file, cat.id);

    if (!Array.isArray(cat.items)) cat.items = [];
    cat.items.push({
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      concept: result.concept,
      amount: result.amount,
    });
    syncCategoryAmountFromItems(cat);

    categoryScanStatusText.textContent = `${t("categoryScanDone")} ${result.concept} · ${formatCurrency(result.amount, state.currency)}`;
    categoryScanInput.value = "";

    renderCategoryBreakdownModal();
    renderFinanzasCategories();
    updateFinanzasSummary();
  });

  // ---- Finanzas: pestaña "Servicios / Negocio" (registro de transacciones) ----
  // Tipo 1 "Servicio" (restaurado a su forma original): egresos = Gastos
  // Directos + (Monto Cobrado × %Comisión/100), Ganancia Neta = Ingreso -
  // Egresos.
  // Tipo 2 "Venta" (lógica mayorista): Costo Total Compra = Precio
  // Unitario × Cantidad; Monto Cobrado es un precio de venta INDEPENDIENTE
  // (no calculado); Ganancia Bruta = Monto Cobrado - Costo Total Compra;
  // la comisión es opcional y puede ser % (del Monto Cobrado) o un Monto
  // Fijo directo; Ganancia Neta Final = Ganancia Bruta - Comisión.
  // Cada envío agrega una fila al ledger de negocios (persistido aparte,
  // ver arriba) en vez de pisar un único snapshot como Personales.

  let negocioTipoActivo = "servicio";
  let negocioVentaComisionModo = "pct";

  function refreshNegocioSuggestions() {
    const existing = new Set(["Salón", "Camión", "Pescadería"]);
    businessLedger.forEach((txn) => existing.add(txn.businessName));
    negocioNombreSugerencias.innerHTML = "";
    existing.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      negocioNombreSugerencias.appendChild(option);
    });
  }

  // Mismo patrón que refreshNegocioSuggestions() de arriba, pero para
  // Colaborador/Vendedor — sin sugerencias base hardcodeadas (a
  // diferencia del negocio, acá no hay 3 nombres de ejemplo con sentido
  // universal). Cada colaborador nuevo que se registra queda disponible
  // para autocompletar/seleccionar con un tecleo la próxima vez.
  function refreshNegocioColaboradorSuggestions() {
    const existing = new Set(businessLedger.map((txn) => txn.collaborator).filter(Boolean));
    negocioColaboradorSugerencias.innerHTML = "";
    existing.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      negocioColaboradorSugerencias.appendChild(option);
    });
  }

  // Símbolos de los campos numéricos del formulario de negocio — ligados
  // a businessCurrency, NO a state.currency (son monedas independientes).
  function updateNegocioCurrencySymbols() {
    const symbol = (CURRENCIES[businessCurrency] || CURRENCIES.PEN).symbol;
    negocioServicioMontoSymbol.textContent = symbol;
    negocioServicioGastosSymbol.textContent = symbol;
    negocioVentaPrecioUnitarioSymbol.textContent = symbol;
    negocioVentaMontoCobradoSymbol.textContent = symbol;
    // El sufijo de la comisión de Venta muestra el símbolo de moneda solo
    // en modo "Monto Fijo" — en modo "%" muestra el signo de porcentaje.
    negocioVentaComisionSuffix.textContent = negocioVentaComisionModo === "fijo" ? symbol : "%";
  }

  negocioCurrencySelect.value = businessCurrency;
  updateNegocioCurrencySymbols();
  negocioFechaInput.value = new Date().toISOString().slice(0, 10);

  negocioCurrencySelect.addEventListener("change", () => {
    businessCurrency = negocioCurrencySelect.value;
    persistBusinessCurrency();
    updateNegocioCurrencySymbols();
    updateNegocioGananciaPreview();
  });

  // comisionMonto queda separado de egresos/gananciaBruta (que ya lo
  // incluyen sumado/restado) para poder guardar y mostrar explícitamente
  // cuánto le corresponde al colaborador (pedido explícito).
  function computeNegocioTransaction() {
    if (negocioTipoActivo === "servicio") {
      const ingresoBruto = Number(negocioServicioMontoInput.value) || 0;
      const gastos = Number(negocioServicioGastosInput.value) || 0;
      const comisionPct = Math.min(100, Math.max(0, Number(negocioServicioComisionInput.value) || 0));
      const comisionMonto = ingresoBruto * (comisionPct / 100);
      const egresos = gastos + comisionMonto;
      return {
        concept: negocioServicioConceptoInput.value.trim(),
        ingresoBruto,
        egresos,
        comisionMonto,
        gananciaNeta: ingresoBruto - egresos,
      };
    }

    // Venta
    const precioUnitario = Number(negocioVentaPrecioUnitarioInput.value) || 0;
    const cantidad = Number(negocioVentaCantidadInput.value) || 0;
    const costoTotalCompra = precioUnitario * cantidad;
    const montoCobrado = Number(negocioVentaMontoCobradoInput.value) || 0;
    const gananciaBruta = montoCobrado - costoTotalCompra;

    // Comisión OPCIONAL: vacía o 0 es válido (pedido explícito), y el
    // modo decide si el número ingresado es un % de la GANANCIA BRUTA
    // (no del Monto Cobrado — pedido explícito de este bloque) o un
    // monto fijo directo en la moneda del negocio.
    const comisionInput = Number(negocioVentaComisionInput.value) || 0;
    const comisionMonto = negocioVentaComisionModo === "fijo"
      ? Math.max(0, comisionInput)
      : gananciaBruta * (Math.min(100, Math.max(0, comisionInput)) / 100);

    return {
      concept: negocioVentaConceptoInput.value.trim(),
      precioUnitario,
      cantidad,
      costoTotalCompra,
      ingresoBruto: montoCobrado,
      egresos: costoTotalCompra + comisionMonto,
      comisionMonto,
      gananciaBruta,
      gananciaNeta: gananciaBruta - comisionMonto,
    };
  }

  function updateNegocioGananciaPreview() {
    if (negocioTipoActivo === "servicio") {
      const { gananciaNeta, comisionMonto } = computeNegocioTransaction();
      negocioServicioGananciaPreviewEl.textContent = formatCurrency(gananciaNeta, businessCurrency);
      negocioServicioComisionPreviewEl.textContent = formatCurrency(comisionMonto, businessCurrency);
      return;
    }
    const { costoTotalCompra, gananciaBruta, gananciaNeta, comisionMonto } = computeNegocioTransaction();
    negocioVentaCostoTotalEl.textContent = formatCurrencyDecimal(costoTotalCompra, businessCurrency);
    negocioVentaGananciaBrutaEl.textContent = formatCurrencyDecimal(gananciaBruta, businessCurrency);
    negocioVentaComisionPreviewEl.textContent = formatCurrencyDecimal(comisionMonto, businessCurrency);
    negocioVentaGananciaPreviewEl.textContent = formatCurrencyDecimal(gananciaNeta, businessCurrency);
  }

  // "input" cubre cada tecla mientras se escribe; "change" cubre además
  // ajustes con las flechas del spinner nativo, pegar+blur, o autofill —
  // pedido explícito: recalcular en tiempo real con ambos eventos.
  [
    negocioServicioMontoInput,
    negocioServicioGastosInput,
    negocioServicioComisionInput,
    negocioVentaPrecioUnitarioInput,
    negocioVentaCantidadInput,
    negocioVentaMontoCobradoInput,
    negocioVentaComisionInput,
  ].forEach((input) => {
    input.addEventListener("input", updateNegocioGananciaPreview);
    input.addEventListener("change", updateNegocioGananciaPreview);
  });

  negocioTypeToggle.addEventListener("click", (event) => {
    const btn = event.target.closest(".negocio-type-btn");
    if (!btn) return;
    negocioTipoActivo = btn.dataset.negocioTipo;

    document.querySelectorAll(".negocio-type-btn").forEach((b) => {
      b.classList.toggle("negocio-type-btn--active", b === btn);
    });
    negocioFieldsServicio.hidden = negocioTipoActivo !== "servicio";
    negocioFieldsVenta.hidden = negocioTipoActivo !== "venta";
    updateNegocioGananciaPreview();
  });

  negocioVentaComisionModoToggle.addEventListener("click", (event) => {
    const btn = event.target.closest(".negocio-comision-modo-btn");
    if (!btn) return;
    negocioVentaComisionModo = btn.dataset.comisionModo;

    document.querySelectorAll(".negocio-comision-modo-btn").forEach((b) => {
      b.classList.toggle("negocio-comision-modo-btn--active", b === btn);
    });
    updateNegocioCurrencySymbols();
    updateNegocioGananciaPreview();
  });

  // "Otro" revela el campo de texto libre; cualquier otra opción lo
  // vuelve a ocultar y limpia lo que hubiera quedado escrito.
  negocioMetodoPagoSelect.addEventListener("change", () => {
    const isOtro = negocioMetodoPagoSelect.value === "otro";
    negocioMetodoPagoOtroRow.hidden = !isOtro;
    if (!isOtro) negocioMetodoPagoOtroInput.value = "";
  });

  // Devuelve el método de pago legible para guardar en el ledger: la
  // etiqueta traducida de Yape/Tarjeta, o el texto libre de "Otro" (sin
  // recortar espacios de más, igual que businessName/collaborator).
  function resolveNegocioMetodoPago() {
    if (negocioMetodoPagoSelect.value === "otro") {
      return negocioMetodoPagoOtroInput.value.trim() || t("negocioMetodoPagoOtro");
    }
    return t(negocioMetodoPagoSelect.value === "tarjeta" ? "negocioMetodoPagoTarjeta" : "negocioMetodoPagoYape");
  }

  function resetNegocioForm() {
    negocioFechaInput.value = new Date().toISOString().slice(0, 10);
    negocioNombreInput.value = "";
    negocioColaboradorInput.value = "";
    negocioMetodoPagoSelect.value = "yape";
    negocioMetodoPagoOtroRow.hidden = true;
    negocioMetodoPagoOtroInput.value = "";
    negocioServicioConceptoInput.value = "";
    negocioServicioMontoInput.value = "";
    negocioServicioGastosInput.value = "";
    negocioServicioComisionInput.value = "";
    negocioVentaConceptoInput.value = "";
    negocioVentaPrecioUnitarioInput.value = "";
    negocioVentaCantidadInput.value = "1";
    negocioVentaMontoCobradoInput.value = "";
    negocioVentaComisionInput.value = "";
    updateNegocioGananciaPreview();
  }

  // ---------------- Escaneo de Boletas (Visión IA simulada) ----------------
  // NOTA HONESTA: sin backend de visión conectado (Tesseract.js real o una
  // API tipo Gemini/Claude Vision requieren red y/o claves de API que este
  // proyecto no tiene), esto es una SIMULACIÓN ESTRUCTURADA — parsing
  // determinístico a partir de metadatos del archivo (nombre/tamaño/fecha
  // de modificación), NO reconocimiento óptico real del contenido de la
  // imagen. Mismo principio aplicado en otras partes de la app cuando no
  // hay datos reales que respaldar (ver seedFromFile más abajo): resultado
  // consistente para el mismo archivo, pero no una lectura real.
  // Sirve de adaptador ya cableado (loading state, auto-fill, mensaje de
  // chat) para enchufar OCR/visión real más adelante sin tocar el resto
  // del flujo — solo reemplazar el cuerpo de cada función de escaneo.
  // seedFromFile() es compartida por las 3 simulaciones (boletas de
  // negocio, boletas/hojas de nómina, recibos de gasto personal).
  function seedFromFile(file) {
    const seedSource = `${file.name}-${file.size}-${file.lastModified}`;
    let seed = 0;
    for (let i = 0; i < seedSource.length; i++) {
      seed = (seed * 31 + seedSource.charCodeAt(i)) % 100000;
    }
    return seed;
  }

  const SCAN_COLLABORATOR_POOL = ["Ryana", "Milagros", "Vendedor 1", "Carlos"];
  const SCAN_CONCEPT_POOL = {
    servicio: ["Corte de cabello", "Ruta Norte", "Servicio de tarjeta", "Mantenimiento"],
    venta: ["20 kg de pescado", "Venta de repuestos", "Paquete de productos"],
  };

  function scanReceiptImage(file) {
    const seed = seedFromFile(file);
    const type = seed % 2 === 0 ? "servicio" : "venta";
    const collaborator = SCAN_COLLABORATOR_POOL[seed % SCAN_COLLABORATOR_POOL.length];
    const conceptPool = SCAN_CONCEPT_POOL[type];
    const concept = conceptPool[seed % conceptPool.length];
    const amount = 20 + (seed % 180);
    const expenses = Math.round(amount * (0.1 + (seed % 30) / 100));

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          date: new Date().toISOString().slice(0, 10),
          collaborator,
          type,
          concept,
          amount,
          expenses,
        });
      }, 1200);
    });
  }

  // Simulación de lectura de boleta de sueldo / hoja de asistencia
  // (給与明細書 / 勤怠管理表) — mismo criterio determinístico que arriba.
  function scanPayrollDocument(file) {
    const seed = seedFromFile(file);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          horasBase: 150 + (seed % 30),
          horasExtra: seed % 25,
          horasNocturnas: seed % 15,
          sueldoBase: 150000 + (seed % 20) * 5000,
          bonos: (seed % 5) * 5000,
          seguros: 12000 + (seed % 10) * 500,
          impuestos: 8000 + (seed % 8) * 400,
          adelantos: seed % 4 === 0 ? (seed % 10) * 1000 : 0,
        });
      }, 1200);
    });
  }

  // Simulación de lectura de recibo/boleta de compra personal — el
  // concepto se elige según la categoría de gasto que se está
  // escaneando, para que el resultado sea plausible (un "Supermercado"
  // no aparece en la categoría Estudios, por ejemplo).
  const CATEGORY_RECEIPT_CONCEPT_POOL = {
    vivienda: ["Alquiler", "Recibo de luz", "Recibo de agua", "Internet"],
    comida: ["Supermercado", "Restaurante", "Delivery", "Mercado"],
    estudios: ["Materiales de estudio", "Curso online", "Libros", "Matrícula"],
    vanidades: ["Ropa", "Peluquería", "Cosméticos", "Accesorios"],
  };
  const CATEGORY_RECEIPT_CONCEPT_DEFAULT = ["Compra varios", "Tienda", "Gasto general"];

  function scanCategoryReceipt(file, categoryId) {
    const seed = seedFromFile(file);
    const pool = CATEGORY_RECEIPT_CONCEPT_POOL[categoryId] || CATEGORY_RECEIPT_CONCEPT_DEFAULT;
    const concept = pool[seed % pool.length];
    const amount = 20 + (seed % 480);

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ concept, amount });
      }, 1200);
    });
  }

  let negocioScanPreviewUrl = null;

  negocioScanBtn.addEventListener("click", () => negocioScanInput.click());

  negocioScanInput.addEventListener("change", async () => {
    const file = negocioScanInput.files[0];
    if (!file) return;

    if (negocioScanPreviewUrl) URL.revokeObjectURL(negocioScanPreviewUrl);
    negocioScanPreviewUrl = URL.createObjectURL(file);
    negocioScanPreview.src = negocioScanPreviewUrl;
    negocioScanStatus.hidden = false;
    negocioScanStatusText.textContent = t("negocioScanScanning");

    const result = await scanReceiptImage(file);

    negocioFechaInput.value = result.date;
    negocioColaboradorInput.value = result.collaborator;

    negocioTipoActivo = result.type;
    document.querySelectorAll(".negocio-type-btn").forEach((b) => {
      b.classList.toggle("negocio-type-btn--active", b.dataset.negocioTipo === result.type);
    });
    negocioFieldsServicio.hidden = result.type !== "servicio";
    negocioFieldsVenta.hidden = result.type !== "venta";

    if (result.type === "servicio") {
      negocioServicioConceptoInput.value = result.concept;
      negocioServicioMontoInput.value = result.amount;
      negocioServicioGastosInput.value = result.expenses;
    } else {
      // La simulación de escaneo no distingue precio unitario de cantidad
      // (no hay esa granularidad en la boleta "leída") — se vuelca el
      // monto detectado como Monto Cobrado directo, con Precio Unitario/
      // Cantidad en blanco para que el usuario los complete a mano si
      // quiere el desglose real de costo mayorista.
      negocioVentaConceptoInput.value = result.concept;
      negocioVentaMontoCobradoInput.value = result.amount;
    }

    updateNegocioGananciaPreview();
    negocioScanStatusText.textContent = `${t("negocioScanDone")} ${result.collaborator} · ${result.concept}`;

    negocioScanInput.value = "";
  });

  // ---------------- Impresión (Formulario Físico + Reporte del Dashboard) ----------------
  // Estilos base compartidos por ambas plantillas imprimibles: blanco y
  // negro (sin el tema neón, para no gastar tinta ni perder legibilidad),
  // @page sin márgenes del navegador, y thead/tr con reglas de salto de
  // página para que una tabla larga se corte limpio entre hojas en vez
  // de partir una fila por la mitad.
  const PRINT_BASE_STYLES = `
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; padding: 24px; margin: 0; }
    h1 { font-size: 1.2rem; margin-bottom: 2px; }
    p.sub { font-size: 0.75rem; color: #444; margin-top: 0; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 8px 6px; text-align: left; font-size: 0.72rem; }
    th { background: #eee; }
    td { height: 28px; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    .meta-row { display: flex; gap: 24px; margin-bottom: 14px; font-size: 0.78rem; }
    .meta-row span { border-bottom: 1px solid #333; padding: 2px 40px 2px 2px; }
    @page { size: auto; margin: 14mm; }
    @media print {
      body { padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;

  // Abre una ventana real (con referencia utilizable), escribe el HTML
  // completo y dispara la impresión. NOTA: "noopener"/"noreferrer" en
  // window.open() hace que el navegador NO devuelva una referencia a la
  // ventana nueva (devuelve null) — esa era la causa real de la pantalla
  // en blanco (about:blank): el código pedía la ventana con noopener Y
  // al mismo tiempo intentaba escribirle contenido con esa referencia,
  // que nunca llegaba a existir. Acá no hace falta noopener: la ventana
  // no navega a ninguna URL externa, es contenido 100% generado por
  // nosotros mismos.
  // mode "pdf" reutiliza EXACTAMENTE el mismo mecanismo que "print": no
  // hay ninguna API de JS que guarde un archivo en disco sin interacción
  // del usuario (restricción de seguridad del navegador, no una
  // limitación nuestra), y agregar una librería externa (html2pdf/jsPDF)
  // habría significado sumar una dependencia de un proyecto 100% vanilla
  // sin build tools — el propio pedido ofrecía la alternativa nativa
  // como opción válida. La diferencia real de "Descargar PDF": un
  // mensaje breve en el chat indicando que hay que elegir "Guardar como
  // PDF" en el diálogo, en vez de abrir el diálogo sin más contexto.
  function openPrintWindow(html, mode = "print") {
    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) {
      addMessage({
        author: "SISTEMA",
        text: t("printPopupBlocked"),
        variant: "system",
      });
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    if (mode === "pdf") {
      addMessage({
        author: "SISTEMA",
        text: t("pdfDownloadHint"),
        variant: "system",
      });
    }

    printWindow.print();
  }

  // Genera una plantilla en blanco y negro con casillas vacías, pensada
  // para llenarse a mano y volver a subirse luego con scanReceiptImage().
  function buildPrintableFormHTML() {
    // Título dinámico (pedido explícito: nada de "Miikaeru" ni "Dashboard"
    // en lo impreso) — usa el Nombre del Negocio ya escrito en el
    // formulario en ese momento; si está vacío, cae a un título genérico
    // sin marca.
    const docTitle = negocioNombreInput.value.trim() || t("printFormTitle");
    const rows = Array.from({ length: 14 }, () => "<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>").join("");
    return `<!doctype html>
<html lang="${currentLanguage}">
<head>
<meta charset="UTF-8" />
<title>${docTitle}</title>
<style>${PRINT_BASE_STYLES}</style>
</head>
<body>
  <h1>${docTitle}</h1>
  <p class="sub">${t("printFormSubtitle")}</p>
  <div class="meta-row">
    <span>${t("printFormBusinessLabel")} ______________________</span>
    <span>${t("printFormWeekLabel")} ___ / ___ / ______</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>${t("printFormColFecha")}</th>
        <th>${t("printFormColColaborador")}</th>
        <th>${t("printFormColServicio")}</th>
        <th>${t("printFormColPrecio")}</th>
        <th>${t("printFormColComision")}</th>
        <th>${t("printFormColInsumos")}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
  }

  negocioPrintBtn.addEventListener("click", () => openPrintWindow(buildPrintableFormHTML()));
  negocioPdfBtn.addEventListener("click", () => openPrintWindow(buildPrintableFormHTML(), "pdf"));

  // Reporte del Dashboard: misma filosofía en blanco y negro, pero con
  // los datos REALES ya filtrados/ordenados que el Dashboard tiene en
  // pantalla en ese momento (mismo filtro de negocio activo), en vez de
  // casillas vacías para llenar a mano.
  function buildDashboardReportHTML() {
    const filter = dashboardFilterSelect.value;
    const rows = businessLedger
      .filter((txn) => filter === "__all__" || txn.businessName === filter)
      .filter((txn) => !selectedCollaborator || txn.collaborator === selectedCollaborator)
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalIngresos = rows.reduce((sum, txn) => sum + txn.ingresoBruto, 0);
    const totalGastos = rows.reduce((sum, txn) => sum + txn.egresos, 0);
    const totalBalance = totalIngresos - totalGastos;

    // Título dinámico (pedido explícito: nada de "Miikaeru" ni "Dashboard"
    // en lo impreso) — prioriza el negocio filtrado; si no hay uno
    // específico pero sí un colaborador seleccionado, usa su nombre; si
    // no hay ninguno de los dos ("Todos"), cae a un título genérico.
    const docTitle = filter !== "__all__" ? filter : (selectedCollaborator || t("dashboardReportGenericTitle"));

    const bodyRows = rows.length
      ? rows.map((txn) => `
        <tr>
          <td>${new Date(txn.date).toLocaleDateString("es-ES")}</td>
          <td>${txn.businessName}</td>
          <td>${txn.collaborator || "—"}</td>
          <td>${txn.concept}</td>
          <td>${txn.metodoPago || "—"}</td>
          <td>${formatCurrency(txn.ingresoBruto, businessCurrency)}</td>
          <td>${formatCurrency(txn.egresos, businessCurrency)}</td>
          <td>${formatCurrency(txn.gananciaNeta, businessCurrency)}</td>
        </tr>`).join("")
      : `<tr><td colspan="8" style="text-align:center; color:#777;">${t("dashboardEmpty")}</td></tr>`;

    return `<!doctype html>
<html lang="${currentLanguage}">
<head>
<meta charset="UTF-8" />
<title>${docTitle}</title>
<style>
  ${PRINT_BASE_STYLES}
  .totals-row { display: flex; gap: 24px; margin: 14px 0 18px; font-size: 0.85rem; font-weight: bold; }
</style>
</head>
<body>
  <h1>${docTitle}</h1>
  <p class="sub">${t("dashboardFilterLabel")}: ${filter === "__all__" ? t("dashboardFilterAll") : filter}</p>
  <div class="totals-row">
    <span>${t("dashboardCardIncome")}: ${formatCurrency(totalIngresos, businessCurrency)}</span>
    <span>${t("dashboardCardExpense")}: ${formatCurrency(totalGastos, businessCurrency)}</span>
    <span>${t("dashboardCardBalance")}: ${formatCurrency(totalBalance, businessCurrency)}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>${t("dashboardColFecha")}</th>
        <th>${t("dashboardColNegocio")}</th>
        <th>${t("dashboardColColaborador")}</th>
        <th>${t("dashboardColConcepto")}</th>
        <th>${t("dashboardColMetodoPago")}</th>
        <th>${t("dashboardColIngreso")}</th>
        <th>${t("dashboardColEgresos")}</th>
        <th>${t("dashboardColGanancia")}</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
  }

  dashboardPrintBtn.addEventListener("click", () => openPrintWindow(buildDashboardReportHTML()));
  dashboardPdfBtn.addEventListener("click", () => openPrintWindow(buildDashboardReportHTML(), "pdf"));

  // Boleta de Pago / Comprobante de Liquidación de Servicios: usa
  // exactamente los mismos filtros que la tabla del Dashboard en ese
  // momento (negocio + colaborador seleccionado) — "lo que ves es lo que
  // se imprime". El Total Neto a Pagar es la suma de comisionMonto (lo
  // que el colaborador se gana por comisión), no el ingreso bruto de los
  // negocios — eso es plata del negocio, no del colaborador.
  function buildPayslipHTML(collaborator) {
    const filter = dashboardFilterSelect.value;
    const rows = businessLedger
      .filter((txn) => filter === "__all__" || txn.businessName === filter)
      .filter((txn) => txn.collaborator === collaborator)
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const totalComision = rows.reduce((sum, txn) => sum + txn.comisionMonto, 0);
    const businessLabel = filter !== "__all__" ? filter : Array.from(new Set(rows.map((r) => r.businessName))).join(", ");
    const issueDate = new Date().toLocaleDateString(currentLanguage === "en" ? "en-US" : currentLanguage === "ja" ? "ja-JP" : "es-ES");

    const bodyRows = rows.length
      ? rows.map((txn) => `
        <tr>
          <td>${new Date(txn.date).toLocaleDateString("es-ES")}</td>
          <td>${txn.concept}</td>
          <td>${formatCurrency(txn.ingresoBruto, businessCurrency)}</td>
          <td>${formatCurrency(txn.comisionMonto, businessCurrency)}</td>
        </tr>`).join("")
      : `<tr><td colspan="4" style="text-align:center; color:#777;">${t("payslipEmpty")}</td></tr>`;

    return `<!doctype html>
<html lang="${currentLanguage}">
<head>
<meta charset="UTF-8" />
<title>${collaborator}</title>
<style>
  ${PRINT_BASE_STYLES}
  .payslip-meta { margin-bottom: 18px; font-size: 0.8rem; line-height: 1.8; }
  .payslip-meta strong { color: #000; }
  .payslip-total { margin-top: 16px; padding: 12px 16px; border: 2px solid #111; text-align: right; font-size: 1rem; font-weight: bold; }
</style>
</head>
<body>
  <h1>${collaborator}</h1>
  <p class="sub">${t("payslipTitle")} — ${t("payslipSubtitle")}</p>
  <div class="payslip-meta">
    <div><strong>${t("payslipBusinessLabel")}</strong> ${businessLabel || "—"}</div>
    <div><strong>${t("payslipDateLabel")}</strong> ${issueDate}</div>
    <div><strong>${t("payslipCollaboratorLabel")}</strong> ${collaborator}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>${t("payslipColFecha")}</th>
        <th>${t("payslipColConcepto")}</th>
        <th>${t("payslipColMonto")}</th>
        <th>${t("payslipColComision")}</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="payslip-total">${t("payslipTotalLabel")}: ${formatCurrency(totalComision, businessCurrency)}</div>
</body>
</html>`;
  }

  // Combina la fecha elegida en #negocio-fecha (editable a mano o
  // auto-rellenada por el escaneo de boleta) con la hora actual, para no
  // perder el orden cronológico entre transacciones del mismo día.
  function resolveNegocioDate() {
    const now = new Date();
    if (!negocioFechaInput.value) return now.toISOString();
    const [y, m, d] = negocioFechaInput.value.split("-").map(Number);
    return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString();
  }

  negocioRegistrarBtn.addEventListener("click", () => {
    const businessName = negocioNombreInput.value.trim();
    if (!businessName) {
      negocioNombreInput.focus();
      return;
    }

    // Colaborador / Vendedor es obligatorio en ambas plantillas (pedido
    // explícito) — mismo patrón de validación que Nombre del Negocio.
    const collaborator = negocioColaboradorInput.value.trim();
    if (!collaborator) {
      negocioColaboradorInput.focus();
      return;
    }

    const {
      concept,
      precioUnitario,
      cantidad,
      costoTotalCompra,
      ingresoBruto,
      egresos,
      comisionMonto,
      gananciaBruta,
      gananciaNeta,
    } = computeNegocioTransaction();

    const newTxn = {
      id: `txn-${Date.now()}`,
      date: resolveNegocioDate(),
      businessName,
      collaborator,
      type: negocioTipoActivo,
      concept: concept || t(negocioTipoActivo === "servicio" ? "negocioTipoServicio" : "negocioTipoVenta"),
      metodoPago: resolveNegocioMetodoPago(),
      // precioUnitario/cantidad/costoTotalCompra/gananciaBruta quedan
      // undefined en transacciones de tipo Servicio (no aplica) — se
      // omiten solos al persistir (JSON.stringify descarta undefined).
      precioUnitario,
      cantidad,
      costoTotalCompra,
      ingresoBruto,
      egresos,
      comisionMonto,
      comisionModo: negocioTipoActivo === "venta" ? negocioVentaComisionModo : "pct",
      gananciaBruta,
      gananciaNeta,
    };
    businessLedger.push(newTxn);
    persistBusinessLedger();
    renderFinanzasGlobalSummary();
    refreshNegocioSuggestions();
    refreshNegocioColaboradorSuggestions();
    syncTransactionToSupabase(newTxn); // respaldo en la nube, mejor esfuerzo — ver comentario en su definición

    addGold(5);
    grantXP(30);
    addMessage({
      author: "TÚ",
      text: `Registré una transacción de "${businessName}" (${collaborator}): ganancia neta ${formatCurrency(gananciaNeta, businessCurrency)}.`,
      variant: "user",
    });

    resetNegocioForm();
  });

  // ---- Dashboard Financiero General (modal, se abre desde el avatar) ----

  function getUniqueBusinessNames() {
    return Array.from(new Set(businessLedger.map((txn) => txn.businessName))).sort();
  }

  function renderDashboardFilterOptions() {
    const previous = dashboardFilterSelect.value || "__all__";
    const names = getUniqueBusinessNames();

    dashboardFilterSelect.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "__all__";
    allOption.textContent = t("dashboardFilterAll");
    dashboardFilterSelect.appendChild(allOption);

    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      dashboardFilterSelect.appendChild(option);
    });

    dashboardFilterSelect.value = previous === "__all__" || names.includes(previous) ? previous : "__all__";
  }

  function renderDashboardTable(rows) {
    dashboardTableBody.innerHTML = "";
    dashboardEmpty.hidden = rows.length > 0;

    rows.forEach((txn) => {
      const tr = document.createElement("tr");
      if (txn.gananciaNeta < 0) tr.classList.add("dashboard-table__row--negative");

      const cells = [
        new Date(txn.date).toLocaleDateString("es-ES"),
        txn.businessName,
        txn.collaborator || "—",
        txn.concept,
        txn.metodoPago || "—",
        formatCurrency(txn.ingresoBruto, businessCurrency),
        formatCurrency(txn.egresos, businessCurrency),
        formatCurrency(txn.gananciaNeta, businessCurrency),
      ];
      cells.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });

      // Eliminar transacción: única acción destructiva del ledger de
      // negocios hasta este bloque — se pide confirmación explícita
      // porque no hay forma de deshacerla (ni un "papelera"/undo).
      const actionsTd = document.createElement("td");
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "dashboard-table__delete-btn";
      deleteBtn.textContent = "🗑️";
      deleteBtn.setAttribute("aria-label", t("dashboardDeleteBtn"));
      deleteBtn.title = t("dashboardDeleteBtn");
      deleteBtn.addEventListener("click", () => deleteTransaction(txn.id));
      actionsTd.appendChild(deleteBtn);
      tr.appendChild(actionsTd);

      dashboardTableBody.appendChild(tr);
    });
  }

  function deleteTransaction(id) {
    if (!window.confirm(t("dashboardDeleteConfirm"))) return;
    businessLedger = businessLedger.filter((txn) => txn.id !== id);
    persistBusinessLedger();
    renderFinanzasGlobalSummary();
    refreshNegocioSuggestions();
    refreshNegocioColaboradorSuggestions();
    renderDashboard();
  }

  // El ranking compara SIEMPRE todas las entidades entre sí (no respeta el
  // filtro de negocio activo) — filtrar a una sola dejaría un ranking de
  // un solo elemento, que no sirve como comparación. dashboardRankingBy
  // decide si agrupa por negocio o por colaborador (toggle debajo).
  let dashboardRankingBy = "negocio";
  // Seleccionar un colaborador en el ranking filtra la tabla de abajo a
  // solo sus registros y revela el botón de Boleta de Pago (pedido
  // explícito, punto 3) — solo tiene sentido en modo "colaborador".
  let selectedCollaborator = null;

  function renderDashboardRanking() {
    const groupKey = dashboardRankingBy === "colaborador" ? "collaborator" : "businessName";
    const totals = new Map();
    businessLedger.forEach((txn) => {
      const label = txn[groupKey] || "—";
      totals.set(label, (totals.get(label) || 0) + txn.gananciaNeta);
    });
    const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);

    dashboardRankingList.innerHTML = "";
    if (!sorted.length) {
      const empty = document.createElement("p");
      empty.className = "dashboard-ranking__empty";
      empty.textContent = t("dashboardRankingEmpty");
      dashboardRankingList.appendChild(empty);
      return;
    }

    const isColaboradorMode = dashboardRankingBy === "colaborador";

    sorted.forEach(([name, total], index) => {
      const row = document.createElement("div");
      row.className = "dashboard-ranking__row";
      if (index === 0) row.classList.add("dashboard-ranking__row--top");

      if (isColaboradorMode) {
        row.classList.add("dashboard-ranking__row--clickable");
        if (name === selectedCollaborator) row.classList.add("dashboard-ranking__row--selected");
        row.addEventListener("click", () => {
          selectedCollaborator = selectedCollaborator === name ? null : name;
          renderDashboard();
        });
      }

      const nameEl = document.createElement("span");
      nameEl.className = "dashboard-ranking__name";
      nameEl.textContent = index === 0 ? `🏆 ${name}` : name;

      const valueEl = document.createElement("span");
      valueEl.className = "dashboard-ranking__value";
      valueEl.textContent = formatCurrency(total, businessCurrency);

      row.append(nameEl, valueEl);
      dashboardRankingList.appendChild(row);
    });
  }

  dashboardRankingToggle.addEventListener("click", (event) => {
    const btn = event.target.closest(".dashboard-ranking-toggle__btn");
    if (!btn) return;
    dashboardRankingBy = btn.dataset.rankingBy;
    // Cambiar de modo invalida cualquier colaborador seleccionado (no
    // aplica en modo "negocio").
    selectedCollaborator = null;
    document.querySelectorAll(".dashboard-ranking-toggle__btn").forEach((b) => {
      b.classList.toggle("dashboard-ranking-toggle__btn--active", b === btn);
    });
    renderDashboard();
  });

  dashboardPayslipBtn.addEventListener("click", () => {
    if (!selectedCollaborator) return;
    openPrintWindow(buildPayslipHTML(selectedCollaborator));
  });

  dashboardPayslipPdfBtn.addEventListener("click", () => {
    if (!selectedCollaborator) return;
    openPrintWindow(buildPayslipHTML(selectedCollaborator), "pdf");
  });

  function renderDashboard() {
    renderDashboardFilterOptions();
    const filter = dashboardFilterSelect.value;

    const rows = businessLedger
      .filter((txn) => filter === "__all__" || txn.businessName === filter)
      .filter((txn) => !selectedCollaborator || txn.collaborator === selectedCollaborator)
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    renderDashboardTable(rows);

    const totalIngresos = rows.reduce((sum, txn) => sum + txn.ingresoBruto, 0);
    const totalGastos = rows.reduce((sum, txn) => sum + txn.egresos, 0);
    dashboardTotalIngresosEl.textContent = formatCurrency(totalIngresos, businessCurrency);
    dashboardTotalGastosEl.textContent = formatCurrency(totalGastos, businessCurrency);
    dashboardTotalBalanceEl.textContent = formatCurrency(totalIngresos - totalGastos, businessCurrency);

    dashboardCollaboratorPanel.hidden = !selectedCollaborator;
    if (selectedCollaborator) {
      dashboardCollaboratorPanelLabel.textContent = `${t("dashboardCollaboratorSelectedLabel")} ${selectedCollaborator}`;
    }

    renderDashboardRanking();
  }

  function openDashboardModal() {
    dashboardModal.hidden = false;
    selectedCollaborator = null;
    renderDashboard();
  }

  function closeDashboardModal() {
    dashboardModal.hidden = true;
  }

  dashboardModalClose.addEventListener("click", closeDashboardModal);
  dashboardModal.addEventListener("click", (event) => {
    if (event.target === dashboardModal) closeDashboardModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dashboardModal.hidden) closeDashboardModal();
  });
  dashboardFilterSelect.addEventListener("change", renderDashboard);

  // ---- Finanzas: pestañas (Personales / Servicios y Negocio) ----
  // El botón "Guardar" compartido de abajo solo tiene sentido para el
  // snapshot editable de Personales — Servicios usa su propio botón
  // "Registrar Transacción", así que se oculta uno u otro según la
  // pestaña activa en vez de dejar dos acciones distintas visibles a
  // la vez.
  finanzasTabs.addEventListener("click", (event) => {
    const tabBtn = event.target.closest(".finanzas-tab");
    if (!tabBtn) return;
    const target = tabBtn.dataset.finanzasTab;

    document.querySelectorAll(".finanzas-tab").forEach((btn) => {
      btn.classList.toggle("finanzas-tab--active", btn === tabBtn);
    });
    finanzasTabPersonal.hidden = target !== "personal";
    finanzasTabServicios.hidden = target !== "servicios";
    financeSaveBtn.hidden = target === "servicios";
  });

  financeSaveBtn.addEventListener("click", () => {
    try {
      updateFinanzasSummary();
      addGold(5);
      grantXP(60);

      addMessage({ author: "TÚ", text: "Actualicé mi presupuesto financiero.", variant: "user" });

      MiikaeruHub.askAI(pillarPrompts.finanzas, { pillar: "finanzas" }).then((reply) => {
        setTimeout(() => addMessage({ author: "MIIKAERU", text: reply, variant: "bot" }), 400);
      });
    } catch (err) {
      console.error("Error al guardar el presupuesto de Finanzas:", err);
    }
  });

  // ---- Estado Físico: mini-formulario (metas + pasos) ----

  fisicoReps.value = state.pillars.fisico.repsGoal;
  fisicoSteps.value = state.pillars.fisico.steps.value;

  async function refreshStepsFromProvider() {
    const steps = await MiikaeruHub.fetchSteps();
    if (steps !== null && steps !== undefined) {
      fisicoSteps.value = steps;
      fisicoStepsSource.textContent = "smartwatch";
    } else {
      fisicoStepsSource.textContent = "manual";
    }
  }

  fisicoSubmit.addEventListener("click", () => {
    const repsGoal = parseInt(fisicoReps.value, 10) || 0;
    const steps = parseInt(fisicoSteps.value, 10) || 0;

    state.pillars.fisico.repsGoal = repsGoal;
    state.pillars.fisico.steps.value = steps;
    state.pillars.fisico.energy = Math.min(100, state.pillars.fisico.energy + 5);

    addMessage({
      author: "TÚ",
      text: `Registro físico: meta de ${repsGoal} repeticiones y ${steps} pasos.`,
      variant: "user",
    });

    renderHud();
    persist();
    addGold(5);
    grantXP(60);

    MiikaeruHub.askAI(pillarPrompts.fisico, { pillar: "fisico" }).then((reply) => {
      setTimeout(() => addMessage({ author: "MIIKAERU", text: reply, variant: "bot" }), 500);
    });

    closePillarModal();
  });

  // ---- Estado Espiritual: meditación en silencio + técnicas de claridad ----

  function formatCountdown(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  async function finishMeditation(minutes) {
    meditationCountdown.hidden = true;
    meditationControls.hidden = false;

    const idx = SPIRITUAL_STATES.indexOf(state.pillars.espiritual.estado);
    state.pillars.espiritual.estado = SPIRITUAL_STATES[(idx + 1) % SPIRITUAL_STATES.length];
    addGold(10);
    grantXP(50);
    renderHud();
    persist();

    addMessage({
      author: "SISTEMA",
      text: `Meditación en silencio de ${minutes} min completada.`,
      variant: "system",
    });

    const reply = await MiikaeruHub.askAI("meditacion en silencio", { pillar: "espiritual" });
    setTimeout(() => addMessage({ author: "MIIKAERU", text: reply, variant: "bot" }), 500);
  }

  meditationStartBtn.addEventListener("click", () => {
    const minutes = Math.max(1, parseInt(meditationMinutesInput.value, 10) || 3);
    let remaining = minutes * 60;

    meditationControls.hidden = true;
    meditationCountdown.hidden = false;
    meditationCountdownValue.textContent = formatCountdown(remaining);

    meditationInterval = setInterval(() => {
      remaining -= 1;
      meditationCountdownValue.textContent = formatCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(meditationInterval);
        meditationInterval = null;
        finishMeditation(minutes);
      }
    }, 1000);
  });

  meditationCancelBtn.addEventListener("click", () => {
    if (meditationInterval) {
      clearInterval(meditationInterval);
      meditationInterval = null;
    }
    meditationCountdown.hidden = true;
    meditationControls.hidden = false;
  });

  techniqueButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const techniqueName = btn.dataset.technique;

      addGold(5);
      grantXP(25);
      addMessage({
        author: "TÚ",
        text: `Completé la técnica de claridad mental: ${techniqueName}.`,
        variant: "user",
      });

      MiikaeruHub.askAI(techniqueName, { pillar: "espiritual" }).then((reply) => {
        setTimeout(() => addMessage({ author: "MIIKAERU", text: reply, variant: "bot" }), 400);
      });
    });
  });

  // ---- Click en botones de pilares: navegación mutuamente excluyente ----

  pillarsEl.addEventListener("click", (event) => {
    const btn = event.target.closest(".pillar-btn");
    if (!btn) return;
    togglePillarPanel(btn.dataset.pillar);
  });

  // ---------------- Wishlist / Garage ----------------

  // Flor de la Vida (Semilla de la Vida: círculo central + 6 alrededor,
  // cada uno a una distancia de su propio radio del centro — la regla de
  // construcción real del patrón, no círculos puestos a ojo). Puramente
  // decorativa: SVG inyectado como fondo de cada tarjeta de deseo, detrás
  // del ícono/nombre (ver orden de inserción en renderWishlist()).
  const SACRED_GEOMETRY_NS = "http://www.w3.org/2000/svg";

  function buildSacredGeometrySVG() {
    const svg = document.createElementNS(SACRED_GEOMETRY_NS, "svg");
    svg.setAttribute("class", "wishlist-item__sacred-geo");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("aria-hidden", "true");

    const r = 16;
    const cx = 50;
    const cy = 50;
    const centers = [[cx, cy]];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      centers.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }

    centers.forEach(([x, y]) => {
      const circle = document.createElementNS(SACRED_GEOMETRY_NS, "circle");
      circle.setAttribute("cx", x.toFixed(2));
      circle.setAttribute("cy", y.toFixed(2));
      circle.setAttribute("r", String(r));
      svg.appendChild(circle);
    });

    return svg;
  }

  // requirements puede faltar en datos guardados de antes de esta función
  // existir (localStorage con state.wishlist ya persistido) — por eso
  // TODAS las lecturas de item.requirements en este bloque usan `|| []`
  // en vez de asumir que siempre está presente.
  function getWishRequirements(item) {
    return Array.isArray(item.requirements) ? item.requirements : [];
  }

  function getWishProgress(item) {
    const reqs = getWishRequirements(item);
    if (!reqs.length) return 0;
    const done = reqs.filter((r) => r.done).length;
    return Math.round((done / reqs.length) * 100);
  }

  function isWishRequirementsComplete(item) {
    const reqs = getWishRequirements(item);
    return reqs.length > 0 && reqs.every((r) => r.done);
  }

  function renderWishlist() {
    wishlistGrid.innerHTML = "";
    let unlockedCount = 0;

    state.wishlist.forEach((item) => {
      if (item.unlocked) unlockedCount += 1;
      const requirementsComplete = isWishRequirementsComplete(item);

      const card = document.createElement("div");
      card.dataset.wishId = item.id;
      card.className = `wishlist-item ${item.unlocked ? "wishlist-item--unlocked" : ""} ${requirementsComplete ? "wishlist-item--requirements-complete" : ""}`;
      if (item.justUnlocked) {
        card.classList.add("wishlist-item--just-unlocked");
        delete item.justUnlocked;
      }

      card.appendChild(buildSacredGeometrySVG());

      if (!item.unlocked) {
        const lock = document.createElement("span");
        lock.className = "wishlist-item__lock";
        lock.textContent = "🔒";
        card.appendChild(lock);
      }

      const icon = document.createElement("span");
      icon.className = "wishlist-item__icon";
      icon.textContent = item.icon;

      const name = document.createElement("span");
      name.className = "wishlist-item__name";
      name.textContent = item.name;

      card.append(icon, name);

      // Barra de progreso automática — SIEMPRE visible (0% si el deseo
      // todavía no tiene requisitos cargados), calculada en base a
      // cuántos requisitos están marcados como completados.
      const progress = getWishProgress(item);
      const progressBar = document.createElement("div");
      progressBar.className = "wishlist-item__progress-bar";
      const progressFill = document.createElement("div");
      progressFill.className = "wishlist-item__progress-fill";
      progressFill.style.width = `${progress}%`;
      progressBar.appendChild(progressFill);
      card.appendChild(progressBar);

      if (!item.unlocked) {
        const req = document.createElement("span");
        req.className = "wishlist-item__req";
        req.textContent = `Nivel ${item.unlockLevel}`;
        card.appendChild(req);
      }

      wishlistGrid.appendChild(card);
    });

    wishlistCount.textContent = `${unlockedCount}/${state.wishlist.length}`;
  }

  function checkWishlistUnlocks() {
    let anyUnlocked = false;
    state.wishlist.forEach((item) => {
      if (!item.unlocked && state.level >= item.unlockLevel) {
        item.unlocked = true;
        item.justUnlocked = true;
        anyUnlocked = true;
        addMessage({
          author: "SISTEMA",
          text: `${item.name} desbloqueada en tu Garage. ¡Buen trabajo, ${rankForLevel(state.level)}!`,
          variant: "system",
        });
      }
    });
    if (anyUnlocked) renderWishlist();
    persist();
  }

  // Única fuente de verdad para crear un deseo nuevo — la llaman tanto el
  // submit del form (cubre el botón [+] y el Enter nativo del navegador)
  // como el keydown redundante de abajo (resguardo explícito, pedido
  // literal: "asigna correctamente el listener... al input de texto Y al
  // botón"). Devuelve true si realmente creó algo, para que el llamador
  // sepa si debe limpiar el input.
  function addWish(rawName) {
    const name = rawName.trim();
    if (!name) return false;

    state.wishlist.push({
      id: `custom-${Date.now()}`,
      name,
      icon: "⭐",
      unlockLevel: state.level + 5,
      unlocked: false,
      requirements: [],
    });

    renderWishlist();
    persist();
    return true;
  }

  wishlistForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (addWish(wishlistInput.value)) {
      wishlistInput.value = "";
    }
  });

  // Resguardo explícito en el input: previene el Enter nativo y dispara
  // el MISMO evento "submit" del form vía requestSubmit() (no duplica la
  // lógica de addWish(), solo garantiza que el camino del teclado quede
  // asignado sin depender exclusivamente del comportamiento por defecto
  // del navegador.
  wishlistInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    wishlistForm.requestSubmit();
  });

  // ---------------- Modal de Requisitos de Deseo ----------------

  let activeWishId = null;

  function getActiveWishItem() {
    return state.wishlist.find((item) => item.id === activeWishId) || null;
  }

  function renderWishlistItemModal() {
    const item = getActiveWishItem();
    if (!item) return;

    wishlistItemModalIcon.textContent = item.icon;
    wishlistItemModalName.textContent = item.name;

    const progress = getWishProgress(item);
    wishlistItemModalProgressFill.style.width = `${progress}%`;
    wishlistItemModalProgressText.textContent = `${progress}%`;

    const requirements = getWishRequirements(item);
    wishlistReqList.innerHTML = "";

    if (!requirements.length) {
      const empty = document.createElement("p");
      empty.className = "wishlist-req-empty";
      empty.textContent = t("wishlistReqEmpty");
      wishlistReqList.appendChild(empty);
      return;
    }

    requirements.forEach((req) => {
      const row = document.createElement("label");
      row.className = `wishlist-req-row ${req.done ? "wishlist-req-row--done" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = req.done;
      checkbox.dataset.reqId = req.id;

      const text = document.createElement("span");
      text.className = "wishlist-req-row__text";
      text.textContent = req.text;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "wishlist-req-row__remove";
      removeBtn.textContent = "✕";
      removeBtn.dataset.reqId = req.id;
      removeBtn.title = t("wishlistReqRemove");

      row.append(checkbox, text, removeBtn);
      wishlistReqList.appendChild(row);
    });
  }

  function openWishlistItemModal(wishId) {
    activeWishId = wishId;
    renderWishlistItemModal();
    wishlistItemModal.hidden = false;
  }

  function closeWishlistItemModal() {
    wishlistItemModal.hidden = true;
    activeWishId = null;
  }

  wishlistGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".wishlist-item");
    if (!card) return;
    openWishlistItemModal(card.dataset.wishId);
  });

  wishlistItemModalClose.addEventListener("click", closeWishlistItemModal);
  wishlistItemModal.addEventListener("click", (event) => {
    if (event.target === wishlistItemModal) closeWishlistItemModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !wishlistItemModal.hidden) closeWishlistItemModal();
  });

  wishlistReqForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const item = getActiveWishItem();
    const text = wishlistReqInput.value.trim();
    if (!item || !text) return;

    if (!Array.isArray(item.requirements)) item.requirements = [];
    // Sufijo aleatorio además de Date.now(): agregar varios requisitos
    // seguidos (envío rápido del formulario) puede caer en el mismo
    // milisegundo y generar ids duplicados solo con el timestamp — eso
    // rompía silenciosamente el checkbox equivocado al tildarlos (dos
    // requisitos "empatados" en el mismo id, find() siempre resuelve al
    // primero). Confirmado con datos reales durante las pruebas de este
    // mismo bloque.
    const reqId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    item.requirements.push({ id: reqId, text, done: false });
    wishlistReqInput.value = "";

    persist();
    renderWishlistItemModal();
    renderWishlist();
  });

  // Completar el 100% de los requisitos propios de un deseo es un camino
  // de desbloqueo ALTERNATIVO al de nivel (checkWishlistUnlocks()) — ambos
  // llevan al mismo estado --unlocked, pero solo este dispara el efecto
  // visual especial (--requirements-complete, ver style.css) y una
  // recompensa propia de oro/XP por completar la meta a pulso.
  function handleWishRequirementCompletion(item) {
    if (item.unlocked || !isWishRequirementsComplete(item)) return;
    item.unlocked = true;
    item.justUnlocked = true;
    addGold(10);
    grantXP(50);
    addMessage({
      author: "SISTEMA",
      text: t("wishlistReqAllDoneMessage").replace("{name}", item.name),
      variant: "system",
    });
  }

  wishlistReqList.addEventListener("change", (event) => {
    const checkbox = event.target.closest('input[type="checkbox"]');
    if (!checkbox) return;
    const item = getActiveWishItem();
    if (!item) return;

    const req = getWishRequirements(item).find((r) => r.id === checkbox.dataset.reqId);
    if (!req) return;
    req.done = checkbox.checked;

    handleWishRequirementCompletion(item);

    persist();
    renderWishlistItemModal();
    renderWishlist();
  });

  wishlistReqList.addEventListener("click", (event) => {
    const removeBtn = event.target.closest(".wishlist-req-row__remove");
    if (!removeBtn) return;
    const item = getActiveWishItem();
    if (!item) return;

    item.requirements = getWishRequirements(item).filter((r) => r.id !== removeBtn.dataset.reqId);

    persist();
    renderWishlistItemModal();
    renderWishlist();
  });

  // ---------------- Evidencia (adjuntar imagen) ----------------

  attachBtn.addEventListener("click", () => evidenceInput.click());

  evidenceInput.addEventListener("change", () => {
    const file = evidenceInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      pendingEvidenceImage = reader.result;
      evidencePreviewImg.src = pendingEvidenceImage;
      evidencePreview.hidden = false;
    };
    reader.readAsDataURL(file);
  });

  evidenceRemove.addEventListener("click", () => {
    pendingEvidenceImage = null;
    evidenceInput.value = "";
    evidencePreview.hidden = true;
  });

  // ---------------- Chat form ----------------

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text && !pendingEvidenceImage) return;

    addMessage({
      author: "TÚ",
      text: text || "[Evidencia adjunta]",
      variant: "user",
      image: pendingEvidenceImage,
    });

    chatInput.value = "";
    pendingEvidenceImage = null;
    evidenceInput.value = "";
    evidencePreview.hidden = true;

    // matchChatGuideIntent() es la MISMA función que usa generateReply()
    // para armar `reply` — se vuelve a llamar aquí (es pura, sin efectos
    // secundarios) solo para saber A CUÁL ícono del dock apuntar el
    // parpadeo neón.
    const guideIntent = matchChatGuideIntent(text);

    const reply = await MiikaeruHub.askAI(text, {});
    setTimeout(() => {
      addMessage({ author: "MIIKAERU", text: reply, variant: "bot" });
      if (guideIntent) {
        // Deja un momento para leer la respuesta antes de cerrar el chat
        // y revelar el ícono resaltado (ver pulseDockGlow arriba).
        setTimeout(() => pulseDockGlow(guideIntent.dockTarget), 1800);
      }
    }, 600);
  });

  // ---------------- Minijuego: Boss Fight 2D ----------------

  function getWeeklyMissionCompletionPct() {
    // TODO: reemplazar por el cálculo real en base al historial de pilares
    // completados esta semana. Por ahora lee un valor mock del state.
    const weekly = state.weeklyMissions || { completed: 0, total: 1 };
    if (!weekly.total) return 0;
    return Math.round((weekly.completed / weekly.total) * 100);
  }

  function computeShotDamage() {
    const pct = getWeeklyMissionCompletionPct();
    return Math.round(5 + (pct / 100) * 15); // rango 5–20 según % de misiones semanales
  }

  function unlockNextWishlistItem() {
    const target = state.wishlist
      .filter((item) => !item.unlocked)
      .sort((a, b) => a.unlockLevel - b.unlockLevel)[0];
    if (!target) return;

    target.unlocked = true;
    target.justUnlocked = true;
    renderWishlist();
    persist();
    addMessage({
      author: "SISTEMA",
      text: `${target.name} desbloqueada en tu Garage como recompensa de la Boss Fight.`,
      variant: "system",
    });
  }

  function stopMinigameAndReset() {
    if (activeMinigame) {
      activeMinigame.stop();
      activeMinigame = null;
    }
    minigamePlaceholder.hidden = false;
    minigamePlaceholder.textContent = t("bossWaiting");
    minigameStatus.textContent = t("bossStatusStandby");
    playBtn.textContent = t("bossStart");
    // Combate terminado (victoria, derrota o "Detener" manual): la escena
    // del avatar vuelve al estado de reposo.
    setAvatarState("idle");
  }

  function handleBossVictory() {
    minigameStatus.textContent = t("bossStatusVictory");
    addGold(20);
    grantXP(200);
    unlockNextWishlistItem();
    playAvatarEmote("victory", 4500);
    setAvatarSpeech("¡Victoria! El Boss ha caído. Bien hecho, guerrero.");
    addMessage({
      author: "SISTEMA",
      text: "Boss derrotado. +200 XP y +20 🪙 acreditados al núcleo.",
      variant: "system",
    });

    setTimeout(stopMinigameAndReset, 2500);
  }

  // Derrota: dificultad fácil-intermedia, así que no hay penalización de
  // XP/diamantes — solo un mensaje de aliento y la posibilidad de reintentar.
  function handleBossDefeat() {
    addMessage({
      author: "MIIKAERU",
      text: "El Boss te alcanzó, pero no es el final. Recupera fuerzas e inténtalo de nuevo cuando quieras.",
      variant: "bot",
    });
    setTimeout(stopMinigameAndReset, 2000);
  }

  playBtn.addEventListener("click", () => {
    if (activeMinigame) {
      stopMinigameAndReset();
      return;
    }

    minigamePlaceholder.hidden = true;
    minigameStatus.textContent = t("bossStatusCombat");
    playBtn.textContent = t("bossStop");
    // Combate iniciado: la escena del avatar pasa a modo Boss Fight.
    setAvatarState("boss");

    activeMinigame = MiikaeruHub.startMinigame({
      canvas: minigameCanvas,
      viewport: minigameViewport,
      damagePerShot: computeShotDamage(),
      onVictory: handleBossVictory,
      onDefeat: handleBossDefeat,
    });
  });

  // ---------------- App Hub: selector de módulos ----------------
  // Sistema universal de ventanas modales: cada módulo (Japonés, Boss
  // Fight, Calendario, Bio-Sync, Hábitos) abre su propia ventana
  // independiente y centrada al elegirlo, en vez de renderizarse
  // apretado dentro del panel App Hub. Boss Fight es hoy el único
  // módulo de juego real; Hábitos sigue mostrando un placeholder "en
  // desarrollo" hasta que tenga su propia herramienta.

  const APP_MODULES = {
    bossfight: { modal: () => bossfightModal },
    japanese: {
      modal: () => japaneseModal,
      onOpen: () => {
        updateJpModeBadge();
        showJpView("grid");
      },
    },
    habits: {
      modal: () => habitsModal,
      onOpen: () => {
        showHabitsTab("daily");
        renderHabitsStreak();
        renderHabitsGrid();
        renderWorkoutPlan();
        renderWorkoutHistory();
        renderSevenMinSection();
      },
    },
    // Karaoke sigue siendo "próximamente" — usa el placeholder genérico
    // (ver #app-placeholder-modal, index.html). Hábitos ya tiene su
    // propio módulo real arriba, así que dejó de compartir este modal.
    karaoke: {
      modal: () => appPlaceholderModal,
      onOpen: () => {
        appPlaceholderIcon.textContent = "🎤";
        appPlaceholderTitle.textContent = t("appKaraokeName");
        appPlaceholderText.textContent = t("appKaraokePlaceholder");
      },
    },
    calendar: {
      modal: () => calendarModal,
      onOpen: () => {
        calendarEventDateInput.value = calendarSelectedDate;
        renderCalendarWeekdays();
        renderCalendar();
        renderCalendarEventsList();
      },
    },
    biosync: {
      modal: () => biosyncModal,
      onOpen: () => {
        updateBpmDisplay(Number(biosyncManualBpm.value));
        renderBiometricsHistory();
      },
    },
  };

  const ALL_APP_MODALS = [bossfightModal, japaneseModal, calendarModal, biosyncModal, habitsModal, appPlaceholderModal, miikaPassModal];

  let activeApp = loadActiveApp();

  function syncActiveAppCard(appKey) {
    document.querySelectorAll(".app-card").forEach((card) => {
      card.classList.toggle("app-card--active", card.dataset.app === appKey);
    });
  }

  // Cierra cualquier ventana modal de módulo que estuviera abierta —
  // solo una a la vez tiene sentido en un sistema de ventanas
  // centradas de pantalla completa. También limpia efectos secundarios
  // que no deberían seguir corriendo detrás de una ventana cerrada
  // (combate de Boss Fight, síntesis de voz del módulo Japonés).
  function closeAllAppModals() {
    ALL_APP_MODALS.forEach((modal) => { modal.hidden = true; });
    if (activeMinigame) stopMinigameAndReset();
    window.speechSynthesis && window.speechSynthesis.cancel();
  }

  function openAppModal(appKey) {
    const app = APP_MODULES[appKey];
    if (!app) return;

    closeAllAppModals();
    syncActiveAppCard(appKey);
    app.modal().hidden = false;
    if (app.onOpen) app.onOpen();
  }

  function selectApp(appKey) {
    if (!APP_MODULES[appKey]) return;

    // Japonés no se recuerda como "módulo activo" persistente (es un
    // modal de consulta puntual, no tendría sentido auto-resaltar su
    // tarjeta como la última usada al recargar la página).
    if (appKey !== "japanese") {
      activeApp = appKey;
      persistActiveApp(appKey);
    }

    openAppModal(appKey);
  }

  appGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".app-card");
    if (!card) return;
    // Japonés ya no abre su modal directo: primero pasa por
    // #jp-config-modal (idioma de interfaz + modo Práctica/Examen,
    // pedido explícito) — elegir un modo ahí es lo que realmente llama a
    // selectApp("japanese").
    if (card.dataset.app === "japanese") {
      openJpConfigModal();
      return;
    }
    selectApp(card.dataset.app);
  });

  addAppBtn.addEventListener("click", () => {
    addMessage({ author: "SISTEMA", text: t("appAddedMessage"), variant: "system" });
  });

  // Cierre: botón [X], click en el backdrop, o Escape — mismo patrón en
  // todas las ventanas, ya que closeAllAppModals() es idempotente (cerrar
  // "todas" cuando solo una está abierta es seguro y más simple que una
  // función de cierre casi idéntica por cada una).
  [bossfightModal, calendarModal, biosyncModal, habitsModal, appPlaceholderModal, japaneseModal, miikaPassModal].forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeAllAppModals();
    });
  });
  [
    [bossfightModalClose, bossfightModal],
    [calendarModalClose, calendarModal],
    [biosyncModalClose, biosyncModal],
    [habitsModalClose, habitsModal],
    [appPlaceholderModalClose, appPlaceholderModal],
    [japaneseModalClose, japaneseModal],
    [miikaPassModalClose, miikaPassModal],
  ].forEach(([btn]) => btn.addEventListener("click", closeAllAppModals));

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (ALL_APP_MODALS.some((modal) => !modal.hidden)) closeAllAppModals();
  });

  // ---------------- Hábitos & Rachas ----------------

  function showHabitsTab(target) {
    document.querySelectorAll(".habits-tab").forEach((btn) => {
      btn.classList.toggle("habits-tab--active", btn.dataset.habitsTab === target);
    });
    habitsTabDaily.hidden = target !== "daily";
    habitsTabWorkout.hidden = target !== "workout";
  }

  habitsTabs.addEventListener("click", (event) => {
    const tabBtn = event.target.closest(".habits-tab");
    if (!tabBtn) return;
    showHabitsTab(tabBtn.dataset.habitsTab);
  });

  function renderHabitsStreak() {
    habitsStreakValue.textContent = habitsMeta.streak;
  }

  function renderHabitsGrid() {
    habitsGrid.innerHTML = "";
    const todayEntry = habitsLog[todayKey()] || {};
    HABITS_LIST.forEach((habit) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "habit-card";
      card.classList.toggle("habit-card--done", !!todayEntry[habit.id]);
      card.dataset.habitId = habit.id;

      const icon = document.createElement("span");
      icon.className = "habit-card__icon";
      icon.textContent = habit.icon;

      const label = document.createElement("span");
      label.className = "habit-card__label";
      label.textContent = t(habit.i18nKey);

      card.append(icon, label);
      card.addEventListener("click", () => toggleHabit(habit.id));
      habitsGrid.appendChild(card);
    });
  }

  // Alterna un hábito para HOY. Si al alternar quedan los 5 completos,
  // dispara la recompensa de racha una sola vez por día (guardada en
  // habitsMeta.lastStreakDate) — igual que updateActivityStreak(), el
  // salto de racha es real: +1 si el último día completo fue AYER,
  // reinicia a 1 en cualquier otro caso (incluida la primera vez).
  function toggleHabit(habitId) {
    const today = todayKey();
    const todayEntry = { ...(habitsLog[today] || {}) };
    todayEntry[habitId] = !todayEntry[habitId];
    habitsLog[today] = todayEntry;
    persistHabitsLog();
    renderHabitsGrid();

    const allDone = HABITS_LIST.every((habit) => todayEntry[habit.id]);
    if (allDone && habitsMeta.lastStreakDate !== today) {
      if (habitsMeta.lastStreakDate) {
        const diffDays = Math.round((new Date(today) - new Date(habitsMeta.lastStreakDate)) / 86400000);
        habitsMeta.streak = diffDays === 1 ? habitsMeta.streak + 1 : 1;
      } else {
        habitsMeta.streak = 1;
      }
      habitsMeta.lastStreakDate = today;
      persistHabitsMeta();
      renderHabitsStreak();

      addGold(15);
      grantXP(40);
      pulseAvatarStage();
      setAvatarSpeech(t("habitsAllDoneCongrats").replace("{streak}", habitsMeta.streak));
      addMessage({
        author: "SISTEMA",
        text: `${t("habitsAllDoneCongrats").replace("{streak}", habitsMeta.streak)} +40 XP · +15 🪙`,
        variant: "system",
      });

      syncHabitsToSupabase(today, Object.keys(todayEntry).filter((id) => todayEntry[id]));
    }
  }

  // ---------------- Rutina de Ejercicios ----------------

  let selectedWorkoutDay = WORKOUT_WEEKDAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1].id; // getDay(): 0=domingo

  function renderWorkoutPlan() {
    workoutPlanEl.innerHTML = "";

    const weekdaysRow = document.createElement("div");
    weekdaysRow.className = "workout-plan__weekdays";
    WORKOUT_WEEKDAYS.forEach((day) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "workout-weekday-btn";
      btn.classList.toggle("workout-weekday-btn--active", day.id === selectedWorkoutDay);
      btn.textContent = t(day.i18nKey);
      btn.addEventListener("click", () => {
        selectedWorkoutDay = day.id;
        renderWorkoutPlan();
      });
      weekdaysRow.appendChild(btn);
    });

    const focusInput = document.createElement("input");
    focusInput.type = "text";
    focusInput.className = "workout-plan__focus-input";
    focusInput.placeholder = t("workoutFocusPlaceholder");
    focusInput.value = workoutPlan[selectedWorkoutDay] || "";
    focusInput.addEventListener("change", () => {
      workoutPlan[selectedWorkoutDay] = focusInput.value.trim();
      persistWorkoutPlan();
    });

    workoutPlanEl.append(weekdaysRow, focusInput);
  }

  function renderWorkoutHistory() {
    workoutLogHistory.innerHTML = "";
    const recent = workoutLog.slice(-6).reverse();
    recent.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "workout-log-entry";
      // entry.date es "YYYY-MM-DD" (ver todayKey()) — new Date("YYYY-MM-DD")
      // lo interpreta como medianoche UTC, así que en cualquier huso horario
      // detrás de UTC (ej. Perú, UTC-5) se muestra como el día ANTERIOR.
      // Se arma con el constructor local (año, mes, día) para evitar esa
      // conversión UTC por completo.
      const [y, m, d] = entry.date.split("-").map(Number);
      const date = new Date(y, m - 1, d).toLocaleDateString(calendarLocale());
      row.textContent = `${date} — ${entry.exercise} · ${entry.sets}x${entry.reps} · ${entry.weightKg}kg`;
      workoutLogHistory.appendChild(row);
    });
  }

  workoutLogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const exercise = workoutExerciseInput.value.trim();
    if (!exercise) return;

    const entry = {
      id: `workout-${Date.now()}`,
      date: todayKey(),
      weekday: selectedWorkoutDay,
      exercise,
      sets: Number(workoutSetsInput.value) || 0,
      reps: Number(workoutRepsInput.value) || 0,
      weightKg: Number(workoutWeightInput.value) || 0,
    };

    workoutLog.push(entry);
    persistWorkoutLog();
    renderWorkoutHistory();
    syncWorkoutToSupabase(entry);

    workoutExerciseInput.value = "";
    workoutSetsInput.value = "";
    workoutRepsInput.value = "";
    workoutWeightInput.value = "";
    addGold(3);
    grantXP(15);
  });

  // ---------------- Reto 7 Minutos ----------------
  // Circuito guiado (ver SEVEN_MIN_EXERCISES/SEVEN_MIN_WEEKS más arriba)
  // — deliberadamente SIN cronómetro en vivo: implementar un timer real
  // (pausa/reanudar, aviso sonoro entre ejercicios) es una feature mucho
  // más grande y con más superficie de bugs (permisos de audio, estado
  // de pausa, etc.) que lo que se pidió ("guías visuales claras para
  // mantener la constancia") — la guía de cada ejercicio ya indica los
  // 30s/10s de forma clara, y el usuario cuenta con su propio reloj o
  // temporizador del celular. Se puede agregar un timer real más
  // adelante como su propio bloque de trabajo si hace falta.

  function sevenMinCompletedCount() {
    return sevenMinLog.length;
  }

  function isSevenMinWeekUnlocked(week) {
    return sevenMinCompletedCount() >= week.sessionsToUnlock;
  }

  function hasCompletedSevenMinToday() {
    const today = todayKey();
    return sevenMinLog.some((entry) => entry.date === today);
  }

  function renderSevenMinWeekToggle() {
    sevenMinWeekToggle.innerHTML = "";
    SEVEN_MIN_WEEKS.forEach((week) => {
      const unlocked = isSevenMinWeekUnlocked(week);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seven-min-week-btn";
      btn.classList.toggle("seven-min-week-btn--active", week.id === selectedSevenMinWeek);
      btn.classList.toggle("seven-min-week-btn--locked", !unlocked);

      const label = document.createElement("span");
      label.textContent = t(week.titleKey);
      btn.appendChild(label);

      if (!unlocked) {
        btn.disabled = true;
        const badge = document.createElement("span");
        badge.className = "seven-min-week-btn__badge";
        badge.textContent = `🔒 ${week.sessionsToUnlock - sevenMinCompletedCount()} ${t("sevenMinSessionsToUnlock")}`;
        btn.appendChild(badge);
      } else {
        btn.addEventListener("click", () => {
          selectedSevenMinWeek = week.id;
          renderSevenMinWeekToggle();
          renderSevenMinExercises();
        });
      }

      sevenMinWeekToggle.appendChild(btn);
    });
  }

  function renderSevenMinExercises() {
    const week = SEVEN_MIN_WEEKS.find((w) => w.id === selectedSevenMinWeek) || SEVEN_MIN_WEEKS[0];
    sevenMinProgressEl.textContent = `${t(week.descKey)} — ${sevenMinCompletedCount()} ${t("sevenMinSessionsCompleted")}`;

    sevenMinExerciseGrid.innerHTML = "";
    SEVEN_MIN_EXERCISES.forEach((exercise) => {
      const card = document.createElement("div");
      card.className = "seven-min-exercise-card";

      const header = document.createElement("div");
      header.className = "seven-min-exercise-card__header";
      header.textContent = `${exercise.icon} ${t(exercise.nameKey)}`;

      const timing = document.createElement("span");
      timing.className = "seven-min-exercise-card__timing";
      timing.textContent = "30s · 10s " + t("sevenMinRestLabel");

      const guide = document.createElement("p");
      guide.className = "seven-min-exercise-card__guide";
      guide.textContent = t(exercise.guideKey);

      card.append(header, timing, guide);
      sevenMinExerciseGrid.appendChild(card);
    });
  }

  function renderSevenMinCompleteBtn() {
    const done = hasCompletedSevenMinToday();
    sevenMinCompleteBtn.disabled = done;
    sevenMinCompleteBtn.textContent = done ? `✅ ${t("sevenMinAlreadyDoneToday")}` : t("sevenMinCompleteBtn");
  }

  function renderSevenMinSection() {
    // Arranca mostrando la última semana desbloqueada (no siempre la 1),
    // así alguien que ya viene de sesiones previas ve directo dónde va.
    const unlockedWeeks = SEVEN_MIN_WEEKS.filter((w) => isSevenMinWeekUnlocked(w));
    selectedSevenMinWeek = unlockedWeeks.length ? unlockedWeeks[unlockedWeeks.length - 1].id : 1;
    renderSevenMinWeekToggle();
    renderSevenMinExercises();
    renderSevenMinCompleteBtn();
  }

  sevenMinCompleteBtn.addEventListener("click", () => {
    if (hasCompletedSevenMinToday()) return; // guard extra — el botón ya queda disabled, pero por si acaso
    const wasUnlocked = SEVEN_MIN_WEEKS.map((w) => isSevenMinWeekUnlocked(w));
    sevenMinLog.push({ date: todayKey(), weekId: selectedSevenMinWeek });
    persistSevenMinLog();

    // Si esta sesión desbloqueó una semana nueva, avisa en el chat —
    // mismo criterio de refuerzo positivo que otras rachas de la app.
    const newlyUnlocked = SEVEN_MIN_WEEKS.find((w, i) => !wasUnlocked[i] && isSevenMinWeekUnlocked(w));
    if (newlyUnlocked) {
      addMessage({ author: "MIIKAERU", text: `🏆 ${t("sevenMinWeekUnlockedMsg")} ${t(newlyUnlocked.titleKey)}`, variant: "avatar" });
    }

    addGold(5);
    grantXP(25);
    renderSevenMinWeekToggle();
    renderSevenMinExercises();
    renderSevenMinCompleteBtn();
  });

  // ---------------- Forzar Actualización / Limpiar Caché ----------------
  // Botón de emergencia (modal de Perfiles) para celulares que se quedan
  // pegados en una versión vieja del Service Worker/caché — desregistra
  // el SW y borra el CacheStorage (NO toca localStorage/datos del
  // usuario), luego recarga forzando red vía cache-busting query propio.
  if (forceUpdateBtn) {
    forceUpdateBtn.addEventListener("click", async () => {
      forceUpdateBtn.disabled = true;
      forceUpdateBtn.textContent = t("forceUpdateBtnWorking");
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((reg) => reg.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
      } catch (err) {
        console.warn("Forzar actualización: no se pudo limpiar todo el caché:", err);
      }
      window.location.href = `${window.location.pathname}?forcecache=${Date.now()}`;
    });
  }

  // ---------------- Controles de escala (León / Chat) ----------------
  // Solo escriben las custom properties --avatar-scale/--chat-scale que
  // ya maneja el CSS (transform:scale en .hud-center .panel--avatar y
  // .modal--chat) — nunca tocan flex-basis/max-width, así que no pueden
  // reintroducir el bug de superposición de layout del Bloque 37.
  let scalePrefs = loadScalePrefs();

  function applyScalePrefs() {
    document.documentElement.style.setProperty("--avatar-scale", scalePrefs.avatar);
    document.documentElement.style.setProperty("--chat-scale", scalePrefs.chat);
    avatarScaleInput.value = scalePrefs.avatar;
    chatScaleInput.value = scalePrefs.chat;
    avatarScaleValue.textContent = `${Math.round(scalePrefs.avatar * 100)}%`;
    chatScaleValue.textContent = `${Math.round(scalePrefs.chat * 100)}%`;
  }

  avatarScaleInput.addEventListener("input", () => {
    scalePrefs.avatar = Number(avatarScaleInput.value);
    persistScalePrefs(scalePrefs);
    applyScalePrefs();
  });

  chatScaleInput.addEventListener("input", () => {
    scalePrefs.chat = Number(chatScaleInput.value);
    persistScalePrefs(scalePrefs);
    applyScalePrefs();
  });

  scaleResetBtn.addEventListener("click", () => {
    scalePrefs = { avatar: 1, chat: 1 };
    persistScalePrefs(scalePrefs);
    applyScalePrefs();
  });

  applyScalePrefs();

  // ---------------- Miika Pass: pase de progresión (niveles 1-50) ----------------
  // Visualización de progreso sobre el Nivel/XP ya existente (state.level)
  // — no es un sistema de misiones nuevo, cada nivel real desbloqueado
  // por el jugador revela su recompensa en el pase. Ampliado de 20 a 50
  // niveles (pedido explícito de mostrar "las fases más fuertes y súper
  // evolucionadas") para poder llegar de verdad a los tramos altos de
  // MIIKAERU_SKINS/FESHA_EVOLUTIONS/MIJASHI_EVOLUTIONS (hasta Nv. 50) —
  // con el tope viejo de 20 esas imágenes nunca se llegaban a mostrar acá.
  const MPASS_TIER_COUNT = 50;

  // Recompensa de un tier: se deriva de los datos ya existentes en vez de
  // hardcodear un mapa aparte — cualquier nivel que coincida con un
  // desbloqueo real de MIIKAERU_SKINS y/o de la evolución del personaje
  // elegido (Fesha/Mijashi, ver PLAYER_CHARACTERS) se muestra como
  // recompensa "avatar" (una o dos miniaturas), el resto sigue cayendo en
  // oro/diamantes como antes.
  function getMiikaPassReward(tier) {
    const skin = MIIKAERU_SKINS.find((entry) => entry.nivelRequerido === tier);
    const personaje = state.playerCharacter ? PLAYER_CHARACTERS[state.playerCharacter] : null;
    const fase = personaje ? personaje.evoluciones.find((entry) => entry.nivelRequerido === tier) : null;

    if (skin || fase) {
      return {
        type: "avatar",
        skinSrc: skin ? skin.src : null,
        skinLabel: skin ? `Skin del León — Nv. ${tier}` : null,
        faseSrc: fase ? fase.src : null,
        faseLabel: fase ? `${personaje.nombre} — ${fase.titulo}` : null,
      };
    }
    if (tier % 2 === 0) return { type: "diamonds", amount: tier };
    return { type: "gold", amount: tier * 10 };
  }

  function renderMiikaPass() {
    mpassTrack.innerHTML = "";
    const onlyUnlocked = mpassFilter.value === "unlocked";

    for (let tier = 1; tier <= MPASS_TIER_COUNT; tier++) {
      const unlocked = state.level >= tier;
      if (onlyUnlocked && !unlocked) continue;

      const reward = getMiikaPassReward(tier);
      const card = document.createElement("div");
      card.className = `mpass-tier ${unlocked ? "mpass-tier--unlocked" : "mpass-tier--locked"}${reward.type === "avatar" ? " mpass-tier--special" : ""}`;

      const num = document.createElement("span");
      num.className = "mpass-tier__num";
      num.textContent = `${t("miikaPassLevelPrefix")} ${tier}`;
      card.appendChild(num);

      if (reward.type === "avatar") {
        // Hasta 2 miniaturas lado a lado: el skin del León y, si el tier
        // coincide con una fase del personaje elegido, también su
        // evolución — "vinculados a la progresión de niveles" pedido
        // explícitamente.
        const row = document.createElement("div");
        row.className = "mpass-tier__avatar-row";
        [
          { src: reward.skinSrc, label: reward.skinLabel },
          { src: reward.faseSrc, label: reward.faseLabel },
        ].forEach(({ src, label }) => {
          if (!src) return;
          const img = document.createElement("img");
          img.className = "mpass-tier__avatar";
          img.src = src;
          img.alt = label;
          img.title = label;
          img.loading = "lazy";
          row.appendChild(img);
        });
        card.appendChild(row);
      } else {
        const rewardEl = document.createElement("div");
        rewardEl.className = "mpass-tier__reward";
        const icon = document.createElement("span");
        icon.textContent = reward.type === "gold" ? "🪙" : "💎";
        const amount = document.createElement("span");
        amount.textContent = String(reward.amount);
        rewardEl.append(icon, amount);
        card.appendChild(rewardEl);
      }

      mpassTrack.appendChild(card);
    }
  }

  miikaPassBtn.addEventListener("click", () => {
    closeAllAppModals();
    renderMiikaPass();
    miikaPassModal.hidden = false;
  });

  mpassFilter.addEventListener("change", renderMiikaPass);

  // ---------------- Módulo Calendario & Eventos ----------------
  // calendarViewDate: mes actualmente mostrado en la grilla (no persiste,
  // siempre arranca en el mes actual al abrir el módulo). calendarSelectedDate:
  // día activo para agregar/ver eventos, en formato "YYYY-MM-DD".

  let calendarViewDate = new Date();
  let calendarSelectedDate = formatDateKey(new Date());

  function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function calendarLocale() {
    if (currentLanguage === "en") return "en-US";
    if (currentLanguage === "ja") return "ja-JP";
    return "es-ES";
  }

  function renderCalendarWeekdays() {
    const base = new Date(2023, 0, 1); // domingo, para arrancar la semana en domingo
    calendarWeekdaysEl.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const d = new Date(2023, 0, 1 + i);
      const span = document.createElement("span");
      span.textContent = d.toLocaleDateString(calendarLocale(), { weekday: "short" });
      calendarWeekdaysEl.appendChild(span);
    }
  }

  function renderCalendar() {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const monthLabel = calendarViewDate.toLocaleDateString(calendarLocale(), {
      month: "long",
      year: "numeric",
    });
    calendarMonthLabel.textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

    calendarGridEl.innerHTML = "";
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = formatDateKey(new Date());

    for (let i = 0; i < startOffset; i++) {
      const empty = document.createElement("div");
      empty.className = "calendar-day calendar-day--empty";
      calendarGridEl.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(new Date(year, month, day));
      const dayEvents = calendarEvents.filter((ev) => ev.date === dateKey);

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "calendar-day";
      if (dateKey === todayKey) cell.classList.add("calendar-day--today");
      if (dateKey === calendarSelectedDate) cell.classList.add("calendar-day--selected");
      cell.dataset.date = dateKey;
      cell.textContent = String(day);

      if (dayEvents.length) {
        const dot = document.createElement("span");
        dot.className = "calendar-day__dot";
        cell.appendChild(dot);
      }

      calendarGridEl.appendChild(cell);
    }
  }

  function renderCalendarEventsList() {
    calendarEventsList.innerHTML = "";
    const dayEvents = calendarEvents.filter((ev) => ev.date === calendarSelectedDate);

    if (!dayEvents.length) {
      const empty = document.createElement("p");
      empty.className = "calendar-events-empty";
      empty.textContent = t("calendarNoEvents");
      calendarEventsList.appendChild(empty);
      return;
    }

    dayEvents.forEach((ev) => {
      const row = document.createElement("div");
      row.className = "calendar-event-row";

      const title = document.createElement("span");
      title.textContent = ev.title;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "finanzas-category__remove";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => {
        calendarEvents = calendarEvents.filter((e) => e.id !== ev.id);
        persistCalendarEvents();
        renderCalendar();
        renderCalendarEventsList();
      });

      row.append(title, removeBtn);
      calendarEventsList.appendChild(row);
    });
  }

  calendarPrevBtn.addEventListener("click", () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
    renderCalendar();
  });

  calendarNextBtn.addEventListener("click", () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
    renderCalendar();
  });

  calendarGridEl.addEventListener("click", (event) => {
    const cell = event.target.closest(".calendar-day:not(.calendar-day--empty)");
    if (!cell) return;
    calendarSelectedDate = cell.dataset.date;
    calendarEventDateInput.value = calendarSelectedDate;
    renderCalendar();
    renderCalendarEventsList();
  });

  calendarAddEventBtn.addEventListener("click", () => {
    const date = calendarEventDateInput.value || calendarSelectedDate;
    const title = calendarEventTitleInput.value.trim();
    if (!date || !title) return;

    calendarEvents.push({ id: `evt-${Date.now()}`, date, title });
    persistCalendarEvents();
    calendarEventTitleInput.value = "";
    calendarSelectedDate = date;
    renderCalendar();
    renderCalendarEventsList();
    addGold(1);
  });

  // ---------------- Módulo Bio-Sync & Estado Físico ----------------
  // Lectura de BPM: vía Bluetooth real (GATT heart_rate/heart_rate_measurement,
  // parseo estándar de flags + uint8/uint16 según la especificación Bluetooth
  // SIG) o vía slider manual/simulación — ambas rutas terminan en
  // updateBpmDisplay(), que es la única que toca el DOM y el gráfico de pulso.

  let biosyncBtDevice = null;

  function updateBpmDisplay(bpm) {
    biosyncBpmValueEl.textContent = String(bpm);
    const beatDuration = Math.max(0.35, 60 / Math.max(bpm, 1));
    biosyncBpmValueEl.style.animationDuration = `${beatDuration}s`;
    if (biosyncPulseLine) {
      biosyncPulseLine.style.animationDuration = `${beatDuration * 1.4}s`;
    }
  }

  function handleHeartRateChanged(event) {
    const value = event.target.value;
    // Formato GATT estándar del characteristic Heart Rate Measurement: el
    // primer byte son flags; el bit 0 indica si el valor de BPM viene en
    // UINT8 (byte 1) o UINT16 little-endian (bytes 1-2).
    const flags = value.getUint8(0);
    const isUint16 = (flags & 0x1) === 1;
    const bpm = isUint16 ? value.getUint16(1, true) : value.getUint8(1);
    updateBpmDisplay(bpm);
  }

  async function connectSmartwatch() {
    if (!navigator.bluetooth) {
      biosyncBtStatus.textContent = t("biosyncBtUnavailable");
      return;
    }
    try {
      biosyncBtStatus.textContent = t("biosyncBtConnecting");
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ["heart_rate"] }],
      });
      biosyncBtDevice = device;
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService("heart_rate");
      const characteristic = await service.getCharacteristic("heart_rate_measurement");
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", handleHeartRateChanged);
      biosyncBtStatus.textContent = `${t("biosyncBtConnected")} ${device.name || ""}`.trim();
    } catch (err) {
      biosyncBtStatus.textContent = `${t("biosyncBtError")} ${err.message || err}`;
    }
  }

  biosyncConnectBtn.addEventListener("click", connectSmartwatch);

  biosyncManualBpm.addEventListener("input", () => {
    const bpm = Number(biosyncManualBpm.value);
    biosyncManualBpmValue.textContent = String(bpm);
    updateBpmDisplay(bpm);
  });

  biosyncEnergyInput.addEventListener("input", () => {
    biosyncEnergyValue.textContent = biosyncEnergyInput.value;
  });

  function renderBiometricsHistory() {
    biosyncLogHistory.innerHTML = "";
    const recent = biometricsLog.slice(-5).reverse();
    recent.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "biosync-log-entry";
      const date = new Date(entry.date).toLocaleDateString(calendarLocale());
      row.textContent = `${date} — ${entry.weight}kg · ${entry.sleepHours}h · ${t("biosyncEnergyShort")} ${entry.energyLevel}/10`;
      biosyncLogHistory.appendChild(row);
    });
  }

  biosyncSaveLogBtn.addEventListener("click", () => {
    const weight = Number(biosyncWeightInput.value) || 0;
    const sleepHours = Number(biosyncSleepInput.value) || 0;
    const energyLevel = Number(biosyncEnergyInput.value) || 5;

    biometricsLog.push({
      id: `bio-${Date.now()}`,
      date: new Date().toISOString(),
      weight,
      sleepHours,
      energyLevel,
    });
    persistBiometricsLog();
    renderBiometricsHistory();

    biosyncWeightInput.value = "";
    biosyncSleepInput.value = "";
    addGold(3);
    grantXP(20);
    addMessage({
      author: "TÚ",
      text: t("biosyncLogMessage")
        .replace("{weight}", String(weight))
        .replace("{sleep}", String(sleepHours))
        .replace("{energy}", String(energyLevel)),
      variant: "user",
    });
  });

  // ---------------- Módulo Japonés: cuadrícula Gojuon + trazo + quiz ----------------
  // Tres sub-vistas dentro de #app-view-japanese: grid (elegir fila o
  // práctica general) -> stroke (carácter grande, con "Omitir Trazo") ->
  // quiz (opción múltiple de romanización). El dominio (JP_MASTERY_THRESHOLD
  // respuestas correctas) se guarda en state.pillars.aprendizaje.mastery,
  // clave "script:caracter" para que hiragana/katakana no se pisen entre sí.

  let jpScript = "hiragana";
  let jpQueue = [];
  let jpQueueIndex = 0;
  let jpSessionCorrect = 0;
  // "practica" (default) = solo estudio: cuadrícula -> fases + vocabulario,
  // sin evaluación. "examen" = cuadrícula -> Prueba 1 (orden de trazos) ->
  // Prueba 2 (opción múltiple). Se elige en #jp-config-modal, pantalla
  // inicial del módulo (pedido explícito).
  let jpMode = "practica";

  // Un único "renglón" con los 10 Kanji Básicos (N5) — a diferencia de
  // hiragana/katakana no existe una estructura de filas Gojuon para
  // kanji, así que se listan todos juntos bajo un solo encabezado.
  // Reutiliza exactamente las mismas clases .jp-row/.jp-kana-btn, sin
  // CSS nuevo.
  function renderKanjiGrid() {
    const rowEl = document.createElement("div");
    rowEl.className = "jp-row";

    const header = document.createElement("div");
    header.className = "jp-row__header";

    const label = document.createElement("span");
    label.className = "jp-row__label";
    label.textContent = t("jpKanjiN5Title");

    const practiceBtn = document.createElement("button");
    practiceBtn.type = "button";
    practiceBtn.className = "jp-row__practice-btn";
    practiceBtn.dataset.rowPractice = "kanji-n5";
    practiceBtn.title = `${t("jpPracticeRow")} ${t("jpKanjiN5Title")}`;
    practiceBtn.textContent = "▶";

    header.append(label, practiceBtn);

    const kanaWrap = document.createElement("div");
    kanaWrap.className = "jp-row__kana";

    KANJI_N5.forEach((k) => {
      const key = `kanji:${k.char}`;
      const level = state.pillars.aprendizaje.mastery[key] || 0;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "jp-kana-btn";
      if (level >= JP_MASTERY_THRESHOLD) btn.classList.add("jp-kana-btn--mastered");
      btn.dataset.rowId = "kanji-n5";
      btn.title = `${k.meaning} — ${k.kunyomi} / ${k.onyomi}`;
      btn.textContent = k.char;

      if (level > 0) {
        const stars = document.createElement("span");
        stars.className = "jp-kana-btn__stars";
        stars.textContent = "★".repeat(Math.min(level, JP_MASTERY_THRESHOLD));
        btn.appendChild(stars);
      }

      kanaWrap.appendChild(btn);
    });

    rowEl.append(header, kanaWrap);
    jpRowsEl.appendChild(rowEl);
  }

  function renderGojuonGrid() {
    jpRowsEl.innerHTML = "";

    if (jpScript === "kanji") {
      renderKanjiGrid();
      return;
    }

    GOJUON_ROWS.forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "jp-row";

      const header = document.createElement("div");
      header.className = "jp-row__header";

      const label = document.createElement("span");
      label.className = "jp-row__label";
      label.textContent = formatGojuonRowLabel(row);

      const practiceBtn = document.createElement("button");
      practiceBtn.type = "button";
      practiceBtn.className = "jp-row__practice-btn";
      practiceBtn.dataset.rowPractice = row.id;
      practiceBtn.title = `${t("jpPracticeRow")} ${formatGojuonRowLabel(row)}`;
      practiceBtn.textContent = "▶";

      header.append(label, practiceBtn);

      const kanaWrap = document.createElement("div");
      kanaWrap.className = "jp-row__kana";

      row[jpScript].forEach((char, i) => {
        const romaji = row.romajiList[i];
        const key = `${jpScript}:${char}`;
        const level = state.pillars.aprendizaje.mastery[key] || 0;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "jp-kana-btn";
        if (level >= JP_MASTERY_THRESHOLD) btn.classList.add("jp-kana-btn--mastered");
        btn.dataset.rowId = row.id;
        btn.title = romaji;
        btn.textContent = char;

        if (level > 0) {
          const stars = document.createElement("span");
          stars.className = "jp-kana-btn__stars";
          stars.textContent = "★".repeat(Math.min(level, JP_MASTERY_THRESHOLD));
          btn.appendChild(stars);
        }

        kanaWrap.appendChild(btn);
      });

      rowEl.append(header, kanaWrap);
      jpRowsEl.appendChild(rowEl);
    });
  }

  function showJpView(view) {
    jpViewGrid.hidden = view !== "grid";
    jpViewPhases.hidden = view !== "phases";
    jpViewExamstroke.hidden = view !== "examstroke";
    jpViewQuiz.hidden = view !== "quiz";
    jpViewVocab.hidden = view !== "vocab";
    jpViewVocabWords.hidden = view !== "vocab-words";
    jpViewGrammar.hidden = view !== "grammar";
    jpViewYoon.hidden = view !== "yoon";
    jpViewMiniQuiz.hidden = view !== "mini-quiz";
    if (view === "grid") renderGojuonGrid();
    if (view === "vocab") renderN5VocabCategories();
    if (view === "grammar") renderN5GrammarList();
    if (view === "yoon") renderYoonGrid();
  }

  // ---------------- IndexedDB: progreso N5 + contenido curricular ----------------
  // Capa aditiva y EXCLUSIVA del módulo japonés — el resto de la app
  // (Finanzas, Hábitos, Wishlist, Negocio, etc.) sigue en localStorage sin
  // tocar, esa parte ya funciona y migrarla completa sería un refactor de
  // alto riesgo sin ningún beneficio real para esas features. Antes de este
  // bloque el N5 no tenía NINGÚN tracking de progreso (los mini-quiz daban
  // oro/XP pero no quedaba registro de qué categoría/punto ya se completó)
  // — esta capa llena ese hueco real. Todo "mejor esfuerzo": si IndexedDB
  // no está disponible (Safari privado, cuota llena, navegador viejo) la
  // app sigue funcionando exactamente igual, solo sin badges de progreso
  // persistente ni contenido espejado en IndexedDB — el currículum ya
  // funciona offline igual gracias a que vive inline en este mismo
  // app.js, cacheado por el Service Worker (ver sw.js).
  const N5_DB_NAME = "miikaeru-n5";
  const N5_DB_VERSION = 1;
  const N5_CONTENT_VERSION = "20260731-1"; // subir cuando cambie vocab/gramática/kanji/kana

  let n5DbPromise = null;

  function openN5Db() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    if (n5DbPromise) return n5DbPromise;
    n5DbPromise = new Promise((resolve) => {
      let req;
      try {
        req = indexedDB.open(N5_DB_NAME, N5_DB_VERSION);
      } catch (err) {
        console.warn("IndexedDB N5: no se pudo abrir la base (se sigue sin progreso persistente):", err);
        resolve(null);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("content")) db.createObjectStore("content", { keyPath: "id" });
        if (!db.objectStoreNames.contains("progress")) db.createObjectStore("progress", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn("IndexedDB N5: no se pudo abrir la base (se sigue sin progreso persistente):", req.error);
        resolve(null);
      };
    });
    return n5DbPromise;
  }

  function n5DbPut(storeName, record) {
    return openN5Db()
      .then((db) => {
        if (!db) return;
        return new Promise((resolve) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).put(record);
          tx.oncomplete = () => resolve();
          tx.onerror = () => {
            console.warn(`IndexedDB N5: fallo al guardar en "${storeName}" (offline u otro motivo, se ignora):`, tx.error);
            resolve();
          };
        });
      })
      .catch(() => {});
  }

  function n5DbGetAll(storeName) {
    return openN5Db()
      .then((db) => {
        if (!db) return [];
        return new Promise((resolve) => {
          const tx = db.transaction(storeName, "readonly");
          const req = tx.objectStore(storeName).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
      })
      .catch(() => []);
  }

  // Puebla/actualiza el contenido N5 en IndexedDB una sola vez por versión
  // — deja el currículum guardado localmente de forma persistente y
  // consultable (lo que pide el punto 2 del pedido), más allá del cacheo
  // del propio app.js por el Service Worker. Si no hay red, esto igual
  // funciona: no depende de fetch, solo copia las constantes que ya están
  // cargadas en memoria hacia el almacenamiento local del navegador.
  function syncN5ContentToIndexedDb() {
    n5DbGetAll("content").then((existing) => {
      const upToDate = existing.length >= 4 && existing.every((row) => row.version === N5_CONTENT_VERSION);
      if (upToDate) return;
      n5DbPut("content", { id: "vocab", version: N5_CONTENT_VERSION, data: N5_VOCAB_CATEGORIES });
      n5DbPut("content", { id: "grammar", version: N5_CONTENT_VERSION, data: N5_GRAMMAR_POINTS });
      n5DbPut("content", { id: "kanji", version: N5_CONTENT_VERSION, data: KANJI_N5 });
      n5DbPut("content", { id: "kana", version: N5_CONTENT_VERSION, data: GOJUON_ROWS });
    });
  }
  syncN5ContentToIndexedDb();

  // Progreso: un registro por quiz (vocabulario por categoría, o
  // gramática), guardado con el ID `vocab:<catId>` o `grammar` — se pisa
  // solo si el puntaje nuevo iguala o mejora el mejor guardado. Leído una
  // vez al arrancar y usado por renderN5VocabCategories()/
  // renderN5GrammarList() para mostrar el badge "✓ Completado".
  let n5ProgressCache = {};

  function loadN5ProgressCache() {
    return n5DbGetAll("progress").then((rows) => {
      n5ProgressCache = {};
      rows.forEach((row) => {
        n5ProgressCache[row.id] = row;
      });
      renderN5VocabCategories();
      renderN5GrammarList();
    });
  }
  loadN5ProgressCache();

  function saveN5Progress(id, score, total) {
    const prev = n5ProgressCache[id];
    if (prev && prev.score >= score) return; // no pisa un mejor puntaje ya guardado
    const record = { id, score, total, completedAt: Date.now() };
    n5ProgressCache[id] = record;
    n5DbPut("progress", record);
  }

  // ---------------- Vocabulario N5 (por categoría) ----------------

  let activeN5Category = null;

  function renderN5VocabCategories() {
    jpVocabCatGrid.innerHTML = "";
    N5_VOCAB_CATEGORIES.forEach((cat) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "jp-vocab-cat-card";

      const icon = document.createElement("span");
      icon.className = "jp-vocab-cat-card__icon";
      icon.textContent = cat.icon;

      const title = document.createElement("span");
      title.className = "jp-vocab-cat-card__title";
      title.textContent = t(cat.titleKey);

      const count = document.createElement("span");
      count.className = "jp-vocab-cat-card__count";
      count.textContent = `${cat.words.length} ${t("jpVocabWordsCount")}`;

      card.append(icon, title, count);

      const progress = n5ProgressCache[`vocab:${cat.id}`];
      if (progress) {
        const badge = document.createElement("span");
        badge.className = "jp-vocab-cat-card__badge";
        badge.textContent = `✓ ${progress.score}/${progress.total}`;
        card.appendChild(badge);
      }

      card.addEventListener("click", () => openN5VocabWords(cat));
      jpVocabCatGrid.appendChild(card);
    });
  }

  function openN5VocabWords(cat) {
    activeN5Category = cat;
    jpVocabWordsTitle.textContent = `${cat.icon} ${t(cat.titleKey)}`;
    jpVocabWordsList.innerHTML = "";
    cat.words.forEach((word) => {
      const card = document.createElement("div");
      card.className = "jp-vocab-card";

      const kana = document.createElement("span");
      kana.className = "jp-vocab-card__kana";
      kana.textContent = word.kana;
      card.appendChild(kana);

      if (word.kanji) {
        const kanji = document.createElement("span");
        kanji.className = "jp-vocab-card__kanji";
        kanji.textContent = word.kanji;
        card.appendChild(kanji);
      }

      const romaji = document.createElement("span");
      romaji.className = "jp-vocab-card__romaji";
      romaji.textContent = word.romaji;
      card.appendChild(romaji);

      const meaning = document.createElement("span");
      meaning.className = "jp-vocab-card__meaning";
      meaning.textContent = word.meaning[currentLanguage] || word.meaning.es;
      card.appendChild(meaning);

      jpVocabWordsList.appendChild(card);
    });
    showJpView("vocab-words");
  }

  jpVocabOpenBtn.addEventListener("click", () => showJpView("vocab"));
  jpVocabBackBtn.addEventListener("click", () => showJpView("grid"));
  jpVocabWordsBackBtn.addEventListener("click", () => showJpView("vocab"));

  // ---------------- Gramática N5 ----------------

  function renderN5GrammarList() {
    jpGrammarList.innerHTML = "";

    const progress = n5ProgressCache.grammar;
    if (progress) {
      const banner = document.createElement("div");
      banner.className = "jp-grammar-progress-banner";
      banner.textContent = `✓ ${t("jpMiniQuizScore")} ${progress.score}/${progress.total}`;
      jpGrammarList.appendChild(banner);
    }

    N5_GRAMMAR_POINTS.forEach((point) => {
      const card = document.createElement("div");
      card.className = "jp-grammar-card";

      const header = document.createElement("div");
      header.className = "jp-grammar-card__header";
      const label = document.createElement("span");
      label.className = "jp-grammar-card__label";
      label.textContent = point.label;
      const pattern = document.createElement("span");
      pattern.className = "jp-grammar-card__pattern";
      pattern.textContent = point.pattern;
      header.append(label, pattern);
      card.appendChild(header);

      const body = document.createElement("div");
      body.className = "jp-grammar-card__body";
      body.hidden = true;

      const explanation = document.createElement("p");
      explanation.className = "jp-grammar-card__explanation";
      explanation.textContent = point.explanation[currentLanguage] || point.explanation.es;
      body.appendChild(explanation);

      point.examples.forEach((ex) => {
        const exEl = document.createElement("div");
        exEl.className = "jp-grammar-card__example";
        const jpRow = document.createElement("div");
        jpRow.className = "jp-grammar-card__example-jp-row";
        const jp = document.createElement("p");
        jp.className = "jp-grammar-card__example-jp";
        jp.textContent = ex.jp;
        // Botón de audio (Web Speech API, mismo patrón que speakKana() en
        // Trazos/Gojuon) — pedido explícito de "Control de Audio" para el
        // módulo de aprendizaje. stopPropagation: el <button> vive dentro
        // del header clickeable que expande/colapsa la tarjeta completa.
        const audioBtn = document.createElement("button");
        audioBtn.type = "button";
        audioBtn.className = "jp-grammar-card__example-audio";
        audioBtn.setAttribute("aria-label", "Escuchar pronunciación");
        audioBtn.textContent = "🔊";
        audioBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          speakKana(ex.jp);
        });
        jpRow.append(jp, audioBtn);
        exEl.appendChild(jpRow);
        // Lectura en hiragana accesible para nivel básico — solo se
        // agrega si el ejemplo la trae (todos los actuales la traen,
        // ver N5_GRAMMAR_POINTS más arriba).
        if (ex.reading) {
          const reading = document.createElement("p");
          reading.className = "jp-grammar-card__example-reading";
          reading.textContent = ex.reading;
          exEl.appendChild(reading);
        }
        const romaji = document.createElement("p");
        romaji.className = "jp-grammar-card__example-romaji";
        romaji.textContent = ex.romaji;
        const translation = document.createElement("p");
        translation.className = "jp-grammar-card__example-translation";
        translation.textContent = ex.translation[currentLanguage] || ex.translation.es;
        exEl.append(romaji, translation);
        body.appendChild(exEl);
      });

      card.appendChild(body);
      card.addEventListener("click", () => {
        body.hidden = !body.hidden;
        card.classList.toggle("jp-grammar-card--open", !body.hidden);
      });
      jpGrammarList.appendChild(card);
    });
  }

  jpGrammarOpenBtn.addEventListener("click", () => showJpView("grammar"));
  jpGrammarBackBtn.addEventListener("click", () => showJpView("grid"));

  // ---------------- Yōon (きゃ/しゃ/etc.) ----------------
  // Tabla de LECTURA — no practicable con trazos reales (ver comentario
  // junto a #jp-view-yoon en index.html: fetchHanziStrokeData() solo
  // resuelve un carácter por pedido, y cada combo son 2 unicode reales).
  // YOON_ROWS ya trae los 3 pares hiragana/katakana/romaji por fila
  // (kya/kyu/kyo, etc.) — se aplanan a tarjetas individuales, una por
  // combo, mismo criterio que las palabras de Vocabulario N5.
  function renderYoonGrid() {
    jpYoonGrid.innerHTML = "";
    YOON_ROWS.forEach((row) => {
      row.hiragana.forEach((hiragana, i) => {
        const card = document.createElement("div");
        card.className = "jp-yoon-card";

        const hiraganaEl = document.createElement("span");
        hiraganaEl.className = "jp-yoon-card__hiragana";
        hiraganaEl.textContent = hiragana;

        const katakanaEl = document.createElement("span");
        katakanaEl.className = "jp-yoon-card__katakana";
        katakanaEl.textContent = row.katakana[i];

        const romajiEl = document.createElement("span");
        romajiEl.className = "jp-yoon-card__romaji";
        romajiEl.textContent = row.romajiList[i];

        card.append(hiraganaEl, katakanaEl, romajiEl);
        jpYoonGrid.appendChild(card);
      });
    });
  }

  // A diferencia de los trazos, un quiz de reconocimiento de lectura
  // (opción múltiple) no depende de ningún dato de trazo — sí es
  // practicable, y reutiliza el mismo motor genérico que Vocabulario/
  // Gramática en vez de tocar el quiz de kana/kanji existente.
  function buildYoonQuizItems() {
    const pool = YOON_ROWS.flatMap((row) => row.hiragana.map((hiragana, i) => ({ hiragana, romaji: row.romajiList[i] })));
    return shuffleArrayLocal(pool).map((entry) => {
      const distractors = shuffleArrayLocal(pool.filter((p) => p.romaji !== entry.romaji)).slice(0, 3).map((p) => p.romaji);
      return {
        char: entry.hiragana,
        prompt: t("jpYoonQuizPrompt"),
        answer: entry.romaji,
        options: shuffleArrayLocal([entry.romaji, ...distractors]),
      };
    });
  }

  jpYoonOpenBtn.addEventListener("click", () => showJpView("yoon"));
  jpYoonBackBtn.addEventListener("click", () => showJpView("grid"));
  jpYoonQuizStartBtn.addEventListener("click", () => startMiniQuiz(buildYoonQuizItems(), "yoon", "yoon"));

  // ---------------- Mini-Quiz genérico (Vocabulario / Gramática) ----------------
  // Separado del quiz de kana/kanji de arriba (#jp-view-quiz, ligado a
  // jpQueue) a propósito — esa lógica ya está afinada y no hacía falta
  // arriesgarla para reutilizarla acá. `buildMiniQuizItems()` arma una
  // lista uniforme {prompt, answer, options} sin importar si el origen
  // es vocabulario o gramática, así el resto del flujo (renderizado,
  // corrección, siguiente pregunta) es UNA sola implementación.
  let miniQuizItems = [];
  let miniQuizIndex = 0;
  let miniQuizScore = 0;
  let miniQuizReturnView = "grid";
  let miniQuizProgressId = null; // "vocab:<catId>" o "grammar" — ver saveN5Progress()

  function shuffleArrayLocal(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function resolveField(field) {
    return field[currentLanguage] || field.es;
  }

  function buildVocabQuizItems(cat) {
    const pool = cat.words;
    return shuffleArrayLocal(pool).map((word) => {
      const answer = resolveField(word.meaning);
      const distractors = shuffleArrayLocal(pool.filter((w) => w !== word)).slice(0, 3).map((w) => resolveField(w.meaning));
      return {
        char: word.kanji || word.kana,
        prompt: t("jpMiniQuizVocabPrompt"),
        answer,
        options: shuffleArrayLocal([answer, ...distractors]),
      };
    });
  }

  function buildGrammarQuizItems() {
    // Toma UNA oración de ejemplo por punto gramatical y esconde su
    // partícula/label — el resto de los labels de otros puntos actúan
    // como distractores. Solo usa puntos donde el label es corto (una
    // partícula real, no un patrón completo como "い-adj / な-adj") para
    // que el blank tenga sentido dentro de la oración.
    const particlePoints = N5_GRAMMAR_POINTS.filter((p) => p.label.length <= 2);
    return shuffleArrayLocal(particlePoints).map((point) => {
      const example = point.examples[0];
      const blanked = example.jp.replace(point.label, "＿");
      // La lectura en hiragana se blanquea con el mismo ＿, en la misma
      // posición — la partícula (は/も/を/に/で/が/の/から/しか/とき) ya es
      // hiragana en el texto real, así que el reemplazo cae exactamente
      // en el mismo lugar sin revelar la respuesta. Ver #jp-mini-quiz-reading.
      const blankedReading = example.reading ? example.reading.replace(point.label, "＿") : null;
      const distractors = shuffleArrayLocal(particlePoints.filter((p) => p !== point)).slice(0, 3).map((p) => p.label);
      return {
        char: blanked,
        charReading: blankedReading,
        prompt: t("jpMiniQuizGrammarPrompt"),
        answer: point.label,
        options: shuffleArrayLocal([point.label, ...distractors]),
      };
    });
  }

  function startMiniQuiz(items, returnView, progressId) {
    miniQuizItems = items;
    miniQuizIndex = 0;
    miniQuizScore = 0;
    miniQuizReturnView = returnView;
    miniQuizProgressId = progressId || null;
    showJpView("mini-quiz");
    renderMiniQuizItem();
  }

  function renderMiniQuizItem() {
    if (miniQuizIndex >= miniQuizItems.length) {
      jpMiniQuizPrompt.textContent = t("jpMiniQuizDone");
      jpMiniQuizChar.textContent = "🎉";
      jpMiniQuizReading.hidden = true;
      jpMiniQuizOptions.innerHTML = "";
      jpMiniQuizFeedback.hidden = true;
      jpMiniQuizScore.textContent = `${t("jpMiniQuizScore")} ${miniQuizScore}/${miniQuizItems.length}`;
      addGold(5);
      grantXP(30);
      // Progreso persistente en IndexedDB (ver bloque más arriba) — solo
      // pisa el registro guardado si este puntaje iguala o supera al mejor
      // previo. Re-renderiza vocab/gramática para que el badge "✓" quede
      // listo apenas el usuario vuelva atrás.
      if (miniQuizProgressId) {
        saveN5Progress(miniQuizProgressId, miniQuizScore, miniQuizItems.length);
        renderN5VocabCategories();
        renderN5GrammarList();
      }
      return;
    }
    const item = miniQuizItems[miniQuizIndex];
    jpMiniQuizPrompt.textContent = item.prompt;
    jpMiniQuizChar.textContent = item.char;
    jpMiniQuizReading.hidden = !item.charReading;
    jpMiniQuizReading.textContent = item.charReading || "";
    jpMiniQuizFeedback.hidden = true;
    jpMiniQuizScore.textContent = `${miniQuizIndex + 1} / ${miniQuizItems.length}`;

    jpMiniQuizOptions.innerHTML = "";
    item.options.forEach((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "jp-quiz-option-btn";
      btn.textContent = option;
      btn.addEventListener("click", () => handleMiniQuizAnswer(option, item, btn));
      jpMiniQuizOptions.appendChild(btn);
    });
  }

  function handleMiniQuizAnswer(selected, item, btn) {
    const correct = selected === item.answer;
    if (correct) miniQuizScore += 1;
    jpMiniQuizFeedback.hidden = false;
    jpMiniQuizFeedback.textContent = correct ? t("jpQuizCorrect") : `${t("jpQuizIncorrect")} ${item.answer}`;
    jpMiniQuizFeedback.className = `jp-quiz-feedback ${correct ? "jp-quiz-feedback--correct" : "jp-quiz-feedback--incorrect"}`;
    Array.from(jpMiniQuizOptions.children).forEach((b) => { b.disabled = true; });
    btn.style.borderColor = correct ? "var(--neon-green)" : "var(--neon-magenta)";
    miniQuizIndex += 1;
    setTimeout(renderMiniQuizItem, 900);
  }

  jpVocabQuizStartBtn.addEventListener("click", () => {
    if (!activeN5Category) return;
    startMiniQuiz(buildVocabQuizItems(activeN5Category), "vocab-words", `vocab:${activeN5Category.id}`);
  });
  jpGrammarQuizStartBtn.addEventListener("click", () => {
    startMiniQuiz(buildGrammarQuizItems(), "grammar", "grammar");
  });
  jpMiniQuizBackBtn.addEventListener("click", () => showJpView(miniQuizReturnView));

  // Reparte según el modo elegido en #jp-config-modal: Práctica va directo
  // a Fases + Vocabulario (sin evaluación); Examen empieza por la Prueba 1
  // (orden de trazos). Reemplaza el viejo showJpStroke() como único punto
  // de entrada a un ítem de la cola.
  function showJpItem() {
    if (jpMode === "examen") showJpExamStroke();
    else showJpPhases();
  }

  function startJpPractice(kanaList) {
    if (!kanaList.length) return;
    jpQueue = shuffleArray(kanaList);
    jpQueueIndex = 0;
    jpSessionCorrect = 0;
    showJpItem();
  }

  // Fila horizontal de cuadros — uno por TRAZO REAL (ver .jp-phase-row en
  // style.css), sin flechas: cada cuadro dibuja el carácter con datos de
  // trazo verificados (fetchHanziStrokeData(), mismo dataset del Bloque
  // 30 — Hiragana/Katakana/Kanji reales). Los trazos previos quedan
  // tenues y el trazo nuevo se resalta en azul neón con glow, todo
  // construido con <path> reales posicionados vía
  // HanziWriter.getScalingTransform() (utilidad pública de la propia
  // librería) en vez de texto/emoji. Como la carga es async, se usa un
  // token de pedido para ignorar respuestas obsoletas si el usuario
  // avanza a otro carácter antes de que termine de llegar la anterior.
  const JP_PHASE_BOX_SIZE = 84;
  let jpPhaseRequestToken = 0;

  function buildHanziPhaseSvg(strokes, phaseIndex) {
    const { transform } = HanziWriter.getScalingTransform(JP_PHASE_BOX_SIZE, JP_PHASE_BOX_SIZE, 4);
    const previous = strokes
      .slice(0, phaseIndex)
      .map((d) => `<path class="jp-phase-stroke jp-phase-stroke--previous" d="${d}"></path>`)
      .join("");
    const current = `<path class="jp-phase-stroke jp-phase-stroke--current" d="${strokes[phaseIndex]}"></path>`;
    return `<svg class="jp-phase-box__svg" viewBox="0 0 ${JP_PHASE_BOX_SIZE} ${JP_PHASE_BOX_SIZE}"><g transform="${transform}">${previous}${current}</g></svg>`;
  }

  function renderJpPhaseRow(char) {
    const requestToken = ++jpPhaseRequestToken;
    jpPhaseRow.innerHTML = "";
    jpPhaseRow.classList.remove("jp-phase-row--empty");

    fetchHanziStrokeData(char)
      .then((data) => {
        if (requestToken !== jpPhaseRequestToken) return; // el usuario ya avanzó a otro carácter
        jpPhaseRow.innerHTML = "";
        data.strokes.forEach((_, i) => {
          const box = document.createElement("div");
          box.className = "jp-phase-box";
          box.innerHTML = buildHanziPhaseSvg(data.strokes, i);

          const num = document.createElement("span");
          num.className = "jp-phase-box__num";
          num.textContent = i + 1;
          box.appendChild(num);

          jpPhaseRow.appendChild(box);
        });
      })
      .catch(() => {
        if (requestToken !== jpPhaseRequestToken) return;
        jpPhaseRow.innerHTML = "";
        jpPhaseRow.classList.add("jp-phase-row--empty");
        jpPhaseRow.textContent = t("jpPhaseRowError");
      });
  }

  // Palabras Clave: vocabulario AMPLIADO (varios ejemplos por kana, ver
  // JP_VOCAB). Si el carácter no tiene palabras curadas (kanji, を/ん, o
  // alguna fila de katakana aún sin cobertura), la sección entera queda
  // oculta en vez de mostrar una cuadrícula vacía. Con la interfaz en
  // 日本語 se oculta la traducción extranjera (pedido explícito: modo
  // "nativo/infantil" — solo Kana/Kanji/Romaji). Recibe la sección/grilla
  // destino como parámetro porque ahora se usa en 2 lugares — Fases
  // (Modo Práctica) y Prueba de Trazos (Modo Examen, pedido explícito) —
  // cada uno con sus propios elementos en el DOM (no se puede repetir un
  // mismo id dos veces).
  function renderVocabSection(char, sectionEl, gridEl) {
    const entries = JP_VOCAB[char];
    sectionEl.hidden = !entries || !entries.length;
    if (!entries || !entries.length) return;

    gridEl.innerHTML = "";
    entries.forEach((entry) => {
      const card = document.createElement("div");
      card.className = "jp-vocab-card";

      const main = document.createElement("div");
      main.className = "jp-vocab-card__main";
      const kanaEl = document.createElement("span");
      kanaEl.className = "jp-vocab-card__kana";
      kanaEl.textContent = entry.kana;
      main.appendChild(kanaEl);
      if (entry.kanji) {
        const kanjiEl = document.createElement("span");
        kanjiEl.className = "jp-vocab-card__kanji";
        kanjiEl.textContent = entry.kanji;
        main.appendChild(kanjiEl);
      }
      // Botón de pronunciación PROPIO de la palabra de ejemplo (pedido
      // explícito) — distinto del 🔊 del carácter grande de arriba, que
      // solo lee el kana/kanji suelto, no la palabra completa.
      const speakBtn = document.createElement("button");
      speakBtn.type = "button";
      speakBtn.className = "jp-vocab-card__speak";
      speakBtn.textContent = "🔊";
      speakBtn.setAttribute("aria-label", t("jpListen"));
      speakBtn.addEventListener("click", () => speakKana(entry.kana));
      main.appendChild(speakBtn);
      card.appendChild(main);

      const romajiEl = document.createElement("span");
      romajiEl.className = "jp-vocab-card__romaji";
      romajiEl.textContent = entry.romaji;
      card.appendChild(romajiEl);

      if (currentLanguage !== "ja") {
        const meaningEl = document.createElement("span");
        meaningEl.className = "jp-vocab-card__meaning";
        const meaning = entry.meaning[currentLanguage] || entry.meaning.es;
        meaningEl.textContent = `${entry.emoji} ${meaning}`;
        card.appendChild(meaningEl);
      }

      gridEl.appendChild(card);
    });
  }

  // MODO PRÁCTICA: fases + vocabulario, sin evaluación. "Siguiente" avanza
  // la cola directamente (no hay quiz de por medio en este modo).
  function showJpPhases() {
    const item = jpQueue[jpQueueIndex];
    jpPhasesChar.textContent = item.char;
    jpPhasesProgress.textContent = `${jpQueueIndex + 1} / ${jpQueue.length}`;
    renderJpPhaseRow(item.char);
    renderVocabSection(item.char, jpVocabSection, jpVocabGrid);

    const isKanji = item.script === "kanji";
    jpKanjiInfo.hidden = !isKanji;
    if (isKanji) {
      jpKanjiOnyomiEl.textContent = item.onyomi;
      jpKanjiKunyomiEl.textContent = item.kunyomi;
      jpKanjiMeaningEl.textContent = item.meaning;
    }

    showJpView("phases");
  }

  function advanceJpQueueOrFinish() {
    jpQueueIndex += 1;
    if (jpQueueIndex < jpQueue.length) {
      showJpItem();
    } else {
      finishJpSession();
    }
  }

  // MODO EXAMEN, Prueba 1: los TRAZOS REALES del carácter (mismo dataset
  // fetchHanziStrokeData() de la vista de Fases, ver arriba de
  // defaultState()) como "palitos" sueltos y desordenados — clic en cada
  // uno en el orden correcto de escritura real. Antes usaba
  // getStrokeGuide() (2-3 flechas genéricas sin relación real con el
  // carácter) — eso hacía la prueba literalmente imposible de razonar
  // (un carácter de 4 trazos reales mostraba solo 2 flechas abstractas
  // sin ninguna pista visual real, así que acertar era pura suerte, no
  // aprendizaje) — reportado como "se queda estancado". Con trazos
  // reales, cada botón muestra la FORMA real de ese trazo en su posición
  // correcta dentro del carácter, así que se puede razonar por
  // comparación visual contra el carácter grande de arriba.
  //
  // jpExamNextIndex es la posición de la cola que toca a continuación (no
  // el índice del botón); jpExamTotal es cuántos trazos tiene el
  // carácter actual. Token de pedido igual que jpPhaseRequestToken (ver
  // renderJpPhaseRow) para descartar una respuesta tardía si el usuario
  // ya avanzó a otro carácter (Omitir Trazo, Volver, etc.) antes de que
  // termine de llegar.
  let jpExamNextIndex = 0;
  let jpExamTotal = 0;
  let jpExamRequestToken = 0;

  function updateJpExamProgress() {
    jpExamstrokeProgress.textContent = `${jpExamNextIndex} / ${jpExamTotal}`;
  }

  function buildHanziSegmentSvg(strokes, index) {
    const { transform } = HanziWriter.getScalingTransform(JP_PHASE_BOX_SIZE, JP_PHASE_BOX_SIZE, 4);
    return `<svg class="jp-exam-segment-btn__svg" viewBox="0 0 ${JP_PHASE_BOX_SIZE} ${JP_PHASE_BOX_SIZE}"><g transform="${transform}"><path class="jp-phase-stroke jp-phase-stroke--current" d="${strokes[index]}"></path></g></svg>`;
  }

  function renderExamSegments(char) {
    const requestToken = ++jpExamRequestToken;
    jpExamSegments.innerHTML = "";
    jpExamstrokeProgress.textContent = "";

    fetchHanziStrokeData(char)
      .then((data) => {
        if (requestToken !== jpExamRequestToken) return; // el usuario ya avanzó a otro carácter

        jpExamTotal = data.strokes.length;
        jpExamNextIndex = 0;
        updateJpExamProgress();

        jpExamSegments.innerHTML = "";
        const order = shuffleArray(data.strokes.map((_, i) => i));
        order.forEach((strokeIndex) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "jp-exam-segment-btn";
          btn.innerHTML = buildHanziSegmentSvg(data.strokes, strokeIndex);
          btn.addEventListener("click", () => handleExamSegmentClick(btn, strokeIndex));
          jpExamSegments.appendChild(btn);
        });
      })
      .catch(() => {
        if (requestToken !== jpExamRequestToken) return;
        jpExamSegments.innerHTML = "";
        jpExamSegments.textContent = t("jpPhaseRowError");
      });
  }

  function handleExamSegmentClick(btn, index) {
    if (btn.disabled) return;

    if (index === jpExamNextIndex) {
      btn.disabled = true;
      btn.classList.add("jp-exam-segment-btn--correct");
      jpExamNextIndex += 1;
      updateJpExamProgress();
      if (jpExamNextIndex >= jpExamTotal) {
        // Completó la Prueba 1: avanza automáticamente a la Prueba 2
        // (opción múltiple, showJpQuiz ya existente) — pedido explícito.
        setTimeout(showJpQuiz, 500);
      }
    } else {
      // Sin penalidad ni bloqueo: solo el parpadeo rojo (pedido explícito),
      // se puede reintentar de inmediato.
      btn.classList.remove("jp-exam-segment-btn--wrong");
      void btn.offsetWidth;
      btn.classList.add("jp-exam-segment-btn--wrong");
    }
  }

  function showJpExamStroke() {
    const item = jpQueue[jpQueueIndex];
    jpExamstrokeChar.textContent = item.char;
    renderExamSegments(item.char);
    renderVocabSection(item.char, jpExamVocabSection, jpExamVocabGrid);
    showJpView("examstroke");
  }

  function showJpQuiz() {
    const item = jpQueue[jpQueueIndex];
    jpQuizChar.textContent = item.char;
    jpQuizPromptEl.textContent = t(item.script === "kanji" ? "jpQuizPromptMeaning" : "jpQuizPrompt");
    jpQuizFeedback.hidden = true;
    jpQuizFeedback.className = "jp-quiz-feedback";

    const pool = getKanaList(item.script).filter((k) => k.answer !== item.answer);
    const distractors = shuffleArray(pool).slice(0, 3).map((k) => k.answer);
    const options = shuffleArray([item.answer, ...distractors]);

    jpQuizOptions.innerHTML = "";
    options.forEach((answer) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "jp-quiz-option-btn";
      btn.textContent = answer;
      btn.addEventListener("click", () => handleJpAnswer(answer, item));
      jpQuizOptions.appendChild(btn);
    });

    showJpView("quiz");
    // "Al cargar la pregunta" (pedido explícito): reproduce la
    // pronunciación automáticamente además de dejar el botón 🔊 para
    // volver a escucharla.
    speakKana(item.char);
  }

  function handleJpAnswer(selected, item) {
    const correct = selected === item.answer;
    const key = `${item.script}:${item.char}`;

    Array.from(jpQuizOptions.children).forEach((btn) => {
      btn.disabled = true;
      if (btn.textContent === item.answer) btn.classList.add("jp-quiz-option-btn--correct");
      else if (btn.textContent === selected) btn.classList.add("jp-quiz-option-btn--wrong");
    });

    if (correct) {
      jpSessionCorrect += 1;
      state.pillars.aprendizaje.mastery[key] = Math.min(JP_MASTERY_THRESHOLD, (state.pillars.aprendizaje.mastery[key] || 0) + 1);
    }
    persist();

    jpQuizFeedback.hidden = false;
    jpQuizFeedback.textContent = correct ? t("jpQuizCorrect") : `${t("jpQuizIncorrect")} "${item.answer}"`;
    jpQuizFeedback.classList.add(correct ? "jp-quiz-feedback--correct" : "jp-quiz-feedback--incorrect");

    setTimeout(advanceJpQueueOrFinish, 1200);
  }

  // El mensaje de cierre depende del modo: Examen sí tuvo evaluación
  // (aciertos/total tiene sentido); Práctica fue solo estudio libre, sin
  // puntaje que mostrar.
  function finishJpSession() {
    const total = jpQueue.length;
    addGold(2);
    grantXP(15);
    const text = jpMode === "examen"
      ? `${t("jpSessionComplete")} ${jpSessionCorrect}/${total}. +15 XP, +2 🪙`
      : `${t("jpPracticeSessionComplete")} +15 XP, +2 🪙`;
    addMessage({ author: "SISTEMA", text, variant: "system" });
    showJpView("grid");
  }

  jpScriptToggle.addEventListener("click", (event) => {
    const btn = event.target.closest(".jp-script-btn");
    if (!btn || btn.dataset.script === jpScript) return;
    jpScript = btn.dataset.script;
    document.querySelectorAll(".jp-script-btn").forEach((b) => {
      b.classList.toggle("jp-script-btn--active", b === btn);
    });
    renderGojuonGrid();
  });

  jpGeneralPracticeBtn.addEventListener("click", () => {
    startJpPractice(getKanaList(jpScript));
  });

  jpRowsEl.addEventListener("click", (event) => {
    const target = event.target.closest("[data-row-practice], .jp-kana-btn");
    if (!target) return;
    const rowId = target.dataset.rowPractice || target.dataset.rowId;
    startJpPractice(getKanaList(jpScript).filter((k) => k.rowId === rowId));
  });

  jpPhasesNextBtn.addEventListener("click", advanceJpQueueOrFinish);
  jpPhasesBackBtn.addEventListener("click", () => showJpView("grid"));
  jpPhasesSpeakBtn.addEventListener("click", () => speakKana(jpQueue[jpQueueIndex].char));

  jpExamstrokeSkipBtn.addEventListener("click", showJpQuiz);
  jpExamstrokeBackBtn.addEventListener("click", () => showJpView("grid"));

  jpQuizBackBtn.addEventListener("click", () => showJpView("grid"));
  jpQuizSpeakBtn.addEventListener("click", () => speakKana(jpQueue[jpQueueIndex].char));

  // ---------------- Configuración de Idiomas: pantalla inicial del módulo Japonés ----------------
  // El idioma de interfaz reutiliza applyLanguage() — el MISMO sistema
  // global ES/EN/JA del selector del header — para no duplicar
  // infraestructura de i18n; seleccionarlo acá cambia toda la app, no
  // solo este módulo. El modo (Práctica/Examen) sí es exclusivo de este
  // módulo (jpMode). Elegir un modo cierra esta pantalla y abre
  // directamente la cuadrícula del módulo Japonés.
  function syncJpConfigActiveStates() {
    jpConfigLanguageRow.querySelectorAll(".jp-config-lang-btn").forEach((btn) => {
      btn.classList.toggle("jp-config-lang-btn--active", btn.dataset.lang === currentLanguage);
    });
    jpConfigModeRow.querySelectorAll(".jp-config-mode-btn").forEach((btn) => {
      btn.classList.toggle("jp-config-mode-btn--active", btn.dataset.mode === jpMode);
    });
  }

  function updateJpModeBadge() {
    jpModeBadge.textContent = t(jpMode === "examen" ? "jpModeExamen" : "jpModePractica");
  }

  function openJpConfigModal() {
    syncJpConfigActiveStates();
    jpConfigModal.hidden = false;
  }

  function closeJpConfigModal() {
    jpConfigModal.hidden = true;
  }

  jpConfigLanguageRow.addEventListener("click", (event) => {
    const btn = event.target.closest(".jp-config-lang-btn");
    if (!btn) return;
    applyLanguage(btn.dataset.lang);
    syncJpConfigActiveStates();
  });

  jpConfigModeRow.addEventListener("click", (event) => {
    const btn = event.target.closest(".jp-config-mode-btn");
    if (!btn) return;
    jpMode = btn.dataset.mode;
    updateJpModeBadge();
    closeJpConfigModal();
    selectApp("japanese");
  });

  jpConfigModalClose.addEventListener("click", closeJpConfigModal);
  jpConfigModal.addEventListener("click", (event) => {
    if (event.target === jpConfigModal) closeJpConfigModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !jpConfigModal.hidden) closeJpConfigModal();
  });

  // Vuelve a la pantalla de configuración sin cerrar del todo el módulo
  // (pedido explícito: "regresar o cambiar de idioma en cualquier
  // momento") — reutiliza closeAllAppModals() (cancela la síntesis de voz
  // en curso, igual que cualquier otro cierre del módulo) y abre
  // jp-config-modal encima del mismo fondo, en vez de apilar overlays.
  jpConfigReopenBtn.addEventListener("click", () => {
    closeAllAppModals();
    openJpConfigModal();
  });

  // ---------------- Módulo: Práctica de Trazos Reales (Hanzi Writer) ----------------
  // Separado del módulo Japonés de arriba (cuadrícula Gojuon + Fases/
  // Prueba de Trazos + quiz de opción múltiple) aunque ambos ya comparten
  // el mismo dataset de trazos reales (fetchHanziStrokeData(), ver arriba
  // de defaultState()) — este módulo usa la librería Hanzi Writer
  // interactiva completa (dibujar con el mouse/dedo, detección en vivo),
  // mientras el módulo Japonés solo dibuja SVGs estáticos con esos mismos
  // datos. Hanzi Writer se carga por CDN en el <head> de
  // index.html) con datos de trazos REALES basados en KanjiVG — único
  // punto de todo el proyecto que depende de una librería externa, tal
  // como se pidió explícitamente. Se abre desde [✍️ Trazos Reales] dentro
  // del modal Japonés, en su propia ventana superpuesta (mismo patrón de
  // modal anidado que #payroll-audit-modal / #category-breakdown-modal).
  //
  // Repertorio de caracteres: reutiliza GOJUON_ROWS (katakana) y
  // KANJI_N5 (ya definidos arriba para el módulo Japonés) en vez de
  // duplicar una lista nueva de caracteres.
  //
  // DATASET DE TRAZOS: el dataset POR DEFECTO de Hanzi Writer
  // (hanzi-writer-data, derivado de Make Me a Hanzi) solo cubre Kanji —
  // "Hanzi" es escritura Han, y Kana nunca perteneció a ella (esto se
  // documentó como limitación real en un bloque anterior). Se encontró un
  // dataset alternativo real, publicado específicamente para este uso:
  // @k1low/hanzi-writer-data-jp (usado también por la librería japonesa
  // "kakitori"), con el MISMO formato {strokes, medians} que Hanzi Writer
  // espera nativamente, verificado con cobertura completa de Hiragana,
  // Katakana Y Kanji (incluyendo を/ん/ン). Se usa como `charDataLoader`
  // personalizado en vez del loader por defecto, vía fetchHanziStrokeData()
  // (helper compartido con la vista de Fases del módulo Japonés, ver
  // arriba de defaultState()).
  const HANZI_WRITER_HIRAGANA = GOJUON_ROWS.flatMap((row) => row.hiragana);
  const HANZI_WRITER_KATAKANA = GOJUON_ROWS.flatMap((row) => row.katakana);

  function hanziCharDataLoader(char, onComplete) {
    fetchHanziStrokeData(char)
      .then(onComplete)
      .catch(() => setHanziFeedback(t("hanziCharDataUnavailable"), "wrong"));
  }

  let hanziWriter = null;
  let hanziActiveChar = null;

  // Hanzi Writer 3.5 no expone un destroy() público — se limpia el DOM
  // del target a mano para no acumular un <svg> viejo por cada carácter
  // abierto durante la sesión.
  function destroyHanziWriter() {
    hanziWriterTarget.innerHTML = "";
    hanziWriter = null;
  }

  function renderHanziCharGrid(container, chars) {
    container.innerHTML = "";
    chars.forEach((char) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hanzi-char-btn";
      btn.textContent = char;
      btn.addEventListener("click", () => openHanziPractice(char));
      container.appendChild(btn);
    });
  }

  function renderHanziWriterGrids() {
    renderHanziCharGrid(hanziHiraganaGrid, HANZI_WRITER_HIRAGANA);
    renderHanziCharGrid(hanziKatakanaGrid, HANZI_WRITER_KATAKANA);
    renderHanziCharGrid(hanziKanjiGrid, KANJI_N5.map((k) => k.char));
  }

  function setHanziFeedback(text, variant) {
    hanziQuizFeedback.textContent = text;
    hanziQuizFeedback.className = `hanzi-quiz-feedback${variant ? ` hanzi-quiz-feedback--${variant}` : ""}`;
  }

  // Retira y vuelve a aplicar la clase de flash para poder re-disparar la
  // animación CSS aunque el trazo anterior haya sido del mismo tipo
  // (correcto tras correcto, o error tras error) — sin el reflow forzado
  // (offsetWidth), la segunda vez no se vería ningún flash.
  function flashHanziCanvas(variant) {
    const cls = variant === "correct" ? "hanzi-canvas-stage--correct" : "hanzi-canvas-stage--wrong";
    hanziCanvasStage.classList.remove("hanzi-canvas-stage--correct", "hanzi-canvas-stage--wrong");
    void hanziCanvasStage.offsetWidth;
    hanziCanvasStage.classList.add(cls);
  }

  function openHanziPractice(char) {
    hanziActiveChar = char;
    destroyHanziWriter();
    setHanziFeedback("", null);
    hanziViewGrid.hidden = true;
    hanziViewPractice.hidden = false;

    // HanziWriter (librería) se carga desde CDN vía <script> en index.html
    // — cross-origin, así que el Service Worker NUNCA la cachea (ver
    // isStaticAsset() en sw.js). En una visita offline repetida ese
    // <script> falla en cargar y el global queda undefined: sin este
    // guard, HanziWriter.create() de abajo tira un TypeError sin capturar
    // y rompe la vista entera. Con el guard, se queda en la vista de
    // práctica pero con el mismo mensaje honesto que ya se usa para un
    // carácter puntual sin datos (onLoadCharDataError, ver abajo) — mismo
    // criterio "mejor esfuerzo" que Supabase/Three.js en el resto de la
    // app, en vez de un error sin manejar en consola.
    if (typeof HanziWriter === "undefined") {
      setHanziFeedback(t("hanziCharDataUnavailable"), "wrong");
      return;
    }

    // Colores del trazo pasados una sola vez a la creación del widget
    // (Hanzi Writer los pinta directo en su propio <svg>, no son
    // controlables por CSS después) — en Mobile Lite (≤767px, ver
    // style.css) se usa tinta oscura sobre el lienzo claro en vez del
    // cian/magenta neón pensado para el tema oscuro de escritorio.
    const isMobileLite = window.matchMedia("(max-width: 767px)").matches;
    hanziWriter = HanziWriter.create(hanziWriterTarget, char, {
      width: 200,
      height: 200,
      padding: 5,
      showOutline: true,
      strokeColor: isMobileLite ? "#12161F" : "#00F0FF",
      radicalColor: isMobileLite ? "#A32B67" : "#FF2E9A",
      outlineColor: isMobileLite ? "rgba(18, 22, 31, 0.2)" : "rgba(230, 247, 255, 0.25)",
      drawingWidth: 26,
      // charDataLoader personalizado (Hiragana + Katakana + Kanji reales,
      // ver HANZI_WRITER_DATA_BASE_URL) en vez del loader por defecto de
      // Hanzi Writer, que solo cubre Kanji.
      charDataLoader: hanziCharDataLoader,
      // Red caída / carácter puntual sin datos (caso raro, no sistemático
      // como antes) — mismo mensaje honesto en vez de un lienzo roto.
      onLoadCharDataError: () => setHanziFeedback(t("hanziCharDataUnavailable"), "wrong"),
    });
  }

  // hanziWriter.animateCharacter()/quiz() lanzan una excepción síncrona si
  // se llaman antes de que los datos terminen de cargar o después de que
  // la carga falló (ver prueba de onLoadCharDataError arriba) — se
  // envuelven ambas para mostrar el mismo mensaje honesto en vez de un
  // error sin manejar en consola.
  function startHanziQuiz() {
    if (!hanziWriter) return;
    setHanziFeedback(t("hanziQuizHint"), null);
    try {
      hanziWriter.quiz({
        onCorrectStroke: () => {
          flashHanziCanvas("correct");
          setHanziFeedback(t("hanziQuizCorrectStroke"), "correct");
        },
        onMistake: () => {
          flashHanziCanvas("wrong");
          setHanziFeedback(t("hanziQuizMistake"), "wrong");
        },
        onComplete: () => {
          setHanziFeedback(t("hanziQuizComplete"), "complete");
          addGold(3);
          grantXP(10);
        },
      });
    } catch {
      setHanziFeedback(t("hanziCharDataUnavailable"), "wrong");
    }
  }

  // Reinicia recreando el writer desde cero (mismo carácter): vuelve a
  // mostrar el contorno guía sin animación ni quiz en curso, en vez de
  // intentar cancelar a mano un quiz o una animación que podrían estar a
  // mitad de camino.
  function resetHanziPractice() {
    if (hanziActiveChar) openHanziPractice(hanziActiveChar);
  }

  function closeHanziWriterModal() {
    hanziWriterModal.hidden = true;
    destroyHanziWriter();
    hanziActiveChar = null;
    hanziViewPractice.hidden = true;
    hanziViewGrid.hidden = false;
  }

  hanziWriterOpenBtn.addEventListener("click", () => {
    renderHanziWriterGrids();
    hanziWriterModal.hidden = false;
  });
  hanziWriterModalClose.addEventListener("click", closeHanziWriterModal);
  hanziWriterModal.addEventListener("click", (event) => {
    if (event.target === hanziWriterModal) closeHanziWriterModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !hanziWriterModal.hidden) closeHanziWriterModal();
  });

  hanziPracticeBackBtn.addEventListener("click", () => {
    destroyHanziWriter();
    hanziActiveChar = null;
    hanziViewPractice.hidden = true;
    hanziViewGrid.hidden = false;
  });

  hanziAnimateBtn.addEventListener("click", () => {
    if (!hanziWriter) return;
    try {
      hanziWriter.animateCharacter();
    } catch {
      setHanziFeedback(t("hanziCharDataUnavailable"), "wrong");
    }
  });
  hanziQuizBtn.addEventListener("click", startHanziQuiz);
  hanziResetBtn.addEventListener("click", resetHanziPractice);

  // ---------------- Perfiles de Usuario (cuentas del dispositivo) ----------------
  // Distinto del bloque de abajo: esto decide QUÉ perfil está activo
  // (cuenta separada, ver activeProfileId/scopedKey() arriba del todo del
  // archivo); "Crear cuenta"/operatorName es el nombre del operador
  // DENTRO de un perfil ya elegido.

  function renderActiveProfileName() {
    const profiles = loadUserProfiles();
    const current = profiles.find((p) => p.id === activeProfileId);
    activeProfileNameEl.textContent = current ? current.name : "Admin";
  }

  function renderProfileList() {
    const profiles = loadUserProfiles();
    profileListEl.innerHTML = "";

    profiles.forEach((profile) => {
      const isActive = profile.id === activeProfileId;
      const row = document.createElement("div");
      row.className = `profile-row${isActive ? " profile-row--active" : ""}`;

      const name = document.createElement("span");
      name.className = "profile-row__name";
      name.textContent = profile.name;
      row.appendChild(name);

      if (isActive) {
        const badge = document.createElement("span");
        badge.className = "profile-row__badge";
        badge.textContent = t("profileActiveBadge");
        row.appendChild(badge);
      } else {
        const switchBtn = document.createElement("button");
        switchBtn.type = "button";
        switchBtn.className = "profile-row__switch-btn";
        switchBtn.textContent = t("profileSwitchTo");
        switchBtn.addEventListener("click", () => switchProfile(profile.id));
        row.appendChild(switchBtn);
      }

      profileListEl.appendChild(row);
    });
  }

  function openProfileModal() {
    renderProfileList();
    profileModal.hidden = false;
  }

  function closeProfileModal() {
    profileModal.hidden = true;
  }

  profileSwitchBtn.addEventListener("click", openProfileModal);
  profileModalClose.addEventListener("click", closeProfileModal);
  profileModal.addEventListener("click", (event) => {
    if (event.target === profileModal) closeProfileModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !profileModal.hidden) closeProfileModal();
  });

  profileCreateForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = profileCreateInput.value.trim();
    if (!name) return;

    const profiles = loadUserProfiles();
    const newProfile = {
      id: `profile-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
    };
    profiles.push(newProfile);
    persistUserProfiles(profiles);

    // Crear un perfil nuevo cambia a él de inmediato (mismo patrón que
    // switchProfile(): recarga la página ya con activeProfileId apuntando
    // al perfil recién creado, con su propio state fresco).
    switchProfile(newProfile.id);
  });

  // ---------------- Perfil / Sesión: Crear cuenta / Iniciar sesión ----------------

  function renderProfile() {
    profileName.textContent = state.operatorName || "Operador";
  }

  function showWelcomeView(view) {
    welcomeViewChoice.hidden = view !== "choice";
    welcomeViewCreate.hidden = view !== "create";
    welcomeViewLogin.hidden = view !== "login";
  }

  function openWelcomeModal() {
    showWelcomeView("choice");
    welcomeModal.hidden = false;
  }

  function closeWelcomeModal() {
    welcomeModal.hidden = true;
  }

  welcomeCreateBtn.addEventListener("click", () => showWelcomeView("create"));
  welcomeLoginBtn.addEventListener("click", () => showWelcomeView("login"));
  welcomeBackFromCreate.addEventListener("click", () => showWelcomeView("choice"));
  welcomeBackFromLogin.addEventListener("click", () => showWelcomeView("choice"));
  welcomeLoginCreateBtn.addEventListener("click", () => showWelcomeView("create"));

  registrationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = operatorNameInput.value.trim();
    if (!name) return;

    // Crear cuenta arranca siempre en un state fresco: Nivel 1, XP 0/100,
    // Rango Kodomo, Diamantes 0 — sin arrastrar progreso previo sin dueño.
    state = defaultState();
    state.operatorName = name;
    persist();

    renderHud();
    renderWishlist();
    renderChatHistory();
    renderProfile();
    financeIngresoInput.value = state.pillars.finanzas.ingresoMensual || "";
    renderFinanzasCategories();
    updateFinanzasSummary();
    refreshNegocioSuggestions();
    refreshNegocioColaboradorSuggestions();
    updateNegocioGananciaPreview();

    closeWelcomeModal();
    playAvatarEmote("welcome", 3500);
    setAvatarSpeech(`¡Bienvenido, ${name}! Soy Miikaeru, tu guía.`);

    addMessage({
      author: "SISTEMA",
      text: `Cuenta creada. Bienvenido al núcleo Miikaeru, ${name}.`,
      variant: "system",
    });

    // Elección de Avatar Inicial (Fesha/Mijashi) — pedido explícito de que
    // viva "en la pantalla de inicio": se dispara acá, apenas se crea la
    // cuenta del Operador, antes de que toque nada más de la app.
    openCharacterSelectModal();
  });

  // 🔴 ahora cierra la sesión de la Cuenta Principal (candado de arriba),
  // no borra el progreso del perfil/operador — ese ya no es su trabajo
  // ahora que existe un logout "de verdad". Recargar con la sesión
  // maestra limpia hace que checkMasterAuthAndInit() muestre el candado
  // de nuevo y pida la contraseña.
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(MASTER_LOGGED_IN_KEY);
    location.reload();
  });

  // ---------------- Candado principal: registro / inicio de sesión ----------------

  function showMasterAuthView(view) {
    masterAuthViewLogin.hidden = view !== "login";
    masterAuthViewRegister.hidden = view !== "register";
  }

  function loadMasterAccount() {
    try {
      return JSON.parse(localStorage.getItem(MASTER_ACCOUNT_KEY));
    } catch (err) {
      return null;
    }
  }

  // Se ejecuta una sola vez, justo después de pasar el candado (recién
  // logueado o ya con sesión activa desde una recarga anterior) — es
  // exactamente la lógica de "bienvenida al operador" que antes corría
  // sin condición ninguna al cargar la página.
  function onMasterAuthSuccess() {
    if (!state.operatorName) {
      openWelcomeModal();
      setAvatarSpeech("Bienvenido, Operador. Crea tu cuenta para comenzar.");
    } else {
      playAvatarEmote("welcome", 3500);
      setAvatarSpeech(`¡Bienvenido de vuelta, ${state.operatorName}!`);
      // Perfiles creados antes de este Bloque no tienen playerCharacter
      // guardado — se les pide elegir recién ahora, una sola vez.
      if (!state.playerCharacter) openCharacterSelectModal();
    }
  }

  masterRegisterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    masterRegisterError.hidden = true;

    const phone = masterRegisterPhone.value.trim();
    const password = masterRegisterPassword.value;
    const confirmPassword = masterRegisterPasswordConfirm.value;

    // Este sistema es de UNA sola cuenta por dispositivo (ver MASTER_ACCOUNT_KEY
    // más arriba): si ya existe una cuenta guardada, un submit de registro
    // NUNCA debe sobreescribirla en silencio (eso era el bug reportado: un
    // número viejo dejaba de reconocerse porque el registro pisaba la cuenta).
    // En vez de eso, se avisa y se manda directo a la vista de login.
    if (loadMasterAccount()) {
      showMasterAuthView("login");
      masterLoginPhone.value = phone;
      masterLoginError.textContent = t("masterAuthAccountExists");
      masterLoginError.hidden = false;
      return;
    }

    if (password !== confirmPassword) {
      masterRegisterError.textContent = t("masterAuthPasswordMismatch");
      masterRegisterError.hidden = false;
      return;
    }

    localStorage.setItem(MASTER_ACCOUNT_KEY, JSON.stringify({ phone, password }));
    localStorage.setItem(MASTER_LOGGED_IN_KEY, "true");
    masterAuthModal.hidden = true;
    onMasterAuthSuccess();
  });

  masterAuthGoRegisterBtn.addEventListener("click", () => {
    masterLoginError.hidden = true;
    showMasterAuthView("register");
  });

  masterAuthGoLoginBtn.addEventListener("click", () => {
    masterRegisterError.hidden = true;
    showMasterAuthView("login");
  });

  masterLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    masterLoginError.hidden = true;

    const phone = masterLoginPhone.value.trim();
    const password = masterLoginPassword.value;
    const account = loadMasterAccount();

    if (!account || account.phone !== phone || account.password !== password) {
      masterLoginError.textContent = t("masterAuthInvalidCredentials");
      masterLoginError.hidden = false;
      return;
    }

    localStorage.setItem(MASTER_LOGGED_IN_KEY, "true");
    masterAuthModal.hidden = true;
    onMasterAuthSuccess();
  });

  function checkMasterAuthAndInit() {
    if (localStorage.getItem(MASTER_LOGGED_IN_KEY) === "true") {
      masterAuthModal.hidden = true;
      onMasterAuthSuccess();
      return;
    }
    masterAuthModal.hidden = false;
    showMasterAuthView(loadMasterAccount() ? "login" : "register");
  }

  // Racha de actividad: se recalcula UNA vez por carga de página,
  // comparando la fecha de hoy contra la última sesión registrada.
  // +1 día exacto = racha continúa; mismo día = no se toca (ya se sumó
  // hoy); cualquier otro salto (o primera vez) = arranca de nuevo en 1.
  function updateActivityStreak() {
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastActiveDate === today) return;

    if (state.lastActiveDate) {
      const prev = new Date(state.lastActiveDate);
      const diffDays = Math.round((new Date(today) - prev) / 86400000);
      state.streak = diffDays === 1 ? state.streak + 1 : 1;
    } else {
      state.streak = 1;
    }
    state.lastActiveDate = today;
    persist();
  }

  // ---------------- Render inicial ----------------

  updateActivityStreak();
  pickRandomHudBanner();
  startAvatarIdleCarousel();
  checkAdminSession();
  renderChatHistory();
  renderHud();
  renderWishlist();
  renderProfile();
  renderActiveProfileName();
  financeIngresoInput.value = state.pillars.finanzas.ingresoMensual || "";
  renderFinanzasCategories();
  updateFinanzasSummary();
  renderFinanzasGlobalSummary();
  refreshNegocioSuggestions();
  updateNegocioGananciaPreview();
  applyLanguage(currentLanguage);
  // Solo resalta la tarjeta del último módulo activo — no reabre su
  // modal automáticamente (sería una ventana emergente no solicitada
  // apenas carga la página).
  syncActiveAppCard(activeApp);

  // El resto de la app ya está renderizado detrás del candado (no hay
  // datos sensibles reales que proteger — todo vive en el mismo
  // localStorage del navegador), pero la bienvenida del operador
  // (welcome-modal) solo debe dispararse DESPUÉS de pasar el candado
  // principal, no antes.
  checkMasterAuthAndInit();
});
