import { useEffect, useState } from "react";
import logo from "../assets/logo.svg";
import chapters from "./serverArchitecture.json";
import "./serverArchitecture.css";
const KEY = "c3-server-architecture-decisions-v1";
export function ServerArchitecture() {
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
  });
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const scroll = () => {
      const id = location.hash.split("/")[1];
      if (id) document.getElementById(id)?.scrollIntoView();
      else window.scrollTo(0, 0);
    };
    scroll();
    window.addEventListener("hashchange", scroll);
    return () => window.removeEventListener("hashchange", scroll);
  }, []);
  function updateNotes(value: string) {
    setNotes(value);
    try { localStorage.setItem(KEY, value); setNotice("Saved in this browser"); }
    catch { setNotice("Storage unavailable. Export your notes to retain them."); }
  }
  function downloadNotes() {
    const url = URL.createObjectURL(new Blob(["# c3 multiplayer architecture decisions\n\n" + notes], { type: "text/markdown" }));
    const a = document.createElement("a"); a.href = url; a.download = "c3-server-decisions.md"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="architecture-page">
    <a className="skip-link" href="#architecture/content">Skip to documentation</a>
    <header className="architecture-header">
      <a className="brand" href="#home"><img src={logo} alt="" /><span><b>c3</b> world studio<small>A WORLD OF YOUR MAKING</small></span></a>
      <nav aria-label="Main navigation"><a href="#home">Website</a><a href="#architecture" aria-current="page">Architecture</a><a href="#editor">Open editor ↗</a></nav>
    </header>
    <div className="architecture-layout">
      <aside className="architecture-nav"><p className="architecture-kicker">DESIGN REVIEW / 01</p><h2>Server architecture</h2>
        <label htmlFor="architecture-search">Find a chapter</label><input id="architecture-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Physics, memory, animation…" />
        <nav aria-label="Architecture chapters">{chapters.filter(c => c.title.toLowerCase().includes(query.toLowerCase())).map(c => <a key={c.id} href={`#architecture/${c.id}`}>{c.title}</a>)}</nav>
        {chapters.filter(c => c.title.toLowerCase().includes(query.toLowerCase())).length === 0 && <p>No matching chapter titles.</p>}
      </aside>
      <main id="content" className="architecture-content">
        <div className="architecture-hero"><p className="architecture-kicker">RUST · WEBASSEMBLY · AUTHORITATIVE PHYSICS</p><h1>One simulation.<br />Two runtimes.</h1><p>Production-oriented multiplayer design for c3 World Studio: lightweight collision worlds, shared physics and responsive browser clients.</p><div className="architecture-badges"><span>Proposal — not implemented</span><span>{chapters.length} chapters</span><span>Research: 12 October 2026</span></div><div className="architecture-actions"><button onClick={() => window.print()}>Print / save PDF</button><a href={`${import.meta.env.BASE_URL}docs/c3-server-architecture.html`} download>Download complete HTML ↗</a></div></div>
        {chapters.map(c => <section key={c.id} id={c.id}><p className="architecture-kicker">ARCHITECTURE / DECISIONS</p><h2>{c.title}</h2><div className="architecture-prose" dangerouslySetInnerHTML={{ __html: c.html }} /></section>)}
        <section id="decisions"><h2>Your decision notebook</h2><p>Notes stay in this browser. Export them to retain or share a copy; they are not synchronized to GitHub.</p><label htmlFor="architecture-notes">Decisions and open questions</label><textarea id="architecture-notes" rows={8} value={notes} onChange={e => updateNotes(e.target.value)} /><button onClick={downloadNotes}>Export notes</button><p role="status">{notice}</p></section>
        <footer><a href="#home">← Back to c3 World Studio</a><a href="https://github.com/createdoutofthinair/vr-world">Source on GitHub ↗</a></footer>
      </main>
    </div>
  </div>;
}
