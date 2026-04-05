import { useState } from "react";
import { format } from "date-fns";
import { useCreateEodReview, getListEodReviewsQueryKey } from "@workspace/api-client-react";
import type { EodReview } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Brain, Sparkles, Loader2, Plus } from "lucide-react";

interface FormData {
  date: string;
  sleepHours: string;
  sleepScore: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  waterOz: string;
  steps: string;
  workoutCompleted: boolean;
  workoutType: string;
  habitsCompleted: string;
  tasksPlanned: string;
  tasksCompleted: string;
  tasksMissed: string;
  calendarCommitments: string;
  healthNotes: string;
  reflection: string;
}

const defaultForm = (): FormData => ({
  date: format(new Date(), "yyyy-MM-dd"),
  sleepHours: "",
  sleepScore: "",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  waterOz: "",
  steps: "",
  workoutCompleted: false,
  workoutType: "",
  habitsCompleted: "",
  tasksPlanned: "",
  tasksCompleted: "",
  tasksMissed: "",
  calendarCommitments: "",
  healthNotes: "",
  reflection: "",
});

function optNum(val: string): number | undefined {
  const n = Number(val);
  return val.trim() === "" || isNaN(n) ? undefined : n;
}

function FieldGroup({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <span>{icon}</span> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function OptionalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="text-sm font-medium text-muted-foreground min-w-0 shrink-0 w-40">{label}</Label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

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

export default function EndOfDayReviewPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createReview = useCreateEodReview();
  const [form, setForm] = useState<FormData>(defaultForm());
  const [result, setResult] = useState<EodReview | null>(null);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    createReview.mutate(
      {
        data: {
          date: form.date,
          sleepHours: optNum(form.sleepHours),
          sleepScore: optNum(form.sleepScore),
          calories: optNum(form.calories),
          proteinG: optNum(form.proteinG),
          carbsG: optNum(form.carbsG),
          fatG: optNum(form.fatG),
          waterOz: optNum(form.waterOz),
          steps: optNum(form.steps),
          workoutCompleted: form.workoutCompleted || undefined,
          workoutType: form.workoutType.trim() || undefined,
          habitsCompleted: form.habitsCompleted.trim() || undefined,
          tasksPlanned: optNum(form.tasksPlanned),
          tasksCompleted: optNum(form.tasksCompleted),
          tasksMissed: optNum(form.tasksMissed),
          calendarCommitments: form.calendarCommitments.trim() || undefined,
          healthNotes: form.healthNotes.trim() || undefined,
          reflection: form.reflection.trim() || undefined,
        },
      },
      {
        onSuccess: (data) => {
          setResult(data);
          toast({ title: "Review logged — AI insights generated" });
          queryClient.invalidateQueries({ queryKey: getListEodReviewsQueryKey() });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Failed to save review" });
        },
      }
    );
  }

  if (result) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">End-of-Day Review</h1>
          <p className="text-muted-foreground">
            {format(new Date(result.date + "T12:00:00"), "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        <AiCard
          title="Day Insight"
          icon={<Brain className="h-5 w-5" />}
          iconClass="text-amber-400"
          content={result.aiAnalysis}
          bg="bg-amber-950/20"
          border="border-amber-800/30"
        />

        <AiCard
          title="Tomorrow"
          icon={<Sparkles className="h-5 w-5" />}
          iconClass="text-blue-400"
          content={result.aiPlan}
          bg="bg-blue-950/20"
          border="border-blue-800/30"
        />

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => { setForm(defaultForm()); setResult(null); }}
        >
          <Plus className="h-4 w-4" />
          Log Another Day
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">End-of-Day Review</h1>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE, MMMM d, yyyy")} — Log what happened. AI analyzes the data.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium w-40 shrink-0">Date</Label>
          <Input
            type="date"
            value={form.date}
            onChange={e => setField("date", e.target.value)}
            className="w-fit"
          />
        </div>
      </div>

      <FieldGroup title="Sleep" icon="💤">
        <OptionalField label="Hours slept">
          <Input
            type="number"
            step="0.5"
            min="0"
            max="24"
            placeholder="e.g. 7.5"
            value={form.sleepHours}
            onChange={e => setField("sleepHours", e.target.value)}
            className="w-32"
          />
        </OptionalField>
        <OptionalField label="Sleep score (1–10)">
          <Input
            type="number"
            min="1"
            max="10"
            placeholder="e.g. 8"
            value={form.sleepScore}
            onChange={e => setField("sleepScore", e.target.value)}
            className="w-32"
          />
        </OptionalField>
      </FieldGroup>

      <FieldGroup title="Nutrition" icon="🥗">
        <div className="grid grid-cols-2 gap-4">
          <OptionalField label="Calories">
            <Input
              type="number"
              min="0"
              placeholder="e.g. 2100"
              value={form.calories}
              onChange={e => setField("calories", e.target.value)}
              className="w-32"
            />
          </OptionalField>
          <OptionalField label="Protein (g)">
            <Input
              type="number"
              min="0"
              placeholder="e.g. 160"
              value={form.proteinG}
              onChange={e => setField("proteinG", e.target.value)}
              className="w-32"
            />
          </OptionalField>
          <OptionalField label="Carbs (g)">
            <Input
              type="number"
              min="0"
              placeholder="e.g. 250"
              value={form.carbsG}
              onChange={e => setField("carbsG", e.target.value)}
              className="w-32"
            />
          </OptionalField>
          <OptionalField label="Fat (g)">
            <Input
              type="number"
              min="0"
              placeholder="e.g. 70"
              value={form.fatG}
              onChange={e => setField("fatG", e.target.value)}
              className="w-32"
            />
          </OptionalField>
          <OptionalField label="Water (oz)">
            <Input
              type="number"
              min="0"
              placeholder="e.g. 80"
              value={form.waterOz}
              onChange={e => setField("waterOz", e.target.value)}
              className="w-32"
            />
          </OptionalField>
        </div>
      </FieldGroup>

      <FieldGroup title="Activity" icon="🏃">
        <OptionalField label="Steps">
          <Input
            type="number"
            min="0"
            placeholder="e.g. 8500"
            value={form.steps}
            onChange={e => setField("steps", e.target.value)}
            className="w-36"
          />
        </OptionalField>
        <OptionalField label="Workout done">
          <Switch
            checked={form.workoutCompleted}
            onCheckedChange={v => setField("workoutCompleted", v)}
          />
        </OptionalField>
        {form.workoutCompleted && (
          <OptionalField label="Workout type">
            <Input
              placeholder="e.g. Strength, Run, Yoga"
              value={form.workoutType}
              onChange={e => setField("workoutType", e.target.value)}
              className="w-48"
            />
          </OptionalField>
        )}
        <OptionalField label="Habits completed">
          <Input
            placeholder="e.g. meditation, cold shower"
            value={form.habitsCompleted}
            onChange={e => setField("habitsCompleted", e.target.value)}
          />
        </OptionalField>
      </FieldGroup>

      <FieldGroup title="Tasks & Commitments" icon="🎯">
        <div className="grid grid-cols-3 gap-4">
          <OptionalField label="Tasks planned">
            <Input
              type="number"
              min="0"
              placeholder="e.g. 6"
              value={form.tasksPlanned}
              onChange={e => setField("tasksPlanned", e.target.value)}
              className="w-24"
            />
          </OptionalField>
          <OptionalField label="Completed">
            <Input
              type="number"
              min="0"
              placeholder="e.g. 4"
              value={form.tasksCompleted}
              onChange={e => setField("tasksCompleted", e.target.value)}
              className="w-24"
            />
          </OptionalField>
          <OptionalField label="Missed">
            <Input
              type="number"
              min="0"
              placeholder="e.g. 2"
              value={form.tasksMissed}
              onChange={e => setField("tasksMissed", e.target.value)}
              className="w-24"
            />
          </OptionalField>
        </div>
        <OptionalField label="Calendar commitments">
          <Input
            placeholder="e.g. 2 meetings, dentist 3pm"
            value={form.calendarCommitments}
            onChange={e => setField("calendarCommitments", e.target.value)}
          />
        </OptionalField>
      </FieldGroup>

      <FieldGroup title="Health Notes" icon="🩺">
        <Textarea
          placeholder="Any sickness, physical issues, pain, symptoms... (optional)"
          value={form.healthNotes}
          onChange={e => setField("healthNotes", e.target.value)}
          className="min-h-[80px] text-sm"
        />
      </FieldGroup>

      <Card className="border-muted-foreground/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">✍️ Reflection</CardTitle>
          <CardDescription>What felt good, what felt off, anything unusual about today</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Write freely — this is the subjective context the AI uses alongside the data above..."
            value={form.reflection}
            onChange={e => setField("reflection", e.target.value)}
            className="min-h-[120px]"
          />
        </CardContent>
      </Card>

      <Button
        onClick={handleSubmit}
        disabled={createReview.isPending}
        className="w-full md:w-auto"
        size="lg"
      >
        {createReview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {createReview.isPending ? "Analyzing..." : "Save & Analyze"}
      </Button>
    </div>
  );
}
