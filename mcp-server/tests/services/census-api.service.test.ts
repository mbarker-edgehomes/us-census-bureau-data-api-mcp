import { beforeEach, describe, expect, it, vi } from 'vitest'
import fetch from 'node-fetch'
import { CensusApiService } from '../../src/services/census-api.service.js'
import { FetchDatasetGeographyTool } from '../../src/tools/fetch-dataset-geography.tool.js'
import { ResolveGeographyFipsTool } from '../../src/tools/resolve-geography-fips.tool.js'
import { SearchDataTablesTool } from '../../src/tools/search-data-tables.tool.js'
vi.mock('node-fetch', () => ({ default: vi.fn() }))
const mockedFetch = vi.mocked(fetch)
const reply = (data: unknown) =>
  mockedFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  } as Awaited<ReturnType<typeof fetch>>)
const catalog = () =>
  reply({
    dataset: [2022, 2023].map((c_vintage) => ({
      c_dataset: ['acs', 'acs5'],
      c_vintage,
      title: 'ACS',
    })),
  })
beforeEach(() => {
  vi.resetAllMocks()
  delete process.env.CENSUS_API_KEY
})
describe('direct Census discovery', () => {
  it('searches newest groups, combines filters, limits results and reports actual vintage', async () => {
    catalog()
    reply({
      groups: [
        { name: 'B01001A', description: 'Sex by age' },
        { name: 'B01001', description: 'Sex by age' },
        { name: 'B2', description: 'Income' },
      ],
    })
    const result = await new CensusApiService().searchTables({
      data_table_id: 'b01001',
      label_query: 'SEX age',
      limit: 1,
    })
    expect(result).toEqual([
      {
        data_table_id: 'B01001',
        label: 'Sex by age',
        component: 'ACS',
        datasets: { 2023: ['acs/acs5'] },
      },
    ])
    expect(mockedFetch.mock.calls[1][0]).toBe(
      'https://api.census.gov/data/2023/acs/acs5/groups.json',
    )
  })
  it('rejects unknown endpoints without requesting arbitrary URLs', async () => {
    catalog()
    await expect(
      new CensusApiService().searchTables({
        api_endpoint: 'https://example.com',
      }),
    ).rejects.toThrow('Unknown Census dataset')
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })
  it('resolves names with parent FIPS codes and preserves leading zeros', async () => {
    catalog()
    reply([
      ['NAME', 'state', 'county', 'county subdivision'],
      ['Example town, Example County, Alabama', '01', '003', '00100'],
    ])
    const result = await new CensusApiService().resolveGeographies({
      geography_name: 'Example Alabama',
      summary_level: '060',
    })
    expect(result[0]).toMatchObject({
      for_param: 'county subdivision:00100',
      in_param: 'state:01 county:003',
      vintage: 2023,
    })
    const url = new URL(String(mockedFetch.mock.calls[1][0]))
    expect(url.searchParams.get('in')).toBe('state:* county:*')
    expect(url.searchParams.get('for')).toBe('county subdivision:*')
  })
  it('searches all supported levels when unfiltered', async () => {
    catalog()
    for (const headers of [
      ['NAME', 'state'],
      ['NAME', 'state', 'county'],
      ['NAME', 'state', 'place'],
      ['NAME', 'state', 'county', 'county subdivision'],
    ])
      reply([headers])
    expect(
      await new CensusApiService().resolveGeographies({
        geography_name: 'Missing',
      }),
    ).toEqual([])
    expect(mockedFetch).toHaveBeenCalledTimes(5)
  })
  it('rejects unsupported levels and empty names instead of an unrelated search', async () => {
    const api = new CensusApiService()
    await expect(
      api.resolveGeographies({ geography_name: 'Test', summary_level: '999' }),
    ).rejects.toThrow('Supported summary')
    await expect(
      api.resolveGeographies({ geography_name: ' ' }),
    ).rejects.toThrow('Provide a geography')
    expect(mockedFetch).not.toHaveBeenCalled()
  })
  it('returns actionable API errors through both discovery tools', async () => {
    process.env.CENSUS_API_KEY = 'test-key'
    for (const tool of [
      new SearchDataTablesTool(),
      new ResolveGeographyFipsTool(),
    ]) {
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Awaited<ReturnType<typeof fetch>>)
      const result = await tool.handler({
        geography_name: 'Test',
        label_query: 'Test',
      })
      expect(result.content[0].text).toContain('429 Too Many Requests')
    }
  })
  it('reports Census key redirects clearly', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      url: 'https://api.census.gov/data/missing_key.html',
    } as Awaited<ReturnType<typeof fetch>>)
    await expect(
      new CensusApiService().searchTables({ label_query: 'age' }),
    ).rejects.toThrow('valid CENSUS_API_KEY')
  })
  it('requires a key for geography lookup before making requests', async () => {
    const result = await new ResolveGeographyFipsTool().handler({
      geography_name: 'Alabama',
    })
    expect(result.content[0].text).toContain('CENSUS_API_KEY is not set')
    expect(mockedFetch).not.toHaveBeenCalled()
  })
  it('rejects malformed upstream groups', async () => {
    catalog()
    reply({ groups: 'bad' })
    await expect(
      new CensusApiService().searchTables({ label_query: 'age' }),
    ).rejects.toThrow()
  })
  it('fetches geography metadata without a database and retains required parents', async () => {
    process.env.CENSUS_API_KEY = 'test-key'
    reply({
      fips: [
        {
          name: 'tract',
          geoLevelDisplay: '140',
          referenceDate: '2023-01-01',
          requires: ['state', 'county'],
          wildcard: ['tract'],
        },
      ],
    })
    const result = await new FetchDatasetGeographyTool().handler({
      dataset: 'acs/acs5',
      year: 2023,
    })
    const entries = JSON.parse(result.content[0].text.split('\n\n')[1])
    expect(entries[0].queryExample).toBe('for=tract:*&in=state:*+county:*')
    expect(entries[0].hierarchy).toEqual(['state', 'county', 'tract'])
    expect(String(mockedFetch.mock.calls[0][0])).toContain(
      '/2023/acs/acs5/geography.json',
    )
  })
})
