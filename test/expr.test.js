import { test } from "node:test";
import assert from "node:assert/strict";
import { evalExpr } from "../src/expr.js";

test("evaluates the expressions the UI suggests", () => {
  assert.equal(evalExpr("400*2/10"), 80);
  assert.equal(evalExpr("374/7"), 374/7);
  assert.equal(evalExpr("6*50*2/10"), 60);
  assert.equal(evalExpr(" 2 x 116 "), 232);
  assert.equal(evalExpr("2×116"), 232);
  assert.equal(evalExpr("(100+50)/2"), 75);
  assert.equal(evalExpr("-5+10"), 5);
  assert.equal(evalExpr("1,000/4"), 250);
  assert.equal(evalExpr(".5*10"), 5);
  assert.equal(evalExpr("120"), 120);
  assert.equal(evalExpr(""), 0);
  assert.equal(evalExpr(null), 0);
});

test("rejects anything that is not arithmetic", () => {
  for (const bad of ["100/", "abc", "1+", "(1", "1)", "alert(1)", "1e3", "2**3", "1;2", "Math.PI", "1/0"])
    assert.ok(Number.isNaN(evalExpr(bad)), `expected NaN for ${JSON.stringify(bad)}`);
});
