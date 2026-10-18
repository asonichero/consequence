// Climbing Toward Consequence — the game shell: the content notice and 18+ confirmation, the title screen (over the drone view of the homestead), settings, saves, and the cutscene
// toolkit the story scenes are written with. A cutscene is an async function that awaits these: G.say(who, text), G.shot(name, secs), G.fade(black, secs), G.wait(secs).
// Skipping sets a flag that makes every wait, line and move finish at once, so a scene can be skipped and still land on the right frame.
(function (root) {
'use strict';
const THREE = root.THREE, Audio_ = root.GameAudio, V3 = THREE.Vector3;
const $ = id => document.getElementById(id);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = { linear: t => t, inOut: t => t * t * (3 - 2 * t), out: t => 1 - (1 - t) * (1 - t), in: t => t * t, soft: t => t * t * t * (t * (6 * t - 15) + 10) };

const SAVE_KEY = 'castle-consequence:save:v1', NOTICE_KEY = 'castle-consequence:notice:v1', SET_KEY = 'castle-consequence:settings:v1';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* no storage */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* no storage */ } },
};

function create(els) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1)); els.stage.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 4000);
  const G = { renderer, camera, scene: null, t: 0, skipping: false, settings: Object.assign({ speed: 1, auto: true, subtitles: true }, store.get(SET_KEY, {})), shots: {}, updaters: [], drone: null, maxDt: 0.05 };
  const cam = { pos: new V3(), look: new V3(), fov: 50 }, move = { active: null };

  // ── Modes: what the player is doing, and so what is on the screen. This is the one place that says so: a scene names its mode (G.mode = 'beat', or G.setMode('beat', { skip: true })) and the page's CSS,
  // keyed on body[data-mode], puts up the right buttons. Nothing else touches the body's mode classes.
  //   title / notice / end   a menu over the world
  //   cutscene               nothing to control: a tap moves the line on; Skip and Menu are up
  //   beat                   a playable beat inside a directed scene: the one Context button answers what is asked (and an Alt beside it); no stick, no jump; the camera is the scene's
  //   explore                free play: the stick, the camera, the buttons, an objective  (cfg.fixedCam: the scene holds the camera, so there is no camera button)
  //   correction             the lap scenes: their own camera button and Red
  //   free                   the scene-notes page: no chrome at all
  // 'play', 'garden' and 'cine' are older names, kept so that a scene written with them still lands in the right mode.
  const MODE_NAME = { play: 'explore', garden: 'explore', cine: 'cutscene' }, MODES = ['title', 'notice', 'end', 'cutscene', 'beat', 'explore', 'correction', 'free'];
  let mode = 'notice';
  G.setMode = (m, cfg) => {
    m = MODE_NAME[m] || m; if (MODES.indexOf(m) < 0) throw new Error('Unknown mode: ' + m);
    cfg = cfg || {}; mode = m; const b = document.body;
    b.dataset.mode = m; b.classList.toggle('cutscene', m === 'cutscene'); b.classList.toggle('skippable', m === 'cutscene' || !!cfg.skip); b.classList.toggle('fixedcam', !!cfg.fixedCam);
    return m;
  };
  Object.defineProperty(G, 'mode', { get: () => mode, set: m => { G.setMode(m); }, enumerable: true });
  G.setMode('notice');

  function resize() { const w = els.stage.clientWidth || root.innerWidth, h = els.stage.clientHeight || root.innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  root.addEventListener('resize', resize); resize();

  // ── Camera: named shots {pos, look, fov}; G.shot(name | spec, secs, easing) moves there (secs 0 cuts); G.drone is a function(t) that drives the camera while set. ──
  const specOf = s => typeof s === 'string' ? G.shots[s] : s;
  const cutNow = s => { s = specOf(s); cam.pos.copy(s.pos); cam.look.copy(s.look); cam.fov = s.fov || cam.fov; move.active = null; };
  G.cut = cutNow;
  G.shot = (s, secs = 2, e = 'inOut') => new Promise(res => {
    s = specOf(s); if (G.skipping || secs <= 0) { cutNow(s); res(); return; }
    move.active = { from: { pos: cam.pos.clone(), look: cam.look.clone(), fov: cam.fov }, to: s, t: 0, secs, e: ease[e] || ease.inOut, res };
  });
  G.shotNow = () => ({ pos: cam.pos.clone(), look: cam.look.clone(), fov: cam.fov });

  // ── The HUD: what the screen says about the play, in one place and one look. Top left, in a stack inside the safe edge: the objective (the one standing line), a passing toast, and any meters (trust, stamina).
  // It is drawn in explore and beat modes only, so none of it lingers into a cutscene. A scene calls G.hud.objective(text) / toast(text, ms) / meter(id, { label, value 0..1, text, tone, mark }) / reset(); none draws its own. ──
  {
    const st = document.createElement('style');
    st.textContent = `#hud { position: fixed; left: calc(var(--sl, 0px) + 12px); top: calc(var(--st, 0px) + 10px); z-index: 12; display: none; flex-direction: column; align-items: flex-start; gap: 6px; max-width: calc(100vw - var(--sl, 0px) - var(--sr, 0px) - 112px); pointer-events: none; font-family: Georgia, serif; color: #ece8df; }
      body[data-mode="explore"] #hud, body[data-mode="beat"] #hud { display: flex; }
      #hud .hObj .done { opacity: .5; text-decoration: line-through; }
      #hud .hObj, #hud .hToast, #hud .hMeter { background: rgba(10,12,16,0.78); border: 1px solid #4a4d58; border-radius: 8px; line-height: 1.3; } #hud .hObj { padding: 7px 14px; font-size: clamp(13px, 1.9vw, 16px); }
      #hud .hToast { padding: 6px 12px; font-size: 14px; background: rgba(10,12,16,0.88); opacity: 0; transition: opacity .4s; } #hud .hMeters { display: flex; flex-direction: column; gap: 6px; }
      #hud .hMeter { width: min(230px, 42vw); padding: 5px 10px 6px; font-size: 13px; } #hud .hMeter .hl { display: flex; justify-content: space-between; gap: 8px; } #hud .hMeter.warn .hl { color: #f0a090; }
      #hud .hMeter .bar { position: relative; height: 9px; background: #1c1f27; border: 1px solid #454a58; border-radius: 4px; overflow: hidden; margin-top: 4px; } #hud .hMeter .bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #5a8a4a, #c9a84c); }
      #hud .hMeter.full .bar i { background: #7fd070; } #hud .hMeter.low .bar i { background: #c0503a; } #hud .hMeter .bar b { position: absolute; top: 0; bottom: 0; width: 2px; background: #f0b0a0; opacity: .9; }`;
    document.head.appendChild(st);
    const el = document.createElement('div'); el.id = 'hud'; el.innerHTML = '<div class="hObj" style="display:none"></div><div class="hToast"></div><div class="hMeters"></div>'; document.body.appendChild(el);
    const hObj = el.children[0], hToast = el.children[1], hMeters = el.children[2], meters = {}; let toastT = 0;
    const clean = t => root.Tips && root.Tips.clean ? root.Tips.clean(t) : t;
    G.hud = {
      objective(t) {                                                       // a line, or a list of { text, done } (those done are struck through)
        if (Array.isArray(t)) { const k = JSON.stringify(t); if (hObj.dataset.k !== k) { hObj.dataset.k = k; hObj.textContent = ''; t.forEach((it, i) => { if (i) hObj.appendChild(document.createTextNode('  ·  ')); const sp = document.createElement('span'); sp.textContent = clean(it.text); if (it.done) sp.className = 'done'; hObj.appendChild(sp); }); } hObj.style.display = 'block'; return; }
        hObj.dataset.k = ''; t = t ? clean(t) : ''; if (hObj.textContent !== t) hObj.textContent = t; hObj.style.display = t ? 'block' : 'none'; if (!t && G.cue) G.cue.set('goal', null); },       // (what the world points at as the goal goes with the line that names it)
      toast(t, ms = 3200) { hToast.textContent = clean(t); hToast.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { hToast.style.opacity = 0; }, ms); },
      meter(id, o) {
        let m = meters[id];
        if (!o) { if (m) { m.el.remove(); delete meters[id]; } return; }
        if (!m) { const e = document.createElement('div'); e.className = 'hMeter'; e.innerHTML = '<div class="hl"><span></span><b></b></div><div class="bar"><i></i></div>'; hMeters.appendChild(e); m = meters[id] = { el: e, n: e.querySelector('span'), v: e.querySelector('b'), bar: e.querySelector('.bar'), i: e.querySelector('i'), mark: null, last: {} }; }
        const L = m.last, set = (k, v, f) => { if (L[k] !== v) { L[k] = v; f(v); } };
        set('label', o.label || '', v => { m.n.textContent = v; }); set('text', o.text || '', v => { m.v.textContent = v; });
        set('bar', o.value == null ? -1 : Math.round(o.value * 200) / 200, v => { m.bar.style.display = v < 0 ? 'none' : 'block'; if (v >= 0) m.i.style.width = (v * 100) + '%'; });
        set('tone', o.tone || '', v => { for (const c of ['warn', 'full', 'low']) m.el.classList.toggle(c, c === v); });
        set('mark', o.mark == null ? -1 : o.mark, v => { if (m.mark) { m.mark.remove(); m.mark = null; } if (v >= 0) { m.mark = document.createElement('b'); m.mark.style.left = (v * 100) + '%'; m.bar.appendChild(m.mark); } });
      },
      reset() { this.objective(''); hToast.style.opacity = 0; clearTimeout(toastT); for (const k in meters) this.meter(k, null); if (G.cue) G.cue.clear(); },
    };
  }

  // ── Cues: what the world itself points at. A soft gold ring on the ground where something matters now (the objective, or what the Context button would act on), breathing slowly, and, when it is far off, a faint
  // column of light over it, so that it can be found. G.cue.set(id, { x, z, y, r } | null): a scene names its cues as they change; they are drawn in explore and beat modes only, and a scene's end clears them. ──
  {
    const cues = {}, grp = new THREE.Group(), ringGeo = new THREE.RingGeometry(0.74, 1, 48).rotateX(-Math.PI / 2), pilGeo = new THREE.CylinderGeometry(0.2, 0.2, 1, 14, 1, true).translate(0, 0.5, 0);
    const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xf0d98a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const pilMat = () => new THREE.MeshBasicMaterial({ color: 0xf0d98a, transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    G.cue = {
      set(id, o) {
        let c = cues[id];
        if (!o) { if (c) c.o = null; return; }
        if (!c) { const g = new THREE.Group(), ring = new THREE.Mesh(ringGeo, ringMat()), pil = new THREE.Mesh(pilGeo, pilMat()); g.add(ring, pil); c = cues[id] = { g, ring, pil, o: null }; grp.add(g); }
        c.o = o;
      },
      clear() { for (const id in cues) cues[id].o = null; },
      get(id) { const c = cues[id]; return c && c.o; },       // (what a cue is pointing at now: for tools and tests)
    };
    const u = (dt, t) => {
      const on = mode === 'explore' || mode === 'beat';
      if (grp.parent !== G.scene) { if (grp.parent) grp.parent.remove(grp); if (G.scene) G.scene.add(grp); }
      grp.visible = on; if (!on) return;
      for (const id in cues) {
        const c = cues[id], o = c.o; c.g.visible = !!o; if (!o) continue;
        const r = o.r || 10, k = 1 + 0.07 * Math.sin(t * 2.4);
        c.g.position.set(o.x, (o.y || 0) + 0.04 * r + 0.3, o.z); c.ring.scale.setScalar(r * k); c.ring.material.opacity = 0.38 + 0.17 * Math.sin(t * 2.4);
        const far = camera.position.distanceTo(c.g.position) > r * 9; c.pil.visible = far; if (far) c.pil.scale.set(r * 0.9, r * 8, r * 0.9);
      }
    };
    u.keep = true; G.updaters.push(u);
  }

  // ── Timing. ──
  const waiters = [];
  let skipSpin = 0;       // (a skipped wait ends at once; but a scene that loops on something outside itself must never starve the page: every 256th skipped wait gives the frame loop a turn)
  G.wait = secs => new Promise(res => { if (G.skipping) { if ((++skipSpin & 255) === 0) setTimeout(res, 0); else res(); return; } skipSpin = 0; waiters.push({ t: secs, res }); });
  const fadeEl = els.fade;
  G.fade = (toBlack, secs = 1) => G.noFade ? G.wait(secs) : new Promise(res => {
    if (G.skipping) { fadeEl.style.transition = 'none'; fadeEl.style.opacity = toBlack ? 1 : 0; res(); return; }
    fadeEl.style.transition = G.seekTo != null ? 'none' : `opacity ${secs}s ease`; fadeEl.style.opacity = toBlack ? 1 : 0; G.wait(secs).then(res);
  });

  // ── Dialogue: a subtitle box that types its line out (the voice babbles for the same length). A tap or key press finishes typing, then moves on. ──
  const subs = els.subs, subWho = els.subWho, subText = els.subText;
  let advance = null;
  const setAdvance = f => { advance = f; subs.classList.toggle('pending', !!f); };       // (a line that waits for a tap: the box takes the tap, in whatever mode, so a beat's line can never be left standing)
  const tap = () => { if (advance) advance(); };
  G.tap = tap;       // (so that a button of the scene's own, Red above all, can end a line that is waiting)
  const typing_ = e => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable);   // (keys typed into a field are not the story's)
  root.addEventListener('keydown', e => { if (G.manual || typing_(e)) return; if (e.key === 'Enter' || (e.key === ' ' && G.mode !== 'explore')) { if (advance || G.mode === 'cutscene') { e.preventDefault(); tap(); } } });
  els.stage.addEventListener('pointerdown', () => { if (G.mode === 'cutscene' && !G.manual) tap(); });       // (a cutscene has nothing else to touch; elsewhere the screen is the camera's, and only the line itself is tapped)
  subs.addEventListener('pointerdown', e => { e.stopPropagation(); if (!G.manual) tap(); });
  const WHO = { mother: ['Mother', '#e6b8a0'], jack: ['Jack', '#a8d8a0'], gerda: ['Gerda', '#e6a0c0'], peddler: ['Peddler', '#c8c090'], merchant: ['Merchant', '#a0c8f0'], narrator: ['', '#e6c46a'] };
  const whoOf = who => { const w = WHO[who] || [who, '#e6c46a']; return who === 'gerda' && !G.gerdaNamed ? ['The Giantess', w[1]] : w; };       // (Jack does not know her name until she gives it)
  let capTok = 0; const caps = new Set(), supersede = () => { subs.classList.remove('thought'); capTok++; for (const f of [...caps]) f(); }, live = { say: 0 };      // (a spoken line ends any caption still up, and no caption is drawn over a line while it is up: the two used to overwrite, and hide, each other)
  G.say = (who, text, opts) => new Promise(resolve => {
    if (G.sayOverride) { const o = G.sayOverride(who, text); if (o === null) { resolve(); return; } if (typeof o === 'string') text = o; }       // (scene notes: a line as it has been rewritten there, or taken out)
    const ep = G.epoch;
    if (G.skipping || (!G.settings.subtitles && !(opts && opts.force))) { resolve(); return; }
    supersede(); live.say++;
    const th = !!(opts && opts.thought), w = whoOf(who); subs.classList.toggle('thought', th); subWho.textContent = th ? w[0] + ' · thinking' : w[0]; subWho.style.color = th ? '#9fb4e8' : w[1]; subs.style.display = 'block'; subText.textContent = '';       // (a thought: not said; its own look, no voice, and no one in the scene hears it)
    const cps = 34 * G.settings.speed, typeSecs = Math.max(0.6, text.length / cps), voice = Audio_ && who !== 'narrator' && !th ? Audio_.speak(who, text, typeSecs, { muffle: opts && opts.muffle }) : null;
    const t0 = G.t; let typed = false, holdAt = null, poll = null, typing = null; const gateBtn = document.getElementById('subGate');
    let closed = false; const close = () => { if (!closed) { closed = true; live.say = Math.max(0, live.say - 1); } clearInterval(typing); clearInterval(poll); if (voice) voice.stop(); if (ep !== G.epoch) return; setAdvance(null); if (gateBtn) gateBtn.style.display = 'none'; if (!G.keepLine) subs.style.display = 'none'; resolve(); };
    const gateLabel = opts && opts.gate;
    const finish = () => {
      if (typed) return; typed = true; clearInterval(typing); subText.textContent = text;
      if (gateLabel) { gateBtn.textContent = gateLabel; gateBtn.style.display = 'inline-block'; gateBtn.onclick = e => { e.stopPropagation(); gateBtn.style.display = 'none'; close(); }; }   // a button inside the box that ends the line, so it cannot be missed
      else if (G.settings.auto) holdAt = G.t + Math.max(1100, text.length * 48 / G.settings.speed) / 1000;
    };
    typing = setInterval(() => { const n = Math.min(text.length, Math.floor((G.t - t0) * cps)); subText.textContent = text.slice(0, n); if (n >= text.length) finish(); }, 30);
    setAdvance(() => { if (!typed) { finish(); if (voice) voice.stop(); } else if (!gateLabel) close(); });            // a tap finishes the typing, the next one moves on
    poll = setInterval(() => { if (G.skipping || (G.seekTo != null && typed) || (holdAt != null && G.t >= holdAt) || ep !== G.epoch) close(); }, 60);
  });
  // A caption: a line spoken over the scene while it goes on (nothing waits for it, though the promise resolves when it has had its time). The next caption replaces it.
  G.caption = (who, text, opts) => new Promise(resolve => {
    if (live.say > 0) { resolve(); return; }
    subs.classList.remove('thought'); const tok = ++capTok, w = whoOf(who), cps = 34 * G.settings.speed, typeSecs = Math.max(0.6, text.length / cps), holdSecs = Math.max(1.1, text.length * 0.048 / G.settings.speed);
    subWho.textContent = w[0]; subWho.style.color = w[1]; subs.style.display = 'block'; subText.textContent = '';
    const voice = Audio_ && who !== 'narrator' ? Audio_.speak(who, text, typeSecs, { muffle: opts && opts.muffle }) : null, t0 = G.t, ep = G.epoch;
    const finish = () => { clearInterval(iv); caps.delete(finish); if (voice && voice.stop) voice.stop(); if (tok === capTok) subs.style.display = 'none'; resolve(); };
    const iv = setInterval(() => {
      const el = G.t - t0;
      if (tok === capTok) subText.textContent = el >= typeSecs ? text : text.slice(0, Math.floor(el * cps));
      if (el >= typeSecs + holdSecs || tok !== capTok && el >= typeSecs || ep !== G.epoch) finish();
    }, 30);
    caps.add(finish);
  });
  G.think = (text, opts) => G.say('jack', text, Object.assign({ thought: true }, opts || {}));       // (Jack's thought, as distinct from what he says)
  G.captionOff = () => { subs.classList.remove('thought'); capTok++; for (const f of [...caps]) f(); subs.style.display = 'none'; };
  // A choice for the player: buttons inside the dialogue box (or the keys 1 to 9); resolves with the index picked.
  G.choose = (who, options) => new Promise(resolve => {
    const w = whoOf(who), box = document.getElementById('subChoices'); subWho.textContent = w[0]; subWho.style.color = w[1]; subText.textContent = ''; subs.style.display = 'block'; box.innerHTML = ''; box.style.display = 'block'; setAdvance(null);
    const pick = i => { clearInterval(poll); root.removeEventListener('keydown', onKey, true); box.style.display = 'none'; box.innerHTML = ''; subs.style.display = 'none'; resolve(i); };
    const onKey = e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= options.length) { e.preventDefault(); e.stopPropagation(); pick(n - 1); } };
    options.forEach((o, i) => { const b = document.createElement('button'); b.className = 'choice'; b.textContent = typeof o === 'string' ? o : '(' + o.act + ')'; if (typeof o !== 'string') b.style.fontStyle = 'italic'; b.onclick = e => { e.stopPropagation(); pick(i); }; box.appendChild(b); });
    root.addEventListener('keydown', onKey, true);
    const poll = setInterval(() => { if (G.skipping) { clearInterval(poll); pick(0); } }, 80);
    if (G.skipping) pick(0);
  });
  G.hideLine = () => { subs.style.display = 'none'; setAdvance(null); };

  // ── The frame loop. ──
  let last = performance.now();
  function frame(now) {
    const real = Math.min(G.maxDt, (now - last) / 1000); last = now;
    if (G.seekTo != null && G.mode !== 'cutscene') G.seekTo = null;
    const seeking = G.seekTo != null; if (seeking !== muted) setMuted(seeking);
    const steps = G.paused ? 0 : seeking ? 40 : 1, dt = seeking ? 0.05 : real;
    for (let i = 0; i < steps; i++) { step(dt); if (seeking && G.seekTo == null) break; }
    if (G.scene) {
      camera.position.copy(cam.pos); camera.lookAt(cam.look); if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
      renderer.render(G.scene, camera);
    }
    requestAnimationFrame(frame);
  }
  function step(dt) {
    G.t += dt;
    for (let i = waiters.length - 1; i >= 0; i--) { const w = waiters[i]; w.t -= dt; if (w.t <= 0) { waiters.splice(i, 1); w.res(); } }
    if (G.skipping) { for (const w of waiters.splice(0)) w.res(); if (move.active) { const m = move.active; move.active = null; cutNow(m.to); m.res(); } }
    if (move.active) {
      const m = move.active; m.t += dt; const k = m.e(clamp(m.t / m.secs, 0, 1));
      cam.pos.lerpVectors(m.from.pos, m.to.pos, k); cam.look.lerpVectors(m.from.look, m.to.look, k); cam.fov = m.from.fov + ((m.to.fov || m.from.fov) - m.from.fov) * k;
      if (m.t >= m.secs) { move.active = null; m.res(); }
    } else if (G.drone) { const s = G.drone(G.t); cam.pos.copy(s.pos); cam.look.copy(s.look); cam.fov = s.fov; }
    for (const u of G.updaters) u(dt, G.t);
  }
  requestAnimationFrame(frame);

  // ── Scenes: G.setScene(world) shows a world ({ scene, update(dt, t) }) and runs its update each frame. ──
  G.setScene = world => { G.scene = world.scene; G.world = world; G.updaters = G.updaters.filter(u => !u.isWorld); const u = (dt, t) => world.update && world.update(dt, t); u.isWorld = true; G.updaters.push(u); };

  // ── Debug controls for cutscenes: pause / play, and jump to the start of the previous or next beat (a spoken line or a new camera angle). ──
  // A scene is a chain of awaited calls, so going forward just runs it fast (silently) up to the next beat, and going back runs the scene again from its start the same way, up to the
  // wanted beat (G.rerun, set by the screen code, starts the current scene afresh). A run that has been left behind is cut off: its calls never come back.
  G.epoch = 0; G.beat = 0; G.beatT = 0; G.seekTo = null; G.paused = false; G.rerun = null; G.debugCtl = false;
  let muted = false;
  const setMuted = m => { muted = m; const A = Audio_; if (A && A.nodes && A.nodes.master && A.ctx) { if (m) A.nodes.master.gain.value = 0; else A.setVol(); } };
  // Hooks for tools that work on the beats (scene-notes.html): onBeat(info) at every beat call; beatGate(n) may return a promise that holds the scene at the start of beat n;
  // camOverride(n) may return a camera { pos, look, fov } to use for beat n in place of the scene's own.
  G.sayOverride = null; G.note = text => { if (G.onBeat) G.onBeat({ beat: G.beat, kind: 'note', name: 'action', args: [text], isNew: false }); };       // (G.note: something the player is asked to do, for the script in the scene notes)
  G.onBeat = null; G.beatGate = null; G.camOverride = null; G.specOf = specOf; G.cutNow = cutNow;
  let stall = null, deferred = null;
  // A beat is one camera angle: it begins when the scene cuts (or moves) to a new angle and runs until the next one, whatever is said and done in between. (Lines said before any angle
  // has been set open beat 1.) G.cut(shot, setup): `setup` runs as the cut happens, to put everyone where they stand as the beat begins.
  const mark = kind => {
    if (kind === 'say' && G.beat > 0) return false;
    G.beat++; G.beatT = G.t; if (G.seekTo != null && G.beat >= G.seekTo) { G.seekTo = null; G.skipping = false; }
    return true;
  };
  const guard = fn => (...a) => { const ep = G.epoch, r = fn(...a); return r && r.then ? r.then(x => ep === G.epoch ? x : new Promise(() => {})) : r; };
  const wrapBeat = (name, kind) => {
    const f = G[name];
    G[name] = (...a) => {
      const isNew = mark(kind);
      if (G.onBeat) G.onBeat({ beat: G.beat, kind, name, args: a, isNew });
      const run = () => {
        if (kind === 'cut') { const ov = G.camOverride && G.camOverride(G.beat); if (ov) a = [ov, ...a.slice(1)]; }
        else if (isNew && G.camOverride) { const ov = G.camOverride(G.beat); if (ov) cutNow(ov); }
        if (name === 'cut') { f(a[0]); if (typeof a[1] === 'function') a[1](); return undefined; }
        return f(...a);
      };
      const gate = isNew && G.beatGate ? G.beatGate(G.beat) : null;
      if (gate) { if (name === 'cut') { stall = gate; deferred = run; return undefined; } return gate.then(run); }   // (a cut is not awaited, so the hold comes at the next awaited call)
      return run();
    };
  };
  wrapBeat('cut', 'cut'); wrapBeat('shot', 'cut'); wrapBeat('say', 'say'); wrapBeat('choose', 'say');
  const stalled = fn => (...a) => { if (stall) { const g = stall, d = deferred; stall = deferred = null; return g.then(() => { if (d) d(); return fn(...a); }); } return fn(...a); };
  for (const n of ['shot', 'say', 'choose', 'wait', 'fade', 'caption']) G[n] = guard(stalled(G[n]));      // (a caption, like a line, waits for the beat that holds the scene: it began in the previous beat otherwise)
  G.pause = on => { G.paused = on === undefined ? !G.paused : !!on; const A = Audio_; if (A && A.ctx) { try { G.paused ? A.ctx.suspend() : A.ctx.resume(); } catch (e) { /* no audio */ } } return G.paused; };
  G.forward = () => { if (G.mode !== 'cutscene') return; G.pause(false); G.seekTo = G.beat + 1; };
  // Run the current scene again from its start, fast and silent, up to the start of beat `target` (then it plays normally).
  G.restartAt = target => {
    if (!G.rerun) return false;
    G.pause(false); G.epoch++; G.beat = 0; stall = deferred = null; waiters.length = 0; move.active = null; G.skipping = false; G.seekTo = Math.max(1, target); G.hideLine();
    fadeEl.style.transition = 'none'; G.rerun(); return true;
  };
  G.rewind = () => G.mode === 'cutscene' && G.restartAt(G.t - G.beatT > 1.5 || G.beat <= 1 ? Math.max(1, G.beat) : G.beat - 1);      // (well into a beat, back goes to its own start)
  root.addEventListener('keydown', e => {
    if (!G.debugCtl || G.mode !== 'cutscene' || typing_(e)) return;
    if (e.key === 'p' || e.key === 'P') G.pause(); else if (e.key === ',' || e.key === '[') G.rewind(); else if (e.key === '.' || e.key === ']') G.forward(); else return; e.preventDefault();
  });

  G.store = store; G.SAVE_KEY = SAVE_KEY; G.NOTICE_KEY = NOTICE_KEY; G.saveSettings = () => store.set(SET_KEY, G.settings);
  G.save = data => G.noSave || store.set(SAVE_KEY, Object.assign(store.get(SAVE_KEY, {}), data, { savedAt: Date.now() }));
  const SHOT_KEY = 'castle-consequence:titleshot:v1';
  G.loadSave = () => store.get(SAVE_KEY, null); G.clearSave = () => { store.del(SAVE_KEY); store.del(SHOT_KEY); };
  // The wide view of the farm, as it stands now, kept for the title screen (rendered once from the drone's first position, then shrunk to a JPEG).
  G.titleShot = () => G.memShot || store.get(SHOT_KEY, null);
  G.snapshotFarm = (world, drone) => {
    if (!world || !world.scene || !drone) return;
    try {
      const s = drone(0), old = { fov: camera.fov, p: camera.position.clone() };
      camera.position.copy(s.pos); camera.fov = s.fov; camera.updateProjectionMatrix(); camera.lookAt(s.look);
      renderer.render(world.scene, camera);
      const c = document.createElement('canvas'); c.width = 1280; c.height = Math.round(1280 * renderer.domElement.height / renderer.domElement.width);
      c.getContext('2d').drawImage(renderer.domElement, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.78); if (G.noSave) G.memShot = url; else { G.memShot = null; store.set(SHOT_KEY, url); }
      camera.position.copy(old.p); camera.fov = old.fov; camera.updateProjectionMatrix();
    } catch (e) { console.warn('snapshotFarm', e && e.message); }
  };
  return G;
}

root.Game = { create, ease, store, SAVE_KEY, NOTICE_KEY };
})(typeof window !== 'undefined' ? window : globalThis);
