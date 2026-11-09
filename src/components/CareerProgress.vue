<script setup lang="ts">
import { computed, ref } from "vue";
import { blackMarketPrice } from "../combat/traffic";
import { contractStatus } from "../progression/contracts";
import ScienceJournal from "./ScienceJournal.vue";
import { useGame } from "../stores/game";
import {
  careerDefinitions,
  careerIds,
  careerLevel,
  CAREER_LEVEL_CAP,
  type CareerId,
} from "../progression/careers";

const g = useGame();
const selected = ref<CareerId>("explorer");
const progress = computed(() => g.state.progression);
const record = computed(() => progress.value.careers[selected.value]);
const career = computed(() => careerLevel(selected.value, record.value.xp));
const contracts = computed(() =>
  Object.values(progress.value.contracts).filter(
    (contract) =>
      contract.career === selected.value &&
      ["ACTIVE", "COMPLETED"].includes(contractStatus(g.state, contract)),
  ),
);
</script>

<template>
  <div class="station-form" aria-label="Carreiras galácticas">
    <h3>Carreiras Galácticas</h3>
    <p>O progresso de cada profissão é independente.</p>
    <nav class="station-actions" aria-label="Profissões">
      <button
        v-for="id in careerIds"
        :key="id"
        class="secondary"
        :aria-pressed="selected === id"
        @click="selected = id"
      >
        {{ careerDefinitions[id].name }} · Nv.
        {{ careerLevel(id, progress.careers[id].xp).level }}
      </button>
    </nav>
    <section class="career-record" aria-labelledby="career-rank">
      <h3 id="career-rank">{{ career.rank }}</h3>
      <p>
        Nível {{ career.level }}/{{ CAREER_LEVEL_CAP }} ·
        {{ record.xp.toLocaleString("pt-BR") }} XP acumulados
      </p>
      <progress
        v-if="career.target"
        :value="career.progress"
        :max="career.target"
        aria-label="XP para o próximo nível"
      />
      <p v-if="career.target">
        {{ career.progress }} / {{ career.target }} XP para o próximo nível
      </p>
      <p v-else>Nível máximo alcançado.</p>
      <template v-if="selected === 'explorer'">
        <p>
          Planetas catalogados:
          {{ Object.keys(progress.cataloguedPlanets).length }} · Sistemas
          visitados: {{ g.state.visited.length }}
        </p>
        <p>
          O primeiro pouso em cada planeta e os saltos para sistemas inéditos
          rendem XP.
        </p>
      </template>
      <template v-else-if="selected === 'miner'">
        <p>
          Minério extraído: {{ progress.extracted }} · Lotes refinados:
          {{ progress.refined }}
        </p>
        <p>
          Eficiência de extração:
          {{
            (g.extractionEfficiency * 100).toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
            })
          }}% de redução no consumo e no intervalo de mineração planetária.
        </p>
      </template>
      <template v-else-if="selected === 'bountyHunter'">
        <p>
          Aceite mandados no quadro de contratos de estações regulares. Abata o
          alvo pirata e volte à estação emissora para receber créditos e XP.
        </p>
      </template>
      <template v-else>
        <p>
          Destroços saqueados: {{ progress.piracy.recovered }} · Caixas
          vendidas: {{ progress.piracy.sold }}
        </p>
        <p>
          Cotação clandestina:
          {{ blackMarketPrice(g.state).toLocaleString("pt-BR") }} CR por caixa.
          No nível 7, novos contratos de contrabando ficam disponíveis.
        </p>
      </template>
      <h3>Contratos ativos</h3>
      <p v-if="!contracts.length">Nenhum contrato ativo.</p>
      <ul v-else>
        <li v-for="contract in contracts" :key="contract.id">
          {{ contract.title }} · setor {{ contract.sector.x }},
          {{ contract.sector.y }}
        </li>
      </ul>
      <h3>Atividades recentes</h3>
      <p v-if="!record.history.length">Nenhuma atividade registrada.</p>
      <ul v-else class="career-history">
        <li v-for="(activity, i) in record.history" :key="i">
          <span>{{ activity.label }}</span
          ><b>+{{ activity.xp }} XP</b>
        </li>
      </ul>
    </section>
    <ScienceJournal v-if="selected === 'explorer'" />
  </div>
</template>

<style scoped>
.career-record progress {
  width: 100%;
  height: 14px;
  accent-color: var(--mint);
}
.career-history {
  list-style: none;
  padding: 0;
  margin: 0;
}
.career-history li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.career-history b {
  color: var(--mint);
  white-space: nowrap;
}
</style>
