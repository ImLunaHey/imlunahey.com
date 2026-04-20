import { Outlet } from '@tanstack/react-router';
import { NavBar } from './NavBar';

export default function Layout() {
  return (
    <>
      <NavBar />
      <Outlet />
    </>
  );
}
