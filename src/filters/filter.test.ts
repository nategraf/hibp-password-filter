import { MutableFilter } from './filter'
import { SetFilter } from './set'
import { MutableBloomFilter } from './bloom'
import { FileAllocator } from './file'
import { BufferStorage } from './buffer'
import { promises as fs } from 'fs'
import * as path from 'path'

const TEST_DATA_DIR = path.resolve(__dirname, '__test__/filter.test.ts/')

beforeAll(async () => {
  await fs.mkdir(TEST_DATA_DIR, { recursive: true })
})


const testFilters = {
  'SetFilter': () => {
    return new SetFilter()
  },
  'MutableBloomFilter<BufferStorage>{m: 1024, k: 3}': () => {
    return MutableBloomFilter.create(1024, 3)
  },
  'MutableBloomFilter<MutableFileStorage>{m: 1024, k: 3}': () => {
    const allocator = new FileAllocator(path.resolve(TEST_DATA_DIR, 'bloom.filter'), { mode: 'w+' })
    return MutableBloomFilter.create(1024, 3, allocator)
  }
}

// Estimator confidence in number of standard deviations.
// 3.3 ~= 99.9% confidence (i.e. test may return false result 1 in 1000 times)
const TEST_ESTIMATOR_CONFIDENCE = 3.3
// Maximum number of trials to run when estimating false positive rate.
const TEST_ESTIMATOR_MAX_TRIALS = 1000

expect.extend({
  toBeWithinTolerance(observed: number, expected: number, tolerance: number) {
    const pass = Math.abs(observed - expected) <= tolerance
    return {
      message: () =>
        `expected ${observed} to be ${pass ? 'outside' : 'inside'} range ${expected} +- ${tolerance}`,
      pass,
    }
  }
})

for (const [key, constructor] of Object.entries(testFilters)) {
  describe(key, () => {
    describe('when loaded with basic elements', () => {
      let filter: MutableFilter

      beforeAll(async () => {
        filter = await constructor()
        await filter.add(Buffer.from("penguin"))
        await filter.add(Buffer.from("horse"))
        await filter.add(Buffer.from("mongoose"))
      })

      it('correctly reports inclusion', async () => {
        expect(await filter.has(Buffer.from("penguin"))).toBe(true)
        expect(await filter.has(Buffer.from("horse"))).toBe(true)
        expect(await filter.has(Buffer.from("mongoose"))).toBe(true)
      })
    })

    for (const load of [0, 10, 100, 1000]) {
      let filter: MutableFilter

      describe(`when loaded with ${load} elements`,  () => {
        beforeAll(async () => {
          filter = await constructor()
          for (let i = 0; i < load; i++) {
            await filter.add(Buffer.from(`Item ${i}`))
          }
        })

        it('correctly reports inclusion', async () => {
          for (let i = 0; i < load; i++) {
            expect(await filter.has(Buffer.from(`Item ${i}`))).toBe(true)
          }
        })

        it('reports an error rate value in [0.0, 1.0]', () => {
          const epsilon = filter.epsilon()
          expect(epsilon).toBeLessThanOrEqual(1.0)
          expect(epsilon).toBeGreaterThanOrEqual(0.0)
        })

        it('reports exclusion with error rate close to epsilon', async () => {
          // Using the frequentist estimator of true probability for a Bernoulli process.
          // https://en.wikipedia.org/wiki/Checking_whether_a_coin_is_fair#Estimator_of_true_probability
          const epsilon = filter.epsilon()
          const trials = TEST_ESTIMATOR_MAX_TRIALS
          const tolerance = Math.max(
            TEST_ESTIMATOR_CONFIDENCE * Math.sqrt(epsilon * (1 - epsilon) / trials),
            1/trials // Impossible to measure more accurately than the result of 1 trial.
          )

          let positives = 0
          for (let i = 0; i < trials; i++) {
            if (await filter.has(Buffer.from(`Excluded item ${i}`))) {
              positives++
            }
          }

          const estimate = positives / trials
          expect(estimate).toBeWithinTolerance(epsilon, tolerance)
        })
      })
    }
  })
}
