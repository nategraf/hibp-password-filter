import { MutableFilter } from './filter'
import { SetFilter } from './set'
import { MutableBloomFilter } from './bloom'
import { BufferStorage } from './buffer'

const testFilters = {
  'SetFilter': () => { return new SetFilter() },
  'MutableBloomFilter{m: 1024, k: 3}': () => { return new MutableBloomFilter(1024, 3, new BufferStorage(1024/8)) },
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
