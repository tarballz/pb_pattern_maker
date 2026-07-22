"""Insert a formatted palette block into a PixelBlaze pattern file."""

from __future__ import annotations

import re


class InsertError(ValueError):
    """The pattern file can't accept this palette block."""


_PALETTES_DECL = re.compile(r"^(?P<indent>[ \t]*)var\s+palettes\s*=\s*\[(?P<items>[^\]]*)\]", re.M)
_BLOCK_VAR = re.compile(r"^var (\w+_gp) = \[", re.M)


def block_var_name(block: str) -> str:
    """Extract the `<slug>_gp` variable name from a formatted palette block."""
    m = _BLOCK_VAR.search(block)
    if not m:
        raise InsertError("block has no `var <name>_gp = [` declaration")
    return m.group(1)


def insert_block(source: str, block: str) -> str:
    """Insert `block` before the pattern's `var palettes = [...]` declaration
    and append the new palette variable to that array.
    """
    var_name = block_var_name(block)

    if re.search(rf"\bvar\s+{re.escape(var_name)}\s*=", source):
        raise InsertError(f"{var_name} is already defined in the pattern")

    m = _PALETTES_DECL.search(source)
    if m is None:
        raise InsertError(
            "no `var palettes = [...]` declaration found — is this a palette-cycling pattern?"
        )

    items = [item.strip() for item in m.group("items").split(",") if item.strip()]
    items.append(var_name)
    new_decl = f"{m.group('indent')}var palettes = [{', '.join(items)}]"

    if not block.endswith("\n"):
        block += "\n"
    return source[: m.start()] + block + "\n" + new_decl + source[m.end() :]
