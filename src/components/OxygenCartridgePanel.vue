<script setup lang="ts">
import { computed } from "vue";
import {
  OXYGEN_FILL_TIME_MS,
  oxygenFillingProgress,
} from "../survival/autoOxygen";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
const g = useGame(),
  b = useConstruction();
const filling = computed(() => oxygenFillingProgress(b.oxygenFillingElapsed));
</script>
<template>
  <section class="dialog narrow" aria-label="Abastecer cartuchos de oxigênio">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">OXIGÊNIO COMPRIMIDO</div>
        <h2>Abastecer cartuchos</h2>
      </div>
      <button class="close" aria-label="Fechar" @click="g.panel = ''">×</button>
    </div>
    <template v-if="b.oxygenGeneratorPiece">
      <p
        v-if="b.oxygenGeneratorPiece.piece.kind === 'planetaryOxygenGenerator'"
      >
        Gerador planetário
        {{ b.oxygenGeneratorPiece.piece.powered ? "ativo" : "desligado" }}. Cada
        cartucho exige 10 de energia na bateria conectada, com as 5 placas
        solares e o gerador ativos.
      </p>
      <p v-else>
        Reserva do gerador:
        {{ Math.floor(b.oxygenGeneratorPiece.piece.oxygen ?? 0) }}/100 O₂. Cada
        cartucho consome 100 O₂; aguarde a produção para encher o próximo.
      </p>
      <p>
        Na mochila: {{ g.state.backpack.emptyOxygenCartridge ?? 0 }} vazios ·
        {{ g.state.backpack.oxygenCartridge ?? 0 }} cheios.
      </p>
      <p>
        Cada cartucho cheio recarrega o traje até 100%. Após o uso, o recipiente
        vazio pode ser abastecido novamente.
      </p>
      <div v-if="filling" class="oxygen-filling">
        <svg class="oxygen-scene" viewBox="0 0 160 82" aria-hidden="true">
          <defs>
            <clipPath id="oxygen-fill-clip">
              <rect x="96" y="20" width="26" height="48" rx="5" />
            </clipPath>
          </defs>
          <rect width="160" height="82" rx="5" fill="#101e2a" />
          <path d="M10 72h140" stroke="#3d5666" stroke-width="3" />
          <rect
            x="18"
            y="22"
            width="43"
            height="48"
            rx="4"
            fill="#2c4553"
            stroke="#648593"
            stroke-width="2"
          />
          <rect x="24" y="28" width="31" height="16" rx="2" fill="#102c36" />
          <text
            x="39"
            y="40"
            fill="#8de8ed"
            text-anchor="middle"
            font-size="10"
          >
            O₂
          </text>
          <path
            d="M26 52h27m-27 6h27m-27 6h27"
            stroke="#152b37"
            stroke-width="3"
          />
          <path
            class="oxygen-hose"
            d="M61 51H74V12H109V17"
            fill="none"
            stroke="#82e1ed"
            stroke-width="3"
            stroke-dasharray="5 4"
          />
          <rect
            x="91"
            y="17"
            width="36"
            height="55"
            rx="8"
            fill="#233a48"
            stroke="#7794a2"
            stroke-width="2"
          />
          <g clip-path="url(#oxygen-fill-clip)">
            <rect
              x="96"
              :y="68 - (48 * filling.elapsed) / OXYGEN_FILL_TIME_MS"
              width="26"
              :height="(48 * filling.elapsed) / OXYGEN_FILL_TIME_MS"
              fill="#65d9e9"
            />
            <circle
              class="oxygen-bubble"
              cx="103"
              cy="62"
              r="2"
              fill="#d7ffff"
            />
            <circle
              class="oxygen-bubble oxygen-bubble-late"
              cx="115"
              cy="61"
              r="2"
              fill="#d7ffff"
            />
          </g>
          <rect x="102" y="11" width="14" height="8" rx="2" fill="#829daa" />
          <path d="M96 30h5m-5 10h5m-5 10h5m-5 10h5" stroke="#e3fafc" />
          <text
            x="141"
            y="48"
            fill="#8de8ed"
            text-anchor="middle"
            font-size="9"
          >
            {{ Math.floor((100 * filling.elapsed) / OXYGEN_FILL_TIME_MS) }}%
          </text>
        </svg>
        <label for="oxygen-filling-progress"
          >Enchendo cartucho ·
          {{ Math.ceil((OXYGEN_FILL_TIME_MS - filling.elapsed) / 1000) }}
          s</label
        >
        <progress
          id="oxygen-filling-progress"
          :max="OXYGEN_FILL_TIME_MS"
          :value="filling.elapsed"
        />
        <p>
          Fechar o painel ou pausar cancela o abastecimento sem consumir
          recursos.
        </p>
      </div>
      <p role="status">{{ g.notice }}</p>
      <button
        class="primary"
        :disabled="!g.state.backpack.emptyOxygenCartridge || filling !== null"
        @click="b.fillOxygenCartridge"
      >
        Abastecer 1 cartucho
      </button>
      <p>
        Retire os cartuchos vazios do reabastecedor para a mochila antes de
        abastecer. O equipamento é gerenciado no inventário.
      </p>
    </template>
    <p v-else>Aproxime-se de um gerador de oxigênio.</p>
  </section>
</template>

<style scoped>
.oxygen-filling {
  margin: 12px 0;
}
.oxygen-scene {
  display: block;
  width: 100%;
  max-height: 170px;
  margin-bottom: 10px;
}
.oxygen-filling progress {
  display: block;
  width: 100%;
  height: 14px;
  margin-top: 6px;
  accent-color: #65d9e9;
}
.oxygen-hose {
  animation: oxygen-flow 0.7s linear infinite;
}
.oxygen-bubble {
  animation: oxygen-rise 1.3s linear infinite;
}
.oxygen-bubble-late {
  animation-delay: -0.65s;
}
@keyframes oxygen-flow {
  to {
    stroke-dashoffset: -18;
  }
}
@keyframes oxygen-rise {
  from {
    transform: translateY(0);
    opacity: 0.9;
  }
  to {
    transform: translateY(-38px);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .oxygen-hose,
  .oxygen-bubble {
    animation: none;
  }
}
</style>
