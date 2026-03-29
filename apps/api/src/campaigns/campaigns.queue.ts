export const CAMPAIGNS_QUEUE_NAME = 'campaigns';

export const CampaignExpirationJobNames = {
  EXPIRE_CAMPAIGN: 'expire-campaign',
} as const;

export type CampaignExpirationJobData = {
  campaignId: string;
  endDate: string;
};

export function getCampaignExpirationJobId(campaignId: string): string {
  return `campaign-expiration-${campaignId}`;
}
