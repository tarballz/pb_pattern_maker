#!/usr/bin/env python3
"""AST-based static analysis for PixelBlaze pattern files.

Parses patterns with esprima and enforces the rules in AGENTS.md and
references/safety-rules.md: no allocation in per-frame/per-pixel functions,
PixelBlaze's ES6 subset only, no closures over function locals, expensive ops
cached in beforeRender, fixed-point range/precision awareness, and UI-control
presence.
"""

import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

import esprima
from esprima import nodes as esnodes


class Severity(Enum):
    ERROR = "ERROR"
    WARN = "WARN"
    INFO = "INFO"


@dataclass
class Finding:
    severity: Severity
    message: str
    file: str
    line: int | None = None


RENDER_FUNCS = ["render", "render2D", "render3D"]

# Expensive operations that should ideally be in beforeRender.
# hypot and hypot3 are excluded — they're cheap distance functions expected in render.
EXPENSIVE_OPS = frozenset({
    "perlin", "perlinFbm", "perlinTurbulence", "perlinRidge",
    "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
    "sqrt", "log", "log2", "pow", "exp", "random",
})

# Known PixelBlaze globals, mirrored from the emulator's authoritative catalog
# (~/code/pb/pixelblaze-pattern-emulator/src/vm/builtins.catalog.js) plus the
# clock-sync functions documented in references/language.md.
BUILTINS = frozenset({
    # Math constants
    "PI", "PI2", "PI3_4", "PISQ", "E", "LN2", "LN10", "LOG2E", "LOG10E",
    "SQRT1_2", "SQRT2",
    # Math
    "abs", "acos", "asin", "atan", "ceil", "cos", "exp", "floor", "log",
    "log2", "round", "sin", "sqrt", "tan", "trunc", "frac", "atan2", "pow",
    "mod", "max", "min", "hypot", "hypot3", "clamp",
    # PRNG
    "random", "prngSeed", "prng",
    # Waveforms
    "time", "wave", "triangle", "square", "mix", "smoothstep",
    "bezierQuadratic", "bezierCubic",
    # Perlin
    "perlin", "perlinFbm", "perlinRidge", "perlinTurbulence", "setPerlinWrap",
    # Color / pixel output
    "hsv", "hsv24", "rgb", "setPalette", "paint",
    # Arrays
    "array", "arrayLength", "arrayForEach", "arrayMapTo", "arrayMutate",
    "arrayReduce", "arrayReplace", "arrayReplaceAt", "arraySort",
    "arraySortBy", "arraySum",
    # Transforms
    "resetTransform", "transform", "translate", "scale", "rotate",
    "translate3D", "scale3D", "rotateX", "rotateY", "rotateZ",
    # Map introspection
    "pixelMapDimensions", "has2DMap", "has3DMap", "mapPixels",
    # Clock / sync
    "clockYear", "clockMonth", "clockDay", "clockHour", "clockMinute",
    "clockSecond", "clockWeekday", "requestSync", "syncTime", "resetTime",
    # Hardware I/O
    "analogRead", "digitalRead", "digitalWrite", "pinMode", "touchRead",
    "INPUT", "OUTPUT", "INPUT_PULLUP", "INPUT_PULLDOWN", "HIGH", "LOW",
    # Sequencer / misc
    "sequencerNext", "sequencerGetMode", "playlistGetPosition",
    "playlistSetPosition", "playlistGetLength", "nodeId",
    # Sensor board globals
    "frequencyData", "energyAverage", "maxFrequency", "maxFrequencyMagnitude",
    "accelerometer", "light", "analogInputs",
    # Runtime globals
    "pixelCount",
})

# The only property accesses PixelBlaze supports (on arrays).
ALLOWED_PROPS = frozenset({"length", "forEach", "map", "reduce", "sort", "mutate"})

CONTROL_PREFIXES = ("slider", "toggle", "hsvPicker", "rgbPicker", "inputNumber", "trigger")

FUNCTION_TYPES = frozenset({"FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"})

FIXED_POINT_MAX = 32768
FIXED_POINT_EPSILON = 1.0 / 65536


def iter_child_nodes(node):
    for value in vars(node).values():
        if isinstance(value, esnodes.Node):
            yield value
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, esnodes.Node):
                    yield item


def walk(node):
    """Yield node and all descendants."""
    stack = [node]
    while stack:
        n = stack.pop()
        yield n
        stack.extend(iter_child_nodes(n))


def walk_shallow(root):
    """Yield descendants of root without entering nested function bodies.

    Nested function nodes themselves are yielded (so callers can see them),
    but their parameters and bodies are not.
    """
    stack = list(iter_child_nodes(root))
    while stack:
        n = stack.pop()
        yield n
        if n.type not in FUNCTION_TYPES:
            stack.extend(iter_child_nodes(n))


def line_of(node):
    loc = getattr(node, "loc", None)
    return loc.start.line if loc else None


def function_locals(fn):
    """Names bound in fn's own scope: params, var/let/const, inner fn names."""
    names = set()
    for p in fn.params:
        if p.type == "Identifier":
            names.add(p.name)
    for n in walk_shallow(fn.body):
        if n.type == "VariableDeclaration":
            for decl in n.declarations:
                if decl.id.type == "Identifier":
                    names.add(decl.id.name)
        elif n.type == "FunctionDeclaration" and n.id is not None:
            names.add(n.id.name)
    return names


def shallow_identifier_refs(fn):
    """(name, line) for identifiers referenced in fn's own scope (not nested fns).

    Skips the property side of non-computed member access (`arr.length`).
    """
    skip = set()
    refs = []
    for n in walk_shallow(fn.body):
        if n.type == "MemberExpression" and not n.computed:
            skip.add(id(n.property))
        elif n.type == "Identifier" and id(n) not in skip:
            refs.append((n.name, line_of(n)))
    return refs


def literal_is_truthy_constant(test):
    return test is not None and test.type == "Literal" and bool(test.value)


def loop_can_exit(body):
    return any(n.type in ("BreakStatement", "ReturnStatement") for n in walk(body))


def validate_pattern(code: str, filename: str) -> list[Finding]:
    findings = []

    def add(severity, message, node=None):
        findings.append(Finding(severity, message, filename, line_of(node) if node else None))

    try:
        tree = esprima.parseModule(code, {"loc": True})
    except Exception as e:
        findings.append(Finding(Severity.ERROR, f"Parse error: {e}", filename))
        return findings

    # --- collect exported functions -------------------------------------
    exported = {}
    for item in tree.body:
        if item.type == "ExportNamedDeclaration" and item.declaration is not None:
            decl = item.declaration
            if decl.type == "FunctionDeclaration" and decl.id is not None:
                exported[decl.id.name] = decl

    before_render = exported.get("beforeRender")
    render_bodies = {name: exported[name] for name in RENDER_FUNCS if name in exported}

    if before_render is None:
        add(Severity.ERROR, "Missing export function beforeRender(delta)")
    if not render_bodies:
        add(Severity.ERROR, "Missing export function render/render2D/render3D")

    # --- unsupported-syntax sweep (whole module) ------------------------
    seen_literal_warnings = set()
    declared_names = set(BUILTINS)
    for n in walk(tree):
        t = n.type
        if t == "SwitchStatement":
            add(Severity.ERROR, "switch statement — not supported by PixelBlaze", n)
        elif t == "ObjectExpression":
            add(Severity.ERROR, "Object literal — PixelBlaze has no objects", n)
        elif t in ("ClassDeclaration", "ClassExpression"):
            add(Severity.ERROR, "class — not supported by PixelBlaze", n)
        elif t in ("TemplateLiteral", "TaggedTemplateExpression"):
            add(Severity.ERROR, "Template literal — PixelBlaze has no strings", n)
        elif t in ("SpreadElement", "RestElement"):
            add(Severity.ERROR, "Spread/rest operator — not supported by PixelBlaze", n)
        elif t in ("ObjectPattern", "ArrayPattern"):
            add(Severity.ERROR, "Destructuring — not supported by PixelBlaze", n)
        elif t in ("TryStatement", "ThrowStatement"):
            add(Severity.ERROR, "try/throw — not supported by PixelBlaze", n)
        elif t == "NewExpression":
            add(Severity.ERROR, "new expression — not supported by PixelBlaze", n)
        elif t == "ThisExpression":
            add(Severity.ERROR, "this — not supported by PixelBlaze", n)
        elif t in ("ForInStatement", "ForOfStatement"):
            add(Severity.ERROR, "for-in/for-of — not supported by PixelBlaze (use an index loop)", n)
        elif t == "UnaryExpression" and n.operator in ("typeof", "delete", "void"):
            add(Severity.ERROR, f"{n.operator} — not supported by PixelBlaze", n)
        elif t == "BinaryExpression" and n.operator in ("instanceof", "in"):
            add(Severity.ERROR, f"{n.operator} — not supported by PixelBlaze", n)
        elif t == "MemberExpression" and not n.computed:
            prop = n.property.name if n.property.type == "Identifier" else None
            if prop not in ALLOWED_PROPS:
                add(Severity.ERROR,
                    f"Property access .{prop} — PixelBlaze has no objects "
                    f"(arrays support only .{'/.'.join(sorted(ALLOWED_PROPS))})", n)
        elif t in ("WhileStatement", "DoWhileStatement"):
            if literal_is_truthy_constant(n.test) and not loop_can_exit(n.body):
                add(Severity.ERROR, "Infinite loop with no break — will hang the device (no watchdog)", n)
        elif t == "ForStatement":
            if (n.test is None or literal_is_truthy_constant(n.test)) and not loop_can_exit(n.body):
                add(Severity.ERROR, "Infinite loop with no break — will hang the device (no watchdog)", n)
        elif t == "Literal":
            v = n.value
            if isinstance(v, str):
                if ("string", v) not in seen_literal_warnings:
                    seen_literal_warnings.add(("string", v))
                    add(Severity.WARN, "String literal — PixelBlaze has no string support (numbers only)", n)
            elif getattr(n, "regex", None):
                add(Severity.ERROR, "Regex literal — not supported by PixelBlaze", n)
            elif isinstance(v, (int, float)) and not isinstance(v, bool):
                if abs(v) > FIXED_POINT_MAX and ("range", v) not in seen_literal_warnings:
                    seen_literal_warnings.add(("range", v))
                    add(Severity.WARN,
                        f"Literal {v} exceeds fixed-point range ±32768 — will overflow", n)
                elif 0 < abs(v) < FIXED_POINT_EPSILON and ("precision", v) not in seen_literal_warnings:
                    seen_literal_warnings.add(("precision", v))
                    add(Severity.WARN,
                        f"Literal {v} is below fixed-point precision (1/65536) — rounds to zero", n)

        # Track every name the module binds, for the undefined-call check.
        if t == "FunctionDeclaration" and n.id is not None:
            declared_names.add(n.id.name)
        elif t == "VariableDeclarator" and n.id.type == "Identifier":
            declared_names.add(n.id.name)
        elif t == "AssignmentExpression" and n.left.type == "Identifier":
            declared_names.add(n.left.name)  # implicit global
        if t in FUNCTION_TYPES:
            for p in n.params:
                if p.type == "Identifier":
                    declared_names.add(p.name)

    # --- calls to undefined functions -----------------------------------
    for n in walk(tree):
        if n.type == "CallExpression" and n.callee.type == "Identifier":
            name = n.callee.name
            if name not in declared_names:
                add(Severity.ERROR,
                    f"Call to undefined function {name}() — not a PixelBlaze builtin "
                    "or defined in this pattern", n)

    # --- closures over function locals ----------------------------------
    def check_closures(fn, enclosing_scopes, owner):
        locals_ = function_locals(fn)
        if enclosing_scopes:  # this is a nested function
            for name, line in shallow_identifier_refs(fn):
                if name in locals_:
                    continue
                if any(name in scope for scope in enclosing_scopes):
                    findings.append(Finding(
                        Severity.ERROR,
                        f"Closure over '{name}' from enclosing function {owner} — "
                        "nested functions cannot read parent function locals in PixelBlaze",
                        filename, line))
        for child in walk_shallow(fn.body):
            if child.type in FUNCTION_TYPES:
                child_name = child.id.name if getattr(child, "id", None) else owner
                check_closures(child, enclosing_scopes + [locals_], child_name)

    for item in walk_shallow(tree):
        if item.type in FUNCTION_TYPES:
            name = item.id.name if getattr(item, "id", None) else "<anonymous>"
            check_closures(item, [], name)

    # --- per-frame / per-pixel body checks ------------------------------
    def check_no_allocation(fn, fn_name, context):
        for n in walk(fn.body):
            if n.type == "CallExpression" and n.callee.type == "Identifier" and n.callee.name == "array":
                add(Severity.ERROR, f"array() allocation in {fn_name} — will leak memory ({context})", n)
            elif n.type == "ArrayExpression":
                add(Severity.ERROR, f"Array literal in {fn_name} — will leak memory ({context})", n)

    if before_render is not None:
        check_no_allocation(before_render, "beforeRender", "runs every frame; arrays are never freed")

    for fn_name, fn in render_bodies.items():
        check_no_allocation(fn, fn_name, "runs for every pixel; arrays are never freed")

        seen_ops = set()
        for n in walk(fn.body):
            if n.type == "CallExpression" and n.callee.type == "Identifier":
                callee = n.callee.name
                if callee == "time":
                    add(Severity.ERROR, f"time() called in {fn_name} — move to beforeRender", n)
                elif callee in EXPENSIVE_OPS and callee not in seen_ops:
                    seen_ops.add(callee)
                    add(Severity.WARN, f"{callee}() in {fn_name} — consider caching in beforeRender", n)
            elif n.type == "FunctionDeclaration":
                add(Severity.ERROR, f"Nested function definition in {fn_name} — no closures in PB", n)

    # --- UI controls ----------------------------------------------------
    has_controls = any(name.startswith(CONTROL_PREFIXES) for name in exported)
    if not has_controls:
        add(Severity.INFO, "No UI controls (slider/toggle/picker) exported")

    # --- dimensionality -------------------------------------------------
    if render_bodies and not (len(render_bodies) > 1 or "render" in render_bodies):
        if "render3D" in render_bodies and "render2D" not in render_bodies:
            add(Severity.INFO, "Only render3D exported — no render2D fallback")
        elif "render2D" in render_bodies and "render3D" not in render_bodies:
            add(Severity.INFO, "Only render2D exported — no render3D")

    # --- gamma correction heuristic -------------------------------------
    def has_gamma(fn):
        for n in walk(fn.body):
            if (n.type == "BinaryExpression" and n.operator == "*"
                    and n.left.type == "Identifier" and n.right.type == "Identifier"
                    and n.left.name == n.right.name):
                return True
            if (n.type == "CallExpression" and n.callee.type == "Identifier"
                    and n.callee.name == "pow" and len(n.arguments) == 2
                    and n.arguments[1].type == "Literal"
                    and isinstance(n.arguments[1].value, (int, float))
                    and n.arguments[1].value >= 2):
                return True
        return False

    def sets_color(fn):
        return any(n.type == "CallExpression" and n.callee.type == "Identifier"
                   and n.callee.name in ("hsv", "rgb")
                   for n in walk(fn.body))

    if render_bodies and any(sets_color(fn) for fn in render_bodies.values()):
        if not any(has_gamma(fn) for fn in render_bodies.values()):
            add(Severity.INFO, "No apparent gamma correction (v*v) on the brightness channel")

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
        where = f"{finding.file}:{finding.line}" if finding.line else finding.file
        print(f"  [{icon}] {where}: {finding.message}")
        if finding.severity == Severity.ERROR:
            has_errors = True

    error_count = sum(1 for f in all_findings if f.severity == Severity.ERROR)
    warn_count = sum(1 for f in all_findings if f.severity == Severity.WARN)
    info_count = sum(1 for f in all_findings if f.severity == Severity.INFO)
    print(f"\n{error_count} errors, {warn_count} warnings, {info_count} info")

    sys.exit(1 if has_errors else 0)


if __name__ == "__main__":
    main()
