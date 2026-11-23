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
<style scoped src="./item-browser.css"></style>
<style scoped>
.equipped-tag {
  color: #b3efcf;
  font-size: 10px;
}
</style>
