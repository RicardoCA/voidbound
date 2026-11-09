<script setup lang="ts">
import { computed, ref } from "vue";
import { SHIP_SCAN_RANGE } from "../combat/shipScanners";
import { items } from "../game/types";
import { inventoryEntries } from "../inventory/inventory";
import { useGame } from "../stores/game";

const g = useGame();
const selected = ref("");
const results = ref<{ cargo?: boolean; wanted?: boolean }>({});
const target = computed(() =>
  g.shipScanContacts.find((contact) => contact.id === selected.value),
);
const cargo = computed(() =>
  target.value ? inventoryEntries(target.value.cargo) : [],
);
</script>
<template>
  <section class="dialog" aria-label="Scanner de naves">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">CONTATOS LOCAIS · {{ SHIP_SCAN_RANGE }} km</div>
        <h2>Scanner de naves</h2>
      </div>
      <button class="close" aria-label="Fechar scanner" @click="g.panel = ''">
        ×
      </button>
    </div>
    <p v-if="!g.shipScanContacts.length">
      Nenhuma nave no alcance. Aproxime-se de um contato e tente novamente.
    </p>
    <template v-else>
      <label class="station-form">
        Nave alvo
        <select v-model="selected" @change="results = {}">
          <option value="" disabled>Escolha uma nave</option>
          <option
            v-for="contact in g.shipScanContacts"
            :key="contact.id"
            :value="contact.id"
          >
            {{ contact.name }} · {{ Math.round(contact.distance) }} km
          </option>
        </select>
      </label>
      <div class="station-actions">
        <button
          v-if="g.state.upgrades.includes('cargoScanner')"
          class="secondary"
          :disabled="!target"
          @click="results.cargo = true"
        >
          Escanear carga
        </button>
        <button
          v-if="g.state.upgrades.includes('wantedScanner')"
          class="secondary"
          :disabled="!target"
          @click="results.wanted = true"
        >
          Consultar procurado
        </button>
      </div>
      <article
        v-if="target && (results.cargo || results.wanted)"
        class="dealer-card"
        aria-live="polite"
      >
        <h3>{{ target.name }}</h3>
        <p v-if="results.wanted">Nível de procurado · {{ target.wanted }}/5</p>
        <template v-if="results.cargo">
          <p v-if="!cargo.length">Porão vazio.</p>
          <ul v-else>
            <li v-for="[id, amount] in cargo" :key="id">
              {{ amount }} × {{ items[id].name }}
            </li>
          </ul>
        </template>
      </article>
    </template>
  </section>
</template>
