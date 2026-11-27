import { sampleFor, type SamplePitch } from './ear';

let context: AudioContext | undefined;
let playback: AbortController | undefined;
const buffers = new Map<SamplePitch, Promise<AudioBuffer>>();

function loadSample(audio: AudioContext, anchor: SamplePitch): Promise<AudioBuffer> {
  const cached = buffers.get(anchor);
  if (cached) return cached;
  const pending = fetch(`/audio/piano/${anchor}.wav`).then((response) => {
    if (!response.ok) throw new Error('Klaviersample fehlt.');
    return response.arrayBuffer();
  }).then(bytes => audio.decodeAudioData(bytes)).catch((error: unknown) => {
    buffers.delete(anchor);
    throw error;
  });
  buffers.set(anchor, pending);
  return pending;
}

export function stopPiano(): void {
  playback?.abort();
}

export async function playPiano(pitches: [number, number]): Promise<boolean> {
  stopPiano();
  const attempt = new AbortController();
  playback = attempt;
  try {
    const audio = context ??= new AudioContext();
    // Call resume as part of the user's gesture, before any fetch or decoding.
    const resumed = audio.resume();
    const samples = pitches.map(sampleFor);
    const ready = Promise.all([resumed, Promise.all(samples.map(({ anchor }) => loadSample(audio, anchor)))]);
    let timeout: number | undefined;
    let cancelLoad: () => void = () => {};
    const interrupted = new Promise<null>((resolve, reject) => {
      cancelLoad = () => resolve(null);
      attempt.signal.addEventListener('abort', cancelLoad, { once: true });
      timeout = window.setTimeout(() => reject(new Error('Audiowiedergabe konnte nicht gestartet werden.')), 10000);
    });
    const prepared = await Promise.race([ready, interrupted]).finally(() => {
      window.clearTimeout(timeout);
      attempt.signal.removeEventListener('abort', cancelLoad);
    });
    if (!prepared || attempt.signal.aborted) return false;
    const [, decoded] = prepared;

    return await new Promise<boolean>((resolve, reject) => {
      const nodes = decoded.map((buffer, index) => {
        const source = audio.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = samples[index].rate;
        source.connect(audio.destination);
        return source;
      });
      const finish = (played: boolean) => {
        attempt.signal.removeEventListener('abort', cancel);
        nodes[1].onended = null;
        for (const node of nodes) node.disconnect();
        resolve(played);
      };
      const cancel = () => {
        for (const node of nodes) node.stop();
        finish(false);
      };
      nodes[1].onended = () => finish(true);
      attempt.signal.addEventListener('abort', cancel, { once: true });
      const start = audio.currentTime + 0.04;
      try {
        nodes[0].start(start);
        nodes[1].start(start + 0.65);
      } catch (error) {
        attempt.signal.removeEventListener('abort', cancel);
        for (const node of nodes) node.disconnect();
        reject(error);
      }
    });
  } finally {
    if (playback === attempt) playback = undefined;
  }
}
