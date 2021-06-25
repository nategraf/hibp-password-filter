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
