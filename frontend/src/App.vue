<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useActor } from './stores/actor.js';
import { usePeople } from './stores/people.js';
import { useRoles } from './stores/roles.js';

const { state, actorId, load, select, can } = useActor();
const { roles, load: loadRoles } = useRoles();
const { people, load: loadPeople } = usePeople();

onMounted(async () => {
  await load();
  await loadPeople();
});

/* What the catalogue shows depends on who is asking, so it follows the actor. */
watch(actorId, (id) => void loadRoles(id), { immediate: true });

async function onSelect(event: Event) {
  await select((event.target as HTMLSelectElement).value);
}
</script>

<template>
  <div class="masthead">
    <div class="shell">
      <span class="wordmark">Access portal</span>

      <nav>
        <RouterLink to="/users">Users</RouterLink>
        <RouterLink v-if="can('audit:read')" to="/audit">Audit log</RouterLink>
      </nav>
    </div>
  </div>

  <main class="shell">
    <section class="identity">
      <div class="acting">
        <label for="actor" class="label">Acting as</label>
        <!-- autocomplete off: Chrome restores a select's previous value on reload, which
             would land on whoever was chosen last rather than the default admin. -->
        <select id="actor" autocomplete="off" :value="actorId" @change="onSelect">
          <option v-for="person in people" :key="person.id" :value="person.id">
            {{ person.displayName }}
          </option>
        </select>
      </div>

      <div class="grants">
        <p class="label">Assigned roles</p>
        <p v-if="!state.actor?.roles.length" class="empty">No roles. This account sees nothing.</p>
        <p v-else class="chips">
          <span v-for="role in state.actor.roles" :key="role" class="chip light">{{ role }}</span>
        </p>

        <p class="label spaced">Permissions granted by roles</p>
        <p v-if="!state.actor?.permissions.length" class="empty">Nothing.</p>
        <p v-else class="chips">
          <span v-for="key in state.actor.permissions" :key="key" class="chip light">{{
            key
          }}</span>
        </p>
      </div>

      <div v-if="roles.length" class="available">
        <p class="label">Available roles</p>
        <p class="chips">
          <span v-for="role in roles" :key="role.key" class="tip" tabindex="0">
            <span class="chip light">{{ role.name }}</span>

            <span class="popover" role="tooltip">
              <span class="popover-title">{{ role.name }}</span>
              <span class="popover-body">{{ role.description }}</span>
              <span class="popover-keys">
                <span v-for="key in role.permissions" :key="key" class="chip">{{ key }}</span>
                <span v-if="!role.permissions.length">Grants nothing</span>
              </span>
            </span>
          </span>
        </p>
      </div>
    </section>

    <p v-if="state.loading" class="muted">Loading…</p>
    <p v-else-if="state.error" class="notice">{{ state.error }}</p>
    <RouterView v-else-if="state.actor" />
  </main>
</template>

<style scoped>
.masthead {
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}

.shell {
  max-width: 78rem;
  margin: 0 auto;
  padding: 0 var(--space-5);
}

.masthead .shell {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
  align-items: center;
  justify-content: space-between;
  min-height: 3.25rem;
}

.wordmark {
  font-weight: 600;
  letter-spacing: 0.01em;
}

nav {
  display: flex;
  gap: var(--space-5);
}

nav a {
  padding: 0.15rem 0;
  border-bottom: 2px solid transparent;
  color: var(--ink-soft);
  text-decoration: none;
}

nav a:hover {
  color: var(--ink);
}

nav a.router-link-active {
  border-bottom-color: var(--deep);
  color: var(--ink);
}

main {
  padding-top: var(--space-6);
  padding-bottom: var(--space-7);
}

/* The one loud surface on the page: who you are acting as and what that permits. */
.identity {
  display: grid;
  grid-template-columns: minmax(15rem, auto) minmax(18rem, 1.4fr) minmax(14rem, auto);
  gap: var(--space-6);
  padding: var(--space-5);
  border-radius: var(--radius);
  background: var(--deep);
  color: #eef2f6;
}

.label {
  display: block;
  margin: 0;
  color: #93a6bd;
  font-size: var(--step-small);
}

.label.spaced {
  margin-top: var(--space-4);
}

.acting select {
  width: 100%;
  margin-top: var(--space-2);
  padding: 0.5rem 0.6rem;
  border-color: #33506f;
  background: #f7f9fb;
  color: var(--ink);
  font-size: var(--step-lead);
}

.empty {
  margin: 0.2rem 0 0;
  color: #b9c6d6;
  font-size: var(--step-small);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
}

.chip.light {
  border-color: #33506f;
  background: #1d3350;
  color: #dbe5f0;
}

/* Hover or focus shows what the role allows, so the keyboard reaches it too. */
.tip {
  position: relative;
  display: inline-block;
}

.tip .chip.light {
  cursor: help;
}

.tip:hover .chip.light,
.tip:focus-visible .chip.light {
  border-color: #6f88a6;
}

.popover {
  position: absolute;
  top: calc(100% + 0.4rem);
  left: 0;
  z-index: 10;
  display: none;
  width: max-content;
  max-width: 20rem;
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 6px 20px rgb(6 18 33 / 35%);
}

.tip:hover .popover,
.tip:focus-within .popover {
  display: block;
}

/* This column sits at the right edge, so its popovers open inwards rather than off-screen. */
.available .popover {
  right: 0;
  left: auto;
}

.popover-title {
  display: block;
  font-weight: 500;
}

.popover-body {
  display: block;
  margin-top: 0.1rem;
  color: var(--ink-soft);
  font-size: var(--step-small);
}

.popover-keys {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-2);
  font-size: var(--step-small);
}

@media (max-width: 64rem) {
  .identity {
    grid-template-columns: 1fr;
    gap: var(--space-5);
  }
}
</style>
