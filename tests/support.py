"""Helpers shared by the UI tests."""

from typing import List

from reconix import store

SIZE = (140, 45)   # fixed terminal size so layout-dependent widgets behave the same


async def show(app, pilot, name: str) -> None:
    """Jump straight to a flow screen and let it mount."""
    app.goto(name)
    await pilot.pause()


def event_kinds() -> List[str]:
    return [event.kind for event in store.list_events()]
