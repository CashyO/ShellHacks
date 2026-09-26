// P1 (Joeco): colors are from ARCHITECTURE §8.
const TYPES = [
  ["feature", "#2E6BE6"],
  ["improvement", "#7B4ED8"],
  ["fix", "#C27C06"],
  ["security", "#D23C35"],
  ["test", "#0C8585"],
] as const;

export default function Legend() {
  return (
    <ul className="flex gap-3 text-xs">
      {TYPES.map(([name, color]) => (
        <li key={name} className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
          {name}
        </li>
      ))}
    </ul>
  );
}
