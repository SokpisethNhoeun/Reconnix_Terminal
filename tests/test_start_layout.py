"""Start screen layout: the splash stays centred and the steps never wrap."""

import pytest

from reconix.app import ReconixApp


@pytest.mark.parametrize("size", [(200, 50), (140, 45), (80, 24)])
async def test_logo_and_steps_panel_are_centred(size):
    app = ReconixApp()
    async with app.run_test(size=size) as pilot:
        await pilot.pause()
        area = app.screen.query_one("#start-center").region
        for selector in ("#logo", "#quickstart"):
            box = app.screen.query_one(selector).region
            left, right = box.x - area.x, area.right - box.right
            assert abs(left - right) <= 1, f"{selector} is off-centre at {size}"


async def test_quickstart_steps_fit_on_one_line_each(app):
    async with app.run_test(size=(200, 50)) as pilot:
        await pilot.pause()
        steps = app.screen.query_one("#quickstart").query("Static").first()
        assert steps.region.height == 3
