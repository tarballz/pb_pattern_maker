import pytest
from validate import extract_function_body, validate_pattern, Severity


class TestExtractFunctionBody:
    def test_simple_function(self):
        code = 'export function render3D(index, x, y, z) { hsv(x, 1, 1) }'
        body = extract_function_body(code, "render3D")
        assert body is not None
        assert "hsv" in body

    def test_multiline_function(self):
        code = """export function render3D(index, x, y, z) {
  var d = hypot3(x - 0.5, y - 0.5, z - 0.5)
  hsv(d, 1, 1)
}"""
        body = extract_function_body(code, "render3D")
        assert "hypot3" in body

    def test_nested_braces(self):
        code = """export function render3D(index, x, y, z) {
  if (x > 0.5) {
    hsv(1, 1, 1)
  } else {
    hsv(0, 1, 1)
  }
}"""
        body = extract_function_body(code, "render3D")
        assert "if" in body
        assert "else" in body

    def test_missing_function(self):
        code = 'export function render(index) { hsv(0, 0, 0) }'
        body = extract_function_body(code, "render3D")
        assert body is None

    def test_non_export_ignored(self):
        code = 'function render3D(index, x, y, z) { hsv(0, 0, 0) }'
        body = extract_function_body(code, "render3D")
        assert body is None


class TestValidatePattern:
    def test_valid_pattern(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  hsv(x, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert len(errors) == 0

    def test_missing_before_render(self):
        code = """
export function render3D(index, x, y, z) {
  hsv(x, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert any("beforeRender" in f.message for f in errors)

    def test_missing_render(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert any("render" in f.message for f in errors)

    def test_array_in_render(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  var a = array(10)
  hsv(x, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert any("array" in f.message.lower() for f in errors)

    def test_time_in_render(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  var t = time(0.1)
  hsv(x, 1, t)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert any("time()" in f.message for f in errors)

    def test_nested_function_in_render(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  function helper() { return 1 }
  hsv(x, 1, helper())
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert any("function" in f.message.lower() for f in errors)

    def test_expensive_op_in_render_warns(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  var a = atan2(y - 0.5, x - 0.5)
  hsv(a, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        warns = [f for f in findings if f.severity == Severity.WARN]
        assert any("atan2" in f.message for f in warns)

    def test_no_ui_controls_info(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  hsv(x, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        infos = [f for f in findings if f.severity == Severity.INFO]
        assert any("UI" in f.message or "slider" in f.message.lower() for f in infos)

    def test_render2d_alone_is_valid(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render2D(index, x, y) {
  hsv(x, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert len(errors) == 0

    def test_render_alone_is_valid(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render(index) {
  hsv(index / pixelCount, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert len(errors) == 0

    def test_hypot3_in_render_not_warned(self):
        """hypot3 and hypot are expected in render — they're cheap distance functions."""
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  var d = hypot3(x - 0.5, y - 0.5, z - 0.5)
  hsv(d, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        warns = [f for f in findings if f.severity == Severity.WARN]
        assert not any("hypot" in f.message for f in warns)
