<script setup lang="ts">
import { ref, watch } from 'vue';
import type { AuditLogEntry } from '../../../../shared/contract.js';
import { get } from '../../api/client.js';
import { useActor } from '../../stores/actor.js';

const { actorId } = useActor();

const entries = ref<AuditLogEntry[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

/* Reachable by typing the URL even when the nav link is hidden, so the view shows the API's refusal. */
async function load(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    entries.value = await get<AuditLogEntry[]>('/audit-logs', actorId.value);
  } catch (failure) {
    entries.value = [];
    error.value = failure instanceof Error ? failure.message : String(failure);
  }

  loading.value = false;
}

watch(actorId, load, { immediate: true });

/* The three actions are fixed by a check constraint, so a label for each is code, not data. */
const ACTION_LABELS: Record<AuditLogEntry['action'], string> = {
  'user.created': 'User created',
  'role.granted': 'Role granted',
  'role.revoked': 'Role revoked',
};

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString();
}

/* The role in a change is worth picking out: what was taken away, and what was added. */
function removed(entry: AuditLogEntry): string[] {
  const after = entry.details.after ?? [];
  return (entry.details.before ?? []).filter((role) => !after.includes(role));
}

function added(entry: AuditLogEntry): string[] {
  const before = entry.details.before ?? [];
  return (entry.details.after ?? []).filter((role) => !before.includes(role));
}
</script>

<template>
  <header class="head">
    <h2>What changed</h2>
    <p class="muted">Every access change, newest first. Entries cannot be edited or removed.</p>
  </header>

  <p v-if="loading" class="muted">Loading…</p>
  <p v-else-if="error" class="notice">{{ error }}</p>
  <p v-else-if="!entries.length" class="muted">
    Nothing has changed yet. Grant someone a role and it will appear here.
  </p>

  <div v-else class="panel">
    <table>
      <thead>
        <tr>
          <th class="when">When</th>
          <th>Change</th>
          <th>Made by</th>
          <th>Affecting</th>
          <th>Roles before and after</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in entries" :key="entry.id">
          <td class="when muted">{{ formatMoment(entry.occurredAt) }}</td>

          <td>
            <span class="change">
              <span :class="['mark', entry.action.replace('.', '-')]" aria-hidden="true"></span>
              <span>{{ ACTION_LABELS[entry.action] }}</span>
              <span v-if="entry.roleKey" class="chip">{{ entry.roleKey }}</span>
            </span>
          </td>

          <td>{{ entry.actorEmail }}</td>
          <td>{{ entry.targetUserEmail }}</td>

          <td>
            <span v-if="entry.details.before || entry.details.after" class="shift">
              <span class="side">
                <span
                  v-for="role in entry.details.before"
                  :key="role"
                  :class="['chip', removed(entry).includes(role) ? 'gone' : 'kept']"
                  >{{ role }}</span
                >
                <span v-if="!entry.details.before?.length" class="muted">no roles</span>
              </span>

              <span class="arrow" aria-hidden="true">→</span>

              <span class="side">
                <span
                  v-for="role in entry.details.after"
                  :key="role"
                  :class="['chip', added(entry).includes(role) ? 'fresh' : 'kept']"
                  >{{ role }}</span
                >
                <span v-if="!entry.details.after?.length" class="muted">no roles</span>
              </span>
            </span>
            <span v-else class="muted" aria-label="No roles changed">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.head {
  margin-bottom: var(--space-4);
}

.head p {
  margin: var(--space-1) 0 0;
  max-width: 44rem;
}

.when {
  width: 11rem;
  white-space: nowrap;
}

/* Laid out as a row so the rule sits on the text's line however the row grows. */
.change {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  white-space: nowrap;
}

/* The rule carries the kind of change, so the column can be read down at a glance. */
.mark {
  flex: none;
  width: 3px;
  height: 1.1rem;
  border-radius: 2px;
  background: var(--ink-faint);
}

.mark.role-granted {
  background: var(--granted);
}

.mark.role-revoked {
  background: var(--revoked);
}

.shift {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.side {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}

.kept {
  color: var(--ink-soft);
}

/* Struck through and in the revoked colour: the role this change took away. */
.gone {
  border-color: #e7cfcc;
  background: #fcf3f2;
  color: var(--revoked);
  text-decoration: line-through;
}

.fresh {
  border-color: #c2ded6;
  background: #f0f8f5;
  color: var(--granted);
}

.arrow {
  color: var(--ink-faint);
}
</style>
