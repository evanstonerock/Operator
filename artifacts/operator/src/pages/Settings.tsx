import { useState } from "react";
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
import { Settings2, Plus, Pencil, Trash2, Target } from "lucide-react";

const METRIC_TYPES = ["number", "checkbox", "toggle", "dropdown", "text"] as const;
const CATEGORIES = ["Recovery", "Nutrition", "Activity", "Productivity", "Custom"] as const;
const IMPORTANCE_LABELS: Record<number, string> = { 1: "Low", 2: "Medium", 3: "High" };
const TYPE_COLORS: Record<string, string> = {
  number: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  checkbox: "bg-green-500/10 text-green-400 border-green-500/20",
  toggle: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  dropdown: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  text: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};
const CATEGORY_COLORS: Record<string, string> = {
  Recovery: "bg-cyan-500/10 text-cyan-400",
  Nutrition: "bg-lime-500/10 text-lime-400",
  Activity: "bg-yellow-500/10 text-yellow-400",
  Productivity: "bg-violet-500/10 text-violet-400",
  Custom: "bg-pink-500/10 text-pink-400",
};

type MetricForm = {
  name: string;
  type: string;
  category: string;
  targetValue: string;
  importanceLevel: string;
};

const EMPTY_FORM: MetricForm = {
  name: "",
  type: "number",
  category: "Productivity",
  targetValue: "",
  importanceLevel: "",
};

export default function Settings() {
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListMetricsQueryKey() });

  function openCreate() {
    setEditingMetric(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(m: Metric) {
    setEditingMetric(m);
    setForm({
      name: m.name,
      type: m.type,
      category: m.category,
      targetValue: m.targetValue ?? "",
      importanceLevel: m.importanceLevel != null ? String(m.importanceLevel) : "",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Name is required" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      type: form.type as CreateMetricBody["type"],
      category: form.category as CreateMetricBody["category"],
      targetValue: form.targetValue || null,
      importanceLevel: form.importanceLevel ? Number(form.importanceLevel) : null,
    };

    if (editingMetric) {
      updateMetric.mutate(
        { id: editingMetric.id, data: payload as UpdateMetricBody },
        {
          onSuccess: () => {
            toast({ title: "Metric updated" });
            setDialogOpen(false);
            invalidate();
          },
          onError: () => toast({ variant: "destructive", title: "Failed to update metric" }),
        }
      );
    } else {
      createMetric.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Metric created" });
            setDialogOpen(false);
            invalidate();
          },
          onError: () => toast({ variant: "destructive", title: "Failed to create metric" }),
        }
      );
    }
  }

  function handleDelete() {
    if (deleteId == null) return;
    deleteMetric.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast({ title: "Metric deleted" });
          setDeleteId(null);
          invalidate();
        },
        onError: () => toast({ variant: "destructive", title: "Failed to delete metric" }),
      }
    );
  }

  const grouped = CATEGORIES.reduce<Record<string, Metric[]>>((acc, cat) => {
    acc[cat] = (metrics ?? []).filter((m) => m.category === cat);
    return acc;
  }, {} as Record<string, Metric[]>);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="h-7 w-7" />
            Settings
          </h1>
          <p className="text-muted-foreground">Manage your metrics and habits.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Metric
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : metrics?.length === 0 ? (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">No metrics configured yet.</p>
            <Button onClick={openCreate} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add your first metric
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;
            return (
              <Card key={cat}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${CATEGORY_COLORS[cat]}`}>{cat}</span>
                    <span className="text-muted-foreground font-normal text-sm">
                      {items.length} metric{items.length !== 1 ? "s" : ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-medium text-sm truncate">{m.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 shrink-0 ${TYPE_COLORS[m.type]}`}
                        >
                          {m.type}
                        </Badge>
                        {m.importanceLevel && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {IMPORTANCE_LABELS[m.importanceLevel]}
                          </span>
                        )}
                        {m.targetValue && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                            <Target className="h-3 w-3" />
                            {m.targetValue}
                          </span>
                        )}
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMetric ? "Edit Metric" : "Add Metric"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="metric-name">Name</Label>
              <Input
                id="metric-name"
                placeholder="e.g. Sleep Hours"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
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
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="target-value">Target Value (optional)</Label>
                <Input
                  id="target-value"
                  placeholder="e.g. 8"
                  value={form.targetValue}
                  onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Importance (optional)</Label>
                <Select
                  value={form.importanceLevel || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, importanceLevel: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="1">Low</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="3">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              {editingMetric ? "Save Changes" : "Add Metric"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete metric?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the metric and all its logged history. This action cannot be undone.
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
