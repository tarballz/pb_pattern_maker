"""Tests for inserting palette blocks into pattern files."""

import pytest

from palette_maker.insert import InsertError, block_var_name, insert_block

PATTERN = """\
// Honeycomb-style pattern
//http://example.com/old
//red-blue
var old_gp = [
    0, 255,  0,  0,
  255,   0,  0,255]

arrayMutate(old_gp,(v, i ,a) => v / 255);

var palettes = [old_gp]

export function beforeRender(delta) { t1 = time(0.1) }
export function render(index) { hsv(0, 0, 1) }
"""

BLOCK = """\
//http://example.com/new
//teal-purple
var new_gp = [
    0,   0,128,128,
  255, 128,  0,128]

arrayMutate(new_gp,(v, i ,a) => v / 255);
"""


class TestBlockVarName:
    def test_extracts_name(self):
        assert block_var_name(BLOCK) == "new_gp"

    def test_missing_declaration(self):
        with pytest.raises(InsertError):
            block_var_name("// just a comment\n")


class TestInsertBlock:
    def test_block_inserted_before_palettes(self):
        updated = insert_block(PATTERN, BLOCK)
        assert updated.index("var new_gp = [") < updated.index("var palettes = [")
        assert updated.index("var old_gp = [") < updated.index("var new_gp = [")

    def test_palettes_array_extended(self):
        updated = insert_block(PATTERN, BLOCK)
        assert "var palettes = [old_gp, new_gp]" in updated

    def test_rest_of_pattern_untouched(self):
        updated = insert_block(PATTERN, BLOCK)
        assert "export function beforeRender(delta) { t1 = time(0.1) }" in updated
        assert "arrayMutate(old_gp,(v, i ,a) => v / 255);" in updated

    def test_duplicate_rejected(self):
        updated = insert_block(PATTERN, BLOCK)
        with pytest.raises(InsertError, match="already defined"):
            insert_block(updated, BLOCK)

    def test_no_palettes_array_rejected(self):
        with pytest.raises(InsertError, match="palettes"):
            insert_block("export function render(index) { hsv(0,0,1) }\n", BLOCK)

    def test_insert_is_reparseable(self):
        """Inserting twice with different blocks keeps the structure valid."""
        second = BLOCK.replace("new_gp", "other_gp")
        updated = insert_block(insert_block(PATTERN, BLOCK), second)
        assert "var palettes = [old_gp, new_gp, other_gp]" in updated
