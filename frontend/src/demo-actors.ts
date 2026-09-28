/**
 * The identities the actor switcher offers before, or instead of, asking the API.
 *
 * The switcher stands in for single sign-on, which a real deployment would resolve from
 * the session. Its list therefore comes from configuration rather than from the API:
 * GET /users needs users:read, so an actor holding no roles would empty the switcher
 * and leave no way to become anyone else. These are the seeded accounts from
 * 002_seed.sql; the API still authorises every request whoever is selected, so this
 * grants nothing.
 */
export type DemoActor = {
  id: string;
  displayName: string;
};

export const DEMO_ACTORS: DemoActor[] = [
  { id: '11111111-1111-4111-8111-111111111111', displayName: 'Ada Lovelace' },
  { id: '22222222-2222-4222-8222-222222222222', displayName: 'Grace Hopper' },
  { id: '33333333-3333-4333-8333-333333333333', displayName: 'Alan Turing' },
  { id: '44444444-4444-4444-8444-444444444444', displayName: 'Katherine Johnson' },
  { id: '55555555-5555-4555-8555-555555555555', displayName: 'Margaret Hamilton' },
  { id: '66666666-6666-4666-8666-666666666666', displayName: 'Barbara Liskov' },
];

/* The app opens as this one, the seeded administrator. */
export const DEFAULT_ACTOR_ID = DEMO_ACTORS[0]?.id ?? '';
