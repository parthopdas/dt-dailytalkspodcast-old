# Scripts

A collection of scripts in TypeScript.

## Installing Dependencies & Compiling

```bash
yarn
tsc *.ts
```

then run like `node script-name.js <ARGS>`

## Usage

### create-feed

```
usage: create-feed.js [-h] [-v] -i INPUT -o OUTPUT

Create an RSS/XML feed file using a JSON metadata file. The metadata file 
specified via --input should be in the format of the 'Podcast' interface.

Optional arguments:
  -h, --help            Show this help message and exit.
  -v, --version         Show program's version number and exit.
  -i INPUT, --input INPUT
                        Input data file (JSON).
  -o OUTPUT, --output OUTPUT
                        Output RSS/XML file
```

### validate-feed

```
usage: validate-feed.js [-h] [-v] [-i INPUT] [--strict]

Validate a RSS podcast feed. This script reads a feed file and applies 
various tests of formality and consistency, i.e. checking like the existence 
of required tags, correct data type or allowed values of tags. It fails with 
an exit code of 0 if no errors were found and 1 otherwise. Provide --strict 
to fail validation if unhandled tags were discovered.

Optional arguments:
  -h, --help            Show this help message and exit.
  -v, --version         Show program's version number and exit.
  -i INPUT, --input INPUT
                        Input RSS-Feed XML file.
  --strict              Set this in order to fail if unhandled tags occur in 
                        the feed.
```
