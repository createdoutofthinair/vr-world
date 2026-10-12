import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Box,
  Layers3,
  Footprints,
  Paintbrush,
  Download,
  Trees,
  Code2,
  Menu,
  X,
  Move3D,
  Check,
  Sparkles,
  Mountain,
  ChevronRight,
} from "lucide-react";
import logo from "../assets/logo.svg";
import { WorldIllustration } from "./WorldIllustration";
import { Theme, THEMES } from "../core/project";
const features = [
  {
    icon: Box,
    title: "Build from the smallest piece.",
    text: "Build shops, homes, apartments and connected villas. Configure storeys, stairs, true openings, roofs and reusable modules.",
    tag: "AVAILABLE NOW",
  },
  {
    icon: Footprints,
    title: "Make space you can step into.",
    text: "Inspect your interior from every angle. Switch from orbit to first-person walking and check the way through your creation.",
    tag: "AVAILABLE NOW",
  },
  {
    icon: Paintbrush,
    title: "Give every surface character.",
    text: "Start with seeded procedural materials or upload your own textures. Your surfaces travel with your saved project.",
    tag: "AVAILABLE NOW",
  },
  {
    icon: Layers3,
    title: "A workspace that works your way.",
    text: "Drag tabs, split views, resize panes, and keep the floor plan beside the model. Save your layout and pick up where you left off.",
    tag: "AVAILABLE NOW",
  },
  {
    icon: Download,
    title: "Your creation. Beyond the browser.",
    text: "Download RWX geometry and textures together. Inspect a browser reconstruction of the package before your native VP checks.",
    tag: "PROVISIONAL EXPORT",
  },
  {
    icon: Trees,
    title: "Grow from a room to a world.",
    text: "Generate seeded neighborhoods with roads and pavements. Shape owned terrain, grow biome-specific vegetation and connect creeks, bridges and waterfalls.",
    tag: "AVAILABLE NOW",
  },
];
export function Website() {
  const [compact, setCompact] = useState(false),
    [menu, setMenu] = useState(false),
    [theme, setTheme] = useState<Theme>("temperate");
  useEffect(() => {
    const scroll = () => setCompact(window.scrollY > 36);
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, []);
  useEffect(() => {
    const hash = location.hash;
    if (hash && hash !== "#home")
      requestAnimationFrame(() =>
        document.getElementById(hash.slice(1))?.scrollIntoView(),
      );
    else window.scrollTo(0, 0);
  }, []);
  return (
    <div className="website" id="home">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={`site-header ${compact ? "compact" : ""}`}>
        <div className="site-header-inner">
          <a className="brand" href="#home" aria-label="c3 World Studio home">
            <img src={logo} alt="" />
            <span>
              <b>c3</b> world studio<small>A WORLD OF YOUR MAKING</small>
            </span>
          </a>
          <nav aria-label="Main navigation" className={menu ? "open" : ""}>
            <a href="#features" onClick={() => setMenu(false)}>
              Features
            </a>
            <a href="#worlds" onClick={() => setMenu(false)}>
              World themes
            </a>
            <a href="#workflow" onClick={() => setMenu(false)}>
              How it works
            </a>
            <a href="#roadmap" onClick={() => setMenu(false)}>
              Roadmap
            </a>
          </nav>
          <a className="header-editor" href="#editor">
            Open editor <ArrowUpRight size={17} />
          </a>
          <button
            className="mobile-menu"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> YOUR NEXT PLACE STARTS HERE
            </div>
            <h1>
              Small pieces.
              <br />
              <em>Endless places.</em>
            </h1>
            <p>
              A browser workshop for buildings you can walk into.
              <br className="desktop-break" /> Shape the space. Make it yours.
              Take it with you.
            </p>
            <div className="hero-actions">
              <a href="#editor" className="btn accent">
                Start creating <ArrowUpRight size={20} />
              </a>
              <a href="#features" className="text-link">
                Explore the possibilities <ArrowRight size={16} />
              </a>
            </div>
            <div className="hero-meta">
              <span>
                <Check size={14} /> No account needed
              </span>
              <span>
                <Check size={14} /> Runs in your browser
              </span>
              <span>
                <Check size={14} /> Your own textures
              </span>
            </div>
          </div>
          <div className="hero-art">
            <WorldIllustration />
            <div className="scene-label">
              <span className="status-dot" /> MODULAR CITY STUDY{" "}
              <span>01 / CONCEPT</span>
            </div>
            <div className="floating-note note-one">
              <Box size={16} />
              <span>Every piece has a place.</span>
            </div>
            <div className="floating-note note-two">
              <Move3D size={16} />
              <span>Made to be explored.</span>
            </div>
          </div>
          <div className="hero-bottom">
            <span>DESIGN · EXPLORE · EXPORT</span>
            <span>
              Early-access foundation <i /> Built for Virtual Paradise workflows
            </span>
          </div>
        </section>
        <section className="intro-strip">
          <p>
            From a corner shop to a place
            <br />
            <b>that feels like somewhere.</b>
          </p>
          <div>
            <span>01</span>
            <p>
              Real geometry
              <br />
              <b>Real interiors</b>
            </p>
          </div>
          <div>
            <span>02</span>
            <p>
              Flexible workspace
              <br />
              <b>Creative control</b>
            </p>
          </div>
          <div>
            <span>03</span>
            <p>
              Portable projects
              <br />
              <b>RWX packages</b>
            </p>
          </div>
        </section>
        <section id="features" className="section features-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow dark">A TOOLBOX FOR YOUR IMAGINATION</div>
              <h2>Build it your way.</h2>
            </div>
            <p>
              Less friction between an idea
              <br />
              and somewhere you can explore.
            </p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text, tag }, i) => (
              <article className="feature-card" key={title}>
                <div className="feature-top">
                  <Icon size={26} />
                  <span>0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <div
                  className={`feature-tag ${tag === "PLANNED" ? "planned" : ""}`}
                >
                  {tag}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="workspace-showcase">
          <div className="workspace-copy">
            <div className="eyebrow">SPACE TO THINK. TOOLS TO MAKE.</div>
            <h2>
              Your workshop.
              <br />
              Your arrangement.
            </h2>
            <p>
              A familiar creative workspace with a living model at its centre.
              Move the panes around your process, not the other way around.
            </p>
            <ul>
              <li>
                <Check size={16} /> Dockable tabs and resizable panes
              </li>
              <li>
                <Check size={16} /> Linked floor plan and 3D selection
              </li>
              <li>
                <Check size={16} /> Walkthrough and exported-file preview
              </li>
            </ul>
            <a href="#editor" className="text-link light">
              Step into the editor <ArrowUpRight size={18} />
            </a>
          </div>
          <div
            className="workspace-art"
            aria-label="Illustration of the editor workspace"
          >
            <div className="mock-title">
              <img src={logo} alt="" />
              c3 World Studio <span>Corner workshop</span>
              <i />
              <i />
              <i />
            </div>
            <div className="mock-body">
              <div className="mock-sidebar">
                <small>EXPLORER</small>
                {[
                  "▾ Corner workshop",
                  "  ▾ Structure",
                  "    ▫ Floor",
                  "    ▫ Front wall",
                  "    ▫ Doorway",
                  "  ▾ Windows",
                  "    ▫ Window frame",
                  "  ▾ Interior",
                ].map((v, i) => (
                  <span key={i}>{v}</span>
                ))}
                <div className="mock-plan">
                  <svg viewBox="0 0 100 75">
                    <path
                      d="M10 65V10H90V65H58M42 65H10"
                      fill="none"
                      stroke="#b9d0b5"
                      strokeWidth="5"
                    />
                    <path
                      d="M42 65V49Q58 49 58 65"
                      fill="none"
                      stroke="#859c81"
                      strokeWidth="1"
                    />
                    <rect x="67" y="23" width="13" height="31" fill="#6f8c74" />
                  </svg>
                </div>
              </div>
              <div className="mock-canvas">
                <div className="mock-tab">
                  3D workspace <span>Floor plan</span>
                </div>
                <WorldIllustration compact />
                <div className="mock-tools">
                  <Box size={14} /> ORBIT <span>·</span> WALK <span>·</span>{" "}
                  CUTAWAY
                </div>
              </div>
              <div className="mock-properties">
                <small>BUILDING RECIPE</small>
                {["Width", "Depth", "Height", "Wall thickness"].map((v, i) => (
                  <div key={v}>
                    <span>
                      {v}
                      <b>{[8, 7, 3.2, 0.22][i]} m</b>
                    </span>
                    <i>
                      <em style={{ width: `${[65, 55, 40, 25][i]}%` }} />
                    </i>
                  </div>
                ))}
                <small>MATERIALS</small>
                <div className="mock-swatches">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
            <div className="mock-status">
              <span className="status-dot" /> Saved locally{" "}
              <span>ILLUSTRATIVE WORKSPACE</span>
            </div>
          </div>
        </section>
        <section id="worlds" className="section worlds-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow dark">
                FIVE WORLDS. DISTINCT CHARACTER.
              </div>
              <h2>Where will you begin?</h2>
            </div>
            <p>
              Explore architecture and vegetation together.
              <br />
              Then mix the building style and biome yourself.
            </p>
          </div>
          <div className="world-picker">
            {Object.entries(THEMES).map(([id, t]) => (
              <button
                key={id}
                className={theme === id ? "active" : ""}
                onClick={() => setTheme(id as Theme)}
              >
                <span style={{ background: t.palette.ground }} />
                {t.label}
                {theme === id && <Check size={15} />}
              </button>
            ))}
          </div>
          <div className={`theme-showcase theme-${theme}`}>
            <div>
              <span className="theme-index">
                WORLD THEME / {theme.toUpperCase()}
              </span>
              <h3>
                {THEMES[theme].label}
                <br />
                by your design.
              </h3>
              <p>{THEMES[theme].caption}</p>
              <a className="btn dark-btn" href={`#editor?theme=${theme}`}>
                Explore this world <ArrowUpRight size={17} />
              </a>
              <small>
                Generated geometry preview. Open the editor for textured 3D.
              </small>
            </div>
            <img
              className="generated-scene"
              src={`${import.meta.env.BASE_URL}scenes/c3-${theme}.png`}
              alt={`${THEMES[theme].label} architecture and procedural vegetation`}
            />
          </div>
        </section>
        <section id="workflow" className="section workflow-section">
          <div className="eyebrow dark">FROM FIRST PIECE TO FIRST WALK</div>
          <h2>Ideas become places.</h2>
          <div className="workflow-grid">
            {[
              {
                icon: Box,
                title: "Choose your starting point.",
                text: "Load a shop, house, or studio villa shell. Set the dimensions and make space for your idea.",
              },
              {
                icon: Paintbrush,
                title: "Shape the details.",
                text: "Adjust openings, roof and interior. Choose a world theme, shape its vegetation, add your textures, and arrange your views.",
              },
              {
                icon: Footprints,
                title: "Explore. Then take it along.",
                text: "Walk through your build, inspect the exported files, and download your editable project and RWX package.",
              },
            ].map(({ icon: Icon, title, text }, i) => (
              <article key={title}>
                <div>
                  <span>0{i + 1}</span>
                  <Icon size={23} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="roadmap" className="section roadmap-section">
          <div>
            <div className="eyebrow">A WORLD THAT KEEPS GROWING</div>
            <h2>
              The foundation is here.
              <br />
              The horizon is open.
            </h2>
            <p>
              We’re building in usable steps, with the browser preview and
              export moving forward together.
            </p>
            <a
              href="https://github.com/createdoutofthinair/vr-world"
              target="_blank"
              rel="noreferrer"
              className="text-link light"
            >
              Follow development on GitHub <ArrowUpRight size={17} />
            </a>
          </div>
          <div className="roadmap-list">
            <div className="current">
              <span>01</span>
              <div>
                <b>Building workshop</b>
                <p>
                  Themed architecture, furnished rooms, procedural plants, owned
                  terrain, uploads, walkthrough, and provisional RWX packages.
                </p>
              </div>
              <small>NOW</small>
            </div>
            <div>
              <span>02</span>
              <div>
                <b>Richer buildings & verified imports</b>
                <p>
                  Rooms, storeys, stairways, reusable modules, AWG groups, and
                  native VP comparison.
                </p>
              </div>
              <small>NEXT</small>
            </div>
            <div>
              <span>03</span>
              <div>
                <b>Streets, cities & living landscapes</b>
                <p>
                  Connected roads and districts, richer terrain, creek networks,
                  waterfalls, and animated world effects.
                </p>
              </div>
              <small>PLANNED</small>
            </div>
          </div>
        </section>
        <section className="final-cta">
          <div className="cta-cube">
            <img src={logo} alt="" />
          </div>
          <div className="eyebrow dark">THE FIRST PIECE IS YOURS</div>
          <h2>Make somewhere.</h2>
          <p>Start small. See where it takes you.</p>
          <a className="btn dark-btn" href="#editor">
            Open the world editor <ArrowUpRight size={20} />
          </a>
        </section>
      </main>
      <footer className="site-footer">
        <a className="brand" href="#home">
          <img src={logo} alt="" />
          <span>
            <b>c3</b> world studio
          </span>
        </a>
        <p>Small pieces. Endless places.</p>
        <a
          href="https://github.com/createdoutofthinair/vr-world"
          target="_blank"
          rel="noreferrer"
        >
          <Code2 size={16} /> Source & roadmap <ChevronRight size={14} />
        </a>
        <span>© {new Date().getFullYear()} c3 World Studio</span>
      </footer>
    </div>
  );
}
