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
import { Input } from '../../components/Input';
import { memo, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { useQuery } from '@tanstack/react-query';
import { simpleFetchHandler, XRPC } from '@atcute/client';
import { ArrowBigLeft, Download } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
import { Link, useParams } from 'react-router';

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

      const records: Record<string, { rkey: string; record: unknown }[]> = {};
      for (const { collection, rkey, record } of iterateAtpRepo(data)) {
        if (!records[collection]) {
          records[collection] = [];
        }
        records[collection].push({ rkey, record });
      }

      return records;
    },
    enabled: !!did,
  });
};

const AtProtoRecord = memo(({ rkey, record, open }: { rkey: string; record: unknown; open: boolean }) => {
  if (!record) return null;
  if (typeof record !== 'object') return null;

  return (
    <Card className="p-4">
      <details open={open}>
        <summary>{rkey}</summary>
        <div className="flex flex-col gap-2">
          <CodeMirror value={JSON.stringify(record, null, 2)} extensions={[json()]} theme={tokyoNight} readOnly />
        </div>
      </details>
    </Card>
  );
});

const VirtualisedList = <T,>({ data, renderItem }: { data: T[]; renderItem: (item: T) => React.ReactNode }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rowRefsMap = useRef(new Map<number, HTMLDivElement>());

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 74,
    overscan: 5,
    onChange: (instance) => {
      if (innerRef.current) {
        innerRef.current.style.height = `${instance.getTotalSize()}px`;
      }
      instance.getVirtualItems().forEach((virtualRow) => {
        const rowRef = rowRefsMap.current.get(virtualRow.index);
        if (!rowRef) return;
        rowRef.style.transform = `translateY(${virtualRow.start}px)`;
      });
    },
    gap: 8,
  });

  const indexes = rowVirtualizer.getVirtualIndexes();

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowVirtualizer]);

  return (
    <div
      ref={parentRef}
      style={{
        height: `calc(100dvh - ${parentRef.current?.getBoundingClientRect().top ?? 0}px - 32px)`,
        overflow: 'auto',
      }}
    >
      <div
        ref={innerRef}
        style={{
          width: '100%',
          position: 'relative',
        }}
      >
        {indexes.map((index) => (
          <div
            key={index}
            data-index={index}
            ref={(el) => {
              if (el) {
                rowVirtualizer.measureElement(el);
                rowRefsMap.current.set(index, el);
              }
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${rowVirtualizer.getVirtualItems().find((row) => row.index === index)?.start ?? 0}px)`,
            }}
          >
            {renderItem(data[index])}
          </div>
        ))}
      </div>
    </div>
  );
};

const knownLexicons = {
  'app.bsky.actor.profile': 'Bluesky profile',
  'app.bsky.feed.generator': 'Bluesky feeds',
  'app.bsky.feed.like': 'Bluesky like',
  'app.bsky.feed.post': 'Bluesky post',
  'app.bsky.feed.postgate': 'Bluesky postgate',
  'app.bsky.feed.repost': 'Bluesky repost',
  'app.bsky.feed.threadgate': 'Bluesky threadgate',
  'app.bsky.graph.block': 'Bluesky block',
  'app.bsky.graph.follow': 'Bluesky follow',
  'app.bsky.graph.list': 'Bluesky list',
  'app.bsky.graph.listblock': 'Bluesky listblock',
  'app.bsky.graph.listitem': 'Bluesky listitem',
  'app.bsky.graph.starterpack': 'Bluesky starterpack',
  'app.bsky.graph.verification': 'Bluesky verification',
  'app.popsky.comment': 'Comments on Popsky reviews',
  'app.popsky.like': 'Popsky like',
  'app.popsky.list': 'Popsky list',
  'app.popsky.listItem': 'Popsky Listitem',
  'app.popsky.review': 'Popsky Review',
  'blue.badge.collection': 'Badges collected on atproto.camp',
  'blue.flashes.actor.profile': 'Profile for flashes.blue',
  'chat.bsky.actor.declaration': 'Chat preferences for Bluesky',
  'com.imlunahey.pdf': 'PDSs uploaded to Bluesky using the PDF uploader created by @imlunahey.com',
  'com.whtwnd.blog.entry': 'Whtwnd Blog Entries',
  'place.stream.chat.message': 'Chat messages on place.stream',
  'place.stream.chat.profile': 'Profiles on place.stream',
  'place.stream.key': 'Stream keys for place.stream',
  'place.stream.livestream': 'Livestreams on place.stream',
  'sh.tangled.repo.issue': 'Issues added to tangled.sh repos',
  'sh.tangled.repo': 'Git repos on tangled.sh',
} as const;

export default function BlueskyToolsCARExplorerPage() {
  const params = useParams<{
    handle: Handle;
    lexicon: string | undefined;
  }>();
  const [input, setInput] = useState<Handle | null>(params.handle ?? null);
  const [handle, setHandle] = useState<Handle | null>(params?.handle ?? null);
  const [selectedId, setSelectedId] = useState<string | null | undefined>(params?.lexicon ?? 'index');
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
                <>
                  <Ariakit.Tab
                    key={`index-tab`}
                    id="index"
                    className="px-2 py-1 mb-4 border border-[#1a1a1a]"
                    render={<Link to={`/bluesky/tools/car-explorer/${handle}`} />}
                  >
                    <ArrowBigLeft />
                  </Ariakit.Tab>
                  <Card className="px-2 py-1 mb-4">{selectedId}</Card>
                </>
              )}
            </Ariakit.TabList>
            <div className="flex flex-col gap-4">
              <Ariakit.TabPanel key={`index-tab-panel`} tabId="index" className="flex flex-col gap-4">
                <VirtualisedList
                  data={Object.keys(data)}
                  renderItem={(item) => (
                    <Ariakit.Tab
                      key={`${item}-tab`}
                      id={item}
                      className="w-full text-left"
                      render={<Link to={`/bluesky/tools/car-explorer/${handle}/${item}`} />}
                    >
                      <Card className="p-4">
                        <span>{item}</span>
                        <div className="flex flex-col gap-2 text-sm text-gray-500">
                          <pre>{item in knownLexicons ? knownLexicons[item as keyof typeof knownLexicons] : 'Unknown'}</pre>
                        </div>
                      </Card>
                    </Ariakit.Tab>
                  )}
                />
              </Ariakit.TabPanel>
              {Object.keys(data).map((key) => (
                <Ariakit.TabPanel key={`${key}-tab-panel`} tabId={key}>
                  <VirtualisedList
                    data={data[key]}
                    renderItem={(item) => (
                      <AtProtoRecord rkey={item.rkey} record={item.record} open={data[key].length === 1} />
                    )}
                  />
                </Ariakit.TabPanel>
              ))}
            </div>
          </Ariakit.TabProvider>
        </Card>
      )}
    </div>
  );
}
