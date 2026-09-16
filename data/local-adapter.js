const clone = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const mergeState = (base, saved) => ({
  ...base,
  ...saved,
  family: {
    ...base.family,
    ...saved.family,
    tutors: saved.family?.tutors || base.family.tutors,
    children: saved.family?.children || base.family.children,
  },
  audit: saved.audit || base.audit,
  enrollments: saved.enrollments || base.enrollments,
  documents: reconcileDocuments(base.documents, saved.documents),
  payments: reconcileById(base.payments, saved.payments),
});

function reconcileDocuments(baseDocuments, savedDocuments = []) {
  const merged = baseDocuments.map((baseDocument) => {
    const savedDocument = savedDocuments.find((document) => document.id === baseDocument.id);
    const nextDocument = savedDocument
      ? {
          ...savedDocument,
          ...baseDocument,
          status: baseDocument.status === "validation_pending" && savedDocument.status !== "signed"
            ? "validation_pending"
            : savedDocument.status || baseDocument.status,
          signedAt: savedDocument.signedAt || baseDocument.signedAt,
          evidence: savedDocument.evidence || baseDocument.evidence,
          completedSnapshot: savedDocument.completedSnapshot || baseDocument.completedSnapshot,
        }
      : baseDocument;
    return retireCurrentFlowDocument(nextDocument);
  });
  const baseIds = new Set(baseDocuments.map((document) => document.id));
  return [
    ...merged,
    ...savedDocuments.filter((document) => !baseIds.has(document.id)).map(retireCurrentFlowDocument),
  ];
}

function retireCurrentFlowDocument(document) {
  if (["global-family-account", "tk-norms-guarantees"].includes(document.templateId)) {
    return {
      ...document,
      archived: false,
      required: false,
      status: "info",
      validationNote: "",
      childId: document.templateId === "global-family-account" ? "" : document.childId,
      enrollmentId: document.templateId === "global-family-account" ? "" : document.enrollmentId,
      signedAt: "",
      evidence: null,
      completedSnapshot: null,
    };
  }
  if (["tk-sepa-mandate", "tk-medical-info", "tk-emergency-contact", "tk-data-protection", "fa-interest-info"].includes(document.templateId)) {
    return {
      ...document,
      archived: true,
      required: false,
      status: document.status === "signed" ? "signed" : "not_applicable",
    };
  }
  return document;
}

function reconcileById(baseItems = [], savedItems = []) {
  const merged = baseItems.map((baseItem) => {
    const savedItem = savedItems.find((item) => item.id === baseItem.id);
    return savedItem ? { ...baseItem, ...savedItem } : baseItem;
  });
  const baseIds = new Set(baseItems.map((item) => item.id));
  return [...merged, ...savedItems.filter((item) => !baseIds.has(item.id))];
}

export function createLocalDataAdapter({ initialState, storageKey, onChange }) {
  let state = loadState();

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return saved ? mergeState(clone(initialState), saved) : clone(initialState);
    } catch {
      return clone(initialState);
    }
  }

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function commit() {
    persist();
    if (onChange) onChange(state);
  }

  return {
    getState() {
      return state;
    },
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
    save() {
      persist();
    },
  };
}
