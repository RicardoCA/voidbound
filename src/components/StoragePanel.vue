<script setup lang="ts">
import InventoryTransfer from "./InventoryTransfer.vue";
import { BACKPACK_SLOTS, useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { items } from "../game/types";
const g = useGame(),
  b = useConstruction();
</script>
<template>
  <section class="dialog storage-panel">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">ARMAZENAMENTO LOCAL / {{ g.planet.name }}</div>
        <h2>{{ items[b.containerKind ?? "cabinet"].name }}</h2>
      </div>
      <button class="close" aria-label="Fechar armário" @click="g.panel = ''">
        ×
      </button>
    </div>
    <p v-if="b.containerKind === 'fridge'">
      {{
        b.fridgePowered
          ? "Geladeira ligada. A validade da carne está pausada."
          : "Geladeira desligada. A carne continua envelhecendo. Verifique as placas solares e baterias próximas."
      }}
    </p>
    <p v-else>
      Os itens ficam neste armário, neste planeta, mesmo quando você decola ou
      fecha o jogo.
    </p>
    <button class="text-button" @click="g.panel = 'bases'">
      Ver meus depósitos em todos os planetas →
    </button>
    <InventoryTransfer
      v-if="b.container"
      :left="g.state.backpack"
      :right="b.container"
      :left-capacity="BACKPACK_SLOTS"
      :right-capacity="b.containerCapacity"
      left-title="Sua mochila"
      :right-title="items[b.containerKind ?? 'cabinet'].name"
      :time="g.state.time"
      :refrigerated="b.containerKind === 'fridge'"
      :cooling="b.fridgePowered"
      :allowed="
        (fromLeft, item) =>
          !fromLeft || b.containerKind !== 'fridge' || item === 'rawMeat'
      "
      :move="
        (fromLeft, item, quantity) =>
          b.moveItem(fromLeft ? 'deposit' : 'withdraw', item, quantity)
      "
    />
    <p v-else class="warning">
      Armário indisponível. Volte à superfície e abra um armário próximo.
    </p>
  </section>
</template>

<style scoped>
.storage-panel {
  width: min(1080px, 100%);
}
</style>
