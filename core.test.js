import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from './src/core.js';

const cellsOf = b => C.emptyCells(b).flat().filter(Boolean).length;

test('hex board sizes and centring', () => {
  assert.equal(cellsOf({ shape: 'hex', n: 1 }), 1);
  assert.equal(cellsOf({ shape: 'hex', n: 2 }), 7);
  for (let n = 1; n <= 20; n++) {
    assert.equal(cellsOf({ shape: 'hex', n }), 3 * n * n - 3 * n + 1);
    const mean = r => { const { start, width } = C.hexRow(n, r); return start + (width - 1) / 2 + C.rowOffset('bond', r); };
    for (let r = 0; r < 2 * n - 1; r++) {
      const { start, width } = C.hexRow(n, r);
      assert.ok(Number.isInteger(start) && start >= 0 && start + width <= 2 * n - 1);
      assert.equal(mean(r), mean(n - 1), `n=${n} r=${r} not centred`);
    }
  }
});

test('bond neighbours are symmetric', () => {
  for (let r = 0; r < 6; r++) for (let c = 1; c < 6; c++)
    for (const [y, x] of C.neighbors('bond', r, c))
      assert.ok(C.neighbors('bond', y, x).some(([a, b]) => a === r && b === c));
});

test('stack ops', () => {
  const cells = C.emptyCells({ shape: 'rect', w: 2, h: 1 });
  assert.ok(C.paint(cells, 0, 0, 3));
  assert.deepEqual(cells[0][0], [3]);
  assert.ok(!C.paint(cells, 0, 0, 3));
  for (let i = 0; i < 10; i++) C.stackOn(cells, 0, 0, i);
  assert.equal(cells[0][0].length, C.MAX_LAYERS);
  C.paint(cells, 0, 0, 9);
  assert.equal(C.top(cells[0][0]), 9);
  assert.ok(C.erase(cells, 0, 0));
  assert.equal(cells[0][0].length, C.MAX_LAYERS - 1);
  assert.ok(!C.erase(cells, 0, 1));
  assert.ok(!C.paint(cells, 5, 5, 1));
});

test('flood fill', () => {
  const cells = C.emptyCells({ shape: 'rect', w: 3, h: 3 });
  assert.equal(C.fill(cells, 'straight', 1, 1, 0), 9);
  C.paint(cells, 0, 1, 1); C.paint(cells, 1, 0, 1); // wall off the corner
  assert.equal(C.fill(cells, 'straight', 0, 0, 2), 1);
  assert.equal(C.fill(cells, 'bond', 2, 2, 2), 6); // bond row 1 (odd) touches row 0 cols 1,2 -> corner joins
});

test('photo import: slide under / overwrite', () => {
  const cells = C.emptyCells({ shape: 'rect', w: 2, h: 1 });
  C.paint(cells, 0, 0, 5);
  assert.ok(C.slideUnder(cells, [[1, -1]]));
  assert.deepEqual(cells[0], [[1, 5], []]);
  for (let i = 0; i < 8; i++) C.stackOn(cells, 0, 0, 0);
  const before = JSON.stringify(cells);
  assert.ok(!C.slideUnder(cells, [[1, 1]]));
  assert.equal(JSON.stringify(cells), before);
  C.overwrite(cells, [[2, -1]]);
  assert.deepEqual(cells[0], [[2], []]);
});

test('resize keeps content centred and round-trips', () => {
  const fillAll = b => { const c = C.emptyCells(b); C.each(c, (s, r, k) => s.push(r * 1000 + k)); return c; };
  for (const [a, b, lat] of [
    [{ shape: 'rect', w: 4, h: 4 }, { shape: 'rect', w: 7, h: 6 }, 'straight'],
    [{ shape: 'rect', w: 5, h: 5 }, { shape: 'rect', w: 6, h: 6 }, 'bond'],
    [{ shape: 'hex', n: 2 }, { shape: 'hex', n: 3 }, 'bond'],
    [{ shape: 'hex', n: 4 }, { shape: 'hex', n: 7 }, 'bond'],
  ]) {
    const orig = fillAll(a);
    const big = C.resize(orig, a, b, lat);
    assert.equal(C.counts(big).size, cellsOf(a), `${JSON.stringify(b)} lost cells`);
    assert.deepEqual(C.resize(big, b, a, lat), orig);
  }
});

test('colors', () => {
  assert.equal(C.parseColor('#ABC'), '#aabbcc');
  assert.equal(C.parseColor('f4b000'), '#f4b000');
  assert.equal(C.parseColor('rgb(255, 0, 10)'), '#ff000a');
  assert.equal(C.parseColor('12 34 56'), '#0c2238');
  assert.equal(C.parseColor('300,0,0'), null);
  assert.equal(C.parseColor('nope'), null);
  const pal = ['#000000', '#ffffff', '#c91a09', '#0055bf'].map(hex => ({ hex }));
  const labs = pal.map(p => C.oklab(C.hexToRgb(p.hex)));
  assert.equal(C.nearest(C.oklab([200, 30, 20]), labs), 2);
  assert.equal(C.nearest(C.oklab([10, 80, 200]), labs), 3);
});

test('quantize + dither', () => {
  const pal = [{ hex: '#000000' }, { hex: '#ffffff' }];
  const gray = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => [128, 128, 128, 255]));
  const flat = C.quantize(gray, pal, false).flat();
  assert.equal(new Set(flat).size, 1);
  const whites = C.quantize(gray, pal, true).flat().filter(i => i === 1).length;
  assert.ok(whites > 35 && whites < 65, `dither gave ${whites}/100 white`);
  assert.deepEqual(C.quantize([[null, [0, 0, 0, 0], [250, 250, 250, 255]]], pal), [[null, -1, 1]]);
  assert.deepEqual(C.quantize([[[1, 2, 3, 255]]], []), [[-1]]);
});

test('averageBox weights by alpha', () => {
  const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 0]); // red opaque, blue transparent
  assert.deepEqual(C.averageBox(data, 2, 1, 1, 0.5, 1).slice(0, 3), [255, 0, 0]);
  assert.equal(C.averageBox(data, 2, 1, 50, 50, 1)[3], 0);
});

test('labels and removeColor', () => {
  assert.deepEqual([0, 25, 26, 27, 701, 702].map(C.label), ['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  const cells = [[[0, 2], [3]], [null, [1]]];
  C.removeColor(cells, 1);
  assert.deepEqual(cells, [[[0, 1], [2]], [null, [1]]]);
  assert.deepEqual([...C.labels([[[2, 2], [5]]])], [[2, 'A'], [5, 'B']]);
});

test('flood clear and clearColor', () => {
  const cells = C.emptyCells({ shape: 'rect', w: 3, h: 1 });
  C.paint(cells, 0, 0, 1); C.paint(cells, 0, 1, 1); C.paint(cells, 0, 2, 2);
  C.stackOn(cells, 0, 0, 1); // column [1,1]: clear must only remove the top once
  assert.equal(C.fill(cells, 'straight', 0, 0, -1), 2);
  assert.deepEqual(cells[0], [[1], [], [2]]);
  assert.equal(C.fill(cells, 'straight', 0, 1, -1), 0); // clearing empty does nothing
  const c2 = [[[3, 1, 1], [1], [2]]];
  assert.equal(C.clearColor(c2, 1), 3);
  assert.deepEqual(c2, [[[3], [], [2]]]);
});

test('stacking respects the part', () => {
  const cells = C.emptyCells({ shape: 'rect', w: 1, h: 1 });
  C.paint(cells, 0, 0, 0);
  assert.ok(!C.stackOn(cells, 0, 0, 1, C.layersFor({ medium: 'lego', part: 'round' })));
  assert.ok(C.stackOn(cells, 0, 0, 1, C.layersFor({ medium: 'lego', part: 'plate' })));
  assert.ok(C.stackable({ medium: 'lego' }) && !C.stackable({ medium: 'perler' }) && !C.stackable({ medium: 'lego', part: 'tile' }));
});

test('quantize skips colors marked unused', () => {
  const pal = [{ hex: '#000000' }, { hex: '#ff0000', use: false }, { hex: '#ffffff' }];
  assert.deepEqual(C.quantize([[[90, 0, 0, 255], [255, 255, 255, 255]]], pal), [[0, 2]]); // dark red falls back to black, never the disabled red
  assert.deepEqual(C.quantize([[[250, 0, 0, 255]]], pal.map(p => ({ ...p, use: false }))), [[-1]]);
});

test('validateDesign', () => {
  const ok = { medium: 'perler', lattice: 'straight', board: { shape: 'rect', w: 2, h: 1 }, palette: [{ name: 'A', hex: '#000000' }], cells: [[[0], []]] };
  const v = d => C.validateDesign(d, ['perler', 'lego'], ['plate', 'tile', 'round']);
  assert.equal(v(ok), null);
  assert.match(v({ ...ok, cells: [[[1], []]] }), /missing color/);
  assert.match(v({ ...ok, cells: [[[0, 0], []]] }), /bad cell/);
  assert.equal(v({ ...ok, medium: 'lego', part: 'plate', cells: [[[0, 0], []]] }), null);
  assert.match(v({ ...ok, cells: [[[0]]] }), /does not match/);
  assert.match(v({ ...ok, board: { shape: 'rect', w: 500, h: 1 } }), /board/);
  assert.match(v({ ...ok, medium: 'cake' }), /unknown medium/);
  assert.match(v({ ...ok, palette: [{ name: 'A', hex: 'red' }] }), /palette/);
  const hex = { ...ok, lattice: 'bond', board: { shape: 'hex', n: 2 }, cells: C.emptyCells({ shape: 'hex', n: 2 }) };
  assert.equal(v(hex), null);
  assert.match(v({ ...hex, cells: hex.cells.map(r => r.map(() => [])) }), /shape/);
  assert.match(v(null), /not a design/);
});
