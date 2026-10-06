/* The "nothing here" card, shared by the root and the signed-in not-found pages. */
import Link from "next/link";

export function NotFoundCard() {
  return (
    <div className="card max-w-md items-center text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-[13.5px] text-muted">There is no saved assessment or page at this address.</p>
      <Link href="/" className="btn">
        Back to the overview
      </Link>
    </div>
  );
}
