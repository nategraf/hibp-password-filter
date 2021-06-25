import { BloomFilter } from '../../filters/bloom'
import { FileStorage } from '../../filters/file'
import { Command, ExpectedError, Options, Validation, Castable, command, metadata, option, param } from 'clime'

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
    const hash = 

    // Allocate a mutable
    const filter = await MutableBloomFilter.create(bloomOptions, BufferStorage)
    const input = await fs.open(options.in.fullName, 'r')

    for await (const { entry, error } of HibpOrderedByCountReader.read(input)) {
      if (bloomOptions.n !== undefined && filter.n >= bloomOptions.n) {
        console.warn(`Reached max capacity of ${bloomOptions.n}, skipping remaining entries`)
        break
      }
      if (error !== undefined) {
        throw new ExpectedError(`Error reading input file: ${error}`)
      }
      if (entry?.hash === undefined) {
        throw new Error(`Reader returned no error and no entry`)
      }

      await filter.add(entry.hash)
    }
    console.log(`Built a bloom filter with ${filter.n} entries and an error rate of ${filter.epsilon()}`)

    // Write the contents of the file in memory to disk.
    await fs.writeFile(options.out.fullName, filter.storage.buffer)
  }
}
