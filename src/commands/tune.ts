import { BloomFilter } from '../filters/bloom'
import { Command, Options, Validation, command, metadata, option, param, params } from 'clime'

export class TuneOptions extends Options {
  @option({
    flag: 'n',
    validator: Validation.integer,
    description: 'number of passwords to be stored in the filter',
  })
  capacity?: number

  @option({
    flag: 'm',
    validator: Validation.integer,
    description: 'number of bits to use for the filter',
  })
  size?: number

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
  description: 'calculates filter tuning parameters to optimize storage size, element capacity, and error rate'
})
export default class extends Command {
  @metadata
  execute(
    options: TuneOptions
  ) {
    return BloomFilter.populateOptions({
      m: options.size,
      k: options.hashes,
      n: options.capacity,
      epsilon: options.epsilon
    })
  }
}
