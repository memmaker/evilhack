#!/usr/bin/env python3
"""Synthesizes the EvilHack web sound effects (RVIP stage 6).

EvilHack ships no samples, so every sound is made here from sine waves,
noise and envelopes (stdlib only, no borrowed samples). One mono 16-bit
22050 Hz WAV per event name raised by WEB_SOUND() in the game (see
include/hack.h): usage  mksounds.py <outdir>"""
import math, os, random, struct, sys, wave

RATE = 22050
random.seed(3)  # the same files every build


def env(n, a=0.005, r=None):
    """attack/decay envelope over n samples"""
    a = max(1, int(a * RATE))
    for i in range(n):
        yield min(1.0, i / a) * (1 - i / n) ** (r or 2)


def tone(dur, f0, f1=None, kind='sine', vol=0.6, decay=2):
    n = int(dur * RATE)
    f1 = f0 if f1 is None else f1
    out, ph = [], 0.0
    for i, e in enumerate(env(n, r=decay)):
        f = f0 + (f1 - f0) * i / n
        ph += 2 * math.pi * f / RATE
        if kind == 'sine':
            s = math.sin(ph)
        elif kind == 'square':
            s = 1.0 if math.sin(ph) >= 0 else -1.0
            s *= 0.5
        else:  # triangle
            s = 2 / math.pi * math.asin(math.sin(ph))
        out.append(s * e * vol)
    return out


def noise(dur, vol=0.5, lp=0.5, decay=2):
    """low-passed noise; lp near 1 = darker"""
    n, y, out = int(dur * RATE), 0.0, []
    for e in env(n, 0.002, decay):
        y = lp * y + (1 - lp) * random.uniform(-1, 1)
        out.append(y * e * vol * (1 + lp * 2))
    return out


def mix(*parts):
    n = max(len(p) for p in parts)
    return [sum(p[i] for p in parts if i < len(p)) for i in range(n)]


def seq(*parts, gap=0.0):
    out = []
    for p in parts:
        out += p + [0.0] * int(gap * RATE)
    return out


def notes(freqs, dur, **k):
    return seq(*[tone(dur, f, **k) for f in freqs])


SOUNDS = {
    'spell': lambda: mix(tone(0.45, 500, 1400, vol=0.35, decay=1.5), tone(0.45, 750, 2100, vol=0.2, decay=1.5)),
    'stairs': lambda: seq(*[mix(noise(0.07, 0.5, 0.8, 4), tone(0.07, 140 - i * 15, vol=0.4, decay=4)) for i in range(4)], gap=0.08),
    'leveldown': lambda: notes([784, 622, 523, 392], 0.13, kind='square', vol=0.3, decay=1.2),
    'quaff': lambda: seq(*[tone(0.06, 400 + 150 * i, 900 + 150 * i, vol=0.35) for i in range(4)], gap=0.03),
    'zap': lambda: mix(tone(0.3, 1500, 300, 'square', 0.25), noise(0.3, 0.2, 0.1)),
    'throw': lambda: noise(0.2, 0.3, 0.3, 1.2),
    'pray': lambda: mix(tone(1.0, 262, vol=0.25, decay=1), tone(1.0, 330, vol=0.2, decay=1), tone(1.0, 392, vol=0.2, decay=1)),
    'death': lambda: notes([392, 370, 349, 262], 0.35, kind='tri', vol=0.45, decay=1),
    'win': lambda: notes([523, 659, 784, 659, 784, 1047], 0.16, kind='square', vol=0.3, decay=1),
}


def write(path, samples):
    peak = max(1e-9, max(abs(s) for s in samples))
    g = 0.9 / peak if peak > 0.9 else 1.0
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s * g)) * 32767)) for s in samples))


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, f in SOUNDS.items():
        write(os.path.join(out, name + '.wav'), f())
