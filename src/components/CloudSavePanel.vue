<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  cloudBusy,
  cloudSession,
  cloudStatus,
  readCloudSave,
  supabase,
  syncCloudToLocal,
  syncLocalToCloud,
} from "../persistence/cloudSaves";
import { database, type StoredSave } from "../persistence/database";
import { shipModels } from "../fleet/models";
import { missions, useGame } from "../stores/game";

const emit = defineEmits<{ close: [] }>();
const g = useGame();
const email = ref("");
const password = ref("");
const message = ref("");
const loading = ref(false);
const local = ref<StoredSave>();
const remote = ref<Awaited<ReturnType<typeof readCloudSave>>>(null);
const ready = ref(false);
const owner = computed(() => cloudSession.value?.user.id);
const sameSave = computed(
  () =>
    local.value?.cloud?.owner === owner.value &&
    local.value?.cloud?.revision === remote.value?.revision &&
    !local.value?.cloud?.dirty,
);
const copies = computed(() => [
  {
    id: "device",
    title: "Neste dispositivo",
    data: local.value?.data,
    date: local.value?.updated,
  },
  {
    id: "cloud",
    title: "Na nuvem",
    data: remote.value?.data,
    date: remote.value?.updated_at,
  },
]);
const recent = computed(() => {
  if (!local.value || !remote.value || sameSave.value) return undefined;
  const cloudTime = Date.parse(remote.value.updated_at);
  if (!Number.isFinite(cloudTime) || cloudTime === local.value.updated)
    return undefined;
  return cloudTime > local.value.updated ? "cloud" : "device";
});
const busy = computed(() => loading.value || cloudBusy.value);
const format = (date: number | string) =>
  new Date(date).toLocaleString("pt-BR");

async function refresh() {
  const account = owner.value;
  ready.value = false;
  if (!account) return;
  loading.value = true;
  try {
    const [device, online] = await Promise.all([
      database.localSlot(),
      readCloudSave(account),
    ]);
    if (owner.value !== account) return;
    local.value = device;
    remote.value = online;
    ready.value = true;
  } catch {
    message.value = "Não foi possível consultar os saves. Tente novamente.";
  } finally {
    loading.value = false;
  }
}
watch(owner, () => void refresh(), { immediate: true });

async function authenticate(create = false) {
  if (
    !supabase ||
    busy.value ||
    !email.value.trim() ||
    password.value.length < 6
  )
    return;
  loading.value = true;
  message.value = "";
  try {
    const credentials = { email: email.value.trim(), password: password.value };
    if (create) {
      const { data, error } = await supabase.auth.signUp({
        ...credentials,
        options: {
          emailRedirectTo: window.location.origin + window.location.pathname,
        },
      });
      if (error) throw error;
      if (!data.session)
        message.value = "Confira seu e-mail para confirmar a conta.";
    } else {
      const { error } = await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
    }
    password.value = "";
  } catch {
    message.value = create
      ? "Não foi possível criar a conta. Confira o e-mail e a senha."
      : "Não foi possível entrar. Confira os dados e a confirmação do e-mail.";
  } finally {
    loading.value = false;
  }
}

async function signOut() {
  loading.value = true;
  message.value = "";
  try {
    const { error } = await supabase!.auth.signOut({ scope: "local" });
    if (error) throw error;
  } catch {
    message.value = "Não foi possível sair da conta.";
  } finally {
    loading.value = false;
  }
}

async function choose(source: "local" | "cloud") {
  if (!ready.value || busy.value || g.started) return;
  const from = source === "local" ? local.value : remote.value;
  if (!from) return;
  const other = source === "local" ? remote.value : local.value;
  if (
    other &&
    !window.confirm(
      source === "local"
        ? "Substituir o save na nuvem pela cópia deste dispositivo?"
        : "Substituir o save deste dispositivo pela cópia da nuvem?",
    )
  )
    return;
  message.value = "";
  try {
    if (source === "local" && local.value)
      await syncLocalToCloud(local.value, remote.value);
    if (
      source === "cloud" &&
      remote.value &&
      (await syncCloudToLocal(remote.value, local.value))
    )
      await g.checkSave();
    await refresh();
  } catch {
    message.value =
      "A sincronização falhou. Atualize a comparação e tente novamente.";
  }
}
</script>

<template>
  <section
    class="dialog narrow"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cloud-save-title"
  >
    <div class="dialog-heading">
      <h2 id="cloud-save-title">Salvamento na nuvem</h2>
      <button
        class="close"
        aria-label="Fechar nuvem"
        :disabled="busy"
        @click="emit('close')"
      >
        ×
      </button>
    </div>
    <template v-if="!cloudSession">
      <p>Use a mesma conta em todos os dispositivos.</p>
      <form class="station-form" @submit.prevent="authenticate()">
        <label
          >E-mail
          <input v-model="email" type="email" autocomplete="email" required
        /></label>
        <label
          >Senha
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            minlength="6"
            required
        /></label>
        <div class="station-actions">
          <button class="primary" :disabled="busy">Entrar</button>
          <button
            class="secondary"
            type="button"
            :disabled="busy"
            @click="authenticate(true)"
          >
            Criar conta
          </button>
        </div>
      </form>
    </template>
    <template v-else>
      <p>Conta conectada · {{ cloudSession.user.email }}</p>
      <template v-if="ready">
        <div class="cloud-copies">
          <article v-for="copy in copies" :key="copy.id" class="dealer-card">
            <h3>{{ copy.title }}</h3>
            <small v-if="recent === copy.id">Mais recente pela data</small>
            <template v-if="copy.data && copy.date !== undefined">
              <p>{{ format(copy.date) }} · Seed {{ copy.data.seed }}</p>
              <p>
                {{
                  copy.data.mission >= missions.length - 1
                    ? "Diário concluído"
                    : `Diário ${copy.data.mission + 1}/${missions.length - 1}`
                }}
                · {{ copy.data.visited.length }} sistemas visitados
              </p>
              <p>
                Setor {{ copy.data.systemX }}, {{ copy.data.systemY }}
                <template
                  v-if="'activeShip' in copy.data && copy.data.activeShip"
                >
                  · {{ shipModels[copy.data.activeShip.model]?.name }}
                </template>
                <template v-if="'credits' in copy.data">
                  · {{ copy.data.credits.toLocaleString("pt-BR") }} CR</template
                >
              </p>
            </template>
            <p v-else>Sem save.</p>
          </article>
        </div>
        <p v-if="sameSave">As duas cópias estão sincronizadas.</p>
        <p v-else-if="local && remote">
          Escolha qual cópia deseja manter. A data indica a gravação mais
          recente. Compare o diário e os sistemas visitados para decidir qual
          tem o progresso que você quer preservar.
        </p>
        <p v-else>
          Escolha uma cópia para vincular a expedição à conta. Os próximos
          salvamentos serão enviados automaticamente.
        </p>
        <div class="station-actions">
          <button
            v-if="local && !sameSave"
            class="primary"
            :disabled="busy"
            @click="choose('local')"
          >
            Enviar save local
          </button>
          <button
            v-if="remote && !sameSave"
            class="secondary"
            :disabled="busy"
            @click="choose('cloud')"
          >
            Usar save da nuvem
          </button>
        </div>
      </template>
      <div class="station-actions">
        <button class="secondary" :disabled="busy" @click="refresh">
          Atualizar comparação
        </button>
        <button class="secondary" :disabled="busy" @click="signOut">
          Sair da conta
        </button>
      </div>
    </template>
    <p v-if="busy" role="status">Aguarde…</p>
    <p v-if="message || cloudStatus" role="status">
      {{ message || cloudStatus }}
    </p>
  </section>
</template>

<style scoped>
.cloud-copies {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 205px), 1fr));
  gap: 8px;
}
.cloud-copies small {
  color: var(--mint);
}
</style>
