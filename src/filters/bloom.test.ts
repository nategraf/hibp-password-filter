import { MutableBloomFilter, BloomFilter } from './bloom'
import { BufferStorage } from './buffer'
import { FileStorage } from './file'
import { promises as fs } from 'fs'
import * as path from 'path'

const TEST_DATA_DIR = path.resolve(__dirname, '__test__/bloom.test.ts/')

beforeAll(async () => {
  await fs.mkdir(TEST_DATA_DIR, { recursive: true })
})

describe('BloomFilter', () => {
  const load = 1000
  let filter: MutableBloomFilter<BufferStorage>

  beforeAll(async () => {
    // Create a new filter and populate it with some basic elements.
    filter = await MutableBloomFilter.create(20 * 1024, 4, BufferStorage)
    for (let i = 0; i < load; i++) {
      await filter.add(Buffer.from(`Item ${i}`))
    }
  })

  it('should be possible to create from populated buffer storage', async () => {
    const copyBuffer = Buffer.alloc(filter.storage.size)
    filter.storage.buffer.copy(copyBuffer)
    const copy = await BloomFilter.from(BufferStorage.from(copyBuffer))

    // Expect all metadata parameters to be populated.
    expect(copy.n).toBe(filter.n)
    expect(copy.m).toBe(filter.m)
    expect(copy.k).toBe(filter.k)

    // Reports the same (possible) inclusions and exclusions.
    // NOTE: Both may have false positives, but they should agree.
    for (let i = 0; i < load; i++) {
      const item = Buffer.from(`Item ${i}`)
      expect(await filter.has(item)).toBe(await copy.has(item))
    }

    for (let i = 0; i < load; i++) {
      const item = Buffer.from(`Excluded item ${i}`)
      expect(await filter.has(item)).toBe(await copy.has(item))
    }
  })

  it('should be possible to create from populated file storage', async () => {
    // Write the Bloom filter buffer to disk, then open it as a bloom filter.
    const filepath = path.resolve(TEST_DATA_DIR, 'bloom.filter')
    await fs.writeFile(filepath, filter.storage.buffer)
    const copy = await BloomFilter.from(await FileStorage.open(filepath))

    // Expect all metadata parameters to be populated.
    expect(copy.n).toBe(filter.n)
    expect(copy.m).toBe(filter.m)
    expect(copy.k).toBe(filter.k)

    // Reports the same (possible) inclusions and exclusions.
    // NOTE: Both may have false positives, but they should agree.
    for (let i = 0; i < load; i++) {
      const item = Buffer.from(`Item ${i}`)
      expect(await filter.has(item)).toBe(await copy.has(item))
    }

    for (let i = 0; i < load; i++) {
      const item = Buffer.from(`Excluded item ${i}`)
      expect(await filter.has(item)).toBe(await copy.has(item))
    }
  })
})
