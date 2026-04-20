export default function ContactPage() {
  return (
    <div className="flex flex-col gap-4 p-4 bg-black border border-[#1a1a1a]">
      <p>
        You can contact me via Bluesky:{' '}
        <a href="https://bsky.app/profile/imlunahey.com" className="text-blue-400 hover:underline">
          @imlunahey.com
        </a>
      </p>
    </div>
  );
}
