import { BloomFilter } from '../../filters/bloom'
import { formatBits, formatCount, CountArg, BitsArg } from '../utils/utils'
import { Command, Options, Validation, command, metadata, option, param, params } from 'clime'

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
  description: 'calculates filter tuning parameters to optimize storage size, element capacity, and error rate',
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
