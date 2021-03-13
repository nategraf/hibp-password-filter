import { MutableBloomFilter, BloomFilter } from './bloom'

describe('BloomFilter', () => {
  const load = 1000
  let filter: MutableBloomFilter

  beforeAll(async () => {
    // Create a new filter and populate it with some basic elements.
    filter = await MutableBloomFilter.create(20 * 1024, 4)
    for (let i = 0; i < load; i++) {
      await filter.add(Buffer.from(`Item ${i}`))
    }
  })

  it('should be possible to create from populated buffer storage', async () => {
    const view = await BloomFilter.from(filter.storage)

    // Expect all metadata parameters to be populated.
    expect(view.n).toBe(filter.n)
    expect(view.m).toBe(filter.m)
    expect(view.k).toBe(filter.k)

    // Reports the same (possible) inclusions and exclusions.
    // NOTE: Both may have false positives, but they should agree.
    for (let i = 0; i < load; i++) {
      const item = Buffer.from(`Item ${i}`)
      expect(await filter.has(item)).toBe(await view.has(item))
    }

    for (let i = 0; i < load; i++) {
      const item = Buffer.from(`Excluded item ${i}`)
      expect(await filter.has(item)).toBe(await view.has(item))
    }
  })
})
