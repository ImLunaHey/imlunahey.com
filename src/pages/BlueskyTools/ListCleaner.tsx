import { useEffect, useState } from 'react';
import { Button } from '../../elements/Button';
import { Card } from '../../components/Card';
import { Input } from '../../elements/Input';
import { AtpSessionData, CredentialManager, XRPC } from '@atcute/client';
import { AppBskyActorDefs, AppBskyGraphDefs } from '@atcute/client/lexicons';
import { MarkdownPreview } from '../../components/MarkdownPreview';
import { Loading } from '../../components/Loading';

const manager = new CredentialManager({ service: 'https://bsky.social' });
const rpc = new XRPC({ handler: manager });

export default function BlueskyToolsListCleanerPage() {
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [session, setSession] = useState<AtpSessionData | null>(null);
  const [profile, setProfile] = useState<AppBskyActorDefs.ProfileViewDetailed | null>(null);
  const [lists, setLists] = useState<
    {
      uri: string;
      list: AppBskyGraphDefs.ListView | null;
      creator: AppBskyActorDefs.ProfileViewDetailed | AppBskyActorDefs.ProfileView | null;
      rkey: string;
    }[]
  >([]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setSession(await manager.login({ identifier: handle, password: appPassword }));

    const { data } = await rpc.get('app.bsky.actor.getProfile', {
      params: {
        actor: handle,
      },
    });

    setProfile(data);
  };

  useEffect(() => {
    const fetchLists = async () => {
      const listRecords = await rpc
        .get('com.atproto.repo.listRecords', {
          params: {
            repo: session!.did,
            collection: 'app.bsky.graph.listblock',
            limit: 100,
          },
        })
        .then(
          (res) =>
            res.data as {
              records: {
                uri: string;
                cid: string;
                value: { $type: 'app.bsky.graph.listblock'; subject: string; createdAt: string };
              }[];
            },
        )
        .then((res) => res.records.sort((a, b) => b.value.createdAt.localeCompare(a.value.createdAt)))
        .then((lists) => {
          // dedupe lists by their uri
          const dedupedLists = lists.filter(
            (list, index, self) => self.findIndex((t) => t.value.subject === list.value.subject) === index,
          );

          return dedupedLists;
        });

      const lists: {
        uri: string;
        list: AppBskyGraphDefs.ListView | null;
        creator: AppBskyActorDefs.ProfileViewDetailed | AppBskyActorDefs.ProfileView | null;
        rkey: string;
      }[] = [];
      for (const record of listRecords) {
        const list = await rpc
          .get('app.bsky.graph.getList', {
            params: {
              list: record.value.subject,
            },
          })
          .then((res) => ({
            uri: record.value.subject,
            list: res.data.list,
            creator: res.data.list.creator,
            rkey: record.uri.split('/').pop()!,
          }))
          .catch(async () => {
            const creator = await rpc
              .get('app.bsky.actor.getProfile', {
                params: {
                  actor: record.value.subject.split('//').pop()!.split('/')[0]!,
                },
              })
              .catch(() => null);

            return {
              uri: record.value.subject,
              list: null,
              creator: creator?.data ?? null,
              rkey: record.uri.split('/').pop()!,
            };
          });

        lists.push(list);
      }

      setLists(lists);
      console.info({ lists });
    };

    if (!session) return;
    void fetchLists().catch(console.error);
  }, [session]);

  const handleRemoveList = async (rkey: string) => {
    const confirmed = confirm('Are you sure you want to unsubscribe from this list?');
    if (!confirmed) return;

    await rpc.call('com.atproto.repo.deleteRecord', {
      data: {
        collection: 'app.bsky.graph.listblock',
        repo: handle,
        rkey,
      },
    });

    setLists(lists.filter((list) => list.rkey !== rkey));
  };

  return (
    <div className="flex flex-col gap-2">
      <Card className="p-4">
        <h1>List Cleaner</h1>
        <p>
          This tool will remove lists you are subscribed to that have been deleted or were made by accounts that are
          deleted/suspended.
        </p>
      </Card>

      <Card className="p-4">
        {profile ? (
          <div>
            <h2>Profile</h2>
            <p>{profile.displayName}</p>
            <p>{profile.handle}</p>
            <p>{profile.description}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label="Handle"
              value={handle}
              onChangeValue={(value) => setHandle(value)}
              placeholder="Handle (e.g. user.bsky.social)"
              required
            />

            <Input
              type="password"
              label="App Password"
              value={appPassword}
              onChangeValue={(value) => setAppPassword(value)}
              placeholder="App Password"
              required
            />

            <Button type="submit">Login</Button>
          </form>
        )}
      </Card>

      {profile && (
        <>
          {lists.length === 0 ? (
            <Card className="p-4">
              <Loading />
            </Card>
          ) : (
            lists.map(({ uri, list, creator, rkey }) => {
              return (
                <Card key={rkey} className="p-4">
                  <div className="relative flex flex-col gap-2">
                    <button
                      onClick={() => handleRemoveList(rkey)}
                      className="absolute top-0 right-0 cursor-pointer text-red-500"
                      aria-label="Remove list"
                    >
                      x
                    </button>
                    <div className="flex flex-row gap-2">
                      {creator || list?.creator ? (
                        <img
                          src={creator?.avatar ?? list?.creator.avatar}
                          alt={creator?.displayName ?? list?.creator.displayName}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-200" />
                      )}
                      <div className="flex flex-col">
                        <p>{list ? list.name : 'List Deleted'}</p>
                        <p>
                          Moderation list by{' '}
                          <span className="font-bold">
                            {creator
                              ? creator.displayName
                              : list?.creator
                                ? list.creator.displayName
                                : uri.split('//').pop()?.split('/')[0]}
                          </span>
                        </p>
                      </div>
                    </div>
                    {list ? list.description && <MarkdownPreview content={list.description} /> : 'List was deleted'}
                  </div>
                </Card>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
