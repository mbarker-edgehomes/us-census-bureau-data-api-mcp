import fetch from 'node-fetch'
import { z } from 'zod'
import { SearchDataTablesArgs } from '../schema/search-data-tables.schema.js'
import { ResolveGeographyFipsArgs } from '../schema/resolve-geography-fips.schema.js'

const catalogSchema = z.object({
  dataset: z.array(
    z.object({
      c_dataset: z.array(z.string()),
      c_vintage: z.number().optional(),
      title: z.string(),
      c_isAggregate: z.boolean().optional(),
    }),
  ),
})
const groupsSchema = z.object({
  groups: z.array(z.object({ name: z.string(), description: z.string() })),
})
const levels = [
  { name: 'state', code: '040', parents: [] },
  { name: 'county', code: '050', parents: ['state'] },
  { name: 'place', code: '160', parents: ['state'] },
  { name: 'county subdivision', code: '060', parents: ['state', 'county'] },
]
const words = (value: string) =>
  value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
const matches = (value: string, query: string) =>
  words(query).every((word) => value.toLowerCase().includes(word))

export class CensusApiService {
  private async json(
    path: string,
    params: Record<string, string> = {},
  ): Promise<unknown> {
    const url = new URL(path, 'https://api.census.gov/')
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value)
    if (process.env.CENSUS_API_KEY)
      url.searchParams.set('key', process.env.CENSUS_API_KEY)
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok)
      throw new Error(
        `Census API returned ${response.status} ${response.statusText}`,
      )
    if (
      response.url?.includes('/missing_key.html') ||
      response.url?.includes('/invalid_key.html')
    ) {
      throw new Error('Census API requires a valid CENSUS_API_KEY.')
    }
    try {
      return await response.json()
    } catch {
      throw new Error(
        'Census API returned a non-JSON response. Check your API key and dataset parameters.',
      )
    }
  }

  private async latest(endpoint: string) {
    // Endpoint names are catalog identifiers, never caller-controlled URLs.
    const catalog = catalogSchema.parse(await this.json('/data.json'))
    const datasets = catalog.dataset
      .filter((item) => item.c_dataset.join('/') === endpoint)
      .sort((a, b) => (b.c_vintage ?? 0) - (a.c_vintage ?? 0))
    if (!datasets.length) throw new Error(`Unknown Census dataset: ${endpoint}`)
    const dataset = datasets[0]
    return {
      ...dataset,
      path: `/data/${dataset.c_vintage === undefined ? '' : dataset.c_vintage + '/'}${endpoint}`,
    }
  }

  async searchTables(args: SearchDataTablesArgs) {
    const endpoint = args.api_endpoint ?? 'acs/acs5'
    const dataset = await this.latest(endpoint)
    const { groups } = groupsSchema.parse(
      await this.json(`${dataset.path}/groups.json`),
    )
    return groups
      .filter(
        (group) =>
          (!args.data_table_id ||
            group.name
              .toLowerCase()
              .startsWith(args.data_table_id.toLowerCase())) &&
          (!args.label_query || matches(group.description, args.label_query)),
      )
      .sort((a, b) => {
        const exact = (name: string) =>
          name.toLowerCase() === args.data_table_id?.toLowerCase() ? 1 : 0
        return exact(b.name) - exact(a.name) || a.name.localeCompare(b.name)
      })
      .slice(0, args.limit ?? 20)
      .map((group) => ({
        data_table_id: group.name,
        label: group.description,
        component: dataset.title,
        datasets: { [dataset.c_vintage ?? 'timeseries']: [endpoint] },
      }))
  }

  async resolveGeographies(args: ResolveGeographyFipsArgs) {
    if (!words(args.geography_name).length)
      throw new Error('Provide a geography name containing letters or numbers.')
    const selected = args.summary_level
      ? levels.filter(
          (level) =>
            level.code === args.summary_level ||
            level.name === args.summary_level?.trim().toLowerCase(),
        )
      : levels
    if (!selected.length)
      throw new Error(
        'Supported summary levels: State (040), County (050), Place (160), County Subdivision (060).',
      )
    const dataset = await this.latest('acs/acs5')
    const results = []
    // Sequential requests keep API load bounded and propagate failures rather than reporting false no-matches.
    for (const level of selected) {
      const params: Record<string, string> = {
        get: 'NAME',
        for: `${level.name}:*`,
      }
      if (level.parents.length)
        params.in = level.parents.map((parent) => `${parent}:*`).join(' ')
      const [headers, ...rows] = z
        .array(z.array(z.string()))
        .min(1)
        .parse(await this.json(dataset.path, params))
      for (const row of rows) {
        const fields = Object.fromEntries(
          headers.map((header, index) => [header, row[index]]),
        )
        if (
          !fields.NAME ||
          !fields[level.name] ||
          level.parents.some((parent) => !fields[parent])
        )
          throw new Error('Invalid geography response from Census API')
        if (!matches(fields.NAME, args.geography_name)) continue
        results.push({
          name: fields.NAME,
          summary_level_name: level.name,
          summary_level_code: level.code,
          for_param: `${level.name}:${fields[level.name]}`,
          in_param: level.parents
            .map((parent) => `${parent}:${fields[parent]}`)
            .join(' '),
          vintage: dataset.c_vintage,
        })
      }
    }
    return results.sort((a, b) => a.name.localeCompare(b.name))
  }
}
