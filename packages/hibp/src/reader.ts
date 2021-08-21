import { promises as fs } from 'fs'

// Stream is an abstraction of the file interface supporting reads.
export type Stream = Pick<fs.FileHandle, "read">

export interface HibpHashCountEntry {
  hash: Buffer
  count: number
}

export enum ParseError {
  InvalidEntry = 'invalid entry',
  EndOfBuffer = 'end of buffer'
}

/**
 * Reader to process the HIBP password files in ordered-by-count text format.
 */
export class HibpOrderedByCountReader {
  // Chunk size in bytes controls how many bytes are read from the stream at a time.
  private static readonly chunkSize = 16 * 1024 // 16 KiB

  /**
  * Parse reads a single entry from the head of the buffer, then returns a
  * slice of the given buffer with the remaining data. If the buffer does not
  * contain a valid entry starting at position 0, an error will be returned.
  */
  static parse(buffer: Buffer): { entry?: HibpHashCountEntry, error?: ParseError, tail: Buffer } {
    const eol = buffer.indexOf('\n')
    if (eol < 0) {
      return { error: ParseError.EndOfBuffer, tail: buffer }
    }

    // Slice the buffer into the head, as the first line, and tail, excluding the newline.
    const [head, tail] = [buffer.slice(0, eol), buffer.slice(eol+1)]

    // Allow for empty lines by recursively calling the parse function.
    if (head.length === 0) {
      return HibpOrderedByCountReader.parse(tail)
    }

    // Encoded entry must be at least 42 bytes: 40 bytes for hex-encoded hash,
    // 1 for a colon, and 1 for at least 1 digit. UTF-8 58 = ':'.
    if (head.length < 42 || head[40] !== 58) {
      return { error: ParseError.InvalidEntry, tail }
    }
    
    const hash = Buffer.from(head.slice(0, 40).toString(), 'hex')
    if (hash.length !== 20) {
      return { error: ParseError.InvalidEntry, tail }
    }

    const count = parseInt(head.slice(41).toString(), 10)
    if (isNaN(count) || count < 0) {
      return { error: ParseError.InvalidEntry, tail }
    }
    
    return { entry: {hash, count}, tail }
  }

  /**
  * Read yields a list of HIBP password entries from the given stream.
  *
  * @remarks If an invalid entry is ecountered, and error will be yielded. If the caller wishes to
  * continue processing the file, they may discard the error and attempt to read the next entry.
  */
  static async *read(stream: Stream): AsyncGenerator<{entry?: HibpHashCountEntry, error?: ParseError}> {
    const buffer = Buffer.alloc(this.chunkSize)
    let offset = 0
    while (true) {
      // Read into the buffer a chunk of data, writing it starting at the
      // offset, which marked the first available byte.
      // Note: Providing length because Node does not consistent read otherwise.
      const { bytesRead } = await stream.read(buffer, offset, buffer.length - offset)
      if (bytesRead === 0) {
        break
      }
      offset += bytesRead

      // Iteratively parse all complete entries currently in the buffer.
      let slice = buffer.slice(0, offset)
      do {
        const { entry, error, tail } = HibpOrderedByCountReader.parse(slice)
        slice = tail
        if (error === ParseError.EndOfBuffer) {
          break
        }
        yield { entry, error }
      } while (slice.length > 0);
      
      // Copy any remaining (incomplete) entries to the start of the buffer and adjust the offset.
      slice.copy(buffer)
      offset = slice.length
    }

    // If any data is leftover in the buffer, then an invalid entry exists at the end of the file.
    if (offset !== 0) {
      yield { error: ParseError.InvalidEntry }
    }
  }
}

/**
 * BufferStream implements the Stream interface wrapping a Buffer.
 */
export class BufferStream {
  private position = 0

  constructor(
    readonly buffer: Buffer
  ) {}

  async read<TBuffer extends Uint8Array>(buffer?: TBuffer, offset?: number | null,  length?: number | null, position?: number | null): Promise<{ bytesRead: number, buffer: TBuffer }> {
    const out = buffer ?? Buffer.alloc(Math.min(this.buffer.length - this.position, length ?? Infinity))
    const start = position ?? this.position
    const end = Math.min(
      start + out.length - (offset ?? 0),
      this.buffer.length
    )
    this.buffer.copy(out, offset ?? 0, start, end)

    // Do not adjust internal position if position arg is provided.
    // Matches behavior of fs API https://nodejs.org/api/fs.html#fs_filehandle_read_options
    if (position === undefined || position === null) {
      this.position = end
    }
    return { bytesRead: end - start, buffer: out as TBuffer}
  }
}

