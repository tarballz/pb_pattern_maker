#!/usr/bin/env python3
"""Static analysis for PixelBlaze pattern files."""

import re
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path


class Severity(Enum):
    ERROR = "ERROR"
    WARN = "WARN"
    INFO = "INFO"


@dataclass
class Finding:
    severity: Severity
    message: str
    file: str


def extract_function_body(code: str, func_name: str) -> str | None:
    """Extract the body of an exported function by matching balanced braces."""
    pattern = rf"export\s+function\s+{re.escape(func_name)}\s*\([^)]*\)\s*\{{"
    match = re.search(pattern, code)
    if not match:
        return None

    start = match.end() - 1  # position of opening brace
    depth = 0
    for i in range(start, len(code)):
        if code[i] == "{":
            depth += 1
        elif code[i] == "}":
            depth -= 1
            if depth == 0:
                return code[start + 1 : i]
    return None


RENDER_FUNCS = ["render", "render2D", "render3D"]

# Expensive operations that should ideally be in beforeRender.
# hypot and hypot3 are excluded — they're cheap distance functions expected in render.
EXPENSIVE_OPS = ["perlin", "perlinFbm", "atan2", "log", "log2", "sqrt", "sin", "cos", "tan"]


def validate_pattern(code: str, filename: str) -> list[Finding]:
    findings = []

    # Check required exports
    has_before_render = extract_function_body(code, "beforeRender") is not None
    render_bodies = {}
    for name in RENDER_FUNCS:
        body = extract_function_body(code, name)
        if body is not None:
            render_bodies[name] = body

    if not has_before_render:
        findings.append(Finding(Severity.ERROR, "Missing export function beforeRender(delta)", filename))

    if not render_bodies:
        findings.append(Finding(Severity.ERROR, "Missing export function render/render2D/render3D", filename))

    # Check render function bodies
    for func_name, body in render_bodies.items():
        # Array allocation in render
        if re.search(r"\barray\s*\(", body):
            findings.append(Finding(Severity.ERROR, f"array() allocation in {func_name} — will leak memory", filename))
        if re.search(r"(?<!=)\s*\[(?!\s*\])[^\]]*\]", body):
            if re.search(r"(?:var|let|const)\s+\w+\s*=\s*\[", body):
                findings.append(Finding(Severity.ERROR, f"Array literal in {func_name} — will leak memory", filename))

        # time() in render
        if re.search(r"\btime\s*\(", body):
            findings.append(Finding(Severity.ERROR, f"time() called in {func_name} — move to beforeRender", filename))

        # Nested function definition
        if re.search(r"\bfunction\s+\w+\s*\(", body):
            findings.append(Finding(Severity.ERROR, f"Nested function definition in {func_name} — no closures in PB", filename))

        # Expensive operations (warn)
        for op in EXPENSIVE_OPS:
            if re.search(rf"\b{op}\s*\(", body):
                findings.append(Finding(Severity.WARN, f"{op}() in {func_name} — consider caching in beforeRender", filename))

    # Check for UI controls
    has_controls = bool(re.search(r"export\s+function\s+(?:slider|toggle|hsvPicker|rgbPicker|inputNumber|trigger)", code))
    if not has_controls:
        findings.append(Finding(Severity.INFO, "No UI controls (slider/toggle/picker) exported", filename))

    # Check for single dimension
    if render_bodies and not (len(render_bodies) > 1 or "render" in render_bodies):
        if "render3D" in render_bodies and "render2D" not in render_bodies:
            findings.append(Finding(Severity.INFO, "Only render3D exported — no render2D fallback", filename))
        elif "render2D" in render_bodies and "render3D" not in render_bodies:
            findings.append(Finding(Severity.INFO, "Only render2D exported — no render3D", filename))

    return findings


def validate_file(path: Path) -> list[Finding]:
    code = path.read_text()
    return validate_pattern(code, str(path))


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate.py <file_or_directory> [...]")
        sys.exit(1)

    all_findings = []
    for arg in sys.argv[1:]:
        path = Path(arg)
        if path.is_file() and path.suffix == ".js":
            all_findings.extend(validate_file(path))
        elif path.is_dir():
            for js_file in sorted(path.rglob("*.js")):
                all_findings.extend(validate_file(js_file))
        else:
            print(f"Skipping {arg} — not a .js file or directory")

    if not all_findings:
        print("All patterns valid.")
        sys.exit(0)

    has_errors = False
    for finding in all_findings:
        icon = {"ERROR": "x", "WARN": "!", "INFO": "i"}[finding.severity.value]
        print(f"  [{icon}] {finding.file}: {finding.message}")
        if finding.severity == Severity.ERROR:
            has_errors = True

    error_count = sum(1 for f in all_findings if f.severity == Severity.ERROR)
    warn_count = sum(1 for f in all_findings if f.severity == Severity.WARN)
    info_count = sum(1 for f in all_findings if f.severity == Severity.INFO)
    print(f"\n{error_count} errors, {warn_count} warnings, {info_count} info")

    sys.exit(1 if has_errors else 0)


if __name__ == "__main__":
    main()
