import { assertSupabaseConfig } from "./app-config.js?v=i2";
import { isUuid, translateDataError } from "./errors.js?v=i2";
import {
  LEGACY_SIGNATURE_COLUMNS,
  SIGNATURE_BUCKETS,
  SIGNATURE_COLUMNS,
  mapRemoteDocuments,
  signRemoteDocument,
} from "./remote-documents.js?v=i2";
import { INTEREST_COLUMNS, isMissingRelation, mapInterestToEnrollment } from "./remote-interest.js?v=i2";
import { LEGACY_PAYMENT_COLUMNS, PAYMENT_COLUMNS, PAYMENT_RESULTS, mapRemotePayment } from "./remote-payments.js?v=i2";

// Version exacta fijada (Fase E). Actualizar solo de forma deliberada y probada.
const SUPABASE_JS_URL = "https://esm.sh/@supabase/supabase-js@2.103.0";

const clone = (value) => typeof structuredClone === "function"
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));
const first = (value) => Array.isArray(value) ? value[0] : value;
const money = (cents) => Number(cents || 0) / 100;

export function parseAuthReturn(href) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const errorDescription = url.searchParams.get("error_description") || hash.get("error_description");
  const errorCode = url.searchParams.get("error_code") || hash.get("error_code");
  return {
    present: Boolean(url.hash) || ["code", "error", "error_code", "error_description", "token", "type"]
      .some((key) => url.searchParams.has(key)),
    error: errorDescription || url.searchParams.get("error") || hash.get("error") || "",
    errorCode: errorCode || "",
  };
}

export function cleanAuthReturnHref(href) {
  const url = new URL(href);
  ["code", "error", "error_code", "error_description", "token", "type"].forEach((key) => url.searchParams.delete(key));
  url.hash = "";
  return `${url.pathname}${url.search}`;
}

export function createAuthenticatedFetch({ projectUrl, getToken, fetchImpl = fetch, onDiagnostic = () => {} }) {
  return async (input, init = {}) => {
    const requestUrl = typeof input === "string" ? input : input.url;
    const isProjectRest = requestUrl.startsWith(`${projectUrl}/rest/v1/`);
    const headers = new Headers(init.headers || (typeof input === "string" ? undefined : input.headers));
    const token = getToken();
    if (isProjectRest && token) headers.set("Authorization", `Bearer ${token}`);
    const authorization = headers.get("Authorization") || "";
    const response = await fetchImpl(input, { ...init, headers });
    if (isProjectRest && !response.ok) {
      let body = {};
      try { body = await response.clone().json(); } catch { body = { message: response.statusText }; }
      onDiagnostic({
        status: response.status,
        code: body?.code || null,
        message: body?.message || response.statusText,
        details: body?.details || null,
        hint: body?.hint || null,
        authorization: authorization.startsWith("Bearer ey") ? "session_jwt" : authorization.startsWith("Bearer sb_") ? "publishable_key" : authorization ? "other" : "missing",
        projectHost: new URL(projectUrl).host,
      });
    }
    return response;
  };
}

export async function createSupabaseDataAdapter({ initialState, config, onChange }) {
  assertSupabaseConfig(config);
  let state = testState({ connectionStatus: "loading" });
  let supabase;
  let authSubscription;
  let otpRequestInFlight = false;
  let initializationComplete = false;
  let initialAuthEvent = { event: "PENDING", hasSession: false };
  let activeSessionToken = "";
  let lastSafeSession = null;
  let lastPostgrestDiagnostic = null;
  let resolveInitialAuthEvent;
  const initialAuthEventPromise = new Promise((resolve) => { resolveInitialAuthEvent = resolve; });
  const operationsInFlight = new Set();
  const authReturn = parseAuthReturn(window.location.href);

  function testState(patch = {}) {
    return {
      ...clone(initialState),
      appMode: "test",
      connectionStatus: "ready",
      connectionError: "",
      session: null,
      ...patch,
    };
  }

  try {
    const { createClient } = await import(SUPABASE_JS_URL);
    const authenticatedFetch = createAuthenticatedFetch({
      projectUrl: config.supabaseUrl,
      getToken: () => activeSessionToken,
      onDiagnostic: (diagnostic) => {
        lastPostgrestDiagnostic = diagnostic;
        console.error("Supabase PostgREST safe response:", JSON.stringify(diagnostic));
      },
    });
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        flowType: "implicit",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: { fetch: authenticatedFetch },
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.info("Supabase auth event:", { event, hasSession: Boolean(session), initializationComplete });
      if (!initializationComplete) {
        initialAuthEvent = { event, hasSession: Boolean(session) };
        resolveInitialAuthEvent(initialAuthEvent);
        return;
      }
      if (!["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) return;
      window.setTimeout(async () => {
        try {
          if (session) await loadPrivateStateWithRecovery(session);
          else state = testState();
        } catch (error) {
          console.error("Supabase private state load failed after auth event:", safeError(error));
          state = testState({
            connectionStatus: "error",
            connectionError: `La sesión está iniciada, pero no se pudieron cargar los datos privados: ${friendlyDataLoadError(error)}`,
            authDiagnostics: diagnosticState("private_data", event, Boolean(session), error),
          });
        }
        commit();
      }, 0);
    });
    authSubscription = data.subscription;
    await initializeSession();
    initializationComplete = true;
  } catch (error) {
    initializationComplete = true;
    console.error("Supabase authentication initialization failed:", safeError(error));
    state = testState({
      connectionStatus: "error",
      connectionError: friendlyError(error),
      authDiagnostics: {
        stage: error?.stage || "initialization",
        event: initialAuthEvent.event,
        hasSession: Boolean(error?.hasSession || initialAuthEvent.hasSession),
        code: error?.code || "unknown",
      },
    });
  }

  function cleanAuthReturnUrl() {
    window.history.replaceState({}, document.title, cleanAuthReturnHref(window.location.href));
  }

  async function initializeSession() {
    console.info("Supabase callback detected:", {
      present: authReturn.present,
      hasError: Boolean(authReturn.error),
      errorCode: authReturn.errorCode || null,
      hasHash: Boolean(window.location.hash),
      hasCode: new URL(window.location.href).searchParams.has("code"),
    });
    const { data, error } = await supabase.auth.getSession();
    console.info("Supabase getSession after callback:", { ok: !error, hasSession: Boolean(data?.session), errorCode: error?.code || error?.status || null });
    if (error) throw authStageError(error, "get_session", false);
    if (authReturn.error) {
      const returnError = new Error(authReturn.error.replace(/\+/g, " "));
      returnError.code = authReturn.errorCode;
      throw authStageError(returnError, "callback_error", false);
    }
    let session = data.session;
    if (authReturn.present && !session) {
      await Promise.race([initialAuthEventPromise, new Promise((resolve) => window.setTimeout(resolve, 2500))]);
      const retry = await supabase.auth.getSession();
      console.info("Supabase getSession callback retry:", { ok: !retry.error, hasSession: Boolean(retry.data?.session), event: initialAuthEvent.event });
      if (retry.error) throw authStageError(retry.error, "get_session_retry", false);
      session = retry.data.session;
    }
    if (authReturn.present && !session) {
      const callbackError = new Error("auth_callback_without_session");
      callbackError.code = "auth_callback_without_session";
      throw authStageError(callbackError, "callback_session", false);
    }
    if (!session) {
      state = testState();
      return;
    }
    try {
      await loadPrivateStateWithRecovery(session);
    } catch (privateError) {
      console.error("Supabase private state load failed:", safeError(privateError));
      if (authReturn.present) cleanAuthReturnUrl();
      state = testState({
        connectionStatus: "error",
        connectionError: `La sesión está iniciada, pero no se pudieron cargar los datos privados: ${friendlyDataLoadError(privateError)}`,
        authDiagnostics: diagnosticState("private_data", initialAuthEvent.event, true, privateError),
      });
      return;
    }
    if (authReturn.present) cleanAuthReturnUrl();
  }

  async function refreshSessionAndState() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      state = testState();
      return;
    }
    await loadPrivateStateWithRecovery(data.session);
  }

  function authStageError(error, stage, hasSession) {
    error.stage = stage;
    error.hasSession = hasSession;
    return error;
  }

  function safeError(error) {
    return {
      name: error?.name || "Error",
      code: error?.code || error?.status || "unknown",
      message: error?.message || "unknown",
      details: error?.details || null,
      hint: error?.hint || null,
    };
  }

  function safeSession(session) {
    let claims = {};
    try {
      const payload = session?.access_token?.split(".")?.[1];
      if (payload) claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      claims = {};
    }
    let header = {};
    try {
      const encodedHeader = session?.access_token?.split(".")?.[0];
      if (encodedHeader) header = JSON.parse(atob(encodedHeader.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      header = {};
    }
    const result = {
      userId: session?.user?.id || null,
      email: session?.user?.email || null,
      subjectMatches: Boolean(session?.user?.id && claims.sub === session.user.id),
      role: claims.role || null,
      audience: claims.aud || null,
      issuerHost: claims.iss ? new URL(claims.iss).host : null,
      expiresAt: claims.exp || null,
      expired: claims.exp ? claims.exp <= Math.floor(Date.now() / 1000) : null,
      algorithm: header.alg || null,
      projectMatches: claims.iss ? new URL(claims.iss).host === new URL(config.supabaseUrl).host : false,
    };
    lastSafeSession = result;
    return result;
  }

  function diagnosticState(stage, event, hasSession, error) {
    return {
      stage,
      event,
      hasSession,
      code: error?.code || "unknown",
      projectMatches: lastSafeSession?.projectMatches ?? null,
      jwtRole: lastSafeSession?.role || null,
      jwtExpired: lastSafeSession?.expired ?? null,
      jwtAlgorithm: lastSafeSession?.algorithm || null,
      postgrest: lastPostgrestDiagnostic,
    };
  }

  async function loadPrivateStateWithRecovery(session) {
    activeSessionToken = session.access_token || "";
    const identity = await supabase.auth.getUser(session.access_token);
    if (identity.error) throw identity.error;
    if (identity.data.user?.id !== session.user.id) throw new Error("La identidad de la sesión no coincide con el usuario autenticado.");
    console.info("Supabase verified session:", safeSession(session));
    try {
      await loadPrivateState(session);
    } catch (error) {
      if (error?.code !== "PGRST303") throw error;
      console.warn("Supabase private data rejected session claims; refreshing once:", {
        code: error.code,
        message: error.message,
        session: safeSession(session),
      });
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.error || !refreshed.data.session) throw refreshed.error || error;
      activeSessionToken = refreshed.data.session.access_token || "";
      const refreshedIdentity = await supabase.auth.getUser(refreshed.data.session.access_token);
      if (refreshedIdentity.error) throw refreshedIdentity.error;
      console.info("Supabase refreshed verified session:", safeSession(refreshed.data.session));
      await loadPrivateState(refreshed.data.session);
    }
  }

  async function loadPrivateState(session) {
    const userId = session.user.id;
    const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,phone,active").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role,family_id").eq("user_id", userId),
    ]);
    if (profileError) throw profileError;
    if (rolesError) throw rolesError;
    const roleList = (roles || []).map((item) => item.role);
    const isAdmin = roleList.includes("admin") || roleList.includes("owner");
    const remoteState = isAdmin ? await loadAdminState() : await loadFamilyState(userId);
    state = testState({
      ...remoteState,
      activeView: isAdmin ? "admin" : "family",
      session: {
        email: profile?.email || session.user.email,
        name: profile?.full_name || session.user.email,
        createdAt: session.user.created_at,
        userId,
        roles: roleList,
        isAdmin,
      },
    });
  }

  async function loadFamilyState(userId) {
    const { data, error } = await supabase
      .from("family_members")
      .select("family_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data?.family_id) throw new Error("Acceso pendiente de vinculacion con una familia autorizada.");
    return loadFamilyById(data.family_id);
  }

  async function loadAdminState() {
    const { data, error } = await supabase
      .from("families")
      .select("id")
      .is("archived_at", null)
      .order("created_at");
    if (error) throw error;
    if (!data?.length) throw new Error("No hay familias ficticias cargadas.");
    const familyStates = await Promise.all(data.map((item) => loadFamilyById(item.id)));
    const primary = familyStates[0];
    return {
      ...primary,
      adminFamilies: familyStates.map((item) => item.family),
      adminChildren: familyStates.flatMap((item) => item.family.children.map((child) => ({
        ...child,
        familyId: item.family.id,
        familyName: item.family.name,
      }))),
      enrollments: familyStates.flatMap((item) => item.enrollments),
      documents: familyStates.flatMap((item) => item.documents),
      payments: familyStates.flatMap((item) => item.payments),
      audit: familyStates.flatMap((item) => item.audit)
        .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date))),
    };
  }

  async function loadFamilyById(familyId) {
    const results = await Promise.all([
      supabase.from("families").select("id,name,phone,email,address,stripe_customer_ref").eq("id", familyId).single(),
      supabase.from("family_members").select("id,relationship,can_sign,can_pay,user_id,profiles(id,email,full_name,phone)").eq("family_id", familyId).eq("status", "active"),
      supabase.from("players").select("id,first_name,last_name,birth_date,team,medical_profiles(notes),emergency_contacts(name,phone,relationship,priority)").eq("family_id", familyId).eq("active", true),
      supabase.from("enrollments").select("id,family_id,player_id,service_id,location_id,season_id,group_id,plan_id,plan_price_id,status,operational_status,review_status,review_notes,start_on,availability_requests(availability,notes)").eq("family_id", familyId),
      supabase.from("audit_log").select("id,created_at,actor_label,action,service_id").eq("family_id", familyId).order("created_at", { ascending: false }).limit(30),
      loadSignatures(familyId),
      loadPayments(familyId),
      supabase.from("service_documents").select("id,service_id,code,title,scope,required,active,document_versions(id,version,effective_date,storage_path,status)").eq("active", true),
      supabase.from("service_groups").select("id,service_id,location_id,season_id,name,day_of_week,starts_at,ends_at,capacity,occupied_base,active").eq("active", true),
      supabase.from("service_locations").select("id,service_id,name,city,owner_type,active").eq("active", true),
      supabase.from("service_plans").select("id,service_id,name,frequency_label,active,plan_prices(id,amount_cents,currency,billing_period,enrollment_fee_cents,admin_only,active)").eq("active", true),
      supabase.from("service_seasons").select("id,service_id,name,starts_on,ends_on,active").eq("active", true),
    ]);
    const failure = results.find((result) => result.error);
    if (failure) throw failure.error;
    const [familyResult, membersResult, playersResult, enrollmentsResult, auditResult, signaturesResult, paymentsResult, documentsResult, groupsResult, locationsResult, plansResult, seasonsResult] = results;
    const occupancy = await loadGroupOccupancy();
    const interest = await loadInterest(familyId);
    const family = familyResult.data;
    const players = playersResult.data || [];
    const enrollments = enrollmentsResult.data || [];

    return {
      family: mapFamily(family, membersResult.data || [], players),
      selectedChildId: players[0]?.id || "",
      selectedCenter: locationsResult.data?.find((item) => item.service_id === "training_kids")?.id || "",
      selectedPlan: plansResult.data?.flatMap((plan) => (plan.plan_prices || []).map((price) => ({ plan, price })))
        .find((item) => item.plan.service_id === "training_kids" && item.price.active && !item.price.admin_only)?.plan.id || "",
      enrollments: [...enrollments.map(mapEnrollment), ...interest.rows.map(mapInterestToEnrollment)],
      remoteInterestReady: interest.ready,
      remoteSignatureReady: !signaturesResult.legacy,
      documents: mapRemoteDocuments({
        familyId,
        enrollments,
        serviceDocuments: documentsResult.data || [],
        signatures: signaturesResult.data || [],
      }),
      remotePaymentsReady: !paymentsResult.legacy,
      remoteOperationsReady: occupancy.ready,
      payments: (paymentsResult.data || []).map((item) => mapRemotePayment(item, enrollments)),
      audit: (auditResult.data || []).map(mapAudit),
      remoteCatalog: {
        groups: (groupsResult.data || []).map((group) => ({
          id: group.id,
          service: group.service_id,
          centerId: group.location_id,
          seasonId: group.season_id || "",
          name: group.name,
          day: group.day_of_week || "Pendiente",
          time: [group.starts_at, group.ends_at].filter(Boolean).join("-") || "Pendiente",
          capacity: group.capacity,
          occupied: group.occupied_base,
          serverAssigned: occupancy.ready ? occupancy.assigned.get(group.id) ?? 0 : undefined,
        })),
        centers: (locationsResult.data || []).map((location) => ({
          id: location.id,
          name: location.name,
          city: location.city || "",
          owner: location.owner_type === "own" ? "Propio" : "Externo",
          services: [location.service_id],
        })),
        plans: (plansResult.data || []).flatMap((plan) => (plan.plan_prices || [])
          .filter((price) => price.active)
          .map((price) => ({
            id: plan.id,
            priceId: price.id,
            name: plan.frequency_label,
            period: price.billing_period === "monthly" ? "Mensual" : "Trimestral",
            amount: money(price.amount_cents),
            visibility: price.admin_only ? "Solo administracion" : "Publica nuevos clientes",
          }))),
        seasons: (seasonsResult.data || []).map((season) => ({
          id: season.id,
          service: season.service_id,
          name: season.name,
          startsOn: season.starts_on,
          endsOn: season.ends_on,
        })),
      },
      stripeCustomerRef: family.stripe_customer_ref || "Sin cliente Stripe",
    };
  }

  function mapFamily(family, members, players) {
    return {
      id: family.id,
      name: family.name,
      phone: family.phone || "",
      email: family.email || "",
      address: family.address || "",
      tutors: members.map((member) => {
        const profile = first(member.profiles);
        return {
          id: profile?.id || member.id,
          name: profile?.full_name || profile?.email || "Tutor",
          relationship: member.relationship || "Tutor",
          email: profile?.email || "",
          phone: profile?.phone || "",
          canSign: Boolean(member.can_sign),
          canPay: Boolean(member.can_pay),
        };
      }),
      children: players.map((player) => {
        const medical = first(player.medical_profiles);
        const emergency = [...(player.emergency_contacts || [])].sort((a, b) => a.priority - b.priority)[0];
        return {
          id: player.id,
          name: `${player.first_name || ""} ${player.last_name || ""}`.trim(),
          birthDate: player.birth_date || "",
          team: player.team || "",
          medical: medical?.notes || "",
          emergencyName: emergency?.name || "",
          emergencyPhone: emergency?.phone || "",
          availability: [],
        };
      }),
    };
  }

  function mapEnrollment(item) {
    const availability = first(item.availability_requests);
    return {
      id: item.id,
      familyId: item.family_id,
      childId: item.player_id,
      service: item.service_id,
      status: item.status,
      docs: "Remotos",
      payment: "Remoto",
      groupId: item.group_id || "",
      planId: item.plan_id || "",
      planPriceId: item.plan_price_id || "",
      centerId: item.location_id || "",
      seasonId: item.season_id || "",
      operationalStatus: item.operational_status || "draft",
      reviewStatus: item.review_status || "pending",
      reviewNotes: item.review_notes || "",
      startOn: item.start_on || "",
      availability: availability?.availability || [],
      notes: availability?.notes || "",
      remote: true,
    };
  }

  // Antes de aplicar la migracion F faltan columnas de evidencia: se lee el esquema anterior
  // y la firma remota queda desactivada en lugar de romper toda la carga.
  async function loadSignatures(familyId) {
    const result = await supabase.from("signature_records").select(SIGNATURE_COLUMNS).eq("family_id", familyId);
    if (result.error?.code !== "42703") return result;
    const legacy = await supabase.from("signature_records").select(LEGACY_SIGNATURE_COLUMNS).eq("family_id", familyId);
    return { ...legacy, legacy: true };
  }

  // Antes de aplicar la migracion I no existe la tabla de prealtas: no se muestran y
  // registrar interes queda desactivado.
  async function loadInterest(familyId) {
    const { data, error } = await supabase.from("service_interest_requests").select(INTEREST_COLUMNS)
      .eq("family_id", familyId).order("created_at", { ascending: false });
    if (error) {
      if (isMissingRelation(error)) return { ready: false, rows: [] };
      throw error;
    }
    return { ready: true, rows: data || [] };
  }

  // Antes de aplicar la migracion H no existe group_occupancy: se usa el recuento local
  // y las acciones de activacion, grupo y baja quedan desactivadas.
  async function loadGroupOccupancy() {
    const { data, error } = await supabase.rpc("group_occupancy");
    if (error) return { ready: false, assigned: new Map() };
    return { ready: true, assigned: new Map((data || []).map((row) => [row.group_id, Number(row.assigned) || 0])) };
  }

  // Antes de aplicar la migracion G faltan columnas de pago: se lee el esquema anterior
  // y las acciones de pago quedan desactivadas en lugar de romper la carga.
  async function loadPayments(familyId) {
    const query = (columns) => supabase.from("payment_orders").select(columns).eq("family_id", familyId).order("created_at", { ascending: false });
    const result = await query(PAYMENT_COLUMNS);
    if (result.error?.code !== "42703") return result;
    return { ...(await query(LEGACY_PAYMENT_COLUMNS)), legacy: true };
  }

  function mapAudit(item) {
    return {
      id: item.id,
      date: new Date(item.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      actor: item.actor_label || "Sistema",
      action: item.action,
      service: item.service_id || "Plataforma",
      createdAt: item.created_at,
    };
  }

  function friendlyError(error) {
    const message = error?.message || "No se pudo conectar con el servicio de acceso.";
    if (/failed to fetch|network/i.test(message)) return "No se pudo conectar con el servicio de acceso. Comprueba tu conexión.";
    if (/expired|otp_expired/i.test(message)) return "El enlace de acceso ha caducado. Solicita uno nuevo.";
    if (/invalid|no ha creado una sesión válida/i.test(message)) return "El enlace de acceso no es válido o ya se ha utilizado. Solicita uno nuevo.";
    if (/pkce code verifier/i.test(message)) return "No se pudo restaurar la sesión del enlace. Solicita uno nuevo y ábrelo en este mismo navegador.";
    if (/auth_callback_without_session/i.test(message)) return "Supabase devolvió el enlace, pero no creó ninguna sesión. El retorno se ha conservado para poder diagnosticarlo.";
    if (/vinculacion|familia autorizada/i.test(message)) return "Tu usuario existe, pero todavía no está vinculado a una familia autorizada.";
    return "No se pudo preparar el acceso. Vuelve a intentarlo en unos minutos.";
  }

  function friendlyDataLoadError(error) {
    if (error?.code === "42703") return "el esquema remoto no contiene una columna esperada.";
    if (error?.code === "PGRST202") return "Supabase todavía no reconoce una función de Fase D.";
    if (error?.code === "42501") return "los permisos RLS han rechazado una consulta necesaria.";
    return translateDataError(error, "se produjo un error de lectura en Supabase.");
  }

  function commit() {
    if (onChange) onChange(state);
  }

  return {
    client: supabase,
    getState: () => state,
    setState(patch) {
      state = { ...state, ...patch };
      commit();
    },
    updateFamily(patch) {
      state.family = { ...state.family, ...patch };
      commit();
    },
    mutate(mutator) {
      mutator(state);
      commit();
    },
    save() {},
    isRemote: true,
    async saveFamily(patch) {
      return runOperation("save-family", async () => {
        const { error } = await supabase.rpc("family_update_details", {
          p_name: patch.name,
          p_phone: patch.phone || "",
          p_address: patch.address || "",
        });
        if (error) throw error;
        await refreshSessionAndState();
        commit();
      });
    },
    async savePlayer(player) {
      return runOperation(`save-player-${player.id || "new"}`, async () => {
        const parts = String(player.name || "").trim().split(/\s+/);
        const firstName = parts.shift() || "";
        const lastName = parts.join(" ");
        const playerId = isUuid(player.id) ? player.id : null;
        const { data, error } = await supabase.rpc("family_save_player", {
          p_player_id: playerId,
          p_first_name: firstName,
          p_last_name: lastName,
          p_birth_date: player.birthDate || null,
          p_team: player.team || "",
          p_medical_notes: player.medical || "",
          p_emergency_name: player.emergencyName || "",
          p_emergency_phone: player.emergencyPhone || "",
          p_emergency_relationship: player.emergencyRelationship || "Tutor",
        });
        if (error) throw error;
        await refreshSessionAndState();
        state.selectedChildId = data;
        commit();
        return data;
      });
    },
    async submitEnrollment(payload) {
      return runOperation(`submit-enrollment-${payload.playerId}-${payload.serviceId}`, async () => {
        const { data, error } = await supabase.rpc("family_submit_enrollment", {
          p_player_id: payload.playerId,
          p_service_id: payload.serviceId,
          p_location_id: payload.locationId,
          p_season_id: payload.seasonId,
          p_plan_id: payload.planId,
          p_plan_price_id: payload.planPriceId,
          p_availability: payload.availability || [],
          p_notes: payload.notes || "",
        });
        if (error) throw error;
        await refreshSessionAndState();
        state.familyStep = 5;
        commit();
        return data;
      });
    },
    async reviewEnrollment(enrollmentId, decision, groupId = null, notes = "") {
      return runOperation(`review-enrollment-${enrollmentId}`, async () => {
        const { error } = await supabase.rpc("admin_review_enrollment", {
          p_enrollment_id: enrollmentId,
          p_decision: decision,
          p_group_id: groupId || null,
          p_notes: notes,
        });
        if (error) throw error;
        await refreshSessionAndState();
        commit();
      });
    },
    async signDocument({ document, signerName, completedData, signaturePngDataUrl, pdfDataUrl }) {
      return runOperation(`sign-document-${document.id}`, async () => {
        if (!state.remoteSignatureReady) throw new Error("signature_schema_missing");
        const result = await signRemoteDocument({
          supabase,
          familyId: state.family.id,
          document,
          signerName,
          completedData,
          signaturePngDataUrl,
          pdfDataUrl,
        });
        await refreshSessionAndState();
        state.activeView = "documents";
        state.activeDocumentId = document.id;
        state.signingDocumentId = "";
        state.documentFlowSteps = { ...(state.documentFlowSteps || {}), [document.id]: "signed" };
        commit();
        return result;
      });
    },
    async recordPayment(paymentId, result, note = "") {
      if (!PAYMENT_RESULTS.includes(result)) throw new Error("payment_result_invalid");
      return runOperation(`record-payment-${paymentId}`, async () => {
        if (!state.remotePaymentsReady) throw new Error("payment_schema_missing");
        const { error } = await supabase.rpc("admin_record_payment", {
          p_payment_order_id: paymentId,
          p_result: result,
          p_note: note || null,
        });
        if (error) throw error;
        await refreshSessionAndState();
        commit();
      });
    },
    async preparePayment(enrollmentId) {
      return runOperation(`prepare-payment-${enrollmentId}`, async () => {
        if (!state.remotePaymentsReady) throw new Error("payment_schema_missing");
        const { error } = await supabase.rpc("admin_prepare_payment_order", { p_enrollment_id: enrollmentId });
        if (error) throw error;
        await refreshSessionAndState();
        commit();
      });
    },
    async assignGroup(enrollmentId, groupId) {
      return runEnrollmentOperation(`assign-group-${enrollmentId}`, "admin_assign_group", { p_enrollment_id: enrollmentId, p_group_id: groupId });
    },
    async activateEnrollment(enrollmentId) {
      return runEnrollmentOperation(`activate-${enrollmentId}`, "admin_activate_enrollment", { p_enrollment_id: enrollmentId });
    },
    async withdrawEnrollment(enrollmentId, reason = "") {
      return runEnrollmentOperation(`withdraw-${enrollmentId}`, "admin_withdraw_enrollment", { p_enrollment_id: enrollmentId, p_reason: reason || null });
    },
    async registerInterest(playerId, serviceId, notes = "") {
      return runOperation(`register-interest-${playerId}-${serviceId}`, async () => {
        if (!state.remoteInterestReady) throw new Error("interest_schema_missing");
        const { error } = await supabase.rpc("family_register_interest", {
          p_player_id: playerId,
          p_service_id: serviceId,
          p_notes: notes || null,
        });
        if (error) throw error;
        await refreshSessionAndState();
        state.selectedChildId = playerId;
        state.familyStep = 5;
        commit();
      });
    },
    async updateInterest(requestId, status, adminNotes = "") {
      return runOperation(`update-interest-${requestId}`, async () => {
        if (!state.remoteInterestReady) throw new Error("interest_schema_missing");
        const { error } = await supabase.rpc("admin_update_interest", {
          p_request_id: requestId,
          p_status: status,
          p_admin_notes: adminNotes || null,
        });
        if (error) throw error;
        await refreshSessionAndState();
        commit();
      });
    },
    async getSignedFileUrl(kind, path) {
      const bucket = kind === "pdf" ? SIGNATURE_BUCKETS.pdf : SIGNATURE_BUCKETS.evidence;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 120);
      if (error) throw error;
      return data.signedUrl;
    },
    async requestLoginLink(email) {
      if (!supabase) throw new Error(state.connectionError || "Supabase no esta disponible.");
      if (otpRequestInFlight) return;
      otpRequestInFlight = true;
      try {
        const redirectTo = `${window.location.origin}/?mode=test`;
        const { data, error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: {
            shouldCreateUser: false,
            emailRedirectTo: redirectTo,
          },
        });
        console.info("Supabase signInWithOtp result:", {
          ok: !error,
          errorCode: error?.code || error?.status || null,
          hasUser: Boolean(data?.user),
          hasSession: Boolean(data?.session),
          redirectOrigin: window.location.origin,
        });
        if (error) throw error;
        return data;
      } finally {
        otpRequestInFlight = false;
      }
    },
    async logout() {
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      activeSessionToken = "";
      state = testState();
      commit();
    },
    async refresh() {
      await refreshSessionAndState();
      commit();
    },
    destroy() {
      authSubscription?.unsubscribe();
    },
  };

  async function runEnrollmentOperation(key, rpcName, params) {
    return runOperation(key, async () => {
      if (!state.remoteOperationsReady) throw new Error("operations_schema_missing");
      const { error } = await supabase.rpc(rpcName, params);
      if (error) throw error;
      await refreshSessionAndState();
      commit();
    });
  }

  async function runOperation(key, operation) {
    if (operationsInFlight.has(key)) return;
    operationsInFlight.add(key);
    state = { ...state, saveState: "saving", saveMessage: "Guardando…" };
    commit();
    try {
      const result = await operation();
      state = { ...state, saveState: "saved", saveMessage: "Cambios guardados" };
      commit();
      return result;
    } catch (error) {
      console.error("Supabase data operation failed:", { operation: key, code: error?.code, message: error?.message });
      state = { ...state, saveState: "error", saveMessage: translateDataError(error) };
      commit();
      throw error;
    } finally {
      operationsInFlight.delete(key);
    }
  }
}
