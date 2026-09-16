/**
 * Tiny, safe arithmetic evaluator for the "grams per day" column.
 * Supports numbers, + - * / and parentheses; "x" and "×" mean multiply.
 * Returns NaN for anything it does not understand (never throws, never evals).
 */
export function evalExpr(input){
  const s = String(input ?? "")
    .replace(/\s+/g, "").replace(/[x×]/gi, "*").replace(/[÷]/g, "/").replace(/,/g, "");
  if(!s) return 0;
  let i = 0;
  const peek = () => s[i];
  const bad = () => { throw new SyntaxError("bad expression"); };
  function num(){
    const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if(!m) bad();
    i += m[0].length; return +m[0];
  }
  function atom(){
    const c = peek();
    if(c === "(") { i++; const v = sum(); if(s[i++] !== ")") bad(); return v; }
    if(c === "-") { i++; return -atom(); }
    if(c === "+") { i++; return atom(); }
    return num();
  }
  function prod(){
    let v = atom();
    while(peek() === "*" || peek() === "/"){ const op = s[i++]; const r = atom(); v = op === "*" ? v*r : v/r; }
    return v;
  }
  function sum(){
    let v = prod();
    while(peek() === "+" || peek() === "-"){ const op = s[i++]; const r = prod(); v = op === "+" ? v+r : v-r; }
    return v;
  }
  try{
    const v = sum();
    return (i === s.length && Number.isFinite(v)) ? v : NaN;
  }catch{ return NaN; }
}
