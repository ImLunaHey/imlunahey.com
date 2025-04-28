import { LogIn, LogOut } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { ProfileCard } from './ProfileCard';
import { Link } from 'react-router';
import { useProfile } from '../hooks/use-profile';
import { useState } from 'react';

const BlueskyAvatar = () => {
  const { data: profile, isLoading } = useProfile({ actor: 'imlunahey.com' });

  if (!profile || isLoading) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <img src={profile.avatar} className="w-6 h-6 rounded-full" />
      <Link to={`https://bsky.app/profile/${profile.did}`} className="text-gray-500">
        <ProfileCard actor={profile.did} />
      </Link>
    </div>
  );
};

export const BlueskyBar = () => {
  const [authenticated] = useState(false);

  // @TODO: implement authentication
  return null;

  if (!authenticated) {
    return (
      <Card className="p-4 flex flex-col gap-4">
        <div className="flex justify-end">
          <Button className="w-fit" label="Login" onClick={() => {}}>
            <LogIn className="size-4" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex flex-col gap-4">
      <div className="flex justify-between">
        <BlueskyAvatar />
        <Button className="w-fit" label="Logout" onClick={() => {}}>
          <LogOut className="size-4" />
        </Button>
      </div>
    </Card>
  );
};
