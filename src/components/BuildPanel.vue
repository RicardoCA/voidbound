<script setup lang="ts">
import { inventoryEntries } from "../inventory/inventory";
import ItemIcon from "./ItemIcon.vue";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { buildItems } from "../construction/building";
import HabitatStatus from "./HabitatStatus.vue";
import { items, type Item } from "../game/types";
import { facilityDefinitions } from "../construction/facilityTypes";
import { recipes } from "../crafting/recipes";
import { treeNames } from "../game/procedural/trees";
const g = useGame(),
  b = useConstruction();
const descriptions = {
  ...Object.fromEntries(Object.entries(facilityDefinitions).map(([id, spec]) => [id, spec.description])),
  stoneWall: "Parede de fundo feita de pedra minerada em planetas rochosos.",
  metalWall: "Parede de fundo feita de placas metálicas.",
  fridge:
    "Guarda carne crua em 16 slots. Precisa de energia de placas solares ou baterias próximas para refrigerar.",
  picture: "Decoração. Instale em uma parede de fundo.",
  table: "Mesa decorativa. Instale sobre chão firme.",
  bed: "Use E ou toque para dormir e avançar 8 horas locais.",
  woodBlock: "Piso, fundação, pilares e telhado. Bloco sólido.",
  woodWall: "Fundo da casa. Você pode andar à frente da parede.",
  woodStairs: "Degraus que você sobe caminhando. Inverta a direção com R.",
  stickLadder:
    "Empilhe na vertical. Use E ou toque para se apoiar. Suba e desça com W/S, setas ou o joystick.",
  woodHatch:
    "Instale no piso acima da escada. Use E ou toque para abrir e passar entre andares.",
  cabinet:
    "16 slots de armazenamento exclusivo deste planeta. E ou toque abre.",
  cabinetDouble:
    "Ocupa 2 blocos de largura e guarda 32 slots. E ou toque abre.",
  cabinetTriple:
    "Ocupa 3 blocos de largura e guarda 48 slots. E ou toque abre.",
  workbench: "Ocupa 2 blocos de largura. Instale sobre chão firme e interaja para fabricar itens usando apenas os materiais da mochila. Não acessa a carga da nave nem os armários.",
  floodlight: "Ilumina de verdade o terreno. Instale sobre chão firme e gire para apontar. Usa 2 de energia/s de placas expostas ou baterias a até 12 blocos.",
  emergencyLight: "Instale junto à saída. Carrega sua reserva na rede a até 12 blocos; sem energia, acende automaticamente. A reserva cheia dura 20 minutos ativos. Recarga completa: 2 minutos de alimentação. Instale e carregue antes de usar.",
  window: "Vidro transparente e vedado. Instale em um vão sem parede nem bloco de madeira. Use Girar para alinhar ao cômodo.",
  airlockDoor: "Monte duas portas alinhadas, separadas por 1 a 5 blocos, no mesmo piso, cercando uma câmara vedada. Ao abrir uma, a parceira fecha. A sala principal permanece pressurizada.",
  woodDoor:
    "Ocupa 1 × 2 blocos. E, INTERAGIR ou toque para abrir/fechar. Fecha a vedação da casa.",
  solarPanel:
    "Coloque sobre piso ou teto, com céu livre acima. Carrega a bateria mais próxima até 12 blocos; sem bateria, alimenta o gerador diretamente.",
  campfire:
    "Instale sobre chão firme. Use E ou toque na fogueira para assar carne crua.",
  battery:
    "Armazena até 1.200 de energia solar e alimenta o gerador mais próximo até 12 blocos, inclusive à noite. E ou toque mostra a carga.",
  planetaryOxygenGenerator:
    "Fornece oxigênio em toda a superfície enquanto houver energia. Instale 5 placas solares expostas e uma bateria a até 12 blocos.",
  oxygenGenerator:
    "Produz e armazena O₂ usando bateria ou energia solar direta. Recarrega o traje em um cômodo vedado, com paredes de fundo.",
};
const constructionRecipes = buildItems.map((id) =>
  recipes.find((r) => r.id === id)!,
);
function affordable(cost: Partial<Record<Item, number>>) {
  return inventoryEntries(cost).every(
    ([id, n]) => (g.state.backpack[id as Item] ?? 0) >= n!,
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
        <b>{{ g.state.backpack.wood ?? 0 }}</b></span
      >
      <span
        ><ItemIcon item="iron" /> FERRO
        <b>{{ g.state.backpack.iron ?? 0 }}</b></span
      >
    </div>
    <HabitatStatus always />
    <p class="habitat-guide">
      Para recarregar o traje: feche piso, teto e todas as laterais, sem vãos,
      usando blocos, paredes e janelas vedadas. Instale janelas somente nos
      espaços livres da estrutura. Para uma antecâmara, construa um pequeno
      cômodo fechado entre duas portas de antecâmara alinhadas; o intertravamento
      fecha uma antes de abrir a outra. Deixe pelo menos dois blocos de altura
      no interior. Coloque o gerador dentro e as placas no teto, até 12
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
            <small>{{ g.state.backpack[r.id] ?? 0 }} na mochila</small>
          </div>
        </div>
        <p>{{ descriptions[r.id as keyof typeof descriptions] }}</p>
        <div class="ingredients">
          <span
            v-for="[id, n] in inventoryEntries(r.cost)"
            :key="id"
            :class="{ missing: (g.state.backpack[id] ?? 0) < n! }"
          >
            <ItemIcon :item="id" />
            {{ g.state.backpack[id] ?? 0 }}/{{ n }} {{ items[id].name }}
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
