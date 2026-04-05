import {
  useListEodReviews,
  useListPreDayPlans,
  useListPreWeekPlans,
} from "@workspace/api-client-react";
import type { EodReview, PreDayPlan, PreWeekPlan } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Sparkles, LayoutList } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function Row({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function EodCard({ review }: { readonly review: EodReview }) {
  const hasData = [
    review.sleepHours, review.sleepScore, review.calories, review.proteinG,
    review.steps, review.workoutCompleted, review.tasksPlanned,
    review.calendarCommitments, review.healthNotes,
  ].some(v => v != null);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/50 pb-4 border-b">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <CardTitle className="text-lg">
            {format(new Date(review.date + "T12:00:00"), "EEEE, MMMM d, yyyy")}
          </CardTitle>
          <div className="flex gap-3 text-xs text-muted-foreground">
            {review.sleepHours != null && <span>💤 {review.sleepHours}h</span>}
            {review.steps != null && <span>🚶 {review.steps.toLocaleString()}</span>}
            {review.tasksCompleted != null && review.tasksPlanned != null && (
              <span>🎯 {review.tasksCompleted}/{review.tasksPlanned}</span>
            )}
            {review.workoutCompleted && <span>🏋️ worked out</span>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="single" collapsible className="w-full">
          {hasData && (
            <AccordionItem value="data" className="border-b px-6">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="font-medium flex items-center gap-2 text-sm">
                  <LayoutList className="h-4 w-4" /> Data
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  {review.sleepHours != null && <Row label="Sleep" value={review.sleepHours + "h"} />}
                  {review.sleepScore != null && <Row label="Sleep score" value={review.sleepScore + "/10"} />}
                  {review.calories != null && <Row label="Calories" value={String(review.calories)} />}
                  {review.proteinG != null && <Row label="Protein" value={review.proteinG + "g"} />}
                  {review.carbsG != null && <Row label="Carbs" value={review.carbsG + "g"} />}
                  {review.fatG != null && <Row label="Fat" value={review.fatG + "g"} />}
                  {review.waterOz != null && <Row label="Water" value={review.waterOz + "oz"} />}
                  {review.steps != null && <Row label="Steps" value={review.steps.toLocaleString()} />}
                  {review.workoutCompleted != null && (
                    <Row label="Workout" value={review.workoutCompleted ? ("Yes" + (review.workoutType ? " — " + review.workoutType : "")) : "No"} />
                  )}
                  {review.habitsCompleted && <Row label="Habits" value={review.habitsCompleted} />}
                  {review.tasksPlanned != null && <Row label="Tasks planned" value={String(review.tasksPlanned)} />}
                  {review.tasksCompleted != null && <Row label="Tasks done" value={String(review.tasksCompleted)} />}
                  {review.tasksMissed != null && <Row label="Tasks missed" value={String(review.tasksMissed)} />}
                  {review.calendarCommitments && <Row label="Calendar" value={review.calendarCommitments} span />}
                  {review.healthNotes && <Row label="Health notes" value={review.healthNotes} span />}
                  {review.reflection && <Row label="Reflection" value={review.reflection} span />}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {(review.aiInsight || review.aiTomorrow) && (
            <AccordionItem value="ai" className="border-b-0 px-6">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="font-medium flex items-center gap-2 text-sm text-amber-400">
                  <Brain className="h-4 w-4" /> AI Outputs
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-4">
                {review.aiInsight && (
                  <div>
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Day Insight</p>
                    <div className="bg-amber-950/20 border border-amber-800/30 p-4 rounded-md text-sm whitespace-pre-wrap">
                      {review.aiInsight}
                    </div>
                  </div>
                )}
                {review.aiTomorrow && (
                  <div>
                    <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">Tomorrow</p>
                    <div className="bg-blue-950/20 border border-blue-800/30 p-4 rounded-md text-sm whitespace-pre-wrap">
                      {review.aiTomorrow}
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

function DayPlanCard({ plan }: { readonly plan: PreDayPlan }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/50 pb-4 border-b">
        <CardTitle className="text-lg">
          {format(new Date(plan.date + "T12:00:00"), "EEEE, MMMM d, yyyy")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="single" collapsible className="w-full">
          {(plan.tasksPlanned || plan.calendarCommitments || plan.energyNote) && (
            <AccordionItem value="data" className="border-b px-6">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="font-medium flex items-center gap-2 text-sm">
                  <LayoutList className="h-4 w-4" /> Inputs
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3 text-sm">
                {plan.tasksPlanned && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tasks Planned</p>
                    <p className="whitespace-pre-wrap">{plan.tasksPlanned}</p>
                  </div>
                )}
                {plan.calendarCommitments && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Calendar</p>
                    <p className="whitespace-pre-wrap">{plan.calendarCommitments}</p>
                  </div>
                )}
                {plan.energyNote && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Energy Note</p>
                    <p>{plan.energyNote}</p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {(plan.aiPlan || plan.aiContext) && (
            <AccordionItem value="ai" className="border-b-0 px-6">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="font-medium flex items-center gap-2 text-sm text-blue-400">
                  <Sparkles className="h-4 w-4" /> AI Plan
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-4">
                {plan.aiPlan && (
                  <div>
                    <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">Day Plan</p>
                    <div className="bg-blue-950/20 border border-blue-800/30 p-4 rounded-md text-sm whitespace-pre-wrap">
                      {plan.aiPlan}
                    </div>
                  </div>
                )}
                {plan.aiContext && (
                  <div>
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Pattern Context</p>
                    <div className="bg-amber-950/20 border border-amber-800/30 p-4 rounded-md text-sm whitespace-pre-wrap">
                      {plan.aiContext}
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

function WeekPlanCard({ plan }: { readonly plan: PreWeekPlan }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/50 pb-4 border-b">
        <CardTitle className="text-lg">
          Week of {format(new Date(plan.weekStartDate + "T12:00:00"), "MMMM d, yyyy")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="single" collapsible className="w-full">
          {(plan.goals || plan.calendarCommitments || plan.capacityNote || plan.reflection) && (
            <AccordionItem value="data" className="border-b px-6">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="font-medium flex items-center gap-2 text-sm">
                  <LayoutList className="h-4 w-4" /> Inputs
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3 text-sm">
                {plan.goals && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Goals</p>
                    <p className="whitespace-pre-wrap">{plan.goals}</p>
                  </div>
                )}
                {plan.calendarCommitments && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Calendar</p>
                    <p className="whitespace-pre-wrap">{plan.calendarCommitments}</p>
                  </div>
                )}
                {plan.capacityNote && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Capacity</p>
                    <p>{plan.capacityNote}</p>
                  </div>
                )}
                {plan.reflection && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reflection</p>
                    <p className="whitespace-pre-wrap">{plan.reflection}</p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {(plan.aiPlan || plan.aiContext) && (
            <AccordionItem value="ai" className="border-b-0 px-6">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="font-medium flex items-center gap-2 text-sm text-blue-400">
                  <Sparkles className="h-4 w-4" /> AI Plan
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-4">
                {plan.aiPlan && (
                  <div>
                    <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">Weekly Structure</p>
                    <div className="bg-blue-950/20 border border-blue-800/30 p-4 rounded-md text-sm whitespace-pre-wrap">
                      {plan.aiPlan}
                    </div>
                  </div>
                )}
                {plan.aiContext && (
                  <div>
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Pattern Context</p>
                    <div className="bg-amber-950/20 border border-amber-800/30 p-4 rounded-md text-sm whitespace-pre-wrap">
                      {plan.aiContext}
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

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <p>{message}</p>
    </div>
  );
}

export default function HistoryPage() {
  const { data: eodReviews, isLoading: loadingEod } = useListEodReviews();
  const { data: dayPlans, isLoading: loadingDay } = useListPreDayPlans();
  const { data: weekPlans, isLoading: loadingWeek } = useListPreWeekPlans();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground">All your logged reviews and plans.</p>
      </div>

      <Tabs defaultValue="eod">
        <TabsList className="mb-6">
          <TabsTrigger value="eod">
            EOD Reviews {eodReviews && eodReviews.length > 0 ? "(" + eodReviews.length + ")" : ""}
          </TabsTrigger>
          <TabsTrigger value="day">
            Day Plans {dayPlans && dayPlans.length > 0 ? "(" + dayPlans.length + ")" : ""}
          </TabsTrigger>
          <TabsTrigger value="week">
            Week Plans {weekPlans && weekPlans.length > 0 ? "(" + weekPlans.length + ")" : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eod">
          {loadingEod ? (
            <LoadingState />
          ) : !eodReviews || eodReviews.length === 0 ? (
            <EmptyState message="No end-of-day reviews yet. Log your first day from the home page." />
          ) : (
            <div className="space-y-4">
              {eodReviews.map(r => <EodCard key={r.id} review={r} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="day">
          {loadingDay ? (
            <LoadingState />
          ) : !dayPlans || dayPlans.length === 0 ? (
            <EmptyState message="No pre-day plans yet. Create your first plan from the Pre-Day Plan page." />
          ) : (
            <div className="space-y-4">
              {dayPlans.map(p => <DayPlanCard key={p.id} plan={p} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="week">
          {loadingWeek ? (
            <LoadingState />
          ) : !weekPlans || weekPlans.length === 0 ? (
            <EmptyState message="No pre-week plans yet. Create your first plan from the Pre-Week Plan page." />
          ) : (
            <div className="space-y-4">
              {weekPlans.map(p => <WeekPlanCard key={p.id} plan={p} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
