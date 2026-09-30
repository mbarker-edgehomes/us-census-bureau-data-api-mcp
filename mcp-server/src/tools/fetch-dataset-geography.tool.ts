import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { BaseTool } from './base.tool.js'
import {
  FetchDatasetGeographyArgs,
  FetchDatasetGeographyArgsSchema,
  FetchDatasetGeographyInputSchema,
  GeographyJsonSchema,
  parseGeographyJson,
} from '../schema/dataset-geography.schema.js'
import { ToolContent } from '../types/base.types.js'
export const toolDescription = `
  Returns available geographic levels and filtering options for a specific Census dataset. Use this tool BEFORE fetch-aggregate-data when you need to discover what geographic breakdowns are available (state, county, tract, place, etc.) for a dataset, or when users ask about geographic coverage. Required when constructing geography queries for unfamiliar datasets. Provides query syntax, codes, and hierarchy information for each geographic level.
`

export class FetchDatasetGeographyTool extends BaseTool<FetchDatasetGeographyArgs> {
  name = 'fetch-dataset-geography'
  description = toolDescription
  readonly requiresApiKey = true

  inputSchema: Tool['inputSchema'] =
    FetchDatasetGeographyArgsSchema as Tool['inputSchema']

  get argsSchema() {
    return FetchDatasetGeographyInputSchema
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
  }

  async toolHandler(
    args: FetchDatasetGeographyArgs,
    apiKey: string,
  ): Promise<{ content: ToolContent[] }> {
    try {
      const fetch = (await import('node-fetch')).default
      let year = ''
      if (args.year) {
        year = `${args.year}/`
      }

      const baseUrl = `https://api.census.gov/data/${year}${args.dataset}/geography.json`
      const geographyUrl = `${baseUrl}?key=${apiKey}`

      const geographyResponse = await fetch(geographyUrl)

      if (geographyResponse.ok) {
        const geographyData = await geographyResponse.json()

        try {
          const validatedData = GeographyJsonSchema.parse(geographyData)
          const parsedGeographyData = parseGeographyJson(validatedData)

          return {
            content: [
              {
                type: 'text',
                text: `Available geographies for ${args.dataset}${args.year ? ` (${args.year})` : ''}:\n\n${JSON.stringify(parsedGeographyData, null, 2)}`,
              },
            ],
          }
        } catch (validationError) {
          const validationMessage =
            validationError instanceof Error
              ? validationError.message
              : 'Validation failed'
          console.error('Schema validation failed:', validationMessage)

          return this.createErrorResponse(
            `Response validation failed: ${validationMessage}`,
          )
        }
      } else {
        console.log(geographyResponse.status)
        return this.createErrorResponse(
          `Geography endpoint returned: ${geographyResponse.status} ${geographyResponse.statusText}`,
        )
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      return this.createErrorResponse(
        `Failed to fetch dataset geography levels: ${errorMessage}`,
      )
    }
  }
}
