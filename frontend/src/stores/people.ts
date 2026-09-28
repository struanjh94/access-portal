import { computed, reactive } from 'vue';
import type { UserSummary } from '../../../shared/contract.js';
import { get } from '../api/client.js';
import { DEMO_ACTORS } from '../demo-actors.js';
import { useActor } from './actor.js';

/** An entry in the switcher: everyone the app knows how to act as. */
export type Selectable = {
  id: string;
  displayName: string;
};

type PeopleState = {
  fetched: UserSummary[];
};

const state = reactive<PeopleState>({ fetched: [] });

/**
 * Loads everyone who can be acted as.
 *
 * As the actor the app started with, not the selected one: switching to somebody
 * without users:read would otherwise empty the switcher and leave no way back out of
 * their account.
 */
async function load(): Promise<void> {
  try {
    state.fetched = await get<UserSummary[]>('/users', useActor().startedAs);
  } catch {
    /* The configured identities still fill the switcher, and the view shows the refusal. */
  }
}

/**
 * The demo identities, plus anyone the API returned that they do not already cover.
 *
 * The configured list is the floor, so the switcher works in any browser whatever the
 * database holds — including when nobody the app knows can read /users. Fetched users
 * supply the rest, so someone created a moment ago can be acted as without a reload.
 */
function selectable(): Selectable[] {
  const fetched = state.fetched.map((user) => ({ id: user.id, displayName: user.displayName }));
  const configured = DEMO_ACTORS.filter((actor) => !fetched.some((user) => user.id === actor.id));

  return [...fetched, ...configured].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * The people the switcher offers.
 *
 * @returns The list as a computed, because load replaces the fetched array rather than
 *   mutating it, plus the loader for callers that have just added someone.
 */
export function usePeople() {
  return {
    people: computed(selectable),
    load,
  };
}
