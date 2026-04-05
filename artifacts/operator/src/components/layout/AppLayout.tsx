import { Link, useLocation } from "wouter";
import { Calendar, History, CheckCircle2, LayoutDashboard, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navigation = [
    { name: "Daily Check-In", href: "/", icon: CheckCircle2 },
    { name: "Weekly Review", href: "/weekly", icon: Calendar },
    { name: "History", href: "/history", icon: History },
    { name: "Settings", href: "/settings", icon: Settings2 },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 font-semibold text-xl tracking-tight text-primary">
            <LayoutDashboard className="h-6 w-6" />
            Operator
          </div>
          <p className="text-sm text-muted-foreground mt-1">Personal Life OS</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium",
                location === item.href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>
      
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="container max-w-4xl mx-auto py-8 px-4 md:px-8">
          {children}
        </div>
      </main>
      
      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 w-full border-t border-border bg-card flex justify-around p-3 z-50">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex flex-col items-center p-2 rounded-md",
              location === item.href ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5 mb-1" />
            <span className="text-[10px]">{item.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
