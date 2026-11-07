<script setup lang="ts">
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { buildItems } from "../construction/building";
import { items, type Item } from "../game/types";
import { recipes } from "../crafting/recipes";
import { treeNames } from "../game/procedural/trees";
const g = useGame(),
  b = useConstruction();
const descriptions = {
  woodBlock: "Piso, fundação, pilares e telhado. Bloco sólido.",
  woodWall: "Fundo da casa. Você pode andar à frente da parede.",
  woodStairs: "Degraus que você sobe caminhando. Inverta a direção com R.",
  cabinet:
    "16 slots de armazenamento exclusivo deste planeta. E ou toque abre.",
};
const constructionRecipes = buildItems.map((id) =>
  recipes.find((r) => r.id === id)!,
);
function affordable(cost: Partial<Record<Item, number>>) {
  return Object.entries(cost).every(
    ([id, n]) => (g.state.inventory[id as Item] ?? 0) >= n!,
  );
}
</script>
<template>
  <section class="dialog build-panel">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">OFICINA DE CAMPO / {{ g.planet.name }}</div>
        <h2>Um lugar para chamar de seu.</h2>
      </div>
      <button
        class="close"
        aria-label="Fechar construção"
        @click="g.panel = ''"
      >
        ×
      </button>
    </div>
    <p>
      Corte os troncos com a multitool para coletar madeira. Neste planeta:
      <b>{{ treeNames[g.planet.kind] }}</b
      >. As peças abaixo podem ser fabricadas à mão na superfície.
    </p>
    <div class="build-materials">
      <span
        >▥ MADEIRA <b>{{ g.state.inventory.wood ?? 0 }}</b></span
      ><span
        >◆ FERRO <b>{{ g.state.inventory.iron ?? 0 }}</b></span
      >
    </div>
    <div class="build-recipes">
      <article v-for="r in constructionRecipes" :key="r.id" class="build-card">
        <div class="build-card-heading">
          <span :style="{ color: items[r.id].color }">{{
            items[r.id].icon
          }}</span>
          <div>
            <h3>{{ items[r.id].name }}</h3>
            <small>{{ g.state.inventory[r.id] ?? 0 }} na carga</small>
          </div>
        </div>
        <p>{{ descriptions[r.id as keyof typeof descriptions] }}</p>
        <div class="ingredients">
          <span
            v-for="(n, id) in r.cost"
            :key="id"
            :class="{ missing: (g.state.inventory[id] ?? 0) < n! }"
            >{{ g.state.inventory[id] ?? 0 }}/{{ n }} {{ items[id].name }}</span
          >
        </div>
        <div class="build-card-actions">
          <button
            class="secondary"
            :disabled="!affordable(r.cost)"
            @click="g.make(r.id)"
          >
            FABRICAR {{ r.amount ?? 1 }}</button
          ><button class="primary" @click="b.equip(r.id as typeof b.selected)">
            EQUIPAR
          </button>
        </div>
      </article>
    </div>
    <p class="build-instructions">
      Coloque peças ao alcance de 6 blocos, conectadas ao terreno ou à sua casa.
      Toque no mundo para construir. Paredes ocupam a camada de fundo. Desmontar
      devolve a peça; esvazie armários antes de removê-los. Construções, árvores
      cortadas e conteúdo dos armários são salvos por planeta.
    </p>
  </section>
</template>
