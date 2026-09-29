#!/usr/bin/env python3
"""Writes the in-page guide (dist/help.html) for the EvilHack web build.

Stage 5 version: controls, the web port's own keys, saving and windows,
written here (self-contained, stdlib only). The full game guide from the
game's own docs comes in RVIP stage 6."""
import html

esc = html.escape


def kbd(*keys):
    return ' '.join('<kbd>%s</kbd>' % esc(k) for k in keys)


KEYS = [
    (kbd('h', 'j', 'k', 'l', 'y', 'u', 'b', 'n'), 'move (or the arrow keys, Home/PgUp/End/PgDn, the number pad); Shift runs'),
    (kbd('~'), 'explore: walk to the nearest unexplored place, stops at anything new'),
    (kbd('<') + ' ' + kbd('>'), 'walk to the nearest known up/down stairs; press again on them to take them'),
    (kbd('Enter'), 'command menu: every command with its key'),
    (kbd('i'), 'inventory with a cursor: a letter does the main action, Enter opens the item\'s action menu'),
    (kbd('?'), 'the game\'s own help menu'),
    (kbd('S'), 'save and stop (reload to continue)'),
    (kbd('O'), 'options'),
]

SAVING = '''<ul>
<li><strong>Saving is automatic.</strong> While you wait at the command prompt the game checkpoints itself into this browser (IndexedDB); reloading the page continues from there.</li>
<li><kbd>S</kbd> saves and ends the session, as in the original; <em>Play again</em> or a reload continues it.</li>
<li>When your character dies or you quit, the game is over: <em>Play again</em> starts a new character with the same name.</li>
<li>Each browser keeps <strong>one game</strong>. <em>File &#9662; New game</em> deletes it and starts over.</li>
<li><em>Export save</em> downloads the game; <em>Import save</em> loads one (also a <code>save/0Name</code> file from a desktop EvilHack built the same way).</li>
<li>Private windows and "clear site data" delete the stored game. Export first if it matters.</li>
</ul>'''

WEB = '''<ul>
<li>Every panel is a window: drag a title bar to move it, drag the gaps to resize, hover a title bar for rename, <em>A&minus;</em>/<em>A+</em> (text size; on the Map: zoom) and close. <em>Windows &#9662;</em> switches between multi-window and one-window mode, shows hidden windows (Equipment, Status) and resets the layout.</li>
<li><em>Tiles</em> switches between the NetHack 3.6 tile set and text. <em>Font</em> picks the font of the text windows; the Map title bar has its own in text mode.</li>
<li>Your character's name is asked once and kept in this browser.</li>
<li>Browsers keep a few shortcuts for themselves (<kbd>Ctrl+W</kbd>, <kbd>Ctrl+T</kbd>, <kbd>Ctrl+N</kbd>, <kbd>Cmd</kbd> shortcuts on a Mac).</li>
<li>If the game ever crashes, a message appears at the top; reload the page to continue from the last autosave.</li>
</ul>'''

out = ['<h2>EvilHack</h2>',
       '<p>EvilHack is a much harder variant of NetHack 3.6: new roles and races, many new monsters, items and artifacts, '
       'and far less forgiving monsters. Find the Amulet of Yendor at the bottom of the dungeon and bring it back up.</p>',
       '<h3>Keys</h3><dl>']
for k, what in KEYS:
    out.append('<dt>%s</dt><dd>%s</dd>' % (k, esc(what)))
out.append('</dl>')
out.append('<h3>Saving</h3>' + SAVING)
out.append('<h3>Playing in the browser</h3>' + WEB)
print('\n'.join(out))
