import { Theme, dark, light } from './theme';

/** WCAG 2 relative luminance of #RRGGBB. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('contrast of black on white is 21', () => {
  expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
});

describe.each<[string, Theme]>([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, t) => {
  const grounds = [t.bg, t.surface];

  test('text colours reach 4.5:1 on both backgrounds', () => {
    for (const ground of grounds) for (const text of [t.ink, t.muted, t.danger]) expect(contrast(text, ground)).toBeGreaterThanOrEqual(4.5);
  });

  test('control outlines reach 3:1 on both backgrounds', () => {
    for (const ground of grounds) expect(contrast(t.edge, ground)).toBeGreaterThanOrEqual(3);
  });

  test('habit colours carry a check mark or label in the background colour at 4.5:1', () => {
    for (const habit of t.habit) expect(contrast(t.bg, habit)).toBeGreaterThanOrEqual(4.5);
  });

  test('a frozen cell is outlined at 3:1 against the page', () => {
    expect(contrast(t.frostEdge, t.bg)).toBeGreaterThanOrEqual(3);
  });
});
