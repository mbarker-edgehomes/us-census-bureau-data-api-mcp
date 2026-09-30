import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { BaseTool } from './base.tool.js'
import { CensusApiService } from '../services/census-api.service.js'
import {
  ResolveGeographyFipsArgs,
  ResolveGeographyFipsArgsSchema,
  ResolveGeographyFipsInputSchema,
} from '../schema/resolve-geography-fips.schema.js'

import { ToolContent } from '../types/base.types.js'

export const toolDescription = `Resolve geography names using NAME queries against the latest ACS 5-year API. Supports State (040), County (050), Place (160), and County Subdivision (060). Without a summary_level, searches all four. Matches all name keywords case insensitively; use full state names. Returns query parameters and the vintage actually searched. No local database is used.`

export class ResolveGeographyFipsTool extends BaseTool<ResolveGeographyFipsArgs> {
  name = 'resolve-geography-fips'
  description = toolDescription
  readonly requiresApiKey = true

  private api = new CensusApiService()

  inputSchema: Tool['inputSchema'] =
    ResolveGeographyFipsArgsSchema as Tool['inputSchema']

  get argsSchema() {
    return ResolveGeographyFipsInputSchema
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
  }

  async toolHandler(
    args: ResolveGeographyFipsArgs,
  ): Promise<{ content: ToolContent[] }> {
    try {
      const result = await this.api.resolveGeographies(args)

      if (result && result.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Found ${result.length} Matching Geographies:\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `No geographies found matching "${args.geography_name}".`,
            },
          ],
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      return this.createErrorResponse(
        `Failed to resolve geography: ${errorMessage}`,
      )
    }
  }
}
