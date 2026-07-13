import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApifyClient } from 'apify-client';
import { SearchProfilesDto } from './dto/linkedin.dto';

@Injectable()
export class LinkedinService implements OnModuleInit {
  private client: ApifyClient;
  private defaultActorId: string;
  private profileUrlField: string;
  private defaultSearchActorId: string;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const token = this.config.get<string>('APIFY_API_TOKEN');
    this.client = new ApifyClient({ token });
    this.defaultActorId = this.config.get<string>('APIFY_LINKEDIN_ACTOR_ID') || '';
    this.profileUrlField = this.config.get<string>('APIFY_PROFILE_URL_FIELD') || 'profileUrls';
    this.defaultSearchActorId = this.config.get<string>('APIFY_SEARCH_ACTOR_ID') || '';
  }

  /** Starts a run of the configured LinkedIn profile-scraping actor for the given profile URLs. */
  async startProfileScrape(urls: string[], actorId?: string) {
    const targetActor = actorId || this.defaultActorId;
    if (!targetActor) {
      throw new NotFoundException(
        'No actor configured. Set APIFY_LINKEDIN_ACTOR_ID or pass actorId explicitly.',
      );
    }

    const run = await this.client
      .actor(targetActor)
      .start({ [this.profileUrlField]: urls });

    return { runId: run.id, actorId: targetActor, datasetId: run.defaultDatasetId, status: run.status };
  }

  /** Starts a filtered LinkedIn people-search run (no login/cookies required). */
  async startProfileSearch(dto: SearchProfilesDto) {
    const targetActor = dto.actorId || this.defaultSearchActorId;
    if (!targetActor) {
      throw new NotFoundException(
        'No search actor configured. Set APIFY_SEARCH_ACTOR_ID or pass actorId explicitly.',
      );
    }

    const { actorId: _actorId, ...filters } = dto;
    const input = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined && value !== null),
    );

    const run = await this.client.actor(targetActor).start(input);

    return { runId: run.id, actorId: targetActor, datasetId: run.defaultDatasetId, status: run.status };
  }

  /** Starts a run of an arbitrary Apify actor with a caller-supplied input payload. */
  async startRun(actorId: string, input: Record<string, unknown>) {
    const run = await this.client.actor(actorId).start(input);
    return { runId: run.id, actorId, datasetId: run.defaultDatasetId, status: run.status };
  }

  /** Fetches the current status of a run, and its dataset items once finished. */
  async getRun(runId: string) {
    const run = await this.client.run(runId).get();
    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    const result: Record<string, unknown> = { runId: run.id, status: run.status };

    if (run.status === 'SUCCEEDED') {
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
      result.items = items;
    }

    return result;
  }
}
