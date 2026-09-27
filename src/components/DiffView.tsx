// Colors a unified diff: + green, - red, @@ blue, file headers bold.
export default function DiffView({ diff }: { diff: string }) {
  const lines = diff.split("\n");
  return (
    <pre className="max-h-80 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-2 font-mono text-[11px] leading-5 dark:border-neutral-800 dark:bg-neutral-900">
      {lines.map((line, i) => {
        let cls = "text-neutral-600 dark:text-neutral-400";
        if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("====") || line.startsWith("Index:")) {
          cls = "font-semibold text-neutral-900 dark:text-neutral-100";
        } else if (line.startsWith("@@")) {
          cls = "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
        } else if (line.startsWith("+")) {
          cls = "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300";
        } else if (line.startsWith("-")) {
          cls = "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300";
        }
        return (
          <div key={i} className={`whitespace-pre px-1 ${cls}`}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}
