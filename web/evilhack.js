/*
 * EvilHack in the browser, stage-1 page: draws what win/web/winweb.c sends
 * (Module.nh): map cells (tile index per cell from the game's glyph2tile,
 * plus char|colour for text mode), prompt, status, inventory, pop-up rows
 * (each with the game's tile index) and messages. C decides all content;
 * this file only draws it. Tiles (stage 4): one set, 'NetHack 3.6'
 * (tiles.png from win/share/*.txt, 16x16 cells, 40 per row, drawn at a whole
 * multiple, nearest-neighbour), or None = text. The choice is kept by name
 * in /evilhack/web-layout.json (IDBFS), read before the sheet loads. Saves live in IndexedDB (IDBFS,
 * /evilhack). window.nhShadow keeps a plain-text copy of every pane for
 * tests (Playwright). The full rvip-wm.js page comes in stage 5.
 */
(function () {
	'use strict';

	var DIR = '/evilhack', SAVES = DIR + '/save', SEED = '/seed', COLNO = 80, ROWNO = 21;
	var PAL = ['#555', '#c82828', '#28aa28', '#aa6e28', '#3c3cdc', '#aa28aa', '#28aaaa', '#c8c8c8',
		'#646464', '#ff8c00', '#5aff5a', '#ffff50', '#6e6eff', '#ff5aff', '#5affff', '#fff'];
	var KEYS = { ArrowUp: 0x101, ArrowDown: 0x102, ArrowLeft: 0x103, ArrowRight: 0x104, Home: 0x105, PageUp: 0x106,
		End: 0x107, PageDown: 0x108, Enter: 13, Escape: 27, Backspace: 8, Delete: 8, Tab: 9 };
	var events = [], running = false, lastSync = 0, log = [], prompt = '';
	var shadow = window.nhShadow = { map: [], status: '', inv: '', pop: '', prompt: '', msgs: log, hero: null, ended: false };

	/* ---- tile sets: the button cycles these, then None (text) ---- */
	var SETS = [{ name: 'NetHack 3.6', src: 'tiles.png', size: 16 }];
	var LAYOUT = DIR + '/web-layout.json', L = { tiles: SETS[0].name, zoom: 2 };
	var set = null, sheet = null, perRow = 40, loadGen = 0, cell = 32;
	var last = { cells: null, chars: null, hx: -1, hy: -1, inv: '', pop: '' };
	function loadLayout() {         /* before the first sheet loads (no flash) */
		try { var o = JSON.parse(Module.FS.readFile(LAYOUT, { encoding: 'utf8' })); for (var k in o) L[k] = o[k]; } catch (e) { }
		L.zoom = Math.max(1, Math.min(4, L.zoom | 0 || 2));
	}
	function saveLayout() {
		try { Module.FS.writeFile(LAYOUT, JSON.stringify(L)); } catch (e) { }
		syncFiles();
	}
	/* choose a set by name ('None' or unknown name without sets = text) and redo the setup */
	function useTiles(name) {
		var my = ++loadGen, s = null;
		SETS.forEach(function (t) { if (t.name === name) s = t; });
		set = s; sheet = null;
		L.tiles = s ? s.name : 'None';
		if (!s) { setup(); return; }
		var im = new Image();
		im.onload = function () {       /* a late load after a switch or None is dropped */
			if (my !== loadGen || set !== s) return;
			sheet = im; perRow = im.width / s.size; setup();
		};
		im.src = s.src;
		setup();                        /* text until the sheet is there */
	}
	function cycleTiles() {
		var i = -1;
		SETS.forEach(function (t, j) { if (set === t) i = j; });
		useTiles(i + 1 < SETS.length ? SETS[i + 1].name : 'None');
		saveLayout();
	}
	function zoomBy(d) {
		var z = Math.max(1, Math.min(4, L.zoom + d));
		if (z !== L.zoom) { L.zoom = z; setup(); saveLayout(); }
	}
	function tilesOn() { return !!(set && sheet); }
	/* what a restart would do: cell size, canvas size, which map shows, all panes again */
	function setup() {
		var on = tilesOn(), cv = $('mapcv');
		$('btn-tiles').textContent = 'Tiles: ' + (set ? set.name : 'None');
		$('zoom').hidden = !on;
		shadow.tiles = on ? set.name : 'None';
		cv.hidden = !on; $('map').hidden = on;
		if (on) {
			cell = set.size * L.zoom;
			cv.width = COLNO * cell; cv.height = ROWNO * cell;
			cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
			var cx = cv.getContext('2d');
			cx.imageSmoothingEnabled = false;
			document.documentElement.style.setProperty('--tiles', 'url(' + set.src + ')');
			document.documentElement.style.setProperty('--tilew', sheet.width + 'px');
		}
		if (last.cells) drawMap();
		if (last.inv) nh.text(2, last.inv);
		if (last.pop) nh.text(3, last.pop);
	}
	function drawCanvas() {
		var cv = $('mapcv'), cx = cv.getContext('2d'), c = last.cells, sz = set.size;
		cx.imageSmoothingEnabled = false;
		cx.fillStyle = '#000'; cx.fillRect(0, 0, cv.width, cv.height);
		for (var y = 0; y < ROWNO; y++)
			for (var x = 0; x < COLNO; x++) {
				var t = c[y * COLNO + x];
				if (t >= 0) cx.drawImage(sheet, (t % perRow) * sz, Math.floor(t / perRow) * sz, sz, sz, x * cell, y * cell, cell, cell);
			}
		if (last.hx >= 0) {
			cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.lineWidth = 1;
			cx.strokeRect(last.hx * cell + .5, last.hy * cell + .5, cell - 1, cell - 1);
			/* keep the hero in view: scroll the map pane when it leaves the middle */
			var b = $('t-map'), px = (last.hx + .5) * cell, py = (last.hy + .5) * cell;
			if (px < b.scrollLeft + b.clientWidth / 4 || px > b.scrollLeft + b.clientWidth * 3 / 4) b.scrollLeft = px - b.clientWidth / 2;
			if (py < b.scrollTop + b.clientHeight / 4 || py > b.scrollTop + b.clientHeight * 3 / 4) b.scrollTop = py - b.clientHeight / 2;
		}
	}
	/* a row's icon: the game's tile for that item (tile index sent with the row) */
	function icon(t) {
		if (!tilesOn() || t < 0) return '';
		var sz = set.size;
		return '<span class="ti" data-t="' + t + '" style="background-position:-' + (t % perRow) * sz + 'px -' + Math.floor(t / perRow) * sz + 'px"></span>';
	}

	function $(id) { return document.getElementById(id); }
	function esc(t) { return t.replace(/[&<>]/g, function (c) { return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'; }); }
	function status(msg, err) { var s = $('status'); s.textContent = msg; s.hidden = !msg; s.className = err ? 'error' : ''; }
	function rowsText(t) {       /* "tile \t letter \t sel \t colour \t text" -> lines */
		return t.split('\n').filter(function (l) { return l; }).map(function (l) {
			var f = l.split('\t'), sel = +f[2], text = f.slice(4).join('\t');
			return { t: +f[0], c: +f[3], s: (sel === 2 ? '' : f[1] === ' ' ? '    ' : f[1] + (sel ? ' + ' : ' - ')) + text };
		});
	}
	function drawMsgs() {
		shadow.prompt = prompt;
		var m = $('msg');
		m.innerHTML = log.slice(-200).map(function (l) { return l.old ? '<span class="old">' + esc(l.t) + '</span>' : esc(l.t); }).join('\n') +
			(prompt ? '\n<span class="pr">' + esc(prompt) + '</span>' : '');
		m.parentNode.scrollTop = m.parentNode.scrollHeight;
	}

	function drawMap() {
		var ch = last.chars, hx = last.hx, hy = last.hy, html = [], rows = [];
		for (var y = 0; y < ROWNO; y++) {
			var h = '', r = '', col = -1;
			for (var x = 0; x < COLNO; x++) {
				var k = ch[y * COLNO + x], c = k & 0xff, s = c <= 32 ? ' ' : String.fromCharCode(c), cl = (k >> 8) & 15;
				r += s;
				if (cl !== col) { if (col >= 0) h += '</span>'; h += '<span style="color:' + PAL[cl] + '">'; col = cl; }
				h += x === hx && y === hy ? '<b class="hero">' + esc(s) + '</b>' : esc(s);
			}
			html.push(h + '</span>'); rows.push(r.replace(/ +$/, ''));
		}
		shadow.map = rows;
		if (tilesOn()) drawCanvas();
		else $('map').innerHTML = html.join('\n');
	}

	var nh = {
		map: function (cp, tp, hx, hy, lev) {
			last.cells = Module.HEAP32.slice(cp >> 2, (cp >> 2) + COLNO * ROWNO);
			last.chars = Module.HEAP32.slice(tp >> 2, (tp >> 2) + COLNO * ROWNO);
			last.hx = hx; last.hy = hy;
			shadow.hero = { x: hx, y: hy, lev: lev };
			shadow.cells = last.cells;
			drawMap();
			if ($('game').hidden) { $('game').hidden = false; status(''); setup(); }
		},
		text: function (id, t) {
			if (id === 4) { log.push({ t: t }); drawMsgs(); return; }
			if (id === 6) { if (log.length) log[log.length - 1] = { t: t }; drawMsgs(); return; }
			if (id === 5) { log.forEach(function (m) { m.old = true; }); drawMsgs(); return; }
			if (id === 0) { prompt = t; drawMsgs(); }
			else if (id === 1) { shadow.status = t.replace(/\n+$/, ''); $('stat').textContent = shadow.status; }
			else if (id === 2) {
				last.inv = t;
				var r = rowsText(t);
				shadow.inv = r.map(function (l) { return l.s; }).join('\n');
				$('inv').innerHTML = r.map(function (l) { return icon(l.t) + '<span style="color:' + PAL[l.c] + '">' + esc(l.s) + '</span>'; }).join('\n');
			} else if (id === 3) {
				var p = $('pop');
				last.pop = t;
				if (!t) { shadow.pop = ''; shadow.popTitle = ''; shadow.popRows = []; shadow.popCur = -1; p.hidden = true; return; }
				var nl = t.indexOf('\n'), head = t.slice(0, nl).split('\t'), top = +head[0], cur = +head[1], title = head.slice(2).join('\t');
				var rr = rowsText(t.slice(nl + 1));
				shadow.pop = (title ? title + '\n' : '') + rr.map(function (l) { return l.s; }).join('\n');
				shadow.popTitle = title; shadow.popRows = rr.map(function (l) { return l.s; }); shadow.popCur = cur;
				p.innerHTML = (title ? '<div class="pr">' + esc(title) + '</div>' : '') + rr.map(function (l, i) {
					return '<div data-row="' + i + '"' + (i === cur ? ' class="cur"' : '') + ' style="color:' + PAL[l.c] + '">' + icon(l.t) + esc(l.s || ' ') + '</div>';
				}).join('');
				p.hidden = false;
				var at = p.querySelector(cur >= 0 ? '.cur' : '[data-row="' + top + '"]');
				if (at && at.scrollIntoView) at.scrollIntoView({ block: 'nearest' });
			}
		},
		key: function (peek, atCmd) {
			if (peek) return events.length;
			if (events.length) return events.shift();
			var now = performance.now();
			if (now - lastSync > 2000) { lastSync = now; syncFiles(); }
			return -1;
		},
		end: function () {
			running = false; shadow.ended = true;
			return new Promise(function (done) { syncFiles(function () { status('The game has ended. Reload to play again.'); done(); }); });
		}
	};
	window.nhKey = function (c) { events.push(typeof c === 'string' ? c.charCodeAt(0) : c); };

	function onKey(e) {
		if (!running || e.isComposing || e.metaKey) return;
		var k = e.key, c, np = /^Numpad(\d)$/.exec(e.code || '');
		if (np) c = 0x110 + +np[1];       /* keypad digits: C decides (cursor, digit or step) */
		else if (e.code === 'NumpadDecimal') c = 46;
		else if (KEYS[k] !== undefined) c = KEYS[k];
		else if (k.length === 1) {
			c = k.charCodeAt(0);
			if (e.ctrlKey && !e.altKey) { var u = k.toUpperCase().charCodeAt(0); if (u >= 65 && u <= 90) c = u & 0x1f; else return; }
			else if (e.altKey && c < 128) c |= 0x80;
			if (c > 255) return;
		} else return;
		events.push(c);
		e.preventDefault();
	}
	/* a click on a pop-up row: 0x20000 | row (C moves the cursor there and picks) */
	document.addEventListener('click', function (e) {
		var d = e.target.closest && e.target.closest('#pop [data-row]');
		if (d && running) events.push(0x20000 | +d.getAttribute('data-row'));
	});

	var syncing = false, again = false, cbs = [];
	function syncFiles(cb) {
		if (!Module.FS) { if (cb) cb(); return; }
		if (cb) cbs.push(cb);
		if (syncing) { again = true; return; }
		syncing = true;
		var run = cbs; cbs = [];
		Module.FS.syncfs(false, function (err) {
			syncing = false;
			if (err) status('Saving to IndexedDB failed: ' + err, true);
			run.forEach(function (f) { f(err); });
			if (again) { again = false; syncFiles(); }
		});
	}
	function ls(d, re) { try { return Module.FS.readdir(d).filter(function (f) { return re.test(f); }); } catch (e) { return []; } }
	function charName() {
		var f = ls(SAVES, /^\d+.+$/)[0] || ls(DIR, /^\d+.+\.0$/)[0];
		return f ? f.replace(/^\d+/, '').replace(/\.0$/, '').replace(/\.gz$/, '') : null;
	}

	window.Module = {
		nh: nh,
		arguments: ['-d', DIR],
		preRun: [function () {
			var FS = Module.FS;
			Module.ENV.HOME = DIR;
			Module.ENV.USER = 'player';
			FS.mkdirTree(DIR);
			FS.mount(Module.IDBFS, {}, DIR);
			Module.addRunDependency('idbfs');
			FS.syncfs(true, function (err) {
				if (err) status('Could not read IndexedDB (' + err + ')', true);
				FS.readdir(SEED).forEach(function (f) { if (f[0] !== '.') FS.writeFile(DIR + '/' + f, FS.readFile(SEED + '/' + f)); });
				['perm', 'record', 'logfile', 'xlogfile', 'livelog'].forEach(function (f) { try { FS.stat(DIR + '/' + f); } catch (e) { FS.writeFile(DIR + '/' + f, ''); } });
				try { FS.mkdir(SAVES); } catch (e) { }
				loadLayout();
				useTiles(L.tiles);
				var n = charName();
				if (n) Module.arguments.push('-u', n);
				Module.removeRunDependency('idbfs');
			});
		}],
		onRuntimeInitialized: function () { running = true; },
		print: function (s) { console.log(s); },
		printErr: function (s) { console.warn(s); },
		setStatus: function (s) { if (s && !running) status(s.replace(/\(\d+\/\d+\)/, '').trim() || 'Loading…'); },
		onAbort: function (what) { running = false; shadow.crash = String(what); status('The game crashed (' + what + ').', true); }
	};
	window.addEventListener('error', function (e) {
		if (e.error && e.error.name === 'ExitStatus') return;
		if (e.error instanceof WebAssembly.RuntimeError) { shadow.crash = String(e.error.stack || e.error); status('The game crashed (' + e.message + ').', true); }
	});
	document.addEventListener('visibilitychange', function () { if (document.hidden) syncFiles(); });
	document.addEventListener('keydown', onKey);
	document.addEventListener('DOMContentLoaded', function () {
		$('btn-tiles').onclick = function () { cycleTiles(); this.blur(); };
		$('zoom-out').onclick = function () { zoomBy(-1); this.blur(); };
		$('zoom-in').onclick = function () { zoomBy(1); this.blur(); };
	});
	window.nhTiles = { cycle: cycleTiles, use: useTiles, zoom: zoomBy, layout: L };      /* tests */
})();
