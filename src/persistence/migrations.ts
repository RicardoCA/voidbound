import { systemAt } from "../universe/generator";
import type { Save } from "../game/types";
import { newProgression } from "../progression/careers";
import { INITIAL_CREDITS } from "../economy/market";

type StoredPlayer = Omit<Save["player"], "hunger"> & { hunger?: number };
type SaveWithoutRequiredHunger = Omit<
  Save,
  "player" | "progression" | "backpack"
> & {
  player: StoredPlayer;
  progression?: Save["progression"];
  backpack?: Save["backpack"];
};

export type SaveV3 = Omit<
  SaveWithoutRequiredHunger,
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
type SaveV4 = Omit<SaveWithoutRequiredHunger, keyof FleetFields> &
  Partial<FleetFields>;
export type StoredGame = SaveV4 | SaveV3 | SaveV2 | LegacySave;

function restoreProgression(data: StoredGame) {
  const progression = { ...newProgression(), ...data.progression };
  for (const [id, contract] of Object.entries(progression.contracts)) {
    if (contract.status !== "ACTIVE") continue;
    const issuer = systemAt(data.seed, contract.sector.x, contract.sector.y);
    if (issuer.station?.id !== contract.stationId) continue;
    const pirate = contract.career === "pirate";
    if (pirate === (issuer.station.kind === "clandestine")) continue;
    const destination = systemAt(data.seed, pirate ? 1 : 0, 0);
    progression.contracts = {
      ...progression.contracts,
      [id]: {
        ...contract,
        stationId: destination.station!.id,
        sector: { x: destination.x, y: destination.y },
      },
    };
  }
  return progression;
}

export function migrateSave(data: StoredGame): Save {
  switch (data.version) {
    case 4:
      return {
        ...data,
        backpack: data.backpack ?? {},
        progression: restoreProgression(data),
        player: { ...data.player, hunger: data.player.hunger ?? 100 },
        activeShip: data.activeShip ?? { id: "ship-1", model: "sparrow" },
        parkedShips: data.parkedShips ?? [],
        nextShipId: data.nextShipId ?? 2,
      };
    case 1:
    case 2:
    case 3:
      return {
        ...data,
        backpack: data.backpack ?? {},
        progression: restoreProgression(data),
        player: { ...data.player, hunger: data.player.hunger ?? 100 },
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
