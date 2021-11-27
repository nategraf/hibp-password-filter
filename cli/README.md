# HIBP Password Filter CLI

This package includes a Node JS CLI for tuning, building, and querying password filters for
client-side password blocklists from the [HIBP Passwords](https://haveibeenpwned.com/Passwords).

## Usage

### Quickstart

So you want to start checking your passwords right away? The following commands will download a
pre-build filter of the top 10k passwords and checks the given `$PASSWORD` against it.

```bash
curl -LO https://storage.googleapis.com/password-filters/pwned-passwords-v7-top-10k.filter
npm install @victorgraf/password-filter-cli
npx hibp-password-filter query -f pwned-passwords-v7-top-10k.filter $PASSWORD
```

You could also use `npm install -g` to install it globally, but `npm` is kind of a gross way to
install global packages.

Feel free to also use the prebuilt top 1M password filter, which is 2.4MiB. It is available as
`pwned-passwords-v7-top-1M.filter` in the same Google Storage bucket. (So you can adjust the URL)

### Tune

The `tune` command calculates filter tuning parameters to optimize storage size, element capacity,
and error rate.  Use this command to determine remaining parameters given your requirements.

Examples:

```bash
# Determine the storage requirement for a filter with 100k passwords and an error rate of 1%.
tune -n 100k -e 0.01

# Determine the error rate of a filter with 1M passwords and size of 5 MiB.
tune -n 1M -m 5MiB

# Determine how many passwords a 100 KiB filter can hold with a 1% error rate.
tune -m '100 KiB' -e 0.01
```

### Build

### Query

### Show
