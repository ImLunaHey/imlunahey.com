import { NavBar } from '../components/NavBar';
import { Page } from '../components/Page';

export const HomePage = () => {
  return (
    <Page>
      <NavBar />
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-4xl font-bold">👋 hi, i'm luna</h1>
      </div>
    </Page>
  );
};
