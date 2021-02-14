import { MutableFilter } from './filter'
import { SetFilter } from './set'
import { BloomFilter } from './bloom'

const testFilters = {
  'SetFilter': () => { return new SetFilter() },
  'BloomFilter{m: 1024, k: 3}': () => { return new BloomFilter(1024, 3) },
}

for (const [key, constructor] of Object.entries(testFilters)) {
  describe(key, () => {
    describe('when loaded with basic elements', () => {
      let filter: MutableFilter

      beforeAll(async () => {
        filter = constructor()
        await filter.add(Buffer.from("penguin"))
        await filter.add(Buffer.from("horse"))
        await filter.add(Buffer.from("mongoose"))
      })

      it('correctly reports inclusion', async () => {
        expect(await filter.has(Buffer.from("penguin"))).toBe(true)
        expect(await filter.has(Buffer.from("horse"))).toBe(true)
        expect(await filter.has(Buffer.from("mongoose"))).toBe(true)
      })

      it('correctly reports exclusion', async () => {
        expect(await filter.has(Buffer.from("zebra"))).toBe(false)
      })
    })

    for (const load of [0, 10, 100, 1000]) {
      let filter: MutableFilter

      describe(`when loaded with ${load} elements`,  () => {
        beforeAll(async () => {
          filter = constructor()
          for (let i = 0; i < load; i++) {
            await filter.add(Buffer.from(`Item ${i}`))
          }
        })

        it('correctly reports inclusion', async () => {
          for (let i = 0; i < load; i++) {
            expect(await filter.has(Buffer.from(`Item ${i}`))).toBe(true)
          }
        })

        it('correctly reports exclusion', async () => {
          expect(await filter.has(Buffer.from(`Excluded item`))).toBe(false)
        })
      })
    }
  })

}
