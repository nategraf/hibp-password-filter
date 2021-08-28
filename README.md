# HIBP Password Filter

Helping users choose good passwords is challenging. NIST 800-63 Provides a recommended approach, to
check password length and check against a list of known compromised passwords, but sending the
compromised password list to the user is prohibitory expensive, and sending the password to a server
that has the list creates a massive honey pot.

In order to make client-side password filtering more viable, especially on mobile devices, this
library supports the use of probabilistic sets (e.g. Bloom filters) to compress a password list with
the trade off of a small probability of a false positive (i.e. a chance to tell the user a password
is compromised when is actually is not.) As an example using a bloom filter with a 1 in 10,000
chance of reporting a false positive allows for compression rate of 8.3x, using 19 bits per entry.
It also allows for queries to require only a fix number of a lookups to determine whether an entry
is in the set (i.e. a password is compromised).

This library in particular is targeted for use on react-native mobile apps, where a password filter
can be included with the initial installation and used for checking the users password when they are
setting up their account. As a result, it is written in TypeScript against NodeJS with no
dependencies.

## CLI usage

This repository includes a CLI for building and querying bloom filters constructed from the the [HIBP
Passwords](https://haveibeenpwned.com/Passwords) dataset.

### Quickstart

So you want to start checking your passwords right away? 

```bash
curl -LO https://storage.googleapis.com/password-filters/pwned-passwords-v7-top-10k.filter
npm install @victorgraf/password-filter-cli
npx hibp-password-filter query -f pwned-passwords-v7-top-10k.filter $PASSWORD
```

You could also use `npm install -g` to install it globally, but `npm` is kind of a gross way to
install global packages.

Feel free to also use the prebuilt top 1M password filter, which is 2.4MiB. It is available as
`pwned-passwords-v7-top-1M.filter` in the same Google Storage bucket. (So you can adjust the URL)

### Building you own filters

Using either the `npm` package above, or from this repo with `yarn cli` after building with `yarn
install && yarn build`, you can build new filters with the `cli build` command. Input file should be
the HIBP Passwords sha1 ordered by hash file, which can be downloaded via torrent or CoudFlare from
https://haveibeenpwned.com/Passwords

## Node library usage

Using the the filters as a library can by loading a built filter (see CLI usage above) with the
`@victorgraf/password-filters` package 

```typescript
import { BloomFilter, FileStorage  } from '@victorgraf/password-filters'

const filterPath = '...'
const filter = await BloomFilter.from(await FileStorage.open(filterPath))
const hash = crypto.createHash('sha1').update(query).digest()
const pwned = await filter.has(hash)
```
