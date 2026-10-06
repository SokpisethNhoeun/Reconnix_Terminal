/* Unknown assessment or page inside the signed-in shell: the layout already provides
   <main> and the sidebar, so this is only the card. */
import { NotFoundCard } from "@/components/layout/not-found-card";

export default function DashNotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <NotFoundCard />
    </div>
  );
}
