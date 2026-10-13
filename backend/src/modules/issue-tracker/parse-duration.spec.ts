import { parseDuration } from './duration';

describe('parseDuration', () => {
  it.each([
    ['30m', 1800],
    ['2h', 7200],
    ['1h 30m', 5400],
    ['1h30m', 5400],
    ['1.5h', 5400],
    ['1d', 8 * 3600],
    ['1w', 40 * 3600],
    ['2', 7200],
    [' 4H ', 4 * 3600],
  ])('reads %s as %d seconds', (input, seconds) => {
    expect(parseDuration(input)).toBe(seconds);
  });

  it.each(['', 'soon', '2 hours', '0h', 'h', '3x'])('refuses %p', (input) => {
    expect(parseDuration(input)).toBeNull();
  });
});
