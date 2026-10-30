(() => {
  "use strict";

  const STORAGE_KEY = "morrow-plan-v2";
  const EVENT_TYPES = ["Wedding", "Birthday", "Community"];
  const STATUS_ORDER = ["Confirmed", "Reviewing", "Needs reply"];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const EVENT_TEMPLATES = {
    Wedding: {
      title: "Make room",
      intro: "Your wedding plan is taking shape.",
      tasks: [
        ["Confirm ceremony venue", "Completed · today", "Done", true],
        ["Send the second round of invites", "Due tomorrow · 16 guests", "Priority", false],
        ["Choose your soundscape", "Pick a DJ or build your own playlist", "This week", false],
        ["Confirm the late-night snack", "Street tacos are calling", "This week", false],
      ],
      vendors: [["Maya Chen", "Florals"], ["Sunroom Kitchen", "Catering"], ["DJ Juniper", "Music"]],
      ideas: [["Atmosphere", "Sunset supper club", "Long tables, low lights, high spirits.", "☼"], ["A little extra", "Postcard guestbook", "Ask everyone to leave a wish for future you.", "✺"], ["For the table", "Herb-forward blooms", "Beautiful, fragrant, and ready for dinner.", "♧"]],
      nudge: "Rain is looking likely after 9pm. Moving dessert under the pergola keeps the mood cozy and saves you a last-minute scramble.",
      backup: "Backup plan added: pergola dessert + candlelight.",
    },
    Birthday: {
      title: "Turn up",
      intro: "Your birthday plan is taking shape.",
      tasks: [
        ["Choose the birthday venue", "Lock the room before the weekend", "Priority", false],
        ["Send the party invite", "Friends are waiting for the details", "This week", false],
        ["Order the statement cake", "Pick a flavor with a little drama", "This week", false],
        ["Build the birthday playlist", "Start with three songs everyone loves", "Later", false],
      ],
      vendors: [["Mina Patel", "Cake studio"], ["Glow Room", "Venue"], ["Leo Sparks", "Entertainment"]],
      ideas: [["The mood", "Disco after dark", "Mirror balls, velvet, and a dance floor.", "✺"], ["A little extra", "Memory menu", "Serve one favorite bite from every era.", "☼"], ["For the table", "Color-block florals", "One bold hue makes every photo sing.", "♧"]],
      nudge: "Your guest list has a lot of first-timers. Add a welcome drink station so everyone has an easy opening conversation.",
      backup: "Birthday backup added: indoor dance floor + welcome bar.",
    },
    Community: {
      title: "Bring people",
      intro: "Your community plan is taking shape.",
      tasks: [
        ["Confirm the community space", "Check access, power, and weather cover", "Priority", false],
        ["Publish the neighborhood invite", "Make the welcome details easy to share", "This week", false],
        ["Recruit three hosts", "Give every corner a friendly face", "This week", false],
        ["Plan the shared table", "Ask neighbors for one generous dish", "Later", false],
      ],
      vendors: [["Cedar Collective", "Coordination"], ["Sunroom Kitchen", "Food"], ["Open Mic Co.", "Program"]],
      ideas: [["The mood", "Lantern commons", "A soft-lit gathering place for every age.", "☼"], ["A little extra", "Story exchange", "Give neighbors prompts to swap memories.", "✺"], ["For the table", "Harvest potluck", "A shared menu is the best kind of welcome.", "♧"]],
      nudge: "A few neighbors are likely to arrive alone. Add a host-led welcome circle to make the first five minutes feel easy.",
      backup: "Community backup added: covered welcome tent + host circle.",
    },
  };

  const createDefaultState = () => ({
    eventType: "Wedding",
    eventName: "Summer Solstice Gathering",
    budget: 6000,
    tasks: [],
    vendors: [],
    savedIdeas: [false, false, false],
  });
  const state = createDefaultState();

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const validatePlanInput = (name, budget) => {
    const cleanName = typeof name === "string" ? name.trim().slice(0, 80) : "";
    const numericBudget = Number(budget);
    return {
      valid: cleanName.length > 0 && Number.isFinite(numericBudget) && Number.isInteger(numericBudget) && numericBudget >= 100 && numericBudget <= 10000000,
      eventName: cleanName,
      budget: Number.isInteger(numericBudget) ? clamp(numericBudget, 100, 10000000) : 0,
    };
  };

  /** Return an explainable, event-aware allocation that always reconciles to the input budget. */
  const calculateBudgetBreakdown = (budget, eventType = "Wedding") => {
    const ratios = {
      Wedding: { venue: 0.35, catering: 0.3, details: 0.25, buffer: 0.1 },
      Birthday: { venue: 0.25, catering: 0.35, details: 0.3, buffer: 0.1 },
      Community: { venue: 0.2, catering: 0.4, details: 0.3, buffer: 0.1 },
    }[eventType] || { venue: 0.3, catering: 0.35, details: 0.25, buffer: 0.1 };
    const amount = Number.isFinite(Number(budget)) ? Math.max(0, Number(budget)) : 0;
    const venue = Math.round(amount * ratios.venue);
    const catering = Math.round(amount * ratios.catering);
    const details = Math.round(amount * ratios.details);
    const buffer = amount - venue - catering - details;
    return { venue, catering, details, buffer, total: amount };
  };

  /** Local GenAI fallback: synthesize a complete plan when no model/API key is available. */
  const synthesizePlan = (eventType = "Wedding", budget = 6000) => {
    const source = EVENT_TEMPLATES[EVENT_TYPES.includes(eventType) ? eventType : "Wedding"];
    return {
      tasks: source.tasks.map(([title, detail, tag, completed]) => ({ title, detail, tag, completed })),
      vendors: source.vendors.map(([name, category], index) => ({ name, category, status: index === 0 ? "Confirmed" : "Reviewing" })),
      ideas: source.ideas.map(([label, title, description, icon]) => ({ label, title, description, icon })),
      budget: calculateBudgetBreakdown(budget, eventType),
      nudge: source.nudge,
      backup: source.backup,
    };
  };
  const generateEventTemplate = synthesizePlan;
  const MorrowAI = Object.freeze({
    provider: "Morrow local synthesis",
    model: "event-template-v2",
    generatePlan: synthesizePlan,
    online: false,
  });

  /** Calculate the completion ratio without reading presentation markup. */
  const calculateProgressPercentage = (tasks) => {
    if (!Array.isArray(tasks) || tasks.length === 0) return 0;
    return Math.round((tasks.filter((task) => task.completed === true).length / tasks.length) * 100);
  };

  const sanitizeStorageSnapshot = (candidate) => {
    const clean = createDefaultState();
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return clean;
    clean.eventType = EVENT_TYPES.includes(candidate.eventType) ? candidate.eventType : clean.eventType;
    const input = validatePlanInput(candidate.eventName, candidate.budget);
    if (input.valid) {
      clean.eventName = input.eventName;
      clean.budget = input.budget;
    }
    if (Array.isArray(candidate.tasks)) {
      clean.tasks = candidate.tasks.slice(0, 100).filter((task) => task && typeof task === "object").map((task) => ({
        title: typeof task.title === "string" ? task.title.slice(0, 120) : "Planning task",
        detail: typeof task.detail === "string" ? task.detail.slice(0, 160) : "Added to your plan",
        tag: typeof task.tag === "string" ? task.tag.slice(0, 30) : "New",
        completed: task.completed === true,
      }));
    }
    if (Array.isArray(candidate.vendors)) {
      clean.vendors = candidate.vendors.slice(0, 20).filter((vendor) => vendor && typeof vendor === "object").map((vendor) => ({
        name: typeof vendor.name === "string" ? vendor.name.slice(0, 80) : "Planning partner",
        category: typeof vendor.category === "string" ? vendor.category.slice(0, 60) : "Event support",
        status: STATUS_ORDER.includes(vendor.status) ? vendor.status : "Reviewing",
      }));
    }
    if (Array.isArray(candidate.savedIdeas)) clean.savedIdeas = candidate.savedIdeas.slice(0, 20).map((value) => value === true);
    return clean;
  };

  const replaceState = (next) => {
    const safe = sanitizeStorageSnapshot(next);
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, safe);
  };

  const saveState = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      $("#saveStatus").textContent = "● saved locally";
    } catch {
      $("#saveStatus").textContent = "● session only";
    }
  };

  const readState = () => {
    try {
      replaceState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    } catch {
      replaceState(null);
      $("#saveStatus").textContent = "● session only";
    }
  };

  const toast = (message) => {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => element.classList.remove("show"), 2800);
  };

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const renderBudget = () => {
    const breakdown = calculateBudgetBreakdown(state.budget, state.eventType);
    const metric = $("#budgetUsedValue");
    metric.replaceChildren(document.createTextNode(`$${(state.budget - breakdown.buffer).toLocaleString()} `), Object.assign(createElement("span", "unit"), { textContent: `/ $${state.budget.toLocaleString()}` }));
    const usedPercent = Math.round(((state.budget - breakdown.buffer) / state.budget) * 100);
    $("#budgetUsedProgress").setAttribute("aria-valuenow", String(usedPercent));
    $(".metric-card#budgetMetric .progress-fill").style.width = `${usedPercent}%`;
    const donut = $(".donut");
    donut.style.background = `conic-gradient(var(--coral) 0 ${breakdown.venue / state.budget * 100}%, var(--lilac) ${breakdown.venue / state.budget * 100}% ${(breakdown.venue + breakdown.catering) / state.budget * 100}%, var(--mint) ${(breakdown.venue + breakdown.catering) / state.budget * 100}% ${(state.budget - breakdown.buffer) / state.budget * 100}%, var(--yellow) ${(state.budget - breakdown.buffer) / state.budget * 100}% 100%)`;
    $(".donut strong").textContent = `$${breakdown.buffer.toLocaleString()}`;
    $(".donut small").textContent = "buffer to dream with";
    const legend = $(".budget-legend");
    legend.replaceChildren();
    [["Venue", breakdown.venue, "dot-coral"], [state.eventType === "Birthday" ? "Food" : "Catering", breakdown.catering, "dot-lilac"], ["Details", breakdown.details, "dot-mint"], ["Buffer", breakdown.buffer, "dot-gold"]].forEach(([label, amount, dotClass]) => {
      const line = createElement("span");
      line.append(createElement("i", `dot ${dotClass}`), document.createTextNode(label));
      line.append(Object.assign(createElement("b"), { textContent: `$${amount.toLocaleString()}` }));
      legend.append(line);
    });
  };

  const renderProgress = () => {
    const progress = calculateProgressPercentage(state.tasks);
    $(".progress-card .metric-value").replaceChildren(document.createTextNode(String(progress)), Object.assign(createElement("span"), { textContent: "%" }));
    const track = $(".progress-card .progress-track");
    track.setAttribute("aria-valuenow", String(progress));
    $(".progress-card .progress-fill").style.width = `${progress}%`;
    const heroCopy = $(".hero-copy");
    if (heroCopy) {
      const source = EVENT_TEMPLATES[state.eventType];
      heroCopy.replaceChildren(document.createTextNode(`${source.intro} Here’s the beautiful bit: you’re `), Object.assign(createElement("strong"), { textContent: `${progress}%` }), document.createTextNode(" there."));
    }
    const timelineBadge = $(".nav-item[href='#timeline'] b");
    if (timelineBadge) timelineBadge.textContent = String(state.tasks.filter((task) => !task.completed).length);
  };

  const renderTasks = () => {
    const list = $("#taskList");
    list.replaceChildren();
    state.tasks.forEach((taskData, index) => {
      const row = createElement("label", `task${taskData.completed ? " done" : ""}`);
      const input = Object.assign(createElement("input"), { type: "checkbox", checked: taskData.completed });
      input.setAttribute("aria-label", `Complete ${taskData.title}`);
      const check = createElement("span", "check");
      check.setAttribute("aria-hidden", "true");
      const copy = createElement("span", "task-copy");
      copy.append(createElement("strong", null, taskData.title), createElement("small", null, taskData.detail));
      row.append(input, check, copy, createElement("span", `task-tag ${index === 0 && taskData.completed ? "mint-tag" : "lilac-tag"}`, taskData.tag));
      input.addEventListener("change", () => {
        taskData.completed = input.checked;
        row.classList.toggle("done", input.checked);
        saveState();
        renderProgress();
      });
      list.append(row);
    });
    renderProgress();
  };

  const statusClass = (status) => status === "Confirmed" ? "" : status === "Reviewing" ? " pending" : " alert";
  const renderVendors = () => {
    const container = $("#vendorRows");
    container.replaceChildren();
    state.vendors.forEach((vendor, index) => {
      const row = createElement("button", `vendor-row${statusClass(vendor.status)}`);
      row.type = "button";
      row.setAttribute("aria-label", `${vendor.name}, ${vendor.status}. Change status`);
      const avatar = createElement("span", `vendor-avatar photo-${(index % 3) + 1}`, vendor.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase());
      const copy = createElement("span");
      copy.append(createElement("strong", null, vendor.name), createElement("small", null, `${vendor.category} · ${vendor.status}`));
      const status = createElement("span", `vendor-status${statusClass(vendor.status)}`, vendor.status === "Confirmed" ? "✓" : vendor.status === "Reviewing" ? "↗" : "!");
      row.append(avatar, copy, status);
      row.addEventListener("click", () => cycleVendor(index));
      container.append(row);
    });
    const needsReply = state.vendors.filter((vendor) => vendor.status === "Needs reply").length;
    const vendorBadge = $(".nav-item[href='#vendors'] b");
    if (vendorBadge) vendorBadge.textContent = String(needsReply);
  };

  const cycleVendor = (index = 0) => {
    if (!state.vendors[index]) return;
    const current = STATUS_ORDER.indexOf(state.vendors[index].status);
    state.vendors[index].status = STATUS_ORDER[(current + 1) % STATUS_ORDER.length];
    renderVendors();
    saveState();
    toast(`${state.vendors[index].name} is now ${state.vendors[index].status.toLowerCase()}.`);
  };

  const renderIdeas = (template) => {
    const grid = $("#ideasGrid");
    grid.replaceChildren();
    template.ideas.forEach((idea, index) => {
      const card = createElement("article", `idea-card idea-${index === 0 ? "terracotta" : index === 1 ? "lilac" : "mint"}`);
      const image = createElement("div", "idea-image");
      image.append(createElement("span", "idea-emoji", idea.icon));
      const save = Object.assign(createElement("button", "save", state.savedIdeas[index] ? "♥" : "♡"), { type: "button" });
      save.setAttribute("aria-label", state.savedIdeas[index] ? "Remove idea from saved items" : "Save idea");
      save.setAttribute("aria-pressed", String(state.savedIdeas[index] === true));
      save.addEventListener("click", () => {
        state.savedIdeas[index] = !state.savedIdeas[index];
        renderIdeas(template);
        saveState();
        toast(state.savedIdeas[index] ? "Saved to your inspiration board." : "Removed from saved ideas.");
      });
      image.append(save);
      const body = createElement("div", "idea-body");
      body.append(createElement("span", "idea-label", idea.label), createElement("h3", null, idea.title), createElement("p", null, idea.description));
      card.append(image, body);
      grid.append(card);
    });
  };

  const renderDashboard = () => {
    const template = synthesizePlan(state.eventType, state.budget);
    if (!state.tasks.length) state.tasks = template.tasks;
    if (!state.vendors.length) state.vendors = template.vendors;
    $(".breadcrumb strong").textContent = state.eventName;
    const source = EVENT_TEMPLATES[state.eventType];
    $(".hero h1").replaceChildren(document.createTextNode(source.title), document.createElement("br"), Object.assign(createElement("em"), { textContent: "for wonder." }));
    $(".hero-copy").replaceChildren(document.createTextNode(`${source.intro} Here’s the beautiful bit: you’re `), Object.assign(createElement("strong"), { textContent: `${calculateProgressPercentage(state.tasks)}%` }), document.createTextNode(" there."));
    $(".ai-card p").textContent = template.nudge;
    renderBudget();
    renderTasks();
    renderVendors();
    renderIdeas(template);
  };

  const backdrop = $("#modalBackdrop");
  let lastFocusedElement;
  const focusableInModal = () => $$("button, input, [href], [tabindex]:not([tabindex='-1'])", backdrop).filter((element) => !element.disabled);
  const openModal = () => {
    lastFocusedElement = document.activeElement;
    backdrop.hidden = false;
    $("#eventName").value = state.eventName;
    $("#eventBudget").value = state.budget;
    $("#eventName").focus();
  };
  const closeModal = () => {
    backdrop.hidden = true;
    (lastFocusedElement || $("#newPlanBtn")).focus();
  };

  $("#newPlanBtn").addEventListener("click", openModal);
  $("#modalClose").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeModal(); });
  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); closeModal(); return; }
    if (event.key !== "Tab") return;
    const focusable = focusableInModal();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  $$(".event-option").forEach((option) => option.addEventListener("click", () => {
    $$(".event-option").forEach((item) => { item.classList.remove("selected"); item.setAttribute("aria-pressed", "false"); });
    option.classList.add("selected");
    option.setAttribute("aria-pressed", "true");
    state.eventType = option.dataset.event;
  }));

  $("#generateBtn").addEventListener("click", () => {
    const input = validatePlanInput($("#eventName").value, $("#eventBudget").value);
    if (!input.valid) { toast("Use a name and a whole-number budget from $100 to $10,000,000."); return; }
    state.eventName = input.eventName;
    state.budget = input.budget;
    state.tasks = [];
    state.vendors = [];
    state.savedIdeas = [false, false, false];
    renderDashboard();
    saveState();
    closeModal();
    toast(`${state.eventType} plan created — let’s make it memorable.`);
  });

  $("#addTaskBtn").addEventListener("click", () => {
    state.tasks.push({ title: "Write a note to future you", detail: "Added just now · make it meaningful", tag: "New", completed: false });
    renderTasks();
    saveState();
    toast("Task added to your momentum list.");
  });
  $("#addVendorBtn").addEventListener("click", () => cycleVendor(state.vendors.findIndex((vendor) => vendor.status !== "Confirmed") >= 0 ? state.vendors.findIndex((vendor) => vendor.status !== "Confirmed") : 0));
  $("#weatherBtn").addEventListener("click", () => toast(EVENT_TEMPLATES[state.eventType].backup));
  $("#viewTimelineBtn").addEventListener("click", () => toast("Timeline view is ready for your next move."));
  $("#budgetPlannerBtn").addEventListener("click", () => toast(`Budget planner opened with $${state.budget.toLocaleString()} to allocate.`));
  $(".notification").addEventListener("click", () => toast(`${state.tasks.filter((task) => !task.completed).length} planning moves are still waiting for you.`));
  $("#shareBtn").addEventListener("click", async () => {
    try { if (navigator.clipboard) await navigator.clipboard.writeText(`${state.eventName} · planned with Morrow`); } catch { /* clipboard may be unavailable for file URLs */ }
    toast("Share summary copied to your clipboard.");
  });
  $("#shuffleBtn").addEventListener("click", () => toast("Fresh sparks are coming to your inspiration board."));
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    readState();
    renderDashboard();
    toast("Plan updated from another Morrow tab.");
  });

  const runSelfTests = () => {
    const tests = [
      ["budget totals", () => { const result = calculateBudgetBreakdown(6000, "Wedding"); return result.venue + result.catering + result.details + result.buffer === 6000; }],
      ["birthday budget ratios", () => { const result = calculateBudgetBreakdown(10000, "Birthday"); return result.venue === 2500 && result.catering === 3500 && result.details === 3000 && result.buffer === 1000; }],
      ["community budget ratios", () => { const result = calculateBudgetBreakdown(10000, "Community"); return result.venue === 2000 && result.catering === 4000 && result.details === 3000 && result.buffer === 1000; }],
      ["progress calculation", () => calculateProgressPercentage([{ completed: true }, { completed: false }]) === 50],
      ["empty progress is safe", () => calculateProgressPercentage([]) === 0 && calculateProgressPercentage(null) === 0],
      ["input trims names", () => validatePlanInput("  Party  ", "1000").eventName === "Party"],
      ["input rejects invalid budget", () => !validatePlanInput("", "50").valid && !validatePlanInput("Party", "10.5").valid],
      ["input enforces upper bound", () => validatePlanInput("Party", "10000000").valid && !validatePlanInput("Party", "10000001").valid],
      ["input caps event name", () => validatePlanInput("x".repeat(120), "1000").eventName.length === 80],
      ["template context", () => synthesizePlan("Birthday", 5000).ideas[0].title === "Disco after dark"],
      ["all event templates exist", () => EVENT_TYPES.every((type) => synthesizePlan(type, 6000).tasks.length === 4)],
      ["synthesis returns full plan", () => { const plan = synthesizePlan("Community", 8000); return plan.tasks.length === 4 && plan.vendors.length === 3 && plan.ideas.length === 3 && plan.budget.total === 8000; }],
      ["storage sanitization", () => sanitizeStorageSnapshot({ eventType: "Bad", budget: -1 }).eventType === "Wedding"],
      ["storage ignores arrays", () => sanitizeStorageSnapshot([]).eventName === "Summer Solstice Gathering"],
      ["storage clamps collections", () => sanitizeStorageSnapshot({ tasks: Array(200).fill({}), vendors: Array(30).fill({}) }).tasks.length === 100 && sanitizeStorageSnapshot({ vendors: Array(30).fill({}) }).vendors.length === 20],
      ["storage validates vendor statuses", () => sanitizeStorageSnapshot({ vendors: [{ name: "A", status: "Injected" }] }).vendors[0].status === "Reviewing"],
    ];
    const failures = tests.filter(([, test]) => !test()).map(([name]) => name);
    if (failures.length) throw new Error(`Morrow self-tests failed: ${failures.join(", ")}`);
    return { passed: tests.length, failed: 0 };
  };

  readState();
  renderDashboard();
  window.MorrowApp = { state, MorrowAI, calculateBudgetBreakdown, synthesizePlan, generateEventTemplate, calculateProgressPercentage, validatePlanInput, sanitizeStorageSnapshot, runSelfTests };
  if (new URLSearchParams(window.location.search).has("selftest")) runSelfTests();
})();
