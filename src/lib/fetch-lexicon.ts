/**
 * AT Protocol Lexicon Resolver
 *
 * This module resolves AT Protocol Lexicons using Mozilla's DNS over HTTPS service
 * and fetches the corresponding schema from the atproto repository.
 */

/**
 * Represents a Lexicon schema definition
 */
type LexiconSchema = {
  $type: string;
  lexicon: number;
  id: string;
  defs: Record<string, unknown>;
  description?: string;
};

/**
 * Error thrown when Lexicon resolution fails
 */
class LexiconResolutionError extends Error {
  constructor(
    message: string,
    public nsid: string,
    public stage: string,
  ) {
    super(message);
    this.name = 'LexiconResolutionError';
  }
}

/**
 * Resolves an NSID to an authority domain name for DNS lookup
 *
 * @param nsid The Namespaced Identifier (e.g., app.bsky.feed.post)
 * @returns Authority domain name for DNS lookup
 */
function getAuthorityDomain(nsid: string): string {
  // Split the NSID and extract the parts
  const parts = nsid.split('.');

  // The last part is the "name", which we remove
  const authorityParts = parts.slice(0, -1);

  // Reverse the remaining parts to get the domain format
  return `_lexicon.${authorityParts.reverse().join('.')}`;
}

/**
 * Resolves a DID from a DNS TXT record using Mozilla's DoH
 *
 * @param authorityDomain The authority domain to query
 * @returns The DID extracted from the TXT record
 * @throws LexiconResolutionError if DNS resolution fails
 */
async function resolveDIDFromDNS(authorityDomain: string, nsid: string): Promise<string> {
  try {
    // Construct the Mozilla DoH URL
    const url = new URL('https://mozilla.cloudflare-dns.com/dns-query');
    url.searchParams.append('name', authorityDomain);
    url.searchParams.append('type', 'TXT');

    // Perform the DNS query
    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/dns-json',
      },
    });

    if (!response.ok) {
      throw new LexiconResolutionError(`DNS resolution failed with status ${response.status}`, nsid, 'dns_query');
    }

    const dnsResult = (await response.json()) as { Answer: { data: string }[] };

    if (!dnsResult.Answer || dnsResult.Answer.length === 0) {
      throw new LexiconResolutionError(`No TXT records found for ${authorityDomain}`, nsid, 'dns_response');
    }

    // Extract the DID from TXT records
    for (const record of dnsResult.Answer) {
      const txtValue = record.data.replace(/^"|"$/g, ''); // Remove surrounding quotes

      if (txtValue.startsWith('did=')) {
        return txtValue.substring(4); // Remove 'did=' prefix
      }
    }

    throw new LexiconResolutionError(`No valid 'did=' TXT record found for ${authorityDomain}`, nsid, 'did_extraction');
  } catch (error) {
    if (error instanceof LexiconResolutionError) throw error;
    if (!(error instanceof Error)) throw new Error('Unknown error');
    throw new LexiconResolutionError(`Failed to resolve DID: ${error.message}`, nsid, 'dns_resolution');
  }
}

/**
 * Resolves a DID to a Personal Data Server (PDS) URL
 *
 * @param did The DID to resolve
 * @returns The PDS URL
 * @throws LexiconResolutionError if DID resolution fails
 */
async function resolvePDSFromDID(did: string, nsid: string): Promise<string> {
  try {
    // In a real implementation, this would use proper DID resolution
    // For simplicity, we're using the AT Protocol PDS resolution endpoint
    const response = await fetch(`https://plc.directory/${did}`);

    if (!response.ok) {
      throw new LexiconResolutionError(`DID resolution failed with status ${response.status}`, nsid, 'did_resolution');
    }

    const didDoc = (await response.json()) as { service: { type: string; serviceEndpoint: string }[] };

    // Extract the PDS URL from the DID document
    if (!didDoc.service || !Array.isArray(didDoc.service)) {
      throw new LexiconResolutionError('DID document does not contain service endpoints', nsid, 'pds_extraction');
    }

    const pdsService = didDoc.service.find(
      (s: { type: string; serviceEndpoint: string }) => s.type === 'AtprotoPersonalDataServer',
    );

    if (!pdsService || !pdsService.serviceEndpoint) {
      throw new LexiconResolutionError('DID document does not contain a PDS service endpoint', nsid, 'pds_endpoint');
    }

    return pdsService.serviceEndpoint;
  } catch (error) {
    if (error instanceof LexiconResolutionError) throw error;
    if (!(error instanceof Error)) throw new Error('Unknown error');
    throw new LexiconResolutionError(`Failed to resolve PDS: ${error.message}`, nsid, 'pds_resolution');
  }
}

/**
 * Fetches a Lexicon schema from a PDS
 *
 * @param pdsUrl The PDS URL
 * @param did The DID
 * @param nsid The NSID
 * @returns The Lexicon schema
 * @throws LexiconResolutionError if schema fetching fails
 */
async function fetchLexiconSchema(pdsUrl: string, did: string, nsid: string): Promise<LexiconSchema> {
  try {
    // Fetch the schema from the PDS
    const response = await fetch(
      `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${did}&collection=com.atproto.lexicon.schema&rkey=${nsid}`,
    );

    if (!response.ok) {
      throw new LexiconResolutionError(`Schema fetch failed with status ${response.status}`, nsid, 'schema_fetch');
    }

    const result = (await response.json()) as { value: LexiconSchema };

    if (!result.value || result.value.$type !== 'com.atproto.lexicon.schema') {
      throw new LexiconResolutionError('Invalid schema record returned', nsid, 'schema_validation');
    }

    return result.value as LexiconSchema;
  } catch (error) {
    if (error instanceof LexiconResolutionError) throw error;
    if (!(error instanceof Error)) throw new Error('Unknown error');
    throw new LexiconResolutionError(`Failed to fetch schema: ${error.message}`, nsid, 'schema_retrieval');
  }
}

/**
 * Main function to fetch a Lexicon schema by its NSID
 *
 * @param nsid The Namespaced Identifier of the Lexicon
 * @returns The resolved Lexicon schema
 * @throws LexiconResolutionError if resolution fails at any stage
 */
export async function fetchLexicon(nsid: string): Promise<LexiconSchema> {
  // Step 1: Get the authority domain from the NSID
  const authorityDomain = getAuthorityDomain(nsid);

  // Step 2: Resolve the DID from DNS
  const did = await resolveDIDFromDNS(authorityDomain, nsid);

  // Step 3: Resolve the PDS URL from the DID
  const pdsUrl = await resolvePDSFromDID(did, nsid);

  // Step 4: Fetch the Lexicon schema from the PDS
  return await fetchLexiconSchema(pdsUrl, did, nsid);
}
