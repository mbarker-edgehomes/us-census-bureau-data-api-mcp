# Command-line helpers

Run `npm install` from the repository root first. Helpers launch the compiled Node.js server directly and inherit `CENSUS_API_KEY`.

```sh
export CENSUS_API_KEY=your_key
bash scripts/dev/list-tools.sh --json
bash scripts/dev/fetch-dataset-geography.sh acs/acs5 2023
bash scripts/dev/resolve-geography-fips.sh 'Philadelphia, Pennsylvania'
```

Run `bash scripts/dev/census-mcp.sh --help` for the full command list.
