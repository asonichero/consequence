// Climbing Toward Consequence — the touch controls: one set, for every scene that has the player's hands in it, on every device (a mouse works them as a finger does; the keyboard still answers, but nothing says so).
//   Left thumb: the stick, with Sneak (a latching toggle) just above it.  Right thumb: Jump / Climb (big, lowest), Action beside it, Run (held while pressed) above, and Drop (Put down, or a beat's second answer) between them.
//   Top right, under the Menu button: the camera button, which steps through the zooms and first person.
//   Every button has an icon; Jump and Action also carry a small label for what a tap will do now. A scene gets the buttons it asks for (the others are not drawn), and a button that would do nothing just now is greyed and ignores taps.
//   By mode (the page's body[data-mode], set by G.setMode): explore shows them all; a beat is answered by the Context button alone (Action, in Jump's place, with Drop beside it when there is a second answer);
//   a cutscene shows none.
// Use:  const ui = TouchUI.create({ run: true, sneak: true, jump: true, act: true, drop: true, cam: true });
//       ui.stick ({x, y}, -1..1); ui.run / ui.sneak (booleans); ui.on = { jump, jumpUp, act, drop, cam, run, sneak };
//       ui.set('jump', { label: 'Climb', icon: 'climb', enabled: true });  ui.set('cam', { icon: 'eye', title: '…' });  ui.show(false);  ui.destroy().
(function (root) {
'use strict';
const ICONS = {
  jump: '<path d="M12 19V6"/><path d="M6.5 11.5 12 6l5.5 5.5"/><path d="M7 21h10"/>',
  climb: '<path d="M7 3v18M17 3v18"/><path d="M7 7h10M7 12h10M7 17h10"/>',
  pull: '<path d="M5 17h14"/><path d="M12 15V5"/><path d="M7.5 9.5 12 5l4.5 4.5"/>',
  act: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5V5a1.5 1.5 0 0 1 3 0v5.5"/><path d="M14 10.5V6.5a1.5 1.5 0 0 1 3 0V15c0 3.6-2.4 6-5.6 6-2.4 0-4-1.2-5.2-3.4L4.4 13.600a1.400 1.400 0 0 1 2.400-1.400L8 13.800"/>',
  drop: '<path d="M12 4v11"/><path d="M7 10.5l5 5 5-5"/><path d="M5 20h14"/>',
  run: '<path d="M5 6l6 6-6 6"/><path d="M12 6l6 6-6 6"/>',
  sneak: '<circle cx="14" cy="5" r="2"/><path d="M13 8.500 9.500 12 12 14.500l-1 5.500"/><path d="M9.500 12 6 11M12 14.500 16.500 16l2.500 4"/>',
  camera: '<path d="M3 8h4l1.600-2.400h6.800L17 8h4v11H3z"/><circle cx="12" cy="13.200" r="3.600"/>',
  eye: '<path d="M2 12s4-6.500 10-6.500S22 12 22 12s-4 6.500-10 6.500S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  keys: '<rect x="2.500" y="6" width="19" height="12" rx="2"/><path d="M6 10h1M10 10h1M14 10h1M18 10h1M7 14h10"/>',
  grip: '<path d="M7 11V8a1.500 1.500 0 0 1 3 0v-1.500a1.500 1.500 0 0 1 3 0V8a1.500 1.500 0 0 1 3 0v6c0 4-2.500 6-5.500 6S6 17.500 6 14.500V12"/>',
};
const CSS = `
  #cwPrompt, #cHint, #gHint, #clHint, .mhint { display: none !important; }       /* (the old key prompts: the Context button says what a tap will do, so none is drawn) */
  #tui { position: fixed; inset: 0; pointer-events: none; z-index: 12; display: none; -webkit-touch-callout: none; --tsl: var(--sl, 0px); --tsr: var(--sr, 0px); --tst: var(--st, 0px); --tsb: var(--sb, 0px); }
  #tui .tb { position: absolute; pointer-events: auto; margin: 0; padding: 0; border-radius: 50%; border: 2.5px solid rgba(255,255,255,0.85); background: rgba(20,22,30,0.72); color: #fff; display: none; flex-direction: column; align-items: center; justify-content: center; touch-action: none; -webkit-tap-highlight-color: transparent; font: 600 10.5px/1 Georgia, serif; letter-spacing: .02em; }
  #tui .tb svg { fill: none; stroke: #fff; stroke-width: 2.1; stroke-linejoin: round; stroke-linecap: round; }
  #tui .tb span { margin-top: 2px; max-width: 94%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 3px #000; }
  #tui .tb span.l7 { font-size: 9.5px; }
  #tui .tb span.l2 { white-space: normal; text-align: center; font-size: 9px; line-height: 1.05; letter-spacing: 0; margin-top: 1px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; max-width: 90%; }       /* (a longer verb takes two lines, in the same button) */
  #tui .tb.long svg { width: 20px !important; height: 20px !important; }
  #tui .tb.on { background: #6b5a2a; border-color: #f0d98a; } #tui .tb.down { background: rgba(80,86,110,0.95); transform: scale(0.94); }
  #tui .tb.off { opacity: 0.32; filter: grayscale(1); }
  #tui .tb.ring::after { content: ''; position: absolute; inset: -7px; border-radius: 50%; pointer-events: none; background: conic-gradient(#f0d98a calc(var(--ring, 0) * 360deg), rgba(255,255,255,0.16) 0); -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3.5px)); mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3.5px)); }       /* (a ring that fills while the answer is not yet ready) */
  #tui .tb.ready { background: #6b5a2a; border-color: #f0d98a; }       /* (gold: there is something here to do) */
  #tui .tb.ask { animation: tbAsk 1.1s ease-in-out infinite; } @keyframes tbAsk { 0%, 100% { box-shadow: 0 0 0 0 rgba(240,217,138,0.55); } 50% { box-shadow: 0 0 0 9px rgba(240,217,138,0); } }       /* (and breathing: the scene is waiting for it) */
  #tui .tb.vis { display: flex; } #tui.hasStick #tStick { display: block; }
  #tJump { right: calc(var(--tsr) + 22px); bottom: calc(var(--tsb) + 24px); width: 78px; height: 78px; } #tJump svg { width: 34px; height: 34px; }
  #tAct { right: calc(var(--tsr) + 112px); bottom: calc(var(--tsb) + 34px); width: 66px; height: 66px; } #tAct svg { width: 28px; height: 28px; }
  #tDrop { right: calc(var(--tsr) + 106px); bottom: calc(var(--tsb) + 104px); width: 58px; height: 58px; } #tDrop svg { width: 22px; height: 22px; }
  #tRun { right: calc(var(--tsr) + 37px); bottom: calc(var(--tsb) + 112px); width: 54px; height: 54px; } #tSneak { left: calc(var(--tsl) + 52px); bottom: calc(var(--tsb) + 170px); width: 54px; height: 54px; } #tRun svg, #tSneak svg { width: 25px; height: 25px; }
  #tCam { right: calc(var(--tsr) + 12px); top: calc(var(--tst) + 72px); width: 56px; height: 56px; z-index: 36; } #tCam svg { width: 30px; height: 30px; }
  #tStick { position: absolute; left: calc(var(--tsl) + 22px); bottom: calc(var(--tsb) + 26px); width: 130px; height: 130px; border-radius: 50%; background: rgba(20,22,28,0.45); border: 2px solid rgba(230,196,106,0.55); touch-action: none; display: none; pointer-events: auto; }
  #tKnob { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; background: rgba(230,196,106,0.75); pointer-events: none; }
  /* a beat: the Context button answers what is asked, in the thumb's own place, and a second answer sits beside it; nothing else is drawn */
  body[data-mode="beat"] #tui #tStick, body[data-mode="beat"] #tui #tJump, body[data-mode="beat"] #tui #tRun, body[data-mode="beat"] #tui #tSneak, body[data-mode="beat"] #tui #tDrop.off { display: none !important; }
  body[data-mode="beat"] #tui #tAct { right: calc(var(--tsr) + 22px); bottom: calc(var(--tsb) + 24px); width: 78px; height: 78px; } body[data-mode="beat"] #tui #tAct svg { width: 34px; height: 34px; }
  body[data-mode="beat"] #tui #tDrop { right: calc(var(--tsr) + 112px); bottom: calc(var(--tsb) + 34px); width: 66px; height: 66px; } body[data-mode="beat"] #tui #tDrop svg { width: 28px; height: 28px; }
  body.fixedcam #tui #tCam { display: none !important; }       /* (the scene holds the camera: there is nothing for the button to turn) */
  @media (max-height: 420px) { #tJump, body[data-mode="beat"] #tui #tAct { width: 68px; height: 68px; right: calc(var(--tsr) + 18px); bottom: calc(var(--tsb) + 18px); } #tAct, body[data-mode="beat"] #tui #tDrop { right: calc(var(--tsr) + 98px); bottom: calc(var(--tsb) + 26px); width: 58px; height: 58px; } #tDrop { right: calc(var(--tsr) + 94px); bottom: calc(var(--tsb) + 92px); width: 54px; height: 54px; } #tStick { width: 112px; height: 112px; left: calc(var(--tsl) + 16px); bottom: calc(var(--tsb) + 18px); } #tRun { right: calc(var(--tsr) + 28px); bottom: calc(var(--tsb) + 98px); width: 48px; height: 48px; } #tSneak { left: calc(var(--tsl) + 44px); bottom: calc(var(--tsb) + 140px); width: 48px; height: 48px; } #tCam { top: calc(var(--tst) + 66px); width: 48px; height: 48px; } }`;
let UI = null;
const svg = name => '<svg viewBox="0 0 24 24">' + (ICONS[name] || '') + '</svg>';
function build() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'tui';
  el.innerHTML = '<div id="tStick"><div id="tKnob"></div></div>' +
    '<button id="tJump" class="tb"></button><button id="tAct" class="tb"></button><button id="tDrop" class="tb"></button><button id="tRun" class="tb"></button><button id="tSneak" class="tb"></button><button id="tCam" class="tb"></button>';
  document.body.appendChild(el);
  const $ = id => document.getElementById(id), B = { jump: $('tJump'), act: $('tAct'), drop: $('tDrop'), run: $('tRun'), sneak: $('tSneak'), cam: $('tCam') };
  const ui = { el, stick: { x: 0, y: 0 }, run: false, sneak: false, on: {}, keys: null, B, state: {} };
  const DEF = { jump: ['jump', 'Jump'], act: ['act', 'Do'], drop: ['drop', 'Drop'], run: ['run', 'Run'], sneak: ['sneak', 'Sneak'], cam: ['camera', ''] };
  const drawFace = k => { const s = ui.state[k], b = B[k]; const lab = s.label && (k === 'jump' || k === 'run' || k === 'sneak' || ((k === 'act' || k === 'drop') && s.enabled)) ? s.label : '';       // (a Context button with nothing to do says nothing)
    b.classList.toggle('long', lab.length > 8); b.innerHTML = svg(k === 'act' && s.label === 'Look' ? 'eye' : s.icon) + (lab ? '<span class="' + (lab.length > 8 ? 'l2' : lab.length > 6 ? 'l7' : '') + '">' + lab + '</span>' : ''); b.title = s.title || s.label || ''; };
  const drawState = k => { const s = ui.state[k], b = B[k], rg = s.ring == null ? null : Math.max(0, Math.min(1, s.ring)); b.classList.toggle('off', !s.enabled); b.classList.toggle('on', !!s.on); b.classList.toggle('ready', (s.ready == null ? k === 'act' || k === 'drop' : !!s.ready) && s.enabled);       // (the Context button and its Alt are gold whenever there is something here for them to do)
     b.classList.toggle('ask', !!s.ask && s.enabled); b.classList.toggle('ring', rg !== null); if (rg !== null) b.style.setProperty('--ring', rg.toFixed(3)); b.setAttribute('aria-disabled', s.enabled ? 'false' : 'true'); };
  const draw = k => { if (ui.state[k]) { drawFace(k); drawState(k); } };
  ui.set = (k, o) => { const s = ui.state[k]; if (!s) return; let face = false, st_ = false; for (const p in o) if (s[p] !== o[p]) { s[p] = o[p]; if (p === 'icon' || p === 'label' || p === 'title' || (p === 'enabled' && (k === 'act' || k === 'drop'))) face = true; else st_ = true; } if (face) drawFace(k); if (face || st_) drawState(k); };
  ui.setRun = on => { ui.run = on; if (ui.keys) ui.keys.run = on; ui.set('run', { on }); };
  ui.setSneak = on => { ui.sneak = on; ui.set('sneak', { on }); };
  ui.show = on => { el.style.display = on ? 'block' : 'none'; };
  ui.destroy = () => { el.style.display = 'none'; el.classList.remove('hasStick'); for (const k in B) B[k].classList.remove('vis'); ui.on = {}; ui.keys = null; ui.stick.x = ui.stick.y = 0; $('tKnob').style.transform = ''; };
  const fire = (name, ...a) => { const f = ui.on[name]; if (f) f(...a); };
  for (const k of ['jump', 'act', 'drop', 'cam']) {
    const b = B[k]; let held = false;
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (ui.state[k].enabled === false) return; held = true; b.setPointerCapture && b.setPointerCapture(e.pointerId); b.classList.add('down'); fire(k); });
    const up = e => { b.classList.remove('down'); if (held) { held = false; fire(k + 'Up'); } };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('contextmenu', e => e.preventDefault());
  }
  { const b = B.run; let held = false;                                                                // (Run is held, like Shift: it applies while the thumb is on it, and stops a sneak)
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (ui.state.run.enabled === false) return; held = true; b.setPointerCapture && b.setPointerCapture(e.pointerId); b.classList.add('down'); if (ui.sneak) { ui.setSneak(false); fire('sneak', false); } ui.setRun(true); fire('run', true); });
    const up = () => { b.classList.remove('down'); if (held) { held = false; ui.setRun(false); fire('run', false); } }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); b.addEventListener('contextmenu', e => e.preventDefault()); }
  B.sneak.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (ui.state.sneak.enabled === false) return; const on = !ui.sneak; ui.setSneak(on); fire('sneak', on); });
  { const sEl = $('tStick'), knob = $('tKnob'); let id = null;
    const set = e => { const r = sEl.getBoundingClientRect(); let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } ui.stick.x = dx; ui.stick.y = dy; knob.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`; };
    sEl.addEventListener('pointerdown', e => { if (id !== null) return; id = e.pointerId; sEl.setPointerCapture(id); set(e); e.preventDefault(); e.stopPropagation(); });
    sEl.addEventListener('pointermove', e => { if (e.pointerId === id) set(e); });
    const end = e => { if (e.pointerId === id) { id = null; ui.stick.x = ui.stick.y = 0; knob.style.transform = ''; } }; sEl.addEventListener('pointerup', end); sEl.addEventListener('pointercancel', end); }
  ui.reset = o => {                                                                                   // (a scene asks for the buttons it uses: those are drawn; the stick unless `stick: false`)
    o = o || {}; ui.destroy(); ui.keys = o.keys || null; ui.run = ui.sneak = false;
    for (const k in DEF) { const want = !!o[k]; ui.state[k] = { icon: DEF[k][0], label: DEF[k][1], enabled: want, on: false, ready: null, ask: false, ring: null, title: '' }; if (o[k] && typeof o[k] === 'object') Object.assign(ui.state[k], o[k]); draw(k); B[k].classList.toggle('vis', want); }
    el.classList.toggle('hasStick', o.stick !== false); el.style.display = 'block'; return ui; };
  return ui;
}
root.TouchUI = { create(o) { if (!UI) UI = build(); return UI.reset(o); }, ICONS };
})(typeof window !== 'undefined' ? window : globalThis);
