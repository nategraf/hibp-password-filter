import { BloomFilter, FileStorage } from '@victorgraf/password-filters'
import { formatBits, formatCount } from '../utils/utils'
import { Command, Castable, command, metadata, param } from 'clime'

@command({
  description: 'display metadata (size, capacity, hashes, and error rate) for a given filter file',
  brief:'show the metadata for a given filter file'
})
export default class extends Command {
  @metadata
  async execute(
    @param({
      description: 'file storing the bloom filter to query',
      required: true,
    })
    file: Castable.File,
  ) {
    const filter = await BloomFilter.from(await FileStorage.open(file.fullName))

    return `
    Storage size: ${formatBits(filter.m)}
    Capacity:     ${formatCount(filter.n)}
    Hashes:       ${filter.k}
    Error rate:   ${filter.epsilon()}
    `.trim().replace(/^\s+/gm, '')
  }
}
