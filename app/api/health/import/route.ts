import { NextResponse } from 'next/server'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { openExportXmlFromZip } from '@/lib/health/zip'
import { importHealthXml } from '@/lib/health/import'

// Allow large uploads — Apple Health exports are routinely 1–2 GB
export const runtime = 'nodejs'
export const maxDuration = 600 // 10 minutes

export async function POST(req: Request) {
  if (!req.body) {
    return NextResponse.json({ ok: false, error: 'No body' }, { status: 400 })
  }

  const tempPath = path.join(os.tmpdir(), `niteflow-upload-${Date.now()}.zip`)

  try {
    // Stream the raw request body to a temp file (avoids loading into memory)
    const ws = fs.createWriteStream(tempPath)
    await pipeline(Readable.fromWeb(req.body as never), ws)

    // Handle both .zip and raw .xml uploads based on magic bytes
    const fd = fs.openSync(tempPath, 'r')
    const header = Buffer.alloc(4)
    fs.readSync(fd, header, 0, 4, 0)
    fs.closeSync(fd)

    const isZip = header[0] === 0x50 && header[1] === 0x4b
    const xmlStream = isZip
      ? await openExportXmlFromZip(tempPath)
      : fs.createReadStream(tempPath)

    const summary = await importHealthXml(xmlStream)

    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    console.error('[health/import]', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  } finally {
    fs.promises.unlink(tempPath).catch(() => {})
  }
}
