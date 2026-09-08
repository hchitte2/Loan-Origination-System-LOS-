import { Skeleton } from "@/components/ui/skeleton";
import { ACTIVE_STAGES } from "@/lib/stages";

/**
 * The board's own skeleton: six columns under their rules, with card-shaped blocks. The
 * group's skeleton is a table, which this screen is not.
 */
export default function PipelineLoading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Loading the pipeline</span>
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-72" />
      </div>
      <div className="overflow-x-auto px-6 pb-6">
        <div className="grid min-w-5xl grid-cols-6 gap-3">
          {ACTIVE_STAGES.map((stage, column) => (
            <div key={stage} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5 border-b-2 border-border pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
              {Array.from({ length: 3 - (column % 2) }, (_, card) => (
                <Skeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: placeholder blocks, no identity
                  key={card}
                  className="h-36 w-full rounded-lg"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
