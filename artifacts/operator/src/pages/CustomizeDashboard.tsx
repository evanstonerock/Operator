import { useMemo, useState } from "react";
import {
  useListMetrics,
  useCreateMetric,
  useUpdateMetric,
  useDeleteMetric,
  getListMetricsQueryKey,
} from "@workspace/api-client-react";
import type { Metric, CreateMetricBody, UpdateMetricBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  Target,
  ChevronUp,
  ChevronDown,
  Info,
} from "lucide-react";

const METRIC_TYPES = ["number", "checkbox", "text", "duration", "scale"] as const;

const PRESET_CATEGORIES = [
  "Recovery",
  "Health",
  "Fitness",
  "Nutrition",
  "Work",
  "Study",
  "Finance",
  "Social",
  "Skill",
  "Art",
  "Morning",
  "Day",
  "Evening",
] as const;

const TYPE_COLORS: Record<string, string> = {
  number: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  checkbox: "bg-green-500/10 text-green-400 border-green-500/20",
  text: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  duration: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  scale: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

const CATEGORY_COLORS: Record<string, string> = {
  Recovery: "bg-cyan-500/10 text-cyan-400",
  Health: "bg-red-500/10 text-red-400",
  Fitness: "bg-orange-500/10 text-orange-400",
  Nutrition: "bg-lime-500/10 text-lime-400",
  Work: "bg-blue-500/10 text-blue-400",
  Study: "bg-indigo-500/10 text-indigo-400",
  Finance: "bg-emerald-500/10 text-emerald-400",
  Social: "bg-pink-500/10 text-pink-400",
  Skill: "bg-violet-500/10 text-violet-400",
  Art: "bg-fuchsia-500/10 text-fuchsia-400",
  Morning: "bg-amber-500/10 text-amber-400",
  Day: "bg-yellow-500/10 text-yellow-400",
  Evening: "bg-purple-500/10 text-purple-400",
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  number: "Numeric value (e.g. 8 hours, 2000 calories)",
  checkbox: "Yes/No completed",
  text: "Free text entry",
  duration: "Time duration (HH:MM format)",
  scale: "Scale rating (scale rating 1-5)",
};

type MetricForm = {
  name: string;
  type: string;
  category: string;
  customCategory: string;
  unit: string;
  targetValue: string;
  aiContext: string;
};

const EMPTY_FORM: MetricForm = {
  name: "",
  type: "number",
  category: "Work",
  customCategory: "",
  unit: "",
  targetValue: "",
  aiContext: "",
};

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

export default function CustomizeDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: metrics, isLoading } = useListMetrics();
  const createMetric = useCreateMetric();
  const updateMetric = useUpdateMetric();
  const deleteMetric = useDeleteMetric();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [form, setForm] = useState<MetricForm>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListMetricsQueryKey() });

  const orderedCategories = useMemo(() => {
    const metricCategories = Array.from(
      new Set((metrics ?? []).map((m) => normalizeCategoryLabel(m.category))),
    );

    const preset = [...PRESET_CATEGORIES].filter((c) => metricCategories.includes(c));
    const custom = metricCategories
      .filter((c) => !PRESET_CATEGORIES.includes(c as never))
      .sort();

    return [...preset, ...custom];
  }, [metrics]);

  function openCreate() {
    setEditingMetric(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(m: Metric) {
    const normalized = normalizeCategoryLabel(m.category);
    const isPreset = PRESET_CATEGORIES.includes(normalized as never);

    setEditingMetric(m);
    setForm({
      name: m.name,
      type: m.type,
      category: isPreset ? normalized : "Custom",
      customCategory: isPreset ? "" : normalized,
      unit: m.unit ?? "",
      targetValue: m.targetValue ?? "",
      aiContext: m.aiContext ?? "",
    });
    setDialogOpen(true);
  }

  function getFinalCategory() {
    const raw = form.category === "Custom" ? form.customCategory : form.category;
    return normalizeCategoryLabel(raw);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Name is required" });
      return;
    }

    const finalCategory = getFinalCategory();

    if (!finalCategory) {
      toast({ variant: "destructive", title: "Custom label is required" });
      return;
    }

    const payload = {
      name: form.name.trim(),
      type: form.type as CreateMetricBody["type"],
      category: finalCategory,
      unit: form.unit.trim() || null,
      targetValue: form.targetValue.trim() || null,
      aiContext: form.aiContext.trim() || null,
    };

    if (editingMetric) {
      updateMetric.mutate(
        { id: editingMetric.id, data: payload as UpdateMetricBody },
        {
          onSuccess: () => {
            toast({ title: "Trackable updated" });
            setDialogOpen(false);
            invalidate();
          },
          onError: () =>
            toast({ variant: "destructive", title: "Failed to update trackable" }),
        },
      );
    } else {
      const maxOrder = metrics?.length ?? 0;
      createMetric.mutate(
        { data: { ...payload, displayOrder: maxOrder } },
        {
          onSuccess: () => {
            toast({ title: "Trackable added" });
            setDialogOpen(false);
            invalidate();
          },
          onError: () =>
            toast({ variant: "destructive", title: "Failed to add trackable" }),
        },
      );
    }
  }

  function handleDelete() {
    if (deleteId == null) return;
    deleteMetric.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast({ title: "Trackable deleted" });
          setDeleteId(null);
          invalidate();
        },
        onError: () =>
          toast({ variant: "destructive", title: "Failed to delete trackable" }),
      },
    );
  }

  async function moveItem(category: string, currentIndex: number, direction: "up" | "down") {
    const categoryItems = (metrics ?? [])
      .filter((m) => normalizeCategoryLabel(m.category) === category)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= categoryItems.length) return;

    const itemA = categoryItems[currentIndex];
    const itemB = categoryItems[targetIndex];

    setIsMoving(true);
    try {
      await Promise.all([
        updateMetric.mutateAsync({ id: itemA.id, data: { displayOrder: itemB.displayOrder } }),
        updateMetric.mutateAsync({ id: itemB.id, data: { displayOrder: itemA.displayOrder } }),
      ]);
      invalidate();
    } catch {
      toast({ variant: "destructive", title: "Failed to reorder" });
    } finally {
      setIsMoving(false);
    }
  }

  const grouped = orderedCategories.reduce<Record<string, Metric[]>>((acc, cat) => {
    acc[cat] = (metrics ?? [])
      .filter((m) => normalizeCategoryLabel(m.category) === cat)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
    return acc;
  }, {});

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="h-7 w-7" />
            Customize Dashboard
          </h1>
          <p className="text-muted-foreground">
            Define exactly what you want to track each day.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Trackable
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (metrics ?? []).length === 0 ? (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium mb-1">Nothing tracked yet</p>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Add trackables to define what matters to you. Your daily dashboard will be built from these.
            </p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Add your first trackable
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {orderedCategories.map((cat) => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;

            return (
              <Card key={cat}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-medium ${getCategoryColor(cat)}`}
                    >
                      {cat}
                    </span>
                    <span className="text-muted-foreground font-normal text-sm">
                      {items.length} trackable{items.length !== 1 ? "s" : ""}
                    </span>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-2">
                  {items.map((m, index) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex flex-col gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-4 w-5 opacity-50 hover:opacity-100"
                            onClick={() => moveItem(cat, index, "up")}
                            disabled={index === 0 || isMoving}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-4 w-5 opacity-50 hover:opacity-100"
                            onClick={() => moveItem(cat, index, "down")}
                            disabled={index === items.length - 1 || isMoving}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{m.name}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 shrink-0 ${TYPE_COLORS[m.type]}`}
                            >
                              {m.type}
                            </Badge>
                            {m.unit && (
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {m.unit}
                              </span>
                            )}
                            {m.targetValue && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                                <Target className="h-3 w-3" />
                                {m.targetValue}
                              </span>
                            )}
                          </div>

                          {m.aiContext && (
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate max-w-xs flex items-center gap-1">
                              <Info className="h-3 w-3 shrink-0" />
                              {m.aiContext}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(m)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 hover:text-destructive"
                          onClick={() => setDeleteId(m.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMetric ? "Edit Trackable" : "Add Trackable"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="metric-name">Name</Label>
              <Input
                id="metric-name"
                placeholder="e.g. Sleep Hours, Morning Walk, Water Intake"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.type && (
                  <p className="text-[11px] text-muted-foreground">
                    {TYPE_DESCRIPTIONS[form.type]}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Category / Section</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.category === "Custom" && (
              <div className="space-y-1.5">
                <Label htmlFor="custom-category">Custom Label</Label>
                <Input
                  id="custom-category"
                  placeholder="e.g. Reading, Nicotine, Appointments"
                  value={form.customCategory}
                  onChange={(e) => setForm((f) => ({ ...f, customCategory: e.target.value }))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="unit">Unit (optional)</Label>
                <Input
                  id="unit"
                  placeholder="e.g. hours, mg, km"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="target-value">Target Value (optional)</Label>
                <Input
                  id="target-value"
                  placeholder="e.g. 8, 10000"
                  value={form.targetValue}
                  onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-context">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="ai-context"
                placeholder='e.g. "Daily movement and activity level" or "Avoid nicotine use for the day"'
                value={form.aiContext}
                onChange={(e) => setForm((f) => ({ ...f, aiContext: e.target.value }))}
                className="min-h-[64px] text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Helps AI understand what this habit means to you and give more relevant insights.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMetric.isPending || updateMetric.isPending}
            >
              {editingMetric ? "Save Changes" : "Add Trackable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trackable?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the trackable and all its logged history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}