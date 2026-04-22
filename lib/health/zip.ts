import yauzl from 'yauzl'
import { Readable } from 'stream'

/**
 * Opens an Apple Health export ZIP and returns a Readable stream of the
 * `export.xml` contents. Does NOT read the whole archive into memory —
 * yauzl seeks to the central directory and streams only the selected entry.
 */
export function openExportXmlFromZip(zipPath: string): Promise<Readable> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: false }, (err, zip) => {
      if (err) return reject(err)
      if (!zip) return reject(new Error('Failed to open zip'))

      let found = false
      zip.on('entry', (entry) => {
        // Apple Health exports place export.xml inside apple_health_export/
        if (/(^|\/)export\.xml$/.test(entry.fileName)) {
          found = true
          zip.openReadStream(entry, (streamErr, stream) => {
            if (streamErr || !stream) {
              zip.close()
              return reject(streamErr ?? new Error('No stream'))
            }
            stream.on('end', () => zip.close())
            stream.on('error', () => zip.close())
            resolve(stream)
          })
          return
        }
        zip.readEntry()
      })

      zip.on('end', () => {
        if (!found) {
          zip.close()
          reject(new Error('export.xml not found in archive'))
        }
      })

      zip.on('error', (zipErr) => {
        zip.close()
        reject(zipErr)
      })

      zip.readEntry()
    })
  })
}
