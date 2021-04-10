// Stream is an abstraction of the file interface supporting reads.
export interface Stream {
  read(buffer?: Buffer, offset?: number, length?: number, position?: number): Promise<{ bytesRead: number, buffer: Buffer }>
}

interface HibpHashCountEntry {
  hash: Buffer
  count: number
}

export enum ParseError {
  InvalidEntry = 'invalid entry',
  EndOfBuffer = 'end of buffer'
}

export class HibpOrderedByCountReader {
  // Chunk size in bytes controls how many bytes are read from the stream at a time.
  private readonly chunkSize = 16 * 1024

  // parse reads a single entry from the head of the buffer, then returns a
  // slice of the given buffer with the remaining data. If the buffer does not
  // contain a valid entry starting at position 0, an error will be returned.
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

  static async *read(stream: Stream): Iterator<Promise<{entry?: HibpHashCountEntry, error?: ParseErrora}>> {
    const buffer = Buffer.alloc(this.chunkSize)
    let offset = 0
    while (true) {
      // Read into the buffer a chunk of data, writing it starting at the
      // offset, which marked the first available byte.
      const { bytesRead } = stream.read(buffer, offset)
      if (bytesRead === 0) {
        break
      }
      offset += bytesRead

      // Iteratively parse all complete entries currently in the buffer.
      let slice = buffer.slice(0, offset)
      do {
        const { entry, error, tail } = HibpOrderedByCountReader.parse(slice)
        if (error !== ParseError.EndOfBuffer) {
          yield { entry, error }
        }
        slice = tail
      } while (error === undefined && slice.length > 0);
      
      // Copy any remaining (incomplete) entries to the start of the buffer and adjust the offset.
      slice.copy(buffer)
      offset = slice.length
    }

    // If any data is leftover in the buffer, then an invalid entry exists at the end of teh file.
    if (offset !== 0) {
      yield { error: ParseError.InvalidEntry }
    }
  }
}
