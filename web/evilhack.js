/*
 * EvilHack in the browser, stage-1 page: draws what win/web/winweb.c sends
 * (Module.nh): map cells (text now; tile indexes arrive too, stage 4),
 * prompt, status, inventory, pop-up rows and messages. C decides all
 * content; this file only draws it. Saves live in IndexedDB (IDBFS,
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

	function $(id) { return document.getElementById(id); }
	function esc(t) { return t.replace(/[&<>]/g, function (c) { return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'; }); }
	function status(msg, err) { var s = $('status'); s.textContent = msg; s.hidden = !msg; s.className = err ? 'error' : ''; }
	function rowsText(t) {       /* "tile \t letter \t sel \t colour \t text" -> lines */
		return t.split('\n').filter(function (l) { return l; }).map(function (l) {
			var f = l.split('\t'), sel = +f[2], text = f.slice(4).join('\t');
			return { c: +f[3], s: (sel === 2 ? '' : f[1] === ' ' ? '    ' : f[1] + (sel ? ' + ' : ' - ')) + text };
		});
	}
	function drawMsgs() {
		shadow.prompt = prompt;
		var m = $('msg');
		m.innerHTML = log.slice(-200).map(function (l) { return l.old ? '<span class="old">' + esc(l.t) + '</span>' : esc(l.t); }).join('\n') +
			(prompt ? '\n<span class="pr">' + esc(prompt) + '</span>' : '');
		m.parentNode.scrollTop = m.parentNode.scrollHeight;
	}

	var nh = {
		map: function (cp, tp, hx, hy, lev) {
			var ch = Module.HEAP32.subarray(tp >> 2, (tp >> 2) + COLNO * ROWNO), html = [], rows = [];
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
			shadow.map = rows; shadow.hero = { x: hx, y: hy, lev: lev };
			$('map').innerHTML = html.join('\n');
			if ($('game').hidden) { $('game').hidden = false; status(''); }
		},
		text: function (id, t) {
			if (id === 4) { log.push({ t: t }); drawMsgs(); return; }
			if (id === 6) { if (log.length) log[log.length - 1] = { t: t }; drawMsgs(); return; }
			if (id === 5) { log.forEach(function (m) { m.old = true; }); drawMsgs(); return; }
			if (id === 0) { prompt = t; drawMsgs(); }
			else if (id === 1) { shadow.status = t.replace(/\n+$/, ''); $('stat').textContent = shadow.status; }
			else if (id === 2) {
				var r = rowsText(t);
				shadow.inv = r.map(function (l) { return l.s; }).join('\n');
				$('inv').innerHTML = r.map(function (l) { return '<span style="color:' + PAL[l.c] + '">' + esc(l.s) + '</span>'; }).join('\n');
			} else if (id === 3) {
				var p = $('pop');
				if (!t) { shadow.pop = ''; p.hidden = true; return; }
				var nl = t.indexOf('\n'), head = t.slice(0, nl).split('\t'), cur = +head[1], title = head.slice(2).join('\t');
				var rr = rowsText(t.slice(nl + 1));
				shadow.pop = (title ? title + '\n' : '') + rr.map(function (l) { return l.s; }).join('\n');
				p.innerHTML = (title ? '<div class="pr">' + esc(title) + '</div>' : '') + rr.map(function (l, i) {
					return '<div' + (i === cur ? ' class="cur"' : '') + ' style="color:' + PAL[l.c] + '">' + esc(l.s || ' ') + '</div>';
				}).join('');
				p.hidden = false;
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
		var k = e.key, c;
		if (KEYS[k] !== undefined) c = KEYS[k];
		else if (k.length === 1) {
			c = k.charCodeAt(0);
			if (e.ctrlKey && !e.altKey) { var u = k.toUpperCase().charCodeAt(0); if (u >= 65 && u <= 90) c = u & 0x1f; else return; }
			else if (e.altKey && c < 128) c |= 0x80;
			if (c > 255) return;
		} else return;
		events.push(c);
		e.preventDefault();
	}

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
})();
