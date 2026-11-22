<script setup lang="ts">
import { computed } from "vue";
import { useGame, BACKPACK_SLOTS } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { marketItems, marketPrice } from "../economy/market";
import { FACILITY_SLOTS, facilityAccepts } from "../construction/facilities";
import {
  tradingState,
  communicationsState,
  visitorInReach,
  TRADE_INTERVAL,
  REQUEST_LIFETIME,
} from "../construction/planetCommerce";
import { shipModels } from "../fleet/models";
import { systemAt } from "../universe/generator";
import { items } from "../game/types";
import { inventoryEntries } from "../inventory/inventory";
import { planetaryInfluence, civilizationOf } from "../diplomacy/governance";
import ItemIcon from "./ItemIcon.vue";
import InventoryTransfer from "./InventoryTransfer.vue";
const g = useGame(),
  b = useConstruction();
const current = computed(() => b.facility);
const trade = computed(() =>
  current.value?.kind === "tradingPost"
    ? tradingState(g.state.settlements[g.planet.id]!, current.value.key)
    : undefined,
);
const comms = computed(() =>
  current.value?.kind === "communicationsPost"
    ? communicationsState(g.state.settlements[g.planet.id]!, current.value.key)
    : undefined,
);
const visitor = computed(() => trade.value?.visitor);
const nearby = computed(
  () =>
    !!current.value && visitorInReach(g.state, g.planet.id, current.value.key),
);
const now = computed(() => g.state.activePlayTime ?? 0);
const deliveryStation = computed(() => systemAt(g.state.seed, 0, 0).name);
const influence = computed(() =>
  planetaryInfluence(g.state.governments?.[g.planet.id]),
);
</script>
<template>
  <div v-if="current" class="planet-commerce">
    <p class="commerce-balance">
      Saldo: {{ g.state.credits.toLocaleString("pt-BR") }} CR
    </p>
    <template v-if="trade">
      <section v-if="visitor" class="visitor-card">
        <h3>
          {{ shipModels[visitor.model].name }} ·
          {{
            visitor.bought
              ? "Comprado"
              : visitor.phase === "arriving"
                ? "Aproximando e pousando"
                : visitor.phase === "landed"
                  ? "Pousado"
                  : "Decolando"
          }}
        </h3>
        <p>
          Bloco {{ Math.round(visitor.x / 16) }},
          {{ Math.round(visitor.y / 16) }}, {{ Math.round(visitor.z / 16) }} ·
          {{
            Math.round(
              Math.hypot(
                g.state.player.x - visitor.x,
                (g.state.player.surfaceZ ?? 0) - visitor.z,
              ),
            )
          }}
          m
        </p>
        <p>{{ visitor.receipt ?? "Cargueiro a caminho do entreposto." }}</p>
        <p v-if="visitor.phase === 'landed' && !visitor.bought">
          Comandante: “Olá! Já consultei seu excedente. Gostou da nave? Posso
          vendê-la com tanque cheio.”
        </p>
        <p>
          Casco {{ shipModels[visitor.model].hull }} · Carga
          {{ shipModels[visitor.model].capacity }} slots · Velocidade
          {{ shipModels[visitor.model].speed }}
        </p>
        <p>
          Compra da nave:
          {{ shipModels[visitor.model].price.toLocaleString("pt-BR") }} CR.
          Entrega no hangar de {{ deliveryStation }} (0, 0), para selecionar
          como ativa na estação. A carga comprada de você segue para o mercado e
          não acompanha a nave.
        </p>
        <button
          class="primary"
          :disabled="
            !nearby || g.state.credits < shipModels[visitor.model].price
          "
          @click="b.buyCargoVisitor"
        >
          Comprar cargueiro
        </button>
        <p v-if="!nearby && !visitor.bought">
          Feche o painel, aproxime-se do cargueiro pousado e use E / Int. para
          conversar e comprar.
        </p>
      </section>
      <template v-if="current.atTerminal">
        <p>
          Prepare uma clareira de 11 × 9 blocos perto do entreposto, sem árvores
          ou construções. Somente o depósito deste entreposto é vendido.
          Mochila, nave e baús permanecem separados. Preços de venda do mercado;
          até 80 unidades e 6.000 CR por visita.
        </p>
        <p>
          Próxima chamada:
          {{ Math.ceil(Math.max(0, TRADE_INTERVAL - trade.wait)) }} s
          energizados. Após o pouso, o cargueiro permanece 60 s ativos. Feche os
          menus para o tempo avançar.
        </p>
        <h3>Autorizar recursos à venda</h3>
        <div class="sale-items">
          <label v-for="id in marketItems" :key="id"
            ><input
              type="checkbox"
              :checked="!!trade.enabled[id]"
              @change="
                b.configureSale(id, ($event.target as HTMLInputElement).checked)
              "
            /><ItemIcon :item="id" /><span
              >{{ items[id].name
              }}<small
                >{{ marketPrice(id, "sell") }} CR/un. ·
                {{ current.machine.input[id] ?? 0 }} no depósito</small
              ></span
            ></label
          >
        </div>
        <InventoryTransfer
          :left="g.state.backpack"
          :right="current.machine.input"
          :left-capacity="BACKPACK_SLOTS"
          :right-capacity="FACILITY_SLOTS"
          left-title="Sua mochila"
          right-title="Excedente para venda"
          :time="g.state.time"
          :allowed="
            (fromLeft, id) => !fromLeft || facilityAccepts('tradingPost', id)
          "
          :move="(fromLeft, id, n) => b.moveFacility(true, fromLeft, id, n)"
        />
        <h3>Últimas visitas</h3>
        <p v-if="!trade.history.length">Nenhuma venda concluída.</p>
        <ul>
          <li v-for="entry in trade.history" :key="entry.id">
            {{ entry.text }}
          </li>
        </ul>
      </template>
    </template>
    <template v-else-if="comms">
      <p>
        {{ civilizationOf(g.planet)?.name ?? "Planeta sem conselho habitado" }}
        · Influência {{ influence }}/100
      </p>
      <p>
        Mensagens e pedidos novos a cada 5 minutos de jogo ativo. Prazo de
        {{ REQUEST_LIFETIME / 60 }} minutos após a transmissão. Aceite e
        entregue os materiais da mochila neste posto com energia.
      </p>
      <section class="visitor-card">
        <h3>Canal de comunicações</h3>
        <p v-for="message in comms.messages" :key="message">{{ message }}</p>
        <p v-if="!comms.messages.length">
          Ligue o posto e explore por um instante para receber transmissões.
        </p>
      </section>
      <section
        v-for="request in comms.requests"
        :key="request.id"
        class="visitor-card"
      >
        <h3>{{ request.title }}</h3>
        <p>
          {{
            request.status === "completed"
              ? "Concluído"
              : request.expires <= now
                ? "Expirado"
                : request.status === "accepted"
                  ? "Aceito"
                  : "Disponível"
          }}
          · {{ Math.max(0, Math.ceil((request.expires - now) / 60)) }} min
          restantes
        </p>
        <p>
          <span
            v-for="[id, n] in inventoryEntries(request.cost)"
            :key="id"
            class="request-item"
            ><ItemIcon :item="id" /> {{ g.state.backpack[id] ?? 0 }}/{{ n }}
            {{ items[id].name }}</span
          >
        </p>
        <p>
          Recompensa: {{ request.reward }} CR<span v-if="request.influence">
            · Apoio ao conselho e influência (entrega inédita conta como projeto
            de ajuda; repetidas: +{{ request.influence }}, bônus limitado a
            20)</span
          >.
        </p>
        <button
          v-if="request.status === 'available'"
          class="primary"
          :disabled="request.expires <= now || !current.piece.powered"
          @click="b.answerBaseRequest(request.id, false)"
        >
          Aceitar pedido
        </button>
        <button
          v-else-if="request.status === 'accepted'"
          class="primary"
          :disabled="
            request.expires <= now ||
            !current.piece.powered ||
            inventoryEntries(request.cost).some(
              ([id, n]) => (g.state.backpack[id] ?? 0) < n,
            )
          "
          @click="b.answerBaseRequest(request.id, true)"
        >
          Entregar suprimentos
        </button>
      </section>
    </template>
  </div>
</template>
<style scoped>
.planet-commerce {
  min-width: 0;
}
.commerce-balance {
  color: #96dacb;
  font-weight: 600;
}
.visitor-card {
  padding: 16px;
  border: 1px solid #3b5965;
  background: #101f2b;
  margin: 12px 0;
}
.visitor-card h3 {
  font-size: 17px;
  margin: 0 0 10px;
}
.visitor-card button {
  min-height: 44px;
  max-width: 100%;
  white-space: normal;
}
.sale-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 8px;
  margin-bottom: 20px;
}
.sale-items label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #344d5b;
  min-height: 54px;
  font-size: 13px;
}
.sale-items small {
  display: block;
  color: #9ab1be;
  margin-top: 5px;
}
.sale-items input {
  width: 20px;
  height: 20px;
  accent-color: #94d6c9;
}
.item-art {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}
.request-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 5px 12px 5px 0;
  font-size: 13px;
}
.planet-commerce p,
.planet-commerce li {
  overflow-wrap: anywhere;
  line-height: 1.6;
}
@media (max-width: 600px) {
  .sale-items {
    grid-template-columns: 1fr;
  }
  .visitor-card {
    padding: 12px;
  }
}
</style>
