"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, LoaderCircle, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import {
  addMilestoneAction,
  moveMilestoneAction,
  updateMilestoneAction,
  type OrderActionResult,
} from "@/app/(app)/orders/[id]/actions";

export interface TnaStageOption {
  id: string;
  name: string;
  sequence: number;
}

export interface TnaPersonOption {
  id: string;
  full_name: string;
  unit_id?: string | null;
}

export interface TnaUnitOption {
  id: string;
  name: string;
  code: string;
}

export interface TnaSubcontractorOption {
  id: string;
  name: string;
}

interface MilestoneFormValues {
  id: string;
  stageName: string;
  plannedDate: string;
  targetQuantity: number;
  isActive: boolean;
  notes: string | null;
  unitId: string;
  supervisorId: string;
  subcontractorId: string;
}

function runAction(
  action: (formData: FormData) => Promise<OrderActionResult>,
  formData: FormData,
  onSuccess?: () => void,
) {
  return async () => {
    const result = await action(formData);
    if (result.ok) {
      toast.success(result.message ?? "Saved");
      onSuccess?.();
    } else {
      toast.error(result.error ?? "Unable to complete this action.");
    }
  };
}

export function EditMilestoneDialog({
  poId,
  milestone,
  units,
  supervisors,
  subcontractors,
}: {
  poId: string;
  milestone: MilestoneFormValues;
  units: TnaUnitOption[];
  supervisors: TnaPersonOption[];
  subcontractors: TnaSubcontractorOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [plannedDate, setPlannedDate] = useState(milestone.plannedDate);
  const router = useRouter();
  const dateChanged = plannedDate !== milestone.plannedDate;

  function submit(formData: FormData) {
    startTransition(
      runAction(updateMilestoneAction, formData, () => {
        setOpen(false);
        router.refresh();
      }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Edit ${milestone.stageName}`}>
          <Pencil />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Edit ${milestone.stageName}`}
        description="Planned-date changes are recorded in the order's immutable date history."
      >
        <form action={submit} className="space-y-4">
          <input type="hidden" name="poId" value={poId} />
          <input type="hidden" name="milestoneId" value={milestone.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Planned completion" htmlFor={`date-${milestone.id}`} required>
              <Input
                id={`date-${milestone.id}`}
                name="plannedDate"
                type="date"
                value={plannedDate}
                onChange={(event) => setPlannedDate(event.target.value)}
                required
              />
            </Field>
            <Field label="Target quantity" htmlFor={`target-${milestone.id}`} required>
              <Input
                id={`target-${milestone.id}`}
                name="targetQuantity"
                type="number"
                min={0}
                step={1}
                defaultValue={milestone.targetQuantity}
                required
              />
            </Field>
          </div>

          {dateChanged ? (
            <Field
              label="Reason for date change"
              htmlFor={`reason-${milestone.id}`}
              required
              hint="Required — the previous and new dates plus this reason are stored permanently."
            >
              <Textarea
                id={`reason-${milestone.id}`}
                name="dateChangeReason"
                placeholder="e.g. Buyer approved a revised fabric in-house date"
                required
              />
            </Field>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Production unit" htmlFor={`unit-${milestone.id}`}>
              <Select id={`unit-${milestone.id}`} name="unitId" defaultValue={milestone.unitId}>
                <option value="">No unit assigned</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Supervisor" htmlFor={`supervisor-${milestone.id}`}>
              <Select
                id={`supervisor-${milestone.id}`}
                name="supervisorId"
                defaultValue={milestone.supervisorId}
              >
                <option value="">No supervisor assigned</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subcontractor" htmlFor={`subcontractor-${milestone.id}`}>
              <Select
                id={`subcontractor-${milestone.id}`}
                name="subcontractorId"
                defaultValue={milestone.subcontractorId}
              >
                <option value="">In-house</option>
                {subcontractors.map((subcontractor) => (
                  <option key={subcontractor.id} value={subcontractor.id}>
                    {subcontractor.name}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-start gap-2.5 self-end rounded-lg border border-line px-3 py-2.5 text-[13px] text-slate-700">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={milestone.isActive}
                className="mt-0.5 size-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              <span>
                Include in delay analysis
                <span className="mt-0.5 block text-[11px] text-muted">
                  Excluded milestones are kept for history but ignored by health calculations.
                </span>
              </span>
            </label>
          </div>

          <Field label="Notes" htmlFor={`notes-${milestone.id}`}>
            <Textarea
              id={`notes-${milestone.id}`}
              name="notes"
              defaultValue={milestone.notes ?? ""}
              placeholder="Internal planning notes for this stage"
            />
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              Save milestone
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddMilestoneDialog({
  poId,
  stages,
  units,
  supervisors,
  subcontractors,
}: {
  poId: string;
  stages: TnaStageOption[];
  units: TnaUnitOption[];
  supervisors: TnaPersonOption[];
  subcontractors: TnaSubcontractorOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    startTransition(
      runAction(addMilestoneAction, formData, () => {
        setOpen(false);
        router.refresh();
      }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={stages.length === 0}>
          <Plus />
          Add stage
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Add a TNA stage"
        description="The stage is appended to the end of the plan. Use the arrow controls to reorder it."
      >
        <form action={submit} className="space-y-4">
          <input type="hidden" name="poId" value={poId} />

          <Field label="Production stage" htmlFor="add-stage" required>
            <Select id="add-stage" name="stageId" required defaultValue="">
              <option value="" disabled>
                Select a stage
              </option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.sequence}. {stage.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Planned completion" htmlFor="add-planned-date" required>
              <Input id="add-planned-date" name="plannedDate" type="date" required />
            </Field>
            <Field label="Target quantity" htmlFor="add-target" required>
              <Input
                id="add-target"
                name="targetQuantity"
                type="number"
                min={0}
                step={1}
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Production unit" htmlFor="add-unit">
              <Select id="add-unit" name="unitId" defaultValue="">
                <option value="">No unit assigned</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Supervisor" htmlFor="add-supervisor">
              <Select id="add-supervisor" name="supervisorId" defaultValue="">
                <option value="">No supervisor assigned</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subcontractor" htmlFor="add-subcontractor">
              <Select id="add-subcontractor" name="subcontractorId" defaultValue="">
                <option value="">In-house</option>
                {subcontractors.map((subcontractor) => (
                  <option key={subcontractor.id} value={subcontractor.id}>
                    {subcontractor.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              Add to TNA
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MoveMilestoneButton({
  poId,
  milestoneId,
  direction,
  disabled,
  stageName,
}: {
  poId: string;
  milestoneId: string;
  direction: "up" | "down";
  disabled: boolean;
  stageName: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function move() {
    const formData = new FormData();
    formData.set("poId", poId);
    formData.set("milestoneId", milestoneId);
    formData.set("direction", direction);

    startTransition(
      runAction(moveMilestoneAction, formData, () => {
        router.refresh();
      }),
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={move}
      disabled={disabled || pending}
      aria-label={`Move ${stageName} ${direction}`}
      title={`Move ${stageName} ${direction}`}
    >
      {pending ? (
        <LoaderCircle className="animate-spin" />
      ) : direction === "up" ? (
        <ChevronUp />
      ) : (
        <ChevronDown />
      )}
    </Button>
  );
}
