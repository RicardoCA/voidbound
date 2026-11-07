<script setup lang="ts">
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
    () => g.state.mode === "interior" || g.state.mode === "docked",
  ),
  availableRecipes = computed(() =>
    recipes.filter(
      (r) =>
        tab.value === "all" ||
        (tab.value === "upgrades" ? r.unlock > 0 : r.unlock === 0),
    ),
  );
function affordable(cost: Partial<Record<Item, number>>) {
  return Object.entries(cost).every(
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
    </div>
    <div class="recipe-list">
      <article v-for="r in availableRecipes" :key="r.id" class="recipe">
        <span class="recipe-icon" :style="{ color: items[r.id].color }">{{
          items[r.id].icon
        }}</span>
        <div>
          <h3>{{ items[r.id].name }}</h3>
          <div class="ingredients">
            <span
              v-for="(n, id) in r.cost"
              :key="id"
              :class="{ missing: (g.state.inventory[id] ?? 0) < n! }"
              >{{ g.state.inventory[id] ?? 0 }}/{{ n }}
              {{ items[id].name }}</span
            >
          </div>
        </div>
        <button
          class="secondary"
          :disabled="
            (!inShip &&
              !(g.state.mode === 'surface' && r.station === 'hand')) ||
            !affordable(r.cost) ||
            g.state.mission < r.unlock
          "
          @click="g.make(r.id)"
        >
          {{
            g.state.mission < r.unlock
              ? "MISSÃO 05"
              : `FABRICAR ${r.amount ?? 1} +`
          }}
        </button>
      </article>
    </div>
  </section>
</template>
