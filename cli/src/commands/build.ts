import { BufferStorage, MutableBloomFilter } from '@victorgraf/password-filters'
import { HibpOrderedByCountReader } from '@victorgraf/hibp-reader'
import { CountArg, BitsArg } from '../utils/utils'
import { SingleBar } from 'cli-progress'
import { Command, ExpectedError, Options, Validation, Castable, command, metadata, option } from 'clime'
import { promises as fs } from 'fs'

export class BuildOptions extends Options {
  @option({
    flag: 'i',
    description: 'source file in HIBP ordered-by-count text format',
    required: true,
  })
  in: Castable.File

  @option({
    flag: 'o',
    description: 'output file to store the built filter',
    required: true,
  })
  out: Castable.File

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
  description: 'given a HIBP password list parameters for the filter, construct a password filter',
  brief:'build a filter from a list of password hashes'
})
export default class extends Command {
  @metadata
  async execute(
    options: BuildOptions
  ) {
    // Assert that the input file exsits.
    await options.in.assert()

    const bloomOptions = MutableBloomFilter.populateOptions({
      m: options.size?.bits,
      n: options.capacity?.count,
      k: options.hashes,
      epsilon: options.epsilon
    })

    // Allocate a mutable
    const filter = await MutableBloomFilter.create(bloomOptions, BufferStorage)
    const input = await fs.open(options.in.fullName, 'r')

    // Create a progress bar to show the user. Counts up to the capacity of the filter.
    let progress: SingleBar|undefined
    if (bloomOptions.n !== undefined) {
      progress = new SingleBar({
        fps: 1,
        barCompleteChar: '#',
        barIncompleteChar: '.'
      })
      progress.start(bloomOptions.n, 0)
    }

    let earlyStop = false
    for await (const { entry, error } of HibpOrderedByCountReader.read(input)) {
      if (bloomOptions.n !== undefined && filter.n >= bloomOptions.n) {
        earlyStop = true
        break
      }
      if (error !== undefined) {
        throw new ExpectedError(`Error reading input file: ${error}`)
      }
      if (entry?.hash === undefined) {
        throw new Error(`Reader returned no error and no entry`)
      }

      await filter.add(entry.hash)
      progress?.increment(1)
    }

    progress?.stop()

    if (earlyStop) {
      console.warn(`Reached max capacity of ${bloomOptions.n}, skipping remaining entries`)
    }

    console.log(`Built a bloom filter with ${filter.n} entries and an error rate of ${filter.epsilon()}`)

    // Write the contents of the file in memory to disk.
    await fs.writeFile(options.out.fullName, filter.storage.buffer)
  }
}
