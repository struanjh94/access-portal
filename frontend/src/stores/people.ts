import { computed, reactive } from 'vue';
import type { UserSummary } from '../../../shared/contract.js';
import { get } from '../api/client.js';
import { useActor } from './actor.js';

type PeopleState = {
  people: UserSummary[];
  error: string | null;
};

const state = reactive<PeopleState>({ people: [], error: null });

/**
 * Loads everyone who can be acted as.
 *
 * As the actor the app started with, not the selected one: switching to somebody
 * without users:read would otherwise empty the switcher and leave no way back out of
 * their account. A previous list is kept on failure for the same reason.
 */
async function load(): Promise<void> {
  try {
    state.people = await get<UserSummary[]>('/users', useActor().startedAs);
    state.error = null;
  } catch (failure) {
    state.error = failure instanceof Error ? failure.message : String(failure);
  }
}

/**
 * The people the switcher offers.
 *
 * @returns The list as a computed, because load replaces the array rather than mutating
 *   it, plus the loader for callers that have just added someone.
 */
export function usePeople() {
  return {
    people: computed(() => state.people),
    peopleError: computed(() => state.error),
    load,
  };
}
