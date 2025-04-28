import { Outlet } from 'react-router';
import { NavBar } from './NavBar';
import { Page } from './Page';

export default function Layout() {
  return (
    <Page>
      <NavBar />

      <div className="relative overflow-hidden">
        <Outlet />
      </div>
    </Page>
  );
}
