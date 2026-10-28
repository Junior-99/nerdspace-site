import("./plus.js").catch(() => {
  document.getElementById("initial-loading").textContent =
    "The secure account connection could not load. Check your network, reload this page, or contact billing support. No payment was started.";
});
