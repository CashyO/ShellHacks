// P2 (Julian): color the lines: + green, - red, @@ blue.
export default function DiffView({ diff }: { diff: string }) {
  return <pre className="overflow-x-auto text-xs">{diff}</pre>;
}
