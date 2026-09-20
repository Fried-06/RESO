import { invoke } from "@tauri-apps/api/core";

export interface BackendError {
  code: string;
  message: string;
}

export function formatTauriError(error: unknown): string {
  if (!error) return "Une erreur inattendue est survenue.";

  if (typeof error === "string") {
    try {
      const parsed = JSON.parse(error) as BackendError;
      if (parsed && typeof parsed.message === "string") {
        return parsed.message;
      }
    } catch {
      return error;
    }
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.code === "string") return `Erreur [${obj.code}]`;
  }

  return String(error);
}

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    const formatted = formatTauriError(err);
    throw new Error(formatted);
  }
}
