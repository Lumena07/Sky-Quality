import { unlink } from 'fs/promises'
import { join } from 'path'

/** Best-effort delete for files stored under public/uploads by /api/upload. */
export const deleteLocalPublicUpload = async (fileUrl: string): Promise<void> => {
  if (!fileUrl || typeof fileUrl !== 'string' || !fileUrl.startsWith('/uploads/')) return
  try {
    const relative = fileUrl.replace(/^\//, '')
    await unlink(join(process.cwd(), 'public', relative))
  } catch {
    /* missing file or permission */
  }
}
