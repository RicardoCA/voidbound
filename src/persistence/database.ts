import Dexie, { type Table } from "dexie";
import type { Save } from "../game/types";
import { migrateSave, type StoredGame } from "./migrations";
interface StoredSave {
  id: string;
  data: StoredGame;
  updated: number;
}
export class SaveDatabase extends Dexie {
  saves!: Table<StoredSave, string>;
  // Keep the existing database name: old players retain the same save slot.
  constructor(name = "voidbound-v1") {
    super(name);
    this.version(1).stores({ saves: "id,updated" });
    this.version(2)
      .stores({ saves: "id,updated" })
      .upgrade((tx) =>
        tx
          .table<StoredSave>("saves")
          .toCollection()
          .modify((row) => {
            row.data = migrateSave(row.data);
          }),
      );
    this.version(3)
      .stores({ saves: "id,updated" })
      .upgrade((tx) =>
        tx
          .table<StoredSave>("saves")
          .toCollection()
          .modify((row) => {
            row.data = migrateSave(row.data);
          }),
      );
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
    return row ? migrateSave(row.data) : undefined;
  }
}
export const database = new SaveDatabase();
