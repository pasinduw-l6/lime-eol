import { keyFor } from './roles.service';

describe('keyFor', () => {
  it.each([
    ['Account manager', 'ACCOUNT_MANAGER'],
    ['  Customer / BA  ', 'CUSTOMER_BA'],
    ['QA-team 2', 'QA_TEAM_2'],
    ['***', ''],
  ])('turns %p into %p', (name, key) => {
    expect(keyFor(name)).toBe(key);
  });
});
