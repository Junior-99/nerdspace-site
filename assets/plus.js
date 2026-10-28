import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  reload,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

// Public app identifiers only. Secret keys and the annual price are owned by Firebase Functions.
const app = initializeApp({
  apiKey: "AIzaSyBastcsN46nzYOsWpVHbN4O2CWz7rh7yb0",
  authDomain: "nerdspace-junior-2026.firebaseapp.com",
  projectId: "nerdspace-junior-2026",
  appId: "1:1020159289282:web:1c8de65f1acb20854ed85b",
});
const auth = getAuth(app),
  functions = getFunctions(app, "us-central1"),
  el = (id) => document.getElementById(id);
let state,
  busy = false,
  generation = 0,
  handledReference = "";
const pendingReference =
  new URL(location.href).searchParams.get("reference") ||
  new URL(location.href).searchParams.get("trxref");
const nativeManagement = {
  app_store: "https://apps.apple.com/account/subscriptions",
  play_store: "https://play.google.com/store/account/subscriptions",
};
const call = async (name, data = {}) =>
  (await httpsCallable(functions, name, { timeout: 35000 })(data)).data;
function feedback(message, error = false) {
  el("feedback").textContent = message;
  el("feedback").classList.toggle("error", error);
}
function failure(error) {
  const code = String(error?.code || "");
  if (
    code.includes("invalid-credential") ||
    code.includes("user-not-found") ||
    code.includes("wrong-password")
  )
    return "The email or password could not be verified. Please try again.";
  if (code.includes("too-many-requests") || code.includes("resource-exhausted"))
    return "Please wait a little before trying again.";
  if (code.includes("network"))
    return "The connection was interrupted. Check your network and try again.";
  return String(
    error?.message || "This request could not finish. Please try again.",
  )
    .replace(/^Firebase: /, "")
    .slice(0, 350);
}
function render() {
  const signed = !!auth.currentUser;
  el("initial-loading").hidden = true;
  el("login-form").hidden = signed;
  el("account").hidden = !signed;
  if (!signed) return;
  el("account-email").textContent = auth.currentUser.email;
  const paidWeb = !!state?.sources?.paystack?.active,
    paidNative = !!state?.sources?.revenuecat?.active;
  const manager =
    paidWeb || !!nativeManagement[state?.sources?.revenuecat?.store];
  el("account-title").textContent = state?.plus
    ? "Plus is part of your world."
    : "Your annual chapter";
  el("access-description").textContent = !auth.currentUser.emailVerified
    ? "Verify your email in the NerdSpace app, then refresh this page."
    : state?.plus
      ? "Access through " +
        new Date(state.expiresAt).toLocaleDateString() +
        (state.source === "admin" ? " · administrator grant." : ".")
      : state?.blockedByAdmin
        ? "Contact support about your Plus access. You can still manage an existing subscription."
        : "Your account is ready for a year of Plus.";
  el("subscribe").hidden = !!state?.plus || paidWeb || paidNative;
  el("consent-row").hidden = el("subscribe").hidden;
  el("subscribe").disabled =
    busy ||
    !!(pendingReference && handledReference !== pendingReference) ||
    !state?.webEnabled ||
    !auth.currentUser.emailVerified ||
    state?.blockedByAdmin ||
    !el("consent").checked;
  el("manage").hidden = !manager;
  el("manage").disabled = busy;
  el("refresh").disabled = busy;
  el("signout").disabled = busy;
}
async function refresh() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await reload(auth.currentUser);
  if (!auth.currentUser.emailVerified) {
    state = undefined;
    render();
    return;
  }
  const next = await call("billingConfiguration");
  if (auth.currentUser?.uid !== uid) return;
  state = next;
  if (state.webAnnualAmount !== 13980 || state.webCurrency !== "GHS")
    throw Error(
      "Annual web pricing changed. Please contact support before paying.",
    );
  render();
}
async function run(work) {
  if (busy) return;
  busy = true;
  render();
  feedback("");
  try {
    await work();
  } catch (error) {
    feedback(failure(error), true);
  } finally {
    busy = false;
    render();
  }
}
function safePaystack(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !/(^|\.)paystack\.(co|com)$/.test(url.hostname)
  )
    throw Error("The payment destination could not be verified.");
  return url.href;
}
el("login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void run(async () => {
    const email = el("email").value.trim(),
      password = el("password").value;
    await signInWithEmailAndPassword(auth, email, password);
    el("password").value = "";
  });
});
el("reset").addEventListener(
  "click",
  () =>
    void run(async () => {
      const email = el("email").value.trim();
      if (!el("email").reportValidity()) return;
      await sendPasswordResetEmail(auth, email);
      feedback(
        "If this email has a NerdSpace account, password recovery instructions will be sent. Check your inbox.",
      );
    }),
);
el("consent").addEventListener("change", render);
el("subscribe").addEventListener(
  "click",
  () =>
    void run(async () => {
      if (!el("consent").checked)
        throw Error("Read and accept the annual renewal terms first.");
      const result = await call("startAnnualWebCheckout");
      if (result.amount !== 13980 || result.currency !== "GHS")
        throw Error("The checkout price could not be verified.");
      location.assign(safePaystack(result.url));
    }),
);
el("manage").addEventListener(
  "click",
  () =>
    void run(async () => {
      if (state?.sources?.paystack?.active) {
        const result = await call("manageAnnualWebSubscription");
        location.assign(safePaystack(result.url));
      } else {
        const url = nativeManagement[state?.sources?.revenuecat?.store];
        if (!url)
          throw Error("Open your original store to manage this subscription.");
        location.assign(url);
      }
    }),
);
async function verifyReturn() {
  if (
    !pendingReference ||
    pendingReference === handledReference ||
    !auth.currentUser?.emailVerified
  )
    return false;
  if (!/^ns_[A-Za-z0-9]{32}$/.test(pendingReference))
    throw Error("The checkout reference is invalid.");
  feedback("Verifying your payment with Paystack…");
  const uid = auth.currentUser.uid,
    result = await call("verifyAnnualWebCheckout", {
      reference: pendingReference,
    });
  if (auth.currentUser?.uid !== uid) return true;
  handledReference = pendingReference;
  await refresh();
  feedback(
    result.plus
      ? "Payment verified. Your annual Plus access is active."
      : "Payment verified; your account access needs support review.",
    !result.plus,
  );
  history.replaceState(null, "", location.pathname);
  return true;
}
el("refresh").addEventListener(
  "click",
  () =>
    void run(async () => {
      if (!(await verifyReturn())) {
        await refresh();
        feedback("Membership refreshed.");
      }
    }),
);
el("signout").addEventListener(
  "click",
  () =>
    void run(async () => {
      await signOut(auth);
      state = undefined;
    }),
);
onAuthStateChanged(auth, async (user) => {
  const version = ++generation;
  state = undefined;
  el("password").value = "";
  el("consent").checked = false;
  render();
  if (!user) return;
  try {
    await refresh();
    if (version !== generation) return;
    await verifyReturn();
  } catch (error) {
    if (version === generation) feedback(failure(error), true);
  }
});
