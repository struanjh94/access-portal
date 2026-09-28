import { computed, reactive, readonly } from 'vue';
import type { Actor } from '../../../shared/contract.js';
import type { PermissionKey } from '../../../shared/permissions.js';
import { get } from '../api/client.js';
import { DEFAULT_ACTOR_ID } from '../demo-actors.js';

type ActorState = {
  id: string;
  actor: Actor | null;
  loading: boolean;
  error: string | null;
};

/**
 * The actor named in the URL, if there is one.
 *
 * The switcher can only be filled by someone holding users:read, so stripping the
 * default admin's roles leaves no way back through the interface. This is that way
 * back, and it also makes a link that opens the app as a particular person.
 */
function actorFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('actor');
}

/*
 * Held in memory rather than localStorage, so a reload returns to the default admin
 * unless the URL names someone. A selected actor with no permissions would otherwise
 * be stranded with no way back.
 */
const state = reactive<ActorState>({
  id: actorFromUrl() ?? DEFAULT_ACTOR_ID,
  actor: null,
  loading: false,
  error: null,
});

/**
 * Loads the selected actor's roles and resolved permissions from GET /me.
 *
 * Failures are held as a message rather than thrown: an unknown or malformed actor id
 * leaves the app rendering nothing, so the shell needs something to display.
 */
/* Who the app opened as, which is who fills the switcher however the actor changes. */
const STARTED_AS = state.id;

async function load(): Promise<void> {
  state.loading = true;
  state.error = null;

  try {
    state.actor = await get<Actor>('/me', state.id);
  } catch (error) {
    state.actor = null;
    state.error = error instanceof Error ? error.message : String(error);
  } finally {
    state.loading = false;
  }
}

/**
 * Switches actor and reloads their permissions.
 *
 * @param id The user to act as, from the switcher.
 */
async function select(id: string): Promise<void> {
  state.id = id;
  await load();
}

/**
 * Whether the current actor holds a permission.
 *
 * The frontend asks this to decide what to render; the API asks it again on every
 * request, so hiding a control is a courtesy rather than the enforcement.
 *
 * @param permission The key to check.
 */
function can(permission: PermissionKey): boolean {
  return state.actor?.permissions.includes(permission) ?? false;
}

/**
 * The selected actor, and the questions the views ask about them.
 *
 * @returns Read-only state, so a view cannot assign to it and diverge from GET /me,
 *   plus the actions that can.
 */
export function useActor() {
  return {
    state: readonly(state),
    actorId: computed(() => state.id),
    startedAs: STARTED_AS,
    load,
    select,
    can,
  };
}
