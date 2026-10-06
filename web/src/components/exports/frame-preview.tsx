/* The PDF or HTML report shown in place, framed from the same-origin export route. */
export function FramePreview({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      src={src}
      title={title}
      className="block h-[72vh] min-h-[520px] w-full rounded-[16px] shadow-[var(--press-sm)]"
    />
  );
}
