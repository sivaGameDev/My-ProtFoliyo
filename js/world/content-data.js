// Real profile content, reused verbatim from the source portfolio content.
// Each entry maps 1:1 to a milestone terminal on the station.

export const MILESTONES = [
  {
    id: "about",
    label: "About Me",
    prompt: "View About Me",
    title: "Identity Terminal — About Me",
    accentColor: 0x5eead4,
    render() {
      return `
        <p>I'm a Game Systems Engineer at Lens Medical Visualization, based in the Greater Bengaluru Area, where I design 3D/2D application systems using C#, JavaScript, and AI-assisted tooling.</p>
        <p>My background is in Information Technology, and I've spent it gravitating toward the intersection of interactive graphics and intelligent input — from building computer-vision tools that control an OS hands-free, to integrating OpenCV hand tracking into Unity 3D for touchless gaming.</p>
        <p>I like working close to the engine: PlayCanvas and Unity for building the experience, computer vision and AI tooling for making it respond to the real world.</p>
        <h4>A Few Things</h4>
        <div class="tag-row">
          <span class="tag">🎮 Building interactive 3D/2D worlds</span>
        </div>
        <div class="tag-row">
          <span class="tag">👋 Touchless input &amp; hand-tracking experiments</span>
        </div>
        <div class="tag-row">
          <span class="tag">🤖 Exploring AI-assisted dev workflows</span>
        </div>
        <div class="tag-row">
          <span class="tag">📍 Based in Bengaluru, India</span>
        </div>
        <h4>Skills — Game &amp; 3D/2D Development</h4>
        <div class="tag-row">
          <span class="tag">PlayCanvas</span><span class="tag">Unity</span><span class="tag">C#</span><span class="tag">JavaScript</span>
        </div>
        <h4>Skills — Computer Vision &amp; AI</h4>
        <div class="tag-row">
          <span class="tag">Python</span><span class="tag">OpenCV</span><span class="tag">AI-Assisted Tooling</span>
        </div>
        <h4>Skills — Web &amp; Tools</h4>
        <div class="tag-row">
          <span class="tag">WordPress</span><span class="tag">HTML5</span><span class="tag">CSS / Bootstrap</span><span class="tag">DBMS</span><span class="tag">Git</span>
        </div>
      `;
    },
  },
  {
    id: "projects",
    label: "Projects",
    prompt: "Explore Projects",
    title: "Project Bay — Selected Projects",
    accentColor: 0xffb454,
    render() {
      const projects = [
        {
          icon: "🧩",
          title: "2D Match-3 Puzzle",
          desc: "A 2D match-3 puzzle built in Unity — clear sets of three identical items as the shelf continuously refills, racing to clear the board before the timer runs out.",
          tech: "Unity · C# · 2D",
        },
        {
          icon: "🏃",
          title: "Procedural Escape Runner",
          desc: "A Mario-inspired escape game in Unity with auto-generated terrain and obstacles — every level is procedurally built, so players react and adapt to escape dynamically changing traps.",
          tech: "Unity · C# · Procedural Generation",
        },
        {
          icon: "❓",
          title: "Interactive MCQ Runner",
          desc: "A PlayCanvas endless-loop world where items, obstacles, and interactables spawn continuously — players escape and interact with the environment to progress, with the core loop customized to deliver multiple-choice questions.",
          tech: "PlayCanvas · JavaScript",
        },
        {
          icon: "🧑",
          title: "VR Knowledge Room",
          desc: "A Unity VR experience where users roam a virtual room and complete a set of guided activities designed to explain cause-and-effect concepts in an immersive, educational way.",
          tech: "Unity · C# · VR",
        },
        {
          icon: "🖥️",
          title: "3D Scroll Portfolio Experience",
          desc: "A PlayCanvas static site presenting a simple 3D model viewer — scroll-driven interaction reveals a company's digital portfolio as an animated, interactive showcase.",
          tech: "PlayCanvas · JavaScript · WebGL",
        },
      ];
      return `
        <p>A few of my recent builds. Titles, images, and links are withheld under NDA — descriptions are accurate to what I can share.</p>
        ${projects
          .map(
            (p) => `
          <div class="project-item">
            <h5>${p.icon} ${p.title}</h5>
            <p>${p.desc}</p>
            <div class="tag-row"><span class="tag">${p.tech}</span></div>
            <span class="nda">🔒 Confidential build — real name &amp; links withheld under NDA</span>
          </div>
        `
          )
          .join("")}
      `;
    },
  },
  {
    id: "resume",
    label: "Experience & Education",
    prompt: "View Experience & Education",
    title: "Mission Log — Experience & Education",
    accentColor: 0x60a5fa,
    render() {
      return `
        <p>A quick look at my professional journey.</p>
        <h4>💼 Work Experience</h4>
        <div class="timeline-entry">
          <span class="date">May 2025 — Present</span>
          <h5>Game System Engineer</h5>
          <span class="org">Lens Medical Visualization · Bengaluru</span>
          <p>Working as a 3D/2D application system designer using C#, JavaScript, and AI tools to build interactive visualization systems.</p>
        </div>
        <h4>🎓 Education</h4>
        <div class="timeline-entry">
          <span class="date">2020 — 2024</span>
          <h5>B.Tech, Information Technology</h5>
          <span class="org">Mookambigai College of Engineering</span>
        </div>
        <div class="timeline-entry">
          <span class="date">2017 — 2019</span>
          <h5>Diploma, Computer Engineering</h5>
          <span class="org">Seshasayee Institute of Technology</span>
        </div>
        <div class="timeline-entry">
          <span class="date">2016</span>
          <h5>SSLC (10th Grade)</h5>
          <span class="org">St. Little Flower Matriculation Hr. Sec. School</span>
        </div>
        <a class="btn-enter" href="assets/docs/resume.pdf" download>⬇ Download Resume (PDF)</a>
      `;
    },
  },
  {
    id: "contact",
    label: "Contact",
    prompt: "Get In Touch",
    title: "Comms Uplink — Get In Touch",
    accentColor: 0xa78bfa,
    render() {
      return `
        <p>Whether you have a question or just want to connect, feel free to reach out — I'll get back to you as soon as I can.</p>
        <div class="contact-line"><span>✉</span> <div><strong>Email</strong><br />sivasankaran.s1231811@outlook.com</div></div>
        <div class="contact-line"><span>📍</span> <div><strong>Location</strong><br />Greater Bengaluru Area, India</div></div>
        <a class="btn-enter" href="https://www.linkedin.com/in/sivasankaranravichandran-b2a31b16b" target="_blank" rel="noopener">Connect on LinkedIn</a>
      `;
    },
  },
];
