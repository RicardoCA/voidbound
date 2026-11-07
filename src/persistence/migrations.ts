import type { Save } from "../game/types";
import { INITIAL_CREDITS } from "../economy/market";

export type SaveV3 = Omit<
  Save,
  | "version"
  | "credits"
  | "marketStocks"
  | "activeShip"
  | "parkedShips"
  | "nextShipId"
> & { version: 3 };
export type SaveV2 = Omit<SaveV3, "version"> & { version: 2 };
export type LegacySave = Omit<SaveV3, "version" | "settlements"> & {
  version: 1;
};
type FleetFields = Pick<Save, "activeShip" | "parkedShips" | "nextShipId">;
// Local builds added credits to v4 before introducing the fleet fields.
type SaveV4 = Omit<Save, keyof FleetFields> & Partial<FleetFields>;
export type StoredGame = SaveV4 | SaveV3 | SaveV2 | LegacySave;

export function migrateSave(data: StoredGame): Save {
  switch (data.version) {
    case 4:
      return {
        ...data,
        activeShip: data.activeShip ?? { id: "ship-1", model: "sparrow" },
        parkedShips: data.parkedShips ?? [],
        nextShipId: data.nextShipId ?? 2,
      };
    case 1:
    case 2:
    case 3:
      return {
        ...data,
        version: 4,
        settlements: data.version === 1 ? {} : data.settlements,
        credits: INITIAL_CREDITS,
        marketStocks: {},
        activeShip: { id: "ship-1", model: "sparrow" },
        parkedShips: [],
        nextShipId: 2,
      };
    default:
      throw new Error("Versão de salvamento incompatível");
  }
}
