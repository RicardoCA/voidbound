import { describe, expect, it } from "vitest";
import { shipModels } from "../fleet/models";
import { shipBlueprints } from "../fleet/shipBlueprints";
import {
  nearbyShowroomPlaque,
  showroomBays,
  showroomPlaque,
  showroomSpawn,
  walkShowroom,
} from "../game/station/showroom";

describe("showroom", () => {
  it("exibe somente naves compráveis e oferece uma placa em cada vaga", () => {
    expect(showroomBays.map(({ id }) => id)).toEqual(
      Object.keys(shipModels).filter((id) => !Object.hasOwn(shipBlueprints, id)),
    );
    for (const bay of showroomBays)
      expect(nearbyShowroomPlaque({ ...showroomSpawn, ...showroomPlaque(bay) }))
        .toBe(bay.id);
  });

  it("bloqueia a travessia da nave e deixa passagem na lateral", () => {
    const bay = showroomBays[0]!;
    const front = { ...showroomSpawn, x: bay.x, z: bay.z + 36 };
    expect(walkShowroom(front, 0, -1, .04).z).toBe(front.z);
    const side = { ...front, x: bay.x - 35 };
    expect(walkShowroom(side, 0, -1, .04).z).toBeLessThan(side.z);
  });
});
