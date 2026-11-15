"use strict";

importScripts("./vendor/lamejs-1.2.7.iife.js");

const BLOCK_SIZE = 1152;
const BITRATE_KBPS = 192;

function writePcm16(samples, offset, length, buffer) {
  for (let index = 0; index < length; index++) {
    const value = Math.max(-1, Math.min(1, samples[offset + index]));
    buffer[index] = value < 0 ? value * 32768 : value * 32767;
  }
  return buffer.subarray(0, length);
}

self.addEventListener("message", ({ data: { samples, sampleRate } }) => {
  const encoder = new lamejs.Mp3Encoder(samples.length, sampleRate, BITRATE_KBPS);
  const left = new Int16Array(BLOCK_SIZE);
  const right = samples.length === 2 ? new Int16Array(BLOCK_SIZE) : null;
  const chunks = [];
  for (let offset = 0; offset < samples[0].length; offset += BLOCK_SIZE) {
    const length = Math.min(BLOCK_SIZE, samples[0].length - offset);
    const leftPcm = writePcm16(samples[0], offset, length, left);
    const chunk = right
      ? encoder.encodeBuffer(leftPcm, writePcm16(samples[1], offset, length, right))
      : encoder.encodeBuffer(leftPcm);
    if (chunk.length) {
      chunks.push(chunk);
    }
  }
  chunks.push(encoder.flush());
  self.postMessage(new Blob(chunks, { type: "audio/mpeg" }));
});
