import { Outlet } from "@tanstack/react-router";

export default function SettingsLayout() {
  return (
    <div className="flex flex-col gap-6 lg:gap-10 lg:pt-0">
      <main className="min-w-0 flex-1 pb-32 md:pb-0">
        <div className="fade-in slide-in-from-bottom-4 animate-in duration-500">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
