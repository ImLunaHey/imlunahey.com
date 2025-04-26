import { Outlet } from 'react-router';
import { Page } from './Page';
import { NavBar } from './NavBar';

export default function Layout() {
  return (
    <Page>
      <NavBar />
      <Outlet />
    </Page>
  );
}
