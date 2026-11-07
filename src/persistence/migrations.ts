import type { Save } from "../game/types";
export type LegacySave = Omit<Save, "version" | "settlements"> & { version: 1 };
export type SaveV2 = Omit<Save, "version"> & { version: 2 };
export type StoredGame = Save | SaveV2 | LegacySave;
export function migrateSave(data: StoredGame): Save {
  if (data.version === 1) return { ...data, version: 3, settlements: {} };
  if (data.version === 2) return { ...data, version: 3 };
  if (data.version === 3) return data;
  throw new Error("Versão de salvamento incompatível");
}
