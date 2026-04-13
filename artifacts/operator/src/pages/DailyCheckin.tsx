import { useState, useEffect, useMemo } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Brain, Sparkles, AlertCircle, Loader2, SlidersHorizontal, Target } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  Personal: "bg-slate-500/10 text-slate-300",
  Physical: "bg-red-500/10 text-red-400",
  Emotional: "bg-rose-500/10 text-rose-400",
  Relational: "bg-pink-500/10 text-pink-400",
  Intellectual: "bg-indigo-500/10 text-indigo-400",
  Spiritual: "bg-violet-500/10 text-violet-400",
  Moral: "bg-amber-500/10 text-amber-400",
  Professional: "bg-blue-500/10 text-blue-400",
  Cultural: "bg-fuchsia-500/10 text-fuchsia-400",
  Recreational: "bg-lime-500/10 text-lime-400",
  Financial: "bg-emerald-500/10 text-emerald-400",
  Sexual: "bg-orange-500/10 text-orange-400",
};

const PRESET_CATEGORY_ORDER = [
  "Personal",
  "Physical",
  "Emotional",
  "Relational",
  "Intellectual",
  "Spiritual",
  "Moral",
  "Professional",
  "Cultural",
  "Recreational",
  "Financial",
  "Sexual",
];

function normalizeCategoryLabel(label: string) {
  return label
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? "bg-gray-500/10 text-gray-300";
}

function getScaleRange(metric: Metric) {
  const raw = (metric.targetValue ?? "").trim();

  if (!raw) return { min: 1, max: 5 };

  const rangeMatch = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (!Number.isNaN(min) && !Number.isNaN(max) && min < max) {
      return { min, max };
    }
  }

  const maxOnly = Number(raw);
  if (!Number.isNaN(maxOnly) && maxOnly > 1) {
    return { min: 1, max: maxOnly };
  }

  return { min: 1, max: 5 };
}

export default function DailyCheckinPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: metrics, isLoading: isLoadingMetrics } = useListMetrics();
  const { data: existingLogs, isLoading: isLoadingLogs } = useListMetricLogs({ date: today });
  const saveMetricLogs = useSaveMetricLogs();
  const createCheckin = useCreateDailyCheckin();

  const [values, setValues] = useState<Record<number, string>>({});
  const [reflection, setReflection] = useState({
    feltGood: "",
    feltOff: "",
    gotInWay: "",
    anythingUnusual: "",
  });
  const [result, setResult] = useState<DailyCheckin | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (existingLogs && existingLogs.length > 0) {
      const prefilled: Record<number, string> = {};
      existingLogs.forEach((log) => {
        prefilled[log.metricId] = log.value;
      });
      setValues(prefilled);
    }
  }, [existingLogs]);

  const orderedCategories = useMemo(() => {
    const categories = Array.from(
      new Set((metrics ?? []).map((m) => normalizeCategoryLabel(m.category))),
    );

    const preset = PRESET_CATEGORY_ORDER.filter((c) => categories.includes(c));
    const custom = categories.filter((c) => !PRESET_CATEGORY_ORDER.includes(c)).sort();

    return [...preset, ...custom];
  }, [metrics]);

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
          <h1 className="text-3xl font-bold tracking-tight">Daily Dashboard</h1>
          <p className="text-muted-foreground">Log your day and get structured feedback.</p>
        </div>
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium mb-1">Nothing to track yet</p>
            <p className="text-muted-foreground mb-6">Set up your trackables to get started.</p>
            <Link href="/customize">
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Customize Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const grouped = orderedCategories.reduce<Record<string, Metric[]>>((acc, cat) => {
    const items = metrics
      .filter((m) => normalizeCategoryLabel(m.category) === cat)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);

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
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={val}
              onChange={(e) => setValue(m.id, e.target.value)}
              placeholder={m.targetValue ? `Target: ${m.targetValue}` : "0"}
              className="w-28"
            />
            {m.unit && <span className="text-sm text-muted-foreground shrink-0">{m.unit}</span>}
          </div>
        );

      case "checkbox":
        return (
          <Checkbox
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
            className="min-h-[60px] w-full"
          />
        );

      case "duration": {
        const [hh, mm] = val ? val.split(":") : ["", ""];

        return (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={23}
              value={hh ?? ""}
              onChange={(e) => {
                const h = e.target.value.padStart(2, "0");
                const m2 = mm?.padStart(2, "0") ?? "00";
                setValue(m.id, `${h}:${m2}`);
              }}
              placeholder="HH"
              className="w-16 text-center"
            />
            <span className="text-muted-foreground">:</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={mm ?? ""}
              onChange={(e) => {
                const h = hh?.padStart(2, "0") ?? "00";
                const m2 = e.target.value.padStart(2, "0");
                setValue(m.id, `${h}:${m2}`);
              }}
              placeholder="MM"
              className="w-16 text-center"
            />
          </div>
        );
      }

      case "scale": {
        const { min, max } = getScaleRange(m);
        const fallback = Math.round((min + max) / 2);
        const numVal = val ? Number(val) : fallback;

        return (
          <div className="flex items-center gap-3 w-56">
            <span className="text-xs text-muted-foreground w-5 text-right">{min}</span>
            <Slider
              value={[numVal]}
              onValueChange={([v]) => setValue(m.id, String(v))}
              min={min}
              max={max}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-5">{max}</span>
            <span className="text-sm font-medium w-8 text-center tabular-nums">
              {val || String(fallback)}
            </span>
          </div>
        );
      }

      default:
        return null;
    }
  }

  async function handleSubmit() {
    setIsSaving(true);

    try {
      const entries = Object.entries(values)
        .filter(([, v]) => v !== "" && v !== undefined)
        .map(([id, value]) => ({ metricId: Number(id), value }));

      if (entries.length > 0) {
        await saveMetricLogs.mutateAsync({
          data: { date: today, entries },
        });

        queryClient.invalidateQueries({
          queryKey: getListMetricLogsQueryKey({ date: today }),
        });
      }

      const metricSummary = entries
        .map(({ metricId, value }) => {
          const metric = metrics?.find((m) => m.id === metricId);
          return metric ? `${metric.name}: ${value}${metric.unit ? ` ${metric.unit}` : ""}` : null;
        })
        .filter(Boolean)
        .join(", ");

      const finalNotes = metricSummary || "Daily check-in via dashboard";

      const getNumVal = (name: string) => {
        const m = metrics?.find((x) => x.name.toLowerCase().includes(name));
        if (!m) return 5;
        const v = Number(values[m.id]);
        return isNaN(v) ? 5 : Math.max(1, Math.min(10, v));
      };

      createCheckin.mutate(
        {
          data: {
            date: today,
            notes: finalNotes,
            energyLevel: getNumVal("energy"),
            focusLevel: getNumVal("focus"),
            healthLevel: getNumVal("health"),
            sleepQuality: getNumVal("sleep"),
            mood: getNumVal("mood"),
            tasksCompleted:
              entries
                .filter(({ metricId }) => {
                  const metric = metrics?.find((x) => x.id === metricId);
                  return normalizeCategoryLabel(metric?.category ?? "") === "Professional";
                })
                .map(({ metricId, value }) => {
                  const m = metrics?.find((x) => x.id === metricId);
                  return `${m?.name}: ${value}`;
                })
                .join(", ") || "Logged via dashboard",
            tasksMissed: "",
            habitsCompleted: null,
            symptomsNotes: null,
            reflectionFeltGood: reflection.feltGood.trim() || null,
            reflectionFeltOff: reflection.feltOff.trim() || null,
            reflectionGotInWay: reflection.gotInWay.trim() || null,
            reflectionAnythingUnusual: reflection.anythingUnusual.trim() || null,
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
        },
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
          <h1 className="text-3xl font-bold tracking-tight">Daily Dashboard</h1>
          <p className="text-muted-foreground">Today's insights are ready.</p>
        </div>

        <div className="flex gap-4 mb-8">
          <Button onClick={() => setResult(null)} variant="outline">
            Back to Form
          </Button>
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Daily Dashboard</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")} — Log your metrics and get AI insights.
          </p>
        </div>
        <Link href="/customize">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            Customize
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([category, categoryMetrics]) => (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-medium ${getCategoryColor(category)}`}
                >
                  {category}
                </span>
                <span className="text-muted-foreground font-normal text-sm ml-1">
                  ({categoryMetrics.length})
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {categoryMetrics.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-4 ${m.type === "text" ? "flex-col" : "items-center justify-between"}`}
                >
                  <div className={`flex items-center gap-2 ${m.type === "text" ? "" : "min-w-0"}`}>
                    <Label className="font-medium text-sm">{m.name}</Label>
                    {m.targetValue && m.type !== "scale" && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 text-muted-foreground"
                      >
                        target: {m.targetValue}
                        {m.unit ? ` ${m.unit}` : ""}
                      </Badge>
                    )}
                    {m.type === "scale" && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 text-muted-foreground"
                      >
                        scale: {getScaleRange(m).min}-{getScaleRange(m).max}
                      </Badge>
                    )}
                  </div>

                  <div className={m.type === "text" ? "w-full" : "shrink-0"}>
                    {renderInput(m)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">End-of-Day Reflection</CardTitle>
            <CardDescription>Optional — helps AI give more personal insights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">What felt good today?</Label>
              <Textarea
                value={reflection.feltGood}
                onChange={(e) => setReflection((r) => ({ ...r, feltGood: e.target.value }))}
                placeholder="What worked, what felt natural, what you're proud of..."
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">What felt off?</Label>
              <Textarea
                value={reflection.feltOff}
                onChange={(e) => setReflection((r) => ({ ...r, feltOff: e.target.value }))}
                placeholder="Energy dips, friction, things that felt harder than they should..."
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">What got in the way?</Label>
              <Textarea
                value={reflection.gotInWay}
                onChange={(e) => setReflection((r) => ({ ...r, gotInWay: e.target.value }))}
                placeholder="Interruptions, unexpected events, obstacles..."
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Anything unusual?</Label>
              <Textarea
                value={reflection.anythingUnusual}
                onChange={(e) =>
                  setReflection((r) => ({ ...r, anythingUnusual: e.target.value }))
                }
                placeholder="Anything out of the ordinary that affected today..."
                className="min-h-[60px]"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isSaving || createCheckin.isPending}
        className="w-full md:w-auto"
        size="lg"
      >
        {(isSaving || createCheckin.isPending) && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        Save & Analyze
      </Button>
    </div>
  );
}
