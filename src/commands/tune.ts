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

/**
* Format bits as human-readable text.
* 
* @param bits Number of bits.
* @param si True to use metric (SI) units, aka powers of 1000. False to use 
*           binary (IEC), aka powers of 1024.
* @param dp Number of decimal places to display.
* 
* @return Formatted string.
*
* @remarks Originally by @mpen on StackOverflow https://stackoverflow.com/a/14919494
*/
function formatBits(bits: number, si=false, dp=2): string {
  const threshold = si ? 1000 : 1024

  if (Math.abs(bits) < 8) {
    return bits + ' b'
  }

  let size = bits / 8
  if (Math.abs(size) < threshold) {
    return size + ' B'
  }

  const units = si 
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] 
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
  let u = -1
  const r = 10**dp

  do {
    size /= threshold
    ++u
  } while (Math.round(Math.abs(size) * r) / r >= threshold && u < units.length - 1)


  return size.toFixed(dp) + ' ' + units[u]
}

/**
* Format count as human-readable text.
* 
* @param count Number of objects.
* @param dp Number of decimal places to display.
* 
* @return Formatted string.
*
* @remarks Originally by @mpen on StackOverflow https://stackoverflow.com/a/14919494
*/
function formatCount(count: number, dp=2): string {
  const threshold = 1000

  if (Math.abs(count) < threshold) {
    return count.toString()
  }

  const units = ['k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
  let u = -1
  const r = 10**dp

  do {
    count /= threshold
    ++u
  } while (Math.round(Math.abs(count) * r) / r >= threshold && u < units.length - 1)


  return count.toFixed(dp) + units[u]
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
    Capacity:     ${n && formatCount(n)}
    Hashes:       ${k}
    Error rate:   ${epsilon}
    `.trim().replace(/^\s+/gm, '')
  }
}
