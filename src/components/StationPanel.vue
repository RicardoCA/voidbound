<script setup lang="ts">
import DialogueBubble from "./DialogueBubble.vue";
import { computed, ref } from "vue";
import { useGame } from "../stores/game";
import ShipBlueprintPanel from "./ShipBlueprintPanel.vue";
import HangarPanel from "./HangarPanel.vue";
import DealershipPanel from "./DealershipPanel.vue";
import CriminalRecord from "./CriminalRecord.vue";
import ScannerBlueprintPanel from "./ScannerBlueprintPanel.vue";
import BlackMarket from "./BlackMarket.vue";
import RestrictedArmsPanel from "./RestrictedArmsPanel.vue";
import type { StationService } from "../game/station/services";
import ContractsBoard from "./ContractsBoard.vue";
import ScienceJournal from "./ScienceJournal.vue";
import WardrobePanel from "./WardrobePanel.vue";
import MarketPanel from "./MarketPanel.vue";
const g = useGame();
const props = defineProps<{ npc: StationService }>();
const confirmed = ref(false);
const section = computed(() => props.npc.id);
function accept() {
  if (section.value === "airlock") g.undock();
  else confirmed.value = true;
}
const fuelAmount = computed(() =>
  Math.max(0, Math.min(20, g.maxFuel - g.state.ship.fuel)),
);
const repairAmount = computed(() =>
  Math.max(0, g.model.hull - g.state.ship.hull),
);
async function service(kind: "fuel" | "hull", amount: number, rate: number) {
  const price = Math.ceil(amount * rate);
  if (amount <= 0) return;
  const success = await g.stationTransaction((draft) => {
    if (draft.credits < price) return "Saldo insuficiente.";
    draft.credits -= price;
    draft.ship[kind] += amount;
  });
  if (success)
    g.notify(kind === "fuel" ? "Abastecimento concluído." : "Casco reparado.");
}
</script>
<template>
  <DialogueBubble
    :anchor="g.stationDialogueAnchor"
    :expanded="confirmed"
    :label="npc.label + ' · ' + npc.name"
  >
    <div class="station-conversation">
      <div class="dialog-heading">
        <div>
          <div class="eyebrow">{{ g.system.station?.name }}</div>
          <h2>{{ npc.name }} · {{ npc.label }}</h2>
        </div>
        <strong class="station-credits"
          >{{ g.state.credits.toLocaleString("pt-BR") }} CR</strong
        >
        <button
          class="bubble-close"
          aria-label="Encerrar conversa"
          :disabled="g.trading"
          @click="g.panel = ''"
        >
          ×
        </button>
      </div>
      <template v-if="!confirmed">
        <p>{{ npc.dialogue }}</p>
        <div class="station-actions">
          <button class="primary" @click="accept">Sim</button>
          <button class="secondary" @click="g.panel = ''">Não</button>
        </div>
      </template>
      <template v-else>
        <template v-if="section === 'law'">
          <ScannerBlueprintPanel
            v-if="g.system.station?.kind === 'standard'"
            scanner="wantedScanner"
          />
          <CriminalRecord settle />
        </template>
        <BlackMarket v-else-if="section === 'black-market'" />
        <template v-else-if="section === 'restricted-arms'">
          <ScannerBlueprintPanel scanner="cargoScanner" />
          <RestrictedArmsPanel />
        </template>
        <ContractsBoard v-else-if="section === 'contracts'" />
        <ScienceJournal v-else-if="section === 'science'" sell />
        <MarketPanel v-else-if="section === 'market'" />
        <DealershipPanel v-else-if="section === 'dealer'" />
        <HangarPanel v-else-if="section === 'hangar'" />
        <WardrobePanel
          v-else-if="section === 'clothing' || section === 'pirate-clothing'"
          :clandestine="section === 'pirate-clothing'"
        />
        <div v-else-if="section === 'workshop'" class="station-form">
          <ShipBlueprintPanel />
          <ScannerBlueprintPanel
            v-if="g.system.station?.kind === 'standard'"
            scanner="asteroidRadar"
          />
          <p>
            Casco: {{ Math.floor(g.state.ship.hull) }}/{{ g.model.hull }}.
            Reparo a 3 CR por ponto.
          </p>
          <button
            class="primary"
            :disabled="g.trading || repairAmount <= 0"
            @click="service('hull', repairAmount, 3)"
          >
            Reparar casco · {{ Math.ceil(repairAmount * 3) }} CR
          </button>
          <div class="station-actions">
            <button
              class="secondary"
              :disabled="g.trading"
              @click="g.panel = 'craft'"
            >
              Fabricação
            </button>
            <button
              class="secondary"
              :disabled="g.trading"
              @click="g.panel = 'inventory'"
            >
              Carga e melhorias
            </button>
          </div>
        </div>
        <div v-else class="station-form">
          <p>
            Combustível: {{ Math.floor(g.state.ship.fuel) }}/{{ g.maxFuel }}.
            Abastecimento a 2 CR por unidade.
          </p>
          <button
            class="primary"
            :disabled="g.trading || fuelAmount <= 0"
            @click="service('fuel', fuelAmount, 2)"
          >
            Abastecer {{ fuelAmount.toFixed(1) }} u ·
            {{ Math.ceil(fuelAmount * 2) }} CR
          </button>
        </div>
        <p role="status">{{ g.notice }}</p>
        <button class="secondary" :disabled="g.trading" @click="g.panel = ''">
          Encerrar conversa
        </button>
      </template>
    </div>
  </DialogueBubble>
</template>

<style scoped>
.station-conversation {
  min-width: 0;
  font-size: 13px;
}
.dialog-heading {
  position: sticky;
  top: -12px;
  z-index: 1;
  padding: 8px 0;
  background: #142532;
  flex-wrap: wrap;
  gap: 6px;
}
.bubble-close {
  margin-left: auto;
  min-width: 36px;
  min-height: 36px;
  padding: 4px;
}
.dialog-heading h2 {
  margin: 4px 0;
  font-size: 17px;
}
.station-conversation :deep(p) {
  margin: 10px 0;
}
.station-conversation :deep(.station-actions) {
  flex-wrap: wrap;
}
.station-conversation :deep(input),
.station-conversation :deep(select) {
  box-sizing: border-box;
  max-width: 100%;
}
.station-conversation :deep(.dealer-card) {
  min-width: 0;
}
.station-conversation :deep(button) {
  white-space: normal;
  max-width: 100%;
}
</style>
