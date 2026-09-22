import { assertSupabaseConfig } from "./app-config.js";

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

export async function createSupabaseDataAdapter({ initialState, config, onChange }) {
  assertSupabaseConfig(config);
  let state = testState({ connectionStatus: "loading" });
  let supabase;
  let authSubscription;

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
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    await processAuthReturn();
    await refreshSessionAndState();
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
    state = testState({ connectionStatus: "error", connectionError: friendlyError(error) });
  }

  async function processAuthReturn() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const hasAuthResponse = code || url.hash.includes("access_token") || url.searchParams.has("error");
    try {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      }
    } finally {
      if (hasAuthResponse) cleanAuthUrl(url);
    }
  }

  function cleanAuthUrl(url) {
    ["code", "error", "error_code", "error_description"].forEach((key) => url.searchParams.delete(key));
    url.hash = "";
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
  }

  async function refreshSessionAndState() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
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
      .order("created_at")
      .limit(1);
    if (error) throw error;
    if (!data?.length) throw new Error("No hay familias ficticias cargadas.");
    return loadFamilyById(data[0].id);
  }

  async function loadFamilyById(familyId) {
    const results = await Promise.all([
      supabase.from("families").select("id,name,phone,email,address,stripe_customer_ref").eq("id", familyId).single(),
      supabase.from("family_members").select("id,relationship,can_sign,can_pay,user_id,profiles(id,email,full_name,phone)").eq("family_id", familyId).eq("status", "active"),
      supabase.from("players").select("id,first_name,last_name,birth_date,team,medical_profiles(notes),emergency_contacts(name,phone,relationship,priority)").eq("family_id", familyId).eq("active", true),
      supabase.from("enrollments").select("id,player_id,service_id,location_id,group_id,plan_id,plan_price_id,status,operational_status,start_on").eq("family_id", familyId),
      supabase.from("audit_log").select("id,created_at,actor_label,action,service_id").eq("family_id", familyId).order("created_at", { ascending: false }).limit(30),
      supabase.from("signature_records").select("id,player_id,enrollment_id,document_version_id,status,signed_at,completed_data,accepted_consents,final_sha256,locked_at").eq("family_id", familyId),
      supabase.from("payment_orders").select("id,enrollment_id,status,amount_cents,currency,due_on,provider_customer_ref,created_at,payment_events(id,event_type,status,created_at)").eq("family_id", familyId).order("created_at", { ascending: false }),
      supabase.from("service_documents").select("id,service_id,code,title,scope,required,active,document_versions(id,version,effective_date,storage_path,status)").eq("active", true),
      supabase.from("service_groups").select("id,service_id,location_id,name,day_of_week,starts_at,ends_at,capacity,occupied_base,active").eq("active", true),
      supabase.from("service_locations").select("id,service_id,name,city,owner_type,active").eq("active", true),
      supabase.from("service_plans").select("id,service_id,name,frequency_label,active,plan_prices(id,amount_cents,currency,billing_period,enrollment_fee_cents,admin_only,active)").eq("active", true),
    ]);
    const failure = results.find((result) => result.error);
    if (failure) throw failure.error;
    const [familyResult, membersResult, playersResult, enrollmentsResult, auditResult, signaturesResult, paymentsResult, documentsResult, groupsResult, locationsResult, plansResult] = results;
    const family = familyResult.data;
    const players = playersResult.data || [];
    const enrollments = enrollmentsResult.data || [];

    return {
      family: mapFamily(family, membersResult.data || [], players),
      selectedChildId: players[0]?.id || "",
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
    return {
      id: item.id,
      childId: item.player_id,
      service: item.service_id,
      status: item.status,
      docs: "Remotos",
      payment: "Remoto",
      groupId: item.group_id || "",
      planId: item.plan_id || "",
      planPriceId: item.plan_price_id || "",
      centerId: item.location_id || "",
      operationalStatus: item.operational_status || "draft",
      startOn: item.start_on || "",
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
    };
  }

  function friendlyError(error) {
    const message = error?.message || "No se pudo conectar con Supabase.";
    if (/failed to fetch|network/i.test(message)) return "No se pudo conectar con Supabase. Revisa la red y la URL del proyecto.";
    return message;
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
    async requestOtp(email) {
      if (!supabase) throw new Error(state.connectionError || "Supabase no esta disponible.");
      const redirectUrl = new URL(window.location.href);
      redirectUrl.search = "?mode=test";
      redirectUrl.hash = "";
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: { shouldCreateUser: false, emailRedirectTo: redirectUrl.toString() },
      });
      if (error) throw error;
    },
    async verifyOtp(email, token) {
      if (!supabase) throw new Error(state.connectionError || "Supabase no esta disponible.");
      const { error } = await supabase.auth.verifyOtp({ email: email.toLowerCase(), token, type: "email" });
      if (error) throw error;
      await refreshSessionAndState();
      commit();
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
}
