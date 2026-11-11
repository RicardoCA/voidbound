<script setup lang="ts">
import { ref } from "vue";
import {
  civicAid,
  civicProjects,
  planetaryInfluence,
} from "../diplomacy/governance";
import { items } from "../game/types";
import { inventoryEntries } from "../inventory/inventory";
import { useGame } from "../stores/game";

const g = useGame();
const topic = ref<"welcome" | "society" | "government">("welcome");
</script>

<template>
  <section
    class="government-bubble"
    :class="{ 'is-below': g.governmentAnchor.y < 175 }"
    :style="{
      '--npc-x': g.governmentAnchor.x + 'px',
      '--npc-y': g.governmentAnchor.y + 'px',
    }"
    role="dialog"
    aria-label="Conselho planetário"
  >
    <div class="bubble-body">
      <div class="dialog-heading">
        <div>
          <div class="eyebrow">
            {{ g.planet.name }} · {{ g.civilization?.name }}
          </div>
          <h2>{{ g.civilization?.representative }}</h2>
        </div>
        <button
          class="close"
          aria-label="Encerrar conversa"
          @click="g.panel = ''"
        >
          ×
        </button>
      </div>
      <p v-if="topic === 'welcome'">
        Bem-vindo. Sou representante do conselho local. O que trouxe você ao
        nosso planeta?
      </p>
      <p v-else-if="topic === 'society'">{{ g.civilization?.dialogue }}</p>
      <p v-else-if="g.government?.governed">
        O conselho reconhece seu mandato. Podemos investir em serviços para o
        assentamento.
      </p>
      <p v-else>
        O conselho pode votar seu mandato depois que você ajudar o assentamento
        nas três frentes.
      </p>
      <div class="station-actions">
        <button class="secondary" @click="topic = 'society'">
          Conhecer seu povo
        </button>
        <button class="secondary" @click="topic = 'government'">
          Falar com o conselho
        </button>
      </div>
      <template v-if="topic === 'government'">
        <p>
          Influência neste planeta · {{ planetaryInfluence(g.government) }}/100
        </p>
        <template v-if="!g.government?.governed">
          <article v-for="(aid, id) in civicAid" :key="id" class="dealer-card">
            <h3>{{ aid.title }}</h3>
            <p>
              {{
                inventoryEntries(aid.cost)
                  .map(
                    ([item, count]) =>
                      `${g.state.backpack[item] ?? 0}/${count} ${items[item].name}`,
                  )
                  .join(" · ")
              }}
            </p>
            <button
              class="secondary"
              :disabled="
                g.government?.aid.includes(id) ||
                inventoryEntries(aid.cost).some(
                  ([item, count]) => (g.state.backpack[item] ?? 0) < count,
                )
              "
              @click="g.governPlanet(id)"
            >
              {{
                g.government?.aid.includes(id)
                  ? "Entrega concluída"
                  : "Entregar da mochila"
              }}
            </button>
          </article>
          <button
            class="primary"
            :disabled="g.government?.aid.length !== 3"
            @click="g.governPlanet('govern')"
          >
            Solicitar votação do mandato
          </button>
        </template>
        <template v-else>
          <p>
            Créditos disponíveis ·
            {{ g.state.credits.toLocaleString("pt-BR") }} CR
          </p>
          <article
            v-for="(project, id) in civicProjects"
            :key="id"
            class="dealer-card"
          >
            <h3>{{ project.title }}</h3>
            <p>{{ project.benefit }}</p>
            <button
              class="secondary"
              :disabled="
                g.government.projects.includes(id) ||
                g.state.credits < project.cost
              "
              @click="g.governPlanet(id)"
            >
              {{
                g.government.projects.includes(id)
                  ? "Projeto concluído"
                  : project.cost.toLocaleString("pt-BR") + " CR"
              }}
            </button>
            <div
              v-if="g.government.projects.includes(id)"
              class="station-actions"
            >
              <button
                v-if="id === 'clinic'"
                class="secondary"
                :disabled="g.state.player.health >= 100"
                @click="g.governPlanet('heal')"
              >
                Receber atendimento
              </button>
              <button
                v-else
                class="secondary"
                :disabled="g.state.ship.fuel >= g.maxFuel"
                @click="g.governPlanet('refuel')"
              >
                Abastecer até 20 u · 8 CR/u
              </button>
            </div>
          </article>
        </template>
      </template>
    </div>
  </section>
</template>

<style scoped>
.government-bubble {
  --half-width: min(180px, calc(50cqw - 8px));
  --center: clamp(
    var(--half-width) + 8px,
    var(--npc-x),
    100cqw - var(--half-width) - 8px
  );
  position: absolute;
  z-index: 5;
  left: var(--center);
  bottom: calc(100% - var(--npc-y) + 10px);
  width: min(360px, calc(100% - 16px));
  transform: translateX(-50%);
  color: #d5e5ed;
  --bubble-border: #719f9d;
  --bubble-background: #142532;
}

.government-bubble.is-below {
  top: calc(var(--npc-y) + 38px);
  bottom: auto;
}

.government-bubble::after {
  position: absolute;
  content: "";
  left: clamp(12px, 50% + var(--npc-x) - var(--center), 100% - 12px);
  bottom: -5px;
  width: 9px;
  height: 9px;
  background: var(--bubble-background);
  border-right: 1px solid var(--bubble-border);
  border-bottom: 1px solid var(--bubble-border);
  transform: translateX(-50%) rotate(45deg);
}

.is-below::after {
  top: -5px;
  bottom: auto;
  transform: translateX(-50%) rotate(225deg);
}

.bubble-body {
  box-sizing: border-box;
  max-height: min(275px, calc(var(--npc-y) - 18px));
  overflow: auto;
  overscroll-behavior: contain;
  padding: 0 12px 10px;
  background: var(--bubble-background);
  border: 1px solid var(--bubble-border);
  border-radius: 8px;
  font-size: 13px;
}

.is-below .bubble-body {
  max-height: min(240px, 42dvh);
}

.dialog-heading {
  position: sticky;
  top: 0;
  padding-top: 8px;
  background: var(--bubble-background);
}

h2 {
  font-size: 16px;
  margin: 3px 0;
}

p {
  margin: 8px 0;
}

.dealer-card {
  padding: 8px;
}

.dealer-card h3 {
  margin: 0;
}
</style>
