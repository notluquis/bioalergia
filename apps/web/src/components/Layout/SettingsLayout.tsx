import { Outlet } from "react-router-dom";

export default function SettingsLayout() {
  return (
    <div className="flex flex-col gap-6 pt-[calc(env(safe-area-inset-top)+4rem)] lg:gap-10 lg:pt-0">
      <main className="min-w-0 flex-1 pb-32 md:pb-0">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
