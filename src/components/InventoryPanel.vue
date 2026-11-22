<script setup lang="ts">
import { isWeaponModule } from "../combat/weapons";
import { isScannerEquipment } from "../combat/shipScanners";
import { isHeatDeflector, isPhotonSaber } from "../universe/stars";
import { cartridgeCount } from "../survival/autoOxygen";
import { feederCount } from "../survival/autoFeeder";
import InventoryBrowser from "./InventoryBrowser.vue";
import InventoryTransfer from "./InventoryTransfer.vue";
import MeatShelfLife from "./MeatShelfLife.vue";
import ItemIcon from "./ItemIcon.vue";
import TransferAmount from "./TransferAmount.vue";
import QuickSlotPicker from "./QuickSlotPicker.vue";
import { computed, ref } from "vue";
import { items, type Item } from "../game/types";
import { foodValue } from "../survival/food";
import { BACKPACK_SLOTS, useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { inventoryEntries } from "../inventory/inventory";
import { isBuildItem } from "../construction/building";
import { tileForItem } from "../game/procedural/terrain";
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
  if (id === "bucket") {
    if (fromBackpack.value && g.state.mode === "surface") b.equip(id);
    else g.notify("Leve o balde na mochila e equipe-o na superfície.");
  } else if (isBuildItem(id)) {
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
      "autoFeeder",
      "autoOxygen",
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
function actionLabel(id: Item) {
  if (id === "bucket") return "Equipar balde";
  if (isPhotonSaber(id))
    return g.equippedSaber === id ? "Guardar sabre" : "Equipar sabre";
  if (foodValue(id)) return "Comer 1 unidade";
  if (isBuildItem(id)) return "Equipar construção";
  if (id === "autoFeeder" || id === "autoOxygen") return "Equipar no traje";
  if (shipEquipment(id)) return "Instalar na nave";
  return canUse(id) ? "Usar 1 unidade" : "";
}
function shipEquipment(id: Item) {
  return (
    isWeaponModule(id) ||
    isHeatDeflector(id) ||
    isScannerEquipment(id) ||
    ["engine", "laser", "tank", "shield", "cargo", "jump", "drill"].includes(id)
  );
}
function actionHint(id: Item) {
  if (id === "bucket") return "Equipe e toque ou clique na água para coletar.";
  if (shipEquipment(id)) return "Instale este equipamento no interior da nave.";
  if (isBuildItem(id))
    return "Equipe e escolha onde colocar a peça na superfície.";
  if (isPhotonSaber(id))
    return "Use na exploração para cortar árvores, blocos e atacar animais.";
  if (tileForItem(id) !== undefined && fromBackpack.value)
    return "Vincule a um slot rápido para colocar este material como bloco na superfície.";
  if (id === "emptyOxygenCartridge")
    return "Abasteça em um gerador de oxigênio ativo.";
  if (id === "oxygenCartridge")
    return "Guarde no reabastecedor automático do traje para recuperar oxigênio.";
  if (foodValue(id))
    return !g.hungerEnabled
      ? "A fome está desativada nas opções."
      : (g.state.player.hunger ?? 100) >= 100
        ? "Você já está alimentado."
        : "Consome uma unidade deste inventário.";
  if (id === "autoFeeder")
    return "Guarda alimentos e recupera a fome automaticamente abaixo de 30%.";
  if (id === "autoOxygen")
    return "Guarda cartuchos cheios e recupera o oxigênio automaticamente abaixo de 30%.";
  return canUse(id)
    ? "Usa uma unidade do item selecionado."
    : "Material para fabricação ou comércio. Guarde na nave ou em um depósito para liberar espaço.";
}
function actionDisabled(id: Item) {
  return (
    (shipEquipment(id) && !g.canAccessShipCargo) ||
    (id === "bucket" && (!fromBackpack.value || g.state.mode !== "surface")) ||
    (isBuildItem(id) && g.state.mode !== "surface") ||
    (!!foodValue(id) &&
      (!g.hungerEnabled || (g.state.player.hunger ?? 100) >= 100))
  );
}
</script>
<template>
  <section class="dialog inventory-dialog">
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
    <InventoryTransfer
      v-if="g.canAccessShipCargo"
      :left="g.state.backpack"
      :right="g.state.inventory"
      :left-capacity="BACKPACK_SLOTS"
      :right-capacity="g.capacity"
      left-title="Mochila do jogador"
      :right-title="`Carga da nave · ${g.model.name}`"
      :time="g.state.time"
      :move="
        (fromLeft, item, quantity) => g.moveCargo(fromLeft, item, quantity)
      "
      :use-label="
        (id) =>
          foodValue(id)
            ? 'Comer'
            : id === 'bucket' || isBuildItem(id) || isPhotonSaber(id) || canUse(id)
              ? 'Usar / equipar'
              : ''
      "
      @select="(fromLeft) => (selected = fromLeft ? 'backpack' : 'ship')"
      @use="
        (fromLeft, id) => {
          selected = fromLeft ? 'backpack' : 'ship';
          use(id);
        }
      "
    >
      <template #actions="{ item, fromLeft }">
        <QuickSlotPicker v-if="fromLeft" :item="item" />
      </template>
    </InventoryTransfer>
    <InventoryBrowser
      v-if="!g.canAccessShipCargo"
      :inventory="source"
      :capacity="fromBackpack ? BACKPACK_SLOTS : g.capacity"
      :time="g.state.time"
      :equipped="g.equippedSaber"
      :action-label="actionLabel"
      :action-hint="actionHint"
      :action-disabled="actionDisabled"
      @use="use"
    >
      <template #actions="{ item }">
        <QuickSlotPicker v-if="fromBackpack" :item="item" />
        <button
          v-if="g.state.player.autoFeeder && foodValue(item)"
          class="secondary"
          :disabled="feederCount(g.state.player.autoFeeder.food) >= 100"
          @click="
            g.moveFeeder(
              item,
              Math.min(
                source[item] ?? 0,
                100 - feederCount(g.state.player.autoFeeder.food),
              ),
              true,
              fromBackpack,
            )
          "
        >
          Abastecer alimentador
        </button>
        <button
          v-if="g.state.player.autoOxygen && item === 'oxygenCartridge'"
          class="secondary"
          :disabled="cartridgeCount(g.state.player.autoOxygen.cartridges) >= 10"
          @click="
            g.moveAutoOxygen(
              item,
              Math.min(
                source[item] ?? 0,
                10 - cartridgeCount(g.state.player.autoOxygen.cartridges),
              ),
              true,
              fromBackpack,
            )
          "
        >
          Abastecer reabastecedor
        </button>
      </template>
    </InventoryBrowser>
    <p v-if="g.sicknessRemaining" class="warning">
      Intoxicação · {{ g.sicknessRemaining }} s
    </p>
    <details v-if="g.state.player.autoOxygen" class="suit-device">
      <summary>
        Reabastecedor equipado ·
        {{ cartridgeCount(g.state.player.autoOxygen.cartridges) }}/10 cartuchos
      </summary>
      <p>
        {{ cartridgeCount(g.state.player.autoOxygen.cartridges) }}/10 cartuchos.
        Abaixo de 30% de O₂, usa um cartucho cheio para chegar a 100%. O
        recipiente vazio fica guardado para reutilização.
      </p>
      <TransferAmount v-model="amount" />
      <div
        v-for="id in ['oxygenCartridge', 'emptyOxygenCartridge'] as const"
        :key="id"
        class="storage-row"
      >
        <ItemIcon :item="id" />
        <div>
          {{ items[id].name }} ·
          {{ g.state.player.autoOxygen.cartridges[id] ?? 0 }}
        </div>
        <button
          class="secondary"
          :disabled="!g.state.player.autoOxygen.cartridges[id]"
          @click="
            g.moveAutoOxygen(
              id,
              amount === 'all'
                ? (g.state.player.autoOxygen.cartridges[id] ?? 0)
                : Math.min(
                    g.state.player.autoOxygen.cartridges[id] ?? 0,
                    Number(amount),
                  ),
              false,
              fromBackpack,
            )
          "
        >
          Retirar
        </button>
      </div>
      <div class="storage-row">
        <div>
          Cartuchos cheios disponíveis: {{ source.oxygenCartridge ?? 0 }}
        </div>
        <button
          class="secondary"
          :disabled="
            !source.oxygenCartridge ||
            cartridgeCount(g.state.player.autoOxygen.cartridges) >= 10
          "
          @click="
            g.moveAutoOxygen(
              'oxygenCartridge',
              amount === 'all'
                ? (source.oxygenCartridge ?? 0)
                : Math.min(source.oxygenCartridge ?? 0, Number(amount)),
              true,
              fromBackpack,
            )
          "
        >
          Abastecer
        </button>
      </div>
      <button
        class="secondary"
        :disabled="cartridgeCount(g.state.player.autoOxygen.cartridges) > 0"
        @click="g.toggleAutoOxygen(fromBackpack)"
      >
        Desequipar (retire os cartuchos)
      </button>
    </details>
    <details v-if="g.state.player.autoFeeder" class="suit-device">
      <summary>
        Alimentador equipado ·
        {{ feederCount(g.state.player.autoFeeder.food) }}/100 alimentos
      </summary>
      <p>
        Reserva {{ feederCount(g.state.player.autoFeeder.food) }}/100. Abaixo de
        30% de fome, come até 100% ou até acabar a reserva. Um tipo de alimento
        por vez.
      </p>
      <TransferAmount v-model="amount" />
      <div
        v-for="[id, n] in inventoryEntries(
          g.state.player.autoFeeder.food,
        ).filter(([, n]) => n > 0)"
        :key="id"
        class="storage-row"
      >
        <ItemIcon :item="id" />
        <div>
          {{ items[id].name }} · {{ n }}
          <MeatShelfLife
            v-if="id === 'rawMeat'"
            :inventory="g.state.player.autoFeeder.food"
            :time="g.state.time"
          />
        </div>
        <button
          class="secondary"
          @click="
            g.moveFeeder(
              id,
              amount === 'all' ? n : Math.min(n, Number(amount)),
              false,
              fromBackpack,
            )
          "
        >
          Retirar
        </button>
      </div>
      <div
        v-for="[id, n] in inventory.filter(([id]) => foodValue(id) > 0)"
        :key="id"
        class="storage-row"
      >
        <ItemIcon :item="id" />
        <div>{{ items[id].name }} · {{ n }}</div>
        <button
          class="secondary"
          :disabled="feederCount(g.state.player.autoFeeder.food) >= 100"
          @click="
            g.moveFeeder(
              id,
              amount === 'all' ? n : Math.min(n, Number(amount)),
              true,
              fromBackpack,
            )
          "
        >
          Abastecer
        </button>
      </div>
      <p v-if="g.state.player.autoFeeder.food.rawMeat" class="warning">
        Carne crua também pode causar intoxicação no alimentador.
      </p>
      <button
        class="secondary"
        :disabled="feederCount(g.state.player.autoFeeder.food) > 0"
        @click="g.toggleFeeder(fromBackpack)"
      >
        Desequipar (esvazie a reserva)
      </button>
    </details>
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

<style scoped>
.inventory-dialog {
  width: min(1080px, 100%);
}
.suit-device {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid #344b58;
  background: #0e1b28;
}
.suit-device summary {
  cursor: pointer;
  font-size: 13px;
  color: #a5d7ce;
  min-height: 28px;
}
</style>
