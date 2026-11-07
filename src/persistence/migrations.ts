import type { Save } from "../game/types";
export type LegacySave = Omit<Save, "version" | "settlements"> & { version: 1 };
export function migrateSave(data: Save | LegacySave): Save {
  if (data.version === 1) return { ...data, version: 2, settlements: {} };
  if (data.version === 2) return data;
  throw new Error("Versão de salvamento incompatível");
}
