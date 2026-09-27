<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Role, UserSummary } from '../../../../shared/contract.js';
import { CreateUserBody } from '../../../../shared/contract.js';
import { get, post, put } from '../../api/client.js';
import { useActor } from '../../stores/actor.js';
import { usePeople } from '../../stores/people.js';
import { useRoles } from '../../stores/roles.js';

const { actorId, can, load: reloadActor } = useActor();
const { roles, nameFor, descriptionFor, load: reloadRoles } = useRoles();
const { load: loadPeople } = usePeople();

/* Granting and revoking travel together: the endpoint replaces the whole set. */
const manages = computed(() => can('roles:grant') && can('roles:revoke'));

const users = ref<UserSummary[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

/* Failures from a grant, a revoke or a creation, shown above the table that caused them. */
const actionError = ref<string | null>(null);

/* The row being saved, so its checkboxes cannot be toggled again mid-request. */
const savingUserId = ref<string | null>(null);

const newEmail = ref('');
const newDisplayName = ref('');
const creating = ref(false);

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* The catalogue and the user list are gated separately, so one can fail while the other succeeds. */
async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  actionError.value = null;

  try {
    users.value = await get<UserSummary[]>('/users', actorId.value);
  } catch (failure) {
    users.value = [];
    error.value = messageFor(failure);
  }

  loading.value = false;
}

/* Reloads when the actor changes, because what they may see and do changes with them. */
watch(actorId, load, { immediate: true });

/* The tooltip on a toggle says what granting it would actually allow. */
function allows(role: Role): string {
  return role.permissions.length
    ? `${role.description}. Grants ${role.permissions.join(', ')}`
    : role.description;
}

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString();
}

/**
 * Sends the roles the user should end up with, not the one that was toggled.
 *
 * The endpoint replaces the whole set, so a checkbox change is expressed as the full
 * list with that key added or removed.
 */
async function toggleRole(user: UserSummary, key: string, checked: boolean): Promise<void> {
  const next = checked ? [...user.roles, key] : user.roles.filter((held) => held !== key);

  savingUserId.value = user.id;
  actionError.value = null;

  try {
    const updated = await put<UserSummary>(`/users/${user.id}/roles`, actorId.value, {
      roles: next,
    });

    users.value = users.value.map((row) => (row.id === updated.id ? updated : row));

    /*
     * Changing your own roles changes what you may see, so the resolved permissions and
     * the table are both reloaded. Without it the page keeps rendering controls the
     * actor no longer has.
     */
    if (updated.id === actorId.value) {
      await reloadActor();
      await Promise.all([load(), reloadRoles(actorId.value)]);
    }
  } catch (failure) {
    /* A refused change leaves the checkbox showing what the server rejected, so reload
       the rows first: load clears the message, so it is set afterwards. */
    await load();
    actionError.value = messageFor(failure);
  } finally {
    savingUserId.value = null;
  }
}

/**
 * Creates a user, validating with the schema the API validates against.
 *
 * Catching a bad address here saves a round trip; the API checks it again, since
 * nothing stops a client skipping this.
 */
async function createUser(): Promise<void> {
  actionError.value = null;

  const parsed = CreateUserBody.safeParse({
    email: newEmail.value,
    displayName: newDisplayName.value,
  });

  if (!parsed.success) {
    actionError.value = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'form'}: ${issue.message}`)
      .join('; ');
    return;
  }

  creating.value = true;

  try {
    await post<UserSummary>('/users', actorId.value, parsed.data);
    newEmail.value = '';
    newDisplayName.value = '';

    /* The switcher offers everyone, so a new person has to reach it without a reload. */
    await Promise.all([load(), loadPeople()]);
  } catch (failure) {
    actionError.value = messageFor(failure);
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <form v-if="can('users:create')" class="panel add" @submit.prevent="createUser">
    <label>
      Email
      <input v-model="newEmail" type="text" placeholder="radia.perlman@example.com" />
    </label>

    <label>
      Name
      <input v-model="newDisplayName" type="text" placeholder="Radia Perlman" />
    </label>

    <button type="submit" :disabled="creating">Add person</button>
  </form>

  <p v-if="actionError" class="notice">{{ actionError }}</p>

  <p v-if="loading" class="muted">Loading…</p>
  <p v-else-if="error" class="notice">{{ error }}</p>

  <div v-else class="panel">
    <table>
      <thead>
        <tr>
          <th>Person</th>
          <th>Roles</th>
          <th class="added">Added</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>
            <span class="name">{{ user.displayName }}</span>
            <span class="muted email">{{ user.email }}</span>
          </td>

          <td v-if="manages" class="toggles">
            <label v-for="role in roles" :key="role.key" class="toggle" :title="allows(role)">
              <input
                type="checkbox"
                :checked="user.roles.includes(role.key)"
                :disabled="savingUserId === user.id"
                @change="toggleRole(user, role.key, ($event.target as HTMLInputElement).checked)"
              />
              <span>{{ role.name }}</span>
            </label>
          </td>

          <td v-else>
            <span v-if="!user.roles.length" class="muted">No roles</span>
            <span v-for="key in user.roles" :key="key" class="held" :title="descriptionFor(key)">{{
              nameFor(key)
            }}</span>
          </td>

          <td class="added muted">{{ formatMoment(user.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.add {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: flex-end;
  margin-bottom: var(--space-4);
  padding: var(--space-4);
}

.add label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  color: var(--ink-soft);
  font-size: var(--step-small);
}

.add input {
  min-width: 16rem;
}

.name {
  display: block;
  font-weight: 500;
}

.email {
  font-size: var(--step-small);
}

.added {
  width: 11rem;
  white-space: nowrap;
}

/* Left as a table cell: display flex would take it out of the row and break the rule under it. */
.toggles .toggle {
  position: relative;
  display: inline-block;
  margin: 0 var(--space-2) var(--space-1) 0;
}

/* A role that is read rather than changed: no border and no hover, so it does not
   invite a click that would do nothing. */
.held {
  display: inline-block;
  margin-right: var(--space-2);
  padding: 0.1rem 0.6rem;
  border-radius: var(--radius-pill);
  background: #eceff3;
  color: var(--ink-soft);
  font-size: var(--step-small);
}

/* The checkbox stays for keyboard and screen readers; the chip beside it is what is seen. */
.toggle input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.toggle span {
  display: inline-block;
  padding: 0.1rem 0.7rem 0.1rem 1.6rem;
  border: 1px dashed #c3ccd8;
  border-radius: var(--radius-pill);
  color: var(--ink-soft);
  font-size: var(--step-small);
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease,
    border-color 120ms ease;
}

/* A box that fills when the role is held, so an empty one reads as something to switch on. */
.toggle span::before {
  content: '';
  position: absolute;
  top: 0.45rem;
  left: 0.6rem;
  width: 0.7rem;
  height: 0.7rem;
  border: 1px solid #aab5c4;
  border-radius: 3px;
  background: var(--surface);
}

.toggle:hover span {
  border-color: var(--ink-faint);
  color: var(--ink);
}

.toggle input:checked + span {
  border-style: solid;
  border-color: var(--deep);
  background: var(--deep);
  color: white;
}

.toggle input:checked + span::before {
  border-color: white;
  background: white;
}

.toggle input:focus-visible + span {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.toggle input:disabled + span {
  opacity: 0.5;
  cursor: progress;
}

@media (prefers-reduced-motion: reduce) {
  .toggle span {
    transition: none;
  }
}
</style>
