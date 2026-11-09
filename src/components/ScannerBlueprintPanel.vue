<script setup lang="ts">
import { useGame } from "../stores/game";
import {
  buyScannerBlueprint,
  shipScanners,
  type ShipScanner,
} from "../combat/shipScanners";
import ItemIcon from "./ItemIcon.vue";

const g = useGame();
const props = defineProps<{ scanner: ShipScanner }>();
async function buy() {
  if (
    await g.stationTransaction((draft) =>
      buyScannerBlueprint(draft, props.scanner),
    )
  )
    g.notify("Projeto liberado na bancada da nave.");
}
</script>
<template>
  <article class="dealer-card">
    <h3>
      <ItemIcon :item="scanner" /> Projeto · {{ shipScanners[scanner].name }}
    </h3>
    <p>Fabrique na bancada e instale pelo armário de carga.</p>
    <button
      class="secondary"
      :disabled="
        g.trading ||
        g.state.scannerBlueprints?.includes(scanner) ||
        g.state.credits < shipScanners[scanner].price
      "
      @click="buy"
    >
      {{
        g.state.scannerBlueprints?.includes(scanner)
          ? "Projeto adquirido"
          : "Comprar projeto · " +
            shipScanners[scanner].price.toLocaleString("pt-BR") +
            " CR"
      }}
    </button>
  </article>
</template>
