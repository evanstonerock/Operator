import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useListDailyCheckins,
  useListMetrics,
} from "@workspace/api-client-react";
import type {
  DailyCheckin,
  Metric,
  MetricLogEntry,
} from "@workspace/api-client-react";
import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  startOfWeek,
} from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  Flame,
  LineChart as LineChartIcon,
  Target,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

type HabitCellState = "complete" | "missed" | "neutral";

type HabitSummary = {
  metric: Metric;
  description: string | null;
  startDate: Date;
  trackedDays: number;
  completedDays: number;
  completionRate: number;
  currentStreak: number;
  bestStreak: number;
  cells: Array<{ date: string; state: HabitCellState }>;
};

type InsightSeries = {
  key: string;
  label: string;
  color: string;
  type: "core" | "metric";
  valueAccessor?: (checkin: DailyCheckin) => number | null;
  metricId?: number;
  unit?: string | null;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

async function fetchMetricHistory(): Promise<MetricLogEntry[]> {
  const response = await fetch("/api/metric-logs/history?limit=10000");

  if (!response.ok) {
    throw new Error("Failed to fetch metric history");
  }

  return response.json();
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
      <p>{message}</p>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-6">{value}</p>
    </div>
  );
}

function toDate(dateString: string) {
  return new Date(`${dateString}T12:00:00`);
}

function dateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function buildHabitSummary(metric: Metric, logs: MetricLogEntry[], today: Date): HabitSummary {
  const startDate = toDate(metric.createdAt.slice(0, 10));
  const completedDates = new Set(
    logs.filter((log) => log.value === "true").map((log) => log.date),
  );
  const trackedDays = Math.max(differenceInCalendarDays(today, startDate) + 1, 1);

  let completedDays = 0;
  let bestStreak = 0;
  let currentRun = 0;

  for (let offset = 0; offset < trackedDays; offset += 1) {
    const currentDate = addDays(startDate, offset);
    const completed = completedDates.has(dateKey(currentDate));

    if (completed) {
      completedDays += 1;
      currentRun += 1;
      bestStreak = Math.max(bestStreak, currentRun);
    } else {
      currentRun = 0;
    }
  }

  let currentStreak = 0;
  for (let offset = trackedDays - 1; offset >= 0; offset -= 1) {
    const currentDate = addDays(startDate, offset);
    if (!completedDates.has(dateKey(currentDate))) break;
    currentStreak += 1;
  }

  const gridStart = startOfWeek(startDate, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(today, { weekStartsOn: 0 });
  const cells: Array<{ date: string; state: HabitCellState }> = [];

  for (
    let currentDate = gridStart;
    !isAfter(currentDate, gridEnd);
    currentDate = addDays(currentDate, 1)
  ) {
    const key = dateKey(currentDate);

    let state: HabitCellState = "neutral";
    if (!isBefore(currentDate, startDate) && !isAfter(currentDate, today)) {
      state = completedDates.has(key) ? "complete" : "missed";
    }

    cells.push({ date: key, state });
  }

  return {
    metric,
    description: metric.aiContext?.trim() || null,
    startDate,
    trackedDays,
    completedDays,
    completionRate: trackedDays > 0 ? completedDays / trackedDays : 0,
    currentStreak,
    bestStreak,
    cells,
  };
}

function HabitGrid({ summary }: { summary: HabitSummary }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{summary.metric.name}</h3>
            <Badge variant="outline">{Math.round(summary.completionRate * 100)}%</Badge>
          </div>
          {summary.description && (
            <p className="max-w-2xl text-sm text-muted-foreground">{summary.description}</p>
          )}
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Since tracking</p>
            <p className="font-medium">
              {summary.completedDays}/{summary.trackedDays}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Started
            </p>
            <p className="font-medium">{format(summary.startDate, "MMM d, yyyy")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <span>{summary.currentStreak} current</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-400" />
            <span>{summary.bestStreak} best</span>
          </div>
        </div>
      </div>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex min-w-max gap-3">
          <div className="grid grid-rows-7 gap-1 pt-0.5 text-[10px] text-muted-foreground">
            {DAY_LABELS.map((label) => (
              <div key={label} className="flex h-3.5 items-center">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-flow-col grid-rows-7 gap-1">
            {summary.cells.map((cell) => (
              <div
                key={cell.date}
                className={
                  cell.state === "complete"
                    ? "h-3.5 w-3.5 rounded-[4px] bg-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                    : cell.state === "missed"
                      ? "h-3.5 w-3.5 rounded-[4px] bg-slate-700/70 shadow-[0_0_0_1px_rgba(100,116,139,0.2)]"
                      : "h-3.5 w-3.5 rounded-[4px] bg-slate-800/30"
                }
                title={`${format(toDate(cell.date), "EEE, MMM d, yyyy")}: ${cell.state}`}
              />
            ))}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

function ArchiveCard({ checkin }: { checkin: DailyCheckin }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/40 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {format(toDate(checkin.date), "EEEE, MMMM d, yyyy")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {checkin.notes || "Daily check-in and AI archive."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Energy {checkin.energyLevel}/10</Badge>
            <Badge variant="outline">Focus {checkin.focusLevel}/10</Badge>
            <Badge variant="outline">Mood {checkin.mood}/10</Badge>
            <Badge variant="outline">Sleep {checkin.sleepQuality}/10</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="reflection" className="px-6">
            <AccordionTrigger className="hover:no-underline">
              Reflection Inputs
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-5">
              <Row label="What felt good" value={checkin.reflectionFeltGood} />
              <Row label="What felt off" value={checkin.reflectionFeltOff} />
              <Row label="What got in the way" value={checkin.reflectionGotInWay} />
              <Row
                label="Anything unusual"
                value={checkin.reflectionAnythingUnusual}
              />
              <Row label="Tasks completed" value={checkin.tasksCompleted} />
              <Row label="Tasks missed" value={checkin.tasksMissed} />
              <Row label="Habits completed" value={checkin.habitsCompleted} />
              <Row label="Symptoms / notes" value={checkin.symptomsNotes} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ai" className="border-b-0 px-6">
            <AccordionTrigger className="hover:no-underline">
              AI Outputs
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-5">
              <Row label="Combined advice" value={checkin.combinedAdvice} />
              <Row label="Claude reflection" value={checkin.claudeReflection} />
              <Row label="OpenAI plan" value={checkin.openaiPlan} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

export default function HistoryPage() {
  const today = useMemo(() => new Date(), []);
  const { data: metrics, isLoading: loadingMetrics } = useListMetrics();
  const { data: dailyCheckins, isLoading: loadingCheckins } = useListDailyCheckins({
    limit: 365,
  });
  const {
    data: metricHistory,
    isLoading: loadingHistory,
    isError: metricHistoryError,
  } = useQuery({
    queryKey: ["metric-log-history"],
    queryFn: fetchMetricHistory,
  });

  const checkboxMetrics = useMemo(
    () => (metrics ?? []).filter((metric) => metric.type === "checkbox"),
    [metrics],
  );

  const habitSummaries = useMemo(() => {
    const historyByMetric = new Map<number, MetricLogEntry[]>();

    for (const log of metricHistory ?? []) {
      const logs = historyByMetric.get(log.metricId) ?? [];
      logs.push(log);
      historyByMetric.set(log.metricId, logs);
    }

    return checkboxMetrics.map((metric) =>
      buildHabitSummary(metric, historyByMetric.get(metric.id) ?? [], today),
    );
  }, [checkboxMetrics, metricHistory, today]);

  const coreInsightSeries = useMemo<InsightSeries[]>(
    () => [
      {
        key: "energyLevel",
        label: "Energy",
        color: CHART_COLORS[0],
        type: "core",
        valueAccessor: (checkin) => checkin.energyLevel,
      },
      {
        key: "focusLevel",
        label: "Focus",
        color: CHART_COLORS[1],
        type: "core",
        valueAccessor: (checkin) => checkin.focusLevel,
      },
      {
        key: "mood",
        label: "Mood",
        color: CHART_COLORS[2],
        type: "core",
        valueAccessor: (checkin) => checkin.mood,
      },
      {
        key: "sleepQuality",
        label: "Sleep Score",
        color: CHART_COLORS[3],
        type: "core",
        valueAccessor: (checkin) => checkin.sleepQuality,
      },
      {
        key: "healthLevel",
        label: "Health",
        color: CHART_COLORS[4],
        type: "core",
        valueAccessor: (checkin) => checkin.healthLevel,
      },
    ],
    [],
  );

  const numericMetricSeries = useMemo<InsightSeries[]>(
    () =>
      (metrics ?? [])
        .filter((metric) => metric.type === "number" || metric.type === "scale")
        .map((metric, index) => ({
          key: `metric-${metric.id}`,
          label: metric.name,
          color: CHART_COLORS[(index + coreInsightSeries.length) % CHART_COLORS.length],
          type: "metric" as const,
          metricId: metric.id,
          unit: metric.unit,
        })),
    [coreInsightSeries.length, metrics],
  );

  const availableInsightSeries = useMemo(
    () => [...coreInsightSeries, ...numericMetricSeries],
    [coreInsightSeries, numericMetricSeries],
  );

  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (selectedSeries.length === 0 && availableInsightSeries.length > 0) {
      setSelectedSeries(availableInsightSeries.slice(0, 3).map((series) => series.key));
    }
  }, [availableInsightSeries, selectedSeries.length]);

  const allInsightDates = useMemo(() => {
    const dates = new Set<string>();

    for (const checkin of dailyCheckins ?? []) dates.add(checkin.date);
    for (const log of metricHistory ?? []) {
      if (log.metricType === "number" || log.metricType === "scale") {
        dates.add(log.date);
      }
    }

    return Array.from(dates).sort();
  }, [dailyCheckins, metricHistory]);

  useEffect(() => {
    if (!startDate && allInsightDates.length > 0) {
      setStartDate(allInsightDates[0]);
    }
    if (!endDate && allInsightDates.length > 0) {
      setEndDate(allInsightDates[allInsightDates.length - 1]);
    }
  }, [allInsightDates, endDate, startDate]);

  const filteredSeries = useMemo(
    () => availableInsightSeries.filter((series) => selectedSeries.includes(series.key)),
    [availableInsightSeries, selectedSeries],
  );

  const chartData = useMemo(() => {
    if (!startDate || !endDate) return [];

    const rows = new Map<string, Record<string, number | string | null>>();

    const ensureRow = (date: string) => {
      const existing = rows.get(date);
      if (existing) return existing;

      const row: Record<string, number | string | null> = {
        date,
        shortDate: format(toDate(date), "MMM d"),
      };
      rows.set(date, row);
      return row;
    };

    for (const series of filteredSeries) {
      if (series.type === "core" && series.valueAccessor) {
        for (const checkin of dailyCheckins ?? []) {
          if (checkin.date < startDate || checkin.date > endDate) continue;
          ensureRow(checkin.date)[series.key] = series.valueAccessor(checkin);
        }
      }

      if (series.type === "metric" && series.metricId != null) {
        for (const log of metricHistory ?? []) {
          if (log.metricId !== series.metricId) continue;
          if (log.date < startDate || log.date > endDate) continue;

          const value = Number(log.value);
          if (Number.isNaN(value)) continue;

          ensureRow(log.date)[series.key] = value;
        }
      }
    }

    return Array.from(rows.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [dailyCheckins, endDate, filteredSeries, metricHistory, startDate]);

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        filteredSeries.map((series) => [
          series.key,
          {
            label: series.unit ? `${series.label} (${series.unit})` : series.label,
            color: series.color,
          },
        ]),
      ),
    [filteredSeries],
  );

  const isLoading = loadingMetrics || loadingCheckins || loadingHistory;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground">
          Review habits, browse archived check-ins, and compare numeric patterns over
          time.
        </p>
      </div>

      <Tabs defaultValue="habits" className="space-y-6">
        <TabsList>
          <TabsTrigger value="habits">Habit History</TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="habits" className="space-y-4">
          <Card className="border-none bg-muted/30 shadow-none">
            <CardContent className="flex flex-wrap items-center gap-4 p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-[4px] bg-emerald-400" />
                <span>Completed day</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-[4px] bg-slate-700/70" />
                <span>Missed day</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-[4px] bg-slate-800/30" />
                <span>Before tracking</span>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <LoadingState />
          ) : metricHistoryError ? (
            <EmptyState message="Metric history could not be loaded right now." />
          ) : habitSummaries.length === 0 ? (
            <EmptyState message="No habit-style trackables yet. Checkbox habits will appear here automatically." />
          ) : (
            <div className="space-y-4">
              {habitSummaries.map((summary) => (
                <HabitGrid key={summary.metric.id} summary={summary} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archive" className="space-y-4">
          {loadingCheckins ? (
            <LoadingState />
          ) : !dailyCheckins || dailyCheckins.length === 0 ? (
            <EmptyState message="No archived daily check-ins yet. Submit a daily check-in to start building your archive." />
          ) : (
            <div className="space-y-4">
              {dailyCheckins.map((checkin) => (
                <ArchiveCard key={checkin.id} checkin={checkin} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LineChartIcon className="h-5 w-5 text-blue-400" />
                  Graph Builder
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="insights-start">Start date</Label>
                  <Input
                    id="insights-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="insights-end">End date</Label>
                  <Input
                    id="insights-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Metrics to compare</p>
                  <div className="space-y-3">
                    {availableInsightSeries.map((series) => {
                      const checked = selectedSeries.includes(series.key);

                      return (
                        <label
                          key={series.key}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) => {
                              setSelectedSeries((current) =>
                                next
                                  ? Array.from(new Set([...current, series.key]))
                                  : current.filter((key) => key !== series.key),
                              );
                            }}
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: series.color }}
                              />
                              <span className="font-medium">{series.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {series.type === "core"
                                ? "Built-in daily check-in score"
                                : `Numeric trackable${series.unit ? ` (${series.unit})` : ""}`}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-5 w-5 text-emerald-400" />
                  Compare Over Time
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <Skeleton className="h-[340px] w-full rounded-xl" />
                ) : filteredSeries.length === 0 ? (
                  <EmptyState message="Select one or more metrics to build a chart." />
                ) : chartData.length === 0 ? (
                  <EmptyState message="No numeric history is available for that selection and date range yet." />
                ) : (
                  <>
                    <ChartContainer
                      className="h-[340px] w-full"
                      config={chartConfig}
                    >
                      <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="shortDate"
                          tickLine={false}
                          axisLine={false}
                          minTickGap={28}
                        />
                        <YAxis tickLine={false} axisLine={false} width={32} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        {filteredSeries.map((series) => (
                          <Line
                            key={series.key}
                            type="monotone"
                            dataKey={series.key}
                            stroke={series.color}
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                          />
                        ))}
                      </LineChart>
                    </ChartContainer>

                    <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                      Use this to compare patterns over time. It can help you spot
                      relationships between metrics, but it does not imply causation.
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
