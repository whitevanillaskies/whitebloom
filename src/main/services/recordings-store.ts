import { access, mkdir, writeFile } from 'fs/promises'
import { basename, join } from 'path'

const RECORDINGS_DIRECTORY_NAME = 'recordings'
const RECORDING_EXTENSION = '.webm'
const DEFAULT_RECORDING_BASENAME = 'recording'

function createRecordingTimestamp(now: Date = new Date()): string {
  const parts = [
    now.getFullYear().toString().padStart(4, '0'),
    (now.getMonth() + 1).toString().padStart(2, '0'),
    now.getDate().toString().padStart(2, '0')
  ]
  const time = [
    now.getHours().toString().padStart(2, '0'),
    now.getMinutes().toString().padStart(2, '0'),
    now.getSeconds().toString().padStart(2, '0')
  ]
  return `${parts.join('-')}_${time.join('-')}`
}

function sanitizeRecordingBasename(input: string): string {
  return input
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 96)
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function createUniqueRecordingPath(directoryPath: string, baseName: string): Promise<string> {
  let suffix = 1
  let candidatePath = join(directoryPath, `${baseName}${RECORDING_EXTENSION}`)

  while (await pathExists(candidatePath)) {
    suffix += 1
    candidatePath = join(directoryPath, `${baseName}-${suffix}${RECORDING_EXTENSION}`)
  }

  return candidatePath
}

export async function saveWorkspaceRecording(
  workspaceRoot: string,
  requestedName: string | null | undefined,
  bytes: Uint8Array
): Promise<{ filePath: string; fileName: string; relativePath: string }> {
  const directoryPath = join(workspaceRoot, RECORDINGS_DIRECTORY_NAME)
  await mkdir(directoryPath, { recursive: true })

  const sanitizedBaseName =
    sanitizeRecordingBasename(requestedName ?? '') ||
    `${DEFAULT_RECORDING_BASENAME}-${createRecordingTimestamp()}`
  const filePath = await createUniqueRecordingPath(directoryPath, sanitizedBaseName)

  await writeFile(filePath, Buffer.from(bytes))

  return {
    filePath,
    fileName: basename(filePath),
    relativePath: `${RECORDINGS_DIRECTORY_NAME}/${basename(filePath)}`
  }
}
