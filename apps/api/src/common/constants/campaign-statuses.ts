export const campaignStatuses = [
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
] as const;

export type CampaignStatus = (typeof campaignStatuses)[number];
