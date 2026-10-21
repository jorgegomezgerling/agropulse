import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { useAuth } from "./AuthContext";
import type { Membership, Role } from "@/types";

const STORAGE_KEY = "agropulse.activeOrgId";

interface OrgContextValue {
  memberships: Membership[];
  activeOrg: Membership | null;
  role: Role | null;
  canCommand: boolean; // productor u operador
  canEditThresholds: boolean; // solo productor
  loading: boolean;
  error: string | null;
  setActiveOrgId: (organizationId: string) => void;
  reload: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from("memberships")
        .select("organization_id, role, organizations(id, name, region)")
        .eq("user_id", userId);
      if (queryError) throw queryError;

      const list = (data ?? []) as unknown as Membership[];
      list.sort((a, b) =>
        a.organizations.name.localeCompare(b.organizations.name),
      );
      setMemberships(list);

      // Recuperamos el establecimiento elegido la última vez, si sigue siendo válido
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const savedIsValid = list.some((m) => m.organization_id === saved);
      setActiveOrgIdState(
        savedIsValid ? saved : (list[0]?.organization_id ?? null),
      );
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Cada vez que cambia el usuario (login, logout, otro usuario) empezamos de cero
  useEffect(() => {
    setMemberships([]);
    setActiveOrgIdState(null);
    reload();
  }, [reload]);

  const setActiveOrgId = useCallback((organizationId: string) => {
    setActiveOrgIdState(organizationId);
    AsyncStorage.setItem(STORAGE_KEY, organizationId).catch(() => undefined);
  }, []);

  const value = useMemo<OrgContextValue>(() => {
    const activeOrg =
      memberships.find((m) => m.organization_id === activeOrgId) ?? null;
    const role = activeOrg?.role ?? null;
    return {
      memberships,
      activeOrg,
      role,
      canCommand: role === "producer" || role === "operator",
      canEditThresholds: role === "producer",
      loading,
      error,
      setActiveOrgId,
      reload,
    };
  }, [memberships, activeOrgId, loading, error, setActiveOrgId, reload]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const context = useContext(OrgContext);
  if (!context) throw new Error("useOrg debe usarse dentro de <OrgProvider>");
  return context;
}
