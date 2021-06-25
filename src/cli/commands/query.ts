import { BloomFilter } from '../../filters/bloom'
import { FileStorage } from '../../filters/file'
import { Command, ExpectedError, Options, Validation, Castable, command, metadata, option, param } from 'clime'
import * as crypto from 'crypto'

export class QueryOptions extends Options {
  @option({
    flag: 'f',
    description: 'file storing the bloom filter to query',
    required: true,
  })
  file: Castable.File
}

@command({
  description: 'TODO',
  brief:'TODO'
})
export default class extends Command {
  @metadata
  async execute(
    @param({
      description: 'password string to query in the filter',
      required: true
    })
    query: string,
    options: QueryOptions
  ) {
    // Assert that the filter file exsits.
    await options.file.assert()
    const filter = await BloomFilter.from(await FileStorage.open(options.file.fullName))
    const hash = crypto.createHash('sha1').update(query).digest()
    return await filter.has(hash)
  }
}
