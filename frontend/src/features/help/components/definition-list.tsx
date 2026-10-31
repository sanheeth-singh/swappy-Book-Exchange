import type { HelpEntry } from "../content";
export function DefinitionList({ entries }: { entries: Record<string, HelpEntry> }) { return <dl className="definition-list">{Object.entries(entries).map(([key, entry]) => <div key={key}><dt>{entry.label}</dt><dd>{entry.description}</dd></div>)}</dl>; }
