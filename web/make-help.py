#!/usr/bin/env python3
"""Writes the in-page guide (dist/help.html) for the EvilHack web build.

RVIP stage 6. Self-contained (stdlib only, no external Docs folder): the
prose is written here in our own words from the game's Guidebook, README,
dat/history and doc/evilhack-changelog.md; the complete key list is read
from the game's own dat/cmdhelp (evaluated for the web build: number_pad 0,
no debug mode, no shell, no suspend) and the extended commands from
extcmdlist[] in src/cmd.c. Run from anywhere: make-help.py > help.html"""
import html
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
UPSTREAM = 'c444f6a3ab1e9f16d0676961dba86f628e91c6ba'
esc = html.escape

# what the web build is, for the conditions in dat/cmdhelp
WEB = {'debug': False, 'shell': False, 'suspend': False, 'rest_on_space': False}
NUMPAD = 0


def cond(expr):
    """one '&?'/'&:' condition of dat/cmdhelp (text after '#' is a comment)"""
    expr = expr.split('#')[0].strip()
    if not expr:
        return True                      # plain else
    neg = expr.startswith('!')
    expr = expr.lstrip('!').strip()
    if expr.startswith('number_pad'):
        vals = [int(v) for v in expr.split('=', 1)[1].replace(' ', '').split(',')]
        r = NUMPAD in vals
    else:
        r = WEB[expr]
    return r != neg


def cmdhelp():
    """(key, text) rows of dat/cmdhelp that apply to the web build"""
    rows, stack, active = [], [], True
    for line in open(os.path.join(ROOT, 'dat/cmdhelp'), encoding='latin-1'):
        line = line.rstrip('\n')
        if line.startswith('&#'):
            continue
        if line.startswith('&?'):
            stack.append([active, False])
            c = active and cond(line[2:])
            stack[-1][1] = c
            active = c
        elif line.startswith('&:'):
            parent, taken = stack[-1]
            c = parent and not taken and cond(line[2:])
            stack[-1][1] = taken or c
            active = c
        elif line.startswith('&.'):
            active = stack.pop()[0]
        elif active and '\t' in line:
            k, t = line.split('\t', 1)
            if 'unavailable' in t:
                continue
            if k == '^C':                # terminal interrupt: no SIGINT in a browser ('#quit' quits)
                continue
            rows.append((k, t))
    assert not stack
    return rows


def extcmds():
    """(name, text) of every extended command a player can use"""
    src = open(os.path.join(ROOT, 'src/cmd.c'), encoding='latin-1').read()
    body = src[src.index('struct ext_func_tab extcmdlist[] = {'):]
    body = body[:body.index('\n};')]
    out = []
    for m in re.finditer(r'\{\s*[^,]+,\s*"([^"]+)",\s*"([^"]*)",\s*\w+\s*(?:,\s*([^}]*))?\}', body):
        name, text, flags = m.group(1), m.group(2), m.group(3) or ''
        if 'WIZMODECMD' in flags or 'CMD_NOT_AVAILABLE' in flags or name in ('#', '?'):
            continue
        out.append((name, text))
    return out


def keyname(k):
    """cmdhelp key -> what to show"""
    if k == ' ':
        return 'Space'
    if k == '^[':
        return 'Esc'
    if k.startswith('^'):
        return 'Ctrl+' + k[1:]
    if k.startswith('M-'):
        return 'Alt+' + k[2:]
    return k


def kbd(*keys):
    return ' '.join('<kbd>%s</kbd>' % esc(k) for k in keys)


def changelog_versions():
    t = open(os.path.join(ROOT, 'doc/evilhack-changelog.md'), encoding='utf-8').read()
    return re.findall(r'^### Version ([\d.]+)', t, re.M)


# ------------------------------------------------------------------ text
KEYS = [
    (kbd('?'), 'the game\'s own help menu (commands, symbols, options, the Guidebook)'),
    (kbd('~'), 'explore: walk to the nearest unexplored place; stops at anything new'),
    (kbd('Enter'), 'command menu: every command with its key, grouped'),
    (kbd('<') + ' ' + kbd('>'), 'walk to the nearest known up/down stairs; press again on them to climb'),
    (kbd('i'), 'inventory with a cursor: a letter does the main action, Enter opens the item\'s action menu'),
    (kbd('S'), 'save and stop (reload or Play again to continue)'),
    (kbd('h', 'j', 'k', 'l', 'y', 'u', 'b', 'n'), 'move (arrow keys and the number pad work too); Shift+direction runs'),
    (kbd('F') + ' + direction', 'fight in a direction, even what you cannot see'),
    (kbd('s'), 'search for hidden doors and traps'),
    (kbd('Esc'), 'cancel a prompt or menu'),
]

ABOUT = '''<p><strong>EvilHack</strong> is a variant of NetHack made to be <em>much</em> harder to win than the original.
It was created by <strong>Keith Simpson</strong> (k21971), who started it on NetHack 3.6.2 in October 2018 and opened it
for public play in April 2019 on the Hardfought servers; it has followed NetHack 3.6 up to 3.6.7 since.
Its ideas come from GruntHack and SporkHack, with pieces from Slash'EM, SpliceHack, UnNetHack and xNetHack, plus a lot of
content of its own. Home: <a href="https://github.com/k21971/EvilHack" target="_blank" rel="noopener">github.com/k21971/EvilHack</a>
(changelog in <code>doc/evilhack-changelog.md</code>); community: <code>#evilhack</code> and <code>#hardfought</code> on Libera Chat.</p>
<p>Like NetHack, you go down through the Dungeons of Doom, find the Amulet of Yendor deep in Gehennom and carry it back up
to offer it to your god. NetHack itself is by the NetHack DevTeam and many contributors, going back to Hack (Jay Fenlason,
then Andries Brouwer); the in-game <kbd>V</kbd> command shows the whole history and credits list.</p>
<p><strong>Licence:</strong> the NetHack General Public License (NGPL), as stated in the source headers
("NetHack may be freely redistributed. See license for details.") and in <code>dat/license</code>, which the game shows too.</p>'''

HISTORY = '''<p>Some milestones from the changelog (%d releases, 0.1.0 to %s), in short:</p>
<ul>
<li><strong>Early releases:</strong> monsters that use wands, loot containers and fight smarter (GruntHack); SporkHack's altar
sacrifice changes and racial shopkeepers; object <em>materials</em> from xNetHack (a mithril elven mail, a silver spear, a
wooden or bone weapon all behave differently); a reworked Sokoban end; Elbereth only works once you have learned it in the game.</li>
<li><strong>New races over time:</strong> Giant, Hobbit and Centaur, then Illithid, Tortle, Drow, Draugr, Vampire and Aasimar.</li>
<li><strong>New roles:</strong> Convict, Druid and the Moloch cultist Infidel next to the classic thirteen.</li>
<li><strong>Dungeon:</strong> forges (combine and repair metal items, or dip into them), a revamped Gehennom, new special levels and monsters.</li>
<li><strong>0.9.3 (this build):</strong> merges from NetHack 3.6.7, 256-colour support for the terminal ports, monsters that dual-wield,
the Illithid's telekinesis, an in-game Guidebook and many fixes.</li>
</ul>'''

SAVING = '''<ul>
<li><strong>Saving is automatic.</strong> While you wait at the command prompt the game checkpoints itself into this browser
(IndexedDB) about a second after each turn; switching tabs saves too. Reloading the page continues from there.</li>
<li><kbd>S</kbd> saves and ends the session, as in the original; <em>Play again</em> or a reload continues it.</li>
<li>When your character dies or you quit (<code>#quit</code>), the game is over: <em>Play again</em> starts a new character with the same name.</li>
<li>Each browser keeps <strong>one game</strong>. <em>File &#9662; New game</em> deletes it and starts over.</li>
<li><em>File &#9662; Export save</em> downloads the game; <em>Import save</em> loads one back (also a <code>save/0Name</code> file from a desktop EvilHack built the same way).</li>
<li>Private windows and "clear site data" delete the stored game. Export first if it matters.</li>
</ul>'''

NEWPLAYER = '''<p><strong>EvilHack is much harder than NetHack.</strong> Deaths in the first few levels are normal. Things that save you
in NetHack are weaker or gone, monsters are tougher and smarter, and they use the same items you do.</p>
<h3>Choosing a character</h3>
<p>Roles: Archeologist, Barbarian, Caveman, Convict, Druid, Healer, Infidel, Knight, Monk, Priest, Ranger, Rogue, Samurai,
Tourist, Valkyrie, Wizard. Races: human, elf, dwarf, gnome, orc, giant, hobbit, centaur, illithid, tortle, drow, draugr,
vampire, aasimar (not every role takes every race).</p>
<ul>
<li><strong>Easier starts:</strong> a <em>Valkyrie</em>, <em>Barbarian</em> or <em>Samurai</em> (strong melee, good armour);
a <em>dwarf</em> or <em>giant</em> for toughness (giants one-hand two-handed weapons and throw boulders but wear little armour).</li>
<li><strong>Hard on purpose:</strong> <em>Convict</em> (starts with a ball and chain, hungry, weak), <em>Tourist</em>,
<em>Infidel</em> (worships Moloch; must return the Amulet to Gehennom), <em>draugr</em> (undead, fragile to fire, no spells).</li>
<li>Race matters more than in NetHack: <em>drow</em> gear is adamantine that becomes brittle in light; <em>vampires</em> drink blood
and hate silver; <em>tortles</em> can hide in their shell but wear almost no armour; <em>illithids</em> are frail psychic casters;
<em>hobbits</em> sense whether food is safe; <em>centaurs</em> jump and shoot but wear no boots; <em>aasimar</em> gain celestial
powers while they stay faithful.</li>
</ul>
<h3>What is different</h3>
<ul>
<li><strong>Materials:</strong> every item has a material (iron, mithril, silver, wood, bone, adamantine&hellip;). It changes
weight, damage, protection, what rusts or burns, and who cannot touch it (elves and iron, demons and silver).</li>
<li><strong>Monsters fight like you:</strong> they wield and dual-wield, wear armour, zap wands (even wishing), read scrolls,
loot containers and steal. A kobold with a wand of striking is a real threat. Racial grudges exist: orcs and elves attack each other.</li>
<li><strong>Elbereth</strong> does nothing until you have learned it in the game.</li>
<li><strong>Intrinsics</strong> such as invisibility and see invisible are usually temporary, and reflection only works part of the time.</li>
<li><strong>Altars and gods:</strong> sacrifice gifts and crowning differ; angering your god is costly. Shopkeepers have races and
prices to match.</li>
<li><strong>Forges</strong> in the dungeon can combine or repair metal items &mdash; and explode.</li>
</ul>'''

TIPS = '''<ul>
<li>Use <kbd>~</kbd> to explore and <kbd>&gt;</kbd> to walk to the stairs, but stop when something appears: read the Log messages window.</li>
<li>Look before you fight: <kbd>;</kbd> then a square names what is there; the <em>Visible</em> window lists every monster and object in view.</li>
<li>Rest (<kbd>s</kbd> or <kbd>20s</kbd>) back to full hit points before going down. Use <kbd>Enter</kbd> when you forget a key.</li>
<li>Pray (<code>#pray</code>) when your hit points are below a seventh of the maximum, and wait long (around a thousand turns) between prayers.</li>
<li>Keep an escape item (scroll of teleportation, wand of digging) and something to fix hunger and illness. Never eat unknown corpses of
things that were already dead; cockatrice corpses are deadly to touch bare-handed.</li>
<li>Price-identify in shops, engrave-test wands (<kbd>E</kbd>), and check armour's material before you trade your old set for it.</li>
<li>Your pet is a strong early fighter; keep it close on the first levels.</li>
<li>The Gnomish Mines branch off Dungeon levels 2-4; Sokoban is reached by the extra up stairs on the level below the Oracle.
Both give items; the Mines are dangerous early unless the gnomes and dwarves there are peaceful to your race.</li>
</ul>'''

BROWSER = '''<ul>
<li>Every panel is a window: <em>Map</em>, <em>Log messages</em>, <em>Status</em>, <em>Inventory</em>, <em>Visible</em> and
<em>Equipment</em> (hidden at first). Drag a title bar to move it, drag the gaps to resize, hover a title bar for rename,
<em>A&minus;</em>/<em>A+</em> (text size; on the Map: zoom) and close. <em>Windows &#9662;</em> switches between multi-window and
one-window mode, shows hidden windows and resets the layout.</li>
<li><em>Tiles</em> switches between the NetHack 3.6 tile set and text. <em>Font</em> picks the font of the text windows; the Map
title bar has its own in text mode.</li>
<li><strong>Inventory</strong> (<kbd>i</kbd>): move the cursor with the arrow keys or <kbd>j</kbd>/<kbd>k</kbd> (number pad too),
<kbd>Enter</kbd> opens the item's menu with every action that fits it (wear, wield, quaff, read, apply, drop&hellip;); a letter picks
that item. Prompts such as "What do you want to eat?" open the same list of fitting items at once.</li>
<li><strong>Enter</strong> at the command prompt opens the command menu with every command and its key.</li>
<li><em>Audio &#9662;</em>: sound effects for game actions (hits, misses, kills, spells, doors, stairs, level up, eating, drinking,
gold, zapping, teleporting, praying, death). <strong>Off</strong> after every page load; tick it to hear them. The sounds are made for
this port (EvilHack has none); there is no music.</li>
<li>Your character's name is asked once and kept in this browser.</li>
<li>Browsers keep some shortcuts for themselves (<kbd>Ctrl+W</kbd>, <kbd>Ctrl+T</kbd>, <kbd>Ctrl+N</kbd>, <kbd>Cmd</kbd> shortcuts
on a Mac); use the Enter menu for those commands. Alt+letter commands are also reachable as <code>#name</code> extended commands.</li>
<li>If the game ever crashes, a message appears at the top; reload the page to continue from the last autosave.</li>
</ul>'''


def about_version():
    return ('<p>This web build is upstream <strong>EvilHack 0.9.3</strong>, commit <code>%s</code> '
            '(<a href="https://github.com/k21971/EvilHack/tree/%s" target="_blank" rel="noopener">k21971/EvilHack at that commit</a>), '
            'with a browser front end added (window port, explore, stair walking, Enter menu, tiles, sound, saving in the browser); '
            'gameplay is unchanged. The port\'s source will be public at '
            '<a href="https://github.com/memmaker/evilhack" target="_blank" rel="noopener">github.com/memmaker/evilhack</a> '
            '(that repository is made public later, after this build).</p>') % (UPSTREAM, UPSTREAM)


def main():
    rows = cmdhelp()
    assert len(rows) > 80, len(rows)
    ext = extcmds()
    assert len(ext) > 60, len(ext)
    vers = changelog_versions()
    out = ['<h2 id="h-about">EvilHack</h2>',
           '<ul class="toc"><li><a href="#h-keys">Keys</a></li><li><a href="#h-new">New players</a></li>'
           '<li><a href="#h-tips">Tips</a></li><li><a href="#h-save">Saving</a></li>'
           '<li><a href="#h-web">In the browser</a></li><li><a href="#h-ver">About this version</a></li></ul>',
           ABOUT,
           '<h3>History</h3>', HISTORY % (len(vers), vers[-1]),
           '<h2 id="h-keys">Keys</h2>',
           '<div class="box key"><dl>']
    for k, what in KEYS:
        out.append('<dt>%s</dt><dd>%s</dd>' % (k, esc(what)))
    out.append('</dl></div>')
    out.append('<details><summary>All keys (%d, from the game\'s own command help)</summary><div class="all">' % len(rows))
    for k, t in rows:
        out.append('<div><kbd data-k="%s">%s</kbd><span>%s</span></div>' % (esc(k, True), esc(keyname(k)), esc(t)))
    out.append('</div></details>')
    out.append('<details><summary>Extended commands (%d): <kbd>#</kbd> then the name, or the Enter menu</summary><div class="all">' % len(ext))
    for n, t in ext:
        out.append('<div><code>#%s</code><span>%s</span></div>' % (esc(n), esc(t)))
    out.append('</div></details>')
    out.append('<h2 id="h-new">New players</h2>' + NEWPLAYER)
    out.append('<h2 id="h-tips">Tips</h2>' + TIPS)
    out.append('<h2 id="h-save">Saving</h2>' + SAVING)
    out.append('<h2 id="h-web">Playing in the browser</h2>' + BROWSER)
    out.append('<h2 id="h-ver">About this version</h2>' + about_version())
    print('\n'.join(out))


main()
