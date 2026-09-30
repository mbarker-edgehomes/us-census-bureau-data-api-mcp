import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { BaseTool } from './base.tool.js'
import { CensusApiService } from '../services/census-api.service.js'
import {
  SearchDataTablesArgs,
  SearchDataTablesArgsSchema,
  SearchDataTablesInputSchema,
} from '../schema/search-data-tables.schema.js'

import { ToolContent } from '../types/base.types.js'

export const toolDescription = `Search live Census groups metadata by table ID prefix and label keywords. api_endpoint defaults to acs/acs5. Searches the latest published vintage only; returned datasets list only the vintage actually searched. Use list-datasets to choose another endpoint. Results include data_table_id for get.group, label, component, and datasets. Label keywords must all match (case insensitive).`

export class SearchDataTablesTool extends BaseTool<SearchDataTablesArgs> {
  name = 'search-data-tables'
  description = toolDescription
  readonly requiresApiKey = false

  private api = new CensusApiService()

  inputSchema: Tool['inputSchema'] =
    SearchDataTablesArgsSchema as unknown as Tool['inputSchema']

  get argsSchema() {
    return SearchDataTablesInputSchema
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
  }

  async toolHandler(
    args: SearchDataTablesArgs,
  ): Promise<{ content: ToolContent[] }> {
    try {
      const results = await this.api.searchTables(args)

      if (results && results.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Found ${results.length} Matching Data Table${results.length === 1 ? '' : 's'}:\n\n${JSON.stringify(results, null, 2)}`,
            },
          ],
        }
      } else {
        const searchTerms = [
          args.data_table_id && `table ID "${args.data_table_id}"`,
          args.label_query && `label "${args.label_query}"`,
          args.api_endpoint && `api endpoint "${args.api_endpoint}"`,
        ]
          .filter(Boolean)
          .join(', ')

        return {
          content: [
            {
              type: 'text',
              text: `No data tables found matching ${searchTerms}.`,
            },
          ],
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      return this.createErrorResponse(
        `Failed to search data tables: ${errorMessage}`,
      )
    }
  }
}
