import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useCreateDailyCheckin, getListDailyCheckinsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Brain, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import type { DailyCheckin } from "@workspace/api-client-react";

const formSchema = z.object({
  date: z.string(),
  notes: z.string().min(1, "Notes are required"),
  energyLevel: z.number().min(1).max(10),
  focusLevel: z.number().min(1).max(10),
  healthLevel: z.number().min(1).max(10),
  sleepQuality: z.number().min(1).max(10),
  mood: z.number().min(1).max(10),
  tasksCompleted: z.string().min(1, "Required"),
  tasksMissed: z.string().min(1, "Required"),
  habitsCompleted: z.string().optional(),
  symptomsNotes: z.string().optional(),
});

export default function DailyCheckinPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCheckin = useCreateDailyCheckin();
  const [result, setResult] = useState<DailyCheckin | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      notes: "",
      energyLevel: 5,
      focusLevel: 5,
      healthLevel: 5,
      sleepQuality: 5,
      mood: 5,
      tasksCompleted: "",
      tasksMissed: "",
      habitsCompleted: "",
      symptomsNotes: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createCheckin.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          setResult(data);
          toast({ title: "Check-in logged successfully" });
          queryClient.invalidateQueries({ queryKey: getListDailyCheckinsQueryKey() });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Failed to log check-in" });
        },
      }
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Daily Check-In</h1>
        <p className="text-muted-foreground">Log your day, get structured feedback and plan tomorrow.</p>
      </div>

      {result ? (
        <div className="space-y-6">
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
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="w-fit" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Notes about the day</FormLabel>
                        <FormControl>
                          <Textarea placeholder="How did today go?" className="min-h-[100px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-6">
                    {[
                      { name: "energyLevel", label: "Energy Level" },
                      { name: "focusLevel", label: "Focus Level" },
                      { name: "healthLevel", label: "Health / Sickness" },
                      { name: "sleepQuality", label: "Sleep Quality" },
                      { name: "mood", label: "Mood" },
                    ].map((slider) => (
                      <FormField
                        key={slider.name}
                        control={form.control}
                        name={slider.name as any}
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex justify-between">
                              <FormLabel>{slider.label}</FormLabel>
                              <span className="text-sm text-muted-foreground">{field.value}/10</span>
                            </div>
                            <FormControl>
                              <Slider
                                min={1}
                                max={10}
                                step={1}
                                value={[field.value as number]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>

                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="tasksCompleted"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tasks Completed</FormLabel>
                          <FormControl>
                            <Textarea placeholder="What did you get done?" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="tasksMissed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tasks Missed</FormLabel>
                          <FormControl>
                            <Textarea placeholder="What slipped through?" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="habitsCompleted"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Habits Completed (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="e.g. Gym, read 10 pages" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="symptomsNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Symptoms / Health Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Any lingering issues?" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={createCheckin.isPending} className="w-full md:w-auto">
                  {createCheckin.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit & Analyze
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
