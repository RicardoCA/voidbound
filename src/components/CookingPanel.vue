<script setup lang="ts">
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { COOKING_TIME_MS, foodValue } from "../survival/food";
const g = useGame();
const construction = useConstruction();
</script>

<template>
  <section class="dialog narrow" aria-label="Fogueira">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">FOGUEIRA DE CAMPO</div>
        <h2>Assar carne</h2>
      </div>
      <button class="close" aria-label="Fechar fogueira" @click="g.panel = ''">
        ×
      </button>
    </div>
    <p>
      Uma carne crua rende uma carne assada, que recupera
      {{ foodValue("cookedMeat") }} pontos de fome. Coma pela tela de carga.
    </p>
    <p>
      Na carga: {{ g.state.inventory.rawMeat ?? 0 }} crua ·
      {{ g.state.inventory.cookedMeat ?? 0 }} assada
    </p>
    <div v-if="construction.cookingElapsed !== null" class="cooking-progress">
      <svg
        class="cooking-scene"
        viewBox="0 0 120 48"
        shape-rendering="crispEdges"
        aria-hidden="true"
      >
        <path fill="#121d2b" d="M0 0h120v48H0z" />
        <path fill="#213044" d="M0 39h120v9H0zM17 36h86v3H17z" />
        <path fill="#875c46" d="M40 37h40v6H40zM46 43h28v2H46z" />
        <path fill="#b18056" d="M42 37h8v2h-8zM69 41h9v2h-9z" />
        <g class="cooking-flame">
          <path fill="#ed623e" d="M46 37v-7h4v-5h4v4h3V19h5v6h4v4h4v-3h4v11z" />
          <path fill="#ffc36d" d="M52 37v-5h5v-5h5v5h5v5z" />
        </g>
        <path
          fill="#c0a194"
          d="M38 17h3v23h-3zM79 17h3v23h-3zM36 17h48v2H36z"
        />
        <path fill="#b76367" d="M51 11h13v2h5v6H49v-5h2z" />
        <path
          fill="#a26a49"
          d="M51 11h13v2h5v6H49v-5h2z"
          :opacity="construction.cookingElapsed / COOKING_TIME_MS"
        />
        <path fill="#f0ba8c" d="M53 12h7v2h-7zM69 15h5v3h-5z" />
        <path
          class="cooking-steam"
          fill="#bbc4bd"
          d="M55 6h3v3h-3zM62 4h3v3h-3z"
        />
        <rect
          class="cooking-ember"
          x="48"
          y="27"
          width="2"
          height="2"
          fill="#ffab5a"
        />
        <rect
          class="cooking-ember cooking-ember-late"
          x="71"
          y="28"
          width="2"
          height="2"
          fill="#ffab5a"
        />
      </svg>
      <label for="cooking-progress"
        >Assando ·
        {{ Math.ceil((COOKING_TIME_MS - construction.cookingElapsed) / 1000) }}
        s</label
      >
      <progress
        id="cooking-progress"
        :max="COOKING_TIME_MS"
        :value="construction.cookingElapsed"
      />
      <p>Fechar a fogueira ou pausar cancela o preparo.</p>
    </div>
    <p role="status">{{ g.notice }}</p>
    <button
      class="primary"
      :disabled="
        !g.state.inventory.rawMeat || construction.cookingElapsed !== null
      "
      @click="construction.cookMeat"
    >
      Assar 1 carne
    </button>
    <button class="secondary" @click="g.panel = 'inventory'">
      Abrir carga
    </button>
  </section>
</template>

<style scoped>
.cooking-progress {
  margin: 12px 0;
}
.cooking-scene {
  display: block;
  width: 100%;
  max-height: 126px;
  margin-bottom: 10px;
  background: #121d2b;
}
.cooking-flame {
  transform-origin: 60px 37px;
  animation: cooking-flicker 520ms steps(3, end) infinite alternate;
}
.cooking-ember,
.cooking-steam {
  animation: cooking-rise 1.2s steps(6, end) infinite;
}
.cooking-ember-late {
  animation-delay: -600ms;
}
@keyframes cooking-flicker {
  from {
    transform: scale(0.92, 0.82);
  }
  to {
    transform: scale(1.08, 1);
  }
}
@keyframes cooking-rise {
  from {
    opacity: 0.85;
    transform: translateY(1px);
  }
  to {
    opacity: 0;
    transform: translateY(-7px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cooking-flame,
  .cooking-ember,
  .cooking-steam {
    animation: none;
  }
}
.cooking-progress progress {
  display: block;
  width: 100%;
  height: 14px;
  margin-top: 6px;
  accent-color: var(--gold);
}
</style>
