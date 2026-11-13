'use strict';
/* Centre-orientation fixing for the picture cube.
   Facts (machine-verified in dev/test-centre.js):
   - A centre's rotation (CW quarter turns viewed from outside) changes ONLY when its own
     face is turned, by exactly the turn amount. Centre rotations are therefore additive:
     rot(seq) per face = net CW quarter turns of that face in seq.
   - An appended sequence fixes centres iff its cubie permutation is identity and its
     net-turn vector cancels the residual.
   Generators below are identity-permutation macros found by computational search and each
   is re-verified at runtime: fixFor() simulates the full fix on the geometric model and
     returns null unless the result is fully solved (positions + centre orientations).
*/
const _coreC = (typeof module !== 'undefined') ? require('./cube-core.js') : null;
const CubeStateC = (typeof CubeState !== 'undefined') ? CubeState : _coreC.CubeState;
const parseSeqC = (typeof parseSeq !== 'undefined') ? parseSeq : _coreC.parseSeq;
const seqToStringC = (typeof seqToString !== 'undefined') ? seqToString : _coreC.seqToString;
const POS6 = ['U', 'D', 'F', 'B', 'L', 'R'];

// 180-degree single-centre macros: (X Y T2 X' Y' T) x2, 12 moves, verified per face.
const SINGLE_180 = {
  U: "R L U2 R' L' U R L U2 R' L' U",
  D: "R L D2 R' L' D R L D2 R' L' D",
  F: "U D F2 U' D' F U D F2 U' D' F",
  B: "U D B2 U' D' B U D B2 U' D' B",
  L: "U D L2 U' D' L U D L2 U' D' L",
  R: "U D R2 U' D' R U D R2 U' D' R",
};
// Searched identity-permutation macros: [phiVector(U,D,F,B,L,R), moveString]
const EXTRA_GENERATORS = [
  [[1, 0, 0, 3, 0, 0], "B R U' R' B R U' R' B R U' R' B R U' R' B R U' R' B R U' R' B R U' R'"], // U-B pair, 28
  [[0, 3, 0, 0, 0, 1], "R' B D B' R' B D B' R' B D B' R' B D B' R' B D B' R' B D B' R' B D B'"], // R-D pair, 28
  [[0, 0, 1, 0, 1, 0], "F2 D L' D' F F2 D L' D' F F2 D L' D' F F2 D L' D' F F2 D L' D' F F2 D L' D' F F2 D L' D' F"], // F+L pair, 35
  [[0, 3, 0, 0, 1, 0], "F2 D F' L' F' F2 D F' L' F' F2 D F' L' F' F2 D F' L' F' F2 D F' L' F' F2 D F' L' F' F2 D F' L' F'"], // L-D pair, 35
];
let _gens = null;
function generators() {
  if (_gens) return _gens;
  _gens = [];
  for (const T of POS6) {
    const phi = [0, 0, 0, 0, 0, 0]; phi[POS6.indexOf(T)] = 2;
    _gens.push({ phi, moves: parseSeqC(SINGLE_180[T]) });
  }
  for (const [phi, str] of EXTRA_GENERATORS) _gens.push({ phi, moves: parseSeqC(str) });
  // Catalogue from dev search (if a larger catalogue is present as a global AKI_CATALOGUE, use it too.)
  if (typeof AKI_CATALOGUE !== 'undefined') for (const e of AKI_CATALOGUE) _gens.push({ phi: e.phi, moves: parseSeqC(e.moves) });
  // Add the inverse of every generator (same length, negated phi): much cheaper than applying a generator 3 times.
  const base = _gens.slice();
  for (const g of base) {
    const invMoves = g.moves.slice().reverse().map(m => ({ face: m.face, power: (4 - m.power) % 4 }));
    _gens.push({ phi: g.phi.map(x => (4 - x) % 4), moves: invMoves });
  }
  return _gens;
}
let _dijkstra = null;
function buildDijkstra() {
  if (_dijkstra) return _dijkstra;
  const gens = generators();
  const N = 4096;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const prevGen = new Int16Array(N).fill(-1);
  const key = (v) => { let k = 0; for (let i = 0; i < 6; i++) k = k * 4 + v[i]; return k; };
  const unkey = (k) => { const v = new Array(6); for (let i = 5; i >= 0; i--) { v[i] = k % 4; k = Math.floor(k / 4); } return v; };
  dist[0] = 0;
  const pq = [[0, 0]]; // [dist, state]
  while (pq.length) {
    let bi = 0; for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[bi][0]) bi = i;
    const [d, s] = pq.splice(bi, 1)[0];
    if (d > dist[s]) continue;
    const v = unkey(s);
    for (let gi = 0; gi < gens.length; gi++) {
      const g = gens[gi];
      const nv = v.map((x, i) => (x + g.phi[i]) % 4);
      const ns = key(nv);
      const nd = d + g.moves.length;
      if (nd < dist[ns]) { dist[ns] = nd; prev[ns] = s; prevGen[ns] = gi; pq.push([nd, ns]); }
    }
  }
  _dijkstra = { dist, prev, prevGen, key };
  return _dijkstra;
}
// residual: {U:0..3, D:.., F:.., B:.., L:.., R:..} CW quarter turns still needed to REMOVE.
// Returns move list whose net-turn vector cancels the residual, with identity permutation,
// or null if unreachable. Every returned sequence is verified against the geometric model
// by solveWithCentres() before it is ever shown.
function fixFor(residual) {
  const D = buildDijkstra();
  const gens = generators();
  const target = POS6.map(p => (4 - (residual[p] % 4)) % 4);
  const tk = D.key(target);
  if (!isFinite(D.dist[tk])) return null;
  const chain = [];
  let s = tk;
  while (s !== 0) { const gi = D.prevGen[s]; chain.push(gi); s = D.prev[s]; }
  chain.reverse();
  const moves = [];
  for (const gi of chain) moves.push(...gens[gi].moves);
  return moves;
}
// Full pipeline: state (CubeState, positions possibly scrambled, centres observed) ->
// { ok, moves } such that applying moves yields a FULLY solved cube, verified by simulation.
// solverSolve: function(faceletString) -> { ok, moves } position solver (solver.js solve()).
function solveWithCentres(state, solverSolve) {
  const fc = state.toFaceletString();
  const res = solverSolve(fc);
  if (!res.ok) return res;
  const after = state.clone().applySeq(seqToStringC(res.moves));
  const residual = after.centerRotations();
  let fix = [];
  if (Object.values(residual).some(v => v !== 0)) {
    fix = fixFor(residual);
    if (!fix) return { ok: false, errors: ['中心の向きを直す手順が見つかりませんでした'] };
  }
  const all = [...res.moves, ...fix];
  const check = state.clone().applySeq(seqToStringC(all));
  if (!check.isFullySolved()) return { ok: false, errors: ['検証で完全解に到達しませんでした'] };
  return { ok: true, moves: all, positionMoves: res.moves.length, centreFixMoves: fix.length, residual };
}
if (typeof module !== 'undefined') module.exports = { fixFor, solveWithCentres, generators, SINGLE_180 };
