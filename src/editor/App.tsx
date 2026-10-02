import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MarkupStroke, SketchShape } from "../../vendor/sketch/shapes";
import { shapeBox } from "../../vendor/sketch/shapes";
import type { Result } from "../../vendor/sketch/suggest";
import { TOOL_KEYS, Tools, type DrawTool } from "../../vendor/sketch/tools";
import { fitView, type View } from "../../vendor/sketch/view";
import { center, frameAt, homeFrame, layoutBoard, slides, type BoardLayout, type Box } from "../layout";
import { textWidth } from "../text";
import { isNote, typeOf, type Cards, type FlowchartFile, type FNode } from "../types";
import { validate } from "../validate";
import { api, cardUrl } from "./api";
import { boxOf, Canvas, type EditEnd, type InlineEdit } from "./Canvas";
import { Inspector, type InspectorActions } from "./Inspector";
import * as M from "./model";
import { Palette, type Payload } from "./Palette";
import { Play } from "./Play";

const CLIP = "flowchart-kit/nodes";
const round2 = (v: number) => Math.round(v * 100) / 100;
const isUrl = (s: string) => /^(https?:\/\/|www\.)\S+$/i.test(s.trim());

export function App() {
  const [doc, setDoc] = useState<FlowchartFile | null>(null);
  const [draft, setDraft] = useState<FlowchartFile | null>(null);
  const [result, setResult] = useState<Result>();
  const [cards, setCards] = useState<Cards>({});
  const [file, setFile] = useState("");
  const [bust, setBust] = useState(0);
  const [sel, setSel] = useState<M.Key[]>([]);
  const [view, setView] = useState<View>({ x: 40, y: 40, k: 0.6 });
  const [dragging, setDragging] = useState(false);
  const [play, setPlay] = useState<string | null>(null);
  const [palette, setPalette] = useState(true);
  const [focusText, setFocusText] = useState(0);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const [tool, setTool] = useState<DrawTool>("select");
  const [color, setColor] = useState("ink");
  const [editing, setEditing] = useState<InlineEdit | null>(null);
  const undo = useRef<FlowchartFile[]>([]);
  const redo = useRef<FlowchartFile[]>([]);
  const lastCo = useRef<string | undefined>(undefined);
  const saveT = useRef<number | undefined>(undefined);
  const latest = useRef<FlowchartFile | null>(null);
  const canvasEl = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const cardsKey = useRef("");

  const shown = draft ?? doc;
  const L = useMemo(() => (shown ? layoutBoard(shown, cards) : null), [shown, cards]);
  const base = useMemo(() => (doc ? layoutBoard(doc, cards) : null), [doc, cards]);
  const cardHref = useMemo(() => cardUrl(bust), [bust]);

  const flash = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(""), 2200); };
  const takeCards = (c: Cards) => {
    const k = JSON.stringify(c);
    if (k !== cardsKey.current) { cardsKey.current = k; setCards(c); setBust((b) => b + 1); }
  };

  const fit = useCallback((d = doc, c = cards) => {
    if (!d || !canvasEl.current) return;
    const r = canvasEl.current.getBoundingClientRect();
    setView(fitView(layoutBoard(d, c).bounds, r.width, r.height, 48, 1));
  }, [doc, cards]);

  // load, then follow the agent's edits (and the storyboards and wireframes on the board) live
  useEffect(() => {
    let first = true;
    const load = () => api.load().then((r) => {
      setDoc(r.doc); latest.current = r.doc; setResult(r.result); setFile(r.file ?? ""); setError("");
      cardsKey.current = ""; takeCards(r.cards);
      if (first) { first = false; document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => fit(r.doc, r.cards)))); }
    }).catch((e) => setError(String(e.message ?? e)));
    load();
    const es = new EventSource("/api/events");
    es.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.type === "change" && msg.source === "file") load();
      if (msg.type === "invalid") setError(msg.message);
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (d: FlowchartFile, now = false) => {
    latest.current = d;
    setStatus("saving");
    window.clearTimeout(saveT.current);
    const go = () => api.put(latest.current!).then((r) => { setResult(r.result); takeCards(r.cards); setStatus("saved"); }).catch(() => setStatus("error"));
    if (now) go(); else saveT.current = window.setTimeout(go, 250);
  };

  /** Every change goes through here: undo history (typing coalesces), validation, save. */
  const edit = (next: FlowchartFile, coalesce?: string) => {
    if (!doc || next === doc) return;
    if (coalesce === undefined || coalesce !== lastCo.current) { undo.current.push(doc); if (undo.current.length > 200) undo.current.shift(); redo.current = []; }
    lastCo.current = coalesce;
    setDoc(next);
    setResult(validate(next));
    save(next);
  };
  const step = (from: React.MutableRefObject<FlowchartFile[]>, to: React.MutableRefObject<FlowchartFile[]>) => {
    const prev = from.current.pop();
    if (!prev || !doc) return;
    to.current.push(doc);
    lastCo.current = undefined;
    setDoc(prev); setResult(validate(prev)); save(prev, true);
    setSel((s) => s.filter((k) => exists(prev, k)));
  };
  const exists = (d: FlowchartFile, k: M.Key) => {
    const [kind, id, i] = k.split(":");
    if (kind === "node") return !!d.nodes[id];
    if (kind === "frame") return !!d.frames?.[id];
    if (kind === "edge") return !!d.links?.[Number(id)];
    return !!(id ? d.frames?.[id]?.shapes?.[Number(i)] : d.shapes?.[Number(i)]);
  };

  // ---- placing things

  /** Center a node on (x, y). */
  const placeCentered = (d: FlowchartFile, id: string, x: number, y: number) => {
    const b = layoutBoard(d, cards).nodes[id];
    return b ? M.placeAt(d, id, x - b.w / 2, y - b.h / 2, cards) : d;
  };
  /** Where new things go when there's no pointer: the middle of the view. */
  const viewCenter = () => {
    const r = canvasEl.current?.getBoundingClientRect();
    return r ? { x: (r.width / 2 - view.x) / view.k, y: (r.height / 2 - view.y) / view.k } : { x: 0, y: 0 };
  };
  const selectedNode = () => (sel.length === 1 && sel[0].startsWith("node:") && doc?.nodes[sel[0].slice(5)] ? sel[0].slice(5) : undefined);

  /** A new node at a point (in the frame under it), optionally typed into right away. */
  const addAt = (d: FlowchartFile, n: FNode, x: number, y: number, Lx: BoardLayout): { doc: FlowchartFile; id: string } => {
    const f = frameAt(Lx, x, y);
    const r = M.addNode(d, { ...n, ...(f ? { frame: f } : {}) });
    return { doc: placeCentered(r.doc, r.id, x, y), id: r.id };
  };

  /** A stamp dropped at a point sticks to whatever's under it. */
  const stampAt = (d: FlowchartFile, n: FNode, x: number, y: number, Lx: BoardLayout, skip?: string): FlowchartFile & { __id?: string } => {
    const target = Object.values(Lx.nodes).filter((b) => b.type !== "stamp" && b.id !== skip && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h).pop();
    if (target) {
      const at: [number, number] = [round2((x - target.x) / target.w), round2((y - target.y) / target.h)];
      const r = M.addNode(d, { type: "stamp", icon: n.icon, near: target.id, at });
      return Object.assign(r.doc, { __id: r.id });
    }
    const r = addAt(d, { type: "stamp", icon: n.icon }, x, y, Lx);
    return Object.assign(r.doc, { __id: r.id });
  };

  const newFrame = (d: FlowchartFile, extra: Partial<NonNullable<FlowchartFile["frames"]>[string]> = {}, at?: [number, number]): { doc: FlowchartFile; id: string } => {
    const id = M.newId(d, "frame", d.frames ?? {});
    const ids = Object.keys(d.frames ?? {});
    const next = M.clone(d);
    next.frames = { ...(next.frames ?? {}), [id]: { title: "New frame", ...(ids.length && !at ? { near: ["right of", ids[ids.length - 1]] as ["right of", string] } : {}), ...extra } };
    if (at) next.canvas = { ...(next.canvas ?? {}), [id]: at };
    return { doc: next, id };
  };

  // ---- text editing in place

  const startEdit = (key: M.Key, d = doc, Lx = L) => {
    if (!d || !Lx) return;
    const [kind, id, i] = key.split(":");
    if (kind === "node") {
      const n = d.nodes[id], b = Lx.nodes[id];
      if (!n || !b) return;
      const t = typeOf(n);
      if (t === "card") { if (n.ref) a.openCard(n.ref); return; }
      if (t === "stamp") { setFocusText((x) => x + 1); return; }
      setEditing({ key, value: n.text ?? "", box: b, size: t === "text" ? 20 : 18, face: "hand", multiline: t !== "link", align: t === "link" || t === "text" ? "left" : "center" });
    } else if (kind === "frame") {
      const f = Lx.frames[id];
      if (!f) return;
      setEditing({ key, value: d.frames?.[id]?.title ?? id, box: { x: f.x + 22, y: f.y + 12, w: Math.max(220, textWidth(f.title, "title", 24) + 30), h: 36 }, size: 24, face: "title", multiline: false, align: "left" });
    } else if (kind === "edge") {
      const e = Lx.edges.find((x) => x.i === Number(id));
      if (!e) return;
      setEditing({ key, value: d.links?.[Number(id)]?.label ?? "", box: { x: e.lx - 60, y: e.ly - 14, w: 120, h: 28 }, size: 16, face: "hand", multiline: false, align: "center" });
    } else if (kind === "shape") {
      const s = id ? d.frames?.[id]?.shapes?.[Number(i)] : d.shapes?.[Number(i)];
      const b = boxOf(d, Lx, key);
      if (s?.type === "text" && b) setEditing({ key, value: s.text ?? "", box: b, size: 16, face: "hand", multiline: true, align: "center" });
    }
  };

  /** Tab: the next step, linked from this one, typed into right away. */
  const nextStep = (d: FlowchartFile, from: string): { doc: FlowchartFile; id: string } => {
    const n = d.nodes[from];
    if (n && isNote(n) && n.type !== "link") {
      // from a sticky: another sticky of the same color, beside the same thing
      const r = M.addNode(d, { type: n.type, ...(n.color ? { color: n.color } : {}), ...(n.near ? { near: n.near } : { frame: homeFrame(d, from) || undefined }), text: "" });
      return r;
    }
    const r = M.addNode(d, { text: "", frame: homeFrame(d, from) || undefined });
    return { doc: M.addLink(r.doc, from, r.id), id: r.id };
  };
  /** Enter: a sibling, linked from the same place this one is. */
  const sibling = (d: FlowchartFile, of: string): { doc: FlowchartFile; id: string } => {
    const parent = (d.links ?? []).find((l) => l.to === of);
    const n = d.nodes[of];
    if (!parent || (n && isNote(n))) return nextStepOrLoose(d, of);
    const r = M.addNode(d, { text: "", frame: homeFrame(d, of) || undefined });
    return { doc: M.addLink(r.doc, parent.from, r.id), id: r.id };
  };
  const nextStepOrLoose = (d: FlowchartFile, of: string) => {
    const n = d.nodes[of];
    if (n && isNote(n)) return nextStep(d, of);
    return M.addNode(d, { text: "", frame: homeFrame(d, of) || undefined });
  };
  const addAndEdit = (r: { doc: FlowchartFile; id: string }) => {
    edit(r.doc);
    setSel([`node:${r.id}`]);
    const Lx = layoutBoard(r.doc, cards);
    // keep what you're typing into on screen
    const b = Lx.nodes[r.id], el = canvasEl.current;
    if (b && el) {
      const rr = el.getBoundingClientRect(), m = 80;
      const sx = b.x * view.k + view.x, sy = b.y * view.k + view.y, ex = (b.x + b.w) * view.k + view.x, ey = (b.y + b.h) * view.k + view.y;
      const dx = ex > rr.width - m ? rr.width - m - ex : sx < m ? m - sx : 0;
      const dy = ey > rr.height - m ? rr.height - m - ey : sy < m ? m - sy : 0;
      if (dx || dy) setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
    window.setTimeout(() => startEdit(`node:${r.id}`, r.doc, Lx), 0);
  };

  const finishEdit = (value: string | null, how: EditEnd) => {
    const ed = editing;
    setEditing(null);
    if (!ed || !doc) return;
    const [kind, id, i] = ed.key.split(":");
    let d = doc;
    if (value !== null) {
      if (kind === "node") d = M.setAt(doc, ["nodes", id, "text"], value || undefined);
      else if (kind === "frame") d = M.setAt(doc, ["frames", id, "title"], value || undefined);
      else if (kind === "edge") d = M.setAt(doc, ["links", Number(id), "label"], value || undefined);
      else if (kind === "shape") d = M.setAt(doc, id ? ["frames", id, "shapes", Number(i), "text"] : ["shapes", Number(i), "text"], value);
    }
    if (kind === "node" && d.nodes[id] && how === "tab") { addAndEdit(nextStep(d, id)); return; }
    if (d !== doc) edit(d);
  };

  // ---- the inspector's verbs (and the keyboard's)

  const a: InspectorActions = {
    set: (path, value, co) => doc && edit(M.setAt(doc, path, value), co),
    select: setSel,
    remove: () => {
      if (!doc || !base || !sel.length) return;
      let d = doc;
      const nodes = sel.filter((k) => k.startsWith("node:")).map((k) => k.slice(5));
      const frames = sel.filter((k) => k.startsWith("frame:")).map((k) => k.slice(6));
      const edges = sel.filter((k) => k.startsWith("edge:")).map((k) => Number(k.slice(5))).sort((x, y) => y - x);
      const shapes = sel.filter((k) => k.startsWith("shape:")).map((k) => k.split(":")).sort((x, y) => Number(y[2]) - Number(x[2]));
      for (const e of edges) d = M.setAt(d, ["links", e], undefined);
      for (const [, f, i] of shapes) d = M.setAt(d, f ? ["frames", f, "shapes", Number(i)] : ["shapes", Number(i)], undefined);
      if (nodes.length) d = M.removeNodes(d, nodes);
      for (const f of frames) d = M.removeFrame(d, f, layoutBoard(d, cards));
      edit(d);
      setSel([]);
    },
    duplicate: () => {
      if (!doc) return;
      let d = doc;
      const keys: M.Key[] = [];
      for (const k of sel) {
        const [kind, id, i] = k.split(":");
        if (kind === "node" && d.nodes[id]) {
          const n = M.clone(d.nodes[id]);
          const r = M.addNode(d, n, M.newId(d, n));
          const b = base?.nodes[id];
          d = b ? M.placeAt(r.doc, r.id, b.x + 28, b.y + 28, cards) : r.doc;
          keys.push(`node:${r.id}`);
        } else if (kind === "shape") {
          const list = id ? d.frames?.[id]?.shapes ?? [] : d.shapes ?? [];
          const s = list[Number(i)];
          if (!s) continue;
          d = M.setAt(d, id ? ["frames", id, "shapes"] : ["shapes"], [...list, { ...s, points: s.points.map(([x, y]) => [x + 20, y + 20]) }]);
          keys.push(`shape:${id}:${list.length}`);
        }
      }
      if (keys.length) { edit(d); setSel(keys); }
    },
    copyPointer: () => {
      if (!doc || !base || !sel[0]) return;
      navigator.clipboard.writeText(M.pointer(file, doc, base, sel[0])).then(() => flash("Pointer copied. Paste it to your agent with what to change."), () => flash("Couldn't reach the clipboard."));
    },
    resetNudge: (id) => doc && edit(M.setAt(doc, ["layout", id], undefined)),
    renameNode: (from, to) => { if (!doc) return; const d = M.renameNode(doc, from, to); if (d !== doc) { edit(d); setSel([`node:${to}`]); } else flash(`"${to}" is taken.`); },
    renameFrame: (from, to) => { if (!doc) return; const d = M.renameFrame(doc, from, to); if (d !== doc) { edit(d); setSel([`frame:${to}`]); } else flash(`"${to}" is taken.`); },
    wrapInFrame: () => {
      if (!doc || !base) return;
      const ids = sel.filter((k) => k.startsWith("node:")).map((k) => k.slice(5)).filter((id) => base.nodes[id]);
      if (!ids.length) return;
      const xs = ids.map((id) => base.nodes[id]);
      const x0 = Math.min(...xs.map((b) => b.x)), y0 = Math.min(...xs.map((b) => b.y));
      const r = newFrame(doc, {}, [Math.round(x0 - 32), Math.round(y0 - 56)]);
      let d = r.doc;
      for (const id of ids) {
        const n = d.nodes[id];
        if (isNote(n) && n.near && ids.includes(n.near)) continue;
        d = M.setAt(d, ["nodes", id, "frame"], r.id);
        if (n.near && !ids.includes(n.near)) { d = M.setAt(d, ["nodes", id, "near"], undefined); d = M.setAt(d, ["nodes", id, "at"], undefined); }
        const nd = { ...(d.layout?.[id] ?? {}) }; delete nd.dx; delete nd.dy;
        d = M.setAt(d, ["layout", id], Object.keys(nd).length ? nd : undefined);
      }
      edit(d);
      setSel([`frame:${r.id}`]);
      window.setTimeout(() => startEdit(`frame:${r.id}`, d, layoutBoard(d, cards)), 0);
    },
    openCard: (ref) => api.openCard(ref).then((r) => flash(r.error ?? "Opening it in its own editor…"), () => flash("Couldn't open it.")),
    focus: (key) => {
      if (!doc || !base) return;
      const b = boxOf(doc, base, key), el = canvasEl.current;
      if (!b || !el) return;
      const r = el.getBoundingClientRect();
      setView(fitView(b, r.width, r.height, 60, 1));
      setSel([key]);
    },
    play: (frame) => setPlay(frame ?? (sel[0]?.startsWith("frame:") ? sel[0].slice(6) : "")),
    setPresent: (order) => {
      if (!doc) return;
      const all = Object.keys(doc.frames ?? {});
      edit(M.setAt(doc, ["present"], order.length === all.length && order.every((f, i) => f === all[i]) ? undefined : order));
    },
    reverseLink: (i) => { const l = doc?.links?.[i]; if (doc && l) edit(M.setAt(doc, ["links", i], { ...l, from: l.to, to: l.from })); },
  };

  // ---- canvas callbacks

  /** Move everything selected. A frame carries what's in it. On release, a node dropped in another frame moves there, and a stamp sticks to what it lands on. */
  const onMoveSel = (dx: number, dy: number, commit: boolean) => {
    if (!doc || !base) return;
    let d = doc;
    const movedFrames = new Set(sel.filter((k) => k.startsWith("frame:")).map((k) => k.slice(6)));
    // dragging inside a frame pins the frame where it is, so it can't slide away as it grows
    for (const k of sel) {
      const b = k.startsWith("node:") ? base.nodes[k.slice(5)] : undefined;
      if (b && !movedFrames.has(b.frame) && !d.canvas?.[b.frame]) d = M.freezeFrame(d, base, b.frame);
    }
    for (const k of sel) {
      const [kind, id, i] = k.split(":");
      if (kind === "frame") d = M.freezeFrame(d, base, id, dx, dy);
      else if (kind === "node" && base.nodes[id] && !movedFrames.has(base.nodes[id].frame)) d = M.nudge(d, id, dx, dy);
      else if (kind === "shape" && !(id && movedFrames.has(id))) {
        const path = id ? ["frames", id, "shapes", Number(i), "points"] : ["shapes", Number(i), "points"];
        const pts = M.getAt(d, path) as [number, number][] | undefined;
        if (pts) d = M.setAt(d, path, pts.map(([x, y]) => [x + dx, y + dy]));
      }
    }
    if (!commit) { setDraft(d); return; }
    setDraft(null);
    if (!dx && !dy) return;
    // one node dropped somewhere new
    const only = sel.length === 1 && sel[0].startsWith("node:") ? sel[0].slice(5) : undefined;
    if (only && doc.nodes[only]) {
      const Lm = layoutBoard(d, cards);
      const b = Lm.nodes[only];
      const n = doc.nodes[only];
      const [cx, cy] = center(b);
      if (n.type === "stamp") {
        const target = Object.values(Lm.nodes).filter((x) => x.type !== "stamp" && x.id !== only && cx >= x.x && cx <= x.x + x.w && cy >= x.y && cy <= x.y + x.h).pop();
        let nd = M.setAt(d, ["layout", only, "dx"], undefined);
        nd = M.setAt(nd, ["layout", only, "dy"], undefined);
        if (target) {
          const s = { ...nd.nodes[only], near: target.id, at: [round2((cx - target.x) / target.w), round2((cy - target.y) / target.h)] as [number, number] };
          delete s.frame;
          edit(M.setAt(nd, ["nodes", only], s));
          return;
        }
        const s = { ...nd.nodes[only] }; delete s.near; delete s.at;
        const f = frameAt(Lm, cx, cy);
        if (f) s.frame = f; else delete s.frame;
        edit(M.placeAt(M.setAt(nd, ["nodes", only], s), only, b.x, b.y, cards));
        return;
      }
      const target = n.near ? Lm.nodes[n.near] : undefined;
      const far = target && Math.hypot(cx - center(target)[0], cy - center(target)[1]) > 320;
      // frames as they were before the drag (its own frame grows to follow it while you drag)
      const f = frameAt(base, cx, cy);
      if (far || (!n.near && f !== homeFrame(doc, only))) {
        const s = { ...n };
        delete s.near; delete s.at;
        if (f) s.frame = f; else delete s.frame;
        edit(M.placeAt(M.setAt(d, ["nodes", only], s), only, b.x, b.y, cards));
        if (f !== homeFrame(doc, only)) flash(f ? `Moved into "${d.frames?.[f]?.title ?? f}".` : "Moved out of its frame.");
        return;
      }
    }
    edit(d);
  };

  const onResize = (key: M.Key, from: Box, to: Box, commit: boolean) => {
    if (!doc) return;
    const [kind, id, i] = key.split(":");
    let d = doc;
    if (kind === "node") {
      const n = doc.nodes[id];
      const cur = { ...(doc.layout?.[id] ?? {}) };
      if (n?.type === "stamp") { const s = Math.max(20, Math.max(to.w, to.h)); cur.w = s; cur.h = undefined; }
      else { cur.w = to.w; cur.h = to.h; }
      if (to.x !== from.x) cur.dx = (cur.dx ?? 0) + (to.x - from.x);
      if (to.y !== from.y) cur.dy = (cur.dy ?? 0) + (to.y - from.y);
      d = M.setAt(doc, ["layout", id], Object.fromEntries(Object.entries(cur).filter(([, v]) => v !== undefined && v !== 0)));
    } else if (kind === "frame") d = M.setAt(doc, ["frames", id, "size"], [Math.max(240, to.w), Math.max(180, to.h)]);
    else if (kind === "shape") {
      const path = id ? ["frames", id, "shapes", Number(i), "points"] : ["shapes", Number(i), "points"];
      const pts = M.getAt(doc, path) as [number, number][];
      const sx = from.w ? to.w / from.w : 1, sy = from.h ? to.h / from.h : 1;
      d = M.setAt(doc, path, pts.map(([x, y]) => [Math.round(to.x + (x - from.x) * sx), Math.round(to.y + (y - from.y) * sy)]));
    }
    if (commit) { setDraft(null); edit(d); } else setDraft(d);
  };

  /** A new drawing goes into the frame it starts in (so it moves with it), or on the board. */
  const onDraw = (kind: DrawTool, points: [number, number][], commit: boolean) => {
    if (!doc || !base || kind === "select" || kind === "text") return;
    const f = frameAt(base, points[0][0], points[0][1]);
    const fb = f ? base.frames[f] : undefined;
    const local = fb ? points.map(([x, y]) => [Math.round(x - fb.ox), Math.round(y - fb.oy)] as [number, number]) : points;
    const shape: SketchShape = { type: kind === "pen" ? "path" : kind, points: local, ...(color !== "ink" ? { color } : {}) };
    const b = shapeBox(shape);
    const real = kind === "pen" ? points.length > 2 : b.w + b.h > 6;
    const list = f ? doc.frames?.[f]?.shapes ?? [] : doc.shapes ?? [];
    const next = M.setAt(doc, f ? ["frames", f, "shapes"] : ["shapes"], [...list, shape]);
    if (!commit) { setDraft(next); return; }
    setDraft(null);
    if (!real) return;
    edit(next);
    setSel([`shape:${f}:${list.length}`]);
  };

  const onTextTool = (x: number, y: number) => {
    if (!doc || !base) return;
    const f = frameAt(base, x, y);
    const fb = f ? base.frames[f] : undefined;
    const list = f ? doc.frames?.[f]?.shapes ?? [] : doc.shapes ?? [];
    const s: SketchShape = { type: "text", points: [[Math.round(x - (fb?.ox ?? 0)), Math.round(y - (fb?.oy ?? 0))]], text: "Text", ...(color !== "ink" ? { color } : {}) };
    const next = M.setAt(doc, f ? ["frames", f, "shapes"] : ["shapes"], [...list, s]);
    edit(next);
    const key = `shape:${f}:${list.length}`;
    setSel([key]);
    setTool("select");
    window.setTimeout(() => startEdit(key, next, layoutBoard(next, cards)), 0);
  };

  const onConnect = (from: string, to: string | null, x: number, y: number) => {
    if (!doc || !base) return;
    if (to) {
      const d = M.addLink(doc, from, to);
      if (d === doc) { flash("They're already connected."); return; }
      edit(d);
      setSel([`edge:${(d.links ?? []).length - 1}`]);
      return;
    }
    const r = addAt(doc, { text: "" }, x, y, base);
    addAndEdit({ doc: M.addLink(r.doc, from, r.id), id: r.id });
  };

  const onDouble = (key: M.Key | null, x: number, y: number) => {
    if (!doc || !base) return;
    if (key) { setSel([key]); startEdit(key); return; }
    addAndEdit(addAt(doc, { text: "" }, x, y, base));
  };

  const add = (p: Payload, at?: { x: number; y: number }) => {
    if (!doc || !base) return;
    if ("frame" in p) {
      const r = at ? newFrame(doc, { size: [560, 340] }, [Math.round(at.x - 40), Math.round(at.y - 30)]) : newFrame(doc, { size: [560, 340] });
      edit(r.doc);
      setSel([`frame:${r.id}`]);
      const Lx = layoutBoard(r.doc, cards);
      if (!at) { const el = canvasEl.current; const b = Lx.frames[r.id]; if (el && b) { const rr = el.getBoundingClientRect(); setView(fitView(b, rr.width, rr.height, 80, 0.9)); } }
      window.setTimeout(() => startEdit(`frame:${r.id}`, r.doc, Lx), 0);
      return;
    }
    const n = M.clone(p.node);
    const selId = selectedNode();
    const t = typeOf(n);
    if (t === "stamp") {
      const d = at ? stampAt(doc, n, at.x, at.y, base) : selId ? Object.assign(M.addNode(doc, { ...n, near: selId }).doc, { __id: undefined }) : stampAt(doc, n, viewCenter().x, viewCenter().y, base);
      const id = (d as { __id?: string }).__id ?? Object.keys(d.nodes).find((k) => !doc.nodes[k]);
      delete (d as { __id?: string }).__id;
      edit(d);
      if (id) setSel([`node:${id}`]);
      return;
    }
    if (at) {
      const r = addAt(doc, n, at.x, at.y, base);
      if (["box", "pill", "diamond", "sticky", "text"].includes(t)) addAndEdit(r);
      else { edit(r.doc); setSel([`node:${r.id}`]); if (t === "link") setFocusText((x) => x + 1); }
      return;
    }
    if (selId && !isNote(doc.nodes[selId])) {
      // next to what's selected: notes stick beside it, steps follow it, cards are linked from it
      if (t === "sticky" || t === "text" || t === "link") {
        const r = M.addNode(doc, { ...n, near: selId });
        if (t === "link") { edit(r.doc); setSel([`node:${r.id}`]); setFocusText((x) => x + 1); } else addAndEdit(r);
        return;
      }
      const r = M.addNode(doc, { ...n, frame: homeFrame(doc, selId) || undefined });
      const d = M.addLink(r.doc, selId, r.id, t === "card" ? { style: "dashed" } : {});
      if (t === "card") { edit(d); setSel([`node:${r.id}`]); } else addAndEdit({ doc: d, id: r.id });
      return;
    }
    const c = pointer.current && L && inView(pointer.current) ? pointer.current : viewCenter();
    add(p, c);
  };
  const inView = (pt: { x: number; y: number }) => {
    const r = canvasEl.current?.getBoundingClientRect();
    if (!r) return false;
    const sx = pt.x * view.k + view.x, sy = pt.y * view.k + view.y;
    return sx > 40 && sy > 40 && sx < r.width - 40 && sy < r.height - 40;
  };

  const onDrop = (payload: string, x: number, y: number) => {
    try { add(JSON.parse(payload) as Payload, { x, y }); } catch { /* not ours */ }
  };
  const onDropFile = async (f: File, x: number, y: number) => {
    if (!doc || !base) return;
    try {
      const up = await api.upload(f);
      const r = addAt(doc, { type: "card", ref: up.ref ?? up.path }, x, y, base);
      edit(r.doc);
      setSel([`node:${r.id}`]);
      if (up.ref) flash(`That's ${up.ref.split("/").pop()}: added as a live card. It updates when the storyboard or wireframe changes.`);
    } catch { flash("Couldn't add that image."); }
  };

  const onMarkup = (frame: string, strokes: MarkupStroke[]) => { if (doc) edit(M.setAt(doc, ["markup", frame], strokes.length ? strokes : undefined)); };

  /** The note Storyboard Kit and Wireframe Kit put next to a copied picture (where the browser allows it). */
  const kitClip = async (): Promise<{ file: string; part?: string } | undefined> => {
    try {
      for (const item of await navigator.clipboard.read()) {
        for (const t of item.types) {
          if (t === "web application/x-storyboard") {
            const c = JSON.parse(await (await item.getType(t)).text());
            if (c?.from?.file) return { file: c.from.file, part: c.from.panel };
          }
          if (t === "web application/x-wireframe-screen") {
            const c = JSON.parse(await (await item.getType(t)).text());
            if (c?.file) return { file: c.file, part: c.screen };
          }
        }
      }
    } catch { /* no permission, or nothing extra on the clipboard */ }
    return undefined;
  };

  // paste: our own nodes, a link (makes a link card), an image (makes a card) or plain words (a sticky)
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if (!doc || !base || play !== null) return;
      if (e.target instanceof Element && e.target.closest("input,textarea,select,[contenteditable]")) return;
      const at = pointer.current && inView(pointer.current) ? pointer.current : viewCenter();
      const img = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (img) {
        e.preventDefault();
        // a panel copied in Storyboard Kit or a screen from Wireframe Kit carries a note saying where it's from
        const src = await kitClip();
        const ref = src ? (await api.find(src.file).catch(() => ({ ref: null }))).ref : null;
        if (src && ref) {
          const r = addAt(doc, { type: "card", ref: `${ref}${src.part ? `#${src.part}` : ""}` }, at.x, at.y, base);
          edit(r.doc);
          setSel([`node:${r.id}`]);
          flash(`Added as a live card: it follows ${src.file}.`);
          return;
        }
        onDropFile(img, Math.round(at.x), Math.round(at.y));
        return;
      }
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!text.trim()) return;
      e.preventDefault();
      try {
        const o = JSON.parse(text);
        const pack = o?.[CLIP] as { nodes: Record<string, FNode>; links: FlowchartFile["links"] } | undefined;
        if (pack?.nodes) {
          let d = doc;
          const ids: Record<string, string> = {};
          const fr = frameAt(base, at.x, at.y);
          for (const [old, n0] of Object.entries(pack.nodes)) {
            const n: FNode = { ...n0 };
            if (n.near && !pack.nodes[n.near]) delete n.near;
            if (!n.near) { if (fr) n.frame = fr; else delete n.frame; }
            const r = M.addNode(d, n, M.newId(d, n));
            ids[old] = r.id; d = r.doc;
          }
          for (const n of Object.values(ids).map((id) => d.nodes[id])) if (n.near) n.near = ids[n.near];
          for (const l of pack.links ?? []) if (ids[l.from] && ids[l.to]) d = M.addLink(d, ids[l.from], ids[l.to], { ...(l.label ? { label: l.label } : {}), ...(l.style === "dashed" ? { style: "dashed" as const } : {}) });
          const first = Object.values(ids)[0];
          if (first && Object.keys(ids).length === 1) d = placeCentered(d, first, at.x, at.y);
          edit(d);
          setSel(Object.values(ids).map((id) => `node:${id}`));
          return;
        }
      } catch { /* plain text */ }
      const t = text.trim();
      const url = isUrl(t) ? (t.startsWith("www.") ? `https://${t}` : t) : undefined;
      const r = addAt(doc, url ? { type: "link", url, text: url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") } : { type: "sticky", text: t.slice(0, 400) }, at.x, at.y, base);
      edit(r.doc);
      setSel([`node:${r.id}`]);
      if (url) { setFocusText((x) => x + 1); flash("Link card added. Give it a title in the inspector."); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  // keyboard
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (play !== null || !doc) return;
      const typing = (e.target as HTMLElement).closest("input,textarea,select,[contenteditable]");
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) step(redo, undo); else step(undo, redo); return; }
      if (typing) return;
      const one = selectedNode();
      if (e.key === "Escape") { setMenu(false); if (tool !== "select") setTool("select"); else setSel([]); return; }
      if (e.key === "Tab" && one) { e.preventDefault(); addAndEdit(nextStep(doc, one)); return; }
      if (e.key === "Enter" && one && !e.shiftKey) { e.preventDefault(); addAndEdit(sibling(doc, one)); return; }
      if ((e.key === "F2" || (e.key === "Enter" && e.shiftKey)) && sel.length === 1) { e.preventDefault(); startEdit(sel[0]); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && sel.length) { e.preventDefault(); a.remove(); return; }
      if (mod && e.key.toLowerCase() === "d" && sel.length) { e.preventDefault(); a.duplicate(); return; }
      if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); setSel(Object.keys(doc.nodes).map((id) => `node:${id}`)); return; }
      if (mod && e.key.toLowerCase() === "c" && sel.some((k) => k.startsWith("node:"))) {
        e.preventDefault();
        const ids = sel.filter((k) => k.startsWith("node:")).map((k) => k.slice(5));
        const nodes = Object.fromEntries(ids.map((id) => [id, doc.nodes[id]]));
        const links = (doc.links ?? []).filter((l) => ids.includes(l.from) && ids.includes(l.to));
        await navigator.clipboard.writeText(JSON.stringify({ [CLIP]: { nodes, links } }, null, 2)).catch(() => undefined);
        flash("Copied. Paste onto any board, or to your agent as JSON.");
        return;
      }
      if (mod && e.key === "0") { e.preventDefault(); fit(); return; }
      if (mod || e.altKey) return;
      if (sel.length && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        onMoveSel(e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0, e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0, true);
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        if (one && !isNote(doc.nodes[one])) addAndEdit(M.addNode(doc, { type: "sticky", text: "", near: one }));
        else { const c = pointer.current && inView(pointer.current) ? pointer.current : viewCenter(); add({ node: { type: "sticky", text: "" } }, c); }
        return;
      }
      if (key === "p") { a.play(); return; }
      if (key === "f" && sel.length) { a.focus(sel[0]); return; }
      const t = TOOL_KEYS[key];
      if (t) setTool(t);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // read-only hook for the end-to-end tests: where things are on the canvas
  useEffect(() => { (window as unknown as { __fc: unknown }).__fc = { L, view, sel, doc }; }, [L, view, sel, doc]);

  if (error && !doc) return <div className="boot">Couldn't load the board: {error}</div>;
  if (!doc || !shown || !L || !base) return <div className="boot">Loading…</div>;

  const errs = result?.errors.length ?? 0, warns = result?.warnings.length ?? 0;
  const deck = slides(doc, base);
  return (
    <div className="app">
      <header className="top">
        <span className="brand">Flowchart Kit</span>
        <span className="file" title={file}>{file}</span>
        <button className={`btn${palette ? " on" : ""}`} onClick={() => setPalette(!palette)}>Palette</button>
        <button className="btn" disabled={!undo.current.length} onClick={() => step(undo, redo)} title="Undo (⌘Z)">Undo</button>
        <button className="btn" disabled={!redo.current.length} onClick={() => step(redo, undo)} title="Redo (⇧⌘Z)">Redo</button>
        <span className="spacer" />
        <span className={`status ${errs ? "err" : warns ? "warn" : "ok"}`} onClick={() => setSel([])} title="Show all checks">
          {errs ? `${errs} error${errs > 1 ? "s" : ""}` : warns ? `${warns} suggestion${warns > 1 ? "s" : ""}` : "Looks good"}
          {status === "saving" ? " · saving" : status === "error" ? " · not saved" : " · saved"}
        </span>
        <span className="zoom">
          <button className="btn ghost" onClick={() => setView((v) => ({ ...v, k: Math.max(0.1, v.k / 1.25) }))} title="Zoom out">−</button>
          <button className="btn ghost mono" onClick={() => fit()} title="Fit everything (⌘0)">{Math.round(view.k * 100)}%</button>
          <button className="btn ghost" onClick={() => setView((v) => ({ ...v, k: Math.min(3, v.k * 1.25) }))} title="Zoom in">+</button>
        </span>
        <div className="menu">
          <button className="btn" onClick={() => setMenu(!menu)}>Export</button>
          {menu ? <div className="menu-list" onClick={() => setMenu(false)}>
            <a href="/api/export?format=png" download>Board as PNG</a>
            <a href="/api/export?format=svg" download>Board as SVG</a>
            <a href="/api/export?format=pdf" download>PDF (board + a page per frame)</a>
            <a href="/api/export?format=pptx" download>Slides (PowerPoint, Keynote, Google Slides)</a>
            <a href="/api/export?format=canvas" download>JSON Canvas (Obsidian)</a>
          </div> : null}
        </div>
        <button className="btn dark" onClick={() => a.play()} title={`Present ${deck.length} slide${deck.length === 1 ? "" : "s"} (P)`}>Play</button>
      </header>
      <div className={`main${palette ? " with-palette" : ""}`}>
        {palette ? <Palette onAdd={(p) => add(p)} bust={bust} onUpload={(f) => { const c = viewCenter(); onDropFile(f, Math.round(c.x), Math.round(c.y)); }} /> : null}
        <div className="canvas-wrap" ref={canvasEl}>
          <Canvas doc={shown} L={L} cards={cards} cardHref={cardHref} view={view} setView={setView} sel={sel} onSelect={setSel} tool={tool}
            onMoveSel={onMoveSel} onResize={onResize} onDraw={onDraw} onTextTool={onTextTool} onConnect={onConnect} onDouble={onDouble}
            onDrop={onDrop} onDropFile={onDropFile} onPointer={(x, y) => { pointer.current = { x, y }; }}
            editing={editing} onEditDone={finishEdit} dragging={dragging} setDragging={setDragging} />
          <Tools tool={tool} setTool={setTool} color={color} setColor={setColor} />
          {error ? <div className="banner">{error}</div> : null}
        </div>
        <Inspector doc={doc} L={base} cards={cards} sel={sel} result={result} a={a} focusText={focusText} />
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
      {play !== null ? <Play doc={doc} L={base} cards={cards} cardHref={cardHref} start={play} onMarkup={onMarkup} onExit={(f) => { setPlay(null); if (f) setSel([`frame:${f}`]); }} /> : null}
    </div>
  );
}
