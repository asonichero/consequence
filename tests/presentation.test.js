// The house rules for how the game presents itself, kept by checking the source: one mode model, one HUD, and nothing on screen that names a key (the game is played with a thumb).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const SCENES = ['market', 'road', 'night', 'correction', 'garden', 'chapter3', 'chapter4', 'climb', 'meadow', 'castlewalk', 'opening', 'menus'].map(n => 'js/' + n + '.js');
const literals = src => src.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || [];

test('no scene names a key in the text it shows the player', () => {
  const KEYS = /\b(?:press|hold|tap or press) (?:E|Q|C|V|Space|Shift)\b|\((?:E|Q|C|V|Space)\)|\bWASD\b|\bW A S D\b|^(?:'|")?(?:E|Q) (?:—|\\u2014|:) /;
  for (const f of SCENES) for (const s of literals(read(f))) if (!/^'(?:\\u2014|—)/.test(s) && f !== 'js/castlewalk.js') assert.ok(!KEYS.test(s.slice(1, -1)), `${f}: ${s.slice(0, 80)}`);
});

test('scenes name only the modes the shell knows, and never set the mode classes themselves', () => {
  const MODES = ['title', 'notice', 'end', 'cutscene', 'beat', 'explore', 'correction', 'free', 'play', 'garden', 'cine'];
  for (const f of ['game.js', ...SCENES.map(p => p.slice(3))]) {
    const src = read('js/' + f);
    for (const m of src.matchAll(/G\.mode = '(\w+)'|G\.setMode\('(\w+)'/g)) assert.ok(MODES.includes(m[1] || m[2]), `${f} sets mode ${m[1] || m[2]}`);
    if (f !== 'game.js') assert.ok(!/classList\.(?:add|remove|toggle)\('(?:cutscene|playing|skippable|fixedcam)'/.test(src), `${f} toggles a mode class`);
  }
});

test('the HUD is the shared one: no scene builds its own objective, toast or hint', () => {
  for (const f of SCENES) { const src = read(f); assert.ok(!/id="[a-zA-Z]*(?:Obj|Objt|Toast|Hint)"/.test(src), `${f} builds its own HUD element`); assert.ok(!/\bdHint\b|\bgHint\b|\bcHint\b|\bclHint\b/.test(src.replace(/\/\/.*$/gm, '')), `${f} still has a hint element`); }
});

test('the page keys its chrome to the mode', () => {
  const html = read('game.html'); assert.ok(/body\[data-mode="cutscene"\] #tui/.test(html)); assert.ok(/body\.skippable #skip/.test(html)); assert.ok(/#rotate/.test(html));
  const g = read('js/game.js'); assert.ok(/G\.setMode = /.test(g) && /G\.hud = /.test(g));
});
