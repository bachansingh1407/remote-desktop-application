"use client";

import { useEffect, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";

const Font = Quill.import("attributors/class/font");
const Size = Quill.import("attributors/style/size");

Font.whitelist = [
  "arial",
  "georgia",
  "times-new-roman",
  "courier",
  "roboto",
  "merriweather",
  "poppins",
];

Size.whitelist = [
  "10px",
  "11px",
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
    "48px",
];

Quill.register(Font, true);
Quill.register(Size, true);
// 8 fonts chosen for articles / blogs / notes / diary writing:
// a couple of system fonts (no loading needed) + 2 web fonts for personality.
const FONT_OPTIONS = [
  { value: "", label: "Default", family: "inherit" },
  { value: "arial", label: "Arial", family: "Arial, Helvetica, sans-serif" },
  { value: "georgia", label: "Georgia", family: "Georgia, 'Times New Roman', serif" },
  { value: "times-new-roman", label: "Times New Roman", family: "'Times New Roman', Times, serif" },
  { value: "courier", label: "Courier New", family: "'Courier New', Courier, monospace" },
  { value: "roboto", label: "Roboto", family: "var(--font-roboto), Arial, sans-serif" },
  { value: "merriweather", label: "Merriweather", family: "var(--font-merriweather), Georgia, serif" },
  { value: "poppins", label: "Poppins", family: "var(--font-poppins), Arial, sans-serif" },
];

const SIZE_OPTIONS = [
  { value: "", label: "Normal" },
  { value: "10px", label: "10" },
  { value: "11px", label: "11" },
  { value: "12px", label: "12" },
  { value: "14px", label: "14" },
  { value: "16px", label: "16" },
  { value: "18px", label: "18" },
  { value: "20px", label: "20" },
  { value: "24px", label: "24" },
  { value: "28px", label: "28" },
  { value: "32px", label: "32" },
  { value: "48px", label: "48" },
];

// Module-scoped guard: register once, regardless of how many places
// dynamically import this component (WriteApp + FileEditor both do).
let registered = false;
function ensureFormatsRegistered() {
  if (registered) return;

  const Font = Quill.import("formats/font");
  Font.whitelist = FONT_OPTIONS.filter((f) => f.value).map((f) => f.value);
  Quill.register(Font, true);

  const SizeStyle = Quill.import("attributors/style/size");
  SizeStyle.whitelist = SIZE_OPTIONS.filter((s) => s.value).map((s) => s.value);
  Quill.register(SizeStyle, true);

  registered = true;
}

function buildToolbarHTML() {
  const fontOpts = FONT_OPTIONS.map(
    (f) => `<option value="${f.value}">${f.label}</option>`
  ).join("");
  const sizeOpts = SIZE_OPTIONS.map(
    (s) => `<option value="${s.value}">${s.label}</option>`
  ).join("");

  return `
    <span class="ql-formats">
      <select class="ql-font">${fontOpts}</select>
      <select class="ql-size">${sizeOpts}</select>
    </span>
    <span class="ql-formats">
      <button class="ql-bold"></button>
      <button class="ql-italic"></button>
      <button class="ql-underline"></button>
      <button class="ql-strike"></button>
    </span>
    <span class="ql-formats">
      <select class="ql-color"></select>
      <select class="ql-background"></select>
    </span>
    <span class="ql-formats">
      <select class="ql-align"></select>
    </span>
    <span class="ql-formats">
      <button class="ql-blockquote"></button>
      <button class="ql-code-block"></button>
    </span>
    <span class="ql-formats">
      <button class="ql-list" value="ordered"></button>
      <button class="ql-list" value="bullet"></button>
    </span>
    <span class="ql-formats">
      <button class="ql-link"></button>
      <button class="ql-image"></button>
    </span>
    <span class="ql-formats">
      <button class="ql-clean"></button>
    </span>
  `;
}

function buildDynamicPickerCSS() {
  // !important is mandatory: Quill's own snow.css sets a base
  // `content: 'Sans Serif'` rule on .ql-font that beats plain overrides.
  const fontRules = FONT_OPTIONS.map(({ value, label, family }) => {
    const sel = value ? `[data-value="${value}"]` : `:not([data-value])`;
    return `
      .quill-shell .ql-toolbar .ql-font .ql-picker-label${sel}::before,
      .quill-shell .ql-toolbar .ql-font .ql-picker-item${sel}::before {
        content: "${label}" !important;
      }
      ${
        value
          ? `
      .quill-shell .ql-toolbar .ql-font .ql-picker-label${sel},
      .quill-shell .ql-toolbar .ql-font .ql-picker-item${sel} {
        font-family: ${family};
      }
      .quill-shell .ql-editor .ql-font-${value} {
        font-family: ${family};
      }`
          : ""
      }`;
  }).join("\n");

  const sizeRules = SIZE_OPTIONS.map(({ value, label }) => {
    const sel = value ? `[data-value="${value}"]` : `:not([data-value])`;
    return `
      .quill-shell .ql-toolbar .ql-size .ql-picker-label${sel}::before,
      .quill-shell .ql-toolbar .ql-size .ql-picker-item${sel}::before {
        content: "${label}" !important;
      }`;
  }).join("\n");

  return fontRules + sizeRules;
}

export default function QuillEditor({
  value,
  onChange,
  placeholder = "Start writing...",
}) {
  const containerRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (container.dataset.quillMounted === "true") return;
    container.dataset.quillMounted = "true";

    ensureFormatsRegistered();
    container.replaceChildren();

    const toolbarEl = document.createElement("div");
    toolbarEl.innerHTML = buildToolbarHTML();
    container.appendChild(toolbarEl);

    const editorEl = document.createElement("div");
    container.appendChild(editorEl);

    const quill = new Quill(editorEl, {
      theme: "snow",
      placeholder,
      modules: { toolbar: toolbarEl },
    });

    if (value) quill.root.innerHTML = value;

    quill.on("text-change", () => {
      onChangeRef.current?.(quill.root.innerHTML);
    });

    // Explicit wiring: Quill's automatic select->format detection depends on
    // the `selected` HTML attribute being literally present and can miss
    // events when the toolbar container is built manually (as ours is).
    // Binding directly guarantees font/size actually apply to the text.
    const fontSelect = toolbarEl.querySelector("select.ql-font");
    const sizeSelect = toolbarEl.querySelector("select.ql-size");

    const handleFontChange = () => {
      quill.format("font", fontSelect.value || false, "user");
    };
    const handleSizeChange = () => {
      quill.format("size", sizeSelect.value || false, "user");
    };

    fontSelect?.addEventListener("change", handleFontChange);
    sizeSelect?.addEventListener("change", handleSizeChange);

    quillRef.current = quill;

    return () => {
      quillRef.current = null;
      container.replaceChildren();
      container.dataset.quillMounted = "false";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="quill-shell flex h-full flex-col">
      <style jsx global>{`
        .quill-shell .ql-toolbar.ql-snow {
          border: none !important;
          border-bottom: 1px solid var(--color-border) !important;
          padding: 6px 12px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px 2px;
          overflow: visible;
          background: #fafafa;
          position: relative;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-formats {
          display: flex;
          align-items: center;
          gap: 2px;
          margin: 0 6px 0 0;
          padding-right: 6px;
          border-right: 1px solid var(--color-border);
        }
        .quill-shell .ql-toolbar.ql-snow .ql-formats:last-child {
          border-right: none;
          margin-right: 0;
        }
        .quill-shell .ql-toolbar.ql-snow button {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background-color 120ms ease;
        }
        .quill-shell .ql-toolbar.ql-snow button:hover {
          background: #eef0f3;
        }
        .quill-shell .ql-toolbar.ql-snow button.ql-active {
          background: #ede9fe;
        }
        .quill-shell .ql-toolbar.ql-snow button svg {
          width: 16px;
          height: 16px;
          display: block;
        }
        .quill-shell .ql-toolbar.ql-snow button.ql-active .ql-stroke {
          stroke: #7c3aed;
        }
        .quill-shell .ql-toolbar.ql-snow button.ql-active .ql-fill {
          fill: #7c3aed;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-stroke {
          stroke: #4b5563;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-fill {
          fill: #4b5563;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-picker {
          height: 28px;
          flex-shrink: 0;
          position: relative;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-picker-label {
          display: inline-flex;
          align-items: center;
          height: 28px;
          border-radius: 6px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: background-color 120ms ease, border-color 120ms ease;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-picker-label:hover,
        .quill-shell .ql-toolbar.ql-snow .ql-picker-label.ql-active,
        .quill-shell .ql-toolbar.ql-snow .ql-picker-expanded .ql-picker-label {
          background: #eef0f3;
          border-color: var(--color-border);
        }
        .quill-shell .ql-toolbar.ql-snow .ql-picker-label svg {
          display: block;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-font .ql-picker-label,
        .quill-shell .ql-toolbar.ql-snow .ql-size .ql-picker-label {
          padding: 0 18px 0 8px;
          white-space: nowrap;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-font {
          width: 130px;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-size {
          width: 62px;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-font .ql-picker-label,
        .quill-shell .ql-toolbar.ql-snow .ql-font .ql-picker-item,
        .quill-shell .ql-toolbar.ql-snow .ql-size .ql-picker-label,
        .quill-shell .ql-toolbar.ql-snow .ql-size .ql-picker-item {
          font-size: 12px;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-color .ql-picker-label,
        .quill-shell .ql-toolbar.ql-snow .ql-background .ql-picker-label,
        .quill-shell .ql-toolbar.ql-snow .ql-align .ql-picker-label {
          width: 28px;
          padding: 0;
          justify-content: center;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-color .ql-picker-label svg,
        .quill-shell .ql-toolbar.ql-snow .ql-background .ql-picker-label svg,
        .quill-shell .ql-toolbar.ql-snow .ql-align .ql-picker-label svg {
          width: 16px;
          height: 16px;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-picker-options {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          border-radius: 8px;
          border: 1px solid var(--color-border);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          padding: 4px;
          background: #fff;
          z-index: 9999;
          display: none;
          max-height: 260px;
          overflow-y: auto;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-picker.ql-expanded .ql-picker-options {
          display: block;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-picker:not(.ql-color-picker):not(.ql-background) .ql-picker-item {
          border-radius: 5px;
          padding: 5px 10px;
          white-space: nowrap;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-picker:not(.ql-color-picker):not(.ql-background) .ql-picker-item:hover {
          background: #f3f4f6;
        }
        .quill-shell .ql-toolbar.ql-snow .ql-picker-item.ql-selected {
          color: #7c3aed;
        }
        .quill-shell .ql-color-picker .ql-picker-options,
        .quill-shell .ql-background .ql-picker-options {
          width: 152px;
          padding: 6px;
        }
        .quill-shell .ql-color-picker .ql-picker-item,
        .quill-shell .ql-background .ql-picker-item {
          width: 18px;
          height: 18px;
          border-radius: 4px;
          margin: 2px;
        }
        .quill-shell .ql-editor {
          padding: 20px 24px;
          line-height: 1.7;
          color: #1f2937;
        }
        .quill-shell .ql-editor.ql-blank::before {
          font-style: normal;
          color: #9ca3af;
          left: 24px;
        }
        .quill-shell .ql-editor::-webkit-scrollbar {
          width: 8px;
        }
        .quill-shell .ql-editor::-webkit-scrollbar-thumb {
          background: #e5e5e5;
          border-radius: 4px;
        }
        ${buildDynamicPickerCSS()}
      `}</style>
    </div>
  );
}