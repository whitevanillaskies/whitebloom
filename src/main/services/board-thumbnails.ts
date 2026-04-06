import { constants } from 'fs'
import { access, mkdir, unlink, writeFile } from 'fs/promises'
import { join, parse, relative } from 'path'

export const THUMBS_DIRECTORY_NAME = '.wbthumbs'

/**
 * Derives the thumbnail path for a workspace board.
 *
 * Mirrors the board's relative path inside <workspaceRoot>/.wbthumbs/,
 * replacing the board extension with .jpg.
 *
 * Examples:
 *   boardPath: /ws/meeting.wb.json       → /ws/.wbthumbs/meeting.jpg
 *   boardPath: /ws/notes/meeting.wb.json → /ws/.wbthumbs/notes/meeting.jpg
 */
export function deriveThumbnailPath(boardPath: string, workspaceRoot: string): string {
  const relativePath = relative(workspaceRoot, boardPath)
  const parsed = parse(relativePath)
  // parse() strips only the last extension (.json); strip the remaining .wb suffix too.
  const stem = parsed.name.replace(/\.wb$/i, '')
  const thumbnailRelative = join(parsed.dir, `${stem}.jpg`)
  return join(workspaceRoot, THUMBS_DIRECTORY_NAME, thumbnailRelative)
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Writes a thumbnail from a JPEG data URL (data:image/jpeg;base64,...).
 * Creates the .wbthumbs directory if needed.
 * Throws on write failure — callers should log and swallow.
 */
export async function writeThumbnail(
  boardPath: string,
  workspaceRoot: string,
  dataUrl: string
): Promise<void> {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')
  const thumbnailPath = deriveThumbnailPath(boardPath, workspaceRoot)
  await mkdir(join(workspaceRoot, THUMBS_DIRECTORY_NAME), { recursive: true })
  await writeFile(thumbnailPath, buffer)
}

/**
 * Deletes the thumbnail for a board. Silently no-ops if it does not exist.
 */
export async function discardThumbnail(boardPath: string, workspaceRoot: string): Promise<void> {
  const thumbnailPath = deriveThumbnailPath(boardPath, workspaceRoot)
  try {
    await unlink(thumbnailPath)
  } catch {
    // Missing thumbnail is expected — not an error.
  }
}

/**
 * Returns a wloc: URI for the board's thumbnail if it exists, null otherwise.
 * The path is relative to the workspace root so the renderer protocol handler
 * can serve it without needing a raw file:// URL.
 */
export async function getThumbnailUri(
  boardPath: string,
  workspaceRoot: string
): Promise<string | null> {
  const thumbnailPath = deriveThumbnailPath(boardPath, workspaceRoot)
  if (!(await pathExists(thumbnailPath))) return null
  const relPath = relative(workspaceRoot, thumbnailPath).replace(/\\/g, '/')
  return `wloc:${relPath}`
}
