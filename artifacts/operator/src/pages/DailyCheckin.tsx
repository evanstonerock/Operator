import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import {
  useListMetrics,
  useListMetricLogs,
  useSaveMetricLogs,
  useCreateDailyCheckin,
  getListDailyCheckinsQueryKey,
  getListMetricLogsQueryKey,
} from "@workspace/api-client-react";
import type { Metric, DailyCheckin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain, Sparkles, AlertCircle, Loader2, Settings2, Target } from "lucide-react";

const CATEGORY_ICONS: Record<string, string> = {
  Recovery: "💤",
  Nutrition: "🥗",
  Activity: "🏃",
  Productivity: "🎯",
  Custom: "⚡",
};

const CATEGORY_ORDER = ["Recovery", "Nutrition", "Activity", "Productivity", "Custom"];

export default function DailyCheckinPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: metrics, isLoading: isLoadingMetrics } = useListMetrics();
  const { data: existingLogs, isLoading: isLoadingLogs } = useListMetricLogs({ date: today });
  const saveMetricLogs = useSaveMetricLogs();
  const createCheckin = useCreateDailyCheckin();

  const [values, setValues] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<DailyCheckin | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Pre-populate with existing log values
  useEffect(() => {
    if (existingLogs && existingLogs.length > 0) {
      const prefilled: Record<number, string> = {};
      existingLogs.forEach((log) => {
        prefilled[log.metricId] = log.value;
      });
      setValues(prefilled);
    }
  }, [existingLogs]);

  if (isLoadingMetrics || isLoadingLogs) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Daily Check-In</h1>
          <p className="text-muted-foreground">Log your day and get structured feedback.</p>
        </div>
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">No metrics configured yet.</p>
            <Link href="/settings">
              <Button variant="outline" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Go to Settings to add metrics
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, Metric[]>>((acc, cat) => {
    const items = metrics.filter((m) => m.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  function setValue(metricId: number, val: string) {
    setValues((prev) => ({ ...prev, [metricId]: val }));
  }

  function renderInput(m: Metric) {
    const val = values[m.id] ?? "";
    switch (m.type) {
      case "number":
        return (
          <Input
            type="number"
            value={val}
            onChange={(e) => setValue(m.id, e.target.value)}
            placeholder={m.targetValue ? `Target: ${m.targetValue}` : ""}
            className="w-32"
          />
        );
      case "checkbox":
        return (
          <Checkbox
            checked={val === "true"}
            onCheckedChange={(checked) => setValue(m.id, String(checked))}
          />
        );
      case "toggle":
        return (
          <Switch
            checked={val === "true"}
            onCheckedChange={(checked) => setValue(m.id, String(checked))}
          />
        );
      case "text":
        return (
          <Textarea
            value={val}
            onChange={(e) => setValue(m.id, e.target.value)}
            placeholder="Enter value..."
            className="min-h-[60px]"
          />
        );
      case "dropdown":
        return (
          <Select value={val} onValueChange={(v) => setValue(m.id, v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {(m.targetValue ?? "").split(",").map((opt) => opt.trim()).filter(Boolean).map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return null;
    }
  }

  async function handleSubmit() {
    setIsSaving(true);
    try {
      // Save metric logs
      const entries = Object.entries(values)
        .filter(([, v]) => v !== "" && v !== undefined)
        .map(([id, value]) => ({ metricId: Number(id), value }));

      if (entries.length > 0) {
        await saveMetricLogs.mutateAsync({
          data: { date: today, entries },
        });
        queryClient.invalidateQueries({ queryKey: getListMetricLogsQueryKey({ date: today }) });
      }

      // Build summary from metric values for daily checkin notes
      const metricSummary = entries
        .map(({ metricId, value }) => {
          const metric = metrics?.find((m) => m.id === metricId);
          return metric ? `${metric.name}: ${value}` : null;
        })
        .filter(Boolean)
        .join(", ");

      const finalNotes = notes.trim() || metricSummary || "Daily check-in via metrics";

      // Create daily checkin with AI analysis
      const energyMetric = metrics?.find((m) => m.name.toLowerCase().includes("energy"));
      const focusMetric = metrics?.find((m) => m.name.toLowerCase().includes("focus"));
      const moodMetric = metrics?.find((m) => m.name.toLowerCase().includes("mood"));
      const sleepQualityMetric = metrics?.find((m) => m.name.toLowerCase().includes("sleep quality"));
      const healthMetric = metrics?.find((m) => m.name.toLowerCase().includes("health"));

      const getNumVal = (metric: Metric | undefined) => {
        if (!metric) return 5;
        const v = Number(values[metric.id]);
        return isNaN(v) ? 5 : Math.max(1, Math.min(10, v));
      };

      createCheckin.mutate(
        {
          data: {
            date: today,
            notes: finalNotes,
            energyLevel: getNumVal(energyMetric),
            focusLevel: getNumVal(focusMetric),
            healthLevel: getNumVal(healthMetric),
            sleepQuality: getNumVal(sleepQualityMetric),
            mood: getNumVal(moodMetric),
            tasksCompleted: entries.filter(({ metricId }) => {
              const m = metrics?.find((x) => x.id === metricId);
              return m?.category === "Productivity";
            }).map(({ metricId, value }) => {
              const m = metrics?.find((x) => x.id === metricId);
              return `${m?.name}: ${value}`;
            }).join(", ") || "Logged via metrics",
            tasksMissed: "",
            habitsCompleted: null,
            symptomsNotes: null,
          },
        },
        {
          onSuccess: (data) => {
            setResult(data);
            toast({ title: "Check-in logged successfully" });
            queryClient.invalidateQueries({ queryKey: getListDailyCheckinsQueryKey() });
          },
          onError: () => {
            toast({ variant: "destructive", title: "Failed to generate AI insights" });
          },
        }
      );
    } catch {
      toast({ variant: "destructive", title: "Failed to save logs" });
    } finally {
      setIsSaving(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Daily Check-In</h1>
          <p className="text-muted-foreground">Today's insights are ready.</p>
        </div>
        <div className="flex gap-4 mb-8">
          <Button onClick={() => setResult(null)} variant="outline">Back to Form</Button>
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              Combined Advice
            </CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap leading-relaxed text-sm">
            {result.combinedAdvice || "No advice generated."}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-muted-foreground" />
                Reflection
              </CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
              {result.claudeReflection || "No reflection available."}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                Tomorrow's Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
              {result.openaiPlan || "No plan available."}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Daily Check-In</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")} — Log your metrics and get AI insights.
          </p>
        </div>
        <Link href="/settings">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Settings2 className="h-4 w-4" />
            Edit Metrics
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([category, categoryMetrics]) => (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span>{CATEGORY_ICONS[category]}</span>
                {category}
                <span className="text-muted-foreground font-normal text-sm ml-1">
                  ({categoryMetrics.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryMetrics.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <Label className="font-medium text-sm">{m.name}</Label>
                    {m.targetValue && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                        target: {m.targetValue}
                      </Badge>
                    )}
                  </div>
                  <div className="shrink-0">
                    {renderInput(m)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">📝 Notes (optional)</CardTitle>
            <CardDescription>Any additional context for today</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did today go? Any context you want the AI to consider..."
              className="min-h-[80px]"
            />
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isSaving || createCheckin.isPending}
        className="w-full md:w-auto"
        size="lg"
      >
        {(isSaving || createCheckin.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save & Analyze
      </Button>
    </div>
  );
}
