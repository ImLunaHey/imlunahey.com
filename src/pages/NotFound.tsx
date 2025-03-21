import { Page } from '../components/Page';
import { NavBar } from '../components/NavBar';

export default function NotFoundPage() {
  return (
    <Page>
      <NavBar />
      <div className="flex items-center justify-center flex-col h-[calc(100dvh-100px)]">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-xl">Page not found</p>
      </div>
    </Page>
  );
}
