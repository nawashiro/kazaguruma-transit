import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

type DraftValidator<T> = (value: unknown) => value is T;

type PendingDraft<T> = {
  key: string;
  draft: T;
};

export type SessionDraftController<T> = {
  draft: T;
  setDraft: Dispatch<SetStateAction<T>>;
  clearDraft: () => void;
};

function getSessionStorage(): Storage | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function loadDraft<T>(
  key: string,
  initialDraft: T,
  isValidDraft: DraftValidator<T>,
): T {
  const storage = getSessionStorage();
  if (storage === null) {
    return initialDraft;
  }

  let serializedDraft: string | null;
  try {
    serializedDraft = storage.getItem(key);
  } catch {
    return initialDraft;
  }

  if (serializedDraft === null) {
    return initialDraft;
  }

  let parsedDraft: unknown;
  try {
    parsedDraft = JSON.parse(serializedDraft) as unknown;
  } catch {
    return initialDraft;
  }

  try {
    return isValidDraft(parsedDraft) ? parsedDraft : initialDraft;
  } catch {
    return initialDraft;
  }
}

function saveDraft<T>(key: string, draft: T): void {
  const storage = getSessionStorage();
  if (storage === null) {
    return;
  }

  let serializedDraft: string | undefined;
  try {
    serializedDraft = JSON.stringify(draft);
  } catch {
    return;
  }

  if (typeof serializedDraft !== "string") {
    return;
  }

  try {
    storage.setItem(key, serializedDraft);
  } catch {
    // Storage errors must not interrupt form input.
  }
}

function removeDraft(key: string): void {
  const storage = getSessionStorage();
  if (storage === null) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Storage errors must not interrupt form input.
  }
}

/**
 * Restores and saves a type-checked draft in the current tab's sessionStorage.
 */
export function useSessionDraft<T>(
  key: string,
  initialDraft: T,
  isValidDraft: DraftValidator<T>,
): SessionDraftController<T> {
  const [draft, setDraft] = useState<T>(initialDraft);
  const initialDraftRef = useRef(initialDraft);
  const validatorRef = useRef(isValidDraft);
  const restoredKeyRef = useRef<string | null>(null);
  const pendingHydrationRef = useRef<PendingDraft<T> | null>(null);
  const hydratedDraftRef = useRef<PendingDraft<T> | null>(null);
  const pendingClearRef = useRef<PendingDraft<T> | null>(null);

  initialDraftRef.current = initialDraft;
  validatorRef.current = isValidDraft;

  useEffect(() => {
    if (restoredKeyRef.current === key) {
      return;
    }

    restoredKeyRef.current = key;
    pendingClearRef.current = null;

    const restoredDraft = loadDraft(
      key,
      initialDraftRef.current,
      validatorRef.current,
    );
    pendingHydrationRef.current = { key, draft: restoredDraft };
    hydratedDraftRef.current = { key, draft: restoredDraft };
    setDraft(restoredDraft);
  }, [key]);

  useEffect(() => {
    if (restoredKeyRef.current !== key) {
      return;
    }

    const pendingClear = pendingClearRef.current;
    if (pendingClear !== null) {
      if (pendingClear.key !== key) {
        pendingClearRef.current = null;
      } else {
        pendingClearRef.current = null;
        if (Object.is(pendingClear.draft, draft)) {
          return;
        }
      }
    }

    const pendingHydration = pendingHydrationRef.current;
    if (pendingHydration !== null) {
      if (pendingHydration.key !== key) {
        pendingHydrationRef.current = null;
      } else {
        if (Object.is(pendingHydration.draft, draft)) {
          pendingHydrationRef.current = null;
        }
        return;
      }
    }

    const hydratedDraft = hydratedDraftRef.current;
    if (hydratedDraft !== null) {
      if (hydratedDraft.key !== key) {
        hydratedDraftRef.current = null;
      } else if (Object.is(hydratedDraft.draft, draft)) {
        return;
      } else {
        hydratedDraftRef.current = null;
      }
    }

    saveDraft(key, draft);
  }, [draft, key]);

  const clearDraft = () => {
    const resetDraft = initialDraftRef.current;
    removeDraft(key);
    pendingHydrationRef.current = null;
    pendingClearRef.current = { key, draft: resetDraft };
    hydratedDraftRef.current = { key, draft: resetDraft };
    setDraft(resetDraft);
  };

  return {
    draft,
    setDraft,
    clearDraft,
  };
}
