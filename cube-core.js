'use strict';
/* Akihabara Cube - geometric sticker model (shared: browser app + Node tests)
   Frame (reference holding H1): A front (artwork upright), E top.
   (Changed 2026-11-14 from H0 "A front, F top" -- in H0 the A artwork was
   upside down, which contradicted the natural holding; the user's photo of
   the real cube (A upright, B on its right) matches H1. H1 = H0 rotated
   180 degrees about the front axis: U<->D and R<->L home faces swap.)
   Axes: x=right, y=up, z=front.
   Position faces (solver letters): U,D,F,B,L,R.
   Display faces (map areas): A,B,C,D,E,F.
   Home assignment: A->F, B->R, C->B, D->L, E->U, F->D.
   Image-up vectors in H1 frame (H0 vectors rotated 180 deg about z):
     A:(0,1,0) C:(0,-1,0) F:(0,0,1) E:(0,0,1) B:(0,0,1) D:(0,0,1)
*/
const POS_NORMAL = {
  U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], L: [-1, 0, 0], R: [1, 0, 0],
};
const FACE_HOME_POS = { A: 'F', B: 'R', C: 'B', D: 'L', E: 'U', F: 'D' };
const POS_HOME_FACE = { F: 'A', R: 'B', B: 'C', L: 'D', U: 'E', D: 'F' };
const FACE_IMAGE_UP = {
  A: [0, 1, 0], B: [0, 0, 1], C: [0, -1, 0], D: [0, 0, 1], E: [0, 0, 1], F: [0, 0, 1],
};
const FACE_INFO = {
  A: { name: '秋葉原駅前', center: '「モモーイ時計」の文字',
       marks: ['秋葉原駅', 'モモーイ時計', '秋葉原ラジオ会館', '秋葉原ラジオセンター', '中央通り', '万世橋警察署', 'ワシントンホテル', 'ニュー秋葉原センター', '万世橋', 'AKIHABARA'] },
  B: { name: '神田明神下', center: '「あっとほぉーむカフェ」の文字',
       marks: ['あっとほぉーむカフェ 秋葉原本店', 'AKIBAカルチャーズZONE', '千石電商', 'スーパーポテト', 'ラホール', '九州じゃんがら 秋葉原本店', 'ドスパラ秋葉原本店', 'ジャンク通り', '昌平通り', '神田明神下', '明神下 神田川本店'] },
  C: { name: 'ヨドバシ・書泉', center: '「ヨドバシカメラ マルチメディアAkiba」の文字',
       marks: ['ヨドバシカメラ マルチメディアAkiba', '書泉ブックタワー', '秋葉公園', '昭和通り', 'チンタジャワカフェ', '東口交通広場', 'TX01'] },
  D: { name: '神田川', center: '斜めに流れる神田川',
       marks: ['神田川', '神田郵便局', 'かんだやぶそば', 'マーチエキュート 万世橋', '万世橋', '昌平橋', '計測器ランド', '国道17号', '東京ラジオデパート', '© OpenStreetMap contributors'] },
  E: { name: 'UDX・ダイビル', center: '秋葉原UDX（緑のビル）',
       marks: ['秋葉原UDX', '秋葉原ダイビル', 'ビックカメラAKIBA', 'アニメイト秋葉原', 'ドン・キホーテ秋葉原店', 'SEEKBASE', '神田消防署', '中央通り'] },
  F: { name: '末広町', center: '「ハードオフ」の文字とゲームコントローラーの絵',
       marks: ['末広町駅 G14', 'ハードオフ', '秋葉原ガチャポン会館', 'あきばお〜', 'U&J Macs', '過橋米線', '蔵前通り', '中央通り', 'ジャンク通り', '芳林公園', 'スターケバブ', '牛丼サンボ', '駿河屋 アニメ・ホビー館', 'e☆イヤホン'] },
};
// Neighbours of each display face in its upright photo orientation: [top, right, bottom, left]
const FACE_NEIGHBORS = {
  A: ['E', 'B', 'F', 'D'], B: ['A', 'E', 'C', 'F'], C: ['F', 'B', 'E', 'D'],
  D: ['A', 'F', 'C', 'E'], E: ['A', 'D', 'C', 'B'], F: ['A', 'B', 'C', 'D'],
};
const OPPOSITE = { A: 'C', C: 'A', B: 'D', D: 'B', E: 'F', F: 'E' };

function vAdd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function vScale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function vEq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
function vDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function vCross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function vKey(a) { return a.join(','); }
function axisOfNormal(n) {
  for (let i = 0; i < 3; i++) if (n[i] !== 0) return { axis: i, sign: n[i] };
  throw new Error('zero normal');
}

class CubeState {
  constructor(stickers) { this.stickers = stickers; }
  static solved() {
    const stickers = [];
    for (const face of ['A', 'B', 'C', 'D', 'E', 'F']) {
      const pos = FACE_HOME_POS[face];
      const n = POS_NORMAL[pos];
      const u = FACE_IMAGE_UP[face];
      const r = vCross(u, n); // screen-right of image: r = u x n  (front face check: y x z = x OK)
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        const p = vAdd(vAdd(n, vScale(r, col - 1)), vScale(u, 1 - row));
        stickers.push({ home: face, row, col, pos: p, n: [...n], u: [...u] });
      }
    }
    return new CubeState(stickers);
  }
  clone() {
    return new CubeState(this.stickers.map(s => ({ home: s.home, row: s.row, col: s.col, pos: [...s.pos], n: [...s.n], u: [...s.u] })));
  }
  // move: position letter U/D/F/B/L/R, power 1 (CW from outside), 2, 3 (CCW)
  applyMove(move, power = 1) {
    const n = POS_NORMAL[move];
    const { axis, sign } = axisOfNormal(n);
    for (const s of this.stickers) {
      if (vDot(s.pos, n) === 1) {
        s.pos = rotVecSteps(s.pos, axis, sign, power, true);
        s.n = rotVecSteps(s.n, axis, sign, power, true);
        s.u = rotVecSteps(s.u, axis, sign, power, true);
      }
    }
    return this;
  }
  applySeq(seq) {
    for (const tok of parseSeq(seq)) this.applyMove(tok.face, tok.power);
    return this;
  }
  // sticker currently at cubie position pos with outward normal n
  at(pos, n) {
    return this.stickers.find(s => vEq(s.pos, pos) && vEq(s.n, n)) || null;
  }
  isPositionSolved() {
    return this.stickers.every(s => vEq(s.pos, homePosOf(s)) && vEq(s.n, POS_NORMAL[FACE_HOME_POS[s.home]]));
  }
  isFullySolved() {
    return this.stickers.every(s => vEq(s.pos, homePosOf(s)) && vEq(s.n, POS_NORMAL[FACE_HOME_POS[s.home]]) && vEq(s.u, FACE_IMAGE_UP[s.home]));
  }
  // centre rotation (clockwise quarter turns viewed from outside) per position letter; 0 = correct
  centerRotations() {
    const out = {};
    for (const pos of ['U', 'D', 'F', 'B', 'L', 'R']) {
      const face = POS_HOME_FACE[pos];
      const c = this.stickers.find(s => s.home === face && s.row === 1 && s.col === 1);
      const n = POS_NORMAL[pos];
      const uh = FACE_IMAGE_UP[face], uc = c.u;
      const cos = vDot(uh, uc);
      const sinRH = vDot(vCross(uh, uc), n); // sin of RH angle from uh to uc about +n
      let cw; // clockwise (viewed from outside) quarter turns from home to current
      if (cos === 1) cw = 0; else if (cos === -1) cw = 2; else if (sinRH === 1) cw = 3; else cw = 1;
      out[pos] = cw;
    }
    return out;
  }
  // Kociemba facelet string, order U1..U9 R1..R9 F1..F9 D1..D9 L1..L9 B1..B9 (position letters)
  toFaceletString() {
    const VIEW = {
      U: { vu: [0, 0, -1], vr: [1, 0, 0] }, D: { vu: [0, 0, 1], vr: [1, 0, 0] },
      F: { vu: [0, 1, 0], vr: [1, 0, 0] }, B: { vu: [0, 1, 0], vr: [-1, 0, 0] },
      L: { vu: [0, 1, 0], vr: [0, 0, 1] }, R: { vu: [0, 1, 0], vr: [0, 0, -1] },
    };
    let out = '';
    for (const pos of ['U', 'R', 'F', 'D', 'L', 'B']) {
      const n = POS_NORMAL[pos]; const { vu, vr } = VIEW[pos];
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        const p = vAdd(vAdd(n, vScale(vr, col - 1)), vScale(vu, 1 - row));
        const s = this.at(p, n);
        if (!s) throw new Error('missing sticker at ' + p + ' n=' + n);
        out += FACE_HOME_POS[s.home];
      }
    }
    return out;
  }
  // Build a state from a facelet string (position letters). Centre orientations set to home (unknown from facelets).
  static fromFaceletString(str, centreRots = {}) {
    if (str.length !== 54) throw new Error('facelet string must be 54 chars');
    const VIEW = {
      U: { vu: [0, 0, -1], vr: [1, 0, 0] }, D: { vu: [0, 0, 1], vr: [1, 0, 0] },
      F: { vu: [0, 1, 0], vr: [1, 0, 0] }, B: { vu: [0, 1, 0], vr: [-1, 0, 0] },
      L: { vu: [0, 1, 0], vr: [0, 0, 1] }, R: { vu: [0, 1, 0], vr: [0, 0, -1] },
    };
    // For each home sticker we need its home (row,col) on its home face image:
    // iterate positions; the occupant's home face is known; its (row,col) is determined by
    // matching: we reconstruct stickers keyed by (homeFace, homeRow, homeCol) using the inverse:
    // a sticker seen at position-face P grid (row,col) with normal P belongs to some cubie;
    // its home grid equals the grid where this same cubie sits when solved. We recover it by
    // tracking identity through positions: the cubie at (pos,n) in solved state has known home grid.
    // So: build solved state, index its stickers by (posKey|nKey) -> sticker template.
    const solved = CubeState.solved();
    const template = new Map();
    for (const s of solved.stickers) template.set(vKey(s.pos) + '|' + vKey(s.n), s);
    const stickers = [];
    let idx = 0;
    for (const pos of ['U', 'R', 'F', 'D', 'L', 'B']) {
      const n = POS_NORMAL[pos]; const { vu, vr } = VIEW[pos];
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        const letter = str[idx++];
        const homeFace = POS_HOME_FACE[letter];
        // cubie position in the CURRENT state:
        const p = vAdd(vAdd(n, vScale(vr, col - 1)), vScale(vu, 1 - row));
        // find home grid: the sticker of homeFace whose home normal is n's home... the template
        // sticker with same (home face) and whose solved (pos,n) corresponds to this cubie:
        // cubie identity = set of (homeFace, dir) pairs; recover via: among homeFace stickers,
        // the one whose home position, when the cube is solved, is on the cubie that also carries
        // the other facelets at this position. Simpler: match by normal direction in home frame:
        // the sticker's home (row,col) is the one whose home normal == POS_NORMAL[letter] and
        // whose home pos, rotated by the cubie's rotation... underdetermined without other facelets.
        // Robust route: use cubie identity from the whole position: gather all facelets at this
        // cubie position across positions later; here instead assign by (homeFace, homeNormal):
        // exactly 1 sticker of homeFace has home normal POS_NORMAL[letter]? No: all 9 do.
        // => Use position-in-home-net: the cubie's home position coordinates are obtained by
        //    taking the current cubie position and mapping each axis direction to home faces.
        // We know for this cubie its full set of facelets only after scanning all positions.
        stickers.push({ pendingHome: homeFace, curPos: p, curN: [...n] });
      }
    }
    // Second pass: group by curPos -> cubie; home position = for each sticker in cubie,
    // coordinate along its normal axis = (its home face's axis value). Build home pos vector:
    const byPos = new Map();
    for (const s of stickers) {
      const k = vKey(s.curPos);
      if (!byPos.has(k)) byPos.set(k, []);
      byPos.get(k).push(s);
    }
    const finalStickers = [];
    for (const s of stickers) {
      const hn = POS_NORMAL[FACE_HOME_POS[s.pendingHome]];
      // home pos: for the cubie (group at s.curPos), home coordinates: component along hn axis
      // is hn's value; other components come from the other stickers of the same cubie.
      const group = byPos.get(vKey(s.curPos));
      const homePos = [0, 0, 0];
      for (const g of group) {
        const ghn = POS_NORMAL[FACE_HOME_POS[g.pendingHome]];
        for (let i = 0; i < 3; i++) if (ghn[i] !== 0) homePos[i] = ghn[i];
      }
      // home (row,col): from template sticker with pos==homePos and n==hn
      const t = template.get(vKey(homePos) + '|' + vKey(hn));
      if (!t) throw new Error('no template for cubie');
      finalStickers.push({ home: s.pendingHome, row: t.row, col: t.col, pos: s.curPos, n: s.curN, u: [...FACE_IMAGE_UP[s.pendingHome]] });
    }
    // Reconstruct each sticker's true image-up vector u from the cubie's rotation,
    // derived from its own facelets (centres: from centreRots, CW turns viewed from outside).
    const byCubie = new Map();
    for (const s of finalStickers) {
      const k = vKey(s.pos);
      if (!byCubie.has(k)) byCubie.set(k, []);
      byCubie.get(k).push(s);
    }
    for (const group of byCubie.values()) {
      if (group.length === 1) {
        const s = group[0];
        const posLetter = Object.keys(POS_NORMAL).find(k => vEq(POS_NORMAL[k], s.n));
        const rot = centreRots[posLetter] || 0;
        if (rot) {
          const { axis, sign } = axisOfNormal(s.n);
          s.u = rotVecSteps(s.u, axis, sign, rot, true);
        }
      } else {
        const [s1, s2] = group;
        const h1 = POS_NORMAL[FACE_HOME_POS[s1.home]], h2 = POS_NORMAL[FACE_HOME_POS[s2.home]];
        const e1 = h1, e2 = h2, e3 = vCross(e1, e2);
        const f1 = s1.n, f2 = s2.n, f3 = vCross(f1, f2);
        const basis = [e1, e2, e3], fb = [f1, f2, f3];
        for (const s of group) {
          const uh = FACE_IMAGE_UP[s.home];
          const coords = basis.map(e => vDot(uh, e));
          s.u = [0, 1, 2].map(i => coords[0] * fb[0][i] + coords[1] * fb[1][i] + coords[2] * fb[2][i]);
        }
      }
    }
    return new CubeState(finalStickers);
  }
}
function homePosOf(s) {
  const n = POS_NORMAL[FACE_HOME_POS[s.home]];
  const u = FACE_IMAGE_UP[s.home];
  const r = vCross(u, n);
  return vAdd(vAdd(n, vScale(r, s.col - 1)), vScale(u, 1 - s.row));
}
// rotate vector by `power` CW quarter turns (viewed from outside, i.e. from +normal side) about the given axis/sign
function rotVecSteps(v, axis, sign, power, cw) {
  // One CW step viewed from the +axis tip = one -90deg RH step about +axis = +90 RH about -axis.
  // Implement directly: CW about +axis by 90: cycle the other two coords.
  let r = [...v];
  const times = ((power % 4) + 4) % 4;
  for (let i = 0; i < times; i++) {
    const [x, y, z] = r;
    if (axis === 0) r = sign > 0 ? [x, z, -y] : [x, -z, y]; // about +x CW: y-> -z? verify below in tests
    else if (axis === 1) r = sign > 0 ? [-z, y, x] : [z, y, -x];
    else r = sign > 0 ? [y, -x, z] : [-y, x, z];
  }
  return r;
}
function parseSeq(seq) {
  if (!seq) return [];
  return seq.trim().split(/\s+/).filter(Boolean).map(tok => {
    const face = tok[0];
    let power = 1;
    if (tok.includes('2')) power = 2; else if (tok.includes("'") || tok.includes('-')) power = 3;
    return { face, power };
  });
}
function seqToString(moves) {
  return moves.map(m => m.face + (m.power === 2 ? '2' : m.power === 3 ? "'" : '')).join(' ');
}
function invertSeq(moves) {
  return moves.slice().reverse().map(m => ({ face: m.face, power: (4 - m.power) % 4 }));
}
const FACELET_VIEW = {
  U: { vu: [0, 0, -1], vr: [1, 0, 0] }, D: { vu: [0, 0, 1], vr: [1, 0, 0] },
  F: { vu: [0, 1, 0], vr: [1, 0, 0] }, B: { vu: [0, 1, 0], vr: [-1, 0, 0] },
  L: { vu: [0, 1, 0], vr: [0, 0, 1] }, R: { vu: [0, 1, 0], vr: [0, 0, -1] },
};
// cubie position -> (row, col) on position face posFace viewed from outside (FACELET_VIEW convention)
function gridOf(posFace, cubiePos) {
  const n = POS_NORMAL[posFace]; const { vu, vr } = FACELET_VIEW[posFace];
  const d = [cubiePos[0] - n[0], cubiePos[1] - n[1], cubiePos[2] - n[2]];
  const col = vDot(d, vr) + 1, row = 1 - vDot(d, vu);
  return { row, col };
}
function cubiePosOf(posFace, row, col) {
  const n = POS_NORMAL[posFace]; const { vu, vr } = FACELET_VIEW[posFace];
  return vAdd(vAdd(n, vScale(vr, col - 1)), vScale(vu, 1 - row));
}
// rotate world vector v by a move (face letter, power) as applyMove does to stickers in the layer
function rotateVectorByMove(v, face, power) {
  const n = POS_NORMAL[face];
  const { axis, sign } = axisOfNormal(n);
  return rotVecSteps(v, axis, sign, power, true);
}
if (typeof module !== 'undefined') module.exports = { CubeState, parseSeq, seqToString, invertSeq, POS_NORMAL, FACE_HOME_POS, POS_HOME_FACE, FACE_IMAGE_UP, FACE_INFO, FACE_NEIGHBORS, OPPOSITE, FACELET_VIEW, gridOf, cubiePosOf, rotateVectorByMove, vEq, vDot, vCross, vAdd, vScale };
