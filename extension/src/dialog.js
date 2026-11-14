/* Promise-based form dialog (glass).
   fields: [{name, label, value, placeholder, type}] or DOM nodes (rendered as-is).
   validate(values) may return a message; commit(values) may be async and return/throw a message,
   in which case the dialog stays open. onReady(inputs) runs after mounting. */
import { $, el } from "./util.js";

export function formDialog({ title, fields, submitLabel = "Save", validate, commit, onReady }) {
  const dlg = $("#dlg");
  return new Promise((resolve) => {
    const inputs = {};
    let busy = false;
    const err = el("p", { class: "dlg-err", role: "alert" });
    const submit = el("button", { class: "btn primary", type: "submit", value: "ok" }, submitLabel);
    const cancel = el("button", { class: "btn ghost", type: "button", value: "cancel", onclick: () => { if (!busy) dlg.close("cancel"); } }, "Cancel");
    const form = el("form", { method: "dialog", class: "dlg-form" },
      el("h3", { class: "dlg-title" }, title),
      fields.map(f => f instanceof Node ? f : el("label", { class: "field" },
        el("span", { class: "field-label" }, f.label),
        inputs[f.name] = el("input", { class: "input", name: f.name, type: f.type || "text", value: f.value || "", placeholder: f.placeholder || "", spellcheck: "false", autocomplete: "off" }))),
      err,
      el("div", { class: "dlg-actions" },
        cancel, submit));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      const values = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim()]));
      busy = true;
      submit.disabled = cancel.disabled = true;
      err.textContent = "";
      try {
        let msg = validate ? await validate(values) : "";
        if (!msg && commit) msg = await commit(values);
        if (msg) { err.textContent = msg; return; }
        dlg._values = values;
        dlg.close("ok");
      } catch (x) {
        err.textContent = (x && x.message) || "Something went wrong. Try again.";
      } finally {
        busy = false;
        submit.disabled = cancel.disabled = false;
      }
    });
    dlg.replaceChildren(form);
    dlg.oncancel = (e) => { if (busy) e.preventDefault(); };
    dlg.onclose = () => {
      resolve(dlg.returnValue === "ok" ? dlg._values : null);
      dlg._values = null;
      dlg.returnValue = "";
    };
    dlg.showModal();
    if (onReady) onReady(inputs, form);
    inputs[Object.keys(inputs)[0]]?.focus();
  });
}
