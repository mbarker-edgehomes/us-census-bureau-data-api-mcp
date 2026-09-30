# U.S. Census Bureau Data API MCP

A TypeScript MCP server that queries the U.S. Census Bureau API directly. No Docker, PostgreSQL, migrations, seeding, or local data store is needed.

## Add to Cursor (automatic setup)

Requires Node.js 22+ and npm. For this local checkout, add the following server to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "census-api": {
      "command": "bash",
      "args": ["/absolute/path/us-census-bureau-data-api-mcp/scripts/mcp-connect.sh"],
      "env": { "CENSUS_API_KEY": "YOUR_CENSUS_API_KEY" }
    }
  }
}
```

The launcher installs dependencies and builds automatically on first launch. Later launches reuse the installation. Installation messages go to stderr, preserving the MCP protocol. Save the config and restart Cursor, then check Customize > MCPs. Merge this entry with existing servers. Keep API keys out of committed project config files.

### Config-only install from GitHub

Once these changes are pushed to the fork, no checkout or manual install is needed (Git must also be installed):

```json
{
  "mcpServers": {
    "census-api": {
      "command": "npx",
      "args": ["--yes", "--package", "github:mbarker-edgehomes/us-census-bureau-data-api-mcp", "census-api-mcp"],
      "env": { "CENSUS_API_KEY": "YOUR_CENSUS_API_KEY" }
    }
  }
}
```

The root package supplies an executable and a prepare build so npm can install directly from GitHub. For a fixed release, append `#COMMIT_OR_TAG` to the GitHub package reference. This configuration requires the refactored code to exist on the selected remote ref; unpushed local changes are not available to npx.

First launch needs network access and may take a minute; if Cursor times out during setup, restart the server once installation finishes. If Cursor cannot find node/npm/npx, ensure Node.js is available on Cursor's PATH. See [Cursor's MCP installation documentation](https://cursor.com/help/customization/mcp).

## Setup

Install Node.js 22 or later and obtain a [Census API key](https://api.census.gov/data/key_signup.html). From this repository:

```sh
npm install
export CENSUS_API_KEY=your_key
npm start --silent
```

Installation builds the server. `npm start --silent` starts the stdio MCP transport and waits for a client. Set the key in your environment or MCP client configuration; a `.env` file is not loaded automatically.

Configure an MCP client with an absolute checkout path:

```json
{
  "mcpServers": {
    "census-api": {
      "command": "node",
      "args": ["/absolute/path/us-census-bureau-data-api-mcp/mcp-server/dist/index.js"],
      "env": { "CENSUS_API_KEY": "YOUR_CENSUS_API_KEY" }
    }
  }
}
```

Alternatively, after installation, run the local package using npx:

```sh
npx --yes --package ./mcp-server census-api-mcp
```

The package includes a `census-api-mcp` executable and can be packed using `npm pack ./mcp-server`. These instructions use the local package; they do not assume this refactor has been published to npm. The `scripts/mcp-connect.sh` launcher also handles first-use installation.

## Tools

- `list-datasets`: fetches the live dataset catalog and available vintages.
- `fetch-dataset-geography`: fetches a dataset's `geography.json`, including required parents and query examples.
- `fetch-aggregate-data`: queries data directly, with variables/groups, geography filters, predicates, and optional descriptive labels.
- `resolve-geography-fips`: fetches NAME and geography codes from the latest ACS 5-year release. Supports State (040), County (050), Place (160), and County Subdivision (060); searches all four unless filtered. Name keywords must all occur, case insensitively. Use full state names (e.g. `Philadelphia, Pennsylvania`). Returns `for_param`, `in_param`, and the queried vintage. Coordinates, fuzzy database ranking, and historical-vintage discovery are no longer supplied.
- `search-data-tables`: searches live `groups.json` for the latest vintage of `api_endpoint` (default `acs/acs5`). Supports table ID prefix, label keywords, and a result limit. All label keywords must match. Results report only the vintage actually searched, not historical table availability. Use `list-datasets` to choose another endpoint. Datasets without groups should be queried using variables directly.

The `get_population_data` prompt helps resolve a location and retrieve population data.

All requests require internet access. Geography name searches download geography lists and filter them in memory because the API does not offer a fuzzy name-search endpoint. Nothing is persisted locally. Broad searches can take longer than the former database-backed lookup; specifying a summary level reduces requests. API failures are reported to the caller.

## Development

```sh
npm run build
npm test
npm run lint
npm --prefix mcp-server run test:integration
```

Unit tests mock HTTP and need neither a key nor external services. Integration tests are opt-in and require a valid `CENSUS_API_KEY` and network access. CI runs build, lint, and unit tests without a database.

The server is in `mcp-server/src`, with tools under `tools` and direct discovery queries in `services/census-api.service.ts`. Diagnostics use stderr so stdout remains valid MCP JSON, including with `DEBUG_LOGS=true`.

After updating your checkout, run `npm install` again and restart the MCP client.
