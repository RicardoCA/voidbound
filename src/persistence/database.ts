import Dexie, { type Table } from "dexie";
import type { Save } from "../game/types";
import { migrateSave, type StoredGame } from "./migrations";
export interface CloudLink {
  owner: string;
  revision: string;
  dirty: boolean;
}
export interface StoredSave {
  id: string;
  data: StoredGame;
  updated: number;
  stamp?: string;
  cloud?: CloudLink;
}
export class SaveDatabase extends Dexie {
  saves!: Table<StoredSave, string>;
  // Keep the existing database name: old players retain the same save slot.
  constructor(name = "voidbound-v1") {
    super(name);
    this.version(1).stores({ saves: "id,updated" });
    this.version(2).stores({ saves: "id,updated" });
    this.version(3).stores({ saves: "id,updated" });
    this.version(4)
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
    const snapshot = JSON.parse(JSON.stringify(data)) as Save;
    await this.transaction("rw", this.saves, async () => {
      const previous = await this.localSlot();
      await this.saves.put({
        id: "commander",
        data: snapshot,
        updated: Date.now(),
        stamp: String(Math.random()),
        ...(previous?.cloud && { cloud: { ...previous.cloud, dirty: true } }),
      });
    });
  }
  localSlot() {
    return this.saves.get("commander");
  }
  async markSynced(previous: StoredSave, owner: string, revision: string) {
    await this.transaction("rw", this.saves, async () => {
      const current = await this.localSlot();
      if (
        !current ||
        current.cloud?.owner !== previous.cloud?.owner ||
        current.cloud?.revision !== previous.cloud?.revision
      )
        return;
      const dirty =
        current.stamp !== previous.stamp ||
        current.updated !== previous.updated;
      await this.saves.update("commander", {
        cloud: { owner, revision, dirty },
      });
    });
  }
  async restoreCloud(
    data: StoredGame,
    owner: string,
    revision: string,
    previous?: StoredSave,
  ) {
    const snapshot = migrateSave(
      JSON.parse(JSON.stringify(data)) as StoredGame,
    );
    await this.transaction("rw", this.saves, async () => {
      const current = await this.localSlot();
      if (
        current?.stamp !== previous?.stamp ||
        current?.updated !== previous?.updated
      )
        throw new Error(
          "O save local mudou. Atualize a comparação e tente novamente.",
        );
      await this.saves.put({
        id: "commander",
        data: snapshot,
        updated: Date.now(),
        stamp: String(Math.random()),
        cloud: { owner, revision, dirty: false },
      });
    });
  }
  async read() {
    const row = await this.localSlot();
    return row ? migrateSave(row.data) : undefined;
  }
}
export const database = new SaveDatabase();
