import { computed, reactive } from 'vue';
import type { Role } from '../../../shared/contract.js';
import { get } from '../api/client.js';

type RolesState = {
  catalogue: Role[];
};

/*
 * Shared because two places need the same list: the panel showing what roles exist, and
 * the toggles that grant them. Fetching it twice would be two answers to one question.
 */
const state = reactive<RolesState>({ catalogue: [] });

/**
 * Loads the roles that can be granted, as the given actor.
 *
 * A failure empties the catalogue rather than throwing: reading roles is gated on
 * roles:read, and a caller who cannot read them still has a page to render.
 *
 * @param actorId The actor to load as.
 */
async function load(actorId: string): Promise<void> {
  try {
    state.catalogue = await get<Role[]>('/roles', actorId);
  } catch {
    state.catalogue = [];
  }
}

/**
 * The role catalogue, and the questions views ask of it.
 *
 * @returns The catalogue as a computed, because load replaces the array rather than
 *   mutating it and a plain reference would be a snapshot. Lookups fall back to the key
 *   when the catalogue is empty, so a table still reads without it.
 */
export function useRoles() {
  return {
    roles: computed(() => state.catalogue),
    load,
    nameFor: (key: string) => state.catalogue.find((role) => role.key === key)?.name ?? key,
    descriptionFor: (key: string) =>
      state.catalogue.find((role) => role.key === key)?.description ?? '',
  };
}
