// Dashboard Central de Métricas — Capa 2 del Ecosistema Miikaeru.
// JS propio, sin relación con app.js de la app principal (pedido
// explícito del usuario: "esta es una app diferente"). Reusa las mismas
// Serverless Functions (/api/admin-verify, /api/admin-metrics) y el
// mismo proyecto de Supabase Auth que ya usa el Panel de Administrador
// de la app principal — mismas credenciales públicas (SUPABASE_URL/
// ANON_KEY, no son secretas, ver comentario de _utils.js), mismo
// mecanismo de login (email+contraseña de Supabase Auth), mismo
// servidor de verificación (resolveAdminSession() en api/_utils.js).

(function () {
  "use strict";

  const SUPABASE_URL = "https://pzurvgcurifdkhbfxhrv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_NApj9xOyicARat8ummK52Q_mY20RsBz";

  const supabaseClient =
    typeof window !== "undefined" && window.supabase && window.supabase.createClient
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        })
      : null;

  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  const loginForm = document.getElementById("login-form");
  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");
  const loginError = document.getElementById("login-error");
  const adminEmailEl = document.getElementById("admin-email");
  const refreshBtn = document.getElementById("refresh-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const greetingText = document.getElementById("greeting-text");
  const statOperators = document.getElementById("stat-operators");
  const statRelationships = document.getElementById("stat-relationships");
  const statDonations = document.getElementById("stat-donations");
  const donationsHint = document.getElementById("donations-hint");
  const ring = document.getElementById("growth-ring");
  const ringCount = document.getElementById("ring-count");
  const heroStage = document.getElementById("hero-stage");
  const heroNext = document.getElementById("hero-next");
  const milestonesList = document.getElementById("milestones-list");
  const statusLine = document.getElementById("status-line");

  // Los mismos 7 hitos del Plan Estratégico (Sección 3 — "Metas de
  // Crecimiento de Usuarios"), tal cual, sin traducción todavía (esta
  // app nueva no tiene selector de idioma como la principal — se agrega
  // el día que haga falta, no antes).
  const GROWTH_MILESTONES = [
    { threshold: 0, label: "Lanzamiento Oficial", note: "Despliegue de variables de entorno y validación inicial de la PWA." },
    { threshold: 100, label: "100 usuarios", note: "Estabilidad de la base de datos local-first y soporte cercano." },
    { threshold: 1000, label: "1.000 usuarios", note: "Control de costos de llamadas a IA (Claude Haiku) y volumen de transacciones financieras." },
    { threshold: 5000, label: "5.000 usuarios", note: "Optimización de consultas SQL en Supabase para el ranking social y comunidades." },
    { threshold: 20000, label: "20.000 usuarios", note: "Preparación estructural para lanzar el Paso de Miika (suscripciones/niveles premium)." },
    { threshold: 100000, label: "100.000 usuarios", note: "Escalado masivo, automatización de flujos y soporte multi-idioma consolidado." },
    { threshold: 1000000, label: "1.000.000 de usuarios", note: "Consolidación como la plataforma de referencia de productividad gamificada." },
  ];

  function setStatus(text) {
    statusLine.textContent = text;
  }

  function showLogin() {
    dashboardView.hidden = true;
    loginView.hidden = false;
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
  }

  // Misma fuente de verdad que el Panel de Administrador de la app
  // principal (ver verifyAdminViaApi() en app.js): nunca decide "es
  // Admin" comparando el email a mano en el cliente, siempre confirma
  // contra /api/admin-verify (que reusa resolveAdminSession() en
  // api/_utils.js — Admin Raíz o presente en public.admins).
  async function verifyAdminViaApi(token) {
    if (!token) return false;
    try {
      const res = await fetch("/api/admin-verify", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      return !!(data && data.ok && data.isAdmin);
    } catch (err) {
      console.warn("No se pudo verificar el rol de Admin:", err.message);
      return false;
    }
  }

  function renderGrowthMilestones(count) {
    const n = Number.isFinite(count) ? count : 0;
    let currentIndex = 0;
    for (let i = 0; i < GROWTH_MILESTONES.length; i++) {
      if (n >= GROWTH_MILESTONES[i].threshold) currentIndex = i;
    }
    const current = GROWTH_MILESTONES[currentIndex];
    const next = GROWTH_MILESTONES[currentIndex + 1];
    const pct = next
      ? Math.max(0, Math.min(100, Math.round(((n - current.threshold) / (next.threshold - current.threshold)) * 100)))
      : 100;

    ring.style.setProperty("--pct", String(pct));
    ringCount.textContent = n.toLocaleString("es-PE");
    heroStage.textContent = current.label;
    heroNext.textContent = next
      ? `Próximo: ${next.label} (faltan ${Math.max(0, next.threshold - n).toLocaleString("es-PE")})`
      : "🏆 Etapa máxima alcanzada";

    milestonesList.innerHTML = "";
    GROWTH_MILESTONES.forEach((milestone, i) => {
      const state = i < currentIndex ? "reached" : i === currentIndex ? "current" : "upcoming";
      const row = document.createElement("div");
      row.className = `milestone milestone--${state}`;
      const marker = document.createElement("span");
      marker.className = "milestone__marker";
      marker.textContent = state === "reached" ? "✓" : state === "current" ? "●" : "";
      const body = document.createElement("div");
      body.className = "milestone__body";
      const label = document.createElement("div");
      label.className = "milestone__label";
      label.textContent = milestone.label;
      const note = document.createElement("div");
      note.className = "milestone__note";
      note.textContent = milestone.note;
      body.appendChild(label);
      body.appendChild(note);
      row.appendChild(marker);
      row.appendChild(body);
      milestonesList.appendChild(row);
    });
  }

  // Operadores/Relaciones vienen de /api/admin-metrics (mismo endpoint
  // que ya usa la app principal — ver api/admin-metrics.js). Donaciones
  // NO tiene endpoint/tabla todavía en el proyecto (confirmado
  // revisando el código: no existe ninguna tabla ni feature de
  // donaciones) — se muestra en 0 con una nota honesta en vez de
  // inventar un número.
  async function loadMetrics() {
    setStatus("Cargando métricas…");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData && sessionData.session && sessionData.session.access_token;
    if (!token) {
      setStatus("Sesión vencida — volvé a iniciar sesión.");
      showLogin();
      return;
    }

    try {
      const res = await fetch("/api/admin-metrics", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.ok) {
        setStatus(`No se pudieron cargar las métricas (${data.error || "error desconocido"}).`);
        renderGrowthMilestones(0);
        return;
      }
      const metrics = data.metrics || {};
      statOperators.textContent = metrics.total_operators ?? 0;
      statRelationships.textContent = metrics.total_relationships ?? 0;
      renderGrowthMilestones(Number(metrics.total_operators) || 0);
      setStatus(`Actualizado — ${new Date().toLocaleTimeString("es-PE")}`);
    } catch (err) {
      setStatus("Error de red al cargar las métricas.");
      renderGrowthMilestones(0);
    }
  }

  async function onAuthenticated(email) {
    adminEmailEl.textContent = email || "";
    greetingText.textContent = `Hola, ${(email || "Admin").split("@")[0]}`;
    showDashboard();
    await loadMetrics();
  }

  async function checkSession() {
    if (!supabaseClient) {
      setStatus("No se pudo inicializar Supabase.");
      return;
    }
    const { data } = await supabaseClient.auth.getSession();
    const email = data && data.session && data.session.user && data.session.user.email;
    const token = data && data.session && data.session.access_token;
    const isAdmin = await verifyAdminViaApi(token);
    if (isAdmin) {
      await onAuthenticated(email);
    } else {
      showLogin();
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.hidden = true;

    if (!supabaseClient) {
      loginError.textContent = "No se pudo conectar con Supabase.";
      loginError.hidden = false;
      return;
    }

    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      loginError.textContent = "Credenciales incorrectas.";
      loginError.hidden = false;
      return;
    }

    const token = data && data.session && data.session.access_token;
    const isAdmin = await verifyAdminViaApi(token);
    if (!isAdmin) {
      await supabaseClient.auth.signOut();
      loginError.textContent = "Esta cuenta no tiene permisos de Administrador.";
      loginError.hidden = false;
      return;
    }

    await onAuthenticated(data.user && data.user.email);
  });

  logoutBtn.addEventListener("click", async () => {
    if (supabaseClient) await supabaseClient.auth.signOut();
    showLogin();
  });

  refreshBtn.addEventListener("click", loadMetrics);

  checkSession();
})();
