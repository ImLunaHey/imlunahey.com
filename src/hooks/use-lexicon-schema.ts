import { useQuery } from '@tanstack/react-query';
import { fetchLexicon } from '../lib/fetch-lexicon';
import { JSONSchema7 } from 'json-schema';

/**
 * Transforms a Bluesky lexicon schema to a standard JSON Schema
 * Properly handling the 'record' type transformation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformRecordTypes(schema: any): any {
  // Base case: not an object or null
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  // Handle arrays
  if (Array.isArray(schema)) {
    return schema.map((item) => transformRecordTypes(item));
  }

  // Create a new object to avoid mutating the original
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = { ...schema };

  // Special handling for record type
  if (schema.type === 'record' && schema.record) {
    // Replace 'record' type with 'object'
    result.type = 'object';

    // Merge in properties from the record
    Object.assign(result, schema.record);

    // Remove the original record property to avoid duplication
    delete result.record;
  }

  // Recursively transform all nested objects (including newly merged properties)
  for (const key in result) {
    if (typeof result[key] === 'object' && result[key] !== null) {
      result[key] = transformRecordTypes(result[key]);
    }
  }

  return result;
}

/**
 * Transforms a Bluesky lexicon schema to a standard JSON Schema
 */
function transformSchema(schema: unknown): JSONSchema7 | null {
  if (!schema || typeof schema !== 'object' || schema === null) {
    return null;
  }

  // Process the entire schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blueskySchema = schema as any;

  if (!blueskySchema.defs?.main) {
    return null;
  }

  // Transform the main definition
  return transformRecordTypes(blueskySchema.defs.main) as JSONSchema7;
}

/**
 * Hook to fetch and transform lexicon schema
 */
export const useLexiconSchema = (nsid: string | undefined | null) => {
  return useQuery({
    queryKey: ['lexicon', nsid],
    queryFn: async () => {
      if (!nsid) throw new Error('No nsid provided');

      try {
        // Fetch the lexicon schema
        const lexiconSchema = await fetchLexicon(nsid);

        // Transform the schema
        const transformedSchema = transformSchema(lexiconSchema);

        return transformedSchema ?? null;
      } catch {
        return null;
      }
    },
    enabled: !!nsid,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
};
