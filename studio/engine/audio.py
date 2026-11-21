"""Musique de fond générée (tonalité et tempo différents à chaque vidéo) + effets sonores + mixage."""
import json
import numpy as np, soundfile as sf

PROGS = [  # suites d'accords (Hz, octave basse)
    [[174.6, 220, 261.6], [130.8, 164.8, 196], [146.8, 174.6, 220], [116.5, 146.8, 174.6]],
    [[110, 130.8, 164.8], [87.3, 110, 130.8], [130.8, 164.8, 196], [98, 123.5, 146.8]],
    [[146.8, 185, 220], [123.5, 146.8, 185], [98, 123.5, 146.8], [110, 138.6, 164.8]],
    [[130.8, 164.8, 196], [98, 123.5, 146.8], [110, 130.8, 164.8], [87.3, 110, 130.8]],
]


def mix(out_dir, seed, punch_times, seg_starts, final_cta=None, calm=False):
    voice, sr = sf.read(out_dir + "/voice.wav", dtype="float32")
    N = len(voice); rng = np.random.default_rng(seed)
    bpm = int(rng.integers(104, 126)); beat = 60 / bpm; prog = PROGS[seed % len(PROGS)]
    music = np.zeros(N, dtype=np.float32); duck = np.ones(N, dtype=np.float32)
    bar = beat * 4
    for b in range(int(N / sr / bar) + 1):
        i0 = int(b * bar * sr); i1 = min(N, i0 + int(bar * sr)); n = i1 - i0
        if n <= 0: break
        tt = np.arange(n) / sr; ch = prog[b % 4]
        bass = np.sin(2 * np.pi * ch[0] / 2 * tt) * .5
        arp = np.zeros(n, dtype=np.float32)
        for k in range(8):
            s0 = int(k * beat / 2 * sr)
            if s0 >= n: break
            m = min(int(.25 * sr), n - s0); f = ch[k % 3] * 2; x = np.arange(m) / sr
            arp[s0:s0 + m] += (np.sin(2 * np.pi * f * x) + .3 * np.sin(4 * np.pi * f * x)) * np.exp(-x * 14) * .22
        fade = np.minimum(1, np.minimum(tt / .03, (bar - tt) / .03))
        music[i0:i1] += ((bass + arp) * fade).astype(np.float32)
    for i in range(0 if not calm else 10**9, int(N / sr / beat) + 1):
        s = int(i * beat * sr)
        if s >= N: break
        n = min(int(.3 * sr), N - s); tt = np.arange(n) / sr
        music[s:s + n] += (np.sin(2 * np.pi * np.cumsum(48 + 90 * np.exp(-tt * 32)) / sr) * np.exp(-tt * 10) * 1.1).astype(np.float32)
        dn = min(int(beat * sr), N - s)
        duck[s:s + dn] = np.minimum(duck[s:s + dn], (.5 + .5 * np.clip(np.arange(dn) / (.16 * sr), 0, 1)).astype(np.float32))
        hs = s + int(.5 * beat * sr); hn = min(int(.04 * sr), N - hs)
        if hn > 0: music[hs:hs + hn] += np.diff(rng.standard_normal(hn + 1)).astype(np.float32) * np.exp(-np.arange(hn) / (.01 * sr)) * .1
        if i % 2 == 1:
            cn = min(int(.16 * sr), N - s); music[s:s + cn] += rng.standard_normal(cn).astype(np.float32) * np.exp(-np.arange(cn) / (.035 * sr)) * .16
    music *= duck; music /= max(1e-6, np.abs(music).max())
    sfx = np.zeros(N, dtype=np.float32)
    def whoosh(at, length=.4, gain=.3):
        s = int(max(0, at - length * .7) * sr); n = min(int(length * sr), N - s)
        if n <= 0: return
        nz = np.convolve(rng.standard_normal(n).astype(np.float32), np.ones(36) / 36, mode="same")
        sfx[s:s + n] += nz * np.sin(np.linspace(0, np.pi, n)) ** 2 * gain * 6
    def impact(at, gain=.9):
        s = int(at * sr); n = min(int(1.0 * sr), N - s)
        if n <= 0: return
        tt = np.arange(n) / sr
        sfx[s:s + n] += (np.sin(2 * np.pi * np.cumsum(35 + 110 * np.exp(-tt * 18)) / sr) * np.exp(-tt * 4) * gain).astype(np.float32)
    def pop(at, gain=.2):
        s = int(max(0, at) * sr); n = min(int(.07 * sr), N - s)
        if n <= 0: return
        tt = np.arange(n) / sr
        sfx[s:s + n] += (np.sin(2 * np.pi * (900 + 2500 * tt) * tt) * np.exp(-tt * 55) * gain).astype(np.float32)
    for st in seg_starts[1:]: whoosh(st)
    if not calm: impact(0.02, 1.0)
    for p in punch_times: pop(p - .03, .1 if calm else .2)
    if final_cta: impact(final_cta, .6)
    lvl = np.convolve(np.abs(voice), np.ones(int(.15 * sr)) / int(.15 * sr), mode="same")
    mg = (.12 if calm else .17) - (.06 if calm else .08) * np.clip(lvl / .03, 0, 1)
    out = voice * .95 + music * mg + sfx * .22
    fn = int(.6 * sr); out[-fn:] *= np.linspace(1, 0, fn)
    out = np.tanh(out * 1.1) / np.tanh(1.1)
    sf.write(out_dir + "/mix.wav", out.astype(np.float32), sr)
