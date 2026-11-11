import { createClient, type Session } from "@supabase/supabase-js";
import { ref } from "vue";
import { database, type StoredSave } from "./database";
import type { StoredGame } from "./migrations";

interface RemoteSave {
  revision: string;
  data: StoredGame;
  updated_at: string;
}

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const supabase = url && key ? createClient(url, key) : undefined;
export const cloudSession = ref<Session | null>(null);
export const cloudStatus = ref("");
export const cloudBusy = ref(false);
const syncConfirmation = "Salvamento sincronizado.";
let confirmationTimer: ReturnType<typeof setTimeout> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

supabase?.auth.onAuthStateChange((_event, session) => {
  if (cloudSession.value?.user.id !== session?.user.id) cloudStatus.value = "";
  cloudSession.value = session;
  if (session) queueCloudSave();
});

export async function readCloudSave(owner: string): Promise<RemoteSave | null> {
  const { data, error } = await supabase!
    .from("voidbound_saves")
    .select("revision,data,updated_at")
    .eq("user_id", owner)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// getRandomValues is also available when the game is opened over HTTP.
export function cloudSaveRevision() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

async function upload(
  owner: string,
  local: StoredSave,
  expected: string | null,
) {
  const revision = cloudSaveRevision();
  const table = supabase!.from("voidbound_saves");
  const changes = { data: local.data, revision };
  if (cloudSession.value?.user.id !== owner) return false;
  if (expected === null) {
    const { error } = await table.insert({ user_id: owner, ...changes });
    if (error?.code === "23505") return false;
    if (error) throw error;
  } else {
    const { data, error } = await table
      .update(changes)
      .eq("user_id", owner)
      .eq("revision", expected)
      .select("revision")
      .maybeSingle();
    if (error) throw error;
    if (!data) return false;
  }
  await database.markSynced(local, owner, revision);
  if (cloudSession.value?.user.id === owner) {
    clearTimeout(confirmationTimer);
    cloudStatus.value = syncConfirmation;
    confirmationTimer = setTimeout(() => {
      if (cloudStatus.value === syncConfirmation) cloudStatus.value = "";
    }, 3000);
  }
  return true;
}

export async function syncLocalToCloud(
  local: StoredSave,
  remote: RemoteSave | null,
) {
  const owner = cloudSession.value?.user.id;
  if (!owner || cloudBusy.value) return false;
  cloudBusy.value = true;
  try {
    const current = await database.localSlot();
    if (current?.stamp !== local.stamp || current?.updated !== local.updated) {
      cloudStatus.value = "O save local mudou. Atualize a comparação.";
      return false;
    }
    const ok = await upload(owner, local, remote?.revision ?? null);
    if (!ok) cloudStatus.value = "A cópia online mudou. Atualize a comparação.";
    return ok;
  } finally {
    cloudBusy.value = false;
  }
}

export async function syncCloudToLocal(remote: RemoteSave, local?: StoredSave) {
  const owner = cloudSession.value?.user.id;
  if (!owner || cloudBusy.value) return false;
  cloudBusy.value = true;
  try {
    const current = await readCloudSave(owner);
    if (
      cloudSession.value?.user.id !== owner ||
      current?.revision !== remote.revision
    ) {
      cloudStatus.value = "A cópia online mudou. Atualize a comparação.";
      return false;
    }
    await database.restoreCloud(remote.data, owner, remote.revision, local);
    cloudStatus.value = "Cópia online disponível neste dispositivo.";
    return true;
  } finally {
    cloudBusy.value = false;
  }
}

async function backgroundSync() {
  const owner = cloudSession.value?.user.id;
  if (!owner) return;
  if (cloudBusy.value) return queueCloudSave();
  cloudBusy.value = true;
  try {
    const local = await database.localSlot();
    if (!local?.cloud?.dirty || local.cloud.owner !== owner) return;
    if (!(await upload(owner, local, local.cloud.revision)))
      cloudStatus.value =
        "A cópia online mudou. Resolva em Nuvem no menu inicial.";
  } catch {
    cloudStatus.value = "Save local preservado. A sincronização está pendente.";
  } finally {
    cloudBusy.value = false;
  }
}

export function queueCloudSave() {
  if (!cloudSession.value || timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    void backgroundSync();
  }, 3000);
}

if (supabase && typeof window !== "undefined") {
  window.addEventListener("online", queueCloudSave);
}
