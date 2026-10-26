// Climbing Toward Consequence — Chapter Four, The Golden Egg: it opens on a dream.
//   Jack comes home to the cottage at half his size, in his day clothes, empty-handed. Neither he nor his Mother says a word about either. He walks across the room to her (playable), answers her
//   (dialogue, and one action: turning out his pockets), is called to her knee (playable again) and is corrected: shorter than the one at the close of Chapter One, and harder than anything
//   Gerda has done. Her last words send him back for something to bring home. The dream is lit cold, the hearth the one warm thing in it.
//   The cottage, his Mother and the discipline engine are Chapter One's (js/night.js, js/correction.js, js/lap.js).
//   Exposes Dream.run(G, W, opts) where W is Night.build's world; resolves { tier, slip }. opts.slip (0 to 2) stands in for how Chapter Three went.
(function (root) {
'use strict';
const THREE = root.THREE, B = root.Blocky, Lap = root.Lap, A = root.GameAudio, V3 = THREE.Vector3;
const v = (x, y, z) => new V3(x, y, z), clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const turn = (from, to, t) => { const d = ((to - from + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return from + d * t; };
const SC = B.SCALE.adult, STAGE_Y = B.SCALE.stageY, JS = 0.5, OUT = 'Day', RED = { red: true };

async function run(G, W, opts) {
  opts = opts || {};
  G.skipping = false;       // (a Skip pressed in the last scene would otherwise run on through every line here)
  const NOTES = !!opts.notes;       // (scene notes: no walking by hand, and it stops where the correction would begin)
  const { jackIn, ja, mother, ma, int, SEAT, scene } = W, say = (w, t, o) => G.say(w, t, o);
  const L = Object.assign({ lies: G.ch3lies || 0, rounds: 0, choreLied: false, obj: 0, washed: true }, G.ch3log || {});
  const day = L.lies + L.rounds + (L.choreLied ? 1 : 0) + 0.5 * Math.min(L.obj, 3) + (L.washed ? 0 : 0.5);
  const slip = opts.slip !== undefined ? opts.slip : day <= 0.5 ? 0 : day <= 2.5 ? 1 : 2;       // (0: nothing to hold against him; 1: a mixed day; 2: a hard one)
  const paint = o => W.paintJack(jackIn, Object.assign({ outfit: OUT, expr: 1 }, o));
  const el = G.renderer.domElement;

  // ── The room, by dream light; the two of them. ──
  const keep = { bg: scene.background, fog: scene.fog, hc: int.hemi.color.getHex(), hi: int.hemi.intensity, di: int.dim.intensity, dc: int.dim.color.getHex() };
  scene.background = new THREE.Color(0x070a16); scene.fog = new THREE.Fog(0x070a16, 120, 300);
  int.hemi.color.setHex(0x6070b0); int.hemi.intensity = 0.3; int.dim.color.setHex(0x8090d0); int.dim.intensity = 0.4;
  const rug = int.items.rug.g.position, M1 = v(rug.x, 0, rug.z), HEARTH = Math.PI;       // (she stands on the rug, facing the fire: ry π looks towards -z)
  jackIn.root.scale.setScalar(SC * JS); jackIn.root.visible = mother.root.visible = true; int.chair.visible = true; int.tableClutter.visible = true;
  const reset = () => { Object.assign(ja, { speed: 0, bare: 0, hold: 0, cover: 0, bow: 0, look: 0, fist: 0, shuffle: 0, rub: 0, hitch: 0 }); Object.assign(ma, { speed: 0, wag: 0, gesture: 0, fold: 0, chin: 0, tilt: 0, point: 0, side: 1 }); };
  reset(); paint({ trousers: 'up', drawers: 'up' }); B.setPose(mother, 'stand'); mother.pose = 'stand'; mother.setExpr(1);
  mother.root.position.copy(M1); mother.root.rotation.y = HEARTH;
  const J0 = v(34, 0, 60); jackIn.root.position.copy(J0); jackIn.root.rotation.y = Math.PI;
  for (let i = 0; i < 20; i++) { B.step(mother, 0.1); B.step(jackIn, 0.1); }
  G.setScene(W.iworld); G.drone = null; A && A.ambience({ wind: 0.15, birds: 0, fire: 0.5 }); A && A.duckMusic && A.duckMusic(0.35, 2);

  // ── What he can do: walk, in a camera that stays behind him; the room's furniture is in the way. ──
  const st = { free: false, pos: J0.clone(), heading: Math.PI, yaw: 0, pitch: 0.5, hb: 0, goal: null, onGoal: null };
  const tp = int.table.position, RECTS = [[tp.x - 19, tp.x + 19, tp.z - 14, tp.z + 14], [-58, -12, 49, 74], [-82, -50, -15, 35]], BLOCK = [[SEAT.x, SEAT.z, 12], [-65, -65, 9], [66, -66, 8]], LIM = 66;       // (the table, the bed, the stairs; the chair, the barrel, the crate)
  const blocked = (x, z) => Math.abs(x) > LIM || Math.abs(z) > LIM || BLOCK.some(b => Math.hypot(x - b[0], z - b[1]) < b[2]) || RECTS.some(r => x > r[0] && x < r[1] && z > r[2] && z < r[3]);
  const keys = {}, ui = NOTES ? { show() {}, destroy() {}, stick: { x: 0, y: 0 } } : root.TouchUI.create({ keys }), stick = ui.stick;
  const KM = { w: 'up', W: 'up', ArrowUp: 'up', s: 'down', S: 'down', ArrowDown: 'down', a: 'left', A: 'left', ArrowLeft: 'left', d: 'right', D: 'right', ArrowRight: 'right' };
  const kd = e => { const k = KM[e.key]; if (k) { keys[k] = true; if (e.key.startsWith('Arrow')) e.preventDefault(); } }, ku = e => { const k = KM[e.key]; if (k) keys[k] = false; };
  root.addEventListener('keydown', kd); root.addEventListener('keyup', ku);
  const drags = new Map(), pd = e => drags.set(e.pointerId, { x: e.clientX, y: e.clientY }), pm = e => { const d = drags.get(e.pointerId); if (!d) return; st.yaw -= (e.clientX - d.x) * 0.006; st.pitch = clamp(st.pitch + (e.clientY - d.y) * 0.005, 0.15, 1.2); d.x = e.clientX; d.y = e.clientY; }, pu = e => drags.delete(e.pointerId);
  el.addEventListener('pointerdown', pd); el.addEventListener('pointermove', pm); el.addEventListener('pointerup', pu); el.addEventListener('pointercancel', pu);
  const tick = dt => {
    if (!st.free) return;
    const f = v(-Math.sin(st.yaw), 0, -Math.cos(st.yaw)), r = v(Math.cos(st.yaw), 0, -Math.sin(st.yaw));
    const dir = v(0, 0, 0).addScaledVector(f, (keys.up ? 1 : 0) - (keys.down ? 1 : 0)).addScaledVector(r, (keys.right ? 1 : 0) - (keys.left ? 1 : 0));
    if (Math.hypot(stick.x, stick.y) > 0.2) dir.addScaledVector(f, -stick.y).addScaledVector(r, stick.x);
    let sp = 0;
    if (dir.lengthSq() > 0) {
      dir.normalize(); st.heading = turn(st.heading, Math.atan2(dir.x, dir.z), Math.min(1, dt * 9)); sp = 15;
      const nx = st.pos.x + Math.sin(st.heading) * sp * dt, nz = st.pos.z + Math.cos(st.heading) * sp * dt;
      if (!blocked(nx, st.pos.z)) st.pos.x = nx; if (!blocked(st.pos.x, nz)) st.pos.z = nz;
    }
    ja.speed = sp; ja.phase += B.stride(sp * dt) * 1.6;       // (the stride of a smaller, hurrying Jack: a shorter step, and more of them)
    ja.shuffle = 0; ja.bow = 0.25;
    jackIn.root.position.set(st.pos.x, 0, st.pos.z); jackIn.root.rotation.y = st.heading;
    const near = st.goal ? Math.hypot(st.pos.x - st.goal.x, st.pos.z - st.goal.z) : 99;
    st.hb += dt; if (A && A.thud && st.hb > lerp(0.5, 1.3, clamp((near - 20) / 90, 0, 1))) { st.hb = 0; A.thud(0.12); }       // (a heartbeat, quickening as he nears her)
    if (st.goal && near < st.goalR && st.onGoal) { const f2 = st.onGoal; st.onGoal = null; f2(); }
  };
  G.updaters.push(tick);
  const endInput = () => { ui.destroy(); G.hud.reset(); root.removeEventListener('keydown', kd); root.removeEventListener('keyup', ku); el.removeEventListener('pointerdown', pd); el.removeEventListener('pointermove', pm); el.removeEventListener('pointerup', pu); el.removeEventListener('pointercancel', pu); };
  G.dream = { st, M1, slip };       // (for tools and tests)
  // The cameras are fixed: low behind Jack with Mother in view as he walks (it does not follow him); over the shoulder for the talk.
  const yawFor = c => Math.atan2(-(c.look.x - c.pos.x), -(c.look.z - c.pos.z));
  const room = x => clamp(x, -70, 70);
  const camA = { pos: v(46, 10, 68), look: v(6, 16, -24), fov: 56 };       // (east of the table's line, or it would stand between him and her)
  let shotKey = null; const cutOnce = (k, spec, fn) => { if (shotKey === k) return; shotKey = k; G.cut(spec, fn); };       // (a beat is a camera angle: the same angle is not cut to twice running)
  const axis = () => { const a = mother.root.position, b = jackIn.root.position, dx = b.x - a.x, dz = b.z - a.z, n = Math.hypot(dx, dz) || 1; return { a, b, ux: dx / n, uz: dz / n }; };       // (u: from her to him)
  const otsMother = () => { const { a, b, ux, uz } = axis(); cutOnce('M', { pos: v(room(b.x + ux * 10 - uz * 5), 14, room(b.z + uz * 10 + ux * 5)), look: v(a.x, mother.pose === 'sit' ? 17 : 22, a.z), fov: 46 }); };       // (over Jack's shoulder, to her)
  const otsJack = () => { const { a, b, ux, uz } = axis(); cutOnce('J', { pos: v(room(a.x - ux * 30 + uz * 20), 38, room(a.z - uz * 30 - ux * 20)), look: v(b.x, 9, b.z), fov: 46 }); };                 // (over her shoulder, down to him)
  const camD = { pos: v(-46, 21, 31), look: v(-12.5, 12, -24), fov: 46 };       // (from the west: her calling him over, and his walk to her, are in this one angle)
  const sayD = async t => { cutOnce('D', camD); await say('mother', t); };
  const sayM = async t => { otsMother(); await say('mother', t); }, sayJ = async t => { otsJack(); await say('jack', t); };
  // Walking to a place: his, until he is within r of it (in scene notes it is done for him, by way of the points).
  const goTo = (p, r, text, cam, via) => new Promise(async res => {
    cutOnce(cam === camA ? 'A' : 'D', cam); st.yaw = yawFor(cam);
    const done = () => { st.free = false; G.hud.objective(''); G.cue.set('goal', null); ui.show(false); for (const k in keys) keys[k] = false; stick.x = stick.y = 0; ja.speed = 0; G.mode = 'cutscene'; res(); };
    if (NOTES) { G.note && G.note(text);
      for (const q of (via || []).concat([[p.x, p.z]])) { const last = q[0] === p.x && q[1] === p.z; while (Math.hypot(q[0] - st.pos.x, q[1] - st.pos.z) > (last ? r : 2)) { const ang = Math.atan2(q[0] - st.pos.x, q[1] - st.pos.z); st.heading = ang; st.pos.x += Math.sin(ang) * 0.6; st.pos.z += Math.cos(ang) * 0.6; ja.speed = 15; ja.phase += 0.3; jackIn.root.position.set(st.pos.x, 0, st.pos.z); jackIn.root.rotation.y = st.heading; await G.wait(0.04); } }
      done(); return;
    }
    G.skipping = false; G.setMode('explore', { fixedCam: true }); G.hideLine && G.hideLine(); ui.show(true);
    G.note && G.note(text);     G.hud.objective(text); G.cue.set('goal', { x: p.x, z: p.z, r: 14 }); st.free = true; st.goal = p; st.goalR = r; st.onGoal = done;
  });
  const faceEach = async () => {
    const a = mother.root.position, b = jackIn.root.position, tm = Math.atan2(b.x - a.x, b.z - a.z), tj = tm + Math.PI;
    for (let i = 0; i < 16; i++) { mother.root.rotation.y = turn(mother.root.rotation.y, tm, 0.3); jackIn.root.rotation.y = turn(jackIn.root.rotation.y, tj, 0.3); await G.wait(0.04); }
  };
  const pts = { score: 0 };
  let pickN = 0;
  const pickOf = async (who, opts2) => { otsMother(); const i = opts.picks ? Math.min(opts.picks[pickN++] || 0, opts2.length - 1) : await G.choose(who, opts2.map(o => o[0])); pts.score += opts2[i][1]; return i; };

  // ── 1. The threshold. ──
  G.mode = 'cutscene'; const f = document.getElementById('fade'); f.style.transition = 'none'; f.style.opacity = 1; void f.offsetWidth; f.style.transition = '';
  cutOnce('A', camA); await G.wait(0.2); G.fade(false, 2.2); await G.wait(0.6);
  await goTo(M1, 28, 'Go to Mother.', camA, [[28, 45], [28, 0]]);
  // ── 2. What did you bring me? ──
  await faceEach(); reset(); ma.side = 1; await G.wait(0.6);
  await sayM( 'Jack.'); await G.wait(0.5);
  await sayM( 'What did you bring me?');
  const a1 = await pickOf('jack', [['Nothing, Mother. I’m sorry.', 0], ['It’s coming. I only need a little longer.', 1], ['You never gave me the chance to finish!', 2], [{ act: 'Turn out your pockets' }, 0]]);
  if (a1 === 3) {
    otsJack(); for (let i = 1; i <= 14; i++) { ja.hold = 0.5 * i / 14; ja.cover = 0; await G.wait(0.04); } A && A.rustle && A.rustle(0.5); await G.wait(0.5);
    paint({ expr: 3 }); await G.wait(0.8); ja.hold = 0;
    await sayM( 'Empty.'); await sayM( 'Empty, Jack.');
  } else {
    await sayJ( ['Nothing, Mother. I’m sorry.', 'It’s coming. I only need a little longer.', 'You never gave me the chance to finish!'][a1]);
    ma.gesture = a1 === 2 ? 1 : 0.3; ma.wag = a1 === 2 ? 0.6 : 0;
    await sayM( ['Nothing.', 'A little longer.', 'Finish.'][a1]);
    await sayM( ['Nothing.', 'A little longer.', 'You have never finished a thing in your life.'][a1]);
  }
  reset(); ma.side = 1;
  // ── 3. The accounting: it is of his day, and it is hers. ──
  await sayM(['You were good, and what did it buy? Nothing in your hands.', 'The truth when it suits you, and a fib when it doesn’t, and home you come with nothing.', 'You lied, and you sulked, and you made a mess of every task you were given, and you come home with nothing.'][slip]);
  const a2 = await pickOf('jack', [['I’ll bring something, Mother. I promise.', 0], ['I was looked after. I had a bed.', 1], ['Perhaps I would, if you ever said a kind word!', 2]]);
  await sayJ( ['I’ll bring something, Mother. I promise.', 'I was looked after. I had a bed.', 'Perhaps I would, if you ever said a kind word!'][a2]);
  await sayM(['You promise.', 'Looked after. And what did you promise them, Jack?', 'Kind words. I gave you those, and you promised me the world for them.'][a2]);       // (each answer is met, and each leads to the same: she has heard it before; she is still standing, over his shoulder)
  // ── 4. Come here: she is seated when the angle opens (she sits between the shots, with nothing between them to see it), and the player goes to her in that same angle. ──
  const cl = (a, y, b) => v(SEAT.x + a * Math.sin(SEAT.ry) + (b || 0) * Math.cos(SEAT.ry), y, SEAT.z + a * Math.cos(SEAT.ry) - (b || 0) * Math.sin(SEAT.ry));
  const seatHer = () => {       // (done with the cut itself, so that nothing of it is seen in the shot before)
    reset();
    B.setPose(mother, 'sit'); mother.pose = 'sit'; mother.root.position.set(SEAT.x, STAGE_Y, SEAT.z); mother.root.rotation.y = SEAT.ry; ma.fold = 0; ma.side = 0;
    const J1 = cl(52, 0); st.pos.copy(J1); st.heading = SEAT.ry + Math.PI; st.yaw = SEAT.ry + Math.PI; jackIn.root.position.copy(J1); jackIn.root.rotation.y = st.heading; paint({});
    for (let i = 0; i < 12; i++) { B.step(mother, 0.1); B.step(jackIn, 0.1); } B.seatFeet(mother, 0);
  };
  await say('mother', 'You always promise, Jack.');       // (still over his shoulder, still standing)
  cutOnce('D', camD, seatHer);
  await sayD('Come here.');
  await goTo(cl(15, 0), 4, 'Go to her.', camD);
  if (NOTES) { endInput(); G.updaters = G.updaters.filter(u => u !== tick); G.mode = 'end'; return { tier: 0, slip }; }
  // ── 5. The correction: over her knee, with the hand; shorter than the one at the close of Chapter One, and harder. ──
  const tier = Math.min(2, Math.floor((pts.score + (slip >= 2 ? 1 : 0)) / 2)), pick = (a, b, c) => [a, b, c][tier];
  endInput();
  const lap = Lap.create(null, { external: { scene, camera: G.camera, renderer: G.renderer }, table: false, jackFull: 1 });
  lap.giver('mother', 1); lap.stage.scale.setScalar(SC); lap.stage.visible = false; lap.jack.root.visible = true; lap.st.noRecovery = true; lap.st.side = 'alt'; lap.outfit('jack', OUT);
  G.lap = lap;
  const placeStage = at => { lap.stage.position.set(at.x, STAGE_Y, at.z); lap.stage.rotation.y = at.ry; lap.stage.updateMatrixWorld(true); };
  const cworld = { scene, update(dt, t) { int.update(dt, t); ja.t += dt; ma.t += dt; B.step(jackIn, dt); B.step(mother, dt); if (lap.stage.visible) lap.update(dt); } };
  G.setScene(cworld); G.mode = 'correction'; A && A.ambience({ wind: 0.1, birds: 0, fire: 0.8 });
  const C = root.Correction, cam = C.freeCam(G, { x0: -75, x1: 75, z0: -75, z1: 75, h: 62 }), panel = C.ui(), camBtn = document.getElementById('corrCam'), redBtn = document.getElementById('corrRed');
  let red = false, shown = null;
  redBtn.onclick = () => { red = true; lap.red(); G.captionOff(); };
  const stageView = (name, ms) => { const V = lap.views[name]; lap.stage.updateMatrixWorld(true); cam.go(lap.stage.localToWorld(v(...V.pos)), lap.stage.localToWorld(v(...V.at)), 46, ms == null ? 700 : ms); shown = name; };
  const SET = ['overview', 'behind', 'shoulder', 'face'];
  camBtn.onclick = () => stageView(SET[(SET.indexOf(shown) + 1) % SET.length]);
  const showUI = on => panel.classList.toggle('on', !!on);
  const cap = async (who, text) => { if (red) throw RED; await G.caption(who, text); if (red) throw RED; };
  const wait = async s => { await G.wait(s); if (red) throw RED; };
  const smacks = async n => { if (!n) return; lap.run(n); await G.wait(0.4); for (let i = 0; i < 700 && (lap.info().busy || lap.info().running); i++) { await G.wait(0.1); if (red) return; } };
  const step = async (line, n) => { if (red) throw RED; const l = line ? G.caption(line[0], line[1]) : Promise.resolve(); await Promise.all([l, smacks(n)]); if (red) throw RED; };
  const standBefore = () => {
    lap.stage.visible = false; mother.root.visible = jackIn.root.visible = true; mother.setExpr(1); reset(); ma.side = 0;
    placeStage(SEAT); B.setPose(mother, 'sit'); mother.pose = 'sit'; mother.root.position.set(SEAT.x, STAGE_Y, SEAT.z); mother.root.rotation.y = SEAT.ry;
    jackIn.root.position.copy(cl(20, 0)); jackIn.root.rotation.y = SEAT.ry + Math.PI;
    ja.rub = 1; ja.bow = 0.5; paint({ expr: 3, trousers: 'down', drawers: tier >= 1 ? 'down' : 'up', marks: lap.st.marks });
    W.jackGl.mesh.visible = true; B.paintGlutesInto(W.jackGl.skin, { trousers: 'down', drawers: tier >= 1 ? 'down' : 'up', marks: lap.st.marks, outfit: OUT }); W.jackGl.tex.needsUpdate = true;
    for (let i = 0; i < 12; i++) { B.step(mother, 0.1); B.step(jackIn, 0.1); } B.seatFeet(mother, 0);
  };
  const handScene = async () => {       // (it begins with him already across her knee, and the first smack landing: how he came to be there is not shown)
    placeStage(SEAT); lap.stage.visible = true; int.chair.visible = false; jackIn.root.visible = mother.root.visible = false;
    lap.reset(); lap.size(JS); lap.layers({ trousers: 'down', drawers: tier >= 1 ? 'down' : 'up' }); lap.armed(false); lap.implement('hand'); lap.place('lap', 0); lap.giver('mother', 1);
    lap.st.sound = true; lap.st.strength = 1.45; lap.st.pace = 1.7;       // (her hand is heavier than Gerda's, and quicker)
    showUI(true); cam.enable(true); stageView('overview', 0);
    G.fade(false, 0.5);
    await step(['mother', 'Empty hands.'], pick(8, 10, 12));
    await step(['jack', pick('Ow! Mother, please—', 'Ow! Mother, that’s—', 'Ow! Get off—')], 6);
    await step(['mother', 'Empty hands, Jack. Empty hands, again.'], pick(10, 14, 18));
    await step(null, pick(8, 12, 16));
    await step(['mother', 'Not one thing in all this time. Not one thing to show for it.'], pick(10, 14, 18));
    await step(['jack', pick('I’ll bring something! I will!', 'Ow! I’ll bring something, I will!', 'I’ll bring you something! Ow! You’ll see!')], 6);
    await step(['mother', 'Say it.'], 4);
    await step(['jack', pick('I won’t come home with nothing, Mother! I won’t!', 'Ow! I won’t come home empty-handed! I won’t!', 'I won’t come home with nothing! Ow! I won’t, I won’t!')], 6);
    await wait(0.4); await cap('mother', 'Up.');
    lap.place('seat', 1.1); lap.cover(1); await wait(1.3);
  };
  const aftermath = async () => {
    showUI(false); cam.enable(true);
    await G.fade(true, 0.5); standBefore(); stageView('seat', 0); await G.fade(false, 0.6);
    await cap('mother', 'You will not come home to me with empty hands again, Jack. Not ever.');
    await cap('jack', 'No, Mother.');
    await cap('mother', 'I will make sure of it. Fetch the birch.'); await wait(0.8);
  };
  try {
    try { await handScene(); await aftermath(); }
    catch (e) {
      if (e !== RED) throw e;
      lap.stop(); G.captionOff && G.captionOff(); red = false; showUI(false);       // (Red here goes straight to waking)
    }
  } finally { showUI(false); cam.restore(); }
  G.updaters = G.updaters.filter(u => u !== tick);
  A && A.stopMusic && A.stopMusic(1); await G.fade(true, 0.8); A && A.ambience({ wind: 0, birds: 0, fire: 0 }); G.captionOff && G.captionOff(); await G.wait(0.6);
  lap.stage.visible = false; G.mode = 'end';
  scene.background = keep.bg; scene.fog = keep.fog; int.hemi.color.setHex(keep.hc); int.hemi.intensity = keep.hi; int.dim.color.setHex(keep.dc); int.dim.intensity = keep.di; W.jackGl.mesh.visible = false; jackIn.root.scale.setScalar(SC);
  return { tier, slip };
}

root.Dream = { run };
})(typeof window !== 'undefined' ? window : globalThis);
