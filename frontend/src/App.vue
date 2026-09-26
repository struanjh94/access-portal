<script setup lang="ts">
import { onMounted, ref } from 'vue';

type HealthState = 'checking' | 'ok' | 'failed';

const status = ref<HealthState>('checking');
const detail = ref('');

onMounted(async () => {
  try {
    const response = await fetch('/api/health');
    detail.value = `${response.status} ${response.statusText}`;
    status.value = response.ok ? 'ok' : 'failed';
  } catch (error) {
    detail.value = error instanceof Error ? error.message : String(error);
    status.value = 'failed';
  }
});
</script>

<template>
  <main>
    <h1>Access Provisioning &amp; Audit Portal</h1>
    <p>
      API health: <strong>{{ status }}</strong>
      <span v-if="detail">({{ detail }})</span>
    </p>
  </main>
</template>

<style scoped>
main {
  max-width: 40rem;
  margin: 4rem auto;
  padding: 0 1rem;
  font-family: system-ui, sans-serif;
}
</style>
