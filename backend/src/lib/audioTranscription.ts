import OpenAI, { toFile } from 'openai'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const OPENAI_AUDIO_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024
export const OPENAI_AUDIO_SAFE_CHUNK_BYTES = 24 * 1024 * 1024

const DEFAULT_CHUNK_SECONDS = 10 * 60
const MIN_CHUNK_SECONDS = 30
const FFMPEG_TIMEOUT_MS = Number(
  process.env.TRANSCRIPTION_FFMPEG_TIMEOUT_MS || 15 * 60 * 1000,
)
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg'
const TRANSCRIPTION_CHUNK_BITRATE =
  process.env.TRANSCRIPTION_CHUNK_BITRATE || '48k'
const TRANSCRIPTION_MODEL = 'whisper-1'

type TranscriptionSource = 'openai-whisper' | 'openai-whisper-chunked'

interface AudioFileMetadata {
  extension: string
  mimeType: string
  filename: string
}

export interface AudioSourceMetadata {
  contentType?: string | null
  filename?: string
  recordingUrl?: string
}

export interface AudioChunkFile {
  index: number
  path: string
  filename: string
  mimeType: string
  sizeBytes: number
}

export interface PreparedAudioChunks {
  chunks: AudioChunkFile[]
  cleanup: () => Promise<void>
}

export interface AudioTranscriptionResult {
  text: string
  source: TranscriptionSource
  chunkCount: number
  audioBytes: number
  chunkBytes: number[]
}

function configuredChunkSeconds(): number {
  const configured = Number(process.env.TRANSCRIPTION_CHUNK_SECONDS)
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(MIN_CHUNK_SECONDS, Math.floor(configured))
  }
  return DEFAULT_CHUNK_SECONDS
}

function normalizeContentType(contentType?: string | null): string | undefined {
  return contentType?.split(';')[0]?.trim().toLowerCase() || undefined
}

function extensionFromContentType(contentType?: string): string | undefined {
  switch (contentType) {
    case 'audio/mpeg':
    case 'audio/mp3':
    case 'audio/mpga':
      return 'mp3'
    case 'audio/mp4':
    case 'video/mp4':
      return 'mp4'
    case 'audio/m4a':
    case 'audio/x-m4a':
      return 'm4a'
    case 'audio/wav':
    case 'audio/wave':
    case 'audio/x-wav':
      return 'wav'
    case 'audio/webm':
    case 'video/webm':
      return 'webm'
    case 'audio/ogg':
      return 'ogg'
    case 'audio/flac':
      return 'flac'
    default:
      return undefined
  }
}

function extensionFromPath(value?: string): string | undefined {
  if (!value) return undefined

  try {
    const url = new URL(value)
    const ext = path.extname(url.pathname).slice(1).toLowerCase()
    return ext || undefined
  } catch {
    const ext = path.extname(value).slice(1).toLowerCase()
    return ext || undefined
  }
}

function extensionFromMagic(buffer: Buffer): string | undefined {
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return 'wav'
  }

  if (
    buffer.length >= 3 &&
    (buffer.subarray(0, 3).toString('ascii') === 'ID3' ||
      (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))
  ) {
    return 'mp3'
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString('ascii') === 'ftyp'
  ) {
    return 'mp4'
  }

  if (
    buffer.length >= 4 &&
    buffer.subarray(0, 4).toString('ascii') === 'OggS'
  ) {
    return 'ogg'
  }

  if (
    buffer.length >= 4 &&
    buffer.subarray(0, 4).toString('ascii') === 'fLaC'
  ) {
    return 'flac'
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'webm'
  }

  return undefined
}

function mimeTypeForExtension(extension: string): string {
  switch (extension) {
    case 'mp4':
      return 'audio/mp4'
    case 'm4a':
      return 'audio/m4a'
    case 'wav':
      return 'audio/wav'
    case 'webm':
      return 'audio/webm'
    case 'ogg':
      return 'audio/ogg'
    case 'flac':
      return 'audio/flac'
    case 'mp3':
    default:
      return 'audio/mpeg'
  }
}

function getAudioFileMetadata(
  audioBuffer: Buffer,
  metadata: AudioSourceMetadata,
): AudioFileMetadata {
  const contentType = normalizeContentType(metadata.contentType)
  const extension =
    extensionFromMagic(audioBuffer) ||
    extensionFromContentType(contentType) ||
    extensionFromPath(metadata.filename) ||
    extensionFromPath(metadata.recordingUrl) ||
    'mp3'
  const mimeType = contentType || mimeTypeForExtension(extension)
  const filename = metadata.filename?.includes('.')
    ? metadata.filename
    : `recording.${extension}`

  return { extension, mimeType, filename }
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function runFfmpeg(args: string[]): Promise<void> {
  try {
    await execFileAsync(FFMPEG_PATH, args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: FFMPEG_TIMEOUT_MS,
    })
  } catch (error) {
    const stderr =
      typeof (error as { stderr?: unknown }).stderr === 'string'
        ? (error as { stderr: string }).stderr.trim()
        : ''
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(stderr ? `${message}: ${stderr}` : message)
  }
}

async function listAudioChunks(outputDir: string): Promise<AudioChunkFile[]> {
  const filenames = (await readdir(outputDir))
    .filter((filename) => filename.endsWith('.mp3'))
    .sort()

  return Promise.all(
    filenames.map(async (filename, index) => {
      const chunkPath = path.join(outputDir, filename)
      const chunkStat = await stat(chunkPath)

      return {
        index,
        path: chunkPath,
        filename: `recording-part-${String(index + 1).padStart(3, '0')}.mp3`,
        mimeType: 'audio/mpeg',
        sizeBytes: chunkStat.size,
      }
    }),
  )
}

export async function prepareAudioChunks(
  audioBuffer: Buffer,
  sourceExtension = 'mp3',
): Promise<PreparedAudioChunks> {
  let tempDir: string | undefined

  try {
    tempDir = await mkdtemp(path.join(tmpdir(), 'omnidial-transcription-'))
    const inputPath = path.join(
      tempDir,
      `recording-${randomUUID()}.${sourceExtension}`,
    )
    const outputDir = path.join(tempDir, 'chunks')

    await writeFile(inputPath, audioBuffer)

    let segmentSeconds = configuredChunkSeconds()

    for (let attempt = 0; attempt < 6; attempt++) {
      await rm(outputDir, { recursive: true, force: true })
      await mkdir(outputDir, { recursive: true })

      await runFfmpeg([
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        inputPath,
        '-vn',
        '-map',
        '0:a:0',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-b:a',
        TRANSCRIPTION_CHUNK_BITRATE,
        '-f',
        'segment',
        '-segment_time',
        String(segmentSeconds),
        '-reset_timestamps',
        '1',
        path.join(outputDir, 'chunk-%03d.mp3'),
      ])

      const chunks = await listAudioChunks(outputDir)
      if (chunks.length === 0) {
        throw new Error('ffmpeg did not produce any audio chunks')
      }

      const oversizedChunks = chunks.filter(
        (chunk) => chunk.sizeBytes >= OPENAI_AUDIO_SAFE_CHUNK_BYTES,
      )
      if (oversizedChunks.length === 0) {
        return {
          chunks,
          cleanup: () => rm(tempDir!, { recursive: true, force: true }),
        }
      }

      if (segmentSeconds <= MIN_CHUNK_SECONDS) {
        const largestChunk = Math.max(
          ...oversizedChunks.map((chunk) => chunk.sizeBytes),
        )
        throw new Error(
          `Unable to create safe audio chunks; largest chunk was ${formatBytes(largestChunk)}`,
        )
      }

      segmentSeconds = Math.max(
        MIN_CHUNK_SECONDS,
        Math.floor(segmentSeconds / 2),
      )
    }

    throw new Error(
      'Unable to create safe audio chunks after multiple attempts',
    )
  } catch (error) {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
    throw error
  }
}

async function transcribeOpenAIFile(
  openai: OpenAI,
  audioBuffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const audioFile = await toFile(audioBuffer, filename, {
    type: mimeType,
  })

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: TRANSCRIPTION_MODEL,
    response_format: 'text',
  })

  return transcription.trim()
}

export async function transcribeAudioBuffer(
  openai: OpenAI,
  audioBuffer: Buffer,
  metadata: AudioSourceMetadata = {},
): Promise<AudioTranscriptionResult> {
  if (audioBuffer.byteLength === 0) {
    throw new Error('Recording audio is empty')
  }

  const audioFile = getAudioFileMetadata(audioBuffer, metadata)

  if (audioBuffer.byteLength < OPENAI_AUDIO_SAFE_CHUNK_BYTES) {
    const text = await transcribeOpenAIFile(
      openai,
      audioBuffer,
      audioFile.filename,
      audioFile.mimeType,
    )

    if (!text) {
      throw new Error('OpenAI transcription returned an empty transcript')
    }

    return {
      text,
      source: 'openai-whisper',
      chunkCount: 1,
      audioBytes: audioBuffer.byteLength,
      chunkBytes: [audioBuffer.byteLength],
    }
  }

  const preparedChunks = await prepareAudioChunks(
    audioBuffer,
    audioFile.extension,
  ).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Recording is ${formatBytes(audioBuffer.byteLength)}, above the OpenAI ${formatBytes(OPENAI_AUDIO_UPLOAD_LIMIT_BYTES)} audio upload limit, and chunking failed: ${message}`,
    )
  })

  try {
    const transcripts: string[] = []

    for (const chunk of preparedChunks.chunks) {
      const chunkBuffer = await readFile(chunk.path)
      transcripts.push(
        await transcribeOpenAIFile(
          openai,
          chunkBuffer,
          chunk.filename,
          chunk.mimeType,
        ),
      )
    }

    const text = transcripts
      .map((transcript) => transcript.trim())
      .filter(Boolean)
      .join('\n\n')

    if (!text) {
      throw new Error('OpenAI transcription returned an empty transcript')
    }

    return {
      text,
      source: 'openai-whisper-chunked',
      chunkCount: preparedChunks.chunks.length,
      audioBytes: audioBuffer.byteLength,
      chunkBytes: preparedChunks.chunks.map((chunk) => chunk.sizeBytes),
    }
  } finally {
    await preparedChunks.cleanup()
  }
}
