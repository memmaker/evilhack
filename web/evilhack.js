/*
 * EvilHack in the browser: draws what win/web/winweb.c sends (Module.nh).
 * C decides every cell, row, colour and tile; this file only draws them into
 * the windows that the shared rvip-wm.js places (RVIP W0):
 *   map (the only canvas: tiles, or the game's characters in text mode),
 *   Log messages, Status (the game's lines with its hilite_status colours),
 *   Inventory and Equipment (rows with the game's colour, tile and symbol),
 *   Visible (RvipWM.visible lines built in C from the glyphs on the map),
 *   pop-ups (menus, text windows) and the prompt line over the map.
 * Tiles: 'NetHack 3.6' (tiles.png from win/share/*.txt, 16x16), 'Absurdly Evil' (tiles-ae.png, 64x64, scaled at run time only), or
 * None = text. Page settings (layout, fonts, tile set, sound) live in
 * <RvipApp.dir>/web-layout.json, the player name in <dir>/web-name, both in
 * IndexedDB (IDBFS) next to the game's own files. Saves: S saves and ends;
 * the game checkpoints itself while idle at the command prompt (INSURANCE
 * level files) and recovers from them on the next load.
 * window.nhShadow keeps a plain-text copy of every pane for tests.
 * Loaded before evilhack-core.js; adapted from ~/Games/dynahack/web/dynahack.js.
 */
(function () {
	'use strict';

	var DIR = RvipApp.dir, SAVES = DIR + '/save', SEED = '/seed', COLNO = 80, ROWNO = 21;
	var PAL = ['#555', '#c82828', '#28aa28', '#aa6e28', '#3c3cdc', '#aa28aa', '#28aaaa', '#c8c8c8',
		'#646464', '#ff8c00', '#5aff5a', '#ffff50', '#6e6eff', '#ff5aff', '#5affff', '#fff'];
	/* arrows/Home/PgUp/End/PgDn: 0x101.. (winweb.c makes them hjklyubn or the number pad) */
	var KEYS = { ArrowUp: 0x101, ArrowDown: 0x102, ArrowLeft: 0x103, ArrowRight: 0x104, Home: 0x105, PageUp: 0x106,
		End: 0x107, PageDown: 0x108, Enter: 13, Escape: 27, Backspace: 8, Delete: 8, Tab: 9 };
	var HL_BOLD = 2, HL_INVERSE = 4, HL_ULINE = 8, HL_DIM = 0x20;

	var events = [], lastSync = 0, started = false;
	var cells = null, chars = null, hero = { x: -1, y: -1, lev: -1 };
	var cv, ctx, cell = 32, dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
	var log = [], prompt = '', wm = null;
	var LAYOUT = DIR + '/web-layout.json', NAMEF = DIR + '/web-name';
	var L = { tiles: 'Absurdly Evil', cells: { multi: 0, single: 0 }, wm: null, sound: false, face: '', mapFace: '' };
	var shadow = window.nhShadow = { map: [], status: '', inv: '', eq: '', vis: '', pop: '', popTitle: '', popRows: [], popCur: -1,
		prompt: '', topl: '', msgs: log, hero: null, ended: false, over: null, saves: 0 };

	function $(id) { return document.getElementById(id); }
	function esc(t) { return t.replace(/[&<>]/g, function (c) { return '&' + (c === '&' ? 'amp' : c === '<' ? 'lt' : 'gt') + ';'; }); }

	/* ---------- tile sets: the button cycles these, then None (text) ---------- */
	var SETS = [{ name: 'Absurdly Evil', src: 'tiles-ae.png', size: 64 }, { name: 'NetHack 3.6', src: 'tiles.png', size: 16 }];
	var set = null, sheet = null, perRow = 40, loadGen = 0;
	function tilesOn() { return !!(set && sheet); }
	/* choose a set by name ('None' or an unknown name = text); a late load after a switch is dropped */
	function useTiles(name) {
		var my = ++loadGen, s = null;
		SETS.forEach(function (t) { if (t.name === name) s = t; });
		set = s; sheet = null;
		L.tiles = s ? s.name : 'None';
		if (s) {
			var im = new Image();
			im.onload = function () {
				if (my !== loadGen || set !== s) return;
				sheet = im; perRow = im.width / s.size; setup();
			};
			im.src = s.src;
		}
		setup();
	}
	function cycleTiles() {
		var i = -1;
		SETS.forEach(function (t, j) { if (set === t) i = j; });
		useTiles(i + 1 < SETS.length ? SETS[i + 1].name : 'None');
		saveLayout();
	}
	/* after a tile-set change: button, row icons, map size, all lists again */
	function setup() {
		var on = tilesOn();
		shadow.tiles = on ? set.name : 'None';
		if (document.body) {
			$('btn-tiles').textContent = 'Tiles: ' + (set ? set.name : 'None');
			document.documentElement.style.setProperty('--tiles', on ? 'url(' + set.src + ')' : 'none');
			document.documentElement.style.setProperty('--tilecols', perRow);
			renderMapSel();
		}
		if (wm) layoutMap();
		relist();
	}

	/* ---------- map (the one canvas) ---------- */
	function mode() { return wm ? wm.mode() : 'multi'; }
	function measure() {
		var w = COLNO * cell, h = ROWNO * cell;
		cv.width = w * dpr; cv.height = h * dpr;
		cv.style.width = w + 'px'; cv.style.height = h + 'px';
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.imageSmoothingEnabled = false;     /* nearest-neighbour tiles (RVIP rule), also when a big sheet is scaled down */
	}
	/* the biggest cell that shows the whole map in its window; never below 16 px with tiles or 12 px in text: a smaller window scrolls */
	function fit() {
		var b = $('map'), lo = tilesOn() ? Math.min(set.size, 16) : 12, best = lo;
		for (var c = lo; c <= 64; c++) if (COLNO * c <= b.clientWidth && ROWNO * c <= b.clientHeight) best = c;
		return best;
	}
	/* cell size: the A−/A+ choice of this mode, else fit the window */
	function layoutMap() {
		var z = L.cells[mode()] | 0;
		cell = z >= 8 && z <= 64 ? z : fit();
		measure(); scrollMap(); draw();
	}
	/* A−/A+ on the Map title bar: tiles by fixed steps (sheets are only ever scaled at run time), text by 2 px */
	function zoomMap(d) {
		var s = tilesOn() ? set.size : 0, c = cell;
		if (s) {
			var steps = s > 16 ? [16, 24, 32, 48, 64] : [8, 16, 32, 48, 64], i;
			if (d > 0) { for (i = 0; i < steps.length && steps[i] <= c; i++); c = steps[Math.min(i, steps.length - 1)]; }
			else { for (i = steps.length - 1; i >= 0 && steps[i] >= c; i--); c = steps[Math.max(i, 0)]; }
		} else c = Math.max(8, Math.min(64, c + 2 * d));
		L.cells[mode()] = c; saveLayout(); layoutMap();
	}
	function draw() {
		if (!cells) return;
		ctx.fillStyle = '#000'; ctx.fillRect(0, 0, COLNO * cell, ROWNO * cell);
		if (!tilesOn()) {       /* text mode: the game's own characters and colours */
			ctx.font = (L.mapFace ? '' : 'bold ') + Math.round(cell * 0.8) + 'px ' + face(L.mapFace);   /* bitmap fonts: not bold */
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			for (var ty = 0; ty < ROWNO; ty++)
				for (var tx = 0; tx < COLNO; tx++) {
					var k = chars[ty * COLNO + tx];
					if ((k & 0xff) <= 32) continue;
					ctx.fillStyle = PAL[(k >> 8) & 15];
					ctx.fillText(String.fromCharCode(k & 0xff), (tx + 0.5) * cell, (ty + 0.5) * cell + 1);
				}
			return;
		}
		var sz = set.size;
		for (var y = 0; y < ROWNO; y++)
			for (var x = 0; x < COLNO; x++) {
				var t = cells[y * COLNO + x];
				if (t >= 0) ctx.drawImage(sheet, (t % perRow) * sz, Math.floor(t / perRow) * sz, sz, sz, x * cell, y * cell, cell, cell);
			}
	}
	/* the camera: hero centred, clamped at the map edges (rvip-wm.js) */
	function scrollMap() {
		if (hero.x >= 0) RvipWM.center(cv, (hero.x + 0.5) * cell, (hero.y + 0.5) * cell, COLNO * cell, ROWNO * cell);
	}
	function mapRows() {
		var rows = [];
		for (var y = 0; y < ROWNO; y++) {
			var r = '';
			for (var x = 0; x < COLNO; x++) { var c = chars[y * COLNO + x] & 0xff; r += c <= 32 ? ' ' : String.fromCharCode(c); }
			rows.push(r.replace(/ +$/, ''));
		}
		return rows;
	}

	/* ---------- text windows ---------- */
	/* a row icon: the game's tile (tiles on) or the item's own map symbol (C sends both) */
	function tileSpan(t, sym) {
		if (!tilesOn()) return sym > 32 ? esc(String.fromCharCode(sym)) + ' ' : '';
		if (!(t >= 0)) return '';
		return '<span class="ti" data-t="' + t + '" style="background-position:-' + (t % perRow) + 'em -' + Math.floor(t / perRow) + 'em"></span>';
	}
	/* rows "tile \t letter \t 0|1 selected, 2 heading \t colour \t symbol \t text" */
	function parseRows(t) {
		return t.split('\n').filter(function (l, i, a) { return l || i < a.length - 1; }).map(function (l) {
			var f = l.split('\t'), sel = +f[2];
			return { t: +f[0], ch: f[1], sel: sel, c: +f[3], sym: +f[4], text: f.slice(5).join('\t'),
				head: sel === 2 ? '' : f[1] === ' ' ? '    ' : f[1] + (sel ? ' + ' : ' - ') };
		});
	}
	function rowsHtml(rows, cur) {
		return rows.map(function (r, i) {
			return '<div class="row' + (i === cur ? ' cur' : '') + (r.sel === 2 ? '' : ' pick') + '" data-i="' + i + '" style="color:' + PAL[r.c & 15] + '">' +
				esc(r.head) + (r.sel === 2 ? '' : tileSpan(r.t, r.sym)) + esc(r.text) + '</div>';
		}).join('');
	}
	function plain(rows) { return rows.map(function (r) { return r.head + r.text; }).join('\n'); }
	function drawMsgs() {
		shadow.prompt = prompt;
		var ml = $('msg'), body = ml.parentNode;
		ml.innerHTML = log.map(function (m) { return m.old ? '<span class="old">' + esc(m.t) + '</span>' : esc(m.t); }).join('\n') +
			(prompt ? (log.length ? '\n' : '') + '<span class="pr">' + esc(prompt) + '</span>' : '');
		body.scrollTop = body.scrollHeight;     /* the newest message stays in view */
	}
	/* status: lines of segments "clr.attr|text" (\x1f between), colours from hilite_status */
	function drawStatus(t) {
		var txt = [];
		$('stat').innerHTML = t.split('\n').map(function (line) {
			var p = '';
			return line.split('\x1f').map(function (sg) {
				var m = /^(\d+)\.(\d+)\|/.exec(sg); if (!m) { p += sg; return esc(sg); }
				var s = sg.slice(m[0].length), c = +m[1], a = +m[2], st = '', cls = '';
				p += s;
				var fg = c < 16 && c !== 8 ? PAL[c] : '';
				if (a & HL_INVERSE) st = 'background:' + (fg || '#d7d7d7') + ';color:#000';
				else if (fg) st = 'color:' + fg;
				if (a & HL_BOLD) cls += ' b';
				if (a & HL_ULINE) cls += ' u';
				if (a & HL_DIM) cls += ' d';
				return st || cls ? '<span class="' + cls.trim() + '" style="' + st + '">' + esc(s) + '</span>' : esc(s);
			}).join('') + (txt.push(p), '');
		}).join('\n');
		shadow.status = txt.join('\n');
	}
	function drawPop(t) {
		var pop = $('pop');
		if (!t) { pop.hidden = true; shadow.pop = ''; shadow.popTitle = ''; shadow.popRows = []; shadow.popCur = -1; return; }
		var nl = t.indexOf('\n'), head = t.slice(0, nl).split('\t'), top = +head[0], cur = +head[1], p = head.slice(2).join('\t');
		var rows = parseRows(t.slice(nl + 1));
		shadow.popTitle = p; shadow.popRows = rows.map(function (r) { return r.head + r.text; }); shadow.popCur = cur;
		shadow.pop = (p ? p + '\n' : '') + shadow.popRows.join('\n');
		pop.style.fontSize = RvipWM.fontSize('msg') + 'px';   /* pop-up text = the message font */
		pop.innerHTML = (p ? '<div class="pp">' + esc(p) + '</div>' : '') + '<div class="rows">' + rowsHtml(rows, cur) + '</div>';
		pop.hidden = false;
		RvipWM.popup(pop, { center: true });
		var rs = pop.querySelectorAll('.row'), r = rs[cur >= 0 ? cur : top];
		if (r) { if (cur >= 0) r.scrollIntoView({ block: 'nearest' }); else pop.scrollTop = r.offsetTop - (p ? pop.firstChild.offsetHeight : 0); }
	}
	/* Visible: C's lines; the tile replaces the glyph when tiles are on */
	function visIcon(t) {
		if (!tilesOn() || !(t >= 0)) return null;
		var i = document.createElement('span');
		i.className = 'ti';
		i.style.backgroundPosition = '-' + (t % perRow) + 'em -' + Math.floor(t / perRow) + 'em';
		return i;
	}
	/* inventory, equipment, pop-up and Visible again from the game's last text (tile set changed) */
	function relist() {
		if (!document.body || !$('vis')) return;
		$('vis')._vis = null;
		[2, 3, 7, 8].forEach(function (id) { var t = nh.last[id]; if (t != null) { nh.last[id] = null; nh.text(id, t); } });
	}

	/* ---------- layout (shared rvip-wm.js) ---------- */
	function saveLayout() {
		try { Module.FS.writeFile(LAYOUT, JSON.stringify(L)); app.sync(); } catch (e) { console.warn('layout not saved', e); }
	}
	function loadLayout() {         /* before the first sheet loads (no flash) */
		try {
			var s = JSON.parse(Module.FS.readFile(LAYOUT, { encoding: 'utf8' }));
			if (s) {
				if (typeof s.tiles === 'string') L.tiles = s.tiles;
				if (s.cells) L.cells = { multi: s.cells.multi | 0, single: s.cells.single | 0 };
				L.wm = s.wm || null;   /* sound is not kept: off after every reload */
				L.face = typeof s.face === 'string' ? s.face : ''; L.mapFace = typeof s.mapFace === 'string' ? s.mapFace : '';
			}
		} catch (e) { }
	}
	function fonts() {
		['msg', 'stat', 'inv', 'eq', 'vis', 'pop'].forEach(function (id) {
			if (id === 'pop') $(id).style.fontSize = RvipWM.fontSize('msg') + 'px';
			$(id).style.fontFamily = L.face ? '"' + L.face + '", monospace' : '';
		});
	}
	/* fonts: the index page's fonts/*.woff (build.sh lists them in fonts.json).
	 * Top bar = every window but the map; the Map title bar has its own (text mode only). */
	function face(n) { return n ? '"' + n + '", monospace' : 'monospace'; }
	function loadFace(n, now) {
		var redo = function () { fonts(); draw(); };
		if (!n) { if (now) redo(); return; }
		var ff = new FontFace(n, 'url(../fonts/' + n + '.woff)');
		ff.load().then(function () { document.fonts.add(ff); redo(); }).catch(function () { app.status('Could not load the font ' + n + '.', true); });
	}
	var mapSel = document.createElement('select');
	mapSel.title = 'Map font (text mode)';
	mapSel.innerHTML = '<option value="">Default font</option>';
	mapSel.addEventListener('pointerdown', function (e) { e.stopPropagation(); });   /* not a window drag */
	mapSel.addEventListener('mousedown', function (e) { e.stopPropagation(); });
	function renderMapSel() {
		var bs = document.querySelector('#t-map .wm-btns');
		if (bs && mapSel.parentNode !== bs) bs.insertBefore(mapSel, bs.firstChild);
		mapSel.hidden = tilesOn();
		mapSel.value = L.mapFace || '';
		$('sel-font').value = L.face || '';
	}
	function makeWM() {
		loadFace(L.face); loadFace(L.mapFace);
		var H = $('game').clientHeight || 600, line = Math.ceil(RvipWM.fontSize('msg') * 1.4) + 6;
		wm = RvipWM({
			area: $('game'), menu: $('btn-layout'),
			wins: [{ id: 'map', title: 'Map' }, { id: 'msg', title: 'Log messages' }, { id: 'stat', title: 'Status' },
				{ id: 'inv', title: 'Inventory' }, { id: 'eq', title: 'Equipment' }, { id: 'vis', title: 'Visible' }],
			multi: { d: 'h', r: 0.74, a: { d: 'v', r: 0.18, a: 'msg', b: { d: 'v', r: 0.86, a: 'map', b: 'stat' } }, b: { d: 'v', r: 0.62, a: 'inv', b: 'vis' } },
			single: { d: 'v', r: 3 * line / H, a: 'msg', b: { d: 'v', r: 1 - 3 * line / (H - 3 * line), a: 'map', b: 'stat' } },
			state: L.wm,
			save: function (st) { L.wm = st; saveLayout(); },
			layout: function () { fonts(); layoutMap(); if (!$('pop').hidden) RvipWM.popup($('pop'), { center: true }); },
			zoom: { map: function (size, d) { zoomMap(d); }, msg: fonts },   /* A−/A+ on the Map title bar = zoom */
			onReset: function () { L.cells = { multi: 0, single: 0 }; L.wm = wm.state(); fonts(); layoutMap(); saveLayout(); renderMapSel(); }
		});
		wm.apply();
		renderMapSel();
		window.nhWM = wm;
	}
	function showGame() {
		if (!$('game').hidden) return;
		$('game').hidden = false; app.status(''); measure(); makeWM(); showAudio(); setup();
	}

	/* ---------- sound (stage 6): off by default ---------- */
	/* The game names the event at the action (WEB_SOUND in hack.h, win/web/winweb.c
	 * js_sound); this only mutes it. Synthesized sound/<name>.wav (web/mksounds.py),
	 * fetched on first play. No music: EvilHack ships none. */
	function showAudio() { $('chk-sound').checked = L.sound; }
	function toggleAudio(k) { L[k] = !L[k]; showAudio(); }
	var sounds = window.nhSounds = [];      /* test hook: every event the game raised */

	var nh = {
		sound: function (name) {
			sounds.push(name);
			if (L.sound && window.RVIPSound) RVIPSound.play([name], 0.6);
		},
		map: function (cp, tp, hx, hy, lev) {
			cells = Module.HEAP32.slice(cp >> 2, (cp >> 2) + COLNO * ROWNO);
			chars = Module.HEAP32.slice(tp >> 2, (tp >> 2) + COLNO * ROWNO);
			started = true;
			showGame();
			var moved = hx !== hero.x || hy !== hero.y || lev !== hero.lev;
			hero.x = hx; hero.y = hy; hero.lev = lev;
			shadow.hero = { x: hx, y: hy, lev: lev }; shadow.cells = cells; shadow.map = mapRows();
			if (moved) scrollMap();
			draw();
		},
		last: [],
		text: function (id, t) {
			if (id === 4) { log.push({ t: t }); if (log.length > 500) log.shift(); drawMsgs(); return; }
			if (id === 6) { if (log.length) log[log.length - 1] = { t: t }; drawMsgs(); return; }   /* the game folded a repeat */
			if (id === 5) { log.forEach(function (m) { m.old = true; }); drawMsgs(); return; }
			if (nh.last[id] === t) return;
			nh.last[id] = t;
			if (t) showGame();      /* character selection comes before the map */
			if (id === 0) { prompt = t; drawMsgs(); }
			else if (id === 9) { shadow.topl = t; RvipWM.prompt.text(t); }
			else if (id === 1) drawStatus(t);
			else if (id === 2) { var r = parseRows(t); shadow.inv = plain(r); $('inv').innerHTML = rowsHtml(r, -1); }
			else if (id === 7) { var e = parseRows(t); shadow.eq = plain(e); $('eq').innerHTML = e.length ? rowsHtml(e, -1) : '<span class="old">Nothing worn or wielded.</span>'; }
			else if (id === 8) { shadow.vis = t; RvipWM.visible($('vis'), t, visIcon); }
			else if (id === 3) drawPop(t);
		},
		/* peek: number of waiting keys; otherwise the next key or -1.
		 * While the game waits, the files go to IndexedDB every 2 s. */
		key: function (peek, atCmd) {
			RvipWM.prompt.wait(atCmd);
			if (peek) return events.length;
			if (events.length) return events.shift();
			var now = performance.now();
			if (now - lastSync > 2000) { lastSync = now; app.sync(); }
			return -1;
		},
		saveReq: 0,             /* C reads it at the command prompt (autosave now) */
		saved: function () {    /* a checkpoint was written: to IndexedDB with it */
			shadow.saves++;
			var f = savedCbs; savedCbs = [];
			app.sync(function () { f.forEach(function (cb) { cb(); }); });
		},
		over: function (how) { shadow.over = how; },   /* the run ended (how: src/end.c); stage 9 reports here */
		end: function () {
			app.running = false; shadow.ended = true;
			return new Promise(function (done) {
				app.sync(function () {
					$('overlay-msg').textContent = saveFile() ? 'Your game has been saved. Play again to continue it.' : 'The game is over. Play again for a new character.';
					$('overlay').hidden = false;
					done();
				});
			});
		}
	};
	var savedCbs = [];
	window.nhKey = function (c) { events.push(typeof c === 'string' ? c.charCodeAt(0) : c); };
	window.nhTiles = { cycle: cycleTiles, use: useTiles, layout: L };      /* tests */
	window.nhSave = function (cb) { if (cb) savedCbs.push(cb); nh.saveReq = 1; };

	/* ---------- input ---------- */
	function onKey(e) {
		if (!app.running || e.isComposing || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
		var k = e.key, c, np = /^Numpad(\d)$/.exec(e.code || '');
		if (np) c = 0x110 + +np[1];       /* keypad digits: C decides (cursor, digit or step) */
		else if (e.code === 'NumpadDecimal') c = 46;
		else if (e.code === 'NumpadEnter') c = 13;
		else if (KEYS[k] !== undefined) c = KEYS[k];
		else if (k.length === 1) {
			c = k.charCodeAt(0);
			if (e.ctrlKey && !e.altKey) { var u = k.toUpperCase().charCodeAt(0); if (u >= 65 && u <= 90) c = u & 0x1f; else return; }
			else if (e.altKey && c < 128) c |= 0x80;     /* Alt = meta, as NetHack's M- keys */
			if (c > 255) return;
		} else return;
		events.push(c);
		e.preventDefault();
	}
	function onMapClick(e) {
		if (!app.running) return;
		var r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / cell), y = Math.floor((e.clientY - r.top) / cell);
		if (x > 0 && x < COLNO && y >= 0 && y < ROWNO) events.push(0x10000 | y << 8 | x | (e.button === 2 ? 0x8000 : 0));
		e.preventDefault();
	}

	/* ---------- saves: IndexedDB (IDBFS); Export / Import / New game in rvip-app.js ---------- */
	function ls(d, re) { try { return Module.FS.readdir(d).filter(function (f) { return re.test(f); }); } catch (e) { return []; } }
	/* save/<uid><name> after S; <uid><name>.0 (lock + checkpointed state) and .N (levels) while a game runs */
	function saveFile() { return ls(SAVES, /^\d+.+$/)[0] || null; }
	function levelFiles() { return ls(DIR, /^\d+[^.]+\.\d+$/); }
	function charName() {
		var f = saveFile() || ls(DIR, /^\d+[^.]+\.0$/)[0];
		return f ? f.replace(/^\d+/, '').replace(/\.0$/, '').replace(/\.gz$/, '') : null;
	}
	function readName() { try { return Module.FS.readFile(NAMEF, { encoding: 'utf8' }).trim(); } catch (e) { return ''; } }
	function clearGame() {
		ls(SAVES, /^\d/).forEach(function (f) { Module.FS.unlink(SAVES + '/' + f); });
		levelFiles().forEach(function (f) { Module.FS.unlink(DIR + '/' + f); });
	}
	var app = RvipApp({
		name: 'evilhack',
		/* the S save file, else the checkpoint (lock + level files) as one bundle */
		save: function () {
			var f = saveFile();
			if (f) return SAVES + '/' + f;
			var lv = levelFiles();
			return lv.length ? lv.map(function (n) { return DIR + '/' + n; }) : null;
		},
		exportName: function (p) { return 'evilhack-' + p.split('/').pop().replace(/^\d+/, '') + '.sav'; },
		flush: function (done) {   /* checkpoint first (at the command prompt), at most 1.5 s */
			var fin = false, t = setTimeout(go, 1500);
			function go() { if (!fin) { fin = true; clearTimeout(t); done(); } }
			window.nhSave(go);
		},
		clear: clearGame,
		put: function (file, data) {
			var n = file.name;
			if (/^\d+[A-Za-z0-9_-]+\.\d+$/.test(n)) { Module.FS.writeFile(DIR + '/' + n, data); return; }   /* checkpoint bundle */
			var name = n.replace(/^evilhack-/, '').replace(/\.sav$/, '').replace(/^\d+/, '').replace(/\.gz$/, '').replace(/[^\w-]/g, '');
			if (!name) return 'An EvilHack save file is named like 0Name (user number, then the character name).';
			Module.FS.writeFile(SAVES + '/0' + name, data);
		},
		noSave: 'There is no saved game yet.',
		helpText: 'Press ? in the game for its own help.'
	});

	/* ---------- player name: asked once, kept in <dir>/web-name ---------- */
	/* the browser's own prompt (blocks nothing else on the page; a cancelled
	 * prompt plays this game as "Hero" and asks again next time) */
	function askName() {
		var n = '';
		try { n = (window.prompt('Who are you? Your character\'s name (letters, digits, - and _), kept in this browser:', '') || ''); } catch (e) { }
		n = n.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 31);
		if (!n) return 'Hero';
		try { Module.FS.writeFile(NAMEF, n); } catch (err) { }
		app.sync();
		return n;
	}

	/* ---------- startup ---------- */
	window.Module = {
		nh: nh,
		arguments: ['-d', DIR],
		preRun: [function () {
			var FS = Module.FS;
			Module.ENV.HOME = DIR;
			Module.ENV.USER = 'player';
			Module.addRunDependency('idbfs');
			RvipApp.mount(function (err) {
				if (err) app.status('Could not read saved games from IndexedDB (' + err + '). Saving may not work in this browser mode.', true);
				FS.readdir(SEED).forEach(function (f) { if (f[0] !== '.') FS.writeFile(DIR + '/' + f, FS.readFile(SEED + '/' + f)); });
				['perm', 'record', 'logfile', 'xlogfile', 'livelog'].forEach(function (f) { try { FS.stat(DIR + '/' + f); } catch (e) { FS.writeFile(DIR + '/' + f, ''); } });
				try { FS.mkdir(SAVES); } catch (e) { }
				loadLayout();
				useTiles(L.tiles);
				var n = charName() || readName() || askName();
				Module.arguments.push('-u', n); shadow.name = n;
				Module.removeRunDependency('idbfs');
			});
		}],
		onRuntimeInitialized: function () { app.running = true; },
		print: function (s) { console.log(s); },
		printErr: function (s) { console.warn(s); },
		setStatus: function (s) { if (s && !app.running) app.status(s.replace(/\(\d+\/\d+\)/, '').trim() || 'Loading…'); },
		onAbort: function (what) { shadow.crash = String(what); app.crashed(what); }
	};
	window.addEventListener('error', function (e) { if (e.error && e.error.name !== 'ExitStatus' && e.error instanceof WebAssembly.RuntimeError) shadow.crash = String(e.error.stack || e.error); });
	window.addEventListener('unhandledrejection', function (e) { if (!(e.reason && e.reason.name === 'ExitStatus')) shadow.crash = String(e.reason); });
	document.addEventListener('visibilitychange', function () { if (document.hidden) { nh.saveReq = 1; app.sync(); } });
	window.addEventListener('pagehide', function () { app.sync(); });
	window.addEventListener('beforeunload', function (e) {     /* a running game: the browser asks first */
		if (app.running && started && !shadow.ended) { e.preventDefault(); e.returnValue = ''; }
	});
	setInterval(function () { if (app.running) app.sync(); }, 15000);

	document.addEventListener('keydown', onKey);
	document.addEventListener('DOMContentLoaded', function () {
		cv = document.querySelector('#map canvas');
		ctx = cv.getContext('2d');
		setup();
		cv.addEventListener('mousedown', onMapClick);
		cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
		$('pop').addEventListener('mousedown', function (e) {
			var r = e.target.closest('.row.pick');
			if (r && app.running) { events.push(0x20000 | +r.dataset.i); e.preventDefault(); }
		});
		$('btn-tiles').onclick = function () { cycleTiles(); };
		$('chk-sound').onchange = function () { toggleAudio('sound'); };
		RvipWM.dropdown($('btn-file'), $('menu-file'));
		RvipWM.dropdown($('btn-audio'), $('menu-audio'));
		RvipWM.fonts.then(function (list) {
			[[$('sel-font'), 'face'], [mapSel, 'mapFace']].forEach(function (a) {
				RvipWM.fontOptions(a[0]);
				a[0].value = L[a[1]] || '';
			});
		}).catch(function () { });
		[[$('sel-font'), 'face'], [mapSel, 'mapFace']].forEach(function (a) {
			a[0].addEventListener('keydown', function (e) { e.stopPropagation(); });
			a[0].onchange = function () { L[a[1]] = this.value; saveLayout(); loadFace(this.value, true); this.blur(); };
		});
		$('btn-restart').onclick = function () { location.reload(); };
		document.querySelectorAll('button').forEach(function (b) {
			if (b.type !== 'submit') b.addEventListener('mousedown', function (e) { e.preventDefault(); });
		});
	});
})();
