/* Lucide icons, inlined as SVG strings at render time (no runtime CDN, so the strict CSP holds). */
import { createElement, Info, Pencil, Plus, Search, Link2, FilePlus2, BookOpen, ChevronRight, ChevronDown,
  Trash2, ExternalLink, Copy, Check, TriangleAlert, KeyRound, Ellipsis, SlidersHorizontal, X, Code2, StickyNote, Columns3 } from "lucide";

const NODES = { info:Info, pencil:Pencil, plus:Plus, search:Search, link:Link2, "file-plus":FilePlus2, book:BookOpen,
  "chevron-right":ChevronRight, "chevron-down":ChevronDown, trash:Trash2, external:ExternalLink, copy:Copy, check:Check,
  alert:TriangleAlert, key:KeyRound, more:Ellipsis, sliders:SlidersHorizontal, x:X, code:Code2, note:StickyNote, columns:Columns3 };
const cache = new Map();

/** SVG markup for a named icon; size in px. */
export function icon(name, size=16){
  const key = name+size;
  if(!cache.has(key)){
    const node = NODES[name]; if(!node) throw new Error("unknown icon "+name);
    cache.set(key, createElement(node, { width:size, height:size, class:"ico", "aria-hidden":"true", focusable:"false" }).outerHTML);
  }
  return cache.get(key);
}
/** Replace every <i data-icon="name" data-size?> under root with inline SVG. */
export function mountIcons(root=document){
  root.querySelectorAll("i[data-icon]").forEach(el=> el.outerHTML = icon(el.dataset.icon, +el.dataset.size||16));
}
