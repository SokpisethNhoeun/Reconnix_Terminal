/* Unknown address outside the signed-in shell: the card is the page. */
import { NotFoundCard } from "@/components/layout/not-found-card";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <NotFoundCard />
    </main>
  );
}
