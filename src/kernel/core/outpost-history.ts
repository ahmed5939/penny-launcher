export type CloudSaveFile = {
  filename: string
  uploaded?: string
}

export type OutpostSaveRecord = {
  lastModified?: string
  recordFilename?: string
}

/** The two rolling archive filenames share a zone-specific stem. */
function archiveStem(filename: string) {
  return filename.replace(/_[^_]+_[^_]+\.sav$/i, '')
}

export function availableOutpostSaves(
  records: Array<OutpostSaveRecord>,
  cloudFiles: Array<CloudSaveFile>
) {
  const filesByName = new Map(cloudFiles.map((file) => [file.filename, file]))
  const available = new Map<string, { lastModified: string; recordFilename: string }>()

  for (const record of records) {
    const filename = record.recordFilename

    if (!filename) continue

    const stem = archiveStem(filename)
    const matches = cloudFiles.filter((file) =>
      file.filename === filename ||
      (stem !== filename && archiveStem(file.filename) === stem)
    )

    for (const file of matches) {
      const date = file.uploaded ?? record.lastModified

      if (date && !Number.isNaN(Date.parse(date))) {
        available.set(file.filename, {
          lastModified: date,
          recordFilename: file.filename,
        })
      }
    }

    if (!available.has(filename)) {
      const date = filesByName.get(filename)?.uploaded ?? record.lastModified

      if (date && !Number.isNaN(Date.parse(date))) {
        available.set(filename, { lastModified: date, recordFilename: filename })
      }
    }
  }

  return [...available.values()].sort((a, b) =>
    a.lastModified.localeCompare(b.lastModified)
  )
}
