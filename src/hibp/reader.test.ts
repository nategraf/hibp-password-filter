import { HibpHashCountEntry, HibpOrderedByCountReader, ParseError, Stream } from './reader'

class BufferStream {
  private position = 0

  constructor(
    readonly buffer: Buffer
  ) {}

  async read(buffer?: Buffer, offset?: number, length?: number, position?: number): Promise<{ bytesRead: number, buffer: Buffer }> {
    const out = buffer ?? Buffer.alloc(this.buffer.length - this.position) 
    const start = position ?? this.position
    const end = Math.min(
      start + out.length - (offset ?? 0),
      this.buffer.length
    )
    this.buffer.copy(out, offset, start, end)

    // Do not adjust internal position if position arg is provided.
    // Matches behavior of fs API https://nodejs.org/api/fs.html#fs_filehandle_read_options
    if (position === undefined) {
      this.position = end
    }
    return { bytesRead: end - start, buffer: out }
  }
}

const validTestList = `
7C4A8D09CA3762AF61E59520943DC26494F8941B:24230577
F7C3BC1D808E04732ADF679965CCC34CA7AE3441:8012567
B1B3773A05C0ED0176787A4F1574FF0075F7521E:3993346
5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493
3D4F2BF07DC1BE38B20CD6E46949A1071F9D0E3D:3184337
7C222FB2927D828AF22F592134E8932480637C0D:3026692
6367C48DD193D56EA7B0BAAD25B19455E529F5EE:2897638
20EABE5D64B0E216796E834F52D61FD0B70332FC:2562301
8CB2237D0679CA88DB6464EAC60DA96345513964:2493390
E38AD214943DAAD1D64C102FAEC29DE4AFE9DA3D:2427158
01B307ACBA4F54F55AAFC33BB06BBBF6CA803E9A:2293209
601F1889667EFAEBB33B8C12572835DA3F027F78:2279322
C984AED014AEC7623A54F0591DA07A85FD4B762D:1992207
EE8D8728F435FD550F83852AABAB5234CE1DA528:1655692
7110EDA4D09E062AA5E4A390B0A572AC0D2C0220:1371079
B80A9AED8AF17118E51D4D0C2D7872AE26E2109E:1205102
B0399D2029F64D445BD131FFAA399A42D2F8E7DC:1117379
40BD001563085FC35165329EA1FF5C5ECBDBBEEF:1078184
AB87D24BDC7452E55738DEB5F868E1F16DEA5ACE:1000081
AF8978B1797B72ACFFF9595A5A2A373EC3D9106D:994142
`

const validTestListEntries = [
  { hash: Buffer.from('7C4A8D09CA3762AF61E59520943DC26494F8941B', 'hex'), count: 24230577 },
  { hash: Buffer.from('F7C3BC1D808E04732ADF679965CCC34CA7AE3441', 'hex'), count: 8012567 },
  { hash: Buffer.from('B1B3773A05C0ED0176787A4F1574FF0075F7521E', 'hex'), count: 3993346 },
  { hash: Buffer.from('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8', 'hex'), count: 3861493 },
  { hash: Buffer.from('3D4F2BF07DC1BE38B20CD6E46949A1071F9D0E3D', 'hex'), count: 3184337 },
  { hash: Buffer.from('7C222FB2927D828AF22F592134E8932480637C0D', 'hex'), count: 3026692 },
  { hash: Buffer.from('6367C48DD193D56EA7B0BAAD25B19455E529F5EE', 'hex'), count: 2897638 },
  { hash: Buffer.from('20EABE5D64B0E216796E834F52D61FD0B70332FC', 'hex'), count: 2562301 },
  { hash: Buffer.from('8CB2237D0679CA88DB6464EAC60DA96345513964', 'hex'), count: 2493390 },
  { hash: Buffer.from('E38AD214943DAAD1D64C102FAEC29DE4AFE9DA3D', 'hex'), count: 2427158 },
  { hash: Buffer.from('01B307ACBA4F54F55AAFC33BB06BBBF6CA803E9A', 'hex'), count: 2293209 },
  { hash: Buffer.from('601F1889667EFAEBB33B8C12572835DA3F027F78', 'hex'), count: 2279322 },
  { hash: Buffer.from('C984AED014AEC7623A54F0591DA07A85FD4B762D', 'hex'), count: 1992207 },
  { hash: Buffer.from('EE8D8728F435FD550F83852AABAB5234CE1DA528', 'hex'), count: 1655692 },
  { hash: Buffer.from('7110EDA4D09E062AA5E4A390B0A572AC0D2C0220', 'hex'), count: 1371079 },
  { hash: Buffer.from('B80A9AED8AF17118E51D4D0C2D7872AE26E2109E', 'hex'), count: 1205102 },
  { hash: Buffer.from('B0399D2029F64D445BD131FFAA399A42D2F8E7DC', 'hex'), count: 1117379 },
  { hash: Buffer.from('40BD001563085FC35165329EA1FF5C5ECBDBBEEF', 'hex'), count: 1078184 },
  { hash: Buffer.from('AB87D24BDC7452E55738DEB5F868E1F16DEA5ACE', 'hex'), count: 1000081 },
  { hash: Buffer.from('AF8978B1797B72ACFFF9595A5A2A373EC3D9106D', 'hex'), count: 994142 },
]

const malformedTestList = `
7C4A8D09CA3762AF61E59520943DC26494F8941B:24230577
F7C3BC1D808E04732ADF679965CCC34CA7AE3441:8012567
B1B3773A05C0ED0176787A4F1574FF0075F7521E:3993346
5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493
3D4F2BF07DC1BE38B20CD6E46949A1071F9D0E3D:3184337
7C222FB2927D828AF22F592134E8932480637C0D:3026692
6367C48DD193D56EA7B0BAAD25B19455E529F5EE:2897638
20EABE5D64B0E216796E834F52D61FD0B70332FC:2562301
INVALID LINE
E38AD214943DAAD1D64C102FAEC29DE4AFE9DA3D:2427158
01B307ACBA4F54F55AAFC33BB06BBBF6CA803E9A:2293209
601F1889667EFAEBB33B8C12572835DA3F027F78:2279322
C984AED014AEC7623A54F0591DA07A85FD4B762D:1992207
EE8D8728F435FD550F83852AABAB5234CE1DA528:1655692
7110EDA4D09E062AA5E4A390B0A572AC0D2C0220:1371079
B80A9AED8AF17118E51D4D0C2D7872AE26E2109E:1205102
B0399D2029F64D445BD131FFAA399A42D2F8E7DC:1117379
40BD001563085FC35165329EA1FF5C5ECBDBBEEF:1078184
AB87D24BDC7452E55738DEB5F868E1F16DEA5ACE:1000081
AF8978B1797B72ACFFF959
`

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

  describe('#read', () => {
    it('should iterate over all entries in a valid list', async () => {
      const stream = new BufferStream(Buffer.from(validTestList))
      const entries: (HibpHashCountEntry|undefined)[] = []
      for await (const { entry, error } of HibpOrderedByCountReader.read(stream)) {
        expect(error).toBeUndefined()
        entries.push(entry)
      }
      expect(entries).toEqual(validTestListEntries)
    })

    it('should report errors for entries in the invalid list', async () => {
      const stream = new BufferStream(Buffer.from(malformedTestList))
      const errors: (ParseError|undefined)[] = []
      for await (const { entry, error } of HibpOrderedByCountReader.read(stream)) {
        expect(entry === undefined).toBe(error !== undefined)
        errors.push(error)
      }
      const expected = [...Array(20).keys()].map(
        (i) => (i === 8 || i === 19) ? ParseError.InvalidEntry : undefined
      )
      expect(errors).toEqual(expected)
    })
  })
})
