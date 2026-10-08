"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type { SearchItem } from "@/modules/campus/data/fixtures";
import { campusModules, getModule } from "@/modules/campus/data/modules";
import { useCampus } from "./campus-context";

const moduleSearch: SearchItem[] = campusModules.map((module) => ({ id: module.id, title: module.title, description: module.description, module: module.id, kind: "module" }));
const searchable = moduleSearch;
const categories = ["All", "Modules"] as const;
type Category = typeof categories[number];
const kinds: Record<Category, SearchItem["kind"] | null> = { All: null, Modules: "module" };

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const { navigate, openDetail } = useCampus();
  const results = useMemo(() => searchable.filter((item) => (!kinds[category] || item.kind === kinds[category]) && `${item.title} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 20), [query, category]);

  function select(item: SearchItem) {
    onClose();
    if (item.kind === "module") navigate(item.module);
    else openDetail({ kind: item.kind, id: item.id });
  }

  return <Dialog open={open} onClose={onClose} title="Find your way around campus" description="Find a connected campus module. Use each module’s account-aware search for its published records." initialFocus={input} className="search-dialog">
    <form className="search-field" onSubmit={(event) => { event.preventDefault(); if (results[0]) select(results[0]); }}><Search size={21} /><label className="sr-only" htmlFor="campus-search">Search campus</label><input ref={input} id="campus-search" placeholder="Try “SQL”, “bus”, or “clubs”…" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" /><kbd>Enter</kbd></form>
    <div className="filter-tabs" aria-label="Search categories">{categories.map((value) => <button key={value} aria-pressed={category === value} className={category === value ? "is-active" : ""} onClick={() => setCategory(value)}>{value}</button>)}</div>
    <div className="search-results-heading"><span>{query ? "Search results" : "A good place to start"}</span><span aria-live="polite">{results.length} results</span></div>
    <div className="search-results">{results.map((item) => { const Icon = getModule(item.module).icon; return <button key={`${item.kind}-${item.id}`} className="search-result" onClick={() => select(item)}><span className="search-result-icon"><Icon size={19} /></span><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowUpRight size={17} /></button>; })}
      {!results.length && <div className="empty-search"><SlidersHorizontal size={26} /><h3>No matches yet.</h3><p>Try a shorter phrase or look in another category.</p><button className="text-button" onClick={() => { setQuery(""); setCategory("All"); input.current?.focus(); }}>Clear search</button></div>}
    </div><div className="search-footer"><span>Module navigation · account-aware results inside each workspace</span><span><kbd>esc</kbd> to close</span></div>
  </Dialog>;
}
