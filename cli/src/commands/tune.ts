import { BloomFilter } from '@victorgraf/password-filters'
import { formatBits, formatCount, CountArg, BitsArg } from '../utils/utils'
import { Command, Options, Validation, command, metadata, option } from 'clime'

export class TuneOptions extends Options {
  @option({
    flag: 'n',
    description: 'number of passwords to be stored in the filter',
  })
  capacity?: CountArg

  @option({
    flag: 'm',
    description: 'number of bits to use for the filter',
  })
  size?: BitsArg

  @option({
    flag: 'k',
    validator: Validation.integer,
    description: 'number of hash functions to use for the bloom filter.',
  })
  hashes?: number

  @option({
    flag: 'e',
    validator: Validation.range(0, 1),
    description: 'maximum allowable false positive rate for the filter',
  })
  epsilon?: number
}

@command({
  description: `
Calculates filter tuning parameters to optimize storage size, element capacity, and error rate.
Use this command to determine remaining parameters given your requirements.

Examples:

// Determine the storage requirement for a filter with 100k passwords and an error rate of 1%.
tune -n 100k -e 0.01

// Determine the error rate of a filter with 1M passwords and size of 5 MiB.
tune -n 1M -m 5MiB

// Determine how many passwords a 100 KiB filter can hold with a 1% error rate.
tune -m '100 KiB' -e 0.01
`.trim(),
  brief:'tune parameters for building a filter'
})
export default class extends Command {
  @metadata
  execute(
    options: TuneOptions
  ) {
    const { m, k, n, epsilon } = BloomFilter.populateOptions({
      m: options.size?.bits,
      n: options.capacity?.count,
      k: options.hashes,
      epsilon: options.epsilon
    })

    return `
    Storage size: ${formatBits(m)}
    Capacity:     ${n && formatCount(n)}
    Hashes:       ${k}
    Error rate:   ${epsilon}
    `.trim().replace(/^\s+/gm, '')
  }
}
