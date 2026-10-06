"""A filled ━━━ progress bar, reused by the report dialog."""

from rich.text import Text

from ... import theme


def progress_bar(percent: int, width: int) -> Text:
    """A ━━━ bar: green when complete, cyan while filling, on a dim track."""
    filled = round(width * percent / 100)
    color = theme.GREEN if percent >= 100 else theme.CYAN
    return Text.assemble(("━" * filled, color), ("━" * (width - filled), theme.BORDER_STR))
