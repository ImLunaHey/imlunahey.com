import { Link } from '../elements/Link';

export const NavBar = () => {
  return (
    <>
      <Link
        to="/"
        classNames={{
          link: 'font-doto text-left text-4xl font-bold justify-start',
          text: 'text-left text-4xl font-bold',
        }}
        wrapper={false}
      >
        // LUNA
      </Link>
      <div className="mx-auto mb-2 max-w-screen-md border-b border-white pb-2">
        <div className="flex flex-wrap items-center justify-between">
          <Link to="/">Home</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/projects">Projects</Link>
          <Link to="/gallery">Gallery</Link>
          <Link to="/design">Design</Link>
          <Link to="/contact">Contact</Link>
        </div>
      </div>
    </>
  );
};
