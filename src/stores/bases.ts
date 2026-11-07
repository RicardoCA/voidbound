import { defineStore } from "pinia";
import { computed } from "vue";
import { useGame } from "./game";
import { listBases, groupBases } from "../construction/catalog";
export const useBases = defineStore("bases", () => {
  const g = useGame();
  const all = computed(() => listBases(g.state));
  const bySystem = computed(() => groupBases(all.value));
  const currentPlanet = computed(() =>
    all.value.find((base) => base.planet.id === g.planet.id),
  );
  const storedPlanets = computed(
    () => all.value.filter((base) => base.units > 0).length,
  );
  const totalUnits = computed(() =>
    all.value.reduce((sum, base) => sum + base.units, 0),
  );
  return { all, bySystem, currentPlanet, storedPlanets, totalUnits };
});
