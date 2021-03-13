import { MutableStorage, Storage, StorageAllocator } from './filter'
import { promises as fs } from 'fs'

export class FileStorage implements Storage {
  protected constructor(
    readonly handle: fs.FileHandle,
    readonly size: number
  ) {}

  static async open(path: string) {
    const handle = await fs.open(path, 'r')
    return new FileStorage(handle, (await handle.stat()).size)
  }

  async byte(index: number): Promise<number> {
    return (await this.read(index, 1))[0]
  }

  async read(index: number, length: number): Promise<Buffer> {
    const buffer = Buffer.alloc(length)
    return (await this.handle.read(buffer, 0, length, index)).buffer
  }
}

export interface FileStorageOptions {
  mode?: 'a+'|'w+'|'wx+'
}

// FileAllocator wraps MutableFileStorage to provide an allocator interface.
export class FileAllocator implements StorageAllocator<MutableFileStorage> {
  constructor(
    readonly path: string,
    readonly options: FileStorageOptions
   ) {}

  async alloc(size: number): Promise<MutableFileStorage> {
    return MutableFileStorage.open(this.path, size, { mode: 'wx+', ...this.options})
  }
}

export class MutableFileStorage extends FileStorage implements MutableStorage {
  static async open(path: string, size?: number, options?: FileStorageOptions): Promise<MutableFileStorage> {
    const handle = await fs.open(path, options?.mode ?? 'a+')
    // If the file is not large enough, write 0x00 to the end of the file to trigger an allocation.
    if (size && (await handle.stat()).size < size) {
      await handle.write(Buffer.from([0]), 0, 1, size-1)
    }
    return new MutableFileStorage(handle, size ?? (await handle.stat()).size)
  }

  async setByte(index: number, value: number) {
    await this.write(index, Buffer.from([value]))
  }

  async write(index: number, value: Buffer) {
    await this.handle.write(value, 0, value.length, index)
  }
}
