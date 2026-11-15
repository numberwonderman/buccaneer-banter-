// Phone controls: four on-screen walk buttons (bottom left) and a Talk button
// (bottom right). They are ordinary HTML buttons laid over the game, so they
// stay finger-sized however the game picture is scaled.
//
// They appear only on a touch device (or with ?touch=1 in the address), and
// they hide while the dialogue box is open: there you tap the screen to
// continue and tap a choice to pick it. The keyboard is untouched by all this.

export const touch = { enabled: false, left: false, right: false, up: false, down: false };

let root = null;
let talkBtn = null;
let talkHandler = null;
let shown = null;

const CSS = `
#touch-ui { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: system-ui, sans-serif;
  --b: clamp(54px, 16vmin, 88px); }
#touch-ui.off { display: none; }
#touch-ui button { pointer-events: auto; touch-action: none; -webkit-user-select: none; user-select: none;
  -webkit-tap-highlight-color: transparent; position: absolute; width: var(--b); height: var(--b);
  background: rgba(16, 12, 8, 0.45); color: #f5e8c8; border: 3px solid #f5e8c8; border-radius: 14px;
  font-size: calc(var(--b) * 0.42); font-weight: bold; padding: 0; }
#touch-ui button.held { background: rgba(255, 205, 80, 0.9); color: #100c08; }
#touch-pad { position: absolute; left: max(10px, env(safe-area-inset-left)); bottom: max(10px, env(safe-area-inset-bottom));
  width: calc(var(--b) * 3); height: calc(var(--b) * 3); }
#touch-pad [data-dir=up]    { left: var(--b); top: 0; }
#touch-pad [data-dir=left]  { left: 0; top: var(--b); }
#touch-pad [data-dir=right] { left: calc(var(--b) * 2); top: var(--b); }
#touch-pad [data-dir=down]  { left: var(--b); top: calc(var(--b) * 2); }
#touch-ui #touch-talk { right: max(14px, env(safe-area-inset-right)); bottom: max(22px, env(safe-area-inset-bottom));
  width: calc(var(--b) * 1.7); height: calc(var(--b) * 1.7); border-radius: 50%; font-size: calc(var(--b) * 0.36);
  border-color: #ffcd50; color: #ffcd50; }
#touch-ui #touch-talk.idle { opacity: 0.4; }
#touch-turn { display: none; position: fixed; top: 0; left: 0; right: 0; padding: 10px; text-align: center;
  background: #100c08; color: #ffcd50; font: bold 18px system-ui, sans-serif; z-index: 11; }
@media (orientation: portrait) { #touch-ui:not(.gone) ~ #touch-turn { display: block; } }
`;

function clearDirs() {
  touch.left = touch.right = touch.up = touch.down = false;
  root?.querySelectorAll("button.held").forEach((b) => b.classList.remove("held"));
}

function build() {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  root = document.createElement("div");
  root.id = "touch-ui";
  const pad = document.createElement("div");
  pad.id = "touch-pad";
  const dirs = [["up", "▲"], ["left", "◀"], ["right", "▶"], ["down", "▼"]];
  for (const [dir, glyph] of dirs) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.dir = dir;
    b.textContent = glyph;
    b.setAttribute("aria-label", `Walk ${dir}`);
    const set = (on) => { touch[dir] = on; b.classList.toggle("held", on); };
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch {} set(true); });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, () => set(false));
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    pad.appendChild(b);
  }
  root.appendChild(pad);

  talkBtn = document.createElement("button");
  talkBtn.type = "button";
  talkBtn.id = "touch-talk";
  talkBtn.textContent = "Talk";
  talkBtn.setAttribute("aria-label", "Talk");
  talkBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); talkHandler?.(); });
  talkBtn.addEventListener("contextmenu", (e) => e.preventDefault());
  root.appendChild(talkBtn);
  document.body.appendChild(root);

  const turn = document.createElement("div");
  turn.id = "touch-turn";
  turn.textContent = "Turn your phone sideways for a bigger picture";
  document.body.appendChild(turn);

  window.addEventListener("blur", clearDirs);
}

export function initTouch() {
  const forced = new URLSearchParams(location.search).get("touch") === "1";
  const enable = () => {
    if (touch.enabled) return;
    touch.enabled = true;
    build();
  };
  if (forced || navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches) enable();
  // A laptop with a touch screen: switch the buttons on at the first touch.
  window.addEventListener("touchstart", enable, { once: true, passive: true });
}

// The scene tells us what the Talk button does.
export function setTalkHandler(fn) {
  talkHandler = fn;
}

// Called every frame by the scene: show the buttons only while walking.
export function updateTouch({ visible, canTalk }) {
  if (!root) return;
  if (shown !== visible) {
    shown = visible;
    root.classList.toggle("off", !visible);
    if (!visible) clearDirs();
  }
  talkBtn.classList.toggle("idle", !canTalk);
}
