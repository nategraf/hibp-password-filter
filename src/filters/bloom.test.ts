import { MutableBloomFilter, BloomFilter, BloomFilterOptions } from './bloom'
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
    filter = await MutableBloomFilter.create({ m: 20 * 1024, k: 4 }, BufferStorage)
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

  describe('#populateOptions', () => {
    const bitmaps: boolean[][] = [...Array(16).keys()].map((i) => [i & 1, i & 2, i & 4, i & 8].map((i) => !!i))
    const testOptions: BloomFilterOptions = { m: 1024, k: 3, n: 100, epsilon: 0.05 }

    for (const bitmap of bitmaps) {
      describe(`when { ${['m', 'k', 'n', 'epsilon'].filter((_, i) => bitmap[i]).join(', ')} } is provided`, () => {
        const [mSet, kSet, nSet, epsilonSet] = bitmap
        const options: Partial<BloomFilterOptions> = {
          m: mSet ? testOptions.m : undefined,
          k: kSet ? testOptions.k : undefined,
          n: nSet ? testOptions.n : undefined,
          epsilon: epsilonSet ? testOptions.epsilon : undefined
        }

        // Test for cases where not enough parameters have been provided.
        if (!((mSet && (kSet || nSet || epsilonSet)) || (nSet && epsilonSet))) {
          it('throws an error indicating incomplete specification', () => {
            expect(() => {
              BloomFilter.populateOptions(options)
            }).toThrow(/incomplete specification/)
          })
          return
        }

        const result = BloomFilter.populateOptions(options)

        // If either n or epsilon are provided, the other should be inferred in.
        if (nSet || epsilonSet) {
          it('should provide values for n and epsilon', () => {
            expect(result.n).toBeDefined()
            expect(result.epsilon).toBeDefined()
          })
        }

        if (mSet) {
          it('should not change m', () => {
            expect(result.m).toBe(options.m)
          })
        } else {
          it('should choose a minimal m, rounded up to the nearest byte', () => {
            // If m is not set, epsilon must be set. Use it check the value of m.
            expect(
              BloomFilter.epsilonWith({
                m: Math.floor(result.m/8 - 1) * 8,
                k: result.k,
                n: result.n!
              })
            ).toBeGreaterThan(options.epsilon!)
          })
        }

        if (kSet) {
          it('should not change k', () => {
            expect(result.k).toBe(options.k)
          })
        } else {
          it('should choose the optimal value for k', () => {
            // Increasing k should increase epsilon
            expect(
              BloomFilter.epsilonWith({
                m: result.m,
                k: result.k,
                n: result.n ?? 100
              })
            ).toBeLessThan(
              BloomFilter.epsilonWith({
                m: result.m,
                k: result.k + 1,
                n: result.n ?? 100
              })
            )

            // Decreasing k should increase epsilon
            expect(
              BloomFilter.epsilonWith({
                m: result.m,
                k: result.k,
                n: result.n ?? 100
              })
            ).toBeLessThan(
              BloomFilter.epsilonWith({
                m: result.m,
                k: result.k - 1,
                n: result.n ?? 100
              })
            )
          })
        }

        if (nSet) {
          it('should not change n', () => {
            expect(result.n).toBe(options.n)
          })
        } else if (epsilonSet) {
          it('should choose a maximal n', () => {
            expect(
              BloomFilter.epsilonWith({
                m: result.m,
                k: result.k,
                n: result.n! + 1
              })
            ).toBeGreaterThan(options.epsilon!)
          })
        }

        if (epsilonSet) {
          it('should not change epsilon', () => {
            expect(result.epsilon).toBe(options.epsilon)
          })
        } else if (nSet) {
          it('should be calculated from the other options', () => {
            expect(
              result.epsilon!
            ).toEqual(
              BloomFilter.epsilonWith({
                m: result.m,
                k: result.k,
                n: result.n!
              })
            )
          })
        }
      })
    }

    describe('when inconsistent { m, n, epsilon } are provided', () => {
      it('should throw an inconsistent options error', () => {
        expect(() => {
          BloomFilter.populateOptions({ m: 1024, n: 200, epsilon: 0.05 })
        }).toThrow(/parameters are inconsistent/)
      })
    })

    describe('when inconsistent { m, k, n, epsilon } are provided', () => {
      it('should throw an inconsistent options error', () => {
        expect(() => {
          BloomFilter.populateOptions({ m: 1024, k: 30, n: 100, epsilon: 0.05 })
        }).toThrow(/parameters are inconsistent/)
      })
    })
  })
})
