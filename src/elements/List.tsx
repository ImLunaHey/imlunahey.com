export const List = ({ items, ordered }: { items: string[]; ordered?: boolean }) => {
  if (ordered) {
    return (
      <ol className="list-inside list-decimal">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  }

  return (
    <ul className="list-inside">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2">
          <div className="bg-primary size-2" />
          {item}
        </li>
      ))}
    </ul>
  );
};
