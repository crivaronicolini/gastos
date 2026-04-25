import { viewPaths } from "@better-auth-ui/react/core";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { Settings } from "@/components/settings/settings";

export const Route = createFileRoute("/settings/$path")({
  beforeLoad({ params: { path } }) {
    if (!Object.values(viewPaths.settings).includes(path)) {
      throw notFound();
    }
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { path } = Route.useParams();

  return (
    <div className="w-full max-w-3xl mx-auto p-4 md:p-6">
      <Settings path={path} />
    </div>
  );
}
