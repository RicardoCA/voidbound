<script setup lang="ts">
import { canCraftScanner, isScannerEquipment } from "../combat/shipScanners";
import {
  canCraftWeapon,
  isWeaponModule,
  weaponModules,
} from "../combat/weapons";
import { inventoryEntries } from "../inventory/inventory";
import ItemIcon from "./ItemIcon.vue";
import { computed, ref } from "vue";
import { items, type Item } from "../game/types";
import { recipes } from "../crafting/recipes";
import { useGame } from "../stores/game";
const g = useGame();
function open(id: string) {
  g.panel = g.panel === id ? "" : id;
}
const tab = ref("all"),
  inShip = computed(
    () =>
      g.state.mode === "interior" || g.state.mode === "docked" || g.flightCabin,
  ),
  availableRecipes = computed(() =>
    recipes.filter(
      (r) =>
        tab.value === "all" ||
        (tab.value === "weapons"
          ? isWeaponModule(r.id)
          : !isWeaponModule(r.id) &&
            (tab.value === "upgrades"
              ? r.unlock > 0 || isScannerEquipment(r.id)
              : r.unlock === 0 && !isScannerEquipment(r.id))),
    ),
  );
function affordable(cost: Partial<Record<Item, number>>) {
  return inventoryEntries(cost).every(
    ([id, n]) => (g.state.inventory[id as Item] ?? 0) >= n!,
  );
}
</script>
<template>
  <section class="dialog">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">ENGENHARIA / ESTAÇÃO DE FABRICAÇÃO</div>
        <h2>Construa seu próximo passo.</h2>
      </div>
      <button
        class="close"
        aria-label="Fechar fabricação"
        @click="open('craft')"
      >
        ×
      </button>
    </div>
    <p v-if="!inShip" class="warning">
      Receitas da oficina exigem a nave. Peças de madeira também podem ser
      fabricadas à mão.
    </p>
    <div class="tabs">
      <button :class="{ active: tab === 'all' }" @click="tab = 'all'">
        Todas as receitas</button
      ><button :class="{ active: tab === 'basic' }" @click="tab = 'basic'">
        Suprimentos</button
      ><button
        :class="{ active: tab === 'upgrades' }"
        @click="tab = 'upgrades'"
      >
        Melhorias
      </button>
      <button :class="{ active: tab === 'weapons' }" @click="tab = 'weapons'">
        Armamentos
      </button>
    </div>
    <div class="recipe-list">
      <article v-for="r in availableRecipes" :key="r.id" class="recipe">
        <ItemIcon class="recipe-icon" :item="r.id" />
        <div>
          <h3>{{ items[r.id].name }}</h3>
          <small v-if="isWeaponModule(r.id)">{{
            weaponModules[r.id].description
          }}</small>
          <div class="ingredients">
            <span
              v-for="[id, n] in inventoryEntries(r.cost)"
              :key="id"
              :class="{ missing: (g.state.inventory[id] ?? 0) < n! }"
            >
              <ItemIcon :item="id" />
              {{ g.state.inventory[id] ?? 0 }}/{{ n }} {{ items[id].name }}
            </span>
          </div>
        </div>
        <button
          class="secondary"
          :disabled="
            (!inShip &&
              !(g.state.mode === 'surface' && r.station === 'hand')) ||
            !canCraftWeapon(g.state, r.id) ||
            !canCraftScanner(g.state, r.id) ||
            !affordable(r.cost) ||
            g.state.mission < r.unlock
          "
          @click="g.make(r.id)"
        >
          {{
            !canCraftWeapon(g.state, r.id) || !canCraftScanner(g.state, r.id)
              ? "PROJETO RESTRITO"
              : g.state.mission < r.unlock
                ? "MISSÃO 05"
                : `FABRICAR ${r.amount ?? 1} +`
          }}
        </button>
      </article>
    </div>
  </section>
</template>
