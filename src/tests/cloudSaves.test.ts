import "fake-indexeddb/auto";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { cloudSaveRevision } from "../persistence/cloudSaves";
import { SaveDatabase } from "../persistence/database";
import { useGame } from "../stores/game";

describe("vínculo local do save na nuvem", () => {
  it("gera uma revisão UUID válida quando randomUUID não existe em HTTP", () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal("crypto", { getRandomValues });
    try {
      const revision = cloudSaveRevision();
      expect(revision).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(cloudSaveRevision()).not.toBe(revision);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("preserva um salvamento feito enquanto a cópia anterior está sendo enviada", async () => {
    setActivePinia(createPinia());
    const save = useGame().state;
    const db = new SaveDatabase(`cloud-${crypto.randomUUID()}`);
    try {
      await db.write(save);
      const first = (await db.localSlot())!;
      await db.markSynced(first, "account", "rev1");
      save.credits = 800;
      await db.write(save);
      const pending = (await db.localSlot())!;
      save.credits = 900;
      await db.write(save);
      await db.markSynced(pending, "account", "rev2");
      expect(await db.localSlot()).toMatchObject({
        data: { credits: 900 },
        cloud: { owner: "account", revision: "rev2", dirty: true },
      });
    } finally {
      await db.delete();
    }
  });

  it("só substitui o save local se a cópia comparada ainda for a atual", async () => {
    setActivePinia(createPinia());
    const save = useGame().state;
    const db = new SaveDatabase(`cloud-${crypto.randomUUID()}`);
    try {
      await db.write(save);
      const previous = await db.localSlot();
      save.credits = 1200;
      await db.write(save);
      await expect(
        db.restoreCloud(save, "account", "rev1", previous),
      ).rejects.toThrow("save local mudou");
      const current = await db.localSlot();
      const remote = reactive({ ...save, credits: 2100 });
      await db.restoreCloud(remote, "account", "rev2", current);
      expect(await db.localSlot()).toMatchObject({
        data: { credits: 2100 },
        cloud: { owner: "account", revision: "rev2", dirty: false },
      });
    } finally {
      await db.delete();
    }
  });
});
