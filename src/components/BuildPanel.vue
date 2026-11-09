<script setup lang="ts">
import ItemIcon from "./ItemIcon.vue";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { buildItems } from "../construction/building";
import HabitatStatus from "./HabitatStatus.vue";
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
  woodDoor:
    "Ocupa 1 × 2 blocos. E, INTERAGIR ou toque para abrir/fechar. Fecha a vedação da casa.",
  solarPanel:
    "Coloque sobre piso ou teto, com céu livre acima. Carrega a bateria mais próxima até 12 blocos; sem bateria, alimenta o gerador diretamente.",
  campfire:
    "Instale sobre chão firme. Use E ou toque na fogueira para assar carne crua.",
  battery:
    "Armazena até 1.200 de energia solar e alimenta o gerador mais próximo até 12 blocos, inclusive à noite. E ou toque mostra a carga.",
  oxygenGenerator:
    "Produz e armazena O₂ usando bateria ou energia solar direta. Recarrega o traje em um cômodo vedado, com paredes de fundo.",
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
        ><ItemIcon item="wood" /> MADEIRA
        <b>{{ g.state.inventory.wood ?? 0 }}</b></span
      >
      <span
        ><ItemIcon item="iron" /> FERRO
        <b>{{ g.state.inventory.iron ?? 0 }}</b></span
      >
    </div>
    <HabitatStatus always />
    <p class="habitat-guide">
      Para recarregar o traje: feche piso, teto e laterais com blocos, preencha
      o fundo com paredes e feche as portas. Deixe pelo menos dois blocos de
      altura no interior. Coloque o gerador dentro e as placas no teto, até 12
      blocos da bateria, e a bateria até 12 blocos do gerador. A bateria
      carregada mantém o gerador durante a noite; sem bateria, as placas
      continuam alimentando o gerador diretamente. Componentes eletrônicos são
      fabricados na nave.
    </p>
    <div class="build-recipes">
      <article v-for="r in constructionRecipes" :key="r.id" class="build-card">
        <div class="build-card-heading">
          <ItemIcon :item="r.id" />
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
          >
            <ItemIcon :item="id" />
            {{ g.state.inventory[id] ?? 0 }}/{{ n }} {{ items[id].name }}
          </span>
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
