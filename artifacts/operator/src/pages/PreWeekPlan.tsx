import { useState } from "react";
import { format, startOfWeek } from "date-fns";
import { useCreatePreWeekPlan, getListPreWeekPlansQueryKey } from "@workspace/api-client-react";
import type { PreWeekPlan } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Brain, Loader2, Plus } from "lucide-react";

interface FormData {
  weekStartDate: string;
  goals: string;
  calendarCommitments: string;
  capacityNote: string;
  reflection: string;
}

const defaultForm = (): FormData => ({
  weekStartDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
  goals: "",
  calendarCommitments: "",
  capacityNote: "",
  reflection: "",
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

export default function PreWeekPlanPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createPlan = useCreatePreWeekPlan();
  const [form, setForm] = useState<FormData>(defaultForm());
  const [result, setResult] = useState<PreWeekPlan | null>(null);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    createPlan.mutate(
      {
        data: {
          weekStartDate: form.weekStartDate,
          goals: form.goals.trim() || undefined,
          calendarCommitments: form.calendarCommitments.trim() || undefined,
          capacityNote: form.capacityNote.trim() || undefined,
          reflection: form.reflection.trim() || undefined,
        },
      },
      {
        onSuccess: (data) => {
          setResult(data);
          toast({ title: "Weekly plan generated" });
          queryClient.invalidateQueries({ queryKey: getListPreWeekPlansQueryKey() });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Failed to generate weekly plan" });
        },
      }
    );
  }

  if (result) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Pre-Week Plan</h1>
          <p className="text-muted-foreground">
            Week of {format(new Date(result.weekStartDate + "T12:00:00"), "MMMM d, yyyy")}
          </p>
        </div>

        <AiCard
          title="Weekly Structure"
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
          Plan Another Week
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Pre-Week Plan</h1>
        <p className="text-muted-foreground">
          Set intentions and structure before the week begins.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium w-44 shrink-0">Week starting</Label>
            <Input
              type="date"
              value={form.weekStartDate}
              onChange={e => setField("weekStartDate", e.target.value)}
              className="w-fit"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Goals for the week</Label>
            <CardDescription>What does a successful week look like?</CardDescription>
            <Textarea
              placeholder="e.g. Ship the landing page, 4 gym sessions, close 2 deals..."
              value={form.goals}
              onChange={e => setField("goals", e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Calendar commitments</Label>
            <CardDescription>Fixed appointments, recurring meetings, travel</CardDescription>
            <Textarea
              placeholder="e.g. Mon 9am all-hands, Wed-Thu out of office, Fri afternoon free..."
              value={form.calendarCommitments}
              onChange={e => setField("calendarCommitments", e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Capacity note (optional)</Label>
            <CardDescription>Any constraints on your energy or availability this week?</CardDescription>
            <Input
              placeholder="e.g. recovering from illness, high-stress sprint, new routine..."
              value={form.capacityNote}
              onChange={e => setField("capacityNote", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Reflection (optional)</Label>
            <CardDescription>What's on your mind going into this week?</CardDescription>
            <Textarea
              placeholder="Anything you want to carry forward from last week or address this week..."
              value={form.reflection}
              onChange={e => setField("reflection", e.target.value)}
              className="min-h-[80px]"
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
        {createPlan.isPending ? "Building plan..." : "Generate Weekly Plan"}
      </Button>
    </div>
  );
}
