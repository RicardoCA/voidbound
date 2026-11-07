<script setup lang="ts">
import { computed } from "vue";
import { useGame } from "../stores/game";
import { payFines, wantedLabels } from "../combat/law";
import { planetClock } from "../construction/habitat";

defineProps<{ settle?: boolean }>();
const g = useGame();
const history = computed(() => g.state.progression.crimes.slice().reverse());
async function pay() {
  if (await g.stationTransaction((draft) => payFines(draft)))
    g.notify("Multas pagas nesta jurisdição. Registro regularizado.");
}
</script>

<template>
  <section class="station-form" aria-label="Registro criminal">
    <h3>Registro criminal</h3>
    <div class="dealer-card">
      <h3>{{ g.system.name }} · {{ g.wanted.faction }}</h3>
      <p>
        Procurado {{ g.wanted.level }}/5 · {{ wantedLabels[g.wanted.level] }} ·
        Segurança {{ g.wanted.security }}/3
      </p>
      <p>
        Multas nesta jurisdição: {{ g.wanted.fine.toLocaleString("pt-BR") }} CR
        · Recompensa da facção: {{ g.wanted.bounty.toLocaleString("pt-BR") }} CR
      </p>
      <p>
        Recompensas pendentes na galáxia:
        {{ g.wanted.galacticBounty.toLocaleString("pt-BR") }} CR
      </p>
      <button
        v-if="settle && g.wanted.fine"
        class="secondary"
        :disabled="g.trading || g.state.credits < g.wanted.fine"
        @click="pay"
      >
        Pagar multas · {{ g.wanted.fine.toLocaleString("pt-BR") }} CR
      </button>
      <p v-if="settle && g.wanted.fine > g.state.credits">
        Saldo insuficiente para regularização.
      </p>
    </div>
    <p v-if="!history.length">Nenhuma ocorrência registrada.</p>
    <article v-for="crime in history" :key="crime.id" class="dealer-card">
      <h3>
        {{ crime.type === "assault" ? "Ataque" : "Destruição" }} ·
        {{ crime.target }}
      </h3>
      <p>
        {{ crime.systemName }} · {{ crime.faction }} ·
        {{ planetClock(crime.time) }} · Nave {{ crime.shipId }}
      </p>
      <p>
        {{
          crime.paid
            ? "Regularizado"
            : crime.reported
              ? `Comunicado · multa ${crime.fine} CR · recompensa ${crime.bounty} CR`
              : "Sem comunicação às autoridades"
        }}
      </p>
    </article>
  </section>
</template>
