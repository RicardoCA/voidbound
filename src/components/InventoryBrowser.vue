<script setup lang="ts">
import { computed, ref } from "vue";
import { items, type Inventory, type Item } from "../game/types";
import { inventoryEntries, slots } from "../inventory/inventory";
import { filterInventory, itemCategory } from "../inventory/presentation";
import { foodValue, RAW_MEAT_RISK } from "../survival/food";
import ItemIcon from "./ItemIcon.vue";
import MeatShelfLife from "./MeatShelfLife.vue";
const props = defineProps<{
  inventory: Inventory;
  capacity: number;
  time: number;
  actionLabel: (id: Item) => string;
  actionHint: (id: Item) => string;
  actionDisabled: (id: Item) => boolean;
  equipped?: Item;
}>();
const emit = defineEmits<{ use: [id: Item] }>();
const search = ref("");
const category = ref("all");
const sort = ref("name");
const selected = ref<Item>();
const selectedItem = computed(() =>
  selected.value && (props.inventory[selected.value] ?? 0) > 0
    ? selected.value
    : undefined,
);
const visible = computed(() =>
  filterInventory(props.inventory, search.value, category.value, sort.value),
);
const count = computed(
  () => inventoryEntries(props.inventory).filter(([, n]) => n > 0).length,
);
const categories = {
  all: "Todos",
  materials: "Materiais",
  food: "Alimentos",
  building: "Construções",
  equipment: "Equipamentos",
};
</script>
<template>
  <section class="backpack-browser" aria-label="Itens do inventário">
    <div class="backpack-capacity">
      <span>{{ slots(inventory) }} / {{ capacity }} slots</span
      ><span>{{ count }} tipos de item</span>
    </div>
    <progress
      :value="slots(inventory)"
      :max="capacity"
      aria-label="Espaço ocupado na mochila"
    />
    <div class="backpack-filters">
      <label
        >Buscar<input
          v-model="search"
          type="search"
          placeholder="Buscar na mochila"
      /></label>
      <label
        >Ordenar<select v-model="sort">
          <option value="name">Nome</option>
          <option value="quantity">Quantidade</option>
        </select></label
      >
    </div>
    <div
      class="backpack-categories"
      role="group"
      aria-label="Categoria dos itens"
    >
      <button
        v-for="(label, id) in categories"
        :key="id"
        class="secondary"
        :aria-pressed="category === id"
        @click="category = id"
      >
        {{ label }}
      </button>
    </div>
    <p class="backpack-help">
      Selecione um item para ver detalhes. Comer, usar ou equipar exige
      confirmar no botão do item.
    </p>
    <div class="backpack-content">
      <div class="backpack-grid">
        <button
          v-for="[id, n] in visible"
          :key="id"
          class="backpack-item"
          :class="{ selected: selectedItem === id }"
          :style="{ '--item-color': items[id].color }"
          :aria-pressed="selectedItem === id"
          :aria-label="`${items[id].name}, ${n} unidades`"
          @click="selected = id"
        >
          <ItemIcon :item="id" /><b>{{ n }}</b
          ><span>{{ items[id].name }}</span>
          <small v-if="equipped === id" class="equipped-tag">Equipado</small>
          <MeatShelfLife
            v-if="id === 'rawMeat'"
            :inventory="inventory"
            :time="time"
          />
        </button>
        <p v-if="!visible.length" class="backpack-empty">
          {{
            count
              ? "Nenhum item corresponde à busca ou à categoria."
              : "Sua mochila está vazia. Colete recursos para começar."
          }}
        </p>
      </div>
      <aside class="backpack-detail" aria-label="Detalhes do item">
        <template v-if="selectedItem">
          <ItemIcon :item="selectedItem" />
          <h3>{{ items[selectedItem].name }}</h3>
          <span
            >{{ categories[itemCategory(selectedItem)] }} ·
            {{ items[selectedItem].rarity }}</span
          >
          <dl>
            <div>
              <dt>Quantidade</dt>
              <dd>{{ inventory[selectedItem] }}</dd>
            </div>
            <div>
              <dt>Por slot</dt>
              <dd>{{ items[selectedItem].stack }}</dd>
            </div>
            <div>
              <dt>Slots ocupados</dt>
              <dd>
                {{
                  Math.ceil(
                    (inventory[selectedItem] ?? 0) / items[selectedItem].stack,
                  )
                }}
              </dd>
            </div>
          </dl>
          <p v-if="foodValue(selectedItem)">
            Recupera {{ foodValue(selectedItem) }} pontos de fome por unidade.
          </p>
          <p v-if="selectedItem === 'rawMeat'" class="warning">
            Carne crua: {{ Math.round(RAW_MEAT_RISK * 100) }}% de chance de
            intoxicação. Asse na fogueira.
          </p>
          <MeatShelfLife
            v-if="selectedItem === 'rawMeat'"
            :inventory="inventory"
            :time="time"
          />
          <p>{{ actionHint(selectedItem) }}</p>
          <button
            v-if="actionLabel(selectedItem)"
            class="primary backpack-use"
            :disabled="actionDisabled(selectedItem)"
            @click="emit('use', selectedItem)"
          >
            {{ actionLabel(selectedItem) }}
          </button>
          <slot name="actions" :item="selectedItem" />
        </template>
        <p v-else>
          Selecione um item da mochila para consultar suas informações e ações.
        </p>
      </aside>
    </div>
  </section>
</template>
<style scoped>
.backpack-browser {
  min-width: 0;
}
.backpack-capacity {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #a2bbc5;
  font-size: 12px;
}
progress {
  width: 100%;
  height: 6px;
  accent-color: #96d7ca;
  margin: 10px 0 16px;
}
.backpack-filters {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 12px;
}
.backpack-filters label {
  display: grid;
  gap: 5px;
  min-width: 0;
  font-size: 12px;
  color: #a2bbc5;
}
input,
select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  background: #0e1b28;
  border: 1px solid #3c5360;
  color: #d7e7eb;
  padding: 8px;
}
.backpack-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.backpack-categories button {
  padding: 8px 12px;
  min-height: 44px;
  font-size: 11px;
}
.backpack-categories button[aria-pressed="true"] {
  background: #284a4c;
  border-color: #9cdacf;
  color: #baf9e8;
}
.backpack-help {
  font-size: 12px !important;
}
.backpack-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 250px;
  gap: 16px;
  align-items: start;
}
.backpack-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
  max-height: 48vh;
  overflow: auto;
  padding: 2px;
  scrollbar-width: thin;
}
.backpack-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  min-height: 115px;
  border: 1px solid #344954;
  background: #112333;
  color: #d7e7eb;
  text-align: left;
  min-width: 0;
}
.backpack-item .item-art {
  width: 38px;
  height: 38px;
}
.backpack-item b {
  position: absolute;
  right: 10px;
  top: 10px;
  color: var(--item-color);
  font-size: 15px;
}
.backpack-item span {
  font-size: 12px;
  overflow-wrap: anywhere;
}
.backpack-item.selected {
  outline: 2px solid #98e3d7;
  outline-offset: -2px;
  background: #234147;
}
.equipped-tag {
  color: #b3efcf;
  font-size: 10px;
}
.backpack-empty {
  grid-column: 1 / -1;
}
.backpack-detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  padding: 18px;
  min-width: 0;
  border: 1px solid #345260;
  background: #0c1925;
}
.backpack-detail > .item-art {
  width: 70px;
  height: 70px;
}
.backpack-detail h3 {
  margin: 0;
  font-size: 18px;
}
.backpack-detail > span,
.backpack-detail p {
  color: #a8bdc7;
  font-size: 12px;
  margin: 0;
  line-height: 1.6;
}
dl {
  margin: 0;
  font-size: 12px;
}
dl div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid #253b49;
}
dd {
  margin: 0;
}
.backpack-use {
  min-height: 46px;
  padding: 10px;
}
@media (max-width: 600px) {
  .backpack-content {
    grid-template-columns: 1fr;
  }
  .backpack-grid {
    max-height: 32vh;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
  .backpack-detail {
    padding: 14px;
  }
}
</style>
