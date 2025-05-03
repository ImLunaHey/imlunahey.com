import { Outlet } from 'react-router';
import { NavBar } from './NavBar';
import { Page } from './Page';

export default function Layout() {
  return (
    <Page>
      <NavBar />

      <div className="relative h-full overflow-hidden">
        <Outlet />
      </div>
    </Page>
  );
}
