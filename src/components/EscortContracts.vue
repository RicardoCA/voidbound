<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ESCORT_LIMIT,
  escortOffers,
  escortTiers,
  escortTime,
  hireEscort,
  renewEscort,
} from "../fleet/escorts";
import { shipModels } from "../fleet/models";
import { useGame } from "../stores/game";
import ShipSprite from "./ShipSprite.vue";

const props = defineProps<{ recruiting?: boolean }>();
const g = useGame();
const offers = computed(() => escortOffers(g.state, g.system));
const contracts = computed(() => g.state.escorts ?? []);
const selected = computed(() =>
  contracts.value.find((pilot) => g.panel === "escort:" + pilot.id),
);
const confirming = ref<string>();
const price = (credits: number) => credits.toLocaleString("pt-BR") + " CR";

async function hire(id: string) {
  if (await g.stationTransaction((draft) => hireEscort(draft, g.system, id)))
    g.notify("Piloto contratado. A primeira hora já está paga.");
}

async function manage(id: string, action: "renew" | "dismiss") {
  function change(state: typeof g.state) {
    const pilot = state.escorts?.find((contract) => contract.id === id);
    if (!pilot) return "Contrato indisponível.";
    if (action === "renew") return renewEscort(state, pilot);
    state.escorts = state.escorts?.filter((contract) => contract.id !== id);
  }
  if (props.recruiting) {
    if (!(await g.stationTransaction(change))) return;
  } else {
    const error = change(g.state);
    if (error) {
      g.notify(error);
      return;
    }
    void g.save();
    if (action === "dismiss") g.panel = "escorts";
  }
  confirming.value = undefined;
  g.notify(
    action === "renew"
      ? "Contrato renovado por uma hora."
      : "Piloto dispensado da escolta.",
  );
}
</script>

<template>
  <component
    :is="recruiting ? 'div' : 'section'"
    :class="recruiting ? 'station-form' : 'dialog'"
    aria-label="Escolta"
  >
    <template v-if="recruiting">
      <p>
        O valor de contratação inclui a primeira hora de jogo ativo. A tarifa
        por hora é cobrada automaticamente nas renovações. A contagem pausa
        durante reparos, pagos pelo piloto.
      </p>
      <p>
        Vagas ocupadas: {{ contracts.length }}/{{ ESCORT_LIMIT }} · As ofertas
        mudam a cada 30 minutos de jogo ativo.
      </p>
      <article v-for="offer in offers" :key="offer.id" class="dealer-card">
        <ShipSprite :model="offer.model" />
        <h3>{{ offer.name }} · {{ escortTiers[offer.tier].label }}</h3>
        <p>{{ shipModels[offer.model].name }}</p>
        <p>
          <strong
            >Contratação: {{ price(escortTiers[offer.tier].hire) }}</strong
          >
        </p>
        <p>
          <strong
            >Por hora de serviço ativo:
            {{ price(escortTiers[offer.tier].hourly) }}</strong
          >
        </p>
        <button
          class="primary"
          :disabled="
            g.trading ||
            contracts.length >= ESCORT_LIMIT ||
            contracts.some((p) => p.id === offer.id) ||
            g.state.credits < escortTiers[offer.tier].hire
          "
          @click="hire(offer.id)"
        >
          Contratar
        </button>
      </article>
    </template>
    <div v-else class="dialog-heading">
      <h2>{{ selected ? selected.name : "Rádio da escolta" }}</h2>
      <button class="close" aria-label="Fechar rádio" @click="g.panel = ''">
        ×
      </button>
    </div>
    <h3 v-if="recruiting">Pilotos contratados</h3>
    <p v-if="!contracts.length">Nenhum piloto contratado.</p>
    <article
      v-for="pilot in selected ? [selected] : contracts"
      :key="pilot.id"
      class="dealer-card"
    >
      <h3>{{ pilot.name }} · {{ shipModels[pilot.model].name }}</h3>
      <p v-if="pilot.repairUntil">
        Em reparo ·
        {{ escortTime(pilot.repairUntil - (g.state.activePlayTime ?? 0)) }} para
        retornar
      </p>
      <p v-else-if="pilot.remaining <= 0">
        Fora da formação · Aguardando renovação
      </p>
      <p v-else>
        Casco {{ Math.ceil(pilot.hull) }}/{{ escortTiers[pilot.tier].hull }}
      </p>
      <p>
        Tempo restante: {{ escortTime(pilot.remaining) }} · Próxima hora:
        {{ price(escortTiers[pilot.tier].hourly) }}
      </p>
      <div class="station-actions">
        <button
          v-if="!recruiting && !selected"
          class="secondary"
          @click="g.panel = 'escort:' + pilot.id"
        >
          Falar com piloto
        </button>
        <button
          v-if="pilot.remaining <= 0"
          class="primary"
          :disabled="
            g.trading || g.state.credits < escortTiers[pilot.tier].hourly
          "
          @click="manage(pilot.id, 'renew')"
        >
          Renovar contrato
        </button>
        <template v-if="selected">
          <button
            v-if="confirming !== pilot.id"
            class="secondary"
            @click="confirming = pilot.id"
          >
            Dispensar piloto
          </button>
          <template v-else>
            <button class="secondary" @click="manage(pilot.id, 'dismiss')">
              Confirmar dispensa
            </button>
            <button class="secondary" @click="confirming = undefined">
              Cancelar
            </button>
          </template>
        </template>
      </div>
    </article>
    <p v-if="!recruiting" role="status">{{ g.notice }}</p>
  </component>
</template>
