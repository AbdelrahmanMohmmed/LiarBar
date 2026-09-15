/**
 * Rules tests for Egyptian domino.
 *
 *   cd server && npm run build && npm run test:domino
 *
 * These run against the compiled rules module, with no engine, no sockets and
 * no timers, because the rules are the part where a subtle mistake is both
 * easy to make and invisible until someone loses a match to it. Every case
 * below is either a rule I want pinned or a bug the previous engine had.
 */
import assert from "node:assert/strict";
import {
  fullSet,
  deal,
  findOpening,
  legalPlays,
  canPlay,
  orient,
  handPips,
  teamForSeat,
  partnerSeat,
  scoreDomino,
  scoreBlocked,
  applyKarak,
  isDouble,
  sameTile,
} from "../dist/games/domino/rules.js";
import { chooseDominoPlay } from "../dist/games/domino/DominoBot.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ok  " + name);
  } catch (err) {
    console.error("  FAIL " + name + "\n       " + err.message);
    process.exitCode = 1;
  }
}

console.log("\nThe set");
test("a double-six set is 28 unique tiles", () => {
  const set = fullSet();
  assert.equal(set.length, 28);
  const keys = new Set(set.map((t) => `${t.left}-${t.right}`));
  assert.equal(keys.size, 28);
});

test("total pips in the set is 168", () => {
  assert.equal(handPips(fullSet()), 168);
});

test("each value appears exactly 8 times across the set", () => {
  for (let v = 0; v <= 6; v++) {
    const count = fullSet().reduce(
      (n, t) => n + (t.left === v ? 1 : 0) + (t.right === v ? 1 : 0),
      0,
    );
    assert.equal(count, 8, `value ${v} appears ${count} times`);
  }
});

console.log("\nDealing");
test("four players get all 28 tiles and NO boneyard", () => {
  // This is the defining property of the four-handed game: with no boneyard,
  // "I can't play" becomes public information instead of a private problem.
  const { hands, boneyard } = deal(4);
  assert.equal(hands.length, 4);
  hands.forEach((h) => assert.equal(h.length, 7));
  assert.equal(boneyard.length, 0);
});

test("two players keep a boneyard", () => {
  const { hands, boneyard } = deal(2);
  assert.equal(hands[0].length, 7);
  assert.equal(boneyard.length, 14);
});

test("a deal never duplicates a tile", () => {
  for (let i = 0; i < 200; i++) {
    const { hands, boneyard } = deal(4);
    const all = [...hands.flat(), ...boneyard];
    assert.equal(all.length, 28);
    assert.equal(new Set(all.map((t) => `${t.left}-${t.right}`)).size, 28);
  }
});

console.log("\nOpening");
test("the double-six always opens round one", () => {
  for (let i = 0; i < 100; i++) {
    const { hands } = deal(4);
    const opening = findOpening(hands);
    assert.ok(opening, "no opening found");
    assert.deepEqual(
      { l: opening.tile.left, r: opening.tile.right },
      { l: 6, r: 6 },
    );
    assert.ok(
      hands[opening.seat].some((t) => sameTile(t, { left: 6, right: 6 })),
      "opener does not hold the double-six",
    );
  }
});

test("without a double-six, the highest double opens", () => {
  const hands = [
    [{ left: 3, right: 3 }, { left: 6, right: 5 }],
    [{ left: 5, right: 5 }, { left: 6, right: 4 }],
  ];
  const opening = findOpening(hands);
  assert.equal(opening.seat, 1);
  assert.deepEqual(opening.tile, { left: 5, right: 5 });
});

test("with no doubles at all, the heaviest tile opens", () => {
  const hands = [
    [{ left: 1, right: 2 }],
    [{ left: 6, right: 5 }],
  ];
  assert.deepEqual(findOpening(hands).tile, { left: 6, right: 5 });
});

console.log("\nLegality and orientation");
test("an empty board accepts anything", () => {
  const hand = [{ left: 0, right: 1 }, { left: 4, right: 4 }];
  assert.equal(legalPlays(hand, { left: null, right: null }).length, 2);
});

test("a tile matching both ends is offered on both", () => {
  const plays = legalPlays([{ left: 2, right: 5 }], { left: 2, right: 5 });
  assert.equal(plays.length, 2);
  assert.deepEqual(plays.map((p) => p.end).sort(), ["left", "right"]);
});

test("a tile matching neither end is not offered", () => {
  assert.equal(legalPlays([{ left: 0, right: 1 }], { left: 3, right: 4 }).length, 0);
  assert.equal(canPlay([{ left: 0, right: 1 }], { left: 3, right: 4 }), false);
});

test("playing on the left flips the tile so the matching pip touches", () => {
  // Board ends 3 | ... | 4. Playing 3-6 on the left must land as 6-3 so the
  // 3 touches the board. Getting this backwards is the classic rendering bug:
  // the game stays legal but the snake shows mismatched numbers touching and
  // players conclude the server is cheating.
  const out = orient({ left: 3, right: 6 }, "left", { left: 3, right: 4 });
  assert.deepEqual(out.placed, { left: 6, right: 3 });
  assert.equal(out.newEnd, 6);
});

test("playing on the left with the tile already correct does not flip it", () => {
  const out = orient({ left: 6, right: 3 }, "left", { left: 3, right: 4 });
  assert.deepEqual(out.placed, { left: 6, right: 3 });
  assert.equal(out.newEnd, 6);
});

test("playing on the right flips when needed", () => {
  const out = orient({ left: 5, right: 4 }, "right", { left: 3, right: 4 });
  assert.deepEqual(out.placed, { left: 4, right: 5 });
  assert.equal(out.newEnd, 5);
});

test("orient refuses an illegal placement", () => {
  assert.equal(orient({ left: 0, right: 1 }, "left", { left: 3, right: 4 }), null);
});

test("a double placed on an end leaves that same value open", () => {
  const out = orient({ left: 4, right: 4 }, "right", { left: 3, right: 4 });
  assert.equal(out.newEnd, 4);
});

console.log("\nSeating");
test("partners sit across the table", () => {
  assert.equal(teamForSeat(0), "A");
  assert.equal(teamForSeat(2), "A");
  assert.equal(teamForSeat(1), "B");
  assert.equal(teamForSeat(3), "B");
  assert.equal(partnerSeat(0, 4), 2);
  assert.equal(partnerSeat(1, 4), 3);
  assert.equal(partnerSeat(0, 2), null);
});

console.log("\nScoring");
const teamOpts = { teams: true, karakBonus: false };
const soloOpts = { teams: false, karakBonus: false };

test("team win scores ONLY the opponents' pips, not the partner's", () => {
  // This is what makes "feed your partner" a real strategy rather than a
  // sentiment: your partner's leftovers never cost you.
  const hands = [
    [],                                  // seat 0, team A — went out
    [{ left: 6, right: 6 }],             // seat 1, team B — 12
    [{ left: 5, right: 4 }],             // seat 2, team A — 9, must NOT count
    [{ left: 3, right: 2 }],             // seat 3, team B — 5
  ];
  const out = scoreDomino(0, hands, teamOpts);
  assert.equal(out.points, 17, "should be 12 + 5, excluding the partner's 9");
  assert.equal(out.winnerTeam, "A");
});

test("solo win scores everyone else's pips", () => {
  const hands = [[], [{ left: 6, right: 6 }], [{ left: 5, right: 4 }]];
  assert.equal(scoreDomino(0, hands, soloOpts).points, 21);
});

test("a blocked round is won by the lighter side", () => {
  const hands = [
    [{ left: 1, right: 0 }],   // A: 1
    [{ left: 6, right: 6 }],   // B: 12
    [{ left: 2, right: 0 }],   // A: 2  -> A total 3
    [{ left: 5, right: 5 }],   // B: 10 -> B total 22
  ];
  const out = scoreBlocked(hands, teamOpts);
  assert.equal(out.method, "blocked");
  assert.equal(out.winnerTeam, "A");
  assert.equal(out.points, 22, "winner takes the heavier side's pips");
  assert.equal(out.winnerSeat, 0, "credited to the lightest hand on the winning team");
});

test("a blocked round with equal pips scores nothing for anyone", () => {
  // Inventing a winner on a genuine tie makes the fairest outcome feel
  // arbitrary, so the round is simply a draw.
  const hands = [
    [{ left: 3, right: 3 }],
    [{ left: 3, right: 3 }],
    [{ left: 1, right: 1 }],
    [{ left: 1, right: 1 }],
  ];
  const out = scoreBlocked(hands, teamOpts);
  assert.equal(out.method, "draw");
  assert.equal(out.points, 0);
  assert.equal(out.winnerTeam, null);
});

test("a blocked solo round with a tie for lightest is a draw", () => {
  const hands = [[{ left: 1, right: 1 }], [{ left: 1, right: 1 }], [{ left: 6, right: 6 }]];
  assert.equal(scoreBlocked(hands, soloOpts).method, "draw");
});

test("karak doubles the score only when enabled and only on a double", () => {
  const base = scoreDomino(0, [[], [{ left: 6, right: 6 }]], soloOpts);
  assert.equal(base.points, 12);

  const off = applyKarak(base, { left: 4, right: 4 }, { teams: false, karakBonus: false });
  assert.equal(off.points, 12, "disabled bonus must not fire");

  const notDouble = applyKarak(base, { left: 4, right: 3 }, { teams: false, karakBonus: true });
  assert.equal(notDouble.points, 12, "only a double triggers karak");

  const fired = applyKarak(base, { left: 4, right: 4 }, { teams: false, karakBonus: true });
  assert.equal(fired.points, 24);
  assert.equal(fired.karak, true);
});

test("karak never applies to a blocked round", () => {
  const blocked = scoreBlocked(
    [[{ left: 1, right: 1 }], [{ left: 6, right: 6 }]],
    soloOpts,
  );
  const out = applyKarak(blocked, { left: 4, right: 4 }, { teams: false, karakBonus: true });
  assert.equal(out.points, blocked.points);
});

console.log("\nBot");
const baseView = {
  ends: { left: 3, right: 5 },
  seat: 0,
  seatCount: 4,
  teams: true,
  handSizes: [4, 2, 4, 4],
  knocks: [[], [], [], []],
  seenPipCount: [0, 0, 0, 0, 0, 0, 0],
};

test("a bot with no legal tile returns null so the engine can knock", () => {
  const view = { ...baseView, hand: [{ left: 0, right: 1 }] };
  assert.equal(chooseDominoPlay(view, "hard"), null);
});

test("a bot with one legal tile plays it", () => {
  const view = { ...baseView, hand: [{ left: 3, right: 1 }, { left: 0, right: 0 }] };
  const choice = chooseDominoPlay(view, "hard");
  assert.ok(sameTile(choice.tile, { left: 3, right: 1 }));
});

test("a hard bot blocks an opponent it knows is dead on both ends", () => {
  // Seat 1 knocked when 2 and 6 were open, so it holds no 2 and no 6. Playing
  // 3-2 leaves ends 2 | 5 ... the strong move here is the one that leaves an
  // end seat 1 cannot answer. The old bot picked purely by weight and would
  // always take the heavier 3-6.
  const view = {
    ...baseView,
    ends: { left: 3, right: 2 },
    hand: [
      { left: 3, right: 6 }, // heavy, but leaves 6|2 — seat 1 dead on both
      { left: 3, right: 1 }, // light, leaves 1|2
    ],
    knocks: [[], [2, 6], [], []],
    handSizes: [4, 2, 4, 4],
  };
  const choice = chooseDominoPlay(view, "hard");
  assert.ok(
    sameTile(choice.tile, { left: 3, right: 6 }),
    "hard bot should leave both ends dead for the trapped opponent",
  );
});

test("a hard bot is deterministic (no slop)", () => {
  const view = {
    ...baseView,
    hand: [{ left: 3, right: 6 }, { left: 5, right: 1 }, { left: 3, right: 0 }],
  };
  const first = chooseDominoPlay(view, "hard");
  for (let i = 0; i < 25; i++) {
    const again = chooseDominoPlay(view, "hard");
    assert.ok(sameTile(first.tile, again.tile) && first.end === again.end);
  }
});

test("bots only ever return legal plays, across many random positions", () => {
  for (let i = 0; i < 500; i++) {
    const { hands } = deal(4);
    const ends = {
      left: Math.floor(Math.random() * 7),
      right: Math.floor(Math.random() * 7),
    };
    for (const difficulty of ["easy", "medium", "hard"]) {
      const view = { ...baseView, hand: hands[0], ends };
      const choice = chooseDominoPlay(view, difficulty);
      if (choice === null) {
        assert.equal(canPlay(hands[0], ends), false, "returned null while a play existed");
      } else {
        assert.ok(
          orient(choice.tile, choice.end, ends) !== null,
          `illegal play from ${difficulty} bot`,
        );
        assert.ok(hands[0].some((t) => sameTile(t, choice.tile)), "played a tile not in hand");
      }
    }
  }
});

console.log(
  process.exitCode
    ? "\n=== DOMINO RULES: FAILURES ABOVE ==="
    : `\n=== DOMINO RULES: ${passed} checks passed ===`,
);
