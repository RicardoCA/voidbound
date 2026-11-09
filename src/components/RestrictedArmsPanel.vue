<script setup lang="ts">
import { useGame } from "../stores/game";
import { buyRestrictedArms } from "../combat/restrictedArms";
import {
  restrictedArms,
  weaponModules,
  type RestrictedWeapon,
} from "../combat/weapons";
import { items } from "../game/types";
import { inventoryEntries } from "../inventory/inventory";
import ItemIcon from "./ItemIcon.vue";

const g = useGame();
const catalog = Object.keys(restrictedArms) as RestrictedWeapon[];
const price = (credits: number) => credits.toLocaleString("pt-BR") + " CR";
async function buy(id: RestrictedWeapon, product: "weapon" | "recipe") {
  if (
    await g.stationTransaction((draft) => buyRestrictedArms(draft, id, product))
  )
    g.notify(
      product === "recipe"
        ? "Projeto liberado na bancada da nave."
        : "Arma guardada na carga da nave.",
    );
}
</script>

<template>
  <section class="station-form" aria-label="Catálogo de armas restritas">
    <p>
      Instale armas pelo armário de carga. Os projetos liberam a fabricação na
      bancada da nave.
    </p>
    <article v-for="id in catalog" :key="id" class="dealer-card">
      <h3><ItemIcon :item="id" /> {{ items[id].name }}</h3>
      <p>{{ weaponModules[id].description }}</p>
      <p>
        Materiais do projeto ·
        {{
          inventoryEntries(weaponModules[id].cost)
            .map(([item, n]) => n + " × " + items[item].name)
            .join(" · ")
        }}
      </p>
      <div class="station-actions">
        <button
          class="primary"
          :disabled="
            g.trading || g.state.credits < restrictedArms[id].weaponPrice
          "
          @click="buy(id, 'weapon')"
        >
          Comprar arma · {{ price(restrictedArms[id].weaponPrice) }}
        </button>
        <button
          class="secondary"
          :disabled="
            g.trading ||
            g.state.weaponBlueprints?.includes(id) ||
            g.state.credits < restrictedArms[id].recipePrice
          "
          @click="buy(id, 'recipe')"
        >
          {{
            g.state.weaponBlueprints?.includes(id)
              ? "Projeto adquirido"
              : "Comprar projeto · " + price(restrictedArms[id].recipePrice)
          }}
        </button>
      </div>
    </article>
  </section>
</template>
