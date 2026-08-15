import assert from 'node:assert/strict'
import test from 'node:test'
import {
  OPENAI_AUDIO_SAFE_CHUNK_BYTES,
  prepareAudioChunks,
} from '../src/lib/audioTranscription'

function makeSilentWav(durationSeconds: number, sampleRate = 16000): Buffer {
  const channels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const dataSize = durationSeconds * sampleRate * channels * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28)
  buffer.writeUInt16LE(channels * bytesPerSample, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)

  return buffer
}

test('prepareAudioChunks creates safe OpenAI upload parts', async () => {
  const originalChunkSeconds = process.env.TRANSCRIPTION_CHUNK_SECONDS
  process.env.TRANSCRIPTION_CHUNK_SECONDS = '30'

  const prepared = await prepareAudioChunks(makeSilentWav(65), 'wav')

  try {
    assert.ok(prepared.chunks.length > 1)
    for (const chunk of prepared.chunks) {
      assert.equal(chunk.mimeType, 'audio/mpeg')
      assert.match(chunk.filename, /^recording-part-\d{3}\.mp3$/)
      assert.ok(chunk.sizeBytes > 0)
      assert.ok(chunk.sizeBytes < OPENAI_AUDIO_SAFE_CHUNK_BYTES)
    }
  } finally {
    await prepared.cleanup()
    if (originalChunkSeconds === undefined) {
      delete process.env.TRANSCRIPTION_CHUNK_SECONDS
    } else {
      process.env.TRANSCRIPTION_CHUNK_SECONDS = originalChunkSeconds
    }
  }
})
