import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { generateEarQuestion, sampleFor, samplePitches } from '../src/ear.ts';

test('Hörfragen haben eindeutige Antworten für alle zwölf Halbtonabstände und die Prime', () => {
  for (const mode of ['number', 'quality']) {
    for (const direction of ['up', 'down']) {
      for (let distance = 0; distance <= 12; distance++) {
        const values = [0, distance / 13 + 0.01, 0.999];
        const question = generateEarQuestion([direction], mode, () => values.shift() ?? 0);
        assert.equal(question.pitches[1] - question.pitches[0], (direction === 'up' ? distance : -distance) || 0);
        assert.ok(question.pitches.every(pitch => pitch >= 57 && pitch <= 75));
        assert.equal(new Set(question.options).size, 4);
        assert.equal(question.options.filter(name => name === question.correct).length, 1);
        if (distance === 6) assert.equal(question.correct, 'Tritonus');
      }
    }
  }
});

test('Wiedergaberate trifft jede Zieltonhöhe mit höchstens einem Halbton Verschiebung', () => {
  for (let pitch = 57; pitch <= 75; pitch++) {
    const { anchor, rate } = sampleFor(pitch);
    assert.ok(Math.abs(anchor - pitch) <= 1);
    assert.ok(Math.abs((anchor + 12 * Math.log2(rate)) - pitch) < 0.000001);
  }
});

test('Lokale PCM-Aufnahmen enthalten die angegebenen Grundtöne', async () => {
  for (const midi of samplePitches) {
    const wav = await readFile(new URL(`../public/audio/piano/${midi}.wav`, import.meta.url));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt16LE(20), 1); // PCM
    assert.equal(wav.readUInt16LE(22), 1); // mono
    const sampleRate = wav.readUInt32LE(24);
    assert.equal(sampleRate, 22050);
    assert.equal(wav.readUInt16LE(34), 16);
    let offset = 12;
    while (offset + 8 < wav.length && wav.toString('ascii', offset, offset + 4) !== 'data') {
      const size = wav.readUInt32LE(offset + 4);
      offset += 8 + size + size % 2;
    }
    assert.equal(wav.toString('ascii', offset, offset + 4), 'data');
    const size = wav.readUInt32LE(offset + 4);
    assert.ok(size / (2 * sampleRate) >= 1);
    const samples = Array.from({ length: 4096 }, (_, i) => wav.readInt16LE(offset + 8 + 2 * (i + 2205)));
    const expected = 440 * 2 ** ((midi - 69) / 12);
    const period = sampleRate / expected;
    const error = lag => samples.slice(0, 3500).reduce((sum, sample, i) => sum + (sample - samples[i + lag]) ** 2, 0);
    let best = Math.floor(period * 0.92);
    for (let lag = best + 1; lag <= Math.ceil(period * 1.08); lag++) {
      if (error(lag) < error(best)) best = lag;
    }
    const left = error(best - 1), center = error(best), right = error(best + 1);
    const refined = best + (left - right) / (2 * (left - 2 * center + right));
    const cents = 1200 * Math.log2(sampleRate / refined / expected);
    assert.ok(Math.abs(cents) < 15, `MIDI ${midi}: ${cents.toFixed(1)} Cent Abweichung`);
  }
});
