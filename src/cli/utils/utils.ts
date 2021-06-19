/**
* Format bits as human-readable text.
* 
* @param bits Number of bits.
* @param dp Number of decimal places to display.
* 
* @return Formatted string.
*
* @remarks Originally by @mpen on StackOverflow https://stackoverflow.com/a/14919494
*/
export const formatBits = (bits: number, dp=2): string => {
  const threshold = 1024

  if (Math.abs(bits) < 8) {
    return bits + ' b'
  }

  let size = bits / 8
  if (Math.abs(size) < threshold) {
    return size + ' B'
  }

  const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
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
export const formatCount = (count: number, dp=2): string => {
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


  return count.toFixed(dp) + ' ' + units[u]
}

/**
* Parse bits from human-readable text.
* 
* @param str human-readable formatted bits.
* 
* @return Integer bits.
*/
export const parseBits = (str: string): number => {
  const match = str.match(/^(?<bits>\d+(\.?\d*))\s*(?<unit>([KMGTPEZY]iB|[bB]?))$/)
  if (match === null || match.groups?.bits === undefined || match.groups?.unit === undefined ) {
    throw new Error(`could not parse a bits value from '${str}'`)
  }

  const bits = parseFloat(match.groups.bits)
  if (isNaN(bits)) {
    throw new Error(`could not parse a number from '${match.groups.bits}'`)
  }

  const multiplier = (unit: string) => {
    if (unit === '' || unit === 'b') {
      return 1
    }

    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
    const unitIndex = units.indexOf(unit)
    if (unitIndex < 0) {
      throw new Error(`invalid unit: ${unit}`)
    }

    return 8 * 1024**unitIndex
  }

  const result = bits * multiplier(match.groups.unit)
  if (result % 1 !== 0) {
    throw new Error(`bits value is not an integer: ${result}`)
  }
  return result
}

/**
* Parse count from human-readable text.
* 
* @param str human-readable formatted count.
* 
* @return Integer count.
*/
export const parseCount = (str: string): number => {
  const match = str.match(/^(?<count>\d+(\.?\d*))\s*(?<unit>[kMGTPEZY]?)$/i)
  if (match === null || match.groups?.count === undefined || match.groups?.unit === undefined ) {
    throw new Error(`could not parse a count value from '${str}'`)
  }

  const count = parseFloat(match.groups.count)
  if (isNaN(count)) {
    throw new Error(`could not parse a number from '${match.groups.count}'`)
  }

  const units = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
  const unitIndex = units.indexOf(match.groups.unit.toUpperCase())
  if (unitIndex < 0) {
    throw new Error(`invalid unit: ${match.groups.unit}`)
  }

  const result = count * 1000**unitIndex
  if (result % 1 !== 0) {
    throw new Error(`count value is not an integer: ${result}`)
  }
  return result
}
