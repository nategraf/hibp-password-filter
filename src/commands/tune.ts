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

const formatBits = (bits: number) => {
  if (bits < 256) {
    return `${bits} bits`
  }

  const bytes = bits / 8
  if (bytes < 4096) {
    return `${bytes} B`
  }

  const kilobytes = bytes / 1024
  if (kilobytes < 4096) {
    return `${kilobytes} KiB`
  }

  const megabytes = kilobytes / 1024
  if (megabytes < 4096) {
    return `${megabytes} MiB`
  }

  const gigabytes = megabytes / 1024
  return `${gigabytes} GiB`
}

@command({
  description: 'calculates filter tuning parameters to optimize storage size, element capacity, and error rate'
})
export default class extends Command {
  @metadata
  execute(
    options: TuneOptions
  ) {
    const { m, k, n, epsilon } = BloomFilter.populateOptions({
      m: options.size,
      k: options.hashes,
      n: options.capacity,
      epsilon: options.epsilon
    })

    return `
    Storage size: ${formatBits(m)}
    Capacity:     ${n}
    Hashes:       ${k}
    Error rate:   ${epsilon}
    `.trim().replace(/^\s+/gm, '')
  }
}
