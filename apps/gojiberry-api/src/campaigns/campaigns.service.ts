import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { CampaignStatus } from '@prisma/client';

interface StepInput {
  order: number;
  delayDays: number;
  channel?: 'EMAIL' | 'LINKEDIN';
  subjectTemplate?: string;
  bodyTemplate: string;
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private prisma: PrismaService,
    private messages: MessagesService,
  ) {}

  create(userId: string, name: string, icpProfileId: string | undefined, steps: StepInput[]) {
    return this.prisma.campaign.create({
      data: {
        userId,
        name,
        icpProfileId,
        steps: {
          create: steps.map((s) => ({
            order: s.order,
            delayDays: s.delayDays,
            channel: s.channel ?? 'EMAIL',
            subjectTemplate: s.subjectTemplate,
            bodyTemplate: s.bodyTemplate,
          })),
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  list(userId: string) {
    return this.prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        steps: { orderBy: { order: 'asc' } },
        _count: { select: { enrollments: true } },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId },
      include: {
        steps: { orderBy: { order: 'asc' } },
        enrollments: { include: { lead: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async setStatus(userId: string, id: string, status: CampaignStatus) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, userId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return this.prisma.campaign.update({ where: { id }, data: { status } });
  }

  async enroll(userId: string, campaignId: string, leadIds: string[]) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const firstStep = campaign.steps[0];

    return this.prisma.$transaction(
      leadIds.map((leadId) =>
        this.prisma.campaignEnrollment.upsert({
          where: { campaignId_leadId: { campaignId, leadId } },
          update: {},
          create: {
            campaignId,
            leadId,
            currentStep: 0,
            nextSendAt: firstStep ? new Date() : dayjs().add(1, 'year').toDate(),
          },
        }),
      ),
    );
  }

  // Advances every active enrollment whose next step is due, sending the
  // rendered template for that step and scheduling the following one.
  @Cron(CronExpression.EVERY_HOUR)
  async processDueEnrollments() {
    const due = await this.prisma.campaignEnrollment.findMany({
      where: { status: 'ACTIVE', nextSendAt: { lte: new Date() } },
      include: {
        lead: true,
        campaign: { include: { steps: { orderBy: { order: 'asc' } } } },
      },
      take: 100,
    });

    for (const enrollment of due) {
      try {
        await this.processOne(enrollment);
      } catch (err) {
        this.logger.warn(`Enrollment ${enrollment.id} failed: ${(err as Error).message}`);
      }
    }
  }

  private async processOne(enrollment: any) {
    const step = enrollment.campaign.steps[enrollment.currentStep];
    if (!step) {
      await this.prisma.campaignEnrollment.update({
        where: { id: enrollment.id },
        data: { status: 'COMPLETED' },
      });
      return;
    }

    const rendered = this.render(step.bodyTemplate, enrollment.lead);
    const subject = step.subjectTemplate ? this.render(step.subjectTemplate, enrollment.lead) : null;

    const message = await this.prisma.message.create({
      data: {
        userId: enrollment.campaign.userId,
        leadId: enrollment.leadId,
        campaignId: enrollment.campaignId,
        channel: step.channel,
        subject,
        body: rendered,
        status: 'DRAFT',
        generatedByAi: false,
      },
    });
    await this.messages.send(enrollment.campaign.userId, message.id);

    const nextStep = enrollment.campaign.steps[enrollment.currentStep + 1];
    await this.prisma.campaignEnrollment.update({
      where: { id: enrollment.id },
      data: {
        currentStep: enrollment.currentStep + 1,
        status: nextStep ? 'ACTIVE' : 'COMPLETED',
        nextSendAt: nextStep ? dayjs().add(nextStep.delayDays, 'day').toDate() : enrollment.nextSendAt,
      },
    });
  }

  private render(template: string, lead: { fullName: string; title: string; company: string }) {
    const firstName = lead.fullName.split(' ')[0];
    return template
      .replace(/{{\s*firstName\s*}}/g, firstName)
      .replace(/{{\s*fullName\s*}}/g, lead.fullName)
      .replace(/{{\s*title\s*}}/g, lead.title)
      .replace(/{{\s*company\s*}}/g, lead.company);
  }
}
