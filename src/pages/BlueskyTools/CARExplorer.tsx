import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  DohJsonHandleResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
} from '@atcute/identity-resolver';
import { getPdsEndpoint, type Handle } from '@atcute/identity';
import * as Ariakit from '@ariakit/react';
import { iterateAtpRepo } from '@atcute/car';
import { Card } from '../../components/Card';
import { NavBar } from '../../components/NavBar';
import { Page } from '../../components/Page';
import { Input } from '../../components/Input';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { useQuery } from '@tanstack/react-query';
import { simpleFetchHandler, XRPC } from '@atcute/client';
import { ArrowBigLeft, Download } from 'lucide-react';

const handleResolver = new CompositeHandleResolver({
  strategy: 'race',
  methods: {
    dns: new DohJsonHandleResolver({ dohUrl: 'https://mozilla.cloudflare-dns.com/dns-query' }),
    http: new WellKnownHandleResolver(),
  },
});

const docResolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver(),
    web: new WebDidDocumentResolver(),
  },
});

const useDid = (handle: Handle | null) => {
  return useQuery({
    queryKey: ['did', handle],
    queryFn: async () => {
      if (!handle) throw new Error('No handle provided');

      return await handleResolver.resolve(handle);
    },
    enabled: !!handle,
  });
};

const useCARExplorer = (handle: Handle | null) => {
  const { data: did } = useDid(handle);

  return useQuery({
    queryKey: ['car', handle],
    queryFn: async () => {
      if (!did) throw new Error('No did provided');

      const doc = await docResolver.resolve(did);

      const pdsUrl = getPdsEndpoint(doc);
      if (!pdsUrl) throw new Error('No PDS URL found');

      const rpc = new XRPC({ handler: simpleFetchHandler({ service: pdsUrl }) });

      const { data } = await rpc.get('com.atproto.sync.getRepo', {
        params: {
          did,
        },
      });

      const records: Record<string, Record<string, unknown>> = {};
      for (const { collection, rkey, record } of iterateAtpRepo(data)) {
        if (!records[collection]) {
          records[collection] = {};
        }
        records[collection][rkey] = record;
      }

      return records;
    },
    enabled: !!did,
  });
};

const AtProtoRecord = ({ rkey, record, open }: { rkey: string; record: unknown; open: boolean }) => {
  if (!record) return null;
  if (typeof record !== 'object') return null;

  return (
    <details open={open}>
      <summary>{rkey}</summary>
      <div className="flex flex-col gap-2">
        <pre>{JSON.stringify(record, null, 2)}</pre>
      </div>
    </details>
  );
};

export default function BlueskyToolsCARExplorerPage() {
  const [input, setInput] = useState<Handle | null>(null);
  const [handle, setHandle] = useState<Handle | null>(null);
  const [selectedId, setSelectedId] = useState<string | null | undefined>('index');
  const { data, isLoading } = useCARExplorer(handle);
  const defaultSelectedId = 'index';

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input) return;

    setHandle(input as Handle);
  };

  const downloadCARFile = () => {
    // First, validate data exists
    if (!data) {
      console.error('No data available to download');
      return;
    }

    // Make sure handle exists or provide a fallback
    const fileHandle = handle || 'export';

    // Create the blob and URL
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create and append the anchor to the DOM
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileHandle}-car-${new Date().toISOString()}.json`;
    document.body.appendChild(a); // Append to DOM

    // Trigger click and cleanup
    a.click();

    // Small timeout before revoking the URL
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a); // Clean up by removing the element
    }, 100);
  };

  return (
    <Page>
      <NavBar />
      <div className="flex flex-col gap-4">
        <Card className="p-4 flex flex-col gap-4">
          <div className="flex justify-between">
            <h1>CAR Explorer</h1>
            {data && (
              <Button onClick={downloadCARFile} className="w-fit" label="Download CAR as JSON">
                <Download className="size-4" />
              </Button>
            )}
          </div>
          <form onSubmit={handleSubmit}>
            <Input
              placeholder="Enter a Handle or DID (e.g. imlunahey.com)"
              value={input}
              onChange={(e) => setInput(e.target.value as Handle)}
            />
            <Button type="submit">Explore</Button>
          </form>
        </Card>

        {isLoading && <p>Loading...</p>}
        {data && (
          <Card className="p-4 flex flex-col gap-2">
            <Ariakit.TabProvider defaultSelectedId={defaultSelectedId} setSelectedId={setSelectedId} selectedId={selectedId}>
              <Ariakit.TabList className="flex gap-2 overflow-x-auto">
                {selectedId !== 'index' && (
                  <Ariakit.Tab key={`index-tab`} id="index" className="px-2 py-1 mb-4 border border-[#1a1a1a]">
                    <ArrowBigLeft />
                  </Ariakit.Tab>
                )}
              </Ariakit.TabList>
              <div className="flex flex-col gap-4">
                <Ariakit.TabPanel key={`index-tab-panel`} tabId="index" className="flex flex-col gap-4">
                  {Object.keys(data).map((key) => (
                    <Ariakit.Tab key={`${key}-tab`} id={key} className="px-2 py-1 border border-[#1a1a1a] text-left">
                      {key}
                    </Ariakit.Tab>
                  ))}
                </Ariakit.TabPanel>
                {Object.keys(data).map((key) => (
                  <Ariakit.TabPanel key={`${key}-tab-panel`} tabId={key} className="flex flex-col gap-4">
                    {Object.keys(data[key]).map((rkey) => (
                      <Card key={`${key}-${rkey}`} className="p-4">
                        <AtProtoRecord rkey={rkey} record={data[key][rkey]} open={Object.keys(data[key]).length === 1} />
                      </Card>
                    ))}
                  </Ariakit.TabPanel>
                ))}
              </div>
            </Ariakit.TabProvider>
          </Card>
        )}
      </div>
    </Page>
  );
}
