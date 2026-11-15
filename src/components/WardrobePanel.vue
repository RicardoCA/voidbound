<script setup lang="ts">
import { computed, ref } from "vue";
import { useGame } from "../stores/game";
import {
  buyClothing,
  clothing,
  clothingCatalog,
  equipClothing,
  type ClothingId,
  type ClothingSlot,
} from "../wardrobe/clothing";

const g = useGame();
const props = defineProps<{ clandestine: boolean }>();
const slots = {
  hat: "Bonés",
  shirt: "Camisetas",
  pants: "Calças",
  visor: "Óculos",
  helmet: "Capacetes",
};
const selectedSlot = ref<ClothingSlot>("hat");
const choices = computed(() =>
  clothingCatalog(props.clandestine).filter(
    (id) => clothing[id].slot === selectedSlot.value,
  ),
);
const previewUrl = (id: ClothingId) =>
  `${import.meta.env.BASE_URL}wardrobe/${id}.webp`;
const owned = (id: ClothingId) => g.state.wardrobe?.owned.includes(id) ?? false;
const equipped = (id: ClothingId) =>
  g.state.wardrobe?.equipped[clothing[id].slot] === id;

async function buy(id: ClothingId) {
  if (await g.stationTransaction((draft) => buyClothing(draft, id)))
    g.notify(clothing[id].name + " foi para o guarda-roupa.");
}
async function equip(id: ClothingId) {
  const remove = equipped(id);
  if (await g.stationTransaction((draft) => equipClothing(draft, id)))
    g.notify(
      clothing[id].name + (remove ? " removida do traje." : " equipada."),
    );
}
</script>

<template>
  <section class="station-form" aria-label="Loja de vestuário">
    <p v-if="clandestine">
      Coleção Bandeira Negra · Exclusiva das estações clandestinas.
    </p>
    <p>
      Escolha uma peça, compre com créditos e equipe no guarda-roupa. O boné
      fica sobre o capacete. A categoria Óculos troca a viseira.
    </p>
    <nav class="station-actions" aria-label="Tipos de roupa">
      <button
        v-for="(label, slot) in slots"
        :key="slot"
        class="secondary"
        :aria-pressed="selectedSlot === slot"
        @click="selectedSlot = slot"
      >
        {{ label }}
      </button>
    </nav>
    <div class="wardrobe-grid">
      <article
        v-for="id in choices"
        :key="id"
        class="dealer-card wardrobe-card"
      >
        <img
          class="wardrobe-preview"
          :src="previewUrl(id)"
          alt=""
          width="64"
          height="84"
          loading="lazy"
          decoding="async"
        />
        <div>
          <h3>{{ clothing[id].name }}</h3>
          <p v-if="equipped(id)">Equipada</p>
          <button
            v-if="owned(id)"
            class="secondary"
            :disabled="g.trading"
            @click="equip(id)"
          >
            {{ equipped(id) ? "Desequipar" : "Equipar" }}
          </button>
          <button
            v-else
            class="secondary"
            :disabled="g.trading || g.state.credits < clothing[id].price"
            @click="buy(id)"
          >
            Comprar · {{ clothing[id].price }} CR
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.wardrobe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(225px, 100%), 1fr));
  gap: 8px;
}
.wardrobe-card {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}
.wardrobe-preview {
  object-fit: contain;
  width: 64px;
  height: 84px;
  background: linear-gradient(#1b3b4b, #0a1827);
  border: 1px solid #3b5260;
}
.wardrobe-card button {
  min-height: 44px;
}
</style>
