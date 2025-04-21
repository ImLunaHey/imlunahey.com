import { HoverCard, HoverCardContent, HoverCardPortal, HoverCardTrigger } from '@radix-ui/react-hover-card';
import { useProfile } from '../hooks/use-profile';
import { formatNumber } from '../lib/format-number';
import { Link } from 'react-router';

export const ProfileCard = ({ actor }: { actor: string }) => {
  const { data: profile, isLoading } = useProfile({ actor });
  const profileHandleLength = profile?.handle?.length ?? 0;
  const cutOff = 25;
  const handle = profile?.handle?.slice(0, cutOff) + (profileHandleLength > cutOff ? '...' : '');

  if (!profile || isLoading) {
    return null;
  }

  return (
    <HoverCard>
      <HoverCardTrigger>@{handle}</HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent
          className="w-[300px] border border-[#1a1a1a] rounded-md bg-black p-5 shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade data-[side=right]:animate-slideLeftAndFade data-[side=top]:animate-slideDownAndFade data-[state=open]:transition-all"
          sideOffset={5}
        >
          <div className="flex flex-col gap-[7px]">
            <Link to={`https://bsky.app/profile/${actor}`}>
              <img className="block size-[60px] rounded-full" src={profile?.avatar} alt={profile?.displayName} />
            </Link>
            <div className="flex flex-col gap-[15px]">
              <div>
                <Link to={`https://bsky.app/profile/${actor}`} className="hover:no-underline">
                  <div className="m-0 text-[15px] font-medium">{profile?.displayName}</div>
                </Link>
                <Link to={`https://bsky.app/profile/${actor}`} className="hover:no-underline">
                  <div className="m-0 text-[15px]">@{handle}</div>
                </Link>
              </div>
              <div className="m-0 text-[15px]">{profile?.description}</div>
              <div className="flex gap-[15px]">
                <div className="flex gap-[5px]">
                  <div className="m-0 text-[15px] font-medium">{formatNumber(profile?.followersCount ?? 0)}</div>{' '}
                  <div className="m-0 text-[15px]">Followers</div>
                </div>
                <div className="flex gap-[5px]">
                  <div className="m-0 text-[15px] font-medium">{formatNumber(profile?.followsCount ?? 0)}</div>{' '}
                  <div className="m-0 text-[15px]">Following</div>
                </div>
              </div>
            </div>
          </div>
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
};
