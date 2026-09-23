import { assertSupabaseConfig } from "./app-config.js";
import { isUuid, translateDataError } from "./errors.js";

const SUPABASE_JS_URL = "https://esm.sh/@supabase/supabase-js@2";
const TEMPLATE_BY_CODE = {
  activity_contract: "tk-service-terms",
  image_authorization: "tk-image-rights",
  rules_and_guarantees: "tk-norms-guarantees",
  calendar_2026_2027: "global-family-account",
};

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

export async function createSupabaseDataAdapter({ initialState, config, onChange }) {
  assertSupabaseConfig(config);
  let state = testState({ connectionStatus: "loading" });
  let supabase;
  let authSubscription;
  let otpRequestInFlight = false;
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
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        flowType: "implicit",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    await refreshSessionAndState();
    if (authReturn.present) cleanAuthReturnUrl();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) return;
      queueMicrotask(async () => {
        try {
          if (session) await loadPrivateState(session);
          else state = testState();
        } catch (error) {
          state = testState({ connectionStatus: "error", connectionError: friendlyError(error) });
        }
        commit();
      });
    });
    authSubscription = data.subscription;
  } catch (error) {
    console.error("Supabase authentication initialization failed:", error);
    if (authReturn.present) cleanAuthReturnUrl();
    state = testState({ connectionStatus: "error", connectionError: friendlyError(error) });
  }

  function cleanAuthReturnUrl() {
    window.history.replaceState({}, document.title, cleanAuthReturnHref(window.location.href));
  }

  async function refreshSessionAndState() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (authReturn.error) {
      const returnError = new Error(authReturn.error.replace(/\+/g, " "));
      returnError.code = authReturn.errorCode;
      throw returnError;
    }
    if (authReturn.present && !data.session) {
      throw new Error("El enlace de acceso no ha creado una sesión válida. Solicita uno nuevo.");
    }
    if (!data.session) {
      state = testState();
      return;
    }
    await loadPrivateState(data.session);
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
      supabase.from("signature_records").select("id,player_id,enrollment_id,document_version_id,status,signed_at,completed_data,accepted_consents,final_sha256,locked_at").eq("family_id", familyId),
      supabase.from("payment_orders").select("id,enrollment_id,status,amount_cents,currency,due_on,provider_customer_ref,created_at,payment_events(id,event_type,status,created_at)").eq("family_id", familyId).order("created_at", { ascending: false }),
      supabase.from("service_documents").select("id,service_id,code,title,scope,required,active,document_versions(id,version,effective_date,storage_path,status)").eq("active", true),
      supabase.from("service_groups").select("id,service_id,location_id,season_id,name,day_of_week,starts_at,ends_at,capacity,occupied_base,active").eq("active", true),
      supabase.from("service_locations").select("id,service_id,name,city,owner_type,active").eq("active", true),
      supabase.from("service_plans").select("id,service_id,name,frequency_label,active,plan_prices(id,amount_cents,currency,billing_period,enrollment_fee_cents,admin_only,active)").eq("active", true),
      supabase.from("service_seasons").select("id,service_id,name,starts_on,ends_on,active").eq("active", true),
    ]);
    const failure = results.find((result) => result.error);
    if (failure) throw failure.error;
    const [familyResult, membersResult, playersResult, enrollmentsResult, auditResult, signaturesResult, paymentsResult, documentsResult, groupsResult, locationsResult, plansResult, seasonsResult] = results;
    const family = familyResult.data;
    const players = playersResult.data || [];
    const enrollments = enrollmentsResult.data || [];

    return {
      family: mapFamily(family, membersResult.data || [], players),
      selectedChildId: players[0]?.id || "",
      selectedCenter: locationsResult.data?.find((item) => item.service_id === "training_kids")?.id || "",
      selectedPlan: plansResult.data?.flatMap((plan) => (plan.plan_prices || []).map((price) => ({ plan, price })))
        .find((item) => item.plan.service_id === "training_kids" && item.price.active && !item.price.admin_only)?.plan.id || "",
      enrollments: enrollments.map(mapEnrollment),
      documents: mapDocuments({
        familyId,
        enrollments,
        serviceDocuments: documentsResult.data || [],
        signatures: signaturesResult.data || [],
      }),
      payments: (paymentsResult.data || []).map((item) => mapPayment(item, enrollments)),
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

  function mapDocuments({ familyId, enrollments, serviceDocuments, signatures }) {
    const documents = [];
    for (const definition of serviceDocuments) {
      const templateId = TEMPLATE_BY_CODE[definition.code];
      if (!templateId) continue;
      const versions = definition.document_versions || [];
      const version = [...versions].sort((a, b) => String(b.effective_date).localeCompare(String(a.effective_date)))[0];
      if (!version) continue;
      if (definition.scope === "informative") {
        documents.push(mapDocument({ definition, version, templateId, familyId }));
        continue;
      }
      for (const enrollment of enrollments.filter((item) => item.service_id === definition.service_id)) {
        const signature = signatures.find((item) => item.enrollment_id === enrollment.id && item.document_version_id === version.id);
        documents.push(mapDocument({ definition, version, templateId, familyId, enrollment, signature }));
      }
    }
    return documents;
  }

  function mapDocument({ definition, version, templateId, familyId, enrollment, signature }) {
    const signed = signature?.status === "signed";
    return {
      id: signature?.id || `remote-${version.id}-${enrollment?.id || "info"}`,
      remoteVersionId: version.id,
      templateId,
      scope: definition.scope === "informative" ? "global" : "enrollment",
      service: definition.service_id,
      familyId,
      childId: enrollment?.player_id || "",
      enrollmentId: enrollment?.id || "",
      status: definition.scope === "informative" ? "info" : signed ? "signed" : definition.required ? "pending_complete" : "pending_signature",
      required: Boolean(definition.required),
      title: definition.title,
      version: version.version,
      effectiveDate: version.effective_date,
      signedAt: signature?.signed_at || "",
      completedSnapshot: signature?.completed_data || null,
      evidence: signed ? {
        id: signature.id,
        hash: signature.final_sha256 || "Huella remota pendiente",
        status: signature.status,
        signedAt: signature.signed_at,
        consents: signature.accepted_consents || {},
      } : null,
    };
  }

  function mapPayment(item, enrollments) {
    const enrollment = enrollments.find((candidate) => candidate.id === item.enrollment_id);
    return {
      id: item.id,
      enrollmentId: item.enrollment_id,
      childId: enrollment?.player_id || "",
      service: enrollment?.service_id || "training_kids",
      centerId: enrollment?.location_id || "",
      planId: enrollment?.plan_id || "",
      period: "Registro remoto",
      status: item.status,
      nextDueLabel: item.due_on || "Sin vencimiento definido",
      lineItems: [{ label: "Total registrado", amount: money(item.amount_cents) }],
      receipt: item.status === "paid" ? { id: item.id, createdAt: item.created_at, amount: money(item.amount_cents) } : null,
      remote: true,
    };
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
    if (/vinculacion|familia autorizada/i.test(message)) return "Tu usuario existe, pero todavía no está vinculado a una familia autorizada.";
    return "No se pudo preparar el acceso. Vuelve a intentarlo en unos minutos.";
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
