import { useState } from "react";
import { format } from "date-fns";
import { useCreatePreDayPlan, getListPreDayPlansQueryKey } from "@workspace/api-client-react";
import type { PreDayPlan } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Brain, Loader2, Plus } from "lucide-react";

interface FormData {
  date: string;
  tasksPlanned: string;
  calendarCommitments: string;
  energyNote: string;
}

const defaultForm = (): FormData => ({
  date: format(new Date(), "yyyy-MM-dd"),
  tasksPlanned: "",
  calendarCommitments: "",
  energyNote: "",
});

function AiCard({ title, icon, iconClass, content, bg, border }: {
  title: string;
  icon: React.ReactNode;
  iconClass?: string;
  content: string | null | undefined;
  bg: string;
  border: string;
}) {
  return (
    <Card className={`${bg} ${border}`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 text-base ${iconClass ?? ""}`}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">
        {content || "No output generated."}
      </CardContent>
    </Card>
  );
}

export default function PreDayPlanPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createPlan = useCreatePreDayPlan();
  const [form, setForm] = useState<FormData>(defaultForm());
  const [result, setResult] = useState<PreDayPlan | null>(null);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    createPlan.mutate(
      {
        data: {
          date: form.date,
          tasksPlanned: form.tasksPlanned.trim() || undefined,
          calendarCommitments: form.calendarCommitments.trim() || undefined,
          energyNote: form.energyNote.trim() || undefined,
        },
      },
      {
        onSuccess: (data) => {
          setResult(data);
          toast({ title: "Plan generated" });
          queryClient.invalidateQueries({ queryKey: getListPreDayPlansQueryKey() });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Failed to generate plan" });
        },
      }
    );
  }

  if (result) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Pre-Day Plan</h1>
          <p className="text-muted-foreground">
            {format(new Date(result.date + "T12:00:00"), "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        <AiCard
          title="Today's Plan"
          icon={<Sparkles className="h-5 w-5" />}
          iconClass="text-blue-400"
          content={result.aiPlan}
          bg="bg-blue-950/20"
          border="border-blue-800/30"
        />

        {result.aiContext && (
          <AiCard
            title="Pattern Context"
            icon={<Brain className="h-5 w-5" />}
            iconClass="text-amber-400"
            content={result.aiContext}
            bg="bg-amber-950/20"
            border="border-amber-800/30"
          />
        )}

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => { setForm(defaultForm()); setResult(null); }}
        >
          <Plus className="h-4 w-4" />
          Plan Another Day
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Pre-Day Plan</h1>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE, MMMM d, yyyy")} — Set up your day before it starts.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium w-44 shrink-0">Date</Label>
            <Input
              type="date"
              value={form.date}
              onChange={e => setField("date", e.target.value)}
              className="w-fit"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Tasks planned today</Label>
            <CardDescription>List what you intend to accomplish</CardDescription>
            <Textarea
              placeholder="e.g. Finish Q1 report, review PR, call client at 2pm..."
              value={form.tasksPlanned}
              onChange={e => setField("tasksPlanned", e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Calendar commitments</Label>
            <CardDescription>Meetings, appointments, fixed blocks</CardDescription>
            <Textarea
              placeholder="e.g. 10am team standup, 2pm doctor, 4pm client call..."
              value={form.calendarCommitments}
              onChange={e => setField("calendarCommitments", e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Energy note (optional)</Label>
            <CardDescription>How are you showing up today? Any constraints?</CardDescription>
            <Input
              placeholder="e.g. low energy, recovering from poor sleep, feeling sharp..."
              value={form.energyNote}
              onChange={e => setField("energyNote", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSubmit}
        disabled={createPlan.isPending}
        className="w-full md:w-auto"
        size="lg"
      >
        {createPlan.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {createPlan.isPending ? "Building plan..." : "Generate Plan"}
      </Button>
    </div>
  );
}
