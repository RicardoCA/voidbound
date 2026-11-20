<script setup lang="ts">
import { computed, ref } from "vue";
import { items, type Inventory, type Item } from "../game/types";
import { inventoryEntries, slots } from "../inventory/inventory";
import { transferable, transferList } from "../inventory/transfer";
import { filterInventory } from "../inventory/presentation";
import ItemIcon from "./ItemIcon.vue";
import MeatShelfLife from "./MeatShelfLife.vue";
const props = defineProps<{
  left: Inventory;
  right: Inventory;
  leftCapacity: number;
  rightCapacity: number;
  leftTitle: string;
  rightTitle: string;
  time: number;
  move: (fromLeft: boolean, item: Item, quantity: number) => boolean;
  allowed?: (fromLeft: boolean, item: Item) => boolean;
  refrigerated?: boolean;
  cooling?: boolean;
  useLabel?: (item: Item) => string;
}>();
const emit = defineEmits<{
  select: [fromLeft: boolean, item: Item];
  use: [fromLeft: boolean, item: Item];
}>();
const selection = ref<{ fromLeft: boolean; item: Item }>();
const search = ref("");
const category = ref("all");
const sort = ref("name");
const status = ref("");
const moved = ref("");
let dragging: { fromLeft: boolean; item: Item } | undefined;
const columns = computed(() => [
  {
    fromLeft: true,
    data: props.left,
    capacity: props.leftCapacity,
    title: props.leftTitle,
  },
  {
    fromLeft: false,
    data: props.right,
    capacity: props.rightCapacity,
    title: props.rightTitle,
  },
]);
function entries(data: Inventory) {
  return filterInventory(data, search.value, category.value, sort.value);
}
function transfer(fromLeft: boolean, item: Item, requested: number) {
  if (props.allowed && !props.allowed(fromLeft, item)) {
    status.value = "Este item não pode ser guardado neste recipiente.";
    return 0;
  }
  const source = fromLeft ? props.left : props.right;
  const destination = fromLeft ? props.right : props.left;
  const quantity = transferable(
    source,
    destination,
    item,
    fromLeft ? props.rightCapacity : props.leftCapacity,
    requested,
  );
  if (!quantity) {
    status.value =
      "Sem espaço no destino ou item indisponível. O restante permanece na origem.";
    return 0;
  }
  if (!props.move(fromLeft, item, quantity)) {
    status.value = "Transferência recusada. Verifique o acesso ao inventário.";
    return 0;
  }
  moved.value = `${!fromLeft}:${item}`;
  status.value = `${quantity} × ${items[item].name} transferido${quantity < requested ? ". O restante permanece na origem" : ""}.`;
  return quantity;
}
function select(fromLeft: boolean, item: Item, event: MouseEvent) {
  selection.value = { fromLeft, item };
  emit("select", fromLeft, item);
  if (event.shiftKey)
    transfer(fromLeft, item, (fromLeft ? props.left : props.right)[item] ?? 0);
}
function bulk(fromLeft: boolean, similar = false) {
  const source = fromLeft ? props.left : props.right;
  const destination = fromLeft ? props.right : props.left;
  const list = transferList(source, destination, similar).filter(
    ([id]) => !props.allowed || props.allowed(fromLeft, id),
  );
  let total = 0,
    remaining = 0;
  for (const [id, count] of list) {
    const n = transfer(fromLeft, id, count);
    total += n;
    remaining += count - n;
  }
  status.value = total
    ? `${total} unidades transferidas.${remaining ? " O que não coube permaneceu na origem." : ""}`
    : similar && !list.length
      ? "Nenhum item semelhante no destino."
      : "Nenhum item transferido. Confira os itens e o espaço disponível.";
}
function startDrag(event: DragEvent, fromLeft: boolean, item: Item) {
  dragging = { fromLeft, item };
  event.dataTransfer?.setData("text/plain", item);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}
function drop(fromLeft: boolean) {
  if (dragging && dragging.fromLeft !== fromLeft)
    transfer(
      dragging.fromLeft,
      dragging.item,
      (dragging.fromLeft ? props.left : props.right)[dragging.item] ?? 0,
    );
  dragging = undefined;
}
</script>
<template>
  <section class="inventory-transfer">
    <div class="transfer-filters">
      <label
        >Buscar<input v-model="search" type="search" placeholder="Nome do item"
      /></label>
      <label
        >Filtrar<select v-model="category">
          <option value="all">Todos</option>
          <option value="materials">Materiais</option>
          <option value="food">Alimentos</option>
          <option value="building">Construções</option>
          <option value="equipment">Equipamentos</option>
        </select></label
      >
      <label
        >Ordenar<select v-model="sort">
          <option value="name">Nome</option>
          <option value="quantity">Quantidade</option>
        </select></label
      >
    </div>
    <p class="transfer-help">
      Selecione um item e a quantidade para transferir. No PC, Shift + clique
      transfere a pilha; também pode arrastar para o outro inventário.
    </p>
    <div class="transfer-columns">
      <section
        v-for="column in columns"
        :key="String(column.fromLeft)"
        class="transfer-column"
        :aria-label="column.title"
        @dragover.prevent
        @drop.prevent="drop(column.fromLeft)"
      >
        <header>
          <h3>{{ column.title }}</h3>
          <span>{{ slots(column.data) }}/{{ column.capacity }} slots</span>
        </header>
        <progress
          :value="slots(column.data)"
          :max="column.capacity"
          :aria-label="`Capacidade de ${column.title}`"
        />
        <div class="transfer-bulk">
          <button
            class="secondary"
            :disabled="!inventoryEntries(column.data).some(([, n]) => n > 0)"
            @click="bulk(column.fromLeft)"
          >
            {{ column.fromLeft ? "Guardar tudo →" : "← Retirar tudo" }}
          </button>
          <button
            v-if="column.fromLeft"
            class="secondary"
            @click="bulk(true, true)"
          >
            Guardar semelhantes
          </button>
        </div>
        <div class="transfer-items">
          <button
            v-for="[id, n] in entries(column.data)"
            :key="id"
            class="transfer-item"
            draggable="true"
            :class="{
              selected:
                selection?.fromLeft === column.fromLeft &&
                selection.item === id,
              received: moved === `${column.fromLeft}:${id}`,
            }"
            :aria-pressed="
              selection?.fromLeft === column.fromLeft && selection.item === id
            "
            :aria-label="`${items[id].name}, ${n} unidades, ${column.title}`"
            @click="select(column.fromLeft, id, $event)"
            @dragstart="startDrag($event, column.fromLeft, id)"
            @dragend="dragging = undefined"
          >
            <ItemIcon :item="id" /><b>{{ n }}</b
            ><span>{{ items[id].name }}</span>
            <MeatShelfLife
              v-if="id === 'rawMeat'"
              :inventory="column.data"
              :time="time"
              :in-fridge="!column.fromLeft && refrigerated"
              :paused="!column.fromLeft && cooling"
            />
          </button>
          <p v-if="!entries(column.data).length" class="transfer-empty">
            {{
              inventoryEntries(column.data).some(([, n]) => n > 0)
                ? "Nenhum item corresponde ao filtro."
                : "Inventário vazio."
            }}
          </p>
        </div>
        <div
          v-if="
            selection?.fromLeft === column.fromLeft &&
            (column.data[selection.item] ?? 0) > 0
          "
          class="transfer-selected"
        >
          <strong>{{ items[selection.item].name }}</strong>
          <div
            class="transfer-quantities"
            role="group"
            aria-label="Transferir item selecionado"
          >
            <button
              v-for="n in [1, 10, 'all'] as const"
              :key="n"
              class="secondary"
              @click="
                transfer(
                  column.fromLeft,
                  selection.item,
                  n === 'all'
                    ? (column.data[selection.item] ?? 0)
                    : Math.min(n, column.data[selection.item] ?? 0),
                )
              "
            >
              {{ column.fromLeft ? "→" : "←" }} {{ n === "all" ? "Todos" : n }}
            </button>
          </div>
          <button
            v-if="useLabel?.(selection.item)"
            class="secondary"
            @click="emit('use', column.fromLeft, selection.item)"
          >
            {{ useLabel(selection.item) }}
          </button>
        </div>
      </section>
    </div>
    <p class="transfer-status" role="status" aria-live="polite">
      {{
        status ||
        "Os itens permanecem na origem até a transferência ser concluída."
      }}
    </p>
  </section>
</template>
<style scoped>
.inventory-transfer {
  min-width: 0;
}
.transfer-filters {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 10px;
}
.transfer-filters label {
  display: grid;
  gap: 5px;
  color: #9bb5c1;
  font-size: 12px;
  min-width: 0;
}
.transfer-filters input,
.transfer-filters select {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  background: #0c1925;
  color: #d5e4eb;
  border: 1px solid #38515f;
  padding: 8px;
}
.transfer-help {
  font-size: 11px !important;
}
.transfer-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.transfer-column {
  background: #0c1824;
  border: 1px solid #304957;
  padding: 12px;
  min-width: 0;
}
.transfer-column header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
}
.transfer-column h3 {
  margin: 0;
  font-size: 14px;
}
.transfer-column header span {
  font-size: 11px;
  color: #9bb5c1;
}
.transfer-column progress {
  width: 100%;
  height: 5px;
  accent-color: #91d5cc;
  margin: 8px 0;
}
.transfer-bulk {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.transfer-bulk button,
.transfer-selected button {
  min-height: 44px;
  padding: 8px;
  font-size: 11px;
}
.transfer-items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  align-content: start;
  gap: 7px;
  max-height: 42vh;
  overflow: auto;
  scrollbar-width: thin;
  padding: 2px;
}
.transfer-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  min-height: 100px;
  padding: 10px;
  border: 1px solid #304957;
  background: #122432;
  color: #d4e1e8;
  text-align: left;
  min-width: 0;
}
.transfer-item .item-art {
  width: 32px;
  height: 32px;
}
.transfer-item b {
  position: absolute;
  right: 9px;
  top: 9px;
  font-size: 13px;
}
.transfer-item > span {
  font-size: 12px;
  overflow-wrap: anywhere;
}
.transfer-item.selected {
  outline: 2px solid #98e3d7;
  outline-offset: -2px;
  background: #244348;
}
.transfer-item.received {
  border-color: #92c6b8;
}
.transfer-empty {
  grid-column: 1 / -1;
}
.transfer-selected {
  display: grid;
  gap: 9px;
  border-top: 1px solid #38515f;
  margin-top: 10px;
  padding-top: 10px;
}
.transfer-selected strong {
  font-size: 13px;
}
.transfer-quantities {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.transfer-quantities button {
  flex: 1;
}
.transfer-status {
  min-height: 2.5em;
  font-size: 12px !important;
  color: #a3d6cc !important;
}
@media (max-width: 600px) {
  .transfer-columns {
    grid-template-columns: 1fr;
  }
  .transfer-filters {
    grid-template-columns: 1fr 1fr;
  }
  .transfer-filters label:first-child {
    grid-column: 1 / -1;
  }
  .transfer-items {
    max-height: 28vh;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
}
</style>
