import Dexie, { type Table } from "dexie";
import type { Save } from "../game/types";
export class SaveDatabase extends Dexie {
  saves!: Table<{ id: string; data: Save; updated: number }, string>;
  constructor(name = "voidbound-v1") {
    super(name);
    this.version(1).stores({ saves: "id,updated" });
  }
  async write(data: Save) {
    await this.saves.put({
      id: "commander",
      data: structuredClone(JSON.parse(JSON.stringify(data))),
      updated: Date.now(),
    });
  }
  async read() {
    const row = await this.saves.get("commander");
    if (!row) return undefined;
    if (row.data.version !== 1)
      throw new Error("Versão de salvamento incompatível");
    return row.data;
  }
}
export const database = new SaveDatabase();
