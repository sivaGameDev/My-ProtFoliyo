import { MILESTONES } from "./content-data.js";
import * as audio from "./audio.js";

export function createHud({ controller, isTouch }) {
  const els = {
    intro: document.getElementById("intro"),
    introNote: document.getElementById("introNote"),
    enterBtn: document.getElementById("enterBtn"),
    hud: document.getElementById("hud"),
    milestoneCount: document.getElementById("hudMilestoneCount"),
    muteBtn: document.getElementById("muteBtn"),
    prompt: document.getElementById("prompt"),
    promptText: document.getElementById("promptText"),
    toast: document.getElementById("milestoneToast"),
    victoryBadge: document.getElementById("victoryBadge"),
    touchControls: document.getElementById("touchControls"),
    mouseToggleBtn: document.getElementById("mouseToggleBtn"),
    panel: document.getElementById("panel"),
    panelTitle: document.getElementById("panelTitle"),
    panelBody: document.getElementById("panelBody"),
    panelClose: document.getElementById("panelClose"),
    victoryOverlay: document.getElementById("victoryOverlay"),
    victoryContinueBtn: document.getElementById("victoryContinueBtn"),
    orbBadge: document.getElementById("orbBadge"),
    orbBadgeText: document.getElementById("orbBadgeText"),
  };

  function updateOrbBadge(count, total) {
    els.orbBadgeText.textContent = `${count} / ${total} Orbs`;
    els.orbBadge.classList.toggle("is-complete", count === total);
  }

  let discoveredCount = 0;
  let panelOpen = false;
  let toastTimer = null;

  function updateCount() {
    els.milestoneCount.textContent = `${discoveredCount} / ${MILESTONES.length} Milestones`;
  }

  function showToast(text) {
    els.toast.textContent = text;
    els.toast.hidden = false;
    requestAnimationFrame(() => els.toast.classList.add("is-visible"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove("is-visible");
      setTimeout(() => (els.toast.hidden = true), 400);
    }, 2200);
  }

  function showPrompt(text) {
    els.promptText.textContent = text;
    els.prompt.hidden = false;
  }

  function hidePrompt() {
    els.prompt.hidden = true;
  }

  function openPanel(milestone) {
    panelOpen = true;
    els.panelTitle.textContent = milestone.title;
    els.panelBody.innerHTML = milestone.render();
    els.panel.hidden = false;
    requestAnimationFrame(() => els.panel.classList.add("is-open"));
    if (controller.locked) controller.exitLock();
  }

  let victoryPending = false;
  let victoryShown = false;
  let mouseManuallyFreed = false;

  function closePanel() {
    panelOpen = false;
    els.panel.classList.remove("is-open");
    setTimeout(() => (els.panel.hidden = true), 350);

    if (victoryPending && !victoryShown) {
      victoryShown = true;
      setTimeout(showVictory, 400);
    } else if (!isTouch && !mouseManuallyFreed) {
      controller.requestLock();
    }
  }

  els.panelClose.addEventListener("click", closePanel);
  els.panel.addEventListener("click", (e) => {
    if (e.target === els.panel) closePanel();
  });

  function onMilestoneDiscovered(milestone) {
    if (milestone.discovered) {
      openPanel(milestone);
      return;
    }
    milestone.discovered = true;
    discoveredCount += 1;
    updateCount();
    showToast(`Milestone unlocked: ${milestone.label}`);
    audio.playMilestone();
    openPanel(milestone);

    if (discoveredCount === MILESTONES.length) {
      victoryPending = true;
    }
  }

  function showVictory() {
    els.victoryOverlay.hidden = false;
    requestAnimationFrame(() => els.victoryOverlay.classList.add("is-visible"));
    audio.playVictory();
  }

  function hideVictory() {
    els.victoryOverlay.classList.remove("is-visible");
    setTimeout(() => (els.victoryOverlay.hidden = true), 500);
    els.victoryBadge.hidden = false;
    requestAnimationFrame(() => els.victoryBadge.classList.add("is-visible"));
  }

  els.victoryContinueBtn.addEventListener("click", () => {
    hideVictory();
    if (!isTouch) {
      mouseManuallyFreed = false;
      controller.requestLock();
    }
  });

  els.muteBtn.addEventListener("click", () => {
    const next = !audio.isMuted();
    audio.setMuted(next);
    els.muteBtn.setAttribute("aria-pressed", String(next));
    els.muteBtn.innerHTML = next ? "&#128263;" : "&#128266;";
  });

  function updateMouseToggleIcon() {
    const locked = controller.locked;
    els.mouseToggleBtn.innerHTML = locked ? "&#128274;" : "&#128275;";
    els.mouseToggleBtn.setAttribute("aria-pressed", String(locked));
  }

  function toggleMouseLock() {
    if (controller.locked) {
      mouseManuallyFreed = true;
      controller.exitLock();
    } else {
      mouseManuallyFreed = false;
      controller.requestLock();
    }
  }

  els.mouseToggleBtn.addEventListener("click", toggleMouseLock);

  window.addEventListener("keydown", (e) => {
    const key = (e.key || "").toLowerCase();
    if (key !== "g") return;
    if (isTouch || panelOpen || els.mouseToggleBtn.hidden) return;
    toggleMouseLock();
  });

  document.addEventListener("pointerlockchange", updateMouseToggleIcon);

  function enterExperience() {
    els.intro.classList.add("is-hidden");
    setTimeout(() => (els.intro.hidden = true), 500);
    els.hud.hidden = false;
    if (isTouch) {
      els.touchControls.hidden = false;
    } else {
      els.mouseToggleBtn.hidden = false;
      mouseManuallyFreed = false;
      controller.requestLock();
    }
  }

  els.enterBtn.addEventListener("click", enterExperience);

  if (isTouch) {
    els.introNote.style.display = "block";
  } else {
    els.introNote.style.display = "none";
  }

  return {
    get panelOpen() {
      return panelOpen;
    },
    showPrompt,
    hidePrompt,
    showToast,
    updateOrbBadge,
    onMilestoneDiscovered,
    touchEls: {
      stick: document.getElementById("touchStick"),
      stickKnob: document.getElementById("touchStickKnob"),
      look: document.getElementById("touchLook"),
      interactBtn: document.getElementById("touchInteractBtn"),
    },
    playInteractSound: audio.playInteract,
  };
}
