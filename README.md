# Despace
A polyfill for Deno's in development workspace feature

## Installation
To install despace use the following command: `deno install --name=despace --allow-read --allow-write --global jsr:@studios/despace`

## Usage
### Initializing Despace
To initialize Despace in a project use `despace init`, if you have a config file that isn't `deno.json` or `deno.jsonc` you can specify the file or use the `--make` flag to create a config file

## Building Despace config
To build your Despace imports file use `despace build`, if you want despace to automatically rebuild on config changes use the `--watch` flag

## Updating despace
To update the Despace utility run `despace update`