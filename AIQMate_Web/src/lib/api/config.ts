// SPEC-036 FR-WEB-023. Per-deployment settings, read once at start from api-service.

import { useQuery } from "@tanstack/react-query";
import { apiFetch, setAuthMode, type AuthMode } from "./client";

export interface PortalConfig {
  authMode: AuthMode;
  environment: "local" | "dev" | "stage" | "prod";
  showUnbuilt: boolean;
  branding: { customerName: string | null; logoUrl: string | null };
}

export async function fetchConfig(): Promise<PortalConfig> {
  const config = await apiFetch<PortalConfig>("/web-auth/config", { skipAuthRedirect: true });
  setAuthMode(config.authMode === "dev" ? "dev" : "entra");
  return config;
}

export function useConfigQuery() {
  return useQuery({ queryKey: ["config"], queryFn: fetchConfig, staleTime: Infinity, retry: 1 });
}

/** For components rendered under ConfigGate, where the config is known to be loaded. */
export function useConfig(): PortalConfig {
  const { data } = useConfigQuery();
  if (!data) throw new Error("useConfig used outside ConfigGate");
  return data;
}
