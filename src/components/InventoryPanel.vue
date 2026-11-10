<script setup lang="ts">
import { isWeaponModule } from "../combat/weapons";
import { isScannerEquipment } from "../combat/shipScanners";
import { isHeatDeflector } from "../universe/stars";
import MeatShelfLife from "./MeatShelfLife.vue";
import ItemIcon from "./ItemIcon.vue";
import TransferAmount from "./TransferAmount.vue";
import { computed, ref } from "vue";
import { items, type Item } from "../game/types";
import { RAW_MEAT_RISK, foodValue } from "../survival/food";
import { BACKPACK_SLOTS, useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { inventoryEntries, slots } from "../inventory/inventory";
import { isBuildItem } from "../construction/building";
const g = useGame(),
  b = useConstruction();
const selected = ref<"ship" | "backpack">("ship");
const fromBackpack = computed(
  () => g.state.mode === "surface" || selected.value === "backpack",
);
const source = computed(() =>
  fromBackpack.value ? g.state.backpack : g.state.inventory,
);
const amount = ref<"1" | "10" | "all">("all");
function use(id: Item) {
  if (isBuildItem(id)) {
    if (g.state.mode === "surface") b.equip(id);
    else g.notify("Saia da nave para equipar uma peça de construção.");
  } else g.use(id, fromBackpack.value);
}
function open(id: string) {
  g.panel = g.panel === id ? "" : id;
}
const inventory = computed(() =>
  inventoryEntries(source.value).filter(([, n]) => n > 0),
);
function canUse(id: Item) {
  return (
    isWeaponModule(id) ||
    isHeatDeflector(id) ||
    isScannerEquipment(id) ||
    [
      "repair",
      "fuel",
      "oxygen",
      "cell",
      "engine",
      "laser",
      "tank",
      "shield",
      "cargo",
      "jump",
      "drill",
    ].includes(id)
  );
}
</script>
<template>
  <section class="dialog">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">{{ g.model.name }}</div>
        <h2>
          {{ fromBackpack ? "Mochila do jogador" : "Carga & equipamentos" }}
        </h2>
      </div>
      <button
        class="close"
        aria-label="Fechar inventário"
        @click="open('inventory')"
      >
        ×
      </button>
    </div>
    <template v-if="g.canAccessShipCargo">
      <div class="station-actions" role="group" aria-label="Inventário">
        <button
          class="secondary"
          :aria-pressed="!fromBackpack"
          @click="selected = 'ship'"
        >
          Carga da nave
        </button>
        <button
          class="secondary"
          :aria-pressed="fromBackpack"
          @click="selected = 'backpack'"
        >
          Mochila
        </button>
      </div>
      <p>
        Transfira itens entre a mochila e o armário de carga. A bancada e o
        mercado usam a carga da nave.
      </p>
      <TransferAmount v-model="amount" />
    </template>
    <div class="inventory-heading">
      <span
        >{{ slots(source) }} /
        {{ fromBackpack ? BACKPACK_SLOTS : g.capacity }} SLOTS</span
      ><span v-if="g.hungerEnabled"
        >FOME {{ Math.ceil(g.state.player.hunger ?? 100) }}%</span
      >
    </div>
    <p v-if="source.rawMeat" class="warning">
      Carne crua tem {{ Math.round(RAW_MEAT_RISK * 100) }}% de chance de
      intoxicação. Asse na fogueira ou guarde na geladeira antes de completar 24
      horas fora dela.
    </p>
    <p v-if="g.sicknessRemaining" class="warning">
      Intoxicação · {{ g.sicknessRemaining }} s
    </p>
    <div class="inventory-grid">
      <button
        v-for="[id, n] in inventory"
        :key="id"
        class="item-cell"
        :style="{ '--item-color': items[id].color }"
        @click="use(id)"
      >
        <ItemIcon :item="id" />
        <b>{{ n }}</b
        ><span>{{ items[id].name }}</span
        ><small>{{
          foodValue(id)
            ? `COMER · +${foodValue(id)} SACIEDADE`
            : isWeaponModule(id)
              ? "INSTALAR ARMA"
              : isBuildItem(id)
                ? "EQUIPAR CONSTRUÇÃO"
                : canUse(id)
                  ? "USAR / INSTALAR"
                  : items[id].rarity
        }}</small>
        <MeatShelfLife
          v-if="id === 'rawMeat'"
          :inventory="source"
          :time="g.state.time"
        />
      </button>
      <div
        v-for="n in Math.max(0, 12 - inventory.length)"
        :key="`empty-${n}`"
        class="empty-cell"
      >
        +
      </div>
    </div>
    <p v-if="!inventory.length" class="empty-message">
      Seu próximo recurso está lá fora. Minere blocos na superfície ou
      asteroides no espaço.
    </p>
    <section
      v-if="g.canAccessShipCargo && inventory.length"
      class="storage-column"
    >
      <h3>
        Transferir para {{ fromBackpack ? "a carga da nave" : "a mochila" }}
      </h3>
      <div v-for="[id, n] in inventory" :key="id" class="storage-row">
        <ItemIcon :item="id" />
        <div>
          <b>{{ items[id].name }}</b
          ><small>{{ n }} unidades</small>
          <MeatShelfLife
            v-if="id === 'rawMeat'"
            :inventory="source"
            :time="g.state.time"
          />
        </div>
        <button
          class="secondary"
          :aria-label="`Transferir ${items[id].name}`"
          @click="
            g.moveCargo(
              fromBackpack,
              id,
              amount === 'all' ? n : Math.min(n, Number(amount)),
            )
          "
        >
          Transferir {{ amount === "all" ? n : Math.min(n, Number(amount)) }}
        </button>
      </div>
    </section>
    <div v-if="!fromBackpack" class="installed">
      MELHORIAS INSTALADAS <span v-if="!g.state.upgrades.length">Nenhuma</span
      ><b v-for="id in g.state.upgrades" :key="id"
        ><ItemIcon :item="id" />{{ items[id].name }}
        <button
          v-if="isWeaponModule(id) && g.canAccessShipCargo"
          class="secondary"
          :disabled="g.trading"
          :aria-label="`Desinstalar ${items[id].name}`"
          @click="g.uninstallWeapon(id)"
        >
          Desinstalar
        </button></b
      >
    </div>
  </section>
</template>
