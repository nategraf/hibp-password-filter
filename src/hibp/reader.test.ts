import { HibpOrderedByCountReader, ParseError, Stream } from './reader'

class BufferStream {
  private position = 0

  constructor(
    readonly buffer: Buffer
  ) {}

  async read(buffer?: Buffer, offset?: number, length?: number, position?: number): Promise<{ bytesRead: number, buffer: Buffer }> {
    const out = buffer ?? Buffer.alloc(this.buffer.length - this.position) 
    const start = position ?? this.position
    const end = start + out.length - (offset ?? 0)
    this.buffer.copy(out, offset, start, end)

    // Do not adjust internal position if position arg is provided.
    // Matches behavior of fs API https://nodejs.org/api/fs.html#fs_filehandle_read_options
    if (position !== undefined) {
      this.position = end
    }
    return { bytesRead: end - start, buffer: out }
  }
}

describe('HibpOrderedByCountReader', () => {
  describe('#parse', () => {
    it('should correctly parse a single valid entry', async () => {
      const result = HibpOrderedByCountReader.parse(
        Buffer.from('4D8B4D6E78C7A1679BCF58B4E37FF35F623C2B56:314162\n')
      )
      expect(result).toMatchObject({
        entry: {
          hash: Buffer.from('4D8B4D6E78C7A1679BCF58B4E37FF35F623C2B56', 'hex'),
          count: 314162
        },
      })
      expect(result.tail.length).toBe(0)
      expect(result.error).toBeUndefined()
    })

    it('should correctly parse a single entry with extra newlines', async () => {
      const result = HibpOrderedByCountReader.parse(
        Buffer.from('\n\n\n4D8B4D6E78C7A1679BCF58B4E37FF35F623C2B56:314162\n\n')
      )
      expect(result).toMatchObject({
        entry: {
          hash: Buffer.from('4D8B4D6E78C7A1679BCF58B4E37FF35F623C2B56', 'hex'),
          count: 314162
        },
      })
      expect(result.tail.toString()).toEqual('\n')
      expect(result.error).toBeUndefined()
    })

    it('should correctly parse the first entry of a list and return the tail', async () => {
      const result = HibpOrderedByCountReader.parse(
        Buffer.from('4D8B4D6E78C7A1679BCF58B4E37FF35F623C2B56:314162\n4F26AEAFDB2367620A393C973EDDBE8F8B846EBD:330531\n')
      )
      expect(result).toMatchObject({
        entry: {
          hash: Buffer.from('4D8B4D6E78C7A1679BCF58B4E37FF35F623C2B56', 'hex'),
          count: 314162
        },
      })
      expect(result.tail.toString()).toEqual('4F26AEAFDB2367620A393C973EDDBE8F8B846EBD:330531\n')
      expect(result.error).toBeUndefined()
    })

    it('should return end of buffer error on empty  buffer', async () => {
      const result = HibpOrderedByCountReader.parse(
        Buffer.from('')
      )
      expect(result).toMatchObject({
        error: ParseError.EndOfBuffer
      })
      expect(result.tail.length).toBe(0)
      expect(result.entry).toBeUndefined()
    })

    it('should return end of buffer error on newline buffer', async () => {
      const result = HibpOrderedByCountReader.parse(
        Buffer.from('\n')
      )
      expect(result).toMatchObject({
        error: ParseError.EndOfBuffer
      })

      // Leading newlines are to be stripped from the buffer.
      expect(result.tail.length).toBe(0)
      expect(result.entry).toBeUndefined()
    })

    it('should return end of buffer error on incomplete entry', async () => {
      // Total length of the buffer is 48. Any leading substring without the
      // newline should result in an end of buffer error.
      const buffer = Buffer.from('4F26AEAFDB2367620A393C973EDDBE8F8B846EBD:330531\n')
      for (const offset of [0, 1, 10, 40, 41, 42, 47]) {
        const result = HibpOrderedByCountReader.parse(
          buffer.slice(0, offset)
        )
        expect(result).toMatchObject({
          error: ParseError.EndOfBuffer
        })

        expect(result.tail.toString()).toEqual(buffer.slice(0, offset).toString())
        expect(result.entry).toBeUndefined()
      }
    })

    it('should return invalid entry error on shortened hash', async () => {
      const result = HibpOrderedByCountReader.parse(
        Buffer.from('4F26AEAFDB2367620A393C9:330531\n')
      )
      expect(result).toMatchObject({
        error: ParseError.InvalidEntry
      })

      expect(result.tail.length).toBe(0)
      expect(result.entry).toBeUndefined()
    })

    it('should return invalid entry error on malformed hash', async () => {
      const result = HibpOrderedByCountReader.parse(
        Buffer.from('4F26AEAFDB2367620A393XXX3EDDBE8F8B846EBD:330531\n')
      )
      expect(result).toMatchObject({
        error: ParseError.InvalidEntry
      })

      expect(result.tail.length).toBe(0)
      expect(result.entry).toBeUndefined()
    })

    it('should return invalid entry error on malformed count', async () => {
      const result = HibpOrderedByCountReader.parse(
        Buffer.from('4F26AEAFDB2367620A393XXX3EDDBE8F8B846EBD:33k\n')
      )
      expect(result).toMatchObject({
        error: ParseError.InvalidEntry
      })

      expect(result.tail.length).toBe(0)
      expect(result.entry).toBeUndefined()
    })
  })
})
