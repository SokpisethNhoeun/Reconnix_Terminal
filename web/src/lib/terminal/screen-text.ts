/* The terminal's text for "Copy output": its lines as plain text. A line the terminal
   wrapped joins the one before it; trailing spaces and the empty lines at the end go. */

export interface ScreenLine {
  text: string;
  wrapped: boolean; // continues the line above (the terminal wrapped it)
}

export function screenText(lines: ScreenLine[]): string {
  const out: string[] = [];
  for (const line of lines) {
    if (line.wrapped && out.length) out[out.length - 1] += line.text;
    else out.push(line.text);
  }
  const trimmed = out.map((l) => l.replace(/\s+$/, ""));
  while (trimmed.length && !trimmed[trimmed.length - 1]) trimmed.pop();
  return trimmed.join("\n");
}
