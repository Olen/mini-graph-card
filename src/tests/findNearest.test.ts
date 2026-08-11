/**
 * Tests for findNearestPoint() & findNearestBar() - the selection logic behind
 * "hover_mode: nearest".
 *
 * The rule under test: the cursor's X decides WHICH BUCKET (i.e. which moment in
 * time) is selected, and its Y decides WHICH ENTITY. Moving the cursor straight
 * up or down must never change the selected bucket.
 */

import { expect, describe, it } from 'vitest';
import { findNearestPoint, findNearestBar } from '../others';

// A point is [x, y, value, bucketIndex] - see Graph.getPoints().
// Two entities sampled on the same X grid; "TOP" sits above "BOTTOM" everywhere.
const TOP = [
  [0, 10, 1.0, 0],
  [100, 20, 2.0, 1],
  [200, 10, 3.0, 2],
  [300, 20, 4.0, 3],
];
const BOTTOM = [
  [0, 110, 11.0, 0],
  [100, 120, 12.0, 1],
  [200, 110, 13.0, 2],
  [300, 120, 14.0, 3],
];

describe('findNearestPoint', () => {
  describe('a single entity', () => {
    it('selects the X-nearest point when the cursor is far above the curve', () => {
      // The whole point of the feature: no need to hit the 3px circle.
      expect(findNearestPoint([TOP], 205, 0)).toMatchObject({ entity: 0, point: TOP[2] });
    });

    it('selects the X-nearest point when the cursor is far below the curve', () => {
      expect(findNearestPoint([TOP], 205, 500)).toMatchObject({ entity: 0, point: TOP[2] });
    });

    it('picks the closer of two neighbouring points', () => {
      expect(findNearestPoint([TOP], 140, 0)).toMatchObject({ point: TOP[1] });
      expect(findNearestPoint([TOP], 160, 0)).toMatchObject({ point: TOP[2] });
    });

    it('snaps to the first/last point outside the data range', () => {
      expect(findNearestPoint([TOP], -50, 50)).toMatchObject({ point: TOP[0] });
      expect(findNearestPoint([TOP], 9999, 50)).toMatchObject({ point: TOP[3] });
    });

    it('resolves an exact tie deterministically', () => {
      // 150 is equidistant from 100 & 200; the earlier point wins, always.
      expect(findNearestPoint([TOP], 150, 0)).toMatchObject({ point: TOP[1] });
      expect(findNearestPoint([TOP], 150, 0)).toMatchObject({ point: TOP[1] });
    });

    it('handles a series holding a single point', () => {
      const single = [[42, 10, 1.0, 0]];
      expect(findNearestPoint([single], 0, 0)).toMatchObject({ point: single[0] });
    });
  });

  describe('several entities', () => {
    it('selects the entity whose curve the cursor is closest to', () => {
      expect(findNearestPoint([TOP, BOTTOM], 200, 15)).toMatchObject({ entity: 0, point: TOP[2] });
      expect(findNearestPoint([TOP, BOTTOM], 200, 105)).toMatchObject({ entity: 1, point: BOTTOM[2] });
    });

    it('keeps the same bucket while the cursor moves vertically', () => {
      // Time must not slide about as the cursor crosses from one curve to another.
      const bucket = (y: number) => findNearestPoint([TOP, BOTTOM], 205, y).point[3];
      expect([0, 30, 60, 90, 200, 500].map(bucket)).toEqual([2, 2, 2, 2, 2, 2]);
    });

    it('switches entity exactly at the midpoint between the curves', () => {
      // TOP is at y=10, BOTTOM at y=110 for bucket 2 - the boundary is y=60.
      expect(findNearestPoint([TOP, BOTTOM], 200, 59).entity).toBe(0);
      expect(findNearestPoint([TOP, BOTTOM], 200, 61).entity).toBe(1);
    });

    it('ignores an entity whose data does not reach the cursor', () => {
      // LATE only covers the right-hand quarter. With the cursor on the far left
      // its nearest point lies 250px away, so it must not win on Y alone even
      // though its Y is a perfect match.
      const LATE = [
        [250, 10, 9.0, 0],
        [300, 10, 9.5, 1],
      ];
      expect(findNearestPoint([BOTTOM, LATE], 0, 10)).toMatchObject({ entity: 0, point: BOTTOM[0] });
    });

    it('still selects a distant entity when no series covers the cursor', () => {
      // Past the end of all data, fall back to the globally X-nearest point.
      const LATE = [[250, 10, 9.0, 0]];
      expect(findNearestPoint([LATE], 9999, 500)).toMatchObject({ entity: 0, point: LATE[0] });
    });

    it('prefers the entity sampled closest in X when their Y ties', () => {
      const SPARSE = [
        [0, 10, 1.0, 0],
        [300, 10, 2.0, 1],
      ];
      // Both candidates sit at y=10; TOP has a point at x=200, SPARSE only at 300.
      expect(findNearestPoint([SPARSE, TOP], 200, 10)).toMatchObject({ entity: 1, point: TOP[2] });
    });
  });

  describe('missing series', () => {
    it('skips entities with no data', () => {
      const sparse = [undefined, TOP, [], null];
      expect(findNearestPoint(sparse, 200, 0)).toMatchObject({ entity: 1, point: TOP[2] });
    });

    it('returns undefined when nothing is plotted', () => {
      expect(findNearestPoint([], 0, 0)).toBeUndefined();
      expect(findNearestPoint([undefined, []], 0, 0)).toBeUndefined();
    });
  });
});

// A bar is {x, y, height, width, value}, x being its LEFT edge - see Graph.getBars().
// Two entities drawn side by side within each group, as with a positive bar_spacing.
const BARS_A = [
  { x: 0, y: 80, height: 20, width: 10, value: 1.0 },
  { x: 40, y: 60, height: 40, width: 10, value: 2.0 },
];
const BARS_B = [
  { x: 10, y: 90, height: 10, width: 10, value: 11.0 },
  { x: 50, y: 70, height: 30, width: 10, value: 12.0 },
];

describe('findNearestBar', () => {
  it('selects the bar under the cursor', () => {
    expect(findNearestBar([BARS_A, BARS_B], 5, 50)).toMatchObject({ entity: 0, index: 0 });
    expect(findNearestBar([BARS_A, BARS_B], 15, 50)).toMatchObject({ entity: 1, index: 0 });
    expect(findNearestBar([BARS_A, BARS_B], 55, 50)).toMatchObject({ entity: 1, index: 1 });
  });

  it('selects a bar from above its top edge', () => {
    // The reason bars need this too: there is nothing to hover above a short bar.
    expect(findNearestBar([BARS_A, BARS_B], 15, 0)).toMatchObject({ entity: 1, index: 0 });
  });

  it('falls back to the nearest bar when the cursor is in a gap', () => {
    // Nothing is drawn between x=20 & x=40, so the halfway mark decides.
    expect(findNearestBar([BARS_A, BARS_B], 25, 50)).toMatchObject({ entity: 1, index: 0 });
    expect(findNearestBar([BARS_A, BARS_B], 35, 50)).toMatchObject({ entity: 0, index: 1 });
  });

  it('uses Y to choose between bars stacked on the same X (bar_spacing: -1)', () => {
    const OVER_A = [{ x: 0, y: 20, height: 80, width: 20, value: 1.0 }];
    const OVER_B = [{ x: 0, y: 70, height: 30, width: 20, value: 2.0 }];
    expect(findNearestBar([OVER_A, OVER_B], 10, 30).entity).toBe(0);
    expect(findNearestBar([OVER_A, OVER_B], 10, 90).entity).toBe(1);
  });

  it('skips entities with no bars & returns undefined when there are none', () => {
    expect(findNearestBar([undefined, BARS_B], 15, 50)).toMatchObject({ entity: 1 });
    expect(findNearestBar([undefined, []], 0, 0)).toBeUndefined();
  });
});
