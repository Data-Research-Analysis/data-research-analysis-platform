import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRAPaidMediaPlanEvent } from '../models/DRAPaidMediaPlanEvent.js';
import { DRAPaidMediaPlan } from '../models/DRAPaidMediaPlan.js';
import { SocketIODriver } from '../drivers/SocketIODriver.js';
import { IPlanEvent, PlanEventSeverity } from '../types/IPaidMediaPlan.js';

export interface IPlanEventInput {
    planId: number;
    stepId?: number | null;
    eventType: string;
    severity?: PlanEventSeverity;
    message: string;
    data?: Record<string, any> | null;
    socketEvent?: string | null;
    socketData?: Record<string, any> | null;
}

function toDTO(row: DRAPaidMediaPlanEvent): IPlanEvent {
    return {
        id: row.id,
        planId: row.plan_id,
        stepId: row.step_id,
        eventType: row.event_type,
        severity: row.severity,
        message: row.message,
        data: row.data,
        createdAt: row.created_at.toISOString(),
    };
}

export class PlanEventService {
    private static instance: PlanEventService;

    private constructor() {}

    public static getInstance(): PlanEventService {
        if (!PlanEventService.instance) {
            PlanEventService.instance = new PlanEventService();
        }
        return PlanEventService.instance;
    }

    public static resetInstance(): void {
        PlanEventService.instance = null as any;
    }

    public async record(input: IPlanEventInput): Promise<IPlanEvent> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlanEvent);
        const row = repository.create({
            plan_id: input.planId,
            step_id: input.stepId ?? null,
            event_type: input.eventType,
            severity: input.severity ?? 'info',
            message: input.message,
            data: input.data ?? null,
        });
        await repository.save(row);
        const dto = toDTO(row);

        if (input.socketEvent) {
            await this.emitToPlanUser(input.planId, input.socketEvent, input.socketData ?? dto);
        }
        return dto;
    }

    public async list(planId: number, since?: number, limit = 500): Promise<IPlanEvent[]> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlanEvent);
        const query = repository
            .createQueryBuilder('event')
            .where('event.plan_id = :planId', { planId })
            .orderBy('event.id', 'ASC')
            .take(Math.min(limit, 1000));
        if (since) {
            query.andWhere('event.id > :since', { since });
        }
        const rows = await query.getMany();
        return rows.map(toDTO);
    }

    public async emitToUser(userId: number, event: string, data: any): Promise<void> {
        try {
            await SocketIODriver.getInstance().emitToUser(userId, event, data);
        } catch (error) {
            console.error('[PlanEventService] socket emit failed:', error);
        }
    }

    public async emitToPlanUser(planId: number, event: string, data: any): Promise<void> {
        try {
            const planRepository = (await getAppDataSource()).getRepository(DRAPaidMediaPlan);
            const plan = await planRepository.findOne({ where: { id: planId } });
            if (!plan) return;
            const socketIODriver = SocketIODriver.getInstance();
            if (plan.created_by) {
                await socketIODriver.emitToUser(plan.created_by, event, data);
            }
            if (plan.guest_token) {
                socketIODriver.emitToRoom(`guest-plan:${plan.guest_token}`, event, data);
            }
        } catch (error) {
            console.error('[PlanEventService] socket emit failed:', error);
        }
    }
}
