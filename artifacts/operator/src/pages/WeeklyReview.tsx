import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useCreateWeeklyReview, getListWeeklyReviewsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Sparkles, Loader2, Target } from "lucide-react";
import { useState } from "react";
import type { WeeklyReview } from "@workspace/api-client-react";

const formSchema = z.object({
  weekStartDate: z.string(),
  weekNotes: z.string().min(1, "Required"),
  mainWins: z.string().min(1, "Required"),
  mainFrustrations: z.string().min(1, "Required"),
  energyTrend: z.string(),
  healthTrend: z.string(),
  goalsNextWeek: z.string().min(1, "Required"),
  existingCommitments: z.string().min(1, "Required"),
});

export default function WeeklyReviewPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createReview = useCreateWeeklyReview();
  const [result, setResult] = useState<WeeklyReview | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      weekStartDate: format(new Date(), "yyyy-MM-dd"),
      weekNotes: "",
      mainWins: "",
      mainFrustrations: "",
      energyTrend: "stable",
      healthTrend: "stable",
      goalsNextWeek: "",
      existingCommitments: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createReview.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          setResult(data);
          toast({ title: "Weekly review logged successfully" });
          queryClient.invalidateQueries({ queryKey: getListWeeklyReviewsQueryKey() });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Failed to log review" });
        },
      }
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Weekly Review</h1>
        <p className="text-muted-foreground">Zoom out. What went well? What needs adjustment?</p>
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
                Strategic Advice
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
                  Weekly Synthesis
                </CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
                {result.claudeReflection || "No reflection available."}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-muted-foreground" />
                  Next Week's Plan
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
                  name="weekStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Week Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="w-fit" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weekNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>General Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="How did this week feel overall?" className="min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="mainWins"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Main Wins</FormLabel>
                        <FormControl>
                          <Textarea placeholder="What went well?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mainFrustrations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Main Frustrations</FormLabel>
                        <FormControl>
                          <Textarea placeholder="What blocked you?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="energyTrend"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Energy Trend</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select trend" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="improving">Improving</SelectItem>
                            <SelectItem value="declining">Declining</SelectItem>
                            <SelectItem value="stable">Stable</SelectItem>
                            <SelectItem value="mixed">Mixed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="healthTrend"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Health Trend</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select trend" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="improving">Improving</SelectItem>
                            <SelectItem value="declining">Declining</SelectItem>
                            <SelectItem value="stable">Stable</SelectItem>
                            <SelectItem value="mixed">Mixed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="goalsNextWeek"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Goals for Next Week</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Top priorities?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="existingCommitments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Existing Commitments</FormLabel>
                        <FormControl>
                          <Textarea placeholder="What's already on the calendar?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" disabled={createReview.isPending} className="w-full md:w-auto">
                  {createReview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Weekly Review
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
