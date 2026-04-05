import { useListDailyCheckins, useListWeeklyReviews, useListMetricLogs, useListMetrics } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, FileText, LayoutList, Calendar } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { DailyCheckin } from "@workspace/api-client-react";

function DailyCheckinCard({ checkin }: { readonly checkin: DailyCheckin }) {
  const { data: metricLogs } = useListMetricLogs({ date: checkin.date });
  const { data: metrics } = useListMetrics();

  const logsWithNames = (metricLogs ?? []).map((log) => {
    const metric = metrics?.find((m) => m.id === log.metricId);
    return { ...log, metricName: metric?.name ?? log.metricName, metricCategory: metric?.category ?? log.metricCategory };
  });

  const categories = [...new Set(logsWithNames.map((l) => l.metricCategory))].filter(Boolean);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/50 pb-4 border-b">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <CardTitle className="text-lg">
            {format(new Date(checkin.date + "T12:00:00"), "EEEE, MMMM d, yyyy")}
          </CardTitle>
          {logsWithNames.length > 0 ? (
            <div className="flex gap-1.5 flex-wrap">
              {logsWithNames.slice(0, 4).map((log) => (
                <Badge key={log.id} variant="outline" className="text-xs">
                  {log.metricName}: {log.value}
                </Badge>
              ))}
              {logsWithNames.length > 4 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{logsWithNames.length - 4} more
                </Badge>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <Badge variant="outline">E: {checkin.energyLevel}</Badge>
              <Badge variant="outline">F: {checkin.focusLevel}</Badge>
              <Badge variant="outline">M: {checkin.mood}</Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="metrics" className="border-b-0 px-6">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="font-medium flex items-center gap-2">
                <LayoutList className="h-4 w-4" /> Metric Logs
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 text-muted-foreground space-y-4">
              {logsWithNames.length > 0 ? (
                <div className="space-y-3">
                  {categories.map((cat) => {
                    const catLogs = logsWithNames.filter((l) => l.metricCategory === cat);
                    return (
                      <div key={cat}>
                        <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">{cat}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {catLogs.map((log) => (
                            <div key={log.id} className="text-sm">
                              <span className="text-foreground font-medium">{log.metricName}:</span>{" "}
                              <span>{log.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <strong className="text-foreground block mb-1">Energy</strong>
                    <p>{checkin.energyLevel}/10</p>
                  </div>
                  <div>
                    <strong className="text-foreground block mb-1">Focus</strong>
                    <p>{checkin.focusLevel}/10</p>
                  </div>
                  <div>
                    <strong className="text-foreground block mb-1">Health</strong>
                    <p>{checkin.healthLevel}/10</p>
                  </div>
                  <div>
                    <strong className="text-foreground block mb-1">Sleep Quality</strong>
                    <p>{checkin.sleepQuality}/10</p>
                  </div>
                  <div>
                    <strong className="text-foreground block mb-1">Mood</strong>
                    <p>{checkin.mood}/10</p>
                  </div>
                </div>
              )}
              {checkin.notes && checkin.notes !== "Daily check-in via metrics" && (
                <div>
                  <strong className="text-foreground block mb-1">Notes</strong>
                  <p className="whitespace-pre-wrap">{checkin.notes}</p>
                </div>
              )}
              {checkin.habitsCompleted && (
                <div>
                  <strong className="text-foreground block mb-1">Habits Completed</strong>
                  <p className="whitespace-pre-wrap">{checkin.habitsCompleted}</p>
                </div>
              )}
              {checkin.symptomsNotes && (
                <div>
                  <strong className="text-foreground block mb-1">Symptoms / Health Notes</strong>
                  <p className="whitespace-pre-wrap">{checkin.symptomsNotes}</p>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {(checkin.claudeReflection || checkin.openaiPlan || checkin.combinedAdvice) && (
            <AccordionItem value="ai" className="border-t px-6 border-b-0">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="font-medium flex items-center gap-2 text-primary">
                  <Brain className="h-4 w-4" /> AI Insights
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-6">
                {checkin.claudeReflection && (
                  <div>
                    <strong className="text-foreground block mb-2">Claude Reflection</strong>
                    <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap">
                      {checkin.claudeReflection}
                    </div>
                  </div>
                )}
                {checkin.openaiPlan && (
                  <div>
                    <strong className="text-foreground block mb-2">Tomorrow's Plan</strong>
                    <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap">
                      {checkin.openaiPlan}
                    </div>
                  </div>
                )}
                {checkin.combinedAdvice && (
                  <div>
                    <strong className="text-foreground block mb-2">Operator Advice</strong>
                    <div className="bg-primary/10 border border-primary/20 text-primary-foreground p-4 rounded-md text-sm whitespace-pre-wrap">
                      {checkin.combinedAdvice}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export default function History() {
  const { data: dailyCheckins, isLoading: isLoadingDaily } = useListDailyCheckins();
  const { data: weeklyReviews, isLoading: isLoadingWeekly } = useListWeeklyReviews();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground">Review past check-ins and weekly reflections.</p>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="daily">Daily Check-Ins</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          {isLoadingDaily ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
            </div>
          ) : dailyCheckins?.length === 0 ? (
            <Card className="border-dashed bg-transparent shadow-none">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No daily check-ins yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {dailyCheckins?.map((checkin) => (
                <DailyCheckinCard key={checkin.id} checkin={checkin} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="weekly" className="space-y-4">
          {isLoadingWeekly ? (
            <div className="space-y-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
            </div>
          ) : weeklyReviews?.length === 0 ? (
            <Card className="border-dashed bg-transparent shadow-none">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No weekly reviews yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {weeklyReviews?.map((review) => (
                <Card key={review.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/50 pb-4 border-b">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">
                        Week of {format(new Date(review.weekStartDate + "T12:00:00"), "MMM d, yyyy")}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="outline">Energy: {review.energyTrend}</Badge>
                        <Badge variant="outline">Health: {review.healthTrend}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="notes" className="border-b-0 px-6">
                        <AccordionTrigger className="hover:no-underline py-4">
                          <span className="font-medium flex items-center gap-2">
                            <LayoutList className="h-4 w-4" /> Weekly Summary
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 text-muted-foreground space-y-4">
                          <div>
                            <strong className="text-foreground block mb-1">Notes</strong>
                            <p className="whitespace-pre-wrap">{review.weekNotes}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <strong className="text-foreground block mb-1">Main Wins</strong>
                              <p className="whitespace-pre-wrap">{review.mainWins}</p>
                            </div>
                            <div>
                              <strong className="text-foreground block mb-1">Main Frustrations</strong>
                              <p className="whitespace-pre-wrap">{review.mainFrustrations}</p>
                            </div>
                            {review.goalsNextWeek && (
                              <div>
                                <strong className="text-foreground block mb-1">Goals for Next Week</strong>
                                <p className="whitespace-pre-wrap">{review.goalsNextWeek}</p>
                              </div>
                            )}
                            {review.existingCommitments && (
                              <div>
                                <strong className="text-foreground block mb-1">Existing Commitments</strong>
                                <p className="whitespace-pre-wrap">{review.existingCommitments}</p>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {(review.claudeReflection || review.openaiPlan || review.combinedAdvice) && (
                        <AccordionItem value="ai" className="border-t px-6 border-b-0">
                          <AccordionTrigger className="hover:no-underline py-4">
                            <span className="font-medium flex items-center gap-2 text-primary">
                              <Brain className="h-4 w-4" /> AI Synthesis
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4 space-y-6">
                            {review.claudeReflection && (
                              <div>
                                <strong className="text-foreground block mb-2">Weekly Reflection</strong>
                                <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap">
                                  {review.claudeReflection}
                                </div>
                              </div>
                            )}
                            {review.openaiPlan && (
                              <div>
                                <strong className="text-foreground block mb-2">Next Week's Plan</strong>
                                <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap">
                                  {review.openaiPlan}
                                </div>
                              </div>
                            )}
                            {review.combinedAdvice && (
                              <div>
                                <strong className="text-foreground block mb-2">Strategic Advice</strong>
                                <div className="bg-primary/10 border border-primary/20 text-primary-foreground p-4 rounded-md text-sm whitespace-pre-wrap">
                                  {review.combinedAdvice}
                                </div>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      )}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
