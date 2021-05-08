import { formatBits, formatCount, parseBits, parseCount } from './utils'

describe('formatBits', () => {
  const cases: [number, string][] = [
    [7, '7 b'],
    [16, '2 B'],
    [1.455 * 8 * 1024, '1.46 KiB'],
    [3 * 8 * (1024 ** 2), '3.00 MiB'],
    [7 * 8 * (1024 ** 8), '7.00 YiB'],
    [7 * 8 * (1024 ** 9), '7168.00 YiB'],
  ]
  for (const [bits, want] of cases) {
    it(`should format ${bits} correctly as ${want}`, () => {
      expect(formatBits(bits)).toEqual(want)
    })
  }

  it(`should use the specified number of digits`, () => {
    const bits = 1.5728 * 8 * (1024 ** 2)
    expect(formatBits(bits, 0)).toEqual('2 MiB')
    expect(formatBits(bits, 1)).toEqual('1.6 MiB')
    expect(formatBits(bits, 2)).toEqual('1.57 MiB')
    expect(formatBits(bits, 3)).toEqual('1.573 MiB')
    expect(formatBits(bits, 4)).toEqual('1.5728 MiB')
    expect(formatBits(bits, 5)).toEqual('1.57280 MiB')
  })
})

describe('formatCount', () => {
  const cases: [number, string][] = [
    [16, '16'],
    [1.455 * 1000, '1.46 k'],
    [3 * (1000 ** 2), '3.00 M'],
    [7 * (1000 ** 8), '7.00 Y'],
    [7 * (1000 ** 9), '7000.00 Y'],
  ]
  for (const [count, want] of cases) {
    it(`should format ${count} correctly as ${want}`, () => {
      expect(formatCount(count)).toEqual(want)
    })
  }

  it(`should use the specified number of digits`, () => {
    const count = 1.5728 * (1000 ** 2)
    expect(formatCount(count, 0)).toEqual('2 M')
    expect(formatCount(count, 1)).toEqual('1.6 M')
    expect(formatCount(count, 2)).toEqual('1.57 M')
    expect(formatCount(count, 3)).toEqual('1.573 M')
    expect(formatCount(count, 4)).toEqual('1.5728 M')
    expect(formatCount(count, 5)).toEqual('1.57280 M')
  })
})

describe('parseBits', () => {
  const cases: [string, number][] = [
    ['29', 29],
    ['29 b', 29],
    ['29b', 29],
    ['38 KiB', 38 * 8 * 1024],
    ['38KiB', 38 * 8 * 1024],
    ['38  KiB', 38 * 8 * 1024],
    ['38000 KiB', 38000  * 8 * 1024],
    ['53.27 GiB', 53.27 * 8 * (1024 ** 3)],
    ['53. GiB', 53 * 8 * (1024 ** 3)],
  ]
  for (const [str, want] of cases) {
    it(`should parse ${str} correctly as ${want}`, () => {
      expect(parseBits(str)).toBe(want)
    })
  }

  it(`should reject strings without a number`, () => {
    expect(() => { parseBits('1a4') }).toThrow()
  })

  it(`should reject strings with an invalid unit`, () => {
    expect(() => { parseBits('5 OiB') }).toThrow()
  })

  it(`should reject non integral counts`, () => {
    expect(() => { parseBits('5.3 b') }).toThrow()
    expect(() => { parseBits('5.25642 KiB') }).toThrow()
  })
})

describe('parseCount', () => {
  const cases: [string, number][] = [
    ['29', 29],
    ['38 k', 38 * 1000],
    ['38k', 38 * 1000],
    ['38  k', 38 * 1000],
    ['38000 K', 38000 * 1000],
    ['53.27 G', 53.27 * (1000 ** 3)],
    ['53. G', 53 * (1000 ** 3)],
  ]
  for (const [str, want] of cases) {
    it(`should parse ${str} correctly as ${want}`, () => {
      expect(parseCount(str)).toBe(want)
    })
  }

  it(`should reject strings without a number`, () => {
    expect(() => { parseCount('1a4') }).toThrow()
  })

  it(`should reject strings with an invalid unit`, () => {
    expect(() => { parseCount('5 O') }).toThrow()
  })

  it(`should reject non integral counts`, () => {
    expect(() => { parseCount('5.3') }).toThrow()
    expect(() => { parseCount('5.2564 k') }).toThrow()
  })
})
