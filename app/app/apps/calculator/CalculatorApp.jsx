"use client";

import { useCallback, useEffect, useState } from "react";
import { Delete } from "lucide-react";

// Third genuinely-new app: a real calculator, not a re-skinned old one.
// Deliberately does the arithmetic itself (no `eval`/Function on
// user-controlled strings) — a small explicit operator-precedence-free,
// left-to-right evaluator, same behavior as a physical calculator.
function compute(a, b, op) {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

function formatDisplay(value) {
  if (Number.isNaN(value)) return "Error";
  if (!Number.isFinite(value)) return "Error";
  const str = String(value);
  return str.length > 12 ? Number(value.toPrecision(10)).toString() : str;
}

export default function CalculatorApp() {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState(null);
  const [pendingOp, setPendingOp] = useState(null);
  const [overwrite, setOverwrite] = useState(true);

  const inputDigit = useCallback(
    (digit) => {
      setDisplay((prev) => {
        if (overwrite) return digit;
        if (prev === "0") return digit;
        if (prev.replace("-", "").length >= 12) return prev;
        return prev + digit;
      });
      setOverwrite(false);
    },
    [overwrite]
  );

  const inputDecimal = useCallback(() => {
    setDisplay((prev) => {
      if (overwrite) return "0.";
      return prev.includes(".") ? prev : prev + ".";
    });
    setOverwrite(false);
  }, [overwrite]);

  const clearAll = useCallback(() => {
    setDisplay("0");
    setStored(null);
    setPendingOp(null);
    setOverwrite(true);
  }, []);

  const toggleSign = useCallback(() => {
    setDisplay((prev) => (prev.startsWith("-") ? prev.slice(1) : prev === "0" ? prev : "-" + prev));
  }, []);

  const percent = useCallback(() => {
    setDisplay((prev) => formatDisplay(parseFloat(prev) / 100));
  }, []);

  const chooseOp = useCallback(
    (op) => {
      const current = parseFloat(display);
      if (stored !== null && pendingOp && !overwrite) {
        const result = compute(stored, current, pendingOp);
        setStored(result);
        setDisplay(formatDisplay(result));
      } else {
        setStored(current);
      }
      setPendingOp(op);
      setOverwrite(true);
    },
    [display, stored, pendingOp, overwrite]
  );

  const equals = useCallback(() => {
    if (pendingOp === null || stored === null) return;
    const current = parseFloat(display);
    const result = compute(stored, current, pendingOp);
    setDisplay(formatDisplay(result));
    setStored(null);
    setPendingOp(null);
    setOverwrite(true);
  }, [display, stored, pendingOp]);

  const backspace = useCallback(() => {
    setDisplay((prev) => {
      if (overwrite || prev.length <= 1 || (prev.length === 2 && prev.startsWith("-"))) return "0";
      return prev.slice(0, -1);
    });
  }, [overwrite]);

  // Keyboard support — a calculator people can't type into feels broken.
  useEffect(() => {
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) inputDigit(e.key);
      else if (e.key === ".") inputDecimal();
      else if (e.key === "+" ) chooseOp("+");
      else if (e.key === "-") chooseOp("−");
      else if (e.key === "*") chooseOp("×");
      else if (e.key === "/") { e.preventDefault(); chooseOp("÷"); }
      else if (e.key === "Enter" || e.key === "=") equals();
      else if (e.key === "Backspace") backspace();
      else if (e.key === "Escape") clearAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputDigit, inputDecimal, chooseOp, equals, backspace, clearAll]);

  const opActive = (op) => pendingOp === op && overwrite;

  return (
    <div className="flex h-full flex-col bg-background-secondary p-3">
      <div className="mb-3 flex min-h-[68px] shrink-0 flex-col items-end justify-end rounded-xl bg-background px-4 py-3">
        {pendingOp && (
          <p className="mb-0.5 text-[11px] text-foreground-secondary/70">
            {formatDisplay(stored ?? 0)} {pendingOp}
          </p>
        )}
        <p className="truncate text-[32px] font-light tabular-nums text-foreground">{display}</p>
      </div>

      <div className="grid flex-1 grid-cols-4 gap-2">
        <CalcBtn label="AC" onClick={clearAll} variant="secondary" />
        <CalcBtn label="±" onClick={toggleSign} variant="secondary" />
        <CalcBtn label="%" onClick={percent} variant="secondary" />
        <CalcBtn label={<Delete size={16} />} onClick={backspace} variant="secondary" />

        <CalcBtn label="7" onClick={() => inputDigit("7")} />
        <CalcBtn label="8" onClick={() => inputDigit("8")} />
        <CalcBtn label="9" onClick={() => inputDigit("9")} />
        <CalcBtn label="÷" onClick={() => chooseOp("÷")} variant="accent" active={opActive("÷")} />

        <CalcBtn label="4" onClick={() => inputDigit("4")} />
        <CalcBtn label="5" onClick={() => inputDigit("5")} />
        <CalcBtn label="6" onClick={() => inputDigit("6")} />
        <CalcBtn label="×" onClick={() => chooseOp("×")} variant="accent" active={opActive("×")} />

        <CalcBtn label="1" onClick={() => inputDigit("1")} />
        <CalcBtn label="2" onClick={() => inputDigit("2")} />
        <CalcBtn label="3" onClick={() => inputDigit("3")} />
        <CalcBtn label="−" onClick={() => chooseOp("−")} variant="accent" active={opActive("−")} />

        <CalcBtn label="0" onClick={() => inputDigit("0")} className="col-span-2" />
        <CalcBtn label="." onClick={inputDecimal} />
        <CalcBtn label="+" onClick={() => chooseOp("+")} variant="accent" active={opActive("+")} />

        <CalcBtn label="=" onClick={equals} variant="accent" className="col-span-4" />
      </div>
    </div>
  );
}

function CalcBtn({ label, onClick, variant = "default", active = false, className = "" }) {
  const base = "rounded-xl text-[16px] font-medium transition-colors flex items-center justify-center";
  const styles =
    variant === "accent"
      ? active
        ? "bg-white text-accent"
        : "bg-accent text-white hover:opacity-90"
      : variant === "secondary"
      ? "bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.12]"
      : "bg-background text-foreground hover:bg-foreground/[0.06]";
  return (
    <button onClick={onClick} className={`${base} ${styles} ${className}`}>
      {label}
    </button>
  );
}
