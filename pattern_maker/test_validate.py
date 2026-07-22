from validate import Severity, validate_pattern


def errors(findings):
    return [f for f in findings if f.severity == Severity.ERROR]


def warns(findings):
    return [f for f in findings if f.severity == Severity.WARN]


def infos(findings):
    return [f for f in findings if f.severity == Severity.INFO]


MINIMAL = """
export function beforeRender(delta) {{
  t1 = time(0.1)
}}
export function render3D(index, x, y, z) {{
  {render_body}
}}
"""


def pattern(render_body="hsv(x, 1, x*x)"):
    return MINIMAL.format(render_body=render_body)


class TestStructure:
    def test_valid_pattern(self):
        assert errors(validate_pattern(pattern(), "test.js")) == []

    def test_missing_before_render(self):
        code = "export function render3D(index, x, y, z) { hsv(x, 1, 1) }"
        assert any("beforeRender" in f.message for f in errors(validate_pattern(code, "test.js")))

    def test_missing_render(self):
        code = "export function beforeRender(delta) { t1 = time(0.1) }"
        assert any("render" in f.message for f in errors(validate_pattern(code, "test.js")))

    def test_render2d_alone_is_valid(self):
        code = """
export function beforeRender(delta) { t1 = time(0.1) }
export function render2D(index, x, y) { hsv(x, 1, x*x) }
"""
        assert errors(validate_pattern(code, "test.js")) == []

    def test_render_alone_is_valid(self):
        code = """
export function beforeRender(delta) { t1 = time(0.1) }
export function render(index) { hsv(index / pixelCount, 1, 1) }
"""
        assert errors(validate_pattern(code, "test.js")) == []

    def test_parse_error_reported(self):
        code = "export function beforeRender(delta) { t1 = "
        found = validate_pattern(code, "test.js")
        assert any("Parse error" in f.message for f in errors(found))


class TestAllocation:
    def test_array_call_in_render(self):
        found = validate_pattern(pattern("var a = array(10)\n  hsv(x, 1, 1)"), "test.js")
        assert any("array()" in f.message for f in errors(found))

    def test_array_literal_in_render(self):
        found = validate_pattern(pattern("var a = [x, y]\n  hsv(x, 1, 1)"), "test.js")
        assert any("Array literal" in f.message for f in errors(found))

    def test_bare_array_literal_in_render(self):
        """Array literals not bound to a variable still allocate."""
        found = validate_pattern(pattern("lookup([x, y])\n  hsv(x, 1, 1)"), "test.js")
        assert any("Array literal" in f.message for f in errors(found))

    def test_array_call_in_before_render(self):
        code = """
export function beforeRender(delta) {
  scratch = array(8)
  t1 = time(0.1)
}
export function render3D(index, x, y, z) { hsv(x, 1, x*x) }
"""
        found = validate_pattern(code, "test.js")
        assert any("array()" in f.message and "beforeRender" in f.message for f in errors(found))

    def test_module_scope_allocation_ok(self):
        code = """
var lut = array(16)
var palette_gp = [0, 255, 0, 0, 255, 0, 0, 255]
export function beforeRender(delta) { t1 = time(0.1) }
export function render3D(index, x, y, z) { hsv(lut[0], 1, x*x) }
"""
        assert errors(validate_pattern(code, "test.js")) == []


class TestRenderBodyRules:
    def test_time_in_render(self):
        found = validate_pattern(pattern("var t = time(0.1)\n  hsv(x, 1, t)"), "test.js")
        assert any("time()" in f.message for f in errors(found))

    def test_time_in_comment_not_flagged(self):
        """The old regex validator false-positived on comments; the AST must not."""
        found = validate_pattern(pattern("// uses time() from beforeRender\n  hsv(x, 1, t1)"), "test.js")
        assert not any("time()" in f.message for f in errors(found))

    def test_nested_function_in_render(self):
        found = validate_pattern(pattern("function helper() { return 1 }\n  hsv(x, 1, helper())"), "test.js")
        assert any("Nested function" in f.message for f in errors(found))

    def test_expensive_op_in_render_warns(self):
        found = validate_pattern(pattern("var a = atan2(y - 0.5, x - 0.5)\n  hsv(a, 1, 1)"), "test.js")
        assert any("atan2" in f.message for f in warns(found))

    def test_pow_in_render_warns(self):
        found = validate_pattern(pattern("hsv(x, 1, pow(x, 3))"), "test.js")
        assert any("pow()" in f.message for f in warns(found))

    def test_hypot3_in_render_not_warned(self):
        """hypot3 and hypot are expected in render — they're cheap distance functions."""
        found = validate_pattern(
            pattern("var d = hypot3(x - 0.5, y - 0.5, z - 0.5)\n  hsv(d, 1, d*d)"), "test.js")
        assert not any("hypot" in f.message for f in warns(found))

    def test_expensive_op_warned_once_per_function(self):
        found = validate_pattern(pattern("hsv(sin(x), sin(y), sin(x*y))"), "test.js")
        assert sum("sin()" in f.message for f in warns(found)) == 1


class TestUnsupportedSyntax:
    def test_switch(self):
        found = validate_pattern(pattern("switch (index) { default: hsv(x, 1, 1) }"), "test.js")
        assert any("switch" in f.message for f in errors(found))

    def test_object_literal(self):
        code = "var cfg = {speed: 1}\n" + pattern()
        found = validate_pattern(code, "test.js")
        assert any("Object literal" in f.message for f in errors(found))

    def test_destructuring(self):
        code = "var [a, b] = coords\n" + pattern()
        found = validate_pattern(code, "test.js")
        assert any("Destructuring" in f.message for f in errors(found))

    def test_spread(self):
        code = "var a = combine(...parts)\n" + pattern()
        found = validate_pattern(code, "test.js")
        assert any("Spread" in f.message for f in errors(found))

    def test_property_access_flagged(self):
        found = validate_pattern(pattern("hsv(x.hue, 1, 1)"), "test.js")
        assert any("Property access .hue" in f.message for f in errors(found))

    def test_array_length_allowed(self):
        code = """
var lut = array(16)
export function beforeRender(delta) { t1 = time(0.1) }
export function render3D(index, x, y, z) { hsv(lut[index % lut.length], 1, x*x) }
"""
        assert errors(validate_pattern(code, "test.js")) == []

    def test_array_methods_allowed(self):
        code = """
var lut = array(16)
lut.mutate((v, i) => i / 16)
export function beforeRender(delta) { t1 = time(0.1) }
export function render3D(index, x, y, z) { hsv(lut[0], 1, x*x) }
"""
        assert errors(validate_pattern(code, "test.js")) == []

    def test_infinite_while_without_break(self):
        code = "function spin() { while (true) { x = x + 1 } }\n" + pattern()
        found = validate_pattern(code, "test.js")
        assert any("Infinite loop" in f.message for f in errors(found))

    def test_while_true_with_break_ok(self):
        code = "function spin() { while (true) { x = x + 1; if (x > 5) break } }\n" + pattern()
        found = validate_pattern(code, "test.js")
        assert not any("Infinite loop" in f.message for f in errors(found))

    def test_bounded_loop_ok(self):
        found = validate_pattern(
            pattern("for (var i = 0; i < 4; i++) { v = v + i }\n  hsv(x, 1, v*v)"), "test.js")
        assert not any("Infinite loop" in f.message for f in errors(found))

    def test_string_literal_warns(self):
        code = 'var label = "hello"\n' + pattern()
        found = validate_pattern(code, "test.js")
        assert any("String literal" in f.message for f in warns(found))


class TestUndefinedCalls:
    def test_typo_builtin_flagged(self):
        found = validate_pattern(pattern("hsv(x, 1, wav(t1))"), "test.js")
        assert any("wav()" in f.message for f in errors(found))

    def test_builtin_ok(self):
        found = validate_pattern(pattern("hsv(x, 1, wave(t1))"), "test.js")
        assert not any("undefined function" in f.message for f in errors(found))

    def test_user_function_ok(self):
        code = "function ease(v) { return v * v }\n" + pattern("hsv(x, 1, ease(x))")
        found = validate_pattern(code, "test.js")
        assert not any("undefined function" in f.message for f in errors(found))

    def test_function_valued_param_ok(self):
        code = "function apply(fn, v) { return fn(v) }\n" + pattern()
        found = validate_pattern(code, "test.js")
        assert not any("undefined function" in f.message for f in errors(found))


class TestClosures:
    def test_closure_over_function_local(self):
        code = """
var out = array(4)
export function beforeRender(delta) {
  var localScale = 2
  out.mutate((v) => v * localScale)
  t1 = time(0.1)
}
export function render3D(index, x, y, z) { hsv(out[0], 1, x*x) }
"""
        found = validate_pattern(code, "test.js")
        assert any("Closure over 'localScale'" in f.message for f in errors(found))

    def test_callback_reading_module_scope_ok(self):
        code = """
var out = array(4)
var scale = 2
export function beforeRender(delta) {
  out.mutate((v) => v * scale)
  t1 = time(0.1)
}
export function render3D(index, x, y, z) { hsv(out[0], 1, x*x) }
"""
        found = validate_pattern(code, "test.js")
        assert not any("Closure" in f.message for f in errors(found))

    def test_callback_own_params_ok(self):
        code = """
var gp = [0, 255, 0, 0]
arrayMutate(gp, (v, i, a) => v / 255)
export function beforeRender(delta) { t1 = time(0.1) }
export function render3D(index, x, y, z) { hsv(gp[0], 1, x*x) }
"""
        found = validate_pattern(code, "test.js")
        assert not any("Closure" in f.message for f in errors(found))


class TestFixedPoint:
    def test_sub_precision_literal_warns(self):
        code = "var eps = 0.000001\n" + pattern()
        found = validate_pattern(code, "test.js")
        assert any("precision" in f.message for f in warns(found))

    def test_out_of_range_literal_warns(self):
        code = "var big = 100000\n" + pattern()
        found = validate_pattern(code, "test.js")
        assert any("range" in f.message for f in warns(found))

    def test_normal_literals_ok(self):
        found = validate_pattern(pattern("hsv(x * 0.5, 1, x*x)"), "test.js")
        assert not any("fixed-point" in f.message for f in warns(found))


class TestInfoFindings:
    def test_no_ui_controls_info(self):
        found = validate_pattern(pattern(), "test.js")
        assert any("UI controls" in f.message for f in infos(found))

    def test_ui_controls_present(self):
        code = "export function sliderSpeed(v) { speed = v }\n" + pattern()
        found = validate_pattern(code, "test.js")
        assert not any("UI controls" in f.message for f in infos(found))

    def test_only_render3d_info(self):
        found = validate_pattern(pattern(), "test.js")
        assert any("render2D fallback" in f.message for f in infos(found))

    def test_missing_gamma_info(self):
        found = validate_pattern(pattern("hsv(x, 1, x)"), "test.js")
        assert any("gamma" in f.message for f in infos(found))

    def test_gamma_via_self_multiplication(self):
        found = validate_pattern(pattern("v = x\n  hsv(x, 1, v*v)"), "test.js")
        assert not any("gamma" in f.message for f in infos(found))

    def test_gamma_via_pow(self):
        found = validate_pattern(pattern("hsv(x, 1, pow(x, 2))"), "test.js")
        assert not any("gamma" in f.message for f in infos(found))

    def test_findings_carry_line_numbers(self):
        found = validate_pattern(pattern("var t = time(0.1)\n  hsv(x, 1, t)"), "test.js")
        time_errors = [f for f in errors(found) if "time()" in f.message]
        assert time_errors and time_errors[0].line is not None
