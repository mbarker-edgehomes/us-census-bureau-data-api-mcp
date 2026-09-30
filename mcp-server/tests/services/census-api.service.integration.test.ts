import { describe, it, expect } from 'vitest'
import { CensusApiService } from '../../src/services/census-api.service.js'

describe('Census API discovery - live', () => {
  it('finds the population table from live groups metadata', async () => {
    const result = await new CensusApiService().searchTables({
      api_endpoint: 'acs/acs5',
      data_table_id: 'B01001',
      limit: 1,
    })
    expect(result[0].data_table_id).toBe('B01001')
  })
  it.skipIf(!process.env.CENSUS_API_KEY)(
    'resolves Alabama to state 01',
    async () => {
      const result = await new CensusApiService().resolveGeographies({
        geography_name: 'Alabama',
        summary_level: '040',
      })
      expect(result).toHaveLength(1)
      expect(result[0].for_param).toBe('state:01')
    },
  )
})
